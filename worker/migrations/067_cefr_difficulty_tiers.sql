-- Normalize published content onto CEFR-aligned difficulty tiers.
-- Difficulty scale:
--   1 = A1 fundamentals, 2 = A2 basic recognition, 3 = B1 standard application,
--   4 = B2 analysis/integration, 5 = C1 advanced nuance/production.

UPDATE test_contents
SET difficulty = CASE
  WHEN question_type IN (
    'complete_the_words', 'listen_choose_response', 'listen_short_dialogue',
    'question_response', 'photographs', 'fill_in_blank'
  ) THEN 2
  WHEN question_type IN (
    'read_in_daily_life', 'listen_conversation', 'listen_announcement',
    'sentence_completion', 'incomplete_sentences', 'text_completion',
    'task1', 'part1', 'listen_long_conversation'
  ) THEN 3
  WHEN question_type IN (
    'read_academic_passage', 'listen_academic_talk', 'listen_talk',
    'reading_passage', 'conversations', 'talks', 'reading_comprehension',
    'matching_headings', 'true_false_not_given', 'multiple_choice',
    'task2', 'integrated_writing', 'part2', 'error_identification'
  ) THEN 4
  WHEN question_type IN ('part3') THEN 5
  ELSE difficulty
END
WHERE status = 'published';

-- Skill-level overrides for higher-order thinking questions.
UPDATE test_contents
SET difficulty = CASE
  WHEN skill_tags LIKE '%summary%' THEN 5
  WHEN skill_tags LIKE '%inference%' AND difficulty < 4 THEN 4
  WHEN skill_tags LIKE '%vocabulary_context%' AND difficulty < 3 THEN 3
  ELSE difficulty
END
WHERE status = 'published';

UPDATE test_contents
SET cefr_level = CASE
  WHEN difficulty <= 1 THEN 'A1'
  WHEN difficulty = 2 THEN 'A2'
  WHEN difficulty = 3 THEN 'B1'
  WHEN difficulty = 4 THEN 'B2'
  ELSE 'C1'
END
WHERE status = 'published';

UPDATE test_contents
SET bloom_level = CASE
  WHEN question_type IN ('task1', 'task2', 'integrated_writing', 'part1', 'part2', 'part3') THEN 'create'
  WHEN skill_tags LIKE '%inference%' OR skill_tags LIKE '%summary%' OR question_type IN (
    'read_academic_passage', 'listen_academic_talk', 'reading_passage',
    'matching_headings', 'true_false_not_given', 'reading_comprehension'
  ) THEN 'analyze'
  WHEN question_type IN ('fill_in_blank', 'complete_the_words', 'photographs') THEN 'remember'
  ELSE 'understand'
END
WHERE status = 'published';
