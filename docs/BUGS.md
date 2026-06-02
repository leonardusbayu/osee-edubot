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
| 16 | P2 | frontend | Test completion rate dropped from 25% → 0% (week 15 → 16) | — | See analysis below |

### #16 Analysis (2026-06-02)

**Symptoms:** Weekly completion rate crashed from 25% (week 15: 37/146) to
0% (weeks 16-21: 3/108). Most "abandoned" attempts have 0 answers
and sat in_progress for thousands of minutes before cleanup.

**Cleanup thresholds (current):**
- `/api/tests/start` (tests.ts:157): 2 hours
- `/api/tests/finish` (tests.ts:1553): 2 hours
- Hourly cron (index.ts:1389): 4 hours, only 0-answer attempts

**Test durations (TEST_CONFIGS):** TOEFL_IBT 90 min, IELTS 170 min,
TOEFL_ITP 115 min, TOEIC 120 min. **The 2-hour abandonment threshold
is below the test duration for IELTS / ITP / TOEIC** — a user can run
out of clock just by completing all sections. Combined with the
"no answer" abandonment, this means the threshold is more aggressive
than the tests themselves.

**Root causes (in order of likelihood):**
1. **Abandonment threshold too aggressive** — 2h is shorter than the
   full test duration for 3/4 test types. Users who pause for a
   coffee break or sleep lose their attempt.
2. **Long test duration** — TOEFL iBT is 90 min, IELTS is 170 min.
   Most users won't complete in one sitting.
3. **No nudge** — no Telegram reminder when an attempt sits
   in_progress for >30 min.

**Possible fixes** (ask user before implementing):
- A. Loosen abandonment threshold (2h → 24h) — one-line fix per location
- B. Send a Telegram nudge after 30 min in_progress
- C. Add a "Quick Test" option (5-10 questions, 15 min) to test menu
- D. Mark as deferred (real issue is usage pattern, not code bug)

---

## Recently fixed (last 7 days)

| # | Commit | Area | Title |
|---|--------|------|-------|
| F41 | `de9c67e` | channel | /start now logs channel_referrals (was 0 rows) |
| F29 | `adfa25e` | audit | Multi-speaker audio, section scoring, Whisper guard |
| F30 | `4093032` | audit | Critical sales-readiness fixes from content + audio audits |
| F31 | `8478899` | audio | Remove listening-passage audioPlayed block entirely |
| F32 | `a3ae866` | onboarding | Conversational 6-screen setup + feature discovery |
| F33 | `a96f081` | premium | Redemption codes — teacher-as-reseller channel |
| F34 | `c9a01e4` | content | Bulk AI content generator with few-shot + auto-QA |
| F35 | `74e3942` | weakness | Student weakness analysis system - 3-source profile |
| F36 | `69fa11b` | general | Test runner improvements, analytics, classes, TTS caching |
| F37 | `af52045` | general | Migrations, analytics service, private-tutor, student-profile |
| F38 | `6d265ca` | payment | Manual GoPay payment self-approve bug — /paid set status='paid' without grantPremium, breaking /confirm and /pendingpayments |
| F39 | `705e80a` | payment | Simplify manual GoPay payment flow — replace command-based (/requestpayment + /paid) with inline button flow; add photo proof handler; update all UI entrypoints |
| F40 | `a83f5fa` | bot | Review flow no longer shows raw JSON; plain /cancel exits review; free chat gets answered before contextual reminder |

---

## All fixed issues (historical)

| # | P | Area | Title | Fixed |
|---|--|------|-------|-------|
| 1 | P1 | frontend | Offline sync silently drops answers at maxRetries | F15+F25 |
| 2 | P1 | worker | Diagnostic test has no per-answer audit log | F16 |
| 3 | P2 | worker | Tutor chat — no per-turn evidence/metadata | F28 |
| 4 | P2 | worker | Speaking dimension scores silently dropped on error | F26 |
| 5 | P2 | worker | Game score + XP award not atomic | F27 |
| 6 | P1 | worker | Lesson steps never advance on natural completion | F17 |
| 7 | P2 | worker | /progress + /profile don't use buildStudentReport | F22 |
| 8 | P2 | worker | Coin shop — coins earned but no spend path | F18 |
| 9 | P2 | worker | League leaderboard never surfaced | F19 |
| 10 | P2 | worker | League promotion/demotion silent | F20 |
| 11 | P2 | worker | Friend quests never complete | F21 |
| 12 | P2 | worker | Companion doesn't re-enrich mental-model from its own chat | F23 |
| 13 | P1 | ops | CI runs are red since Apr 13 | F13 |
| 14 | P2 | content | TOEFL ITP error-id rows with blank content | F24 |
| 15 | P2 | worker | findIdleStudents HAVING-clause flag | N/A |

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
