-- 039_gamification.sql
-- Gamification system: XP, streaks, badges, daily quests, and mini-game scores.
-- Supports features #3 (speed drill), #4 (streak+XP), #6 (badges),
-- #8 (daily quests), #9 (wordle), #10 (battle pass).

-- ─── XP + Streaks ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_xp (
  user_id INTEGER PRIMARY KEY,
  total_xp INTEGER DEFAULT 0,
  level INTEGER DEFAULT 1,
  current_streak INTEGER DEFAULT 0,      -- consecutive days with ≥1 activity
  longest_streak INTEGER DEFAULT 0,
  streak_freezes INTEGER DEFAULT 0,      -- purchasable with Stars
  last_activity_date TEXT,               -- YYYY-MM-DD (WIB)
  streak_updated_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Daily XP log (for multipliers + quest tracking)
CREATE TABLE IF NOT EXISTS xp_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  amount INTEGER NOT NULL,
  source TEXT NOT NULL,                  -- 'question', 'speaking', 'writing', 'drill', 'quest', 'challenge', 'bonus'
  multiplier REAL DEFAULT 1.0,           -- 2x for first lesson of day, etc.
  detail TEXT,                           -- e.g. "speed_drill score=850"
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_xp_log_user_date
  ON xp_log(user_id, created_at DESC);

-- ─── Badges / Achievements ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS badges (
  id TEXT PRIMARY KEY,                   -- e.g. 'streak_7', 'vocab_master', 'perfect_score'
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  icon TEXT NOT NULL,                    -- emoji
  category TEXT NOT NULL,                -- 'streak', 'accuracy', 'volume', 'social', 'special'
  requirement_type TEXT NOT NULL,        -- 'streak_days', 'total_xp', 'correct_count', 'perfect_score', 'referral_count', 'drill_score'
  requirement_value INTEGER NOT NULL,    -- threshold value
  xp_reward INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS user_badges (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  badge_id TEXT NOT NULL,
  earned_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (badge_id) REFERENCES badges(id),
  UNIQUE(user_id, badge_id)
);

-- ─── Daily Quests ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS daily_quests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  quest_date TEXT NOT NULL,              -- YYYY-MM-DD (WIB)
  quest_type TEXT NOT NULL,              -- 'answer_questions', 'speaking_drill', 'review_cards', 'speed_drill', 'writing_task'
  target_count INTEGER NOT NULL,         -- e.g. 5, 10
  current_count INTEGER DEFAULT 0,
  xp_reward INTEGER DEFAULT 50,
  completed INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_daily_quests_user_date_type
  ON daily_quests(user_id, quest_date, quest_type);

-- ─── Mini-Game Scores (speed drill, wordle, gap-fill) ───────────
CREATE TABLE IF NOT EXISTS game_scores (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  game_type TEXT NOT NULL,               -- 'speed_drill', 'wordle', 'gap_fill'
  score INTEGER NOT NULL,
  time_seconds REAL,                     -- how long the round took
  correct_count INTEGER DEFAULT 0,
  total_count INTEGER DEFAULT 0,
  streak_bonus INTEGER DEFAULT 0,        -- consecutive correct answers bonus
  metadata TEXT,                         -- JSON: word list, difficulty, etc.
  xp_earned INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_game_scores_user_type
  ON game_scores(user_id, game_type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_game_scores_leaderboard
  ON game_scores(game_type, score DESC);

-- ─── Seed default badges ────────────────────────────────────────
INSERT OR IGNORE INTO badges (id, name, description, icon, category, requirement_type, requirement_value, xp_reward) VALUES
  ('streak_3', 'Api Kecil', '3 hari berturut-turut belajar', '🔥', 'streak', 'streak_days', 3, 30),
  ('streak_7', 'Semangat Membara', '7 hari berturut-turut belajar', '🔥', 'streak', 'streak_days', 7, 75),
  ('streak_14', 'Pantang Menyerah', '14 hari berturut-turut belajar', '💪', 'streak', 'streak_days', 14, 150),
  ('streak_30', 'Master Konsisten', '30 hari berturut-turut belajar', '🏆', 'streak', 'streak_days', 30, 500),
  ('streak_60', 'Legenda Belajar', '60 hari tanpa jeda', '👑', 'streak', 'streak_days', 60, 1000),
  ('streak_100', 'Centurion', '100 hari berturut-turut!', '💎', 'streak', 'streak_days', 100, 2000),
  ('xp_100', 'Pemula', 'Raih 100 XP total', '⭐', 'volume', 'total_xp', 100, 10),
  ('xp_500', 'Rajin', 'Raih 500 XP total', '⭐', 'volume', 'total_xp', 500, 50),
  ('xp_1000', 'Bintang Belajar', 'Raih 1.000 XP total', '🌟', 'volume', 'total_xp', 1000, 100),
  ('xp_5000', 'Scholar', 'Raih 5.000 XP total', '🎓', 'volume', 'total_xp', 5000, 300),
  ('xp_10000', 'Professor', 'Raih 10.000 XP total', '🏅', 'volume', 'total_xp', 10000, 500),
  ('correct_50', 'Jawaban Benar 50', 'Jawab benar 50 soal', '✅', 'accuracy', 'correct_count', 50, 50),
  ('correct_100', 'Century Club', 'Jawab benar 100 soal', '💯', 'accuracy', 'correct_count', 100, 100),
  ('correct_500', 'Pakar Soal', 'Jawab benar 500 soal', '🎯', 'accuracy', 'correct_count', 500, 300),
  ('correct_1000', 'Seribu Benar', 'Jawab benar 1.000 soal', '🏅', 'accuracy', 'correct_count', 1000, 500),
  ('perfect_score', 'Perfect!', 'Skor sempurna di satu tes', '💎', 'accuracy', 'perfect_score', 1, 200),
  ('speed_500', 'Speed Demon', 'Skor 500+ di Speed Drill', '⚡', 'special', 'drill_score', 500, 100),
  ('speed_800', 'Lightning Fast', 'Skor 800+ di Speed Drill', '🌩️', 'special', 'drill_score', 800, 200),
  ('speed_1000', 'Vocabulary God', 'Skor 1000+ di Speed Drill', '👁️', 'special', 'drill_score', 1000, 500),
  ('referral_1', 'Teman Pertama', 'Ajak 1 teman bergabung', '🤝', 'social', 'referral_count', 1, 50),
  ('referral_5', 'Influencer', 'Ajak 5 teman bergabung', '📣', 'social', 'referral_count', 5, 200),
  ('referral_10', 'Ambassador', 'Ajak 10 teman bergabung', '🌟', 'social', 'referral_count', 10, 500),
  ('first_speaking', 'Suara Pertama', 'Selesaikan 1 speaking drill', '🎤', 'special', 'correct_count', 1, 30),
  ('first_writing', 'Penulis Pemula', 'Selesaikan 1 writing task', '✏️', 'special', 'correct_count', 1, 30);
