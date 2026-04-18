# EduBot Bug & Issue Log

**Purpose:** Single source of truth for known bugs, fixes shipped, and deferred
design work. New Claude sessions read this first (via CLAUDE.md reference) so
we don't rediscover issues from scratch every conversation.

**Conventions:**
- Status: `open` | `fixed` | `deferred` | `wontfix`
- Priority: `P0` (breaks core UX), `P1` (degrades UX), `P2` (polish / follow-up)
- Each fixed item links to its commit SHA. Open items link to a GitHub issue
  when one exists.

**Workflow:** end of each working session, append new findings. When a fix
ships, move it from Open → Fixed with the commit hash.

---

## Currently open

| # | P | Area | Title | Issue | Notes |
|---|---|------|-------|:-----:|-------|
| ~~1~~ | ~~P1~~ | ~~frontend~~ | ~~Offline sync silently drops answers at maxRetries~~ | ~~[#1](https://github.com/leonardusbayu/osee-edubot/issues/1)~~ | **UI SHIPPED (F15)** — banner + manual retry. Server-side idempotency (client UUID + dedup) still open as a follow-up if dropped-answer incidents continue. |
| ~~2~~ | ~~P1~~ | ~~worker~~ | ~~Diagnostic test has no per-answer audit log~~ | ~~[#2](https://github.com/leonardusbayu/osee-edubot/issues/2)~~ | **FIXED (F16)** — migration 050_diagnostic_answer_log.sql + submitAnswer writes rows + buildStudentReport surfaces them. |
| 3 | P2 | worker | Tutor chat — no per-turn evidence/metadata | [#5](https://github.com/leonardusbayu/osee-edubot/issues/5) | `chat_analysis.analyzeMessageTopic` exists but isn't called. |
| 4 | P2 | worker | Speaking dimension scores silently dropped on error | — | `speaking.ts` — second insert throws, session still looks successful. |
| 5 | P2 | worker | Game score + XP award not atomic | — | `games.ts` — two separate writes, no transaction. |
| ~~6~~ | ~~P1~~ | ~~worker~~ | ~~Lesson steps never advance on natural completion~~ | ~~[#3](https://github.com/leonardusbayu/osee-edubot/issues/3)~~ | **FIXED (F17)** — explicit "✅ Selesai step ini" button + lesson_complete_X callback. Auto-advance on CQ pass deferred (not yet measured if needed). |
| ~~7~~ | ~~P2~~ | ~~worker~~ | ~~/progress + /profile bot commands don't use buildStudentReport~~ | — | **FIXED (F22)** — both now call buildStudentReport + dedicated formatters in bot-report-formatters.ts. |
| ~~8~~ | ~~P2~~ | ~~worker~~ | ~~Coin shop — coins earned but no spend path~~ | ~~[#6](https://github.com/leonardusbayu/osee-edubot/issues/6)~~ | **FIXED (F18)** — `/shop` command + purchase callback; streak_freeze and extra_questions fully wired; others refund with "coming soon" |
| ~~9~~ | ~~P2~~ | ~~worker~~ | ~~League leaderboard never surfaced~~ | — | **FIXED (F19)** — `/leaderboard` + `/league` bot commands show top 10 + user's rank |
| ~~10~~ | ~~P2~~ | ~~worker~~ | ~~League promotion/demotion silent~~ | ~~[#7](https://github.com/leonardusbayu/osee-edubot/issues/7)~~ | **FIXED (F20)** — `notifyLeagueChanges()` fires after weekly cron; Telegram messages for promote/demote events |
| ~~11~~ | ~~P2~~ | ~~worker~~ | ~~Friend quests never complete~~ | ~~[#8](https://github.com/leonardusbayu/osee-edubot/issues/8)~~ | **FIXED (F21)** — `recordQuestEvent()` hooked into `awardXp`; quests now progress, complete, and grant coin rewards |
| ~~12~~ | ~~P2~~ | ~~worker~~ | ~~Companion doesn't re-enrich mental-model from its own chat~~ | — | **FIXED (F23)** — [CONCEPT: tag; state: misconception\|partial\|solid] parsed from GPT reply; recordEvidence/recordMisconception called with weight 0.3–0.4. |
| ~~13~~ | ~~P1~~ | ~~ops~~ | ~~CI runs are red since Apr 13~~ | ~~[#4](https://github.com/leonardusbayu/osee-edubot/issues/4)~~ | **FIXED** — see F13 below. |
| ~~14~~ | ~~P2~~ | ~~content~~ | ~~TOEFL ITP error-id rows with blank content~~ | — | **SCRIPT READY (F24)** — `scripts/cleanup-broken-itp-error-id.sql` marks bad rows as draft. Dry-run command in the script header. Operator runs once. |
| ~~15~~ | ~~P2~~ | ~~worker~~ | ~~findIdleStudents HAVING-clause flag~~ | — | **N/A — already fixed** in a previous session via subquery rewrite. Comment at companion.ts:428–430 documents the original pitfall. No live bug. |

---

## Recently fixed (last 7 days)

| # | Commit | Area | Title |
|---|--------|------|-------|
| F1 | `bbd59fe` | worker | npm audit fix — hono + defu CVEs |
| F2 | `5a16cb0` | qa | Cross-domain audit fixes (TS errors, pricing, content cleanup, null-safety, report endpoint) |
| F3 | `d5841cb` | qa | Tier 2 QA (security leak, FSRS, prereqs, dark-mode contrast) |
| F4 | `8eb46c0` | tests | Drop malformed error_identification questions (TOEFL ITP) |
| F5 | `f259965` | human-touch | Harden cron delivery, surface level-ups, fix silent sendMessage failures |
| F6 | `f302a42` | companion | Integrate mental model + emotional state (adaptive_mode: validate/celebrate/reconnect/normal) |
| F7 | `bb57dc6` | testrunner | Listen-and-repeat audio — dedup widget, add retry + text fallback |
| F8 | `46bb135` | tts | TOEFL iBT speaking audio — double-decode + silent-failure bugs |
| F9 | `f2f6645` | scoring | Students now get correct scores for speaking/writing; auto-rescore for stuck attempts |
| F10 | `8e9f676` | reports | AI post-test summary, gamification in report, lesson skip audit |
| F11 | `4907a06` | ci | Pin worker deploy to top-level env |
| F12 | `cae9c63` | tests | Empty-content filter no longer rejects valid speaking questions |
| F13 | `4907a06` + token rotation | ops | CI deploys green (wrangler `--env=""` + fresh CLOUDFLARE_API_TOKEN) |
| F14 | `b4f98b3` | test | Vitest + CI test gate; 17 tests lock in scoring and summary bug classes |
| F15 | _this commit_ | frontend | Offline-sync drops surfaced: banner + manual retry when answers queue up or exhaust retries (was: silent console.warn) |
| F16 | _this commit_ | worker | Diagnostic per-answer audit log — migration 050 + submitAnswer writes + report includes them |
| F17 | `dcba7cf` | worker | Lesson step completion — "✅ Selesai step ini" button + `lesson_complete_X` callback; current_step now advances for real learners |
| F18 | _this commit_ | worker | Coin shop wired — `/shop` bot command + purchase flow; streak_freeze + extra_questions apply effects, others refund gracefully |
| F19 | _this commit_ | worker | League leaderboard exposed — `/leaderboard` + `/league` bot commands |
| F20 | _this commit_ | worker | League promotion/demotion notifications — Telegram message when users change league in weekly cron |
| F21 | `26254ce` | worker | Friend quest progress — `recordQuestEvent` hooked into awardXp; quests now increment, complete, grant rewards |
| F22 | _this commit_ | worker | `/progress` + `/profile` unified under buildStudentReport + shared formatters |
| F23 | _this commit_ | worker | Companion writes back to mental model — [CONCEPT: …] tag parsing |
| F24 | _this commit_ | ops | TOEFL ITP broken error-id cleanup script (operator dry-run + one-off execute) |

Live in production: F1–F12 (worker deployed manually via wrangler on Windows;
frontend deployed via `wrangler pages deploy` from Windows). `tts_cache` was
purged after F8 so stale corrupted cache entries no longer serve.

---

## Design decisions pending (not bugs, but shape affects fix)

- **What signals "lesson step completed"?** Fixes #6. Options: (a) explicit "Done" button, (b) CQ passed correctly, (c) N tutor turns on topic.
- **Offline sync idempotency:** Fixes #1. Options: (a) client-side UUID + server-side dedup, (b) optimistic UI with rollback on eventual sync failure.
- **Diagnostic audit shape:** Fixes #2. Options: (a) new `diagnostic_question_answers` table, (b) reuse `attempt_answers` with a diagnostic-flag column.

---

## Process

When a new bug is found:
1. Add a row to "Currently open" with priority + area + one-line symptom
2. If non-trivial, open a GitHub issue: https://github.com/leonardusbayu/osee-edubot/issues/new
3. Reference the issue number in the row: `Notes: #42`

When a fix ships:
1. Move the row to "Recently fixed" with commit SHA
2. Close the GitHub issue (if one exists) with the commit in the closing comment

Prune "Recently fixed" to the last 7 days so the file stays scannable.
