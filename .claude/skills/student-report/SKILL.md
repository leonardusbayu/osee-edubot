---
name: student-report
description: "Generate comprehensive student progress reports for EduBot — individual deep-dives or class-wide analytics. Pulls all data from D1 (test attempts, accuracy by section, mental model, spaced repetition stats, tutor interactions, study logs) and produces a detailed analysis with trends, strengths/weaknesses, AI-powered recommendations, and next steps. Use this whenever: checking on a student's progress, generating a report card, reviewing class performance, analyzing learning trends, creating parent/student/teacher reports, or when someone says 'how is student X doing', 'progress report', 'show me the analytics', 'student performance', or 'class summary'."
---

# Student Report Skill

You generate deep, data-driven progress reports for EduBot students by querying every available data source in D1 and synthesizing it into actionable insights. Reports can be for individual students, comparisons between students, or class-wide summaries.

## Why Depth Matters

A surface-level "70% accuracy" tells neither the teacher nor the student what to do next. This skill digs into the *why* behind the numbers — which specific concepts cause errors, whether the student is improving or plateauing, how their spaced repetition retention is holding up, and what the tutor's mental model believes about their understanding.

## Report Types

### 1. Individual Student Report

The most detailed report. Pull everything:

```sql
-- 1. Basic profile + preferences
SELECT u.*, sp.*
FROM users u
LEFT JOIN student_profiles sp ON u.id = sp.user_id
WHERE u.id = ?

-- 2. Topic mastery landscape
SELECT topic, mastery_level, accuracy_percent, exercises_attempted,
       current_difficulty, highest_difficulty_passed, status,
       first_attempted_at, last_attempted_at
FROM topic_mastery WHERE user_id = ?
ORDER BY mastery_level ASC

-- 3. Mental model — what the tutor believes
SELECT concept, believed_understanding, misconceptions, confidence, times_assessed
FROM student_mental_model WHERE user_id = ?

-- 4. Section performance over time (weekly)
SELECT strftime('%Y-W%W', aa.submitted_at) as week,
       aa.section,
       COUNT(*) as total,
       SUM(CASE WHEN aa.is_correct = 1 THEN 1 ELSE 0 END) as correct
FROM attempt_answers aa
JOIN test_attempts ta ON aa.attempt_id = ta.id
WHERE ta.user_id = ?
AND aa.is_correct IS NOT NULL
GROUP BY week, aa.section
ORDER BY week DESC

-- 5. Daily study consistency
SELECT log_date, questions_answered, correct_answers, study_minutes, streak_count
FROM daily_study_logs WHERE user_id = ?
ORDER BY log_date DESC LIMIT 30

-- 6. Spaced repetition health
SELECT COUNT(*) as total,
       SUM(CASE WHEN next_review_at <= datetime('now') THEN 1 ELSE 0 END) as overdue,
       SUM(CASE WHEN review_level >= 4 THEN 1 ELSE 0 END) as mastered,
       AVG(review_level) as avg_level
FROM spaced_repetition WHERE user_id = ?

-- 7. Lesson plan progress
SELECT title, plan_type, status, progress_percent, total_steps, current_step, created_at
FROM lesson_plans WHERE user_id = ?
ORDER BY created_at DESC LIMIT 5

-- 8. Test attempts with scores
SELECT ta.id, ta.test_type, ta.section, ta.score, ta.total_questions, ta.status, ta.created_at
FROM test_attempts ta
WHERE ta.user_id = ? AND ta.status = 'completed'
ORDER BY ta.created_at DESC LIMIT 20

-- 9. Tutor interaction intensity
SELECT COUNT(*) as total_messages,
       COUNT(DISTINCT date(created_at)) as active_days
FROM conversation_messages
WHERE user_id = ?
```

### 2. Class Summary Report

```sql
-- Per-student summary for a class
SELECT u.name, u.proficiency_level,
       sp.confidence_score, sp.learning_pace,
       (SELECT AVG(tm.accuracy_percent) FROM topic_mastery tm WHERE tm.user_id = u.id) as avg_accuracy,
       (SELECT COUNT(*) FROM test_attempts ta WHERE ta.user_id = u.id AND ta.status = 'completed') as tests_completed,
       (SELECT COUNT(*) FROM conversation_messages cm WHERE cm.user_id = u.id) as tutor_messages
FROM class_members cm
JOIN users u ON cm.user_id = u.id
LEFT JOIN student_profiles sp ON u.id = sp.user_id
WHERE cm.class_id = ?
ORDER BY avg_accuracy ASC
```

### 3. Comparison Report

Compare 2-3 students side by side on the same metrics.

## Analysis Framework

After gathering data, analyze along these dimensions:

### A. Mastery Landscape
- How many topics: mastered / practicing / learning / not started?
- Which section (R/L/S/W) is strongest/weakest?
- Are there mastered topics that should be reviewed (stale mastery)?

### B. Trend Analysis
- Is accuracy improving week over week, or plateauing?
- Is study frequency consistent or sporadic?
- Are streaks getting longer (building momentum) or shorter (losing interest)?

### C. Mental Model Assessment
- Misconceptions: what does the student think they know but don't?
- Knowledge gaps: what haven't they been exposed to?
- Confidence vs. accuracy mismatch: high confidence + low accuracy = dangerous blind spots

### D. Spaced Repetition Health
- How many items are overdue? (Overdue items = forgetting is happening)
- What's the average retention prediction?
- Is the student doing their reviews consistently?

### E. Engagement & Motivation
- Frustration score trend: is the student getting more frustrated?
- Message frequency: increasing or decreasing?
- Session length: getting shorter = losing interest?

### F. Recommendations
Based on all the above, generate 3-5 specific, actionable recommendations:
1. What to study next (with reasoning)
2. What to review (overdue SRS items)
3. Study habit adjustments (if sporadic)
4. Difficulty calibration (too easy/hard based on accuracy + frustration)
5. Test-taking strategies (if scoring well on practice but weak in specific question types)

## Output Format

### Individual Report

```
## Progress Report: [Student Name]
Generated: [date] | Target: [test] | Level: [depth]

### Overview
[2-3 sentence summary: "X has been studying consistently over the past 2 weeks, 
with improving accuracy in reading (65%→78%) but struggling with conditionals.
The mental model flags a misconception about present perfect vs past simple."]

### Mastery Landscape
Mastered: [count] topics | Practicing: [count] | Learning: [count] | Not started: [count]

Strongest: [top 3 topics with %]
Weakest: [bottom 3 topics with %]

### Section Breakdown
| Section | Accuracy | Trend | Questions |
|---------|----------|-------|-----------|
| Reading | 78% | ↑ +13% | 45 |
| Listening | 62% | → flat | 30 |
| Speaking | - | - | 0 |
| Writing | 55% | ↓ -5% | 12 |

### Mental Model Flags
[Misconceptions with evidence]
[Knowledge gaps]

### Study Habits
[Consistency, streak data, daily average]

### Spaced Repetition
[Items due, mastered, retention rate]

### Recommendations
1. [Specific action with reasoning]
2. ...

### Suggested Next Lesson Plan
[Brief outline of what the next lesson should cover]
```

### Class Report

```
## Class Report: [Class Name]
Students: [count] | Avg Accuracy: [%] | Period: [dates]

### Student Rankings
| Rank | Student | Accuracy | Streak | Engagement |
|------|---------|----------|--------|------------|
| 1 | [name] | 85% | 12 | High |
| ... | | | | |

### Class Strengths & Weaknesses
[Topics the class does well/poorly on as a group]

### Students Needing Attention
[Students with high frustration, low engagement, or declining scores]

### Recommended Class Focus
[What to teach next based on aggregate data]
```

## Important Notes

- Always use real data — never fabricate or estimate statistics
- Trend arrows: use ↑ (improving), ↓ (declining), → (flat) based on comparing last 2 weeks
- If a student has limited data (< 10 answers), note this and focus on what IS available
- Recommendations should be specific ("Study conditionals, focusing on third conditional — accuracy is 25% on 8 attempts") not vague ("Keep studying grammar")
- Include the misconceptions from the mental model — these are the highest-leverage fixes
- For class reports, flag students at risk of disengagement (low recent activity + high frustration score)
