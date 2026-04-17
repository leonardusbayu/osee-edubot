-- 032_item_analysis.sql
-- Classical-test-theory item analysis.
-- For each MCQ with enough attempts, we compute:
--   p_value       — overall fraction correct (difficulty)
--   upper_p       — fraction correct among top-half overall scorers
--   lower_p       — fraction correct among bottom-half overall scorers
--   discrimination= upper_p − lower_p   (should be > 0.1)
--
-- Negative discrimination is the killer signal: high-scoring students miss
-- it while low-scoring students get it right → the marked answer is probably
-- wrong. This catches miskeyed items that read fine to a human reviewer.

CREATE TABLE IF NOT EXISTS item_analysis_findings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  content_id INTEGER NOT NULL,
  section TEXT,
  question_type TEXT,
  total_attempts INTEGER NOT NULL,
  p_value REAL NOT NULL,
  upper_p REAL,
  lower_p REAL,
  discrimination REAL,
  flag_type TEXT NOT NULL,          -- 'likely_miskeyed' | 'low_discrimination' | 'too_easy' | 'too_hard'
  severity TEXT NOT NULL DEFAULT 'medium',
  status TEXT NOT NULL DEFAULT 'open',
  notes TEXT,
  detected_at TEXT DEFAULT (datetime('now')),
  resolved_at TEXT,
  resolved_by INTEGER,
  FOREIGN KEY (content_id) REFERENCES test_contents(id)
);

CREATE INDEX IF NOT EXISTS idx_item_analysis_status
  ON item_analysis_findings(status, severity, detected_at DESC);

CREATE INDEX IF NOT EXISTS idx_item_analysis_content
  ON item_analysis_findings(content_id);

CREATE INDEX IF NOT EXISTS idx_item_analysis_flag
  ON item_analysis_findings(flag_type, severity);
