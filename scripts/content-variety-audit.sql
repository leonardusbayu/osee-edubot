-- Content variety diagnostic queries.
--
-- Run each with: npx wrangler d1 execute edubot-db --remote --command "..."
--
-- Goal: find which (test_type, section, question_type) buckets are thin.
-- Buckets with <50 published questions will feel repetitive to any student
-- who practices them 3+ times no matter what the exposure sampler does.
--
-- The three fixes for a thin bucket:
--   1. Generate more content (skills/content-factory for AI-made questions)
--   2. Re-import / widen source material
--   3. Temporarily remove that question_type option from the UI so students
--      aren't steered into a dry well.

-- ─── Q1: Overall bank size by test × section × question_type ─────────────
-- Gives the shape of your inventory. Buckets with n < 50 are high risk.
SELECT test_type,
       section,
       question_type,
       COUNT(*) AS n
  FROM test_contents
 WHERE status = 'published'
 GROUP BY test_type, section, question_type
 ORDER BY test_type, section, n ASC;

-- ─── Q2: Top-15 most-served questions across ALL users (last 14 days) ────
-- Tells you which questions the RANDOM-selector kept winning. If 5 items
-- have exposure_count > 500 while the bank has 1000+ items in that bucket,
-- the sampler is under-utilized AND content might need rotation forcing.
SELECT tc.id, tc.test_type, tc.section, tc.question_type,
       SUM(qe.exposure_count) AS total_exposures,
       COUNT(DISTINCT qe.user_id) AS unique_students
  FROM question_exposure qe
  JOIN test_contents tc ON tc.id = qe.content_id
 WHERE qe.last_seen_at > datetime('now', '-14 days')
 GROUP BY tc.id
 ORDER BY total_exposures DESC
 LIMIT 15;

-- ─── Q3: Exposure concentration per user (last 14 days) ──────────────────
-- Shows if any individual student is hammering a small set. If max_single =
-- 20+ for a student with 200 total exposures, they've seen the same 10
-- questions multiple times — the sampler isn't spreading enough for them.
SELECT user_id,
       COUNT(*) AS unique_items,
       SUM(exposure_count) AS total_exposures,
       MAX(exposure_count) AS max_single
  FROM question_exposure
 WHERE last_seen_at > datetime('now', '-14 days')
 GROUP BY user_id
 ORDER BY total_exposures DESC
 LIMIT 10;

-- ─── Q4: Dead questions — published but zero exposures in 30 days ───────
-- These are good questions the sampler has never surfaced. Usually means
-- a thin filter (narrow skill_tag, unusual difficulty) or low-priority
-- test_type. Consider promoting them via drill_concept buttons or ignoring.
SELECT test_type, section, question_type, COUNT(*) AS unused_count
  FROM test_contents tc
 WHERE status = 'published'
   AND NOT EXISTS (
     SELECT 1 FROM question_exposure qe
      WHERE qe.content_id = tc.id
        AND qe.last_seen_at > datetime('now', '-30 days')
   )
 GROUP BY test_type, section, question_type
 ORDER BY unused_count DESC
 LIMIT 20;
