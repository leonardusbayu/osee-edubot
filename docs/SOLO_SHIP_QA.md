# EduBot Solo Ship QA — One-Person Checklist

Use this when you're shipping solo. Run each section in order. Block and fix if any step fails.

---

## 🚨 Pre-Flight (Automated)

These run automatically via GitHub Actions CI. If any fail, fix before proceeding.

```bash
# 1. TypeScript check
cd worker && npx tsc --noEmit
cd frontend && npx tsc --noEmit

# 2. Worker unit tests
cd worker && npm test

# 3. Worker deploys
cd worker && npx wrangler deploy
```

If CI is green, you're good. If not, fix and re-run.

---

## 🔴 Critical Checks (Must Pass)

Run these manually before any deployment:

### C1: Health Endpoint
```bash
curl https://edubot-api.edubot-leonardus.workers.dev/api/health
```
**Expected:** `{"status":"ok",...}`

### C2: Deep Health Check
```bash
curl -H "x-admin-secret: bayuganteng" https://edubot-api.edubot-leonardus.workers.dev/api/v1/admin/system/health
```
**Expected:** All checks pass

### C3: Worker Logs (Last Hour)
```bash
cd worker && npx wrangler tail --format=json 2>&1 | Select-String -Pattern "ERROR"
```
**Expected:** 0 ERROR entries

---

## 🟡 Content Checks

### D1: Content Validator (Publish Mode)
```bash
cd worker
npx tsx src/services/content-validator.ts --mode=publish 2>&1
```
**Expected:** 0 critical errors

### D2: Duplicate Audit
```bash
node scripts/duplicate_audit.mjs 2>&1
```
**Expected:** 0 duplicates found

### D3: Broken Audio Check
```bash
node scripts/inspect_broken_listening.mjs 2>&1
```
**Expected:** 0 broken URLs

### D4: Content Spotcheck (Sample 50)
```bash
node scripts/content_spotcheck.mjs --count=50 2>&1
```
**Expected:** ≥90% pass rate

---

## 🟢 Feature Checks

### E1: Bot Command Smoke Test

| Test | Command | Expected |
|------|---------|----------|
| Start | Send `/start` to bot | Main menu within 5s |
| Premium | Send `/premium` | Shows pricing in Stars |
| Help | Send `/help` | Lists all commands |
| Profile | Send `/profile` | Shows student profile |
| Leaderboard | Send `/leaderboard` | Shows top 10 |

### E2: Mini App Smoke Test

| Test | Action | Expected |
|------|--------|----------|
| Load | Open mini app | Page loads without crash |
| Test selection | Browse tests | Tests visible |
| Start test | Tap TOEFL iBT | Timer starts |
| Answer question | Tap an option | Selection registers |
| Submit | Tap Next/Submit | Moves to next |
| Finish | Complete all questions | Shows score |
| Review | View results | Explanation shows |

### E3: Quota Enforcement (Free User)
- With free account, answer 10 questions
- **Expected:** Locked screen appears at limit

### E4: Premium Flow
- Use test account, trigger purchase
- **Expected:** Premium activates within 1 min

---

## 🤖 AI Worker Checks

### F1: AI Tutor Response
Send message: "Why is my answer wrong?"
**Expected:** Response in Indonesian mix, correct English explanation

### F2: Essay Scoring Consistency
Submit same essay twice
**Expected:** Scores within ±0.5 band

### F3: Speaking Eval Consistency
Submit same audio twice
**Expected:** Scores within ±0.5 band

### F4: Weakness Profile Generation
```bash
curl -H "x-admin-secret: bayuganteng" https://edubot-api.edubot-leonardus.workers.dev/api/weakness/student/14
```
**Expected:** JSON profile returns (no 500 error)

---

## 📊 Database Checks

### G1: Migration Status
```bash
cd worker && npx wrangler d1 execute edubot-db --remote --command="SELECT COUNT(*) as cnt FROM test_contents WHERE status='published'"
```
**Expected:** 1,000+ published questions

### G2: User Count
```bash
cd worker && npx wrangler d1 execute edubot-db --remote --command="SELECT COUNT(*) FROM users"
```
**Expected:** ≥20 users

### G3: No Slow Queries
```bash
cd worker && npx wrangler d1 execute edubot-db --remote --command="SELECT AVG(duration_ms) as avg FROM d1_query_log WHERE created_at >= datetime('now', '-1 hour')"
```
**Expected:** <100ms average

---

## 🔍 Final Verification

### H1: Channel Posts
```bash
cd worker && npx wrangler d1 execute edubot-db --remote --command="SELECT COUNT(*) FROM channel_posts WHERE posted_at >= datetime('now', '-24 hours')"
```
**Expected:** ≥2 posts (morning + evening)

### H2: API Cost Check
```bash
curl -H "x-admin-secret: bayuganteng" https://edubot-api.edubot-leonardus.workers.dev/api/progress/costs
```
**Expected:** JSON with cost data

---

## ✅ Ship Sign-Off

| Check | Pass | Fail | Notes |
|-------|------|------|-------|
| CI (TypeScript + Tests) | ☐ | ☐ | |
| Health endpoint | ☐ | ☐ | |
| Deep health | ☐ | ☐ | |
| Worker logs (no errors) | ☐ | ☐ | |
| Content validator | ☐ | ☐ | |
| Duplicate audit | ☐ | ☐ | |
| Broken audio | ☐ | ☐ | |
| Bot commands work | ☐ | ☐ | |
| Mini app loads | ☐ | ☐ | |
| Test flow works | ☐ | ☐ | |
| Quota enforcement | ☐ | ☐ | |
| AI tutor responds | ☐ | ☐ | |
| Essay scoring consistent | ☐ | ☐ | |
| Speaking eval consistent | ☐ | ☐ | |
| Weakness profile works | ☐ | ☐ | |
| DB migrations applied | ☐ | ☐ | |
| Channel posts working | ☐ | ☐ | |

**Total: _____/17 passed**

---

## 🚀 Deploy

Only deploy when all 17 checks pass.

```bash
# Worker
cd worker && npx wrangler deploy

# Frontend
cd frontend && npm run build
npx wrangler pages deploy dist --project-name edubot-webapp
```

---

## 📝 Post-Deploy Verification

After deploying, run these to confirm production is healthy:

```bash
# Health check
curl https://edubot-api.edubot-leonardus.workers.dev/api/health

# Frontend loads
curl -I https://edubot-webapp.pages.dev

# Test a bot command
curl -X POST "https://api.telegram.org/bot<TOKEN>/sendMessage" \
  -d "chat_id=<YOUR_ID>&text=/start"
```

---

**Last Updated:** 2026-04-07
**Version:** 1.0