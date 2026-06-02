-- Scoring cache to eliminate repeated GPT calls for identical (exercise_type, reference, answer) combinations
CREATE TABLE IF NOT EXISTS score_cache (
  cache_key TEXT PRIMARY KEY,
  score INTEGER NOT NULL,
  feedback TEXT NOT NULL,
  correct_answer TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_score_cache_created ON score_cache(created_at);
