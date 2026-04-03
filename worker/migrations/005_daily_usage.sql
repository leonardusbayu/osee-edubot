-- Daily question usage tracking for freemium model
-- Free users get 10 questions/day, premium users get unlimited
-- Referral bonuses stack infinitely and don't expire

-- Track daily question usage per user
CREATE TABLE IF NOT EXISTS daily_question_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  question_date TEXT NOT NULL, -- YYYY-MM-DD format
  questions_answered INTEGER DEFAULT 0,
  bonus_used INTEGER DEFAULT 0, -- bonus questions consumed today
  UNIQUE(user_id, question_date)
);

-- Index for fast lookup
CREATE INDEX IF NOT EXISTS idx_daily_logs_user_date ON daily_question_logs(user_id, question_date);

-- Referral bonus quota (these stack infinitely and don't reset)
CREATE TABLE IF NOT EXISTS referral_bonus_quota (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL UNIQUE,
  bonus_questions INTEGER DEFAULT 0, -- total accumulated bonus questions
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Index for fast lookup
CREATE INDEX IF NOT EXISTS idx_referral_bonus_user ON referral_bonus_quota(user_id);
