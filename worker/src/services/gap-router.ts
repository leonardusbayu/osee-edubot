// ─── Weakness-to-lesson gap router (ROADMAP_M3 §1.3) ──────────────────
// /today must always serve the HIGHEST SCORE-LEVERAGE topic, with a
// logged reason — not the next item in a static syllabus.

import type { Env } from '../types';

export interface TopicGap {
  topic: string;
  section: string;
  weightPct: number;   // section weight in the target exam, 0-100
  accuracyPct: number; // student accuracy on this topic, 0-100
  gapScore: number;    // (1 - accuracy) × section_weight × recency_boost
  reason: string;      // one-line Indonesian explanation
}

// ── Topic → section family ────────────────────────────────────────────
// Topic names mirror the topic arrays in studyplan.ts (TOEFL_IBT_TOPICS,
// TOEFL_ITP_TOPICS, IELTS_TOPICS, TOEIC_TOPICS). Keep in sync.
const TOPIC_SECTION: Record<string, string> = {
  // Reading
  reading_strategy: 'reading',
  paraphrasing: 'reading',
  true_false_not_given: 'reading',
  matching_headings: 'reading',
  business_reading: 'reading',
  // Listening
  listening_strategy: 'listening',
  note_taking: 'listening',
  // Speaking
  speaking_templates: 'speaking',
  integrated_speaking: 'speaking',
  cue_card_speaking: 'speaking',
  pronunciation: 'speaking',
  // Writing
  writing_templates: 'writing',
  integrated_writing: 'writing',
  business_writing: 'writing',
  linking_words: 'writing',
  // Structure / grammar
  articles: 'structure',
  sv_agreement: 'structure',
  tenses: 'structure',
  prepositions: 'structure',
  passive_voice: 'structure',
  conditionals: 'structure',
  relative_clauses: 'structure',
  word_formation: 'structure',
  parallelism: 'structure',
  sentence_completion: 'structure',
  // Vocabulary
  academic_words: 'vocabulary',
  collocations: 'vocabulary',
  business_vocabulary: 'vocabulary',
};

// ── Section weights per test type (fraction of final score the section
// family contributes — pragmatic estimates, not official) ─────────────
export const SECTION_WEIGHTS: Record<string, Record<string, number>> = {
  TOEFL_IBT: {
    reading: 0.25, listening: 0.25, speaking: 0.25, writing: 0.25,
    structure: 0.15, vocabulary: 0.15, // cross-cutting: feed all sections
  },
  TOEFL_ITP: {
    structure: 0.40, reading: 0.30, listening: 0.30,
    vocabulary: 0.15, speaking: 0.02, writing: 0.02,
  },
  IELTS: {
    reading: 0.25, listening: 0.25, speaking: 0.25, writing: 0.25,
    structure: 0.15, vocabulary: 0.15,
  },
  TOEIC: {
    listening: 0.50, reading: 0.50,
    structure: 0.25, vocabulary: 0.20, speaking: 0.03, writing: 0.03,
  },
};

const SECTION_LABEL: Record<string, string> = {
  reading: 'Reading', listening: 'Listening', speaking: 'Speaking',
  writing: 'Writing', structure: 'Structure/Grammar', vocabulary: 'Vocabulary',
};

const TEST_LABEL: Record<string, string> = {
  TOEFL_IBT: 'TOEFL iBT', TOEFL_ITP: 'TOEFL ITP', IELTS: 'IELTS', TOEIC: 'TOEIC',
};

/**
 * Compute the top score-leverage gaps for a student.
 * gap score = (1 − accuracy) × section_weight × recency_boost.
 * Topics practiced in the last 7 days with low accuracy get a 1.5× boost
 * (the student is actively struggling there right now).
 */
export async function computeTopGaps(
  env: Env,
  userId: number,
  testType: string,
  limit = 3,
): Promise<TopicGap[]> {
  const weights = SECTION_WEIGHTS[testType] || SECTION_WEIGHTS['TOEFL_IBT'];

  // 1) Per-topic mastery/accuracy from topic_mastery
  const rows = (await env.DB.prepare(
    `SELECT topic, mastery_level, exercises_attempted, exercises_correct,
            accuracy_percent, last_attempted_at
     FROM topic_mastery WHERE user_id = ?`
  ).bind(userId).all()).results as any[];

  // 2) Recent per-section accuracy from attempt_answers (last 7 days),
  //    blended in so fresh test data influences topic gaps.
  const sectionRecent: Record<string, number> = {};
  try {
    const recent = (await env.DB.prepare(
      `SELECT aa.section, AVG(CASE WHEN aa.is_correct = 1 THEN 1.0 ELSE 0.0 END) AS acc
       FROM attempt_answers aa
       JOIN test_attempts ta ON ta.id = aa.attempt_id
       WHERE ta.user_id = ? AND aa.is_correct IS NOT NULL
         AND aa.submitted_at >= datetime('now', '-7 days')
       GROUP BY aa.section`
    ).bind(userId).all()).results as any[];
    for (const r of recent) {
      const sec = String(r.section || '').toLowerCase();
      if (sec) sectionRecent[sec] = Number(r.acc);
    }
  } catch { /* attempt_answers may be empty/missing — ignore */ }

  const now = Date.now();
  const gaps: TopicGap[] = [];

  for (const row of rows) {
    const topic = String(row.topic || '');
    const section = TOPIC_SECTION[topic];
    if (!section) continue;
    const weight = weights[section] || 0;
    if (weight <= 0) continue;

    // Topic accuracy: prefer real exercise accuracy, fall back to mastery_level
    let accuracy: number;
    if (Number(row.exercises_attempted) > 0) {
      accuracy = Number(row.accuracy_percent || 0) / 100;
    } else {
      accuracy = Number(row.mastery_level || 0) / 100;
    }
    // Blend with recent section accuracy when available (70% topic / 30% section)
    if (sectionRecent[section] != null) {
      accuracy = accuracy * 0.7 + sectionRecent[section] * 0.3;
    }
    accuracy = Math.max(0, Math.min(1, accuracy));

    // Recency boost: practiced in last 7 days AND still weak → 1.5×
    let boost = 1.0;
    if (row.last_attempted_at) {
      const last = Date.parse(String(row.last_attempted_at).replace(' ', 'T') + 'Z');
      if (!isNaN(last) && now - last <= 7 * 24 * 60 * 60 * 1000 && accuracy < 0.6) {
        boost = 1.5;
      }
    }

    const gapScore = (1 - accuracy) * weight * boost;
    const weightPct = Math.round(weight * 100);
    const accuracyPct = Math.round(accuracy * 100);
    const reason = `${topic.replace(/_/g, ' ')}: ${weightPct}% bobot ${SECTION_LABEL[section]} ${TEST_LABEL[testType] || testType}, akurasi kamu ${accuracyPct}%`;

    gaps.push({ topic, section, weightPct, accuracyPct, gapScore, reason });
  }

  gaps.sort((a, b) => b.gapScore - a.gapScore);
  return gaps.slice(0, limit);
}

/** Log why a topic was routed to a student today (auditable answer to
 *  "why is THIS today's lesson?"). Best-effort: never throws. */
export async function logRouting(
  env: Env,
  userId: number,
  topic: string,
  reason: string,
): Promise<void> {
  try {
    await env.DB.prepare(
      'INSERT INTO gap_routing_log (user_id, topic, reason) VALUES (?, ?, ?)'
    ).bind(userId, topic, reason).run();
  } catch { /* table may not exist yet — ignore */ }
}
