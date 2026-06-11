# EduBot Master Plan — Menjadi Chatbot #1 Belajar Bahasa Inggris di Indonesia

> Created 2026-06-11 from a 4-track deep audit (lessons, monetization/reseller,
> content bank, platform health). This is the plan-before-build document.
> Status: **AWAITING APPROVAL — no code changes yet.**

---

## Part 1 — Audit Verdict (where the base actually stands)

| Track | Grade | One-line verdict |
|---|---|---|
| Teaching/lessons | C+ | Solid pedagogy plumbing (FSRS, comprehension checks, mental model) but lessons read terse/robotic, not the fun thread-style we want. TOEIC has no real identity; diagnostic is 25 frozen questions. |
| Monetization & reseller | B- | More built than documented: full reseller commission ledger (20%, 7-day hold, payouts, dashboard API) exists in migrations 088–090. But code redemptions track zero commission, soft caps never enforced, Stars payout isn't actually transferred, no KYC. |
| Content bank | C | iBT is healthy; IELTS reading/listening ~93% below target, TOEIC reading ~85% below, iBT writing 75% below. Speaking eval uses fragile string-matching; Whisper struggles with Indonesian accents. |
| Platform health | B+ | Zero open bugs, mature gamification/leagues, good SLO monitoring. But: companion nudges built-never-wired, re-engagement campaign (6K OSEE leads, ~Rp 1jt/minggu potential) written but never launched, no i18n framework. |

### Five things blocking #1-in-Indonesia status
1. **The lessons don't feel like the product we're selling.** Capped at 8–10 plain lines, identical templated voice for everyone, no Indonesian cultural framing.
2. **Two of four exams are hollow.** TOEIC = TOEFL with a different label; IELTS content too thin to even few-shot-generate from.
3. **Reseller economics are 70% built but the money doesn't flow.** Teacher-sold redemption codes (the actual reseller channel today) generate no tracked commission; payouts are manual fiction.
4. **Growth machinery sits idle.** Re-engagement campaign + companion nudges are finished code that's never been switched on.
5. **Quality of AI evaluation is unaudited.** Writing/speaking band scores have unknown correlation with real exam scores — dangerous for reputation when students compare to real results.

---

## Part 2 — Brainstorm: what "Indonesia's #1 English chatbot" needs

### A. The lesson experience (the moat)
- **"Thread-style" lesson format** — rewrite delivery as serialized thread posts: hook → story → concept → 3 contoh lokal → mini-quiz → cliffhanger ke part berikutnya. 15–20 lines, Mojok/Twitter-thread energy, bahasa gaul yang sopan.
- **Indonesian-first narrative bank** — examples set in: interview kerja di Tokopedia, chat sama bule di Bali, ngurus beasiswa LPDP, email HRD, ojol scenarios. (LPDP/beasiswa angle is the killer motivator — most Indonesian TOEFL/IELTS takers do it for scholarships/jobs.)
- **Exam personas** — 4 distinct tutor voices: iBT (academic kakak tingkat), ITP (grammar drill sergeant yang lucu), IELTS (British-flavored mentor), TOEIC (office senior yang relatable).
- **Inspiration layer** — every lesson closes with a "kenapa ini penting" tied to real goals (skor target → kampus impian/kerja), plus success-story snippets.
- **Lesson → SRS loop** — failed comprehension checks auto-enqueue into FSRS review (currently forgotten after the lesson).

### B. Content depth
- Fill TOEIC reading (pure MCQ — cheapest win), iBT writing prompts (manual+AI hybrid), IELTS via tightly-constrained generation seeded by hand-written passages.
- Migrate the diagnostic to D1 with AI-generated variants (kill the memorization problem).
- Upgrade listen-and-repeat scoring from string match to phonetic alignment; add Indonesian-accent STT hints.

### C. Monetization & reseller (the growth engine)
- **Unify the two code systems**: premium_codes redemption must create a commission attribution (codes are prepaid → instant confirm, no 7-day hold).
- **Reseller bot UX**: `/reseller` command suite (stats, kode saya, earnings, payout request) so resellers never need the admin API.
- **Tiered commission** (15% trial → 20% standard → 25% volume) in a DB table, not hardcoded.
- **Enforce soft caps + clawback for already-paid** attributions; add a simple KYC row (bank account, optional tax ID) before first bank payout.
- **Payout rails**: bank transfer batch (manual admin confirm, already scaffolded) as primary; Stars payout secondary. Suggested third-party: **Xendit or Flip for Business** disbursement API to automate bank payouts later (Phase 3, optional subscription ~free tier first).

### D. Growth
- **Launch the re-engagement campaign now** (scripts/reengagement.py + WhatsApp Business) — highest ROI item in the whole audit, zero new code.
- Wire `maybeAppendNudge()` into /today, /review, and test-finish flows.
- Channel content already runs hourly — add reseller-code CTAs to channel posts.
- Optional third-party: **WhatsApp Business Cloud API** (Meta, ~free for service convos) as second channel; **Mixpanel/PostHog free tier** for funnel analytics if D1 analytics proves insufficient.

### E. Trust & quality
- Calibration study: 15–20 real essays human-graded vs GPT; publish "akurasi ±0.5 band" claim only if correlation ≥0.7.
- Cost alert (daily spend threshold → admin ping).
- i18n pass on mini app (react-i18next, id-ID default).

---

## Part 3 — The Build Plan (4 phases, ~6–8 weeks)

### Phase 1 — "Money flows + growth on" (Week 1) 🔥 highest ROI, lowest effort
| # | Task | Files | Effort |
|---|---|---|---|
| 1.1 | Commission attribution on `/redeem` (bridge table + webhook patch) | migration 091, webhook.ts, premium-codes.ts | 1d |
| 1.2 | `/reseller` bot command (stats, codes, earnings, request payout) | webhook.ts + referral-commission.ts | 1–2d |
| 1.3 | Enforce soft caps + clawback-after-paid handling + commission audit log | referral-commission.ts, migration 092 | 1d |
| 1.4 | Wire companion nudges into /today, /review, test finish | webhook.ts | 0.5d |
| 1.5 | Launch re-engagement campaign (dry-run → real send) | scripts/reengagement.py | 0.5d |
| 1.6 | Cost alert in hourly SLO cron | op-slo.ts | 0.5d |

### Phase 2 — "Lessons people screenshot" (Weeks 2–3) — the product moat
| # | Task | Files | Effort |
|---|---|---|---|
| 2.1 | Thread-style lesson format: lift 8-line cap, new structure (hook→story→concept→contoh→quiz→teaser) | teaching.ts, private-tutor.ts | 2d |
| 2.2 | 4 exam personas (esp. TOEIC workplace voice) | teaching.ts prompt split per test | 2d |
| 2.3 | Indonesian analogy/scenario bank (LPDP, HRD email, Bali, ojol) | indonesian-analogies.ts (complete it) | 2d |
| 2.4 | Inspiration layer: goal-tied closers + /today enrichment (streak, why-this-matters, progress bar) | studyplan.ts, lesson-engine.ts | 1d |
| 2.5 | CQ failures → FSRS deck (`buildCqReviewDeck`) | fsrs-engine.ts, comprehension-check.ts | 1.5d |
| 2.6 | Explicit misconception callouts at lesson start | private-tutor.ts | 0.5d |

### Phase 3 — "All 4 exams for real" (Weeks 4–5)
| # | Task | Effort |
|---|---|---|
| 3.1 | TOEIC reading bulk-gen: 50 text_completion + 50 reading_comprehension, publish ≥80 | 1d + ~$10 |
| 3.2 | iBT writing: 30 integrated prompts (hand-written passages + AI questions) | 3d |
| 3.3 | IELTS: 5 hand-seeded passage sets → constrained generation to 60+ items | 4d |
| 3.4 | iBT speaking: +30 listen_and_repeat, +30 take_interview | 1d |
| 3.5 | Diagnostic → D1 table + variant generation | 2d |
| 3.6 | Fix grouped-listening per-sub audio + phonetic listen-and-repeat scoring | 2d |

### Phase 4 — "Polish & trust" (Weeks 6–8)
| # | Task | Effort |
|---|---|---|
| 4.1 | Writing/speaking calibration study (human vs GPT, 20 essays) | 2d |
| 4.2 | i18n framework, id-ID default | 3d |
| 4.3 | Badge UI in mini app + unlock celebration | 2d |
| 4.4 | Reseller KYC table + bank payout completion flow; evaluate Xendit/Flip disbursement | 3d |
| 4.5 | Split hourly cron budget; mobile Lighthouse QA; cleanup temp dirs | 2d |

### Workflow per task (every phase)
1. Migration first (remote D1) → 2. implement → 3. `tsc --noEmit` both packages → 4. deploy worker/pages → 5. verify per SHIP_QA_CHECKLIST → 6. update BUGS.md/close issues.

### Success metrics
- **Phase 1**: first commission attribution recorded; re-engagement sends out; nudges appearing in messages.
- **Phase 2**: lesson length 15–20 lines, ≥1 Indonesian scenario per lesson, D7 retention up.
- **Phase 3**: every exam/section ≥ 80% of target minimums; diagnostic retake shows different questions.
- **Phase 4**: published band-accuracy claim; payout completed end-to-end for a real reseller.

## Part 4 — The Bigger Goal: Indonesia's #1 English-Learning Chatbot

Phases 1–4 make EduBot *excellent*. Phases 5–7 make it *dominant*.

### Phase 5 — Virality & community (Weeks 9–12)
| # | Initiative | Why |
|---|---|---|
| 5.1 | **Shareable lesson cards** — every completed lesson/test generates a beautiful score-card image (via worker-side SVG→PNG) the student can post to IG story/WA status, with reseller/referral code baked in | Free distribution; Indonesian students share achievement heavily |
| 5.2 | **Public streak & league pages** — link-previewable profile (`edubot.../u/budi`) showing streak, league, target score | Social proof loop |
| 5.3 | **Study squads** — 3–5 friends form a squad; squad streak, squad leaderboard, group accountability nudges ("Budi udah latihan, kamu belum 👀") | Duolingo's most retentive feature, adapted to Indonesian collectivist study culture |
| 5.4 | **Tantangan Nasional** — monthly nationwide mock-test event with real-time ranking, certificates, prizes (premium days) | PR moment + acquisition spike each month |
| 5.5 | **Creator/teacher program** — top teachers get revenue-share content slots; their name on questions/lessons | Content scale + their audience becomes ours |

### Phase 6 — B2B & institutional (Weeks 12–16)
| # | Initiative | Why |
|---|---|---|
| 6.1 | **Sekolah/Kampus dashboard** — class-level analytics, bulk premium seats, school-branded leaderboards (extends existing classes + admin API) | Schools pay better than students; one deal = 100s of users |
| 6.2 | **LPDP/beasiswa track** — packaged "Jalur Beasiswa" curriculum (IELTS 6.5/TOEFL 550 targets, timeline-based study plan, deadline reminders synced to scholarship calendars) | The single biggest motivation segment in Indonesia |
| 6.3 | **Corporate TOEIC packages** — HR dashboard, employee cohorts, completion reports | TOEIC is corporate; sell where it lives |
| 6.4 | **Reseller agency tier** — resellers can recruit sub-resellers (1 level only), 5% override commission | Scales the reseller network itself |

### Phase 7 — Platform expansion (Weeks 16+)
| # | Initiative | Why |
|---|---|---|
| 7.1 | **WhatsApp bot** (Cloud API) — mirror core commands (/today, lessons, quiz) on WA where >90% of Indonesians already live | Telegram is a niche in Indonesia; WA is the country |
| 7.2 | **Voice-first speaking coach** — daily 2-minute speaking prompt via voice note, scored with accent-aware STT, prosody feedback | Speaking is the scariest skill; daily low-stakes practice is the cure |
| 7.3 | **AI essay clinic** — submit a photo of handwritten essay → OCR → scored with inline corrections | Bridges offline study habits |
| 7.4 | **Web app (non-Telegram)** — SEO-indexed blog (already live) + free diagnostic as lead magnet → funnel to bot | Owns the "tes TOEFL gratis" search traffic |

### North-star metrics
- **#1 claim basis**: 100K MAU, 5K paying, 500 active resellers, 50 school partnerships, top-3 App-store-of-Telegram ranking for "TOEFL/IELTS Indonesia".
- Weekly tracking: D7 retention ≥ 35%, free→paid ≥ 4%, reseller-attributed revenue ≥ 40% of total, lesson share-rate ≥ 10%.

---

### Third-party / subscription suggestions (all optional, ordered by value)
1. **WhatsApp Business Cloud API** (Meta) — re-engagement + reminders channel. Free tier covers service messages.
2. **Xendit / Flip for Business** — automated IDR disbursement for reseller payouts (Phase 4). Pay-per-disbursement, no subscription needed initially.
3. **ElevenLabs or OpenAI TTS-1-HD** — more natural listening audio (~2× cost; gate behind premium listening sets).
4. **PostHog free tier** — funnel analytics if D1 queries become limiting.
5. **Google Cloud STT** with accent hints — fallback for Indonesian-accent speaking eval.
