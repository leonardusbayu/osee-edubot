// ═══════════════════════════════════════════════════════
// CONCEPT-LEVEL SPACED REPETITION
// 
// Aggregates question-level FSRS signals to concept-level
// cards. FSRS tracks individual questions, but students
// can "master" one question while still not understanding
// the underlying concept. This engine bridges that gap.
// ═══════════════════════════════════════════════════════

import type { Env } from '../types';

export interface ConceptCard {
  id: number;
  user_id: number;
  concept: string;
  stability: number;
  difficulty: number;
  last_review: string | null;
  next_review: string | null;
  reps: number;
  lapses: number;
  total_questions_attempted: number;
  total_correct: number;
  accuracy_percent: number;
}

// Concept → skill tag mapping (questions have skill_tags, we map to concepts)
const SKILL_TO_CONCEPT: Record<string, string> = {
  'articles': 'articles',
  'a_an_the': 'articles',
  'definite_article': 'articles',
  'indefinite_article': 'articles',
  'tenses': 'tenses',
  'present_simple': 'tenses',
  'past_simple': 'tenses',
  'present_perfect': 'tenses',
  'past_perfect': 'tenses',
  'future_tense': 'tenses',
  'continuous': 'tenses',
  'prepositions': 'prepositions',
  'prep_time': 'prepositions',
  'prep_place': 'prepositions',
  'conditionals': 'conditionals',
  'conditional_1': 'conditionals',
  'conditional_2': 'conditionals',
  'conditional_3': 'conditionals',
  'passive_voice': 'passive_voice',
  'sv_agreement': 'sv_agreement',
  'subject_verb': 'sv_agreement',
  'relative_clauses': 'relative_clauses',
  'relative_pronouns': 'relative_clauses',
  'gerunds': 'gerunds',
  'infinitives': 'gerunds',
  'reported_speech': 'reported_speech',
  'word_formation': 'word_formation',
  'prefixes': 'word_formation',
  'suffixes': 'word_formation',
};

/**
 * Map a question's skill tags to concepts.
 */
export function tagsToConcepts(tags: string[]): string[] {
  const concepts = new Set<string>();
  for (const tag of tags) {
    const normalized = tag.toLowerCase().trim();
    if (SKILL_TO_CONCEPT[normalized]) {
      concepts.add(SKILL_TO_CONCEPT[normalized]);
    }
  }
  return concepts.size > 0 ? [...concepts] : ['general'];
}

/**
 * Load or create a concept card for a user.
 */
async function getOrCreateCard(env: Env, userId: number, concept: string): Promise<ConceptCard> {
  const row = await env.DB.prepare(
    'SELECT * FROM concept_review_cards WHERE user_id = ? AND concept = ?'
  ).bind(userId, concept).first() as any;

  if (row) {
    return {
      id: row.id,
      user_id: row.user_id,
      concept: row.concept,
      stability: row.stability || 0,
      difficulty: row.difficulty || 0.5,
      last_review: row.last_review,
      next_review: row.next_review,
      reps: row.reps || 0,
      lapses: row.lapses || 0,
      total_questions_attempted: row.total_questions_attempted || 0,
      total_correct: row.total_correct || 0,
      accuracy_percent: row.accuracy_percent || 0,
    };
  }

  // Create new card
  await env.DB.prepare(
    `INSERT INTO concept_review_cards (user_id, concept, stability, difficulty, next_review)
     VALUES (?, ?, ?, ?, datetime('now'))`
  ).bind(userId, concept, 1.0, 0.5).run();

  return getOrCreateCard(env, userId, concept);
}

/**
 * Update concept cards based on a question result.
 * Call this after every question answer.
 */
export async function updateConceptFromQuestion(
  env: Env,
  userId: number,
  skillTags: string[],
  wasCorrect: boolean,
): Promise<void> {
  const concepts = tagsToConcepts(skillTags);

  for (const concept of concepts) {
    const card = await getOrCreateCard(env, userId, concept);

    // Update aggregate stats
    const newAttempted = card.total_questions_attempted + 1;
    const newCorrect = card.total_correct + (wasCorrect ? 1 : 0);
    const newAccuracy = newAttempted > 0 ? Math.round((newCorrect / newAttempted) * 100) : 0;

    // Simple FSRS-like stability update
    // If correct: increase stability proportionally to current stability
    // If wrong: decrease stability (lapse)
    let newStability = card.stability;
    let newLapses = card.lapses;
    let newDifficulty = card.difficulty;

    if (wasCorrect) {
      // Stability grows: S' = S * (1 + 0.1 * e^(-0.1*S)) — diminishing returns
      newStability = card.stability * (1 + 0.1 * Math.exp(-0.1 * card.stability)) + 0.1;
      // Difficulty decreases slightly when answered correctly
      newDifficulty = Math.max(0.1, card.difficulty - 0.02);
    } else {
      // Stability drops on lapse
      newStability = card.stability * 0.5;
      newLapses += 1;
      // Difficulty increases when answered incorrectly
      newDifficulty = Math.min(1.0, card.difficulty + 0.05);
    }

    // Calculate next review date based on stability
    const daysUntilReview = Math.max(1, Math.round(newStability));
    const nextReview = new Date();
    nextReview.setDate(nextReview.getDate() + daysUntilReview);

    await env.DB.prepare(
      `UPDATE concept_review_cards
       SET stability = ?, difficulty = ?, reps = reps + 1, lapses = ?,
           total_questions_attempted = ?, total_correct = ?, accuracy_percent = ?,
           last_review = datetime('now'), next_review = ?,
           updated_at = datetime('now')
       WHERE id = ?`
    ).bind(
      newStability,
      newDifficulty,
      newLapses,
      newAttempted,
      newCorrect,
      newAccuracy,
      nextReview.toISOString().split('T')[0],
      card.id,
    ).run();
  }
}

/**
 * Get concepts due for review for a user.
 */
export async function getConceptsDueForReview(env: Env, userId: number, limit: number = 5): Promise<ConceptCard[]> {
  const rows = await env.DB.prepare(
    `SELECT * FROM concept_review_cards
     WHERE user_id = ? AND next_review <= date('now')
     ORDER BY next_review ASC, lapses DESC
     LIMIT ?`
  ).bind(userId, limit).all() as any;

  return (rows.results || []).map((r: any) => ({
    id: r.id,
    user_id: r.user_id,
    concept: r.concept,
    stability: r.stability || 0,
    difficulty: r.difficulty || 0.5,
    last_review: r.last_review,
    next_review: r.next_review,
    reps: r.reps || 0,
    lapses: r.lapses || 0,
    total_questions_attempted: r.total_questions_attempted || 0,
    total_correct: r.total_correct || 0,
    accuracy_percent: r.accuracy_percent || 0,
  }));
}

/**
 * Get concept mastery summary for a user.
 */
export async function getConceptMasterySummary(env: Env, userId: number): Promise<Record<string, { accuracy: number; stability: number; status: string }>> {
  const rows = await env.DB.prepare(
    'SELECT concept, accuracy_percent, stability, reps FROM concept_review_cards WHERE user_id = ?'
  ).bind(userId).all() as any;

  const summary: Record<string, { accuracy: number; stability: number; status: string }> = {};
  for (const row of rows.results || []) {
    const accuracy = row.accuracy_percent || 0;
    const stability = row.stability || 0;
    const reps = row.reps || 0;

    let status = 'not_started';
    if (reps >= 5 && accuracy >= 80 && stability >= 7) status = 'mastered';
    else if (reps >= 3 && accuracy >= 60) status = 'learning';
    else if (reps > 0) status = 'struggling';

    summary[row.concept] = { accuracy, stability, status };
  }

  return summary;
}

/**
 * Get the weakest concepts for a user.
 */
export async function getWeakestConcepts(env: Env, userId: number, limit: number = 3): Promise<ConceptCard[]> {
  const rows = await env.DB.prepare(
    `SELECT * FROM concept_review_cards
     WHERE user_id = ? AND total_questions_attempted > 0
     ORDER BY accuracy_percent ASC, lapses DESC
     LIMIT ?`
  ).bind(userId, limit).all() as any;

  return (rows.results || []).map((r: any) => ({
    id: r.id,
    user_id: r.user_id,
    concept: r.concept,
    stability: r.stability || 0,
    difficulty: r.difficulty || 0.5,
    last_review: r.last_review,
    next_review: r.next_review,
    reps: r.reps || 0,
    lapses: r.lapses || 0,
    total_questions_attempted: r.total_questions_attempted || 0,
    total_correct: r.total_correct || 0,
    accuracy_percent: r.accuracy_percent || 0,
  }));
}

/**
 * Manually review a concept (used in concept review flow).
 */
export async function markConceptReviewed(env: Env, userId: number, concept: string, understood: boolean): Promise<void> {
  const card = await getOrCreateCard(env, userId, concept);

  let newStability = card.stability;
  let newLapses = card.lapses;
  let newDifficulty = card.difficulty;

  if (understood) {
    newStability = card.stability * (1 + 0.1 * Math.exp(-0.1 * card.stability)) + 0.2;
    newDifficulty = Math.max(0.1, card.difficulty - 0.03);
  } else {
    newStability = card.stability * 0.4;
    newLapses += 1;
    newDifficulty = Math.min(1.0, card.difficulty + 0.08);
  }

  const daysUntilReview = Math.max(1, Math.round(newStability));
  const nextReview = new Date();
  nextReview.setDate(nextReview.getDate() + daysUntilReview);

  await env.DB.prepare(
    `UPDATE concept_review_cards
     SET stability = ?, difficulty = ?, reps = reps + 1, lapses = ?,
         last_review = datetime('now'), next_review = ?,
         updated_at = datetime('now')
     WHERE id = ?`
  ).bind(
    newStability,
    newDifficulty,
    newLapses,
    nextReview.toISOString().split('T')[0],
    card.id,
  ).run();
}

/**
 * Batch migrate existing question-level FSRS data to concept cards.
 * Run this once after deploying the feature.
 */
export async function migrateQuestionToConceptData(env: Env): Promise<number> {
  // Get all question-level FSRS data with skill tags
  const rows = await env.DB.prepare(
    `SELECT sr.user_id, sr.question_id, sr.stability, sr.difficulty, sr.reps, sr.lapses,
            q.skill_tags, sr.is_correct
     FROM spaced_repetition sr
     LEFT JOIN questions q ON sr.question_id = q.id
     WHERE q.skill_tags IS NOT NULL`
  ).all() as any;

  if (!rows.results || rows.results.length === 0) return 0;

  let migrated = 0;
  for (const row of rows.results) {
    const tags = row.skill_tags ? JSON.parse(row.skill_tags) : [];
    const concepts = tagsToConcepts(tags);
    const wasCorrect = row.is_correct === 1;

    for (const concept of concepts) {
      const card = await getOrCreateCard(env, row.user_id, concept);
      const newAttempted = card.total_questions_attempted + 1;
      const newCorrect = card.total_correct + (wasCorrect ? 1 : 0);
      const newAccuracy = newAttempted > 0 ? Math.round((newCorrect / newAttempted) * 100) : 0;

      await env.DB.prepare(
        `UPDATE concept_review_cards
         SET total_questions_attempted = ?, total_correct = ?, accuracy_percent = ?,
             updated_at = datetime('now')
         WHERE id = ?`
      ).bind(newAttempted, newCorrect, newAccuracy, card.id).run();

      migrated++;
    }
  }

  return migrated;
}
