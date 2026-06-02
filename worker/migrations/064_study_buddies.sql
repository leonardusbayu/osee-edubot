-- Study buddies table for peer pairing
CREATE TABLE IF NOT EXISTS study_buddies (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  buddy_id INTEGER NOT NULL,
  status TEXT DEFAULT 'active',
  matched_at TEXT DEFAULT (datetime('now')),
  UNIQUE(user_id, buddy_id)
);

CREATE INDEX IF NOT EXISTS idx_buddies_user ON study_buddies(user_id, status);
