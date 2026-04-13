-- Exercise sessions table for skill-based learning paths
CREATE TABLE IF NOT EXISTS exercise_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  type TEXT NOT NULL,
  status TEXT DEFAULT 'active',
  prompt TEXT,
  expected_answer TEXT,
  metadata TEXT,
  score REAL,
  feedback TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  completed_at TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_exercise_active ON exercise_sessions(user_id, status);
CREATE INDEX idx_exercise_created ON exercise_sessions(user_id, created_at DESC);
