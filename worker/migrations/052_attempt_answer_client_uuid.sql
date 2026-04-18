-- 052 — Client-side idempotency for attempt_answers.
--
-- Why: offline-sync on the frontend queues answers and retries up to
-- maxRetries if the POST fails. Without an idempotency key, a retry that
-- arrives AFTER the server actually persisted the first attempt would
-- either (a) write a duplicate row, or (b) hit the composite-PK constraint
-- and fail (there was an existing UNIQUE on attempt_id+section+question_index
-- which de-duped by position, but that meant a subsequent "real" answer
-- at the same index was rejected too).
--
-- Adding client_uuid lets the client tag each logical submission. The
-- server upsert matches on (attempt_id, client_uuid) when a uuid is
-- provided, so retries of the same logical submit converge to a single
-- row regardless of network conditions.
--
-- Tracks P1 BUGS.md #1 (server-side half; the UI already surfaces the
-- queue — commit dcba7cf).
--
-- Backward-compatible: the column is nullable. Existing rows have NULL
-- client_uuid and work as before (composite-position dedup handles them).

ALTER TABLE attempt_answers ADD COLUMN client_uuid TEXT;

-- Index lets the lookup "does an attempt already have this client_uuid?"
-- scan a single entry instead of the whole attempt's rows.
CREATE INDEX IF NOT EXISTS idx_attempt_answers_uuid
  ON attempt_answers(attempt_id, client_uuid);
