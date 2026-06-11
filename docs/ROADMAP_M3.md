# EduBot Roadmap — Handoff for MiniMax M3

> **North star:** every student who follows the bot's lessons measurably improves
> their score in a short time (target: +0.5 IELTS band / +8–12 TOEFL iBT points /
> +50–80 TOEIC points within 30 days of consistent use).
>
> Written 2026-06-11 as a continuation handoff. Read `CLAUDE.md` first, then
> `docs/MASTER_PLAN.md` (strategy + what's already shipped), then this file
> (what to build next, in order). `docs/BUGS.md` is the bug ledger — keep it
> updated and run `tsc --noEmit` + `vitest run` in `worker/` before every deploy.

---

## 0. State of the system (as of this handoff)

**Shipped & live** (commits `0466695` → `4a605cf`):
- Reseller commission system end-to-end (codes, attributions, soft caps, audit, payouts) — migrations 088–092
- Thread-style lesson format + 4 exam personas (iBT/ITP/IELTS/TOEIC voices)
- Diagnostic bank in D1 (093) with per-topic random variants
- Failed comprehension checks → FSRS review deck
- Tolerant listen-and-repeat scoring (`worker/src/services/speech-match.ts`)
- Badge showcase in mini app; `/today` with streak/mastery/progress-bar
- Daily API cost alert in SLO cron
- Bulk content generator fixed (boilerplate-aware copy guard) — TOEIC/iBT buckets being filled

**Key architecture facts:**
- Cloudflare Worker (Hono) + D1 + R2 + Pages mini app (React/Vite/Zustand/Tailwind)
- All AI calls: OpenAI gpt-4o-mini (chat/scoring), Whisper (STT), TTS-1 (audio)
- FSRS via ts-fsrs in `fsrs-engine.ts`; mental model in `mental-model.ts`;
  lesson plans in `lesson-engine.ts`; live tutor in `private-tutor.ts`
- IRT engine EXISTS (`irt-engine.ts`) but is underused — big lever, see §2.1
- Cron slots are subrequest-budget-constrained (50/invocation) — don't pile
  new work into the `30 * * * *` slot

**Blocked/pending items from MASTER_PLAN:**
- Re-engagement campaign (script ready, needs human "go")
- IELTS reading/listening content (too thin to few-shot; needs seeding, §3.2)
- Writing/speaking calibration study (§1.4)
- i18n framework for the mini app

---

## 1. THE SCORE ENGINE — make improvement measurable and guaranteed

The promise "ikuti lesson-nya, skor naik" needs a closed measurement loop.
This is the highest-priority epic.

### 1.1 Score prediction model
- New service `score-predictor.ts`: estimate the student's current scaled score
  per exam from (diagnostic result, rolling practice accuracy by section,
  IRT ability estimate θ, FSRS retention). Start with a transparent linear
  blend; store weekly snapshots in `score_estimates (user_id, test_type,
  estimated_score, confidence, snapshot_date)`.
- Surface in `/progress` and the mini app: "Estimasi skor kamu: IELTS 5.5 →
  target 6.5. Gap: Writing Task 2 + vocabulary."
- Acceptance: estimate visible to every active student; recomputed weekly by
  cron; backtest against students who later take a real mock test.

### 1.2 Before/after proof loop
- Monthly auto-prompted mock test (mini-mock: 40 min, section-weighted).
  Compare to the previous mock → "Naik +0.5 band dalam 4 minggu 📈".
- Store in `mock_test_history`; this is also the marketing proof engine
  (anonymized aggregate: "rata-rata murid naik X dalam 30 hari").
- Acceptance: a student active ≥30 days has ≥2 mock points and sees a delta.

### 1.3 Weakness-to-lesson router (close the loop)
- Today weakness analysis exists (`weakness-analysis.ts`) but lesson plans
  don't strictly consume it. Build `gap-router.ts`: every Monday, take the
  top-3 score-blocking weaknesses (weighted by section weight in the target
  exam) and inject them as the week's lesson-plan steps. The /today lesson
  must always be the *highest score-leverage* item, not the next item in a
  static syllabus.
- Acceptance: for any student, you can answer "why is THIS today's lesson?"
  with a logged reason ("inference = 22% of your target section, your accuracy
  41%, expected gain +0.3 band").

### 1.4 Scoring calibration (trust)
- Collect 20 writing + 20 speaking samples; human-grade (hire 1 IELTS/TOEFL
  examiner, ~$200) vs GPT rubric. Compute correlation + bias per dimension.
  Tune rubric prompts until r ≥ 0.75, then publish "akurasi ±0.5 band".
- Add drift monitor: weekly re-score of 5 fixed anchor essays; alert if a
  dimension drifts >0.5 from its anchor value.

### 1.5 Spaced-repetition compliance pressure
- FSRS only works if reviews happen. Add a "review debt" metric (overdue cards
  × average importance). At debt > threshold: /today opens with review-first,
  streak bonus XP doubles for clearing debt, companion nudges escalate.
- Acceptance: median review-completion rate of due cards > 60%.

---

## 2. ADAPTIVE DIFFICULTY — right question at the right moment

### 2.1 Activate the IRT engine
- `irt-engine.ts` computes item difficulty/discrimination but selection still
  uses exposure-aware random. Implement ability-matched selection: pick items
  with difficulty within ±0.5 of student θ (maximally informative). Blend:
  70% ability-matched, 20% review, 10% stretch.
- Recompute θ per section after each session; store on `users` or a
  `student_ability` table.
- Acceptance: average per-question correctness converges to 60–75% (the
  desirable-difficulty zone) for active students.

### 2.2 Smart session length
- Detect fatigue: accuracy drop >20% within a session OR response time 2×
  baseline → tutor proposes a break ("Otak kamu udah kasih sinyal — 5 soal
  terakhir melambat. Break dulu, nanti lanjut."). Log to validate.

### 2.3 Pre-test taper plan
- When a student sets a real exam date (`/settings` → add exam_date field):
  auto-build a taper: heavy practice until D-7, mock at D-7, weakness patching
  D-6..D-2, light review + confidence material D-1. Daily countdown framing
  in /today ("H-12 menuju IELTS kamu").

---

## 3. CONTENT DEPTH — finish the 4-exam promise

### 3.1 Verify + extend the bulk-generated buckets
- After the current generation run: re-run the variety audit; every bucket
  ≥80% of target minimums (`ai-generate.ts:253` table). Spot-check 10 random
  published AI items per bucket manually.

### 3.2 IELTS seeding strategy (the hard one)
- Hand-write (or commission) 5 full IELTS reading passage sets + 5 listening
  scripts with questions — these become few-shot seeds. Then constrained
  generation: "base structure on these, new topic each time." Target 60+
  items per section within 2 weeks.
- Listening: generate scripts → multi-speaker TTS (already supported) →
  verify per-sub audio_filename population (known gap, BUGS audit).

### 3.3 Strategy lessons as first-class content
- Score gains in short time come MORE from test strategy than English level.
  Build a `strategy_lessons` track per exam: time management per section,
  question-type playbooks (TF/NG decision tree, Part 5 elimination order,
  integrated-writing template), guessing strategy. 3–5 thread-lessons per
  exam, hardcoded quality (not AI-generated), injected early in every plan.

### 3.4 Vocabulary high-frequency lists
- AWL + exam-specific frequency lists (TOEIC business 600, IELTS topic
  vocab) as FSRS card packs; daily 5-card drip in /today.

---

## 4. ACCOUNTABILITY & MOTIVATION — they only improve if they show up

- **Study squads (MASTER_PLAN 5.3):** 3–5 friends, squad streak, mutual
  visibility ("Budi udah latihan, kamu belum 👀"). Tables: `squads`,
  `squad_members`. Squad weekly recap post.
- **Commitment contract:** student pledges a target ("IELTS 6.5 by August")
  publicly to their squad; bot tracks and celebrates milestones.
- **Shareable progress cards (5.1):** SVG→PNG score-delta cards with referral
  code baked in. Worker-side render (satori or manual SVG), R2 storage.
- **Tantangan Nasional (5.4):** monthly synchronized mock event, real-time
  leaderboard, certificates. Reuses classroom quiz infra.

---

## 5. INTEGRATIONS (in priority order)

| Integration | Purpose | Cost/notes |
|---|---|---|
| **WhatsApp Business Cloud API** | Reminders + re-engagement + (later) lesson mirror. Telegram is niche in Indonesia; WA is where students live. | Free tier for service convos; template messages ~$0.02 |
| **Google Calendar API** | Exam-date sync + study-block reminders for the taper plan | Free |
| **Xendit / Flip for Business** | Automated IDR disbursement for reseller payouts (replaces manual bank batches) | Per-payout fee, no subscription |
| **Google Cloud STT (id-EN accent hints)** | Fallback for Indonesian-accented speaking eval where Whisper fails | $0.006/15s, only on Whisper low-confidence |
| **ElevenLabs or OpenAI TTS-1-HD** | Natural listening audio for premium sets | ~2× current TTS cost, gate to premium |
| **Notion (already wired)** | Keep partner/ops sync; don't expand | — |
| **PostHog (free tier)** | Funnel analytics: lesson→retention→conversion cohorts | Free <1M events |
| **Midtrans/Tripay (already wired)** | Keep QRIS path; add auto-reconcile cron | — |

---

## 6. EXECUTION ORDER FOR M3 (8-week suggested sequence)

| Week | Epic | Deliverables |
|---|---|---|
| 1 | 1.1 + 1.3 | score-predictor.ts + gap-router.ts; /progress shows estimate + gap |
| 2 | 2.1 | IRT ability-matched selection live; convergence dashboard |
| 3 | 3.3 + 3.4 | Strategy lesson track (all 4 exams) + vocab card packs |
| 4 | 1.2 + 2.3 | Monthly mini-mock loop + exam-date taper plans |
| 5 | 3.2 | IELTS seed content + constrained generation to 60+/section |
| 6 | 4 (squads + cards) | Study squads + shareable progress cards |
| 7 | 5 (WA + calendar) | WhatsApp reminders + exam-date calendar sync |
| 8 | 1.4 + 1.5 | Calibration study + review-debt mechanics; publish accuracy claim |

**Working agreements (non-negotiable):**
1. Migration → `tsc --noEmit` (worker+frontend) → `vitest run` → deploy → verify health → update BUGS.md.
2. All student-facing copy: Bahasa Indonesia, "Aku/kamu", no markdown in bot messages, thread style for teaching chunks (see `private-tutor.ts` FORMAT rules).
3. Never break the [CHECK]/[AUDIO]/[VISUAL] tag contracts — they're parsed.
4. Money paths (commission, premium) require tests before deploy.
5. Measure every feature against the north star: does it raise score-per-week
   for compliant students? If unmeasurable, add the measurement first.

---

## 7. SUCCESS METRICS (review weekly)

- **Primary:** median score-estimate delta per 30 active days (target +0.5
  band equivalent); % of 30-day-active students with positive delta (>80%).
- Compliance: D7 retention ≥35%, review-completion ≥60%, lesson completion ≥70%.
- Trust: scoring correlation r ≥ 0.75 vs human; <5 content reports/week.
- Business: free→paid ≥4%; reseller-attributed share ≥40%; CAC via shares ↓.
