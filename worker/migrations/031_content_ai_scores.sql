-- 031_content_ai_scores.sql
-- Weekly AI quality sampler (Layer 4).
-- Each run samples N random published items and scores them with GPT on a rubric.

CREATE TABLE IF NOT EXISTS content_ai_scores (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  content_id INTEGER NOT NULL,
  run_id INTEGER NOT NULL,
  section TEXT,
  question_type TEXT,
  -- Rubric scores (1-5)
  clarity_score INTEGER,
  answer_correctness INTEGER,
  option_quality INTEGER,
  passage_alignment INTEGER,
  overall_score INTEGER,
  -- Verdict + notes
  verdict TEXT,              -- 'pass' | 'concern' | 'fail'
  issues TEXT,               -- JSON array of issue strings
  ai_notes TEXT,             -- short natural-language summary
  cost_usd REAL,             -- estimated
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (content_id) REFERENCES test_contents(id)
);

CREATE INDEX IF NOT EXISTS idx_content_ai_scores_run
  ON content_ai_scores(run_id, overall_score ASC);

CREATE INDEX IF NOT EXISTS idx_content_ai_scores_content
  ON content_ai_scores(content_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_content_ai_scores_verdict
  ON content_ai_scores(verdict, overall_score);

CREATE TABLE IF NOT EXISTS content_ai_score_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  started_at TEXT DEFAULT (datetime('now')),
  finished_at TEXT,
  sample_size INTEGER,
  scored_count INTEGER DEFAULT 0,
  failed_count INTEGER DEFAULT 0,
  avg_overall REAL,
  fail_count INTEGER DEFAULT 0,     -- verdict = 'fail'
  concern_count INTEGER DEFAULT 0,  -- verdict = 'concern'
  total_cost_usd REAL,
  notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_content_ai_score_runs_started
  ON content_ai_score_runs(started_at DESC);
