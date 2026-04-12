---
name: classroom-lesson
description: "Create classroom lesson plans for EduBot teacher groups. Analyzes all students in a class, computes average mastery and skill distribution, then generates mixed-level lesson content with scaffolding for weaker students and challenges for stronger ones. Use this whenever: a teacher needs a lesson plan for their class, creating group activities, generating a daily quiz for a class, designing mixed-level exercises, or when someone mentions 'class lesson', 'group plan', 'teach this class', or 'quiz for my students'."
---

# Classroom Lesson Skill

You create data-driven classroom lesson plans for EduBot teacher groups by analyzing every student's mastery data and generating activities that work for the entire class — scaffolding for strugglers, challenges for high-performers.

## Why Mixed-Level Plans Matter

In a typical EduBot class, some students score 80%+ on articles while others are at 30%. A one-size-fits-all lesson bores half the class and loses the other half. This skill creates differentiated activities within a single lesson flow, so the teacher can run one session that benefits everyone.

## Workflow

### Step 1: Identify the Class

```sql
-- Get class info
SELECT c.id, c.name, c.telegram_group_id, c.teacher_id, c.class_level
FROM classes c WHERE c.id = ?

-- Get all students
SELECT cm.user_id, u.name, u.proficiency_level
FROM class_members cm
JOIN users u ON cm.user_id = u.id
WHERE cm.class_id = ?
```

### Step 2: Analyze Class-Wide Mastery

For the chosen topic, compute the distribution:

```sql
-- Per-student mastery for the topic
SELECT u.name, tm.mastery_level, tm.accuracy_percent, tm.exercises_attempted, tm.status
FROM topic_mastery tm
JOIN users u ON tm.user_id = u.id
WHERE tm.user_id IN (SELECT user_id FROM class_members WHERE class_id = ?)
AND tm.topic = ?
ORDER BY tm.mastery_level ASC

-- Class-wide section performance (last 14 days)
SELECT ta.user_id, u.name, aa.section,
       COUNT(*) as total,
       SUM(CASE WHEN aa.is_correct = 1 THEN 1 ELSE 0 END) as correct
FROM attempt_answers aa
JOIN test_attempts ta ON aa.attempt_id = ta.id
JOIN users u ON ta.user_id = u.id
WHERE ta.user_id IN (SELECT user_id FROM class_members WHERE class_id = ?)
AND aa.submitted_at >= datetime('now', '-14 days')
AND aa.is_correct IS NOT NULL
GROUP BY ta.user_id, aa.section
```

### Step 3: Segment the Class

Group students into tiers based on the topic's mastery:

- **Tier A (Advanced)**: mastery_level >= 70 or accuracy >= 75%
- **Tier B (Developing)**: mastery_level 40-69 or accuracy 50-74%
- **Tier C (Struggling)**: mastery_level < 40 or accuracy < 50% or no data

Report the distribution: "5 students in Tier A, 8 in Tier B, 3 in Tier C"

### Step 4: Generate the Lesson Plan

Build 5-7 steps that work for all tiers:

**Structure:**
1. **Warm-up** (5 min) — 3 questions, easy→medium→hard. Everyone answers.
2. **Concept Review** (5 min) — Explanation adapted to class average. If mostly Tier B, teach at intermediate level with scaffolding notes for Tier C.
3. **Guided Practice** (8 min) — 3-4 exercises with tiered difficulty:
   - Tier C: basic pattern recognition with hints
   - Tier B: standard application
   - Tier A: edge cases and exceptions
4. **Pair/Group Activity** (5 min) — Mix tiers strategically: pair a Tier A with a Tier C student
5. **Class Quiz Challenge** (8 min) — 5 competitive questions, mixed difficulty. Leaderboard format.
6. **Wrap-up** (3 min) — 3 key takeaways + homework suggestion per tier

**Each step includes:**
- The actual content/questions (not just descriptions)
- Teaching notes for the teacher
- Expected time
- Differentiation instructions per tier

### Step 5: Generate Daily Quiz (Optional)

If the teacher wants a daily quiz:

```sql
-- Get 5 questions from the topic, mixed difficulty
SELECT id, section, content, question_type, difficulty
FROM test_contents
WHERE topic = ? AND status = 'published'
ORDER BY RANDOM() LIMIT 5
```

If not enough questions exist for that topic, generate new ones (see content-factory skill).

### Step 6: Save to Database

```sql
INSERT INTO lesson_plans (user_id, title, description, plan_type, target_skills, lessons, current_step, total_steps, status, difficulty_level, estimated_minutes, class_id)
VALUES (?, ?, ?, 'classroom', ?, ?, 0, ?, 'active', ?, ?, ?)
```

## Output Format

```
## Classroom Lesson: [Topic] — [Class Name]

**Students:** [count] | **Avg Mastery:** [X]% | **Est. time:** [X] min

### Class Distribution
- Tier A (Advanced): [names] — [count] students
- Tier B (Developing): [names] — [count] students  
- Tier C (Needs Support): [names] — [count] students

### Lesson Flow

1. **Warm-up** (5 min)
   [Actual questions with answers]

2. **Concept Review** (5 min)
   [Explanation text]
   Teacher note: [scaffolding instruction for Tier C]

3. **Guided Practice** (8 min)
   Tier C: [easier exercise with hints]
   Tier B: [standard exercise]
   Tier A: [challenging exercise]

...

### Quiz Questions (for /dailyquiz)
1. [question] → [answer]
2. ...

### Homework Suggestions
- Tier C: [basic reinforcement task]
- Tier B: [application task]
- Tier A: [extension/challenge task]
```

## Available Topics

These are the main topics in EduBot's curriculum:

articles, sv_agreement, tenses, prepositions, passive_voice, conditionals, relative_clauses, word_formation, academic_words, collocations, paraphrasing, linking_words, reading_main_idea, reading_strategy, listening_practice, listening_strategy, speaking_templates, writing_templates, pronunciation

## Important Notes

- Always use real student data from D1 — never estimate or assume
- If a class has no mastery data for a topic, treat all students as Tier B and include a mini-diagnostic at the start
- Include actual exercise content, not just placeholders — the teacher should be able to use this immediately
- Keep quiz questions answerable in 30 seconds for the competitive format
- Pair activities should deliberately mix skill levels for peer teaching
