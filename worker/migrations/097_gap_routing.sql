-- Weakness-to-lesson gap router (ROADMAP_M3 §1.3)
-- Logs why a topic was routed to a student's /today lesson.

CREATE TABLE IF NOT EXISTS gap_routing_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  topic TEXT NOT NULL,
  reason TEXT,
  routed_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_gap_routing_user_time
  ON gap_routing_log(user_id, routed_at);
