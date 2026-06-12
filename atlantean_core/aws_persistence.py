"""
Optional AWS persistence for Atlantean backend state artifacts.

This module is designed for best-effort dual-write persistence:
- Redis remains the primary fast state store.
- DynamoDB and/or Aurora (Data API) receive replicated records.

Enable with environment variables. If AWS is not configured, this module
remains a no-op and does not affect request flow.
"""

from __future__ import annotations

import json
import os
import re
from typing import Any, Dict, Optional

try:
    import boto3
except Exception:  # pragma: no cover - optional dependency at runtime
    boto3 = None


_SAFE_TABLE_RE = re.compile(r"^[A-Za-z0-9_]+$")


def _safe_table_name(name: str) -> str:
    """Allow only simple SQL identifiers from environment values."""
    if not _SAFE_TABLE_RE.match(name):
        raise ValueError(f"Unsafe table name: {name}")
    return name


class AwsPersistence:
    """Best-effort writer for DynamoDB and Aurora Data API."""

    def __init__(self) -> None:
        self.mode = (os.getenv("AWS_DB_MODE", "none") or "none").strip().lower()
        self.region = os.getenv("AWS_REGION", "us-east-1")

        self._enabled_modes = {"dynamodb", "aurora", "both"}
        self.enabled = self.mode in self._enabled_modes
        self.available = bool(boto3)

        self.dynamo_enabled = self.enabled and self.mode in {"dynamodb", "both"}
        self.aurora_enabled = self.enabled and self.mode in {"aurora", "both"}

        prefix = (os.getenv("AWS_DYNAMODB_TABLE_PREFIX", "atlantean") or "atlantean").strip()
        self.ddb_events_table = os.getenv("AWS_DYNAMODB_EVENTS_TABLE", f"{prefix}_events")
        self.ddb_snapshots_table = os.getenv("AWS_DYNAMODB_SNAPSHOTS_TABLE", f"{prefix}_snapshots")
        self.ddb_checkpoints_table = os.getenv("AWS_DYNAMODB_CHECKPOINTS_TABLE", f"{prefix}_checkpoints")

        self.aurora_cluster_arn = os.getenv("AWS_AURORA_CLUSTER_ARN", "").strip()
        self.aurora_secret_arn = os.getenv("AWS_AURORA_SECRET_ARN", "").strip()
        self.aurora_database = os.getenv("AWS_AURORA_DATABASE", "atlantean").strip()
        self.aurora_events_table = os.getenv("AWS_AURORA_EVENTS_TABLE", "atlantean_events").strip()
        self.aurora_snapshots_table = os.getenv("AWS_AURORA_SNAPSHOTS_TABLE", "atlantean_snapshots").strip()
        self.aurora_checkpoints_table = os.getenv("AWS_AURORA_CHECKPOINTS_TABLE", "atlantean_checkpoints").strip()

        self._dynamo = None
        self._rds_data = None

        if not self.available:
            return

        if self.dynamo_enabled:
            self._dynamo = boto3.resource("dynamodb", region_name=self.region)

        if self.aurora_enabled and self.aurora_cluster_arn and self.aurora_secret_arn:
            self._rds_data = boto3.client("rds-data", region_name=self.region)

    def is_active(self) -> bool:
        """True when at least one AWS backend can currently accept writes."""
        if not self.enabled or not self.available:
            return False
        dynamo_ready = self.dynamo_enabled and self._dynamo is not None
        aurora_ready = self.aurora_enabled and self._rds_data is not None
        return dynamo_ready or aurora_ready

    def persist_event(self, session_id: str, event: Dict[str, Any]) -> None:
        """Persist a signed event to configured AWS backends."""
        if not self.is_active():
            return

        record_id = str(event.get("event_hash") or f"event-{event.get('seq', 0)}")
        seq = int(event.get("seq", 0))
        ts = int(event.get("timestamp", 0))

        if self.dynamo_enabled and self._dynamo is not None:
            self._put_dynamodb(
                table_name=self.ddb_events_table,
                item={
                    "pk": f"session#{session_id}",
                    "sk": f"event#{seq:012d}",
                    "record_id": record_id,
                    "record_type": "event",
                    "session_id": session_id,
                    "seq": seq,
                    "created_at": ts,
                    "payload": event,
                },
            )

        if self.aurora_enabled and self._rds_data is not None:
            self._insert_aurora(
                table_name=self.aurora_events_table,
                session_id=session_id,
                record_id=record_id,
                record_type="event",
                seq=seq,
                created_at=ts,
                payload=event,
            )

    def persist_checkpoint(self, session_id: str, checkpoint: Dict[str, Any]) -> None:
        """Persist a signed checkpoint to configured AWS backends."""
        if not self.is_active():
            return

        record_id = str(checkpoint.get("id") or checkpoint.get("checkpoint_hash") or "checkpoint")
        seq = int(checkpoint.get("seq", 0))
        ts = int(checkpoint.get("created_at", 0))

        if self.dynamo_enabled and self._dynamo is not None:
            self._put_dynamodb(
                table_name=self.ddb_checkpoints_table,
                item={
                    "pk": f"session#{session_id}",
                    "sk": f"checkpoint#{seq:012d}#{record_id}",
                    "record_id": record_id,
                    "record_type": "checkpoint",
                    "session_id": session_id,
                    "seq": seq,
                    "created_at": ts,
                    "payload": checkpoint,
                },
            )

        if self.aurora_enabled and self._rds_data is not None:
            self._insert_aurora(
                table_name=self.aurora_checkpoints_table,
                session_id=session_id,
                record_id=record_id,
                record_type="checkpoint",
                seq=seq,
                created_at=ts,
                payload=checkpoint,
            )

    def persist_snapshot_record(self, session_id: str, snapshot_record: Dict[str, Any]) -> None:
        """Persist snapshot index metadata to configured AWS backends."""
        if not self.is_active():
            return

        record_id = str(snapshot_record.get("id") or "snapshot")
        version = int(snapshot_record.get("version", 0) or 0)
        created_at = snapshot_record.get("created_at")
        ts = int(created_at) if isinstance(created_at, (int, float)) else 0

        if self.dynamo_enabled and self._dynamo is not None:
            self._put_dynamodb(
                table_name=self.ddb_snapshots_table,
                item={
                    "pk": f"session#{session_id}",
                    "sk": f"snapshot#{ts:013d}#{record_id}",
                    "record_id": record_id,
                    "record_type": "snapshot",
                    "session_id": session_id,
                    "seq": version,
                    "created_at": ts,
                    "payload": snapshot_record,
                },
            )

        if self.aurora_enabled and self._rds_data is not None:
            self._insert_aurora(
                table_name=self.aurora_snapshots_table,
                session_id=session_id,
                record_id=record_id,
                record_type="snapshot",
                seq=version,
                created_at=ts,
                payload=snapshot_record,
            )

    def _put_dynamodb(self, table_name: str, item: Dict[str, Any]) -> None:
        try:
            table = self._dynamo.Table(table_name)
            table.put_item(Item=item)
        except Exception as exc:
            print(f"⚠️  DynamoDB write failed ({table_name}): {exc}")

    def _insert_aurora(
        self,
        table_name: str,
        session_id: str,
        record_id: str,
        record_type: str,
        seq: int,
        created_at: int,
        payload: Dict[str, Any],
    ) -> None:
        if self._rds_data is None:
            return

        try:
            safe_table = _safe_table_name(table_name)
            sql = (
                f"INSERT INTO {safe_table} "
                "(session_id, record_id, record_type, seq, created_at_ms, payload_json) "
                "VALUES(:session_id, :record_id, :record_type, :seq, :created_at_ms, :payload_json)"
            )
            self._rds_data.execute_statement(
                resourceArn=self.aurora_cluster_arn,
                secretArn=self.aurora_secret_arn,
                database=self.aurora_database,
                sql=sql,
                parameters=[
                    {"name": "session_id", "value": {"stringValue": session_id}},
                    {"name": "record_id", "value": {"stringValue": record_id}},
                    {"name": "record_type", "value": {"stringValue": record_type}},
                    {"name": "seq", "value": {"longValue": int(seq)}},
                    {"name": "created_at_ms", "value": {"longValue": int(created_at)}},
                    {"name": "payload_json", "value": {"stringValue": json.dumps(payload)}},
                ],
            )
        except Exception as exc:
            print(f"⚠️  Aurora write failed ({table_name}): {exc}")


def build_aws_persistence() -> Optional[AwsPersistence]:
    """Build AWS persistence writer; returns None when disabled."""
    writer = AwsPersistence()
    if writer.is_active():
        return writer
    return None
