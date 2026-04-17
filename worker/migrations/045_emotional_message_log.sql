-- Lightweight table to track emotional/encouragement messages sent to users.
-- Used for anti-spam deduplication so we don't repeat the same type of message.
-- Types: struggle, growth, break_reminder, streak_recovery, milestone_question, milestone_monthly, exam_countdown
CREATE TABLE IF NOT EXISTS emotional_message_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  message_type TEXT NOT NULL,
  context TEXT DEFAULT NULL,  -- e.g. milestone number, section name, attempt_id
  sent_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_emotional_log_user_type ON emotional_message_log(user_id, message_type, sent_at);
