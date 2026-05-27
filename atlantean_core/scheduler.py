"""Compute scheduler with explicit gating controls for optional cognition layers."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict, Sequence
import time

from governance import GovernanceController
from symbolic_reasoner import SymbolicReasoner


@dataclass
class ComputeGatingControls:
    enable_symbolic_reasoning: bool = False
    symbolic_every_n_queries: int = 25
    symbolic_max_compute_ms_per_call: float = 6.0
    symbolic_budget_ms_per_minute: float = 120.0


class ComputeScheduler:
    """Runs optional modules only when policy and compute budgets allow it."""

    def __init__(self, controls: ComputeGatingControls | None = None):
        self.controls = controls or ComputeGatingControls()
        self.query_counter = 0

    def tick(self) -> None:
        self.query_counter += 1

    def should_run_symbolic(self, force: bool = False) -> bool:
        if force:
            return True
        if not self.controls.enable_symbolic_reasoning:
            return False
        every = max(1, int(self.controls.symbolic_every_n_queries))
        return self.query_counter > 0 and (self.query_counter % every == 0)

    def run_symbolic_if_allowed(
        self,
        reasoner: SymbolicReasoner,
        governance: GovernanceController,
        query: str,
        context_facts: Sequence[str] | None = None,
        force: bool = False,
    ) -> Dict[str, Any]:
        if not self.should_run_symbolic(force=force):
            return {"ran": False, "reason": "cadence-or-disabled"}

        estimate_ms = reasoner.estimate_cost_ms(query, context_facts)
        if estimate_ms > float(self.controls.symbolic_max_compute_ms_per_call):
            return {
                "ran": False,
                "reason": "local-call-compute-limit",
                "estimated_cost_ms": estimate_ms,
            }

        decision = governance.authorize("symbolic_reasoning", estimate_ms)
        if not decision.allowed:
            return {
                "ran": False,
                "reason": decision.reason,
                "estimated_cost_ms": estimate_ms,
            }

        started = time.perf_counter()
        result = reasoner.reason(query, context_facts)
        elapsed_ms = (time.perf_counter() - started) * 1000.0
        governance.record_execution("symbolic_reasoning", elapsed_ms)

        return {
            "ran": True,
            "elapsed_ms": round(elapsed_ms, 3),
            "estimated_cost_ms": round(estimate_ms, 3),
            "result": result.to_dict(),
            "governance": governance.snapshot().get("symbolic_reasoning", {}),
        }
