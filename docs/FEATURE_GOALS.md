# Feature Goals — Score-Gain Targets per Feature

> North star: **+0.5 IELTS band / +10 iBT / +60 TOEIC in 30 days** for any
> student who follows the bot daily. Every feature below has its own
> ambitious target + how it's measured. Review monthly against
> `score_estimates` + `mock_test_history`.

| Feature | Ambitious target | Measured by |
|---|---|---|
| **Tutor lessons (thread-style)** | Lesson completion ≥ 80%; student replies to ≥ 90% of comprehension checks; "boring" reports ~0 | lesson_step_results, content_reports |
| **Comprehension checks → FSRS** | Concept missed in lesson reaches 85% recall within 7 days | spaced_repetition fsrs_state stability on CQ cards |
| **/strategi (strategy lessons)** | +5 percentage-point section accuracy within 7 days of reading the section's playbook | gap_routing_log + attempt_answers before/after |
| **/vocab (daily 5 cards)** | 25 new words/week enrolled; 80% retained at day 7 | spaced_repetition section='vocabulary' |
| **Gap router** | 100% of /today lessons have a logged score-leverage reason; routed topics improve ≥10pp in 14 days | gap_routing_log + topic_mastery delta |
| **IRT ability-matching** | Per-question correctness converges to 60–75% zone for 80% of active students | attempt_answers rolling accuracy |
| **Score predictor** | Estimate within ±0.5 band of real mock for 70% of students | score_estimates vs mock_test_history |
| **Mock proof loop** | ≥ 60% of 30-day-active students have 2+ mocks; median delta positive | mock_test_history |
| **Review debt** | Median due-card completion ≥ 60%; critical-debt students < 10% | spaced_repetition overdue counts |
| **/examdate taper** | Students with exam_date set show 1.5× practice volume in last 14 days pre-exam | attempt_answers volume by taper phase |
| **Fatigue detection** | Post-break accuracy recovers ≥ 10pp vs pre-break slump | fatigue log + attempt_answers |
| **Diagnostic (D1 bank)** | Retake overlap < 30% questions; placement matches first-mock within 1 band | diagnostic_question_bank rotation |
| **Speaking eval** | Listen-and-repeat false-negative rate < 10% (filler/typo tolerance) | speech-match unit tests + content_reports |
| **Content bank** | Every (test, section) ≥ 80% of target minimums; zero empty-option defects | weekly content audit |
| **Gamification/streaks** | D7 retention ≥ 35%; streak-3+ students 2× lesson volume | users.current_streak cohorts |
| **Reseller engine** | ≥ 40% of premium revenue reseller-attributed; payout cycle < 7 days | referral_attributions |
| **Weekly target (NEW)** | Every active student sees a personal weekly goal Monday; ≥ 50% hit it | weekly_targets table |

## Weekly Target feature (the binding agent)
Auto-set every Monday per student: 3 concrete numbers for the week —
(1) lift weakest topic +10pp, (2) clear N review cards, (3) 1 mock if due.
Shown in /today header + /progress. Hitting all 3 = bonus XP + streak shield.
This converts every feature above into one visible weekly promise.
