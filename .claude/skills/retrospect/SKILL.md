---
name: retrospect
description: Sprint retrospective — reviews what was built, lessons learned, QA feedback, and plans next sprint's priorities.
---

# Retrospect Skill

You run a sprint retrospective for EduBot. Use this weekly or after major releases to reflect on progress and plan next steps.

## Retrospective Format

### 1. What Was Built (Last Sprint)

List completed features and fixes:

| Feature | Status | Notes |
|---------|--------|-------|
| Freemium quota system | ✅ Done | 10 q/day, LIMIT_REACHED, locked screen |
| Pricing fix | ✅ Done | API and bot now consistent |
| Chinese char fix | ✅ Done | "完成" → "sudah" |
| Explanation display | ✅ Done | TestRunner + TestResults |
| Review API | ✅ Done | `/attempt/:id/review` endpoint |

### 2. What Didn't Get Done

| Item | Blockers | Priority |
|------|----------|----------|
| AI summary in results | Needed GPT call, deferred | Medium |
| Extended trial beyond 1 day | Business decision needed | Low |
| Content explanations | Many questions have empty `explanation` | High |

### 3. QA Feedback Review

Review issues found during testing:

**Bugs Found:**
- Pricing inconsistency between bot and API → Fixed
- Chinese characters in Indonesian UI → Fixed

**Content Issues:**
- Questions imported with empty explanations → Need teacher review
- TOEFL format differs from actual test → Expected, documented

**UX Friction Points:**
- 1-day trial too short for meaningful evaluation → OK for now
- No explanation shown after answering → Fixed

### 4. User Feedback

Any feedback from users (from Telegram, support channel, etc.):
- [User feedback would go here]

### 5. Metrics Review

Compare to last retrospective:

| Metric | Last Week | This Week | Change |
|--------|-----------|-----------|--------|
| Premium users | X | X | +Y% |
| Daily active users | X | X | +Y% |
| API costs | $X | $X | +/-Y% |
| Tests completed | X | X | +Y% |

### 6. Next Sprint Priorities

#### Must Do (P0)
1. [Critical feature or fix]
2. [Another P0]

#### Should Do (P1)
1. [Important but not critical]
2. [Another P1]

#### Nice to Do (P2)
1. [Would be nice]
2. [Experiment or exploration]

### 7. Action Items

| Action | Owner | Due |
|--------|-------|-----|
| Run migration for new tables | Dev | ASAP |
| Review empty explanations | Teacher | This week |
| A/B test premium CTA | Dev | Next sprint |

## Key Decisions Made

- **Trial length**: 1 day is OK for initial evaluation
- **TOEFL format**: Keep current format (differs from real test but educational)
- **Quota reset**: Midnight WIB (17:00 UTC) is correct
- **Referral bonus**: +5 questions per signup, stacks infinitely, never expires

## Important Rules
- Be honest about what didn't work
- Focus on user outcomes, not just features shipped
- Keep metrics grounded in reality
- Prioritize ruthlessly — we can't do everything
- Identify blockers clearly so they can be addressed
