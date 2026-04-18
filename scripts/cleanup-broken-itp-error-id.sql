-- Cleanup: TOEFL ITP error_identification rows with blank content.
--
-- Context:
-- The ingestion from the ITP .docx files produced some rows where
-- content.questions[0] has empty question_text AND empty options.
-- The /questions/:section filter (commit cae9c63) already blocks these
-- from being served to students, but the rows remain in the DB as
-- status='published' and show up in admin "question bank" counts,
-- giving the wrong impression of coverage. Tracks P2 BUGS.md #14.
--
-- Strategy: mark them status='draft' rather than DELETE. Draft keeps the
-- row auditable (so an operator can investigate what went wrong in the
-- parser) but removes them from the served rotation. If a later re-import
-- fixes the content, the operator can promote them back to 'published'.
--
-- Usage:
--   1. DRY RUN first — count what would change:
--        cd worker
--        npx wrangler d1 execute edubot-db --remote --command \
--          "SELECT COUNT(*) AS n FROM test_contents WHERE test_type = 'TOEFL_ITP' AND question_type = 'error_identification' AND status = 'published' AND (json_extract(content, '$.questions[0].question_text') IS NULL OR TRIM(json_extract(content, '$.questions[0].question_text')) = '');"
--
--   2. If the count looks right, execute the cleanup:
--        npx wrangler d1 execute edubot-db --remote --file=./scripts/cleanup-broken-itp-error-id.sql
--
-- Safe to re-run: WHERE clause filters for status='published' so a second
-- run is a no-op.

UPDATE test_contents
   SET status = 'draft'
 WHERE test_type = 'TOEFL_ITP'
   AND question_type = 'error_identification'
   AND status = 'published'
   AND (
     -- Top-level question_text is missing
     (json_extract(content, '$.question_text') IS NULL
      OR TRIM(json_extract(content, '$.question_text')) = '')
     AND
     -- AND the first sub-question's text is also missing (grouped_reading shape)
     (json_extract(content, '$.questions[0].question_text') IS NULL
      OR TRIM(json_extract(content, '$.questions[0].question_text')) = '')
   );
