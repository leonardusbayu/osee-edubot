-- One-time cleanup for stale sessions surfaced by the bug-hunt pipeline.
-- Runtime prevention lives in handleAbandonedAttemptCleanup() on the hourly cron.

UPDATE test_attempts
SET status = 'abandoned', finished_at = COALESCE(finished_at, datetime('now'))
WHERE status = 'in_progress'
  AND started_at < datetime('now', '-2 hours');

UPDATE exercise_sessions
SET status = 'abandoned',
    completed_at = COALESCE(completed_at, datetime('now')),
    duration_seconds = COALESCE(
      duration_seconds,
      CAST((julianday('now') - julianday(created_at)) * 86400 AS INTEGER)
    )
WHERE status = 'active'
  AND created_at < datetime('now', '-2 hours');
