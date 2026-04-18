# EduBot — TOEFL iBT & IELTS AI Tutor

## 📋 Read this first every session

**Bug log & fix history:** [`docs/BUGS.md`](./docs/BUGS.md) — canonical list of
open issues, recent fixes with commit SHAs, and deferred design decisions.
Check it before proposing fixes so we don't re-diagnose the same problems.

**GitHub Issues:** https://github.com/leonardusbayu/osee-edubot/issues — each
open bug in BUGS.md with a `Notes: #N` reference has a matching issue for
stakeholder tracking.

**When a fix ships:** update `docs/BUGS.md` (move row from Open → Fixed with
commit SHA) and close the matching GitHub issue. Pruning rule: keep the last
7 days of fixes in BUGS.md; older history lives in git log.

**Obsidian memory (Claude Desktop sessions):** if Obsidian MCP is wired, use
the `EduBot` vault for working notes: `sessions/YYYY-MM-DD.md` per session,
`architecture/*.md` for pinned long-form design docs. Setup instructions:
[`docs/CLAUDE_OBSIDIAN_SETUP.md`](./docs/CLAUDE_OBSIDIAN_SETUP.md). Git is
canonical state; Obsidian is working memory — keep the split clean.

## Architecture

```
Telegram Bot ←→ Cloudflare Worker (API) ←→ D1 Database
                     ↕
              Cloudflare Pages (Mini App)
                     ↕
              OpenAI API (TTS + Whisper + GPT)
```

All hosted on Cloudflare (free/cheap tier). Zero servers to manage.

## Project Structure

```
worker/          — Cloudflare Worker (TypeScript/Hono)
  src/
    index.ts     — Main entry + cron handlers
    types.ts     — TypeScript interfaces
    bot/
      webhook.ts — Telegram bot commands + message handlers
    routes/
      auth.ts    — JWT authentication
      tests.ts   — Practice test flow
      progress.ts— Student progress + cost dashboard
      content.ts — Teacher content management
      media.ts   — File upload/serve
      tts.ts     — Text-to-speech (OpenAI TTS + D1 cache)
      speaking.ts— Speaking evaluation (Whisper + GPT scoring)
      classes.ts — Class management + API
      premium.ts — Premium/subscription management
    services/
      ai.ts      — AI tutor (OpenAI chat)
      teaching.ts— Lesson/drill generation
      diagnostic.ts — Placement test (20 questions)
      studyplan.ts  — Personalized study plan
      prerequisites.ts — Skill dependency tree
      fsrs-engine.ts — FSRS adaptive spaced repetition (replaces spaced-repetition.ts)
      spaced-repetition.ts — Legacy review scheduling (deprecated, use fsrs-engine)
      private-tutor.ts — Ranedeer-style adaptive tutor with mental model
      student-profile.ts — Cognitive profile + learning preferences
      mental-model.ts — Theory-of-Mind: student knowledge tracking
      lesson-engine.ts — Guided learning: personalized + classroom lesson plans
      classroom.ts  — Group quiz, leaderboard, challenges
      premium.ts   — Freemium gating, quota tracking, referral bonuses
      commercial.ts — Referral processing, gamification
      student-report.ts — Comprehensive student intelligence report (JSON + AI context)

frontend/        — React/Vite Mini App
  src/
    App.tsx      — Main app + auth
    pages/
      TestSelection.tsx — Browse/start tests + quota display
      TestRunner.tsx    — Section-by-section test UI + explanations
      TestResults.tsx   — Score display + answer review
      Progress.tsx      — Student progress dashboard + quota bar
      AdminContent.tsx  — Teacher content panel
      AdminStudents.tsx — Student management panel
      Dashboard.tsx     — Admin dashboard
      AdminPanel.tsx   — Comprehensive admin panel (v1 API)
    api/
      authedFetch.ts    — Authenticated API fetch helper
      client.ts        — API client functions
    stores/
      test.ts          — Test session state (Zustand)

shared/          — Test configs (JSON)
migrations/      — D1 schema migrations (SQL)
scripts/         — Data import scripts (Python)
```

## Development

### Worker (backend)
```bash
cd worker
npm install
cp ../backend/.env.example .env  # Fill API keys
npx wrangler dev  # Local dev server at localhost:8787
npx wrangler deploy  # Deploy to production
```

### Frontend
```bash
cd frontend
npm install
npm run dev       # Dev server at localhost:5173
npm run build     # Build for production
npx wrangler pages deploy dist --project-name edubot-webapp
```

### Environment Variables (Worker secrets)
Set via `npx wrangler secret put <NAME>`:
- `TELEGRAM_BOT_TOKEN` — Telegram bot token
- `TELEGRAM_BOT_SECRET` — Webhook verification secret
- `OPENAI_API_KEY` — OpenAI API key (GPT + TTS + Whisper)
- `JWT_SECRET` — JWT signing key
- `TEACHER_CODE` — Invite code for teacher registration
- `ADMIN_API_KEY` — API key for external app integration (admin API v1)

### D1 Database
- Name: `edubot-db`
- ID: `d501b671-128e-4a45-9d90-74b22e6691ce`
- 43 tables (see schema.json)

## Bot Commands

| Command | Role | Description |
|---------|------|-------------|
| /start | All | Main menu |
| /study | All | 22 study topics |
| /diagnostic | All | 20-question placement test |
| /today | All | Today's study plan lesson |
| /review | All | FSRS adaptive spaced repetition review |
| /lesson | All | AI-generated personalized lesson plan |
| /plan | All | View all lesson plans + progress |
| /profile | All | Full learning profile + mental model |
| /mystyle | All | Set learning style, comm style, depth |
| /settings | All | Change target test + level |
| /challenge @user | All | Peer duel (5 questions) |
| /join CODE | All | Join class by invite code |
| /role | All | Show current role |
| /help | All | List commands |
| /test | All | Opens mini app for practice tests |
| /premium | All | View premium plans + pricing |
| /referral | All | View referral code + stats |
| /buy | All | Purchase premium with Telegram Stars |
| /admin | Teacher+ | Admin panel |
| /broadcast MSG | Teacher+ | Send to all students |
| /addclass | Teacher+ | Link Telegram group to class |
| /teacher CODE | Anyone | Become teacher (invite code) |
| /promote @user role | Admin | Change user role |
| /stats | Admin | System statistics |

## API Endpoints

### Public
- `GET /api/health`
- `GET /api/tests/available`
- `GET /api/tests/question-counts`
- `GET /api/tests/questions/:section`

### Authenticated
- `POST /api/auth/login` — Telegram initData → JWT
- `POST /api/tests/start` — Start test attempt
- `POST /api/tests/attempt/:id/answer` — Submit answer
- `POST /api/tests/attempt/:id/finish` — Finish + score
- `GET /api/tests/attempt/:id/review` — Get detailed answer review with explanations
- `GET /api/progress/overview` — Student progress
- `GET /api/progress/costs` — API cost dashboard
- `POST /api/speaking/evaluate` — Whisper + GPT scoring
- `GET /api/premium/options` — Get premium subscription options (Stars pricing)

### Teacher
- `GET/POST /api/admin/content` — CRUD test content
- `GET/POST /api/classes` — Class management

### Admin API v1 (supports API key auth via X-API-Key header)
- `GET /api/v1/admin/students` — List students (paginated, searchable, sortable)
- `GET /api/v1/admin/students/:id` — Deep student profile (mastery, mental model, SRS, lessons)
- `GET /api/v1/admin/students/:id/report` — Full student intelligence report (JSON)
- `GET /api/v1/admin/students/:id/report/ai` — AI-optimized context string for lesson planning
- `PUT /api/v1/admin/students/:id/role` — Update role
- `PUT /api/v1/admin/students/:id/profile` — Update profile fields
- `DELETE /api/v1/admin/students/:id` — Ban student (soft delete)
- `GET /api/v1/admin/analytics/overview` — System-wide dashboard stats
- `GET /api/v1/admin/analytics/trends` — Daily activity trends (configurable days)
- `GET /api/v1/admin/analytics/content-coverage` — Question bank distribution
- `GET /api/v1/admin/mental-model/:userId` — Student mental model
- `PUT /api/v1/admin/mental-model/:userId/:concept` — Adjust mental model
- `GET /api/v1/admin/lessons` — List lesson plans (filterable)
- `GET /api/v1/admin/lessons/:id` — Lesson plan detail with step results
- `DELETE /api/v1/admin/lessons/:id` — Archive lesson plan
- `GET /api/v1/admin/content` — List content (filtered, paginated)
- `POST /api/v1/admin/content/bulk-status` — Bulk update content status
- `POST /api/v1/admin/content/bulk-insert` — Bulk insert questions
- `GET /api/v1/admin/classes` — List classes with member counts
- `GET /api/v1/admin/classes/:id/students` — Class students with accuracy
- `GET /api/v1/admin/srs/overview` — SRS system-wide stats
- `GET /api/v1/admin/premium/overview` — Premium/revenue dashboard
- `GET /api/v1/admin/system/tables` — All D1 tables + row counts
- `GET /api/v1/admin/system/health` — Deep health check
- `POST /api/v1/admin/system/query` — Read-only SQL console
- `GET /api/v1/admin/export/students?format=csv` — Export students
- `GET /api/v1/admin/export/content?format=csv` — Export content

## Freemium Model

### Free Tier
- 10 questions/day (all question types count)
- Daily reset at midnight WIB (17:00 UTC)
- Access to mini app with locked screen when quota exceeded
- Referral bonus: +5 questions per successful referral signup (stack infinitely, never expire)

### Premium Tier
- Unlimited questions
- AI Tutor 24/7
- Speaking practice with Whisper evaluation
- Full study plans
- Certificate on target score achievement

### Premium Pricing (Telegram Stars)
- 7 days = 375 ⭐ (Rp 30,000)
- 30 days = 1,238 ⭐ (Rp 99,000)
- 90 days = 3,375 ⭐ (Rp 270,000)
- 180 days = 6,250 ⭐
- 365 days = 11,875 ⭐

### Database Tables
- `daily_question_logs` — Tracks daily question usage per user
- `referral_bonus_quota` — Accumulates bonus questions from referrals
- `student_mental_model` — Theory-of-Mind: per-concept understanding tracking
- `lesson_plans` — AI-generated personalized + classroom lesson plans
- `lesson_step_results` — Individual lesson step completion tracking

## Key Features
- 3,036+ TOEFL iBT questions (Reading, Listening, Speaking, Writing)
- Multi-speaker TTS audio for listening (Man/Woman/Professor voices)
- Speaking evaluation via Whisper transcription + AI scoring
- FSRS adaptive spaced repetition (ts-fsrs, replaces fixed intervals)
- Theory-of-Mind engine: tracks what tutor believes student knows/doesn't know
- Ranedeer-style personalization: learning style, communication style, depth level
- AI-generated personalized lesson plans with progressive difficulty
- Classroom lesson plans calibrated to class average skill level
- Skill dependency tree with prerequisite detection + topological ordering
- Mental model: misconception detection, knowledge gap analysis
- Diagnostic test → personalized study plan
- Class groups with daily quiz, leaderboard, peer challenges
- Role management (student/teacher/admin)
- Daily cron notifications (8 AM WIB)
- TTS audio caching in D1
- API cost tracking
- Freemium gating with daily quota + referral bonuses

## Cron Schedule
- `3 1 * * *` — Daily 8:03 AM WIB: study reminders + daily quiz
- `7 1 * * 1` — Monday 8:07 AM WIB: weekly leaderboard
- `0 11 * * *` — Daily 6:00 PM WIB: daily review reminder
- `30 * * * *` — Hourly: class activity digest

## QA Checklist (Before Deploying)

When implementing features, verify:
1. **Pricing consistency** — Bot `/premium` command and API `/options` must show same Stars prices
2. **Indonesian UI** — No Chinese characters (完成) or English typos in Indonesian messages
3. **Explanations** — Questions with explanations show them in TestRunner (after answering) and TestResults (review section)
4. **Quota enforcement** — Free users hit 10/day limit → `LIMIT_REACHED` error → redirect to locked screen
5. **TypeScript** — Run `tsc --noEmit` in both `worker/` and `frontend/` before deploying
6. **Migration** — Run new SQL migrations on remote D1 before deploying worker changes

## Deployment Commands

```bash
# Frontend build + deploy
cd frontend && npm run build
cd ../worker && npx wrangler pages deploy ../frontend/dist --project-name edubot-webapp

# Worker deploy
cd worker && npx wrangler deploy

# Run D1 migration (replace NNN with migration number)
cd worker && npx wrangler d1 execute edubot-db --remote --file=./migrations/0NNN_name.sql
```
