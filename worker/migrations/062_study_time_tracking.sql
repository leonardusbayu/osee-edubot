-- Add duration tracking to exercise_sessions
ALTER TABLE exercise_sessions ADD COLUMN duration_seconds INTEGER DEFAULT 0;
ALTER TABLE exercise_sessions ADD COLUMN started_at TEXT;

-- Index for study time analytics
CREATE INDEX IF NOT EXISTS idx_exercise_duration ON exercise_sessions(user_id, status, duration_seconds);
