-- 040_certificates.sql
-- Achievement certificates issued when a student hits their target score.

CREATE TABLE IF NOT EXISTS certificates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  test_type TEXT NOT NULL,
  score REAL NOT NULL,
  target_score REAL,
  hash_id TEXT NOT NULL UNIQUE,         -- short unique hash for verification URL
  status TEXT DEFAULT 'active',          -- active, revoked
  issued_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_certificates_user
  ON certificates(user_id, test_type);

CREATE INDEX IF NOT EXISTS idx_certificates_hash
  ON certificates(hash_id);

-- Battle pass / seasonal rewards
CREATE TABLE IF NOT EXISTS battle_pass (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  season TEXT NOT NULL,                  -- e.g. '2026-04'
  tier TEXT NOT NULL DEFAULT 'free',     -- 'free' or 'premium'
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
  tier TEXT NOT NULL DEFAULT 'free',     -- 'free' or 'premium'
  reward_type TEXT NOT NULL,             -- 'xp', 'streak_freeze', 'badge', 'premium_days', 'stars'
  reward_value TEXT NOT NULL,            -- amount or badge_id
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
