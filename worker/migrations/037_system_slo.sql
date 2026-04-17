-- 037_system_slo.sql
-- Operational reliability / SLO tracking.
-- Every hour we snapshot recent error + activity counts so we can answer:
--   "Has the error rate spiked vs. the last 24h baseline?"
--   "Is the bot throwing more 5xx than usual?"
--   "Did OpenAI/Whisper calls start failing more?"
-- Without this, outages are only visible when a user complains.

CREATE TABLE IF NOT EXISTS system_slo_snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  window_minutes INTEGER NOT NULL,       -- always 60 for hourly, kept for flexibility
  attempt_count INTEGER DEFAULT 0,       -- test attempts finished in window
  answer_count INTEGER DEFAULT 0,        -- attempt_answers written in window
  speaking_count INTEGER DEFAULT 0,      -- speaking_sessions created in window
  server_error_count INTEGER DEFAULT 0,  -- error_logs source='server'
  client_error_count INTEGER DEFAULT 0,  -- error_logs source='client'
  bot_error_count INTEGER DEFAULT 0,     -- error_logs source='bot'
  openai_error_count INTEGER DEFAULT 0,  -- error_logs with error_type LIKE '%openai%' or message LIKE '%openai%'
  whisper_error_count INTEGER DEFAULT 0, -- error_logs with message LIKE '%whisper%'
  total_activity INTEGER DEFAULT 0,      -- attempts + answers + speaking
  error_rate REAL DEFAULT 0,             -- total_errors / total_activity
  snapshot_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_system_slo_snapshot_time
  ON system_slo_snapshots(snapshot_at DESC);

-- Alerts fired when a metric crosses a threshold. One row per firing;
-- resolution is implicit (next snapshot that falls back under threshold
-- inserts a matching 'resolved' row). This is simpler than mutating
-- open/closed state and plays nicely with the audit dashboard.
CREATE TABLE IF NOT EXISTS system_slo_alerts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  metric TEXT NOT NULL,                  -- 'error_rate' | 'server_errors' | 'openai_errors' | 'whisper_errors' | 'activity_drop'
  severity TEXT NOT NULL DEFAULT 'medium',
  current_value REAL,
  baseline_value REAL,
  threshold REAL,
  state TEXT NOT NULL DEFAULT 'firing',  -- 'firing' | 'resolved'
  detail TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_system_slo_alerts_state
  ON system_slo_alerts(state, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_system_slo_alerts_metric
  ON system_slo_alerts(metric, created_at DESC);
