# DECISIONS.md — Decision Log

*Appended automatically after each completed task.*

---

## 2026-04-03 — Freemium Quota System

**Changed:** `worker/src/services/premium.ts`, `worker/src/routes/tests.ts`, `frontend/src/pages/TestSelection.tsx`, `frontend/src/pages/TestRunner.tsx`, `frontend/src/pages/Progress.tsx`, `frontend/src/pages/TestResults.tsx`

**Why:** Free users had no daily limit on practice questions. Needed to enforce 10/day quota to drive premium conversions, while keeping the free tier genuinely useful.

**Details:**
- Free tier: 10 questions/day, all types count
- Daily reset: midnight WIB = 17:00 UTC
- Referral bonus: +5 questions per successful referral signup, stacks infinitely, never expires
- `LIMIT_REACHED` error (403) when quota exceeded
- TestRunner redirects to `/test?limit_reached=1` on limit hit
- Progress page shows quota usage bar

**Rejected alternatives:**
- Questions reset weekly instead of daily — rejected; daily felt more fair and encourages daily habit
- Referral bonus adds days of premium instead of bonus questions — rejected; bonus questions were simpler and more immediately useful
- 5 questions/day free instead of 10 — reconsidered; too restrictive for genuine evaluation

**Watch out for:**
- Quota tracking counts *new answers only* — retaking a question the user already answered doesn't consume quota
- `question_id` on `attempt_answers` may be null for some question types, relying on `section + question_index` for the review join

---

## 2026-04-03 — Pricing Consistency Fix

**Changed:** `worker/src/routes/premium.ts`

**Why:** Bot `/premium` command and `postInvoice` used one set of Stars prices, but the API endpoint `/api/premium/options` returned completely different numbers. Users could be shown 90 stars for 7 days in one place and 375 in another.

**Details:**
- Old API: `{ days: 7, stars: 90, label: '1 Week' }`
- Correct: `{ days: 7, stars: 375, label: '1 Week' }`
- All 5 tiers updated to match bot's `planMap` in `webhook.ts`

**Watch out for:**
- This was a silent bug — no error, just wrong prices shown to users. Should add a test that compares the two sources.

---

## 2026-04-03 — Chinese Characters in Indonesian UI

**Changed:** `worker/src/bot/webhook.ts`

**Why:** "完成" (Chinese for "completed") appeared in Indonesian referral stats message: "Belum ada referral yang完成 payment."

**Details:**
- Replaced with "sudah" in two places (lines 713 and 2369)
- Caught during QA review

**Watch out for:**
- No localization framework in place — all UI strings are inline. This makes it easy to accidentally mix languages or character sets.

---

## 2026-04-03 — Explanation Display in TestRunner and TestResults

**Changed:** `frontend/src/pages/TestRunner.tsx`, `frontend/src/pages/TestResults.tsx`, `worker/src/routes/tests.ts`

**Why:** Questions were being shown to students without explanations. A student who answers wrong has no feedback on why. This directly conflicts with VISION.md: "Questions must have real explanations."

**Details:**
- TestRunner shows explanation in a blue banner for 1.5 seconds after answering (non-speaking, non-writing types)
- TestResults has expandable "📝 Review Jawaban" section showing each question, student's answer, correct answer, and explanation
- New endpoint: `GET /api/tests/attempt/:id/review` — joins `attempt_answers` with `test_contents` to get explanations
- Speaking and writing types excluded from auto-show (AI feedback is shown separately)

**Rejected alternatives:**
- Always show explanation before advancing (let student see before moving on) — rejected; 1.5s auto-advance felt better for flow
- Show all explanations at end of section — deferred; implemented per-question first

**Watch out for:**
- Many questions in the database have empty `explanation` fields (imported with `'explanation': ''`)
- The review join uses `LEFT JOIN` so null explanations show as empty strings
- `ai_summary` in `test_results` is still always null — no AI-written summary

---

## 2026-04-03 — Telegram Channel ID Fix

**Changed:** `worker/src/services/contentGenerator.ts`

**Why:** Bot was trying to post to `@TOEFL_IELTS_Indonesia` using a hardcoded numeric ID `-1002478900000` that was incorrect. The channel had been migrated or the ID was wrong from the start.

**Details:**
- Correct production channel ID: `-1003884450070`
- Test channel: `@TOEFL_IELTS_Indonesia_Test`
- Added logging to `postToChannel()` to surface future failures
- Cron handlers now log OK/FAILED for each channel post

**Watch out for:**
- The channel ID should ideally be stored in an env variable, not hardcoded
- No alert if channel posts fail repeatedly

---

## 2026-04-03 — Hourly Channel Content Rotation

**Changed:** `worker/src/index.ts`

**Why:** The `@TOEFL_IELTS_Indonesia` channel was only posting twice a day (morning + evening). With 6,000+ followers, more frequent quality content could drive more referrals and engagement.

**Details:**
- Hourly cron (`30 * * * *`) now posts one rotating content piece:
  - Grammar tip, Idiom, Vocabulary of the day, Promo CTA
  - Rotates every 4 hours: UTC 00:30 = WIB 07:30 grammar, UTC 01:30 = WIB 08:30 idiom, etc.
- Morning cron still posts vocab + quiz at 8 AM WIB
- Evening cron still posts grammar + idiom + spotlight + CTA at 6 PM WIB

**Rejected alternatives:**
- Random content each hour — rejected; rotation felt more predictable and sustainable
- More than one post per hour — rejected; could feel spammy

**Watch out for:**
- Content quality varies — grammar tips and idioms are AI-generated, may need human review
- No tracking of which content type performs best

---

## Historical — TOEFL iBT Format (EduBot-specific, not real TOEFL)

**Decision:** Created a simplifiedEduBot-specific question format that differs from actual TOEFL iBT.

**Why:** Real TOEFL iBT has strict section formats, timing, and question types. EduBot's format was designed for mobile/Telegram practice, not test simulation. Question types include: `complete_the_words`, `build_sentence`, `listen_and_repeat` — none of which exist in real TOEFL.

**Business impact:** Students should not expect EduBot to be a 1:1 TOEFL simulator. This is intentional — it prioritizes learning over test familiarity. Real TOEFL format questions (long passages, integrated tasks) are harder to deliver well on mobile.

**Watch out for:**
- VISION.md explicitly calls out "explanations" as non-negotiable, but format authenticity is not mentioned. If students complain about format mismatch, this needs a business decision.

---

## Historical — 1-Day Premium Trial

**Decision:** New users get 1 day of full premium access on signup.

**Details:**
- `trialEnds.setDate(trialEnds.getDate() + 1)` in `getOrCreateUser()` — line 42-43 of `webhook.ts`
- Trial is set as `is_premium=1, premium_until=tomorrow` in users table
- After trial, `checkPremium()` returns `is_premium=false`

**Critique:** 1 day is arguably too short for meaningful evaluation. A student would need to use it intensely on day 1. However, it's sufficient to unlock speaking practice and test the full experience briefly. The referral bonus (+5 questions) is the real acquisition engine for free users.

**Watch out for:**
- No explicit "trial used" flag — if a user creates a second account, they get another trial

---

## 2026-04-03 — Explanation Enrichment Pipeline

**Changed:** `scripts/enrich-explanations.ts`, `frontend/src/pages/TestRunner.tsx`

**Why:** Most imported questions have empty explanations (`'explanation': ''`), which makes the newly-added explanation UI feature feel hollow. Students get blank "💡 Penjelasan:" banners instead of learning why they were wrong.

**Details:**
- Built `scripts/enrich-explanations.ts` — a one-time GPT-4 pipeline that:
  - Queries all `test_contents` with empty explanations
  - Generates Indonesian-language explanations via GPT-4
  - Backfills the `content.explanation` field
  - Rate-limits to 1 req/sec to control OpenAI costs
  - Can be re-run to handle new questions
- Added UI guard: explanation banner only shows if `explanation.trim().length > 5`

**Rejected alternatives:**
- Generate explanations on-the-fly (lazy generation) — rejected; too slow, costs per request
- Ask teachers to write manually — rejected; too slow at scale

**Watch out for:**
- Running the script will cost OpenAI credits — estimate ~$0.01-0.02 per question at GPT-4o-mini prices
- Some questions have grouped_reading format — explanations nested inside `content.questions[i].explanation`, not at top level
- Need to re-run after adding new questions via `/ai-generate`

---

## 2026-04-03 — Speaking as the Moat

**Changed:** `worker/src/services/contentGenerator.ts`, `worker/src/index.ts`, `worker/src/bot/webhook.ts`

**Why:** VISION.md identifies speaking evaluation trained on Indonesian-accented English as the moat, but it's buried. Channel posts and `/test` command never mention it. The funnel converts on "more questions" instead of "your pronunciation is fixable."

**Details:**
- Added `generateSpeakingCTA()` — 4 Indonesian-language speaking-focused CTAs
- Hourly channel rotation expanded to 5 types: grammar_tip, speaking_cta, idiom, vocab, cta
- `/test` command premium users: "🗣️ Speaking Practice" button added
- `/test` command free users: speaking mentioned as premium benefit
- `/test` command limit-reached: "Premium = Speaking practice" as upgrade hook

**Watch out for:**
- Speaking CTA might not resonate if users haven't tried speaking practice yet
- Could A/B test speaking CTAs vs generic CTAs to measure referral lift
- The speaking pipeline latency needs to stay under 5 seconds (VISION.md goal) — currently it can be 8-10s

---

## 2026-04-03 — Channel Analytics

**Changed:** `worker/src/routes/channel-analytics.ts`, `worker/src/services/contentGenerator.ts`, `worker/src/index.ts`

**Why:** Flying blind on the channel. 6,000+ followers, hourly posts, but zero visibility into what content drives signups or what the OpenAI content generation costs.

**Details:**
- New API route `GET /api/channel-analytics/summary` — posts by type, success rate, referral sources, last 7-30 days
- `GET /api/channel-analytics/posts` — recent posts with status and error messages
- `GET /api/channel-analytics/referrals` — referral breakdown by context
- `POST /api/channel-analytics/test-post` — admin endpoint to manually trigger a test post
- `postToChannel()` now logs every post to `channel_posts` table: type, content, message_id, status, error_message
- Tables: `channel_posts` (existing + altered), `channel_referrals`, `channel_hourly_stats`
- Teacher/admin role required for all endpoints

**Note:** `channel_posts` table existed from a prior uncommitted migration attempt — schema uses `post_type`/`post_content` instead of `content_type`/`content_preview`. New columns added via ALTER.

**Watch out for:**
- `channel_referrals` table is created but not wired up yet — referral signup flow needs to write to it
- No cost tracking yet — OpenAI spend per post is not recorded
- The admin test-post endpoint calls `postToChannel` but doesn't verify the result before returning
