---
name: lesson-planner
description: "Generate personalized AI lesson plans for individual EduBot students. Analyzes a student's profile, topic mastery, mental model (misconceptions/gaps), and spaced repetition stats from D1, then creates a structured lesson plan with progressive difficulty. Use this whenever: creating lesson content for a specific student, designing study material based on weakness analysis, building a custom learning path, or when someone says 'make a lesson for student X' or 'what should this student learn next'."
---

# Lesson Planner Skill

You create personalized, data-driven lesson plans for EduBot students by analyzing their real performance data from the D1 database, then generating targeted lesson content.

## Why This Matters

Generic lesson plans waste students' time on things they already know and skip things they don't. This skill pulls actual data — what concepts the student has misconceptions about, where their accuracy is low, which topics they haven't started — and builds a plan that attacks their specific weaknesses in the right order (prerequisites first).

## Workflow

### Step 1: Gather Student Data

Query the D1 database (ID: `d501b671-128e-4a45-9d90-74b22e6691ce`) to build a complete picture:

```sql
-- Student profile + preferences
SELECT u.id, u.name, u.target_test, u.proficiency_level,
       sp.learning_style, sp.communication_style, sp.depth_level,
       sp.target_band_score, sp.study_goal, sp.confidence_score,
       sp.frustration_score, sp.learning_pace, sp.consecutive_correct,
       sp.longest_correct_streak, sp.total_tutor_messages
FROM users u
LEFT JOIN student_profiles sp ON u.id = sp.user_id
WHERE u.id = ?

-- Topic mastery — what they know and don't know
SELECT topic, mastery_level, exercises_attempted, exercises_correct,
       accuracy_percent, current_difficulty, status
FROM topic_mastery WHERE user_id = ?
ORDER BY accuracy_percent ASC

-- Mental model — misconceptions and knowledge gaps
SELECT concept, believed_understanding, misconceptions, confidence, times_assessed
FROM student_mental_model WHERE user_id = ?
ORDER BY believed_understanding ASC

-- Recent performance (last 7 days)
SELECT section, COUNT(*) as total,
       SUM(CASE WHEN is_correct = 1 THEN 1 ELSE 0 END) as correct
FROM attempt_answers aa
JOIN test_attempts ta ON aa.attempt_id = ta.id
WHERE ta.user_id = ? AND aa.submitted_at >= datetime('now', '-7 days')
AND aa.is_correct IS NOT NULL
GROUP BY section

-- Spaced repetition stats
SELECT COUNT(*) as total_items,
       SUM(CASE WHEN next_review_at <= datetime('now') THEN 1 ELSE 0 END) as due_now
FROM spaced_repetition WHERE user_id = ?
```

### Step 2: Identify Priority Areas

Rank what to teach using this priority system:

1. **Misconceptions** (from student_mental_model where believed_understanding = 'misconception') — highest priority because wrong mental models actively harm learning
2. **Low-accuracy topics** (accuracy_percent < 50% with 3+ attempts) — they're trying but not getting it
3. **Partial understanding** (believed_understanding = 'partial') — close to clicking, needs reinforcement
4. **Untouched prerequisites** — topics they haven't started but whose prerequisites they've passed
5. **Review-due items** — topics marked 'needs_review' in topic_mastery

### Step 3: Check Prerequisites

Before teaching an advanced concept, verify prerequisites are met. The dependency tree:

- present_perfect requires: simple_past, simple_present
- third_conditional requires: past_perfect, second_conditional
- second_conditional requires: first_conditional, simple_past
- mixed_conditionals requires: second_conditional, third_conditional
- inference (reading) requires: topic_sentence_identification, detail comprehension
- integrated_writing requires: summary_skills, paragraph_development
- integrated_speaking requires: independent_speaking_structure, note_taking

If a prerequisite is weak, teach that first.

### Step 4: Generate the Lesson Plan

Structure the plan as 4-7 steps with progressive difficulty:

**Step Types:**
- `explanation` — Socratic discovery: start with a question, give 3 examples, let them find the pattern
- `exercise` — Progressive difficulty drill: easy → medium → hard
- `quiz` — Timed challenge covering multiple skills (gamified)
- `discussion` — Real-life application scenario
- `reflection` — Key takeaways and what to practice next

**Adapt to Student Preferences:**
- If learning_style = 'visual': use side-by-side comparisons, before/after examples
- If learning_style = 'active': lead with exercises, explain after
- If communication_style = 'storytelling': frame each topic as a real-life scenario
- If communication_style = 'direct': rules → examples → drills, minimal narrative
- If depth_level = 'beginner': primarily Indonesian, basic vocabulary
- If depth_level = 'advanced': mostly English, focus on nuances and scoring strategies

### Step 5: Save to Database

Insert the plan into the lesson_plans table:

```sql
INSERT INTO lesson_plans (user_id, title, description, plan_type, target_skills, lessons, current_step, total_steps, status, difficulty_level, estimated_minutes, progress_percent, generated_by)
VALUES (?, ?, ?, 'personalized', ?, ?, 0, ?, 'active', ?, ?, 0, 'ai')
```

- `target_skills`: JSON array of skill identifiers
- `lessons`: JSON array of lesson step objects with fields: index, type, title, content, skill, difficulty, expected_minutes

## Output Format

Present the lesson plan to the user like this:

```
## Lesson Plan: [Student Name] — [Title]

**Target:** [test type] | **Level:** [depth] | **Est. time:** [X] min

### Why This Plan
[2-3 sentences explaining why these specific topics were chosen based on the data]

### Steps
1. [icon] **[Title]** ([type], [X] min)
   Focus: [skill] | Difficulty: [1-5]
   [Brief description of what happens in this step]

2. ...

### Data Behind This Plan
- Weakest areas: [topics with accuracy]
- Misconceptions: [concepts]
- Due for review: [count] items
- Streak: [current] (best: [longest])
```

## Important Notes

- Always query real data — never assume or guess a student's level
- If a student has no data yet (new user), create a diagnostic-style plan that assesses their level across sections
- The lesson content field should be detailed enough for the bot's AI tutor to execute — it becomes the system prompt instruction for each step
- Respect the student's daily_study_target_min when estimating plan length
- Include gamification hooks: "3 more correct to unlock the next level"
