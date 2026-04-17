-- 030_content_audit_findings.sql
-- Results of the weekly content audit scanner (Layer 5).
-- Stores one row per finding (content_id × issue_code). Each run clears old
-- findings for that code and writes fresh ones so the dashboard reflects
-- current state. Historical totals live in content_audit_runs.

CREATE TABLE IF NOT EXISTS content_audit_findings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  content_id INTEGER NOT NULL,
  issue_code TEXT NOT NULL,        -- 'empty_option' | 'ultra_short_option' | 'dup_options' | 'missing_media' | 'missing_answer' | etc
  severity TEXT NOT NULL DEFAULT 'medium',  -- 'low' | 'medium' | 'high'
  section TEXT,
  question_type TEXT,
  message TEXT,                    -- human-readable description
  run_id INTEGER NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (content_id) REFERENCES test_contents(id)
);

CREATE INDEX IF NOT EXISTS idx_content_audit_findings_run
  ON content_audit_findings(run_id);

CREATE INDEX IF NOT EXISTS idx_content_audit_findings_content
  ON content_audit_findings(content_id);

CREATE INDEX IF NOT EXISTS idx_content_audit_findings_code
  ON content_audit_findings(issue_code, severity);

-- Per-run summary for trend charts
CREATE TABLE IF NOT EXISTS content_audit_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  started_at TEXT DEFAULT (datetime('now')),
  finished_at TEXT,
  scanned_count INTEGER NOT NULL DEFAULT 0,
  error_count INTEGER NOT NULL DEFAULT 0,     -- rows with validator errors
  warning_count INTEGER NOT NULL DEFAULT 0,   -- rows with only warnings
  healthy_count INTEGER NOT NULL DEFAULT 0,
  -- JSON breakdown by issue_code: { "empty_option": 12, "dup_options": 3, ... }
  breakdown TEXT,
  -- Optional notes (e.g. "triggered by admin @leo")
  notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_content_audit_runs_started
  ON content_audit_runs(started_at DESC);
