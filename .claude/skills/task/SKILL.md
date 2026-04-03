---
name: task
description: Implement a new feature or fix from a specification — follows the spec-from-chat workflow, QA checklist, and deployment steps.
---

# Task Skill

You implement features and fixes for EduBot. Use this skill when building new functionality or fixing bugs.

## Workflow

### 1. Understand the Task
- Read the user's request carefully
- Ask clarifying questions if the spec is ambiguous
- Confirm the scope before starting

### 2. Explore the Codebase
- Search for existing similar implementations
- Check relevant files in `worker/src/` and `frontend/src/`
- Read the current implementation of related features
- Check database schema (`worker/migrations/*.sql`)

### 3. Implement
- Follow existing code conventions (style, naming, patterns)
- Keep functions small and focused
- Add TypeScript types everywhere
- Update tests if they exist

### 4. QA Before Deploying
Run through this checklist before deploying:

1. **Pricing consistency** — If you changed premium pricing, verify bot `/premium` and API `/options` show the same Stars prices
2. **Indonesian UI** — Check for Chinese characters (完成) or English typos in messages
3. **Explanations** — If you touched questions/test flow, verify explanations appear in TestRunner and TestResults
4. **Quota enforcement** — If you changed quota logic, test LIMIT_REACHED flow end-to-end
5. **TypeScript** — Run `tsc --noEmit` in both `worker/` and `frontend/`
6. **Migration** — If you added new SQL tables/columns, run migration on remote D1 before deploying worker

### 5. Deploy
```bash
# Frontend
cd frontend && npm run build
npx wrangler pages deploy dist --project-name edubot-webapp

# Worker
cd worker && npx wrangler deploy

# D1 migration (if needed)
npx wrangler d1 execute edubot-db --remote --file=./migrations/0NNN_name.sql
```

### 6. Test in Production
- Test the bot command if changed
- Test the mini app if changed
- Verify no console errors

## Key Files Reference

### Backend
- `worker/src/bot/webhook.ts` — Telegram bot commands
- `worker/src/routes/tests.ts` — Test API (start, answer, finish, review)
- `worker/src/routes/premium.ts` — Premium/subscription API
- `worker/src/services/premium.ts` — Quota checking functions
- `worker/src/services/commercial.ts` — Referral processing

### Frontend
- `frontend/src/pages/TestSelection.tsx` — Test browser + locked screen
- `frontend/src/pages/TestRunner.tsx` — Active test with explanations
- `frontend/src/pages/TestResults.tsx` — Results + review section
- `frontend/src/pages/Progress.tsx` — Progress dashboard + quota bar

### Database
- `worker/migrations/` — SQL migrations for D1
- Tables: `daily_question_logs`, `referral_bonus_quota`, `test_contents`, `attempt_answers`, `test_results`, `users`

## Important Rules
- Always run `tsc --noEmit` before deploying
- Never commit secrets or API keys
- Keep responses concise — summarize what was done
- If something is unclear, ask before guessing
