# EduBot Ship QA Checklist

This document is the **canonical pre-ship checklist** for EduBot. Every release must complete all sections before merging to main or deploying to production.

---

## 🚨 Pre-Ship Requirements

All items below must pass before any deployment.

### 1. Content Validation (Automated via CI)

```bash
# Run content validator in publish mode
cd worker && npx tsx src/services/content-validator.ts --mode=publish

# Run duplicate audit
node scripts/duplicate_audit.mjs

# Run content spotcheck (sample 50 questions)
node scripts/content_spotcheck.mjs --count=50

# Check for broken audio URLs
node scripts/inspect_broken_listening.mjs
```

**Acceptance criteria:**
- 0 critical errors in content validator
- 0 duplicate questions
- ≥90% pass rate on spotcheck
- 0 broken listening audio URLs

---

### 2. TypeScript Compilation (Automated via CI)

```bash
# Worker
cd worker && npx tsc --noEmit

# Frontend
cd frontend && npx tsc --noEmit
```

**Acceptance criteria:**
- 0 TypeScript errors in both worker and frontend

---

### 3. Unit Tests (Automated via CI)

```bash
# Worker
cd worker && npm test

# Frontend
cd frontend && npm test -- --passWithNoTests
```

**Acceptance criteria:**
- All worker tests pass
- Frontend tests pass or have 0 tests (passWithNoTests)

---

## 🧪 Manual QA - Team Review

Each team member signs off on their section. All items must be checked.

---

### Section A: Content QA (Content Team)

| # | Check | Tester | Date | Status |
|---|-------|--------|------|--------|
| A1 | Reading questions (5 random) - content accurate, answer key correct | | | |
| A2 | Listening questions (5 random) - audio plays, transcript accurate | | | |
| A3 | Speaking prompts (3 random) - scoring rubric aligned | | | |
| A4 | Writing prompts (3 random) - sample answer meets band 5 criteria | | | |
| A5 | TOEFL ITP questions (5 random) - proper format, answer key correct | | | |
| A6 | IELTS questions (5 random) - proper format, CEFR alignment correct | | | |
| A7 | TOEIC questions (5 random) - proper format, audio sync | | | |
| A8 | Explanation coherence - explanation matches correct answer | | | |
| A9 | No Indonesian/Chinese characters in English content | | | |
| A10 | Question difficulty ratings align with actual difficulty | | | |

---

### Section B: Bot Commands QA (Bot Team)

| # | Check | Tester | Date | Status |
|---|-------|--------|------|--------|
| B1 | `/start` - main menu appears within 5s | | | |
| B2 | `/study` - 22 topics display correctly | | | |
| B3 | `/diagnostic` - 20 questions flow works | | | |
| B4 | `/today` - lesson generates and displays | | | |
| B5 | `/review` - FSRS review items shown | | | |
| B6 | `/lesson [topic]` - lesson generates | | | |
| B7 | `/profile` - mental model displays | | | |
| B8 | `/premium` - pricing matches Stars rates | | | |
| B9 | `/referral` - code generates, share works | | | |
| B10 | `/redeem [code]` - redemption works | | | |
| B11 | `/shop` - coin items display, purchase works | | | |
| B12 | `/leaderboard` - XP rankings display | | | |
| B13 | `/league` - league info + promotion status shows | | | |
| B14 | `/gencodes 5 30 testbatch` - codes generate | | | |
| B15 | `/join [CODE]` - class join works | | | |
| B16 | Teacher `/broadcast` - message sends to all | | | |
| B17 | AI Tutor chat - responses are correct English | | | |

---

### Section C: Mini App QA (Frontend Team)

| # | Check | Tester | Date | Status |
|---|-------|--------|------|--------|
| C1 | Test selection - all test types visible | | | |
| C2 | Start test - timer starts, questions load | | | |
| C3 | Answer question - selection registers | | | |
| C4 | Submit answer - moves to next question | | | |
| C5 | Finish test - scoring works | | | |
| C6 | View results - scores display correctly | | | |
| C7 | Answer review - explanations show | | | |
| C8 | Quota bar - shows remaining (free user) | | | |
| C9 | Lock screen - appears at quota limit | | | |
| C10 | Progress page - stats display correctly | | | |
| C11 | Speaking recorder - audio captures | | | |
| C12 | Audio playback - TTS plays correctly | | | |
| C13 | Error boundary - graceful error handling | | | |
| C14 | Dark mode - styles apply correctly | | | |
| C15 | Mobile layout - responsive on 375px width | | | |

---

### Section D: AI Workers QA (AI Team)

| # | Check | Tester | Date | Status |
|---|-------|--------|------|--------|
| D1 | Essay scoring - same essay → consistent ±0.5 band | | | |
| D2 | Essay scoring - different essays → different scores | | | |
| D3 | Speaking eval - same audio → consistent ±0.5 band | | | |
| D4 | Speaking eval - transcript accurate | | | |
| D5 | AI Tutor - responds in Indonesian mix | | | |
| D6 | AI Tutor - no hallucinated grammar rules | | | |
| D7 | AI Tutor - motivation responses appropriate | | | |
| D8 | Weakness analysis - student 14 profile generates | | | |
| D9 | Lesson generation - topic "grammar" → grammar content | | | |
| D10 | Bulk content gen - 10 questions generate + pass validator | | | |

---

### Section E: Payment & Premium QA (Revenue Team)

| # | Check | Tester | Date | Status |
|---|-------|--------|------|--------|
| E1 | `/premium` - 7/30/90/180/365 day prices correct | | | |
| E2 | `/buy` - Telegram Stars payment initiates | | | |
| E3 | Post-payment - premium activates within 1 min | | | |
| E4 | Redemption code - `/redeem` activates premium | | | |
| E5 | Premium features unlock - unlimited questions | | | |
| E6 | Referral bonus - +5 questions apply | | | |
| E7 | Coin purchase - streak_freeze activates | | | |
| E8 | Price consistency - bot matches API `/premium/options` | | | |

---

### Section F: Infrastructure QA (DevOps Team)

| # | Check | Tester | Date | Status |
|---|-------|--------|------|--------|
| F1 | Health endpoint - `GET /api/health` returns 200 | | | |
| F2 | Deep health - `GET /api/health/deep` passes all checks | | | |
| F3 | Worker tail - no ERROR level logs in last hour | | | |
| F4 | D1 queries - no slow query warnings | | | |
| F5 | TTS caching - same text reuses cached audio | | | |
| F6 | Cron triggers - daily reminders send at 8 AM WIB | | | |
| F7 | Channel posts - hourly rotation working | | | |
| F8 | Migration status - all migrations applied to D1 | | | |
| F9 | R2 bucket - audio files accessible | | | |
| F10 | API cost tracking - costs logged correctly | | | |

---

## 📋 Sign-Off Section

### Content Team
| Role | Name | Signature | Date |
|------|------|-----------|------|
| Content Lead | | | |
| Content QA | | | |

### Bot Team
| Role | Name | Signature | Date |
|------|------|-----------|------|
| Bot Lead | | | |
| Bot QA | | | |

### Frontend Team
| Role | Name | Signature | Date |
|------|------|-----------|------|
| Frontend Lead | | | |
| Frontend QA | | | |

### AI Team
| Role | Name | Signature | Date |
|------|------|-----------|------|
| AI Lead | | | |
| AI QA | | | |

### Revenue Team
| Role | Name | Signature | Date |
|------|------|-----------|------|
| Revenue Lead | | | |
| Revenue QA | | | |

### DevOps Team
| Role | Name | Signature | Date |
|------|------|-----------|------|
| DevOps Lead | | | |
| DevOps QA | | | |

---

## 🚀 Release Approval

| Role | Name | Signature | Date |
|------|------|-----------|------|
| Tech Lead | | | |
| Product Owner | | | |
| Release Manager | | | |

**Version:** _________________

**Deployment Date:** _________________

**Deployment Target:** [ ] Staging [ ] Production

---

## 📞 Emergency Contacts

| Role | Name | Phone | Telegram |
|------|------|-------|----------|
| Tech Lead | | | |
| On-Call Dev | | | |
| CI/CD Owner | | | |

---

## 🐛 Bug Report Process

If a bug is found during QA:
1. Block the release
2. Log issue in GitHub: https://github.com/leonardusbayu/osee-edubot/issues/new
3. Assign priority (P0/P1/P2)
4. Fix or defer with documented reason
5. Re-run affected QA section
6. Get sign-off from section lead
