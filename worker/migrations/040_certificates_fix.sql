-- 040_certificates_fix.sql
-- Fixes: existing certificates table has different schema.
-- Adds missing columns to existing table + creates battle_pass tables.

-- Add missing columns to existing certificates table
ALTER TABLE certificates ADD COLUMN hash_id TEXT;
ALTER TABLE certificates ADD COLUMN target_score REAL;
ALTER TABLE certificates ADD COLUMN status TEXT DEFAULT 'active';
ALTER TABLE certificates ADD COLUMN issued_at TEXT DEFAULT (datetime('now'));

-- Create unique index on hash_id (allow NULLs for old rows)
CREATE INDEX IF NOT EXISTS idx_certificates_user
  ON certificates(user_id, test_type);

CREATE INDEX IF NOT EXISTS idx_certificates_hash
  ON certificates(hash_id);

-- Battle pass / seasonal rewards
CREATE TABLE IF NOT EXISTS battle_pass (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  season TEXT NOT NULL,
  tier TEXT NOT NULL DEFAULT 'free',
  current_level INTEGER DEFAULT 0,
  xp_this_season INTEGER DEFAULT 0,
  purchased_at TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id),
  UNIQUE(user_id, season)
);

CREATE TABLE IF NOT EXISTS battle_pass_rewards (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  season TEXT NOT NULL,
  level INTEGER NOT NULL,
  tier TEXT NOT NULL DEFAULT 'free',
  reward_type TEXT NOT NULL,
  reward_value TEXT NOT NULL,
  description TEXT NOT NULL,
  UNIQUE(season, level, tier)
);

-- Seed battle pass rewards for current season
INSERT OR IGNORE INTO battle_pass_rewards (season, level, tier, reward_type, reward_value, description) VALUES
  ('2026-04', 1, 'free', 'xp', '50', '50 XP Bonus'),
  ('2026-04', 2, 'free', 'xp', '75', '75 XP Bonus'),
  ('2026-04', 3, 'free', 'streak_freeze', '1', '1 Streak Freeze'),
  ('2026-04', 4, 'free', 'xp', '100', '100 XP Bonus'),
  ('2026-04', 5, 'free', 'xp', '150', '150 XP Bonus'),
  ('2026-04', 1, 'premium', 'xp', '100', '100 XP Bonus'),
  ('2026-04', 2, 'premium', 'streak_freeze', '2', '2 Streak Freeze'),
  ('2026-04', 3, 'premium', 'premium_days', '1', '1 Hari Premium Gratis'),
  ('2026-04', 4, 'premium', 'xp', '300', '300 XP Bonus'),
  ('2026-04', 5, 'premium', 'premium_days', '3', '3 Hari Premium Gratis');
