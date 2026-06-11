-- 094: Score prediction engine (ROADMAP_M3 §1.1)
-- Weekly snapshots of estimated scaled scores per user/exam.

CREATE TABLE IF NOT EXISTS score_estimates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  test_type TEXT NOT NULL,
  estimated_score REAL NOT NULL,
  score_scale TEXT NOT NULL,          -- 'ielts_band' | 'toefl_ibt' | 'toefl_itp' | 'toeic'
  confidence REAL NOT NULL,           -- 0..1
  inputs_json TEXT,                   -- the signals used, for debugging
  snapshot_date TEXT NOT NULL,        -- date('now')
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE(user_id, test_type, snapshot_date)
);

CREATE INDEX IF NOT EXISTS idx_score_estimates_user
  ON score_estimates(user_id, test_type, snapshot_date DESC);
