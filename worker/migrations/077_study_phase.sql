-- 077: Study Phase Tracking
-- Track student journey: onboarding → foundation → building → refining → test_ready

CREATE TABLE IF NOT EXISTS student_phase_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  phase TEXT NOT NULL,                  -- onboarding, foundation, building, refining, test_ready, maintenance
  snapshot TEXT,                        -- JSON of stats at the time
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_sph_user ON student_phase_history(user_id, created_at);
