-- 008_fix_duplicate_answers.sql
-- Fix duplicate rows in attempt_answers and recalculate inflated gamification data

-- Step 1: Remove duplicate attempt_answers rows (keep lowest id per unique key)
DELETE FROM attempt_answers
WHERE id NOT IN (
  SELECT MIN(id)
  FROM attempt_answers
  WHERE attempt_id IS NOT NULL
  GROUP BY attempt_id, section, question_index
);

-- Step 2: Add UNIQUE constraint to prevent future duplicates
CREATE UNIQUE INDEX IF NOT EXISTS idx_attempt_answers_unique
ON attempt_answers(attempt_id, section, question_index);

-- Step 3: Recalculate user_gamification.total_questions from actual distinct answers
UPDATE user_gamification
SET total_questions = (
  SELECT COUNT(*)
  FROM attempt_answers aa
  JOIN test_attempts ta ON aa.attempt_id = ta.id
  WHERE ta.user_id = user_gamification.user_id
);

-- Step 4: Fix daily_question_logs — recalculate from actual daily answer counts
-- This removes inflation from ON CONFLICT double-counting
WITH daily_counts AS (
  SELECT
    ta.user_id,
    date(aa.submitted_at) as day,
    COUNT(*) as actual_count
  FROM attempt_answers aa
  JOIN test_attempts ta ON aa.attempt_id = ta.id
  GROUP BY ta.user_id, date(aa.submitted_at)
)
UPDATE daily_question_logs
SET questions_answered = (
  SELECT actual_count FROM daily_counts
  WHERE daily_counts.user_id = daily_question_logs.user_id
    AND daily_counts.day = daily_question_logs.question_date
), bonus_used = 0
WHERE EXISTS (
  SELECT 1 FROM daily_counts
  WHERE daily_counts.user_id = daily_question_logs.user_id
    AND daily_counts.day = daily_question_logs.question_date
);
