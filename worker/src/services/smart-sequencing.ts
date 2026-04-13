/**
 * Smart Question Sequencing for Adaptive Test Practice
 *
 * OVERVIEW
 * ═══════════════════════════════════════════════════════════════════════════
 * Automatically sequences questions to target student's weakest areas, using
 * FSRS adaptive spaced repetition data and historical answer accuracy.
 *
 * INTEGRATION
 * ───────────────────────────────────────────────────────────────────────────
 * This is called by the GET /api/tests/questions/:section endpoint when:
 * 1. User is authenticated (has JWT token)
 * 2. No specific question_type filter is applied (mixed question types)
 * 3. This is the first page of results (offset = 0)
 *
 * ALGORITHM
 * ───────────────────────────────────────────────────────────────────────────
 * 1. Find weak areas from two sources:
 *    a) FSRS cards with low stability (<5) — recent failures or struggling concepts
 *    b) Questions with <70% accuracy — historically difficult questions
 *    c) Overdue reviews — items due for spaced repetition
 *
 * 2. Allocate questions in weighted distribution:
 *    - 60% from weak areas (ordered by priority: low stability → low accuracy → overdue)
 *    - 20% from medium areas (70-85% accuracy — consolidation zone)
 *    - 20% random (for discovery, serendipity, varied exposure)
 *
 * 3. If no historical data exists (new user), return null to fall back to RANDOM()
 *
 * EXAMPLE FLOW
 * ───────────────────────────────────────────────────────────────────────────
 * User A has answered 200 reading questions across 10 practice tests:
 * - Vocabulary questions: 95% accuracy → skip these (mastered)
 * - Inference questions: 45% accuracy → 60% of today's batch
 * - Detail questions: 75% accuracy → 20% of today's batch (consolidation)
 * - Random: 20% of today's batch
 * Result: If 20 questions requested → ~12 inference (weak), ~4 detail (medium), ~4 random
 *
 * PRIORITY TUNING
 * ───────────────────────────────────────────────────────────────────────────
 * To adjust weighting, modify these lines in getSmartQuestionOrder():
 * - weakCount = Math.ceil(limit * 0.6)    // Currently 60% → try 0.7 for more focus
 * - mediumCount = Math.ceil(limit * 0.2)  // Currently 20% → try 0.15 to redistribute
 * - randomCount = limit - weakCount - mediumCount  // Automatically adjusts
 */

import type { Env } from '../types';

interface WeakArea {
  content_id: number;
  priority: number; // 1 (highest) to 100 (lowest)
  reason: string; // 'low_stability' | 'low_accuracy' | 'overdue'
  section: string;
  question_type: string;
}

/**
 * Find the user's weakest areas from FSRS + accuracy data
 * Returns a list of content IDs ordered by priority
 */
async function findWeakAreas(
  env: Env,
  userId: number,
  testType: string,
  section?: string,
): Promise<WeakArea[]> {
  const weakAreas: WeakArea[] = [];

  // 1. Query FSRS cards for low stability (not well memorized)
  // Stability < 5 means the material needs reinforcement
  const lowStabilityResult = await env.DB.prepare(
    `SELECT sr.content_id, json_extract(sr.fsrs_state, '$.stability') as stability, sr.section, sr.question_type
     FROM spaced_repetition sr
     WHERE sr.user_id = ? AND sr.fsrs_state IS NOT NULL
     AND json_extract(sr.fsrs_state, '$.stability') < 5
     ORDER BY json_extract(sr.fsrs_state, '$.stability') ASC
     LIMIT 100`
  ).bind(userId).all();

  const stabilitiesById = new Map<number, number>();
  for (const row of lowStabilityResult.results || []) {
    const contentId = (row as any).content_id;
    const stability = (row as any).stability || 0;
    stabilitiesById.set(contentId, stability);

    if (contentId) {
      weakAreas.push({
        content_id: contentId,
        priority: Math.max(1, Math.round(stability * 10)), // Priority 1-50 (lower is higher priority)
        reason: 'low_stability',
        section: (row as any).section,
        question_type: (row as any).question_type,
      });
    }
  }

  // 2. Query overdue items (next_review is in the past)
  const overdueResult = await env.DB.prepare(
    `SELECT sr.content_id, sr.section, sr.question_type
     FROM spaced_repetition sr
     WHERE sr.user_id = ? AND sr.next_review_at <= datetime('now')
     AND sr.content_id NOT IN (SELECT content_id FROM spaced_repetition WHERE user_id = ? AND content_id IS NOT NULL AND json_extract(fsrs_state, '$.stability') < 5)
     ORDER BY sr.next_review_at ASC
     LIMIT 50`
  ).bind(userId, userId).all();

  for (const row of overdueResult.results || []) {
    const contentId = (row as any).content_id;
    if (contentId && !stabilitiesById.has(contentId)) {
      weakAreas.push({
        content_id: contentId,
        priority: 5, // High priority for overdue items
        reason: 'overdue',
        section: (row as any).section,
        question_type: (row as any).question_type,
      });
    }
  }

  // 3. Query attempt_answers for low accuracy by question_type
  const lowAccuracyResult = await env.DB.prepare(
    `SELECT tc.id, tc.section, tc.question_type,
            ROUND(AVG(CASE WHEN aa.is_correct = 1 THEN 100.0 ELSE 0.0 END)) as accuracy,
            COUNT(*) as attempts
     FROM test_contents tc
     LEFT JOIN attempt_answers aa ON aa.content_id = tc.id
     LEFT JOIN test_attempts ta ON ta.id = aa.attempt_id
     WHERE ta.user_id = ? AND tc.test_type = ?
     AND aa.is_correct IS NOT NULL
     AND tc.status = 'published'
     GROUP BY tc.id, tc.question_type
     HAVING accuracy < 70 AND attempts >= 2
     ORDER BY accuracy ASC
     LIMIT 100`
  ).bind(userId, testType).all();

  const processedIds = new Set(weakAreas.map((w) => w.content_id));
  for (const row of lowAccuracyResult.results || []) {
    const contentId = (row as any).id;
    if (contentId && !processedIds.has(contentId)) {
      const accuracy = (row as any).accuracy || 50;
      weakAreas.push({
        content_id: contentId,
        priority: Math.max(1, Math.round((100 - accuracy) / 5)), // Priority inversely proportional to accuracy
        reason: 'low_accuracy',
        section: (row as any).section,
        question_type: (row as any).question_type,
      });
      processedIds.add(contentId);
    }
  }

  return weakAreas.sort((a, b) => a.priority - b.priority);
}

/**
 * Build weighted question order: 60% weak, 20% medium, 20% random
 * Returns list of content IDs in priority order
 */
export async function getSmartQuestionOrder(
  env: Env,
  userId: number,
  testType: string,
  section: string,
  limit: number = 50,
): Promise<number[] | null> {
  try {
    // Check if user has any SRS data
    const srsCount = await env.DB.prepare(
      'SELECT COUNT(*) as count FROM spaced_repetition WHERE user_id = ?'
    ).bind(userId).first() as any;

    // Also check for attempt history
    const attemptCount = await env.DB.prepare(
      `SELECT COUNT(*) as count FROM attempt_answers aa
       JOIN test_attempts ta ON ta.id = aa.attempt_id
       WHERE ta.user_id = ? AND ta.test_type = ?`
    ).bind(userId, testType).first() as any;

    const totalData = (srsCount?.count || 0) + (attemptCount?.count || 0);

    // If no historical data, return null to fall back to random
    if (totalData === 0) {
      return null;
    }

    const weakAreas = await findWeakAreas(env, userId, testType, section);

    if (weakAreas.length === 0) {
      return null; // No weak areas identified, use random
    }

    // Get total published questions for this section
    const totalResult = await env.DB.prepare(
      `SELECT COUNT(*) as count FROM test_contents
       WHERE test_type = ? AND section = ? AND status = 'published'`
    ).bind(testType, section).first() as any;

    const totalQuestions = totalResult?.count || 0;
    if (totalQuestions === 0) return null;

    // Calculate allocation
    const weakCount = Math.ceil(limit * 0.6); // 60% weak areas
    const mediumCount = Math.ceil(limit * 0.2); // 20% medium areas
    const randomCount = limit - weakCount - mediumCount; // Remaining for random

    const selectedIds: number[] = [];

    // 1. Select from weak areas (highest priority first)
    const weakIds = weakAreas.slice(0, weakCount).map((w) => w.content_id).filter((id) => id);
    selectedIds.push(...weakIds);

    // 2. Select from medium areas (accuracy 70-85%)
    if (mediumCount > 0) {
      const mediumResult = await env.DB.prepare(
        `SELECT DISTINCT tc.id
         FROM test_contents tc
         LEFT JOIN attempt_answers aa ON aa.content_id = tc.id
         LEFT JOIN test_attempts ta ON ta.id = aa.attempt_id
         WHERE ta.user_id = ? AND tc.test_type = ? AND tc.section = ?
         AND tc.status = 'published'
         AND aa.is_correct IS NOT NULL
         AND ROUND(AVG(CASE WHEN aa.is_correct = 1 THEN 100.0 ELSE 0.0 END)) BETWEEN 70 AND 85
         GROUP BY tc.id
         ORDER BY RANDOM()
         LIMIT ?`
      ).bind(userId, testType, section, mediumCount).all();

      for (const row of mediumResult.results || []) {
        const id = (row as any).id;
        if (id && !selectedIds.includes(id)) {
          selectedIds.push(id);
        }
      }
    }

    // 3. Fill remaining with random questions (not already selected)
    if (randomCount > 0 && selectedIds.length < limit) {
      const remaining = limit - selectedIds.length;
      const selectedPlaceholders = selectedIds.map(() => '?').join(',');
      const randomQuery = selectedIds.length > 0
        ? `SELECT id FROM test_contents
           WHERE test_type = ? AND section = ? AND status = 'published'
           AND id NOT IN (${selectedPlaceholders})
           ORDER BY RANDOM() LIMIT ?`
        : `SELECT id FROM test_contents
           WHERE test_type = ? AND section = ? AND status = 'published'
           ORDER BY RANDOM() LIMIT ?`;

      const randomParams = selectedIds.length > 0
        ? [testType, section, ...selectedIds, remaining]
        : [testType, section, remaining];

      const randomResult = await env.DB.prepare(randomQuery).bind(...randomParams).all();
      for (const row of randomResult.results || []) {
        const id = (row as any).id;
        if (id && !selectedIds.includes(id)) {
          selectedIds.push(id);
        }
      }
    }

    return selectedIds.length > 0 ? selectedIds : null;
  } catch (e) {
    console.error('Error in getSmartQuestionOrder:', e);
    return null; // Fall back to random on error
  }
}

/**
 * Reorder questions based on smart sequencing
 * Transforms a flat list of questions into priority order
 */
export async function reorderQuestionsSmart(
  env: Env,
  userId: number,
  questions: any[],
  testType: string,
  section: string,
): Promise<any[]> {
  try {
    const smartOrder = await getSmartQuestionOrder(env, userId, testType, section, questions.length);

    if (!smartOrder || smartOrder.length === 0) {
      return questions; // Return original order if smart sequencing unavailable
    }

    // Create map of id -> question
    const questionMap = new Map(questions.map((q) => [q.id, q]));

    // Reorder based on smart order, then append any remaining questions
    const reordered: any[] = [];
    for (const id of smartOrder) {
      const q = questionMap.get(id);
      if (q) {
        reordered.push(q);
        questionMap.delete(id);
      }
    }

    // Append remaining questions (in case they weren't in smart order)
    const remainingQuestions = Array.from(questionMap.values());
    for (const q of remainingQuestions) {
      reordered.push(q);
    }

    return reordered;
  } catch (e) {
    console.error('Error in reorderQuestionsSmart:', e);
    return questions; // Return original on error
  }
}
