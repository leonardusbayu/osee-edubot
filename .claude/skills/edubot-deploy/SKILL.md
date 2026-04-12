---
name: edubot-deploy
description: "Deploy EduBot to production — build frontend, deploy Worker and Pages, run D1 migrations, and verify everything works. Handles the full deployment pipeline including pre-deploy checks (TypeScript compilation, migration status), the actual deployment commands, and post-deploy verification (health checks, database state). Use this whenever: deploying changes, pushing to production, updating the bot, running migrations, or when someone says 'deploy', 'push to prod', 'ship it', 'update production', 'run migration', or asks about deployment status."
---

# EduBot Deploy Skill

You handle the complete deployment pipeline for EduBot — from pre-deploy validation to post-deploy verification. The goal is a zero-downtime deployment that doesn't break anything.

## Why a Deployment Skill?

EduBot has three independently deployable components (Worker, Frontend, D1 migrations) that need to go out in the right order. Deploying frontend before running a migration that adds a column the frontend expects = broken app. This skill enforces the correct sequence.

## Deployment Sequence

The order matters:
1. **TypeScript checks** (catch errors before they hit production)
2. **D1 migrations** (schema changes must exist before code that uses them)
3. **Worker deploy** (backend API)
4. **Frontend build + deploy** (UI that calls the API)
5. **Verification** (confirm everything works)

## Pre-Deploy Checklist

### 1. TypeScript Compilation

```bash
cd worker && npx tsc --noEmit
cd ../frontend && npx tsc --noEmit
```

Both must pass with zero errors. If there are errors, fix them first — do NOT deploy with TypeScript errors.

### 2. Check for Pending Migrations

```bash
ls worker/migrations/*.sql | sort -V | tail -5
```

Compare against what's been applied. If there are new migration files that haven't been run on remote D1, they need to go first.

### 3. Check for Uncommitted Changes

```bash
git status
git diff --stat
```

Note what's changed — useful for the deploy summary.

## Deployment Commands

### Step 1: Run Migrations (if any)

For each new migration file:

```bash
cd worker
npx wrangler d1 execute edubot-db --remote --file=./migrations/XXXX_name.sql
```

If this is a Cowork session, use the D1 MCP tool instead:
- Database ID: `d501b671-128e-4a45-9d90-74b22e6691ce`
- Run each SQL statement individually (D1 MCP doesn't support multi-statement files)

**Migration safety rules:**
- ALTER TABLE ADD COLUMN is safe (backward compatible)
- CREATE TABLE IF NOT EXISTS is safe
- DROP TABLE/COLUMN is dangerous — confirm with user first
- Data backfills should be separate from schema changes

### Step 2: Deploy Worker

```bash
cd worker
npx wrangler deploy
```

This deploys the Cloudflare Worker (API backend). The worker URL is:
`https://edubot-api.edubot-leonardus.workers.dev`

### Step 3: Build & Deploy Frontend

```bash
cd frontend
rm -rf dist
npm run build
cd ../worker
npx wrangler pages deploy ../frontend/dist --project-name edubot-webapp
```

The frontend URL is:
`https://01d55aab.edubot-webapp.pages.dev`

### Note on Sandbox Environments

If running from a Cowork sandbox, `npx wrangler deploy` will fail because there's no CLOUDFLARE_API_TOKEN. In this case:

1. Generate the exact commands the user needs to run
2. Present them as a copy-paste block
3. Remind them to run from the project directory (not system32!)

```cmd
cd /d "D:\claude telegram bot\frontend"
rmdir /s /q dist
npm run build
cd ..\worker
npx wrangler pages deploy ..\frontend\dist --project-name edubot-webapp
npx wrangler deploy
```

## Post-Deploy Verification

### 1. API Health Check

```
GET https://edubot-api.edubot-leonardus.workers.dev/api/health
```
Expected: `{"status":"ok"}`

### 2. Database Connectivity

```sql
SELECT COUNT(*) as users FROM users
SELECT COUNT(*) as questions FROM test_contents WHERE status = 'published'
SELECT COUNT(*) as tables FROM sqlite_master WHERE type = 'table'
```

### 3. Bot Responsiveness

Send `/start` to the Telegram bot and verify:
- Response arrives within 5 seconds
- Main menu keyboard appears
- No error text

### 4. Frontend Loading

Check that the frontend loads and can authenticate:
- Visit the Pages URL
- Verify no console errors
- Test selection page renders

## Deploy Summary Format

After deployment, report:

```
## Deploy Summary — [date]

### What Changed
- [List of key changes]

### Migrations Applied
- [migration files run, or "None"]

### Components Deployed
- Worker: ✅ / ❌
- Frontend: ✅ / ❌
- D1 Migrations: ✅ / ❌ / N/A

### Verification
- API Health: ✅ / ❌
- Database: ✅ / ❌ ([X] users, [Y] questions, [Z] tables)
- Bot: ✅ / ❌
- Frontend: ✅ / ❌

### Next Steps
- [Any follow-up actions needed]
```

## Rollback

If something goes wrong after deploy:

1. **Worker rollback**: Cloudflare keeps previous versions. Use the dashboard or `wrangler rollback`
2. **Frontend rollback**: Redeploy the previous build from git
3. **Migration rollback**: There is NO automatic rollback for D1 migrations. Write a reverse migration if needed (e.g., DROP COLUMN). Always test migrations on a local D1 first for dangerous operations.

## Important Notes

- Never deploy during peak hours (8 AM - 10 PM WIB) if possible — students are using the bot
- D1 migrations run against the production database — there's no staging environment
- The Worker and Frontend are independently deployable, but migration must come before both
- If the user is on Windows, use `rmdir /s /q dist` instead of `rm -rf dist`
- Always run TypeScript checks before deploying — catching a bug in production means students hit errors
