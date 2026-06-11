-- ROADMAP_M3 §1.2 — before/after mock-test proof loop.
-- Every finished attempt with >= 20 answered questions counts as a "mock"
-- and lands a row here, so we can show "Naik +0.5 band dalam 4 minggu 📈".

CREATE TABLE IF NOT EXISTS mock_test_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  test_type TEXT NOT NULL,
  attempt_id INTEGER,
  estimated_score REAL,
  score_scale TEXT,
  taken_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_mock_history_user
  ON mock_test_history (user_id, test_type, taken_at);

-- Dedup log for the monthly "time for a mock test" cron prompt.
CREATE TABLE IF NOT EXISTS mock_prompt_log (
  user_id INTEGER PRIMARY KEY,
  last_prompted_at TEXT
);
