-- 035_test_retest_reliability.sql
-- Stores paired attempts from the same user on the same test_type taken
-- within a short window (default 7 days). Comparing band-score deltas
-- across this cohort gives us test-retest reliability: if the same
-- student gets 6.0 then 7.5 a day later, our scoring is noise.

CREATE TABLE IF NOT EXISTS test_retest_pairs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  test_type TEXT NOT NULL,
  attempt_a_id INTEGER NOT NULL,
  attempt_b_id INTEGER NOT NULL,
  score_a REAL NOT NULL,
  score_b REAL NOT NULL,
  delta REAL NOT NULL,                  -- b - a
  abs_delta REAL NOT NULL,
  hours_between REAL NOT NULL,
  flag TEXT,                            -- 'unreliable' if abs_delta > 0.5 within 48h
  detected_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id),
  UNIQUE(attempt_a_id, attempt_b_id)
);

CREATE INDEX IF NOT EXISTS idx_test_retest_pairs_type
  ON test_retest_pairs(test_type, detected_at DESC);

CREATE INDEX IF NOT EXISTS idx_test_retest_pairs_flag
  ON test_retest_pairs(flag, abs_delta DESC);

CREATE TABLE IF NOT EXISTS test_retest_snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  test_type TEXT NOT NULL,
  window_hours INTEGER NOT NULL,
  pair_count INTEGER NOT NULL,
  mean_abs_delta REAL,
  median_abs_delta REAL,
  within_half_band_pct REAL,
  within_one_band_pct REAL,
  retest_correlation REAL,              -- Pearson r between attempt A and B scores
  unreliable_count INTEGER,
  snapshot_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_test_retest_snapshots_time
  ON test_retest_snapshots(test_type, snapshot_at DESC);
