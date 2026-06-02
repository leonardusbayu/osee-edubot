-- Cache per-user average FSRS retention so review stats do not repeatedly
-- parse every fsrs_state JSON blob for power users.

CREATE TABLE IF NOT EXISTS fsrs_retention_cache (
  user_id INTEGER PRIMARY KEY,
  avg_retention REAL NOT NULL,
  item_count INTEGER NOT NULL DEFAULT 0,
  computed_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_fsrs_retention_cache_computed
  ON fsrs_retention_cache(computed_at);
