-- Boss battles table for weekly challenge
CREATE TABLE IF NOT EXISTS boss_battles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  week TEXT NOT NULL,
  score INTEGER DEFAULT 0,
  total INTEGER DEFAULT 0,
  defeated INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  UNIQUE(user_id, week)
);

CREATE INDEX IF NOT EXISTS idx_boss_user_week ON boss_battles(user_id, week);
