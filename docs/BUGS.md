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
| 16 | P2 | frontend | Test completion rate 0% — users start but don't finish tests | — | Needs investigation |
| 17 | P2 | channel | Channel referral tracking broken — 122 posts but 0 referrals | — | /start handler may not be logging referrals properly |

---

## Recently fixed (last 7 days)

| # | Commit | Area | Title |
|---|--------|------|-------|
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
