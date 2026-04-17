-- 034_real_score_calibration.sql
-- Stores self-reported real IELTS/TOEFL scores so we can measure how well
-- the bot's predicted band tracks reality. Without this, our scoring claims
-- are unfalsifiable.
--
-- Users submit via /realscore bot command or the mini-app form. We snapshot
-- the latest bot-predicted band at submission time for an apples-to-apples
-- comparison.

CREATE TABLE IF NOT EXISTS real_test_scores (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  test_type TEXT NOT NULL,              -- 'IELTS' | 'TOEFL_IBT' | 'TOEIC' | 'TOEFL_ITP'
  real_overall_score REAL NOT NULL,
  real_reading REAL,
  real_listening REAL,
  real_speaking REAL,
  real_writing REAL,
  -- Snapshot of what the bot predicted at the time they submitted
  bot_predicted_overall REAL,
  bot_predicted_reading REAL,
  bot_predicted_listening REAL,
  bot_predicted_speaking REAL,
  bot_predicted_writing REAL,
  -- Context
  test_taken_at TEXT,                    -- when they took the real test
  reported_at TEXT DEFAULT (datetime('now')),
  verification_status TEXT DEFAULT 'unverified',  -- 'unverified' | 'verified' | 'flagged'
  verification_note TEXT,
  proof_url TEXT,                        -- optional link to test score screenshot in R2
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_real_test_scores_user
  ON real_test_scores(user_id, reported_at DESC);

CREATE INDEX IF NOT EXISTS idx_real_test_scores_test_type
  ON real_test_scores(test_type, reported_at DESC);

-- Calibration summary snapshots — computed weekly
CREATE TABLE IF NOT EXISTS calibration_snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  test_type TEXT NOT NULL,
  sample_size INTEGER NOT NULL,
  mean_bot_score REAL,
  mean_real_score REAL,
  mean_delta REAL,                       -- real − bot (positive = bot underestimates)
  mae REAL,                              -- mean absolute error
  rmse REAL,                             -- root mean squared error
  within_half_band_pct REAL,             -- % of predictions within ±0.5 band
  within_one_band_pct REAL,              -- % within ±1.0 band
  pearson_r REAL,                        -- correlation between bot and real
  snapshot_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_calibration_snapshots_type_time
  ON calibration_snapshots(test_type, snapshot_at DESC);
