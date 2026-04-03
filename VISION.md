# VISION.md — Product & Business Context

## What this product is trying to become
EduBot should become the most trusted AI-powered TOEFL/IELTS prep platform for Indonesian students. Not the flashiest — the one that actually gets people score improvements. A student should be able to say "I used EduBot for 2 months and went from Band 3 to Band 4.5" and mean it.

## Who uses this and what they struggle with
Indonesian intermediate English learners preparing for TOEFL or IELTS. They can't afford expensive courses but have a phone and 30 minutes a day. They struggle with: not knowing if their speaking pronunciation is understandable, feeling stuck without a teacher to correct them, running out of practice questions, and losing motivation when they don't see score progress. Their workaround is watching YouTube and hoping. They'd recommend EduBot if it actually helped them pass their test.

## What success looks like in 12 months
- 1,000 paying premium subscribers
- Average Band score improvement of 0.5–1.0 among active users who complete 30+ days
- `@TOEFL_IELTS_Indonesia` channel with 10,000+ engaged followers
- Speaking evaluation latency under 5 seconds
- Zero downtime months
- 5 corporate or institution clients using EduBot as a study tool

## What you are afraid of
That we build a polished platform but the questions are mediocre — explanations are missing, formats don't match real tests, and students feel like they're practicing the wrong thing. That a better-funded competitor copies the Telegram Mini App approach and wins on marketing budget. That the AI scoring confidence is wrong and students trust it too much. That Cloudflare costs spike unexpectedly as user base grows.

## What you refuse to compromise on
- Questions must have real explanations — not just "this is the answer." If we don't have a good explanation, we use AI to generate one.
- We will not sell dream scores. If a student's English level means Band 3 is realistic, we say so.
- The free tier must be genuinely useful — 10 questions a day that teach something real.
- Every feature must work on a low-end Android phone on 3G. No heavy web apps.
- We do not take shortcuts on AI quality to save API costs. Accuracy over margin.

## Current biggest bottleneck
Content quality — most imported questions have empty explanations, and the teacher workflow to fix this hasn't been fully built. Students hit the free quota fast but the learning value per question is inconsistent.

## The moat — what makes this hard to copy
- Indonesian learner error patterns captured in the spaced repetition data
- Channel `@TOEFL_IELTS_Indonesia` with 6,000+ followers already built
- Speaking evaluation model trained on Indonesian-accented English specifically
- Referral network of 100+ students who invited friends (organic growth engine)
- Zero infrastructure cost thanks to Cloudflare free tier — we can price at Rp 99k/month and still have margin
