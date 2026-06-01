-- 076: Class Differentiation
-- Track differentiated daily quizzes + class level distribution

CREATE TABLE IF NOT EXISTS classroom_daily_quizzes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  class_id INTEGER NOT NULL,
  group_chat_id TEXT NOT NULL,
  question TEXT NOT NULL,
  correct_answer TEXT NOT NULL,
  class_level TEXT,                      -- detected avg level of class at posting time
  posted_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_cdq_class ON classroom_daily_quizzes(class_id, posted_at);
