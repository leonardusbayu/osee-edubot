-- 041_coins_leagues_friendquests.sql
-- #1 Coins currency, #2 League tiers, #3 Friend quests

-- ─── Coins ──────────────────────────────────────────────────────
ALTER TABLE user_xp ADD COLUMN coins INTEGER DEFAULT 0;

CREATE TABLE IF NOT EXISTS coin_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  amount INTEGER NOT NULL,           -- positive=earn, negative=spend
  source TEXT NOT NULL,              -- 'lesson', 'speaking', 'quest', 'bonus_drop', 'streak', 'shop_purchase', 'friend_quest'
  detail TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_coin_log_user ON coin_log(user_id, created_at DESC);

-- Coin shop items
CREATE TABLE IF NOT EXISTS coin_shop (
  id TEXT PRIMARY KEY,               -- 'streak_freeze', 'speaking_credit', 'xp_boost_2x', 'challenge_skip'
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  price INTEGER NOT NULL,            -- coin cost
  icon TEXT NOT NULL,
  effect_type TEXT NOT NULL,         -- 'streak_freeze', 'premium_hours', 'xp_multiplier', 'extra_questions'
  effect_value TEXT NOT NULL,        -- '1', '24', '2.0', '5'
  active INTEGER DEFAULT 1
);

INSERT OR IGNORE INTO coin_shop VALUES
  ('streak_freeze', 'Streak Freeze', 'Lindungi streak 1 hari', 200, '🧊', 'streak_freeze', '1', 1),
  ('speaking_credit', 'Speaking Credit', '1x speaking evaluation gratis', 150, '🎤', 'premium_hours', '0', 1),
  ('xp_boost', 'XP Boost 2x (24 jam)', 'Double XP selama 24 jam', 300, '⚡', 'xp_multiplier', '2.0', 1),
  ('extra_questions', 'Extra 5 Soal', '+5 soal hari ini', 100, '📝', 'extra_questions', '5', 1),
  ('challenge_skip', 'Lewati Tantangan', 'Skip 1 challenge tanpa penalti', 50, '🏃', 'challenge_skip', '1', 1);

-- ─── Leagues ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_leagues (
  user_id INTEGER PRIMARY KEY,
  league TEXT NOT NULL DEFAULT 'bronze',   -- bronze, silver, gold, diamond, champion
  weekly_xp INTEGER DEFAULT 0,
  week_start TEXT,                          -- YYYY-MM-DD of current tracking week
  prev_league TEXT,                         -- league before last promotion/demotion
  promoted_at TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS league_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  week_start TEXT NOT NULL,
  week_end TEXT NOT NULL,
  league TEXT NOT NULL,
  weekly_xp INTEGER DEFAULT 0,
  rank_in_league INTEGER,
  action TEXT,                              -- 'promoted', 'demoted', 'stayed'
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_league_history_user ON league_history(user_id, week_start DESC);

-- ─── Friend Quests ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS friend_quests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  creator_id INTEGER NOT NULL,
  quest_type TEXT NOT NULL,                 -- 'complete_questions', 'earn_xp', 'streak_days', 'speaking_drills'
  target_value INTEGER NOT NULL,
  deadline TEXT NOT NULL,                   -- datetime
  status TEXT DEFAULT 'active',             -- active, completed, failed, cancelled
  reward_coins INTEGER DEFAULT 100,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (creator_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS friend_quest_members (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  quest_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  current_value INTEGER DEFAULT 0,
  completed INTEGER DEFAULT 0,
  joined_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (quest_id) REFERENCES friend_quests(id),
  FOREIGN KEY (user_id) REFERENCES users(id),
  UNIQUE(quest_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_fq_members_user ON friend_quest_members(user_id, quest_id);

-- ─── Band Score Lookup Tables (#5) ─────────────────────────────
CREATE TABLE IF NOT EXISTS band_score_lookup (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  test_type TEXT NOT NULL,                  -- 'IELTS', 'TOEFL_IBT'
  section TEXT NOT NULL,                    -- 'reading', 'listening', 'overall'
  raw_min INTEGER NOT NULL,
  raw_max INTEGER NOT NULL,
  band REAL NOT NULL,
  UNIQUE(test_type, section, raw_min)
);

-- IELTS Reading band lookup (Academic, 40-question scale)
INSERT OR IGNORE INTO band_score_lookup (test_type, section, raw_min, raw_max, band) VALUES
  ('IELTS', 'reading', 39, 40, 9.0), ('IELTS', 'reading', 37, 38, 8.5),
  ('IELTS', 'reading', 35, 36, 8.0), ('IELTS', 'reading', 33, 34, 7.5),
  ('IELTS', 'reading', 30, 32, 7.0), ('IELTS', 'reading', 27, 29, 6.5),
  ('IELTS', 'reading', 23, 26, 6.0), ('IELTS', 'reading', 19, 22, 5.5),
  ('IELTS', 'reading', 15, 18, 5.0), ('IELTS', 'reading', 13, 14, 4.5),
  ('IELTS', 'reading', 10, 12, 4.0), ('IELTS', 'reading', 8, 9, 3.5),
  ('IELTS', 'reading', 6, 7, 3.0),   ('IELTS', 'reading', 4, 5, 2.5),
  ('IELTS', 'reading', 0, 3, 2.0);

-- IELTS Listening band lookup (40-question scale)
INSERT OR IGNORE INTO band_score_lookup (test_type, section, raw_min, raw_max, band) VALUES
  ('IELTS', 'listening', 39, 40, 9.0), ('IELTS', 'listening', 37, 38, 8.5),
  ('IELTS', 'listening', 35, 36, 8.0), ('IELTS', 'listening', 32, 34, 7.5),
  ('IELTS', 'listening', 30, 31, 7.0), ('IELTS', 'listening', 26, 29, 6.5),
  ('IELTS', 'listening', 23, 25, 6.0), ('IELTS', 'listening', 18, 22, 5.5),
  ('IELTS', 'listening', 16, 17, 5.0), ('IELTS', 'listening', 13, 15, 4.5),
  ('IELTS', 'listening', 11, 12, 4.0), ('IELTS', 'listening', 8, 10, 3.5),
  ('IELTS', 'listening', 6, 7, 3.0),   ('IELTS', 'listening', 4, 5, 2.5),
  ('IELTS', 'listening', 0, 3, 2.0);
