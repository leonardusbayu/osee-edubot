-- 033_scoring_reliability.sql
-- Scoring-reliability audit — measures whether the same essay or speaking
-- response gets the same score from GPT when graded multiple times.
--
-- Each run: sample N submissions, re-grade each K times (K=3 default),
-- record the mean + stddev of overall scores. Std-dev > 0.5 band means the
-- rubric is ambiguous and the score is noise.

CREATE TABLE IF NOT EXISTS scoring_reliability_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kind TEXT NOT NULL,                 -- 'writing' | 'speaking'
  started_at TEXT DEFAULT (datetime('now')),
  finished_at TEXT,
  sample_size INTEGER NOT NULL,
  regrades_per_item INTEGER NOT NULL DEFAULT 3,
  scored_count INTEGER DEFAULT 0,
  failed_count INTEGER DEFAULT 0,
  avg_stddev REAL,                    -- mean of per-item stddevs
  max_stddev REAL,
  noisy_count INTEGER DEFAULT 0,      -- items with stddev > 0.5
  avg_mean_score REAL,
  total_cost_usd REAL,
  notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_scoring_reliability_runs_started
  ON scoring_reliability_runs(started_at DESC);

CREATE TABLE IF NOT EXISTS scoring_reliability_samples (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id INTEGER NOT NULL,
  kind TEXT NOT NULL,                 -- 'writing' | 'speaking'
  source_id INTEGER,                  -- attempt_answer.id or speaking_session.id
  user_id INTEGER,
  original_score REAL,                -- what the student saw
  regrade_scores TEXT,                -- JSON array of K scores
  mean_score REAL,
  stddev REAL,
  drift_vs_original REAL,             -- mean_score - original_score
  is_noisy INTEGER DEFAULT 0,         -- stddev > 0.5
  cost_usd REAL,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (run_id) REFERENCES scoring_reliability_runs(id)
);

CREATE INDEX IF NOT EXISTS idx_scoring_reliability_samples_run
  ON scoring_reliability_samples(run_id, stddev DESC);
