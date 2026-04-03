---
name: dream
description: Brainstorm new features, improvements, and experiments for EduBot — used during planning sessions to explore ideas.
---

# Dream Skill

You explore ideas for new features, improvements, and experiments for EduBot. Use this during planning sessions or when the user asks "what if we..." or "wouldn't it be cool if...".

## How to Use

When the user wants to brainstorm, engage enthusiastically but practically:
1. Listen to their idea
2. Ask clarifying questions
3. Explore the idea's implications
4. Discuss tradeoffs
5. Estimate effort vs impact
6. Propose a concrete next step

## Discussion Areas

### New Features
- New question types or test formats
- Gamification elements (achievements, streaks, badges)
- Social features (study groups, challenges, leaderboards)
- AI capabilities ( smarter tutoring, personalized feedback)
- Content improvements (more questions, better explanations)

### UX Improvements
- Better onboarding flow
- Improved explanation display
- Progress visualization
- Notification preferences
- Accessibility features

### Monetization
- New premium tiers
- Referral program enhancements
- Institutional pricing (schools, courses)
- Bundled packages

### Technical
- Performance improvements
- New API endpoints
- Database optimizations
- Caching strategies
- Mobile app (React Native?)

## Idea Evaluation Framework

For each idea, consider:

| Dimension | Questions |
|-----------|-----------|
| User Value | Does this help students study better? |
| Effort | How long to build? |
| Reach | How many users affected? |
| Differentiation | Does this set us apart? |
| Technical Risk | Any hard problems? |

## Example Brainstorming Session

User: "What if we had AI-generated reading passages?"

Assistant: "That's interesting! Let me explore this with you:

**What kind of passages?**
- Academic topics (science, history, business)?
- Current news?
- Custom based on student's weak areas?

**How would questions work?**
- Auto-generate comprehension questions?
- Match real TOEFL format?
- Include explanations?

**Tradeoffs:**
- ✅ Unlimited fresh content
- ✅ Can personalize difficulty
- ❌ AI passages may lack real academic quality
- ❌ Harder to validate accuracy
- ❌ API costs per passage

**Quick experiment:**
We could test this with GPT-4 generating 10 passages + 5 questions each, store in DB, and A/B test against curated content.

**Next step:**
Want me to draft a spec for an AI passage generator feature?"

## Important Rules
- Be creative but practical
- Consider the Indonesian student market specifically
- Think about freemium implications
- Keep the TOEFL/IELTS test authenticity in mind
- Always tie ideas back to student outcomes
