---
name: content-factory
description: "Batch-generate TOEFL iBT and IELTS practice questions for EduBot's question bank. Creates high-quality, exam-authentic questions across all sections (Reading, Listening, Speaking, Writing) with proper formatting, answer keys, explanations, and difficulty ratings, then inserts them into the D1 database. Use this whenever: adding new questions, expanding the question bank, generating content for a specific section or topic, filling gaps in question coverage, creating questions at a specific difficulty level, or when someone says 'we need more questions', 'generate content', 'add questions about X', or 'fill the question bank'."
---

# Content Factory Skill

You batch-generate exam-authentic TOEFL iBT and IELTS practice questions and insert them directly into EduBot's D1 database. The goal is to build a comprehensive, balanced question bank that covers all sections, topics, and difficulty levels.

## Why Quality Matters

Students use these questions to prepare for real exams. Low-quality or unrealistic questions actively harm preparation by training wrong instincts. Every question should feel like it could appear on the actual test — same format, same cognitive demands, same trap answer patterns.

## Current Database State

Before generating, check what exists:

```sql
-- Question distribution by section and type
SELECT section, question_type, difficulty, COUNT(*) as count
FROM test_contents
WHERE status = 'published'
GROUP BY section, question_type, difficulty
ORDER BY section, question_type, difficulty

-- Total count
SELECT COUNT(*) as total FROM test_contents WHERE status = 'published'
```

Identify gaps: which sections/types/difficulties are underrepresented?

## Question Format by Section

### Reading Section

**Question types:** main_idea, detail, inference, vocabulary_in_context, reference, negative_factual, insert_text, summary, fill_in_blank

```json
{
  "section": "reading",
  "question_type": "inference",
  "topic": "reading_strategy",
  "difficulty": 3,
  "content": "Based on the passage, the author most likely believes that...",
  "passage": "The full reading passage text (150-300 words for TOEFL)...",
  "options": ["A) option", "B) option", "C) option", "D) option"],
  "correct_answer": "B",
  "explanation": "The passage states '...' which implies... Option A is wrong because...",
  "skill_tags": "inference,author_purpose"
}
```

**Quality checklist:**
- Passages should be academic but accessible (biology, history, social science, art)
- All 4 options should be plausible — no obvious throwaway answers
- Explanation should address why the correct answer is right AND why each wrong answer is wrong
- Vocabulary should match the target difficulty level

### Listening Section

**Question types:** main_idea, detail, inference, attitude_purpose, connecting_content, organization

```json
{
  "section": "listening",
  "question_type": "detail",
  "topic": "listening_practice",
  "difficulty": 2,
  "content": "According to the lecture, what is the main advantage of...?",
  "passage": "[AUDIO] Professor: Today we'll discuss... Student: Could you explain...? Professor: Certainly...",
  "direction": "Listen to the conversation and answer the question.",
  "options": ["A) option", "B) option", "C) option", "D) option"],
  "correct_answer": "C",
  "explanation": "The professor explicitly states '...'",
  "skill_tags": "detail_listening,lecture"
}
```

**Key for listening:**
- Use `[AUDIO]` prefix — the bot converts these to multi-speaker TTS
- Include speaker labels: Professor, Man, Woman, Student
- Conversations should feel natural with hedging, corrections, emphasis
- Lectures should have clear organizational markers

### Speaking Section

**Question types:** independent_speaking, integrated_speaking

```json
{
  "section": "speaking",
  "question_type": "independent_speaking",
  "topic": "speaking_templates",
  "difficulty": 3,
  "content": "Some people prefer to study alone, while others prefer to study in groups. Which do you prefer and why? You have 15 seconds to prepare and 45 seconds to speak.",
  "scoring_rubric": "Delivery (0-4): fluency, pronunciation, pace\nLanguage use (0-4): grammar range, vocabulary\nTopic development (0-4): coherence, details, examples",
  "sample_response": "I personally prefer studying in groups because...",
  "explanation": "A strong response should: 1) state a clear preference, 2) give 2 specific reasons with examples, 3) use transition words"
}
```

### Writing Section

**Question types:** integrated_writing, independent_essay

```json
{
  "section": "writing",
  "question_type": "independent_essay",
  "topic": "writing_templates",
  "difficulty": 4,
  "content": "Do you agree or disagree with the following statement? Universities should require all students to take courses outside their major field of study. Use specific reasons and examples to support your answer.",
  "scoring_rubric": "Organization (0-5): intro, body paragraphs, conclusion\nDevelopment (0-5): specific details, examples\nLanguage (0-5): grammar, vocabulary range\nMechanics (0-5): spelling, punctuation",
  "sample_response": "A well-structured 300-word essay that...",
  "explanation": "Key elements: clear thesis, 2-3 body paragraphs with specific examples, counter-argument acknowledgment, strong conclusion"
}
```

## Difficulty Scale

| Level | Description | Target Band/Score |
|-------|-------------|-------------------|
| 1 | Basic — tests fundamental recognition | TOEFL 40-50 / IELTS 4.0-4.5 |
| 2 | Elementary — standard application | TOEFL 50-70 / IELTS 5.0-5.5 |
| 3 | Intermediate — requires inference/analysis | TOEFL 70-85 / IELTS 6.0-6.5 |
| 4 | Advanced — subtle distinctions, traps | TOEFL 85-100 / IELTS 7.0-7.5 |
| 5 | Expert — near-native level nuance | TOEFL 100+ / IELTS 8.0+ |

## Inserting into D1

```sql
INSERT INTO test_contents (section, question_type, topic, difficulty, content, passage, direction, options, correct_answer, explanation, scoring_rubric, sample_response, skill_tags, status)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'published')
```

Important fields:
- `options`: JSON array like `["A) ...", "B) ...", "C) ...", "D) ..."]`
- `skill_tags`: comma-separated skill identifiers for analytics tracking
- `status`: always 'published' unless drafting

## Batch Generation Strategy

When asked to generate questions:

1. **Check existing coverage** — run the distribution query above
2. **Identify gaps** — which section/type/difficulty combos have fewer than 20 questions?
3. **Generate in batches** — 5-10 questions at a time for quality control
4. **Vary academic domains** — don't make 10 reading passages about biology; rotate: biology, history, social science, art, technology, environmental science
5. **Balance difficulty** — aim for 20% each difficulty level
6. **Verify no duplicates** — check that passages and questions don't repeat existing content

## Output Format

For each batch, present:

```
## Content Factory: [X] New Questions

**Section:** [reading/listening/speaking/writing]
**Type:** [question_type]
**Difficulty range:** [1-5]

### Question 1
[Full question with passage, options, answer, explanation]
Status: Inserted ✅ (ID: 3037)

### Question 2
...

### Coverage Update
Before: [section distribution]
After: [updated distribution]
Gap analysis: [what still needs attention]
```

## Important Notes

- Passages must be original — never copy from actual TOEFL/IELTS exams or published prep books
- Explanations are essential — they're shown to students after answering and directly impact learning
- For listening passages, the `[AUDIO]` format with speaker labels is required for the TTS system
- Always include skill_tags — they feed into the analytics and mental model system
- Run the coverage check before AND after inserting to verify the bank is getting more balanced
