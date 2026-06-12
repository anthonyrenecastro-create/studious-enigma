-- Atlantean Aurora schema for AWS persistence (RDS Data API)
--
-- These table names match the default configured environment variables:
--   AWS_AURORA_EVENTS_TABLE=atlantean_events
--   AWS_AURORA_SNAPSHOTS_TABLE=atlantean_snapshots
--   AWS_AURORA_CHECKPOINTS_TABLE=atlantean_checkpoints
--
-- If you changed those env vars, rename table identifiers below to match.

CREATE TABLE IF NOT EXISTS atlantean_events (
  session_id VARCHAR(191) NOT NULL,
  record_id VARCHAR(191) NOT NULL,
  record_type VARCHAR(32) NOT NULL,
  seq BIGINT NOT NULL,
  created_at_ms BIGINT NOT NULL,
  payload_json LONGTEXT NOT NULL,
  PRIMARY KEY (session_id, record_id),
  INDEX idx_atlantean_events_session_seq (session_id, seq),
  INDEX idx_atlantean_events_created_at (created_at_ms)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS atlantean_snapshots (
  session_id VARCHAR(191) NOT NULL,
  record_id VARCHAR(191) NOT NULL,
  record_type VARCHAR(32) NOT NULL,
  seq BIGINT NOT NULL,
  created_at_ms BIGINT NOT NULL,
  payload_json LONGTEXT NOT NULL,
  PRIMARY KEY (session_id, record_id),
  INDEX idx_atlantean_snapshots_session_seq (session_id, seq),
  INDEX idx_atlantean_snapshots_created_at (created_at_ms)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS atlantean_checkpoints (
  session_id VARCHAR(191) NOT NULL,
  record_id VARCHAR(191) NOT NULL,
  record_type VARCHAR(32) NOT NULL,
  seq BIGINT NOT NULL,
  created_at_ms BIGINT NOT NULL,
  payload_json LONGTEXT NOT NULL,
  PRIMARY KEY (session_id, record_id),
  INDEX idx_atlantean_checkpoints_session_seq (session_id, seq),
  INDEX idx_atlantean_checkpoints_created_at (created_at_ms)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
