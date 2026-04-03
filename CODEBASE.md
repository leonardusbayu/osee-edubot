# CODEBASE.md — File Map

## Project Root

```
├── CLAUDE.md           — This file, agent instructions
├── VISION.md           — Business goals, fears, constraints
├── ARCHITECTURE.md     — System structure and data flow
├── CONVENTIONS.md      — Code patterns to follow
├── DECISIONS.md        — History of significant choices
├── TASK.md             — Current task in progress (if any)
│
├── worker/             — Cloudflare Worker (TypeScript/Hono)
│   ├── wrangler.toml   — Worker config, D1 binding, cron triggers
│   ├── src/
│   │   ├── index.ts     — Entry point + 4 cron handlers
│   │   ├── types.ts     — Env, User, JWTPayload interfaces
│   │   ├── bot/
│   │   │   └── webhook.ts — Telegram bot (all commands + message handlers) ⚠️ 2649 lines
│   │   ├── routes/
│   │   │   ├── auth.ts        — Telegram initData → JWT
│   │   │   ├── tests.ts        — Test start/answer/finish/review (502 lines)
│   │   │   ├── progress.ts     — Student progress overview + costs
│   │   │   ├── content.ts      — Teacher content CRUD ⚠️ has pre-existing TS error
│   │   │   ├── media.ts       — File upload to R2
│   │   │   ├── tts.ts         — OpenAI TTS with D1 caching
│   │   │   ├── speaking.ts    — Whisper + GPT speaking evaluation
│   │   │   ├── classes.ts     — Class groups + leaderboard API
│   │   │   ├── premium.ts     — Subscription options + Stars payment
│   │   │   ├── ai-generate.ts — AI question generation (teacher only)
│   │   │   ├── writing.ts     — Writing evaluation API
│   │   │   ├── analytics.ts   — Student performance analytics
│   │   │   └── handbook.ts    — Student handbook
│   │   └── services/
│   │       ├── ai.ts          — GPT-4 tutor chat
│   │       ├── teaching.ts    — Lesson/drill generation
│   │       ├── diagnostic.ts  — 20Q placement test
│   │       ├── studyplan.ts   — Personalized plan generation
│   │       ├── prerequisites.ts — Skill dependency tree
│   │       ├── spaced-repetition.ts — SM-2 review scheduling
│   │       ├── classroom.ts   — Group quiz, leaderboard, challenges
│   │       ├── premium.ts     — Quota logic, premium grants, referral bonuses
│   │       ├── commercial.ts  — Referral processing, gamification
│   │       ├── contentGenerator.ts — Channel content (vocab, grammar, CTAs)
│   │       └── agent.ts       — Autonomous teacher/admin agent
│   └── migrations/
│       ├── 001_premium_referral.sql — Users premium + referral fields
│       ├── 002_lead_source.sql       — Lead tracking
│       ├── 003_payment_tracking.sql  — Payment records
│       ├── 004_review_sessions.sql   — Spaced repetition reviews
│       └── 005_daily_usage.sql       — daily_question_logs + referral_bonus_quota
│
├── frontend/           — React/Vite Mini App
│   ├── src/
│   │   ├── App.tsx     — Router + Telegram auth initialization
│   │   ├── main.tsx    — React entry
│   │   ├── index.css    — Tailwind + Telegram theme vars
│   │   ├── pages/
│   │   │   ├── TestSelection.tsx — Test browser + locked screen + quota bar ⚠️ 450 lines
│   │   │   ├── TestRunner.tsx    — Active test UI + explanations ⚠️ 1050+ lines
│   │   │   ├── TestResults.tsx   — Score + review answers section
│   │   │   ├── Progress.tsx      — Dashboard + quota usage display
│   │   │   ├── Dashboard.tsx     — Admin dashboard
│   │   │   ├── AdminContent.tsx  — Teacher content panel
│   │   │   └── AdminStudents.tsx — Student management
│   │   ├── api/
│   │   │   ├── client.ts       — API client functions
│   │   │   └── authedFetch.ts   — Authenticated fetch helper
│   │   ├── stores/
│   │   │   ├── auth.ts         — Auth token state (Zustand)
│   │   │   └── test.ts         — Test session state (Zustand)
│   │   └── components/
│   │       ├── Timer.tsx       — Section countdown timer
│   │       └── AudioRecorder.tsx — Browser microphone recording
│   └── dist/                   — Built output (deployed to Pages)
│
├── backend/            — Legacy Python backend (referenced but not actively used)
├── scripts/            — Python data import scripts
│   ├── parse-toefl-itp.py
│   ├── parse-ielts.py
│   ├── parse-ielts-extra.py
│   ├── parse-toeic.py
│   ├── import-itp-reading.py
│   ├── reimport-itp.py
│   └── enrich-itp-toeic.py
└── shared/             — JSON test configs
```

## Key Files by Feature

### Freemium / Quota
| File | What it does |
|------|-------------|
| `worker/src/services/premium.ts` | `checkTestAccess()`, `trackQuestionAnswer()`, `grantReferralBonusQuota()` |
| `worker/src/routes/premium.ts` | `/api/premium/options` — Stars pricing |
| `worker/src/routes/tests.ts` | Quota check on `/start` and `/attempt/:id/answer` |
| `frontend/src/pages/TestSelection.tsx` | Locked screen, quota bar |
| `frontend/src/pages/TestRunner.tsx` | `LIMIT_REACHED` → redirect to locked screen |
| `frontend/src/pages/Progress.tsx` | Quota usage display |

### Questions / Tests
| File | What it does |
|------|-------------|
| `worker/src/routes/tests.ts` | Test lifecycle, scoring, adaptive difficulty |
| `worker/src/services/diagnostic.ts` | 20Q placement test, hardcoded questions |
| `worker/src/services/teaching.ts` | Lesson and drill generation |
| `frontend/src/pages/TestRunner.tsx` | Full test UI with 8+ question types |
| `frontend/src/pages/TestResults.tsx` | Score + expandable review section |

### Speaking / Audio
| File | What it does |
|------|-------------|
| `worker/src/routes/speaking.ts` | Whisper transcription + GPT scoring |
| `worker/src/routes/tts.ts` | OpenAI TTS with D1 cache lookup |
| `worker/src/services/ai.ts` | GPT-4 tutor + audio transcription calls |

### Referrals / Gamification
| File | What it does |
|------|-------------|
| `worker/src/services/commercial.ts` | `processReferral()` — grants bonus quota |
| `worker/src/services/premium.ts` | `grantReferralBonusQuota()` |
| `worker/src/services/classroom.ts` | Leaderboards, peer challenges |

### Channel Posting
| File | What it does |
|------|-------------|
| `worker/src/services/contentGenerator.ts` | Vocab, grammar, idiom, CTA generation + `postToChannel()` |
| `worker/src/index.ts` | 4 cron handlers calling channel posts |

## Database Tables (D1)

Core tables: `users`, `test_attempts`, `attempt_answers`, `test_results`, `test_contents`
Quota tables: `daily_question_logs`, `referral_bonus_quota`
Learning tables: `study_plans`, `spaced_repetition`, `review_sessions`
Social tables: `class_groups`, `class_members`, `challenges`
Content tables: `diagnostic_sessions`, `diagnostic_answers`
Payment tables: `payment_records`, `referral_rewards`

Full schema: `worker/schema.json`

## Pre-existing Issues (Known)

| Issue | File | Impact | Status |
|-------|------|--------|--------|
| `content.ts` has TS error on `user` type | `worker/src/routes/content.ts:44` | Build warning | Known, not blocking |
| `webhook.ts` is 2649 lines | `worker/src/bot/webhook.ts` | Hard to navigate | Technical debt |
| `TestRunner.tsx` is 1050+ lines | `frontend/src/pages/TestRunner.tsx` | Hard to navigate | Technical debt |
| Questions imported with empty explanations | `scripts/*.py` | Students see blank explanations | Content debt |

## What's Missing / Incomplete

- `/attempt/:id/review` API returns `attempt_answers` joined with `test_contents` but `question_id` may not always be set (relies on `section + question_index`)
- `ai_summary` in `test_results` is always `null` — no AI-written performance summary generated
- Teacher content approval workflow exists in code but not fully activated
- Stripe/Gopay payment flow referenced but Telegram Stars is primary payment
- No rate limiting on any API endpoint
- No CI/CD pipeline (manual deploy)
