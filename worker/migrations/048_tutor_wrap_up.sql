-- 048_tutor_wrap_up.sql
-- Bridges the mini-app practice flow and the bot's conversational teaching.
--
-- Two sides of the same loop:
--   React side — when a student finishes a test in the mini app, the bot
--                looks at their wrong answers, picks 1–3 concepts worth
--                teaching (triage — not every mistake), offers a Telegram
--                review conversation, and walks through each concept using
--                the existing teach-then-check engine (lesson_cq_active +
--                lesson_cq_attempts from migration 047).
--   Direct side — the bot can ALSO push the student to the mini app with a
--                 targeted drill ("warm up on inference before your test").
--                 Drill sessions piggyback on test_attempts — they ARE test
--                 attempts, just scoped to one concept with count<=5. No
--                 separate table needed for drill state — the drill_concept
--                 query param in the mini app is all the coupling required.
--
-- post_test_reviews tracks the review conversation state:
--   • concepts_to_review — JSON array of skill tags, ordered by triage priority
--   • current_index — which concept we're on
--   • status — active | completed | skipped
--
-- test_attempts.review_nudge_sent_at prevents double-notifying on the same
-- attempt (rare but possible if /finish is called twice).

CREATE TABLE IF NOT EXISTS post_test_reviews (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  attempt_id INTEGER NOT NULL,
  concepts_to_review TEXT NOT NULL,        -- JSON array: ['inference', 'main_idea']
  current_index INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active',   -- active | completed | skipped
  wrong_count INTEGER NOT NULL DEFAULT 0,  -- diagnostic: how many wrongs in the attempt
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (attempt_id) REFERENCES test_attempts(id)
);

CREATE INDEX IF NOT EXISTS idx_ptr_user_active
  ON post_test_reviews(user_id, status);

CREATE INDEX IF NOT EXISTS idx_ptr_attempt
  ON post_test_reviews(attempt_id);

-- Prevent double-notification on the same attempt.
ALTER TABLE test_attempts ADD COLUMN review_nudge_sent_at TEXT;
