# Channel Goals — Small Addictive Learning Bites

> Channel: @TOEFL_IELTS_Indonesia. North star: **every post is a screenshot-worthy
> bite that ends with a reason to come back tomorrow.** Turn a broadcast feed
> into a habit loop that funnels to the bot.

## Audit verdict (2026-06-13)
Channel posts daily vocab/quiz/grammar/idiom/CTA on cron. Solid visual rhythm
(dividers, emoji, CTAs) BUT: standalone one-offs, no series, no native polls,
text-only, comment-hooks go nowhere, and a formatting bug showed literal
asterisks (`*word*` sent as HTML). Engagement = passive scroll.

## Ambitious targets per content type
| Type | Target | Mechanic |
|---|---|---|
| Quiz | tap-to-vote, instant % + answer reveal | **Native Telegram quiz poll** (sendPoll) — replaces dead "comment your answer" |
| Series | 60%+ of viewers return next day | **Multi-day micro-series** with cliffhangers ("Besok: …") = habit loop |
| Vocab/idiom/grammar | screenshot-worthy single-concept card | bite-size: ONE idea, *bold* key term, ≤10 lines |
| Every post | ends with hook or CTA to bot | no dead ends |
| Formatting | real bold/italic, never literal `*` | channelMarkdownToHtml (shipped) |

## Shipped
- **Formatting fix** (`c59a6d6`): channel `*bold*`/`_italic_` now render via
  channelMarkdownToHtml + plain-text fallback; bot lesson prompts now emit bold.

## Building (workflow)
- **Native poll quizzes** — channel-poll.ts: sendPoll type:quiz, correct answer
  + explanation revealed after vote, anonymous. Daily, additive to morning slot.
- **Micro-series** — channel-series.ts + migration 102: 3-4 themed multi-day
  threads ("5 Hari Kuasai Articles", "7 Kesalahan Grammar Orang Indonesia", …),
  state-tracked, each part one concept + cliffhanger. Daily evening anchor.

## Next (future)
- Date-stamped blog slugs (archive/resurface past content)
- Image cards for vocab (imagePrompt already generated, unused)
- Themed weeks / difficulty curve
- Channel-comment → bot feedback loop
- Telegram reactions as engagement signal
