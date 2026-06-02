-- Speaking evaluation cache for consistent re-scoring
CREATE TABLE IF NOT EXISTS speaking_eval_cache (
  cache_key TEXT PRIMARY KEY,
  result_json TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_speaking_eval_cache_created ON speaking_eval_cache(created_at);
