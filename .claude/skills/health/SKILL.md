---
name: health
description: Deep system monitoring and diagnostics — analyzes D1 query performance, API costs, worker errors, and user-facing issues.
---

# Health Skill

You perform deep diagnostics on the EduBot system. Use this when status shows issues or when doing regular maintenance.

## Diagnostic Areas

### 1. API Cost Analysis
Check OpenAI API usage:
```bash
npx wrangler d1 execute edubot-db --remote --command="SELECT service, endpoint, SUM(tokens_used) as total_tokens, SUM(cost_usd) as total_cost FROM api_usage GROUP BY service, endpoint ORDER BY total_cost DESC LIMIT 20"
```

Check for:
- Unusually high TTS usage (caching should reduce this)
- Many AI tutor calls per user
- Expensive GPT-4 calls that could use GPT-3.5

### 2. Database Performance
Check slow queries:
```bash
npx wrangler d1 execute edubot-db --remote --command="SELECT name FROM sqlite_master WHERE type='table'"
```
Then check row counts:
```bash
npx wrangler d1 execute edubot-db --remote --command="SELECT COUNT(*) FROM daily_question_logs"
npx wrangler d1 execute edubot-db --remote --command="SELECT COUNT(*) FROM test_attempts WHERE DATE(finished_at) = DATE('now')"
```

### 3. Worker Error Rate
```bash
npx wrangler tail --env production --format=json 2>&1 | grep -i error | head -20
```

Categorize errors:
- Auth errors (expected for unauthenticated endpoints)
- D1 errors (schema issues)
- OpenAI API errors (rate limits, invalid keys)
- Type errors (coding bugs)

### 4. User Flow Analysis
Check funnel:
```bash
# Daily active users
npx wrangler d1 execute edubot-db --remote --command="SELECT COUNT(DISTINCT user_id) FROM daily_question_logs WHERE question_date = DATE('now', '-1 day')"

# Tests started vs finished
npx wrangler d1 execute edubot-db --remote --command="SELECT COUNT(*) FROM test_attempts WHERE DATE(started_at) = DATE('now', '-1 day')"
npx wrangler d1 execute edubot-db --remote --command="SELECT COUNT(*) FROM test_attempts WHERE DATE(finished_at) = DATE('now', '-1 day')"

# Premium conversion
npx wrangler d1 execute edubot-db --remote --command="SELECT COUNT(*) FROM users WHERE is_premium = 1"
```

### 5. Quota System Health
Check free tier usage:
```bash
npx wrangler d1 execute edubot-db --remote --command="SELECT AVG(questions_answered) as avg_questions FROM daily_question_logs WHERE question_date = DATE('now', '-1 day')"
```

Check for users hitting limit:
```bash
npx wrangler d1 execute edubot-db --remote --command="SELECT COUNT(*) FROM daily_question_logs WHERE questions_answered >= 10 AND question_date = DATE('now', '-1 day')"
```

### 6. Referral System
Check referral bonuses:
```bash
npx wrangler d1 execute edubot-db --remote --command="SELECT SUM(bonus_questions) as total_bonus FROM referral_bonus_quota"
npx wrangler d1 execute edubot-db --remote --command="SELECT COUNT(*) FROM referral_bonus_quota WHERE bonus_questions > 0"
```

## Health Report Format

```
## EduBot Health Report — [Date]

### API Costs
| Service | Endpoint | Tokens | Cost |
|---------|----------|--------|------|
| ... | ... | ... | $X.XX |

### Database
- Total users: X
- Total questions: X
- Daily active users: X
- Test completion rate: X%

### Errors (last 24h)
- Total errors: X
- By type: Auth X, D1 X, OpenAI X, Other X

### Premium Stats
- Premium users: X
- Conversion rate: X%

### Quota System
- Free users hitting limit: X
- Avg questions per free user: X

### Recommendations
1. [Priority] ...
2. ...
```

## Important Rules
- Always check OpenAI costs first — they can accumulate fast
- Look for patterns, not just individual issues
- If costs spike, investigate immediately
- Keep historical comparisons (is this better or worse than last week?)
