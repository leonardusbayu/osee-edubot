---
name: status
description: Quick health check of the EduBot system — verifies bot, worker, database, and frontend are all functioning correctly.
---

# Status Skill

You perform a quick health check of the EduBot system. Use this when verifying everything is working or diagnosing issues.

## Health Check Steps

### 1. Telegram Bot
Send `/start` to the bot and verify:
- Response arrives within 5 seconds
- Main menu keyboard appears
- No error messages

### 2. Worker API
Check these endpoints (can use curl or WebFetch):
```
GET https://edubot-api.edubot-leonardus.workers.dev/api/health
```
Expected: `{"status":"ok"}`

### 3. Mini App
Open https://01d55aab.edubot-webapp.pages.dev and verify:
- Page loads without errors
- Test selection screen appears
- Can browse tests

### 4. Database (D1)
Check via wrangler:
```bash
npx wrangler d1 execute edubot-db --remote --command="SELECT COUNT(*) as users FROM users"
npx wrangler d1 execute edubot-db --remote --command="SELECT COUNT(*) as contents FROM test_contents WHERE status='published'"
```
Verify: reasonable counts, no errors

### 5. Recent Errors
Check Cloudflare dashboard for worker errors, or check:
```bash
npx wrangler tail --env production --format=json 2>&1 | head -20
```

## Status Report Format

When reporting status, use this format:

```
## EduBot Status

### Bot
- Telegram: ✅ OK / ❌ Issue
- Response time: Xms

### API
- Worker: ✅ OK / ❌ Issue
- Frontend: ✅ OK / ❌ Issue

### Database
- D1: ✅ OK / ❌ Issue
- Tables: X users, Y questions

### Active Issues
- [List any issues found]

### Last Deployment
- Worker: [version hash] at [time]
- Frontend: [deployment URL]
```

## Common Issues & Fixes

| Symptom | Likely Cause | Fix |
|---------|-------------|-----|
| Bot not responding | Webhook issue | Check `npx wrangler tail` |
| 500 on API | Worker error | Check logs with `wrangler tail` |
| D1 errors | Schema mismatch | Run pending migrations |
| Frontend 404 | Pages deployment issue | Redeploy frontend |
| Quota not resetting | `daily_question_logs` bug | Check `reset_at` logic in `premium.ts` |

## Important Rules
- Always check the worker logs first for API errors
- D1 commands use `--remote` flag for production
- Be specific about what works vs what doesn't
- If one thing is down, continue checking the others
