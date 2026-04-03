# Architecture — EduBot System Structure

## Overview

```
Telegram Bot ←→ Cloudflare Worker (Hono API) ←→ D1 Database
                     ↕
              Cloudflare Pages (Mini App)
                     ↕
              OpenAI API (GPT-4 + Whisper + TTS)
                     ↕
              R2 Bucket (Audio Files)
```

All infrastructure on Cloudflare. Zero dedicated servers.

## Infrastructure

### Cloudflare Worker (Backend)
- **Runtime**: Cloudflare Workers with Hono framework (Node.js-like)
- **Database**: D1 (SQLite at the edge) — `edubot-db`, ID: `d501b671-128e-4a45-9d90-74b22e6691ce`
- **Storage**: R2 bucket — `edubot-audio` for TTS audio caching
- **Deploy**: `npx wrangler deploy` in `worker/`
- **Cron triggers**: 4 schedules (morning, evening, hourly, weekly)
- **Secrets**: Managed via `wrangler secret put` — never in code

### Cloudflare Pages (Frontend)
- **URL**: https://01d55aab.edubot-webapp.pages.dev
- **Framework**: React 18 + Vite + TypeScript
- **Router**: React Router v6
- **State**: Zustand for test session state
- **Auth**: Telegram WebApp initData → JWT via `/api/auth/login`
- **Deploy**: `npx wrangler pages deploy dist` from `frontend/`

### Telegram Bot
- **Webhook**: All updates via `POST /api/bot/webhook`
- **Commands**: 20+ commands (see CLAUDE.md)
- **Inline keyboards**: Used for menus, inline buttons

## API Structure

```
/api/auth/*         — JWT auth (Telegram initData → JWT)
/api/tests/*        — Practice tests (start, answer, finish, review)
/api/progress/*     — Student progress overview + costs
/api/premium/*      — Subscription options + purchase
/api/speaking/*     — Whisper transcription + AI scoring
/api/classes/*      — Class management
/api/admin/content/* — Teacher content CRUD
/api/tts/*          — Text-to-speech (OpenAI TTS + D1 cache)
/api/media/*        — File upload/serve
/api/ai-generate/*  — AI question generation (teacher only)
/api/analytics/*    — Student performance analytics
/api/handbook/*     — Student handbook
/api/writing/*      — Writing evaluation
```

## Frontend Routes (Mini App)

```
/                    — Test selection (home)
/test                — Test selection
/test/:id            — Active test runner
/test/:id/results    — Score + review
/progress            — Student dashboard + quota
/admin/content       — Teacher content management
/admin/students      — Student management
/admin               — Admin dashboard
/dashboard           — Admin dashboard
```

## Data Flow

### Auth Flow
1. User opens Mini App in Telegram
2. `window.Telegram.WebApp.initData` sent to `/api/auth/login`
3. Backend verifies Telegram hash, issues JWT (1hr access + 7d refresh)
4. Frontend stores tokens in Zustand, sends `Authorization: Bearer` header

### Test Flow
1. `/api/tests/start` → creates `test_attempts` record, returns sections
2. `/api/tests/questions/:section` → loads from `test_contents` (adaptive by difficulty)
3. `/api/tests/attempt/:id/answer` → saves to `attempt_answers`, checks quota
4. `/api/tests/attempt/:id/finish` → scores, saves to `test_results`
5. `/api/tests/attempt/:id/review` → returns answers + explanations

### Quota Flow (Freemium)
1. Free users: 10 questions/day, resets midnight WIB (17:00 UTC)
2. `checkTestAccess()` checks `daily_question_logs` + `referral_bonus_quota`
3. `trackQuestionAnswer()` increments `questions_answered` on new answers (not updates)
4. Referral signup → `grantReferralBonusQuota()` adds +5 bonus questions (never expires)

### Channel Posting
1. Cron triggers at 4 schedules
2. `handleCron` (morning): study reminders + channel vocab + quiz
3. `handleEveningCron` (evening): grammar + idiom + spotlight + CTA
4. `handleHourlyChannelCron` (hourly): rotates through 4 content types
5. `postToChannel()` sends to `-1003884450070` (ID from @TOEFL_IELTS_Indonesia)

## Key Modules

| Module | Responsibility |
|--------|---------------|
| `worker/src/bot/webhook.ts` | All Telegram bot commands + message handlers (2649 lines) |
| `worker/src/routes/tests.ts` | Test lifecycle API |
| `worker/src/services/premium.ts` | Quota checking, premium grants, referral bonuses |
| `worker/src/services/ai.ts` | AI tutor (GPT-4 chat) |
| `worker/src/services/spaced-repetition.ts` | SM-2 algorithm for review scheduling |
| `worker/src/services/studyplan.ts` | Personalized plan generation from diagnostic |
| `worker/src/services/diagnostic.ts` | 20-question placement test |
| `worker/src/services/contentGenerator.ts` | Channel content (vocab, grammar, CTAs) |
| `worker/src/services/classroom.ts` | Class groups, leaderboards, challenges |
| `worker/src/routes/speaking.ts` | Whisper + GPT speaking evaluation |
| `frontend/src/pages/TestRunner.tsx` | Active test UI with explanation display |
| `frontend/src/pages/TestResults.tsx` | Score + review answers section |

## Cron Schedule (all times WIB = UTC+7)

| Cron | UTC | WIB | Action |
|------|-----|-----|--------|
| `3 1 * * *` | 1:03 AM | 8:03 AM | Study reminders + channel vocab + quiz |
| `30 * * * *` | :30 past | :30 past | Channel content rotation (grammar/idiom/vocab/CTA) |
| `0 11 * * *` | 11:00 AM | 6:00 PM | Grammar + idiom + spotlight + CTA |
| `7 1 * * 1` | 1:07 AM Mon | 8:07 AM Mon | Weekly leaderboard |

## Security

- Webhook endpoint protected by `X-Telegram-Bot-Api-Secret-Token` header
- JWT auth with 1-hour expiry for API access
- Telegram initData hash verification on login
- Teacher/admin roles checked per-route
- No secrets in code — all via `wrangler secret put`
- CORS restricted to known origins (WEBAPP_URL + localhost)
