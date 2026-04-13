-- Fix broken foreign key: attempt_answers.content_id references test_content (typo)
-- Should reference test_contents (with 's')
-- SQLite requires table recreation to fix FK constraints

-- Step 1: Create new table with correct FK
CREATE TABLE attempt_answers_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  attempt_id INTEGER NOT NULL REFERENCES test_attempts(id),
  content_id INTEGER REFERENCES test_contents(id),
  section TEXT NOT NULL,
  question_index INTEGER,
  answer_data TEXT NOT NULL,
  is_correct INTEGER,
  score REAL,
  ai_feedback TEXT,
  media_url TEXT,
  submitted_at TEXT DEFAULT (datetime('now')),
  time_spent_seconds INTEGER DEFAULT 0
);

-- Step 2: Copy all existing data
INSERT INTO attempt_answers_new (id, attempt_id, content_id, section, question_index, answer_data, is_correct, score, ai_feedback, media_url, submitted_at, time_spent_seconds)
SELECT id, attempt_id, content_id, section, question_index, answer_data, is_correct, score, ai_feedback, media_url, submitted_at, time_spent_seconds
FROM attempt_answers;

-- Step 3: Drop old table
DROP TABLE attempt_answers;

-- Step 4: Rename new table
ALTER TABLE attempt_answers_new RENAME TO attempt_answers;

-- Step 5: Recreate indexes (matching original)
CREATE INDEX idx_attempt_answers_attempt_id ON attempt_answers(attempt_id, section, question_index);
CREATE UNIQUE INDEX idx_attempt_answers_unique ON attempt_answers(attempt_id, section, question_index);
