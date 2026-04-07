-- 007_test_indexes.sql — Performance indexes for core query patterns
-- Run before deploying worker changes

-- Most common query: filter questions by test type + section + status
CREATE INDEX IF NOT EXISTS idx_test_contents_type_section_status
  ON test_contents(test_type, section, status);

-- Review: load all answers for a test attempt
CREATE INDEX IF NOT EXISTS idx_attempt_answers_attempt_id
  ON attempt_answers(attempt_id, section, question_index);

-- Progress: filter attempts by user
CREATE INDEX IF NOT EXISTS idx_test_attempts_user_status
  ON test_attempts(user_id, status);
