-- Mark test attempts with 0 answers and older than 24 hours as abandoned
-- Cleans up incomplete test sessions where student may have abandoned mid-test
-- These are in_progress attempts with no recorded answers (attempt_answers table)
UPDATE test_attempts
SET status = 'abandoned', finished_at = datetime('now')
WHERE status = 'in_progress'
  AND id NOT IN (SELECT DISTINCT attempt_id FROM attempt_answers)
  AND started_at < datetime('now', '-24 hours');
