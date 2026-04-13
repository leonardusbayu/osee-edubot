CREATE TABLE IF NOT EXISTS speaking_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  prompt TEXT NOT NULL,
  test_type TEXT DEFAULT 'TOEFL_IBT',
  topic_type TEXT DEFAULT 'random',
  transcription TEXT,
  score REAL,
  feedback TEXT,
  status TEXT DEFAULT 'active',
  created_at TEXT DEFAULT (datetime('now')),
  completed_at TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_speaking_sessions_user ON speaking_sessions(user_id, status);
