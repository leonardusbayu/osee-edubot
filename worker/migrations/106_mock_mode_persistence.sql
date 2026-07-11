-- 106: Mock mode persistence in test_attempts.
--
-- The previous mock mode implementation stored `mock_mode: true` and
-- `deadline_at` in the `metadata` JSON column of test_attempts, which the
-- frontend read via `location.state` (React Router state). Problem: a page
-- refresh clears `location.state`, so the student loses exam mode
-- (no timer enforcement, can go back to previous sections, etc).
--
-- Fix: promote these fields to first-class columns on test_attempts.
-- The /start endpoint sets them; the /finish endpoint enforces the
-- hard deadline; the frontend's attempt-resume reads them from the API
-- (not location.state) so refresh preserves exam mode.
--
-- Idempotent: only adds the columns if they don't already exist.

ALTER TABLE test_attempts ADD COLUMN mock_mode INTEGER DEFAULT 0;
ALTER TABLE test_attempts ADD COLUMN deadline_at TEXT;
ALTER TABLE test_attempts ADD COLUMN exam_mode_started_at TEXT;

-- 107: prediction_history — tracks the gap between projected and
-- actual band over time. Every /finish writes a row; the daily cron
-- backfills `actual_band` from the next mock_test_history entry.
-- This is the data layer for "are we actually improving scores?"
CREATE TABLE IF NOT EXISTS prediction_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  test_type TEXT NOT NULL,
  prediction REAL NOT NULL,
  confidence_low REAL,
  confidence_high REAL,
  actual_band REAL, -- NULL until backfilled by the daily cron
  error REAL, -- NULL until actual_band is set
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_prediction_history_user
  ON prediction_history (user_id, test_type, created_at);

-- 108: user_outcomes — pre/post band deltas per window. The daily
-- cron groups every user's test_results + mock_test_history entries
-- into 30/60/90 day windows and computes avg_band, best_band,
-- attempts_count, and improvement (best_band - first_band).
CREATE TABLE IF NOT EXISTS user_outcomes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  test_type TEXT NOT NULL,
  window_days INTEGER NOT NULL, -- 30, 60, 90
  window_start TEXT NOT NULL,
  window_end TEXT NOT NULL,
  avg_band REAL,
  best_band REAL,
  attempts_count INTEGER NOT NULL,
  improvement REAL, -- best_band - first_band in the window
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  UNIQUE(user_id, test_type, window_days, window_start)
);
CREATE INDEX IF NOT EXISTS idx_user_outcomes_user
  ON user_outcomes (user_id, test_type, window_days);

-- 109: student_ability_history — snapshots the student's IRT theta
-- per section over time. Used by the daily cron to compute the
-- learning rate (theta/week) that's shown in the score prediction
-- and the progress trajectory.
CREATE TABLE IF NOT EXISTS student_ability_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  section TEXT NOT NULL,
  theta REAL NOT NULL,
  se REAL,
  response_count INTEGER,
  source TEXT NOT NULL, -- 'ability-update' | 'test-finish' | 'mock-finish'
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_student_ability_history_user
  ON student_ability_history (user_id, section, created_at);