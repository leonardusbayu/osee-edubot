-- Error logging table for client and server errors
CREATE TABLE IF NOT EXISTS error_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source TEXT NOT NULL DEFAULT 'server',  -- 'client', 'server', 'bot'
  error_type TEXT,                         -- 'render', 'api', 'network', 'mic_permission', etc.
  message TEXT NOT NULL,
  stack TEXT,
  user_id INTEGER,
  url TEXT,                                -- Page URL or API endpoint
  metadata TEXT,                           -- JSON with extra context
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Index for querying recent errors
CREATE INDEX IF NOT EXISTS idx_error_logs_created ON error_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_error_logs_source ON error_logs(source, created_at DESC);
