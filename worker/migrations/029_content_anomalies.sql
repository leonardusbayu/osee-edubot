-- 029_content_anomalies.sql
-- Stores items flagged by the nightly accuracy/skip anomaly detector.
-- One row per (content_id, flag_type, detected_at) — we keep history so we can
-- watch trends and auto-close items that recover after a fix.

CREATE TABLE IF NOT EXISTS content_anomalies (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  content_id INTEGER NOT NULL,
  flag_type TEXT NOT NULL,         -- 'low_accuracy' | 'high_skip' | 'too_fast' | 'too_slow'
  severity TEXT NOT NULL DEFAULT 'medium',  -- 'low' | 'medium' | 'high'
  section TEXT,
  question_type TEXT,
  -- Metrics snapshot at detection time
  total_attempts INTEGER NOT NULL,
  correct_count INTEGER NOT NULL,
  accuracy_rate REAL,              -- correct / graded (0..1)
  skip_count INTEGER NOT NULL DEFAULT 0,
  skip_rate REAL,                  -- skip / total (0..1)
  avg_time_seconds REAL,
  -- Lifecycle
  status TEXT NOT NULL DEFAULT 'open',  -- 'open' | 'acknowledged' | 'resolved' | 'false_positive'
  notes TEXT,
  detected_at TEXT DEFAULT (datetime('now')),
  resolved_at TEXT,
  resolved_by INTEGER,
  FOREIGN KEY (content_id) REFERENCES test_contents(id)
);

CREATE INDEX IF NOT EXISTS idx_content_anomalies_status
  ON content_anomalies(status, severity, detected_at DESC);

CREATE INDEX IF NOT EXISTS idx_content_anomalies_content
  ON content_anomalies(content_id, detected_at DESC);

CREATE INDEX IF NOT EXISTS idx_content_anomalies_flag
  ON content_anomalies(flag_type, status);
