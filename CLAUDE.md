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
      auth.ts              — JWT authentication
      tests.ts             — Practice test flow
      writing.ts           — Writing evaluation
      speaking.ts          — Speaking evaluation (Whisper + GPT)
      progress.ts           — Student progress + cost dashboard
      content.ts           — Teacher content management
      content-reports.ts    — Content analytics + QA
      media.ts             — File upload/serve (R2)
      tts.ts               — Text-to-speech (OpenAI TTS + D1 cache)
      classes.ts           — Class management + API
      premium.ts           — Premium/subscription management
      weakness.ts           — Student weakness analysis API
      handbook.ts          — Teacher handbook API
      channel-analytics.ts — Channel post analytics
      certificates.ts       — Certificate generation
      calibration.ts        — Score calibration
      admin-api.ts         — Admin API v1
      analytics.ts         — Analytics + reporting
      audit.ts             — Audit logging
      anomalies.ts          — Anomaly detection
      games.ts             — Peer challenges + duels
      visual.ts            — Visual question renderer
      tutor.ts             — AI tutor chat API
      ai-generate.ts       — AI content generation
    services/
      ai.ts                — AI tutor (GPT-4o-mini chat)
      teaching.ts           — Lesson/drill generation
      agent.ts              — Autonomous teacher agent
      private-tutor.ts      — Ranedeer-style adaptive tutor
      chat-analysis.ts      — Chat topic detection + weakness signals
      weakness-analysis.ts   — 3-source student weakness profile
      companion.ts          — AI companion with mental model
      companion-nudge.ts    — Companion nudge engine
      student-profile.ts     — Cognitive profile + preferences
      mental-model.ts       — Theory-of-Mind knowledge tracking
      student-report.ts     — Comprehensive student report
      student-context.ts    — Student context for AI
      diagnostic.ts         — Placement test (20 questions)
      studyplan.ts         — Personalized study plan
      lesson-engine.ts      — Guided lesson with steps
      comprehension-check.ts — Comprehension question engine
      prerequisites.ts      — Skill dependency tree
      fsrs-engine.ts       — FSRS adaptive spaced repetition
      spaced-repetition.ts  — Legacy review scheduling
      teaching.ts           — Lesson/drill generation
      contentGenerator.ts   — Bulk AI content generator
      contentValidator.ts   — Content QA validation
      contentAuditor.ts    — Content audit checks
      classroom.ts         — Group quiz + leaderboard
      gamification.ts      — XP + coins + achievements
      leagues.ts           — League system
      coins.ts             — Coin economy
      friend-quests.ts     — Friend referral quests
      premium-codes.ts     — Premium redemption codes
      premium.ts           — Freemium quota tracking
      commercial.ts        — Commercial features
      analytics.ts         — Usage analytics
      item-analyzer.ts     — Item difficulty analysis
      irt-engine.ts        — Item Response Theory engine
      question-exposure.ts — Question exposure tracking
      learning-curve.ts     — Learning curve analytics
      calibration.ts        — Score calibration
      scoring-reliability.ts — Scoring reliability checks
      retest-reliability.ts — Retest reliability analysis
      anomaly-detector.ts  — Anomaly detection
      op-slo.ts            — Operational SLO tracking
      ai-quality-sampler.ts — AI quality sampling
      whisper-qa.ts        — Whisper QA evaluation
      prosody.ts           — Speech prosody analysis
      visual-explanation.ts — Visual explanation renderer
      scene-image.ts       — AI-generated scene images
      exercise-engine.ts   — Exercise sequencing
      smart-sequencing.ts  — Smart question sequencing
      pre-test-drill.ts    — Pre-test warmup drills
      band-lookup.ts       — Band score lookup
      notion-sync.ts       — Notion sync (optional)
      bot-report-formatters.ts — Bot report formatting

frontend/        — React/Vite Mini App (Telegram WebApp)
  src/
    App.tsx      — Main app + auth + routing
    main.tsx     — Entry point
    pages/
      TestSelection.tsx     — Browse/start tests + quota display
      TestRunner.tsx       — Section-by-section test UI
      TestResults.tsx       — Score display + answer review
      Progress.tsx          — Student progress dashboard
      ReportCard.tsx        — Printable report card
      Dashboard.tsx         — Admin dashboard
      AdminContent.tsx      — Teacher content panel
      AdminStudents.tsx     — Student management panel
      AdminAnalytics.tsx    — Analytics panel
      AdminPanel.tsx        — Comprehensive admin panel
      TeacherDashboard.tsx  — Teacher-specific dashboard
      WeaknessDashboard.tsx — Student weakness analysis
      StudentReportGenerator.tsx — AI student reports
      SkillPractice.tsx     — Skill-specific practice
    components/
      AudioRecorder.tsx     — Voice recording for speaking
      Timer.tsx            — Test timer
      ErrorBoundary.tsx     — Error handling wrapper
      ReportIssueButton.tsx — Issue reporting button
    api/
      authedFetch.ts       — Authenticated API fetch
      client.ts            — API client functions
    stores/
      test.ts              — Test session state (Zustand)
      auth.ts              — Auth state (Zustand)

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
- 50+ tables (see schema.json)

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
| /redeem CODE | All | Redeem a premium code (from teacher) |
| /shop | All | Coin shop for bonuses |
| /leaderboard | All | Weekly XP leaderboard |
| /league | All | View league + promotion status |
| /friend | All | Friend quest management |
| /quest | All | View active quests + progress |
| /admin | Teacher+ | Admin panel |
| /broadcast MSG | Teacher+ | Send to all students |
| /addclass | Teacher+ | Link Telegram group to class |
| /teacher CODE | Anyone | Become teacher (invite code) |
| /promote @user role | Admin | Change user role |
| /stats | Admin | System statistics |
| /gencodes N DAYS [batch] | Admin | Generate N premium redemption codes (1-500 codes, 1-730 days each) |
| /codestatus [batch] | Admin | Check redemption rate for a code batch (or list recent) |

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
- `GET /api/tests/attempt/:id/review` — Get detailed answer review
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

### Weakness Analysis API
- `GET /api/weakness/student/:userId` — Full weakness profile for one student
- `GET /api/weakness/all-students` — All students weakness summaries (admin)
- `GET /api/weakness/my-profile` — Current user's weakness profile

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

### Premium Redemption Codes
Teachers can generate redemption codes to sell or give to students.
- `/gencodes N DAYS [batch]` — Generate N codes with expiration
- `/codestatus [batch]` — Check redemption rate
- `/redeem CODE` — Student redeems a code

## Gamification

### XP System
- Earn XP from completing tests, lessons, and daily activities
- Level up with bonus rewards

### Coin Economy
- Earn coins from achievements and daily logins
- Spend in `/shop` for streak_freeze, extra_questions, etc.

### Leagues
- Bronze, Silver, Gold, Platinum, Diamond
- Weekly promotion/demotion based on XP
- `/league` to view current league and rank

### Friend Quests
- Invite friends and complete quests together
- Earn bonus rewards when friends sign up

## Key Features
- **4 Test Types**: TOEFL iBT, TOEFL ITP, IELTS Academic, TOEIC
- **3,000+ Questions**: Reading, Listening, Speaking, Writing with authentic format
- **Multi-speaker TTS**: Man/Woman/Professor voices for listening sections
- **Speaking Evaluation**: Whisper transcription + GPT-4 scoring with dimension breakdown
- **Writing Evaluation**: GPT-4 scoring with criteria feedback
- **Bulk AI Content Generator**: Few-shot learning + auto-QA + safe promotion pipeline
- **FSRS Spaced Repetition**: Adaptive review scheduling (ts-fsrs library)
- **Mental Model Engine**: Theory-of-Mind tracks what student knows/doesn't know
- **Ranedeer-style Personalization**: Learning style, communication style, depth level
- **AI-generated Lesson Plans**: Progressive difficulty with comprehension checks
- **Classroom Lesson Plans**: Calibrated to class average skill level
- **Skill Dependency Tree**: Prerequisite detection + topological ordering
- **Weakness Analysis**: 3-source profile (diagnostic + practice + chat)
- **Diagnostic Test**: 20-question placement test → personalized study plan
- **Class Groups**: Daily quiz, leaderboard, peer challenges
- **Gamification**: XP, coins, leagues, achievements, friend quests, shop
- **Role Management**: Student/teacher/admin with proper permissions
- **Daily Cron Notifications**: 8 AM WIB study reminders, 6 PM review nudges
- **Hourly Channel Posts**: Vocabulary, idiom, grammar, CTA rotation to @TOEFL_IELTS_Indonesia
- **TTS Audio Caching**: R2 storage + D1 cache to reduce API costs
- **API Cost Tracking**: Per-user, per-endpoint cost dashboard
- **Freemium Gating**: Daily quota + referral bonuses
- **Certificate Generation**: PDF certificates on target score achievement

## Cron Schedule
- `3 1 * * *` — Daily 8:03 AM WIB: study reminders + daily quiz + channel morning post
- `7 1 * * 1` — Monday 8:07 AM WIB: weekly leaderboard + league promotions
- `0 11 * * *` — Daily 6:00 PM WIB: channel evening post
- `30 * * * *` — Hourly: class activity digest + channel content rotation + payment cleanup

## QA Checklist (Before Deploying)

When implementing features, verify:
1. **Pricing consistency** — Bot `/premium` command and API `/options` must show same Stars prices
2. **Indonesian UI** — No Chinese characters (完成) or English typos in Indonesian messages
3. **Explanations** — Questions with explanations show in TestResults review section
4. **Quota enforcement** — Free users hit 10/day limit → `LIMIT_REACHED` error → locked screen
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

## Recent Commits

Latest commits on main:
- `adfa25e` — fix(audit): batch 2 — multi-speaker audio, section scoring, Whisper guard
- `4093032` — fix(audit): critical sales-readiness fixes from content + audio audits
- `8478899` — fix(audio): remove listening-passage audioPlayed block entirely
- `a3ae866` — feat(onboarding+nudges): conversational 6-screen setup + feature discovery
- `a96f081` — feat(premium): redemption codes — teacher-as-reseller channel
- `c9a01e4` — feat(content): bulk AI content generator with few-shot + auto-QA
- `74e3942` — feat: student weakness analysis system - 3-source profile
