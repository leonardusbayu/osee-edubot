-- 009_user_analytics.sql
-- Rich user activity tracking: messages, sessions, daily study logs, skill progress

-- Message log (Telegram messages and mini app interactions)
CREATE TABLE IF NOT EXISTS user_messages (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL,
  message_type TEXT NOT NULL DEFAULT 'text',
  content_length INTEGER DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_user_messages_user ON user_messages(user_id, created_at DESC);

-- User sessions (app open → close)
CREATE TABLE IF NOT EXISTS user_sessions (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL,
  started_at TEXT NOT NULL DEFAULT (datetime('now')),
  ended_at TEXT,
  duration_seconds INTEGER,
  platform TEXT DEFAULT 'mini_app',
  source TEXT DEFAULT 'unknown',
  questions_answered INTEGER DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_user_sessions_user ON user_sessions(user_id, started_at DESC);

-- Aggregated daily study logs (for charts and patterns)
CREATE TABLE IF NOT EXISTS daily_study_logs (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL,
  log_date TEXT NOT NULL UNIQUE,
  questions_answered INTEGER DEFAULT 0,
  time_spent_seconds INTEGER DEFAULT 0,
  messages_sent INTEGER DEFAULT 0,
  sessions_count INTEGER DEFAULT 0,
  tests_completed INTEGER DEFAULT 0,
  correct_answers INTEGER DEFAULT 0,
  accuracy_percent INTEGER DEFAULT 0,
  top_section TEXT,
  weakest_section TEXT,
  updated_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_daily_study_logs_user ON daily_study_logs(user_id, log_date DESC);

-- Skill-level progress tracking (sub-skill granularity)
CREATE TABLE IF NOT EXISTS skill_progress (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL,
  skill TEXT NOT NULL,
  test_type TEXT DEFAULT 'TOEFL_IBT',
  practiced_at TEXT NOT NULL DEFAULT (datetime('now')),
  questions_attempted INTEGER DEFAULT 0,
  correct_answers INTEGER DEFAULT 0,
  accuracy_percent INTEGER DEFAULT 0,
  time_spent_seconds INTEGER DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_skill_progress_user ON skill_progress(user_id, practiced_at DESC);
CREATE INDEX IF NOT EXISTS idx_skill_progress_skill ON skill_progress(user_id, skill, practiced_at DESC);
