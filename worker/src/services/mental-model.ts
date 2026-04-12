/**
 * Theory-of-Mind Engine — Student Mental Model Tracking
 *
 * Inspired by tutor-gpt (Plastic Labs): the tutor maintains a living model
 * of what it BELIEVES the student knows vs. doesn't know, including
 * detected misconceptions. This drives truly personalized instruction.
 *
 * Key insight: A student getting a question right doesn't mean they understand.
 * A student getting it wrong doesn't mean they're clueless. The mental model
 * tracks EVIDENCE over time to build genuine understanding assessment.
 */

import type { Env } from '../types';

export interface ConceptModel {
  concept: string;
  believed_understanding: 'unknown' | 'misconception' | 'partial' | 'solid' | 'mastered';
  evidence: EvidenceEntry[];
  misconceptions: string[];
  confidence: number;
  times_assessed: number;
  last_assessed_at: string | null;
}

interface EvidenceEntry {
  type: 'correct_answer' | 'wrong_answer' | 'self_explanation' | 'question_asked' | 'tutor_assessment';
  detail: string;
  timestamp: string;
  weight: number; // How strong this evidence is (0-1)
}

// ═══════════════════════════════════════════════════════
// CONCEPT TAXONOMY — What concepts exist in TOEFL/IELTS
// ═══════════════════════════════════════════════════════
export const CONCEPT_MAP: Record<string, string[]> = {
  // Grammar concepts
  articles: ['definite_article', 'indefinite_article', 'zero_article', 'article_with_proper_nouns'],
  tenses: ['simple_present', 'present_continuous', 'present_perfect', 'present_perfect_continuous',
           'simple_past', 'past_continuous', 'past_perfect', 'future_forms',
           'present_perfect_vs_past_simple', 'tense_sequence_in_reported_speech'],
  sv_agreement: ['basic_sv_agreement', 'collective_nouns', 'indefinite_pronouns', 'there_is_there_are',
                 'inverted_sentences', 'complex_subjects'],
  conditionals: ['zero_conditional', 'first_conditional', 'second_conditional', 'third_conditional',
                 'mixed_conditionals', 'wish_clauses'],
  passive_voice: ['basic_passive', 'passive_with_modals', 'passive_reporting_verbs', 'get_passive'],
  relative_clauses: ['defining_relative', 'non_defining_relative', 'reduced_relative', 'relative_pronoun_choice'],

  // Vocabulary concepts
  academic_words: ['context_clues', 'word_families', 'academic_collocations', 'register_awareness',
                   'latin_greek_roots', 'nominalisation'],
  collocations: ['verb_noun_collocations', 'adjective_noun_collocations', 'adverb_adjective_collocations',
                 'delexical_verbs'],

  // Reading concepts
  reading_main_idea: ['topic_sentence_identification', 'thesis_vs_topic', 'summary_skills',
                       'distinguishing_main_from_detail'],
  reading_strategy: ['skimming', 'scanning', 'inference', 'vocabulary_in_context',
                     'reference_questions', 'negative_factual', 'insert_text'],

  // Listening concepts
  listening_practice: ['main_idea_listening', 'detail_listening', 'inference_listening',
                        'attitude_purpose', 'connecting_content', 'lecture_organization'],

  // Speaking concepts
  speaking_templates: ['independent_speaking_structure', 'integrated_speaking_structure',
                        'note_taking_for_speaking', 'timing_management', 'filler_reduction'],

  // Writing concepts
  writing_templates: ['integrated_writing_structure', 'independent_essay_structure',
                      'academic_writing_style', 'paragraph_development', 'thesis_statement',
                      'counter_argument', 'citation_and_evidence'],
};

// ═══════════════════════════════════════════════════════
// PUBLIC API
// ═══════════════════════════════════════════════════════

/**
 * Get the mental model for a student — what we believe they know.
 */
export async function getStudentMentalModel(env: Env, userId: number): Promise<ConceptModel[]> {
  const rows = await env.DB.prepare(
    'SELECT * FROM student_mental_model WHERE user_id = ? ORDER BY believed_understanding ASC'
  ).bind(userId).all();

  return (rows.results || []).map((r: any) => ({
    concept: r.concept,
    believed_understanding: r.believed_understanding,
    evidence: safeJSON(r.evidence, []),
    misconceptions: safeJSON(r.misconceptions, []),
    confidence: r.confidence,
    times_assessed: r.times_assessed,
    last_assessed_at: r.last_assessed_at,
  }));
}

/**
 * Get concepts where we believe the student has misconceptions.
 */
export async function getMisconceptions(env: Env, userId: number): Promise<ConceptModel[]> {
  const rows = await env.DB.prepare(
    `SELECT * FROM student_mental_model WHERE user_id = ? AND believed_understanding = 'misconception'`
  ).bind(userId).all();

  return (rows.results || []).map(mapRow);
}

/**
 * Get knowledge gaps — concepts that are unknown or partial.
 */
export async function getKnowledgeGaps(env: Env, userId: number): Promise<ConceptModel[]> {
  const rows = await env.DB.prepare(
    `SELECT * FROM student_mental_model WHERE user_id = ?
     AND believed_understanding IN ('unknown', 'partial', 'misconception')
     ORDER BY confidence DESC, times_assessed DESC LIMIT 20`
  ).bind(userId).all();

  return (rows.results || []).map(mapRow);
}

/**
 * Record evidence about a student's understanding of a concept.
 * This is the core of the Theory-of-Mind: accumulating evidence
 * rather than making snap judgments.
 */
export async function recordEvidence(
  env: Env,
  userId: number,
  concept: string,
  evidenceType: EvidenceEntry['type'],
  detail: string,
  weight: number = 0.5,
): Promise<ConceptModel> {
  // Get or create concept model
  let existing = await env.DB.prepare(
    'SELECT * FROM student_mental_model WHERE user_id = ? AND concept = ?'
  ).bind(userId, concept).first() as any;

  const newEvidence: EvidenceEntry = {
    type: evidenceType,
    detail,
    timestamp: new Date().toISOString(),
    weight,
  };

  if (!existing) {
    // Create new
    const evidence = [newEvidence];
    const understanding = inferUnderstanding(evidence, []);

    await env.DB.prepare(
      `INSERT INTO student_mental_model (user_id, concept, believed_understanding, evidence, misconceptions, confidence, times_assessed, last_assessed_at)
       VALUES (?, ?, ?, ?, '[]', ?, 1, datetime('now'))`
    ).bind(userId, concept, understanding, JSON.stringify(evidence), weight).run();

    return {
      concept,
      believed_understanding: understanding,
      evidence,
      misconceptions: [],
      confidence: weight,
      times_assessed: 1,
      last_assessed_at: new Date().toISOString(),
    };
  }

  // Update existing
  const evidence: EvidenceEntry[] = safeJSON(existing.evidence, []);
  evidence.push(newEvidence);

  // Keep last 20 evidence entries (recency-weighted)
  if (evidence.length > 20) {
    evidence.splice(0, evidence.length - 20);
  }

  const misconceptions: string[] = safeJSON(existing.misconceptions, []);
  const understanding = inferUnderstanding(evidence, misconceptions);

  // Confidence increases with more assessments (diminishing returns)
  const newConfidence = Math.min(0.95, 1 - 1 / (existing.times_assessed + 2));

  await env.DB.prepare(
    `UPDATE student_mental_model SET
       believed_understanding = ?, evidence = ?, confidence = ?,
       times_assessed = times_assessed + 1,
       last_assessed_at = datetime('now'), updated_at = datetime('now')
     WHERE user_id = ? AND concept = ?`
  ).bind(understanding, JSON.stringify(evidence), newConfidence, userId, concept).run();

  return {
    concept,
    believed_understanding: understanding,
    evidence,
    misconceptions,
    confidence: newConfidence,
    times_assessed: existing.times_assessed + 1,
    last_assessed_at: new Date().toISOString(),
  };
}

/**
 * Record a misconception detected by the tutor.
 */
export async function recordMisconception(
  env: Env,
  userId: number,
  concept: string,
  misconception: string,
): Promise<void> {
  const existing = await env.DB.prepare(
    'SELECT misconceptions FROM student_mental_model WHERE user_id = ? AND concept = ?'
  ).bind(userId, concept).first() as any;

  if (existing) {
    const misconceptions: string[] = safeJSON(existing.misconceptions, []);
    if (!misconceptions.includes(misconception)) {
      misconceptions.push(misconception);
    }

    await env.DB.prepare(
      `UPDATE student_mental_model SET
         misconceptions = ?, believed_understanding = 'misconception', updated_at = datetime('now')
       WHERE user_id = ? AND concept = ?`
    ).bind(JSON.stringify(misconceptions), userId, concept).run();
  } else {
    await env.DB.prepare(
      `INSERT INTO student_mental_model (user_id, concept, believed_understanding, misconceptions, last_assessed_at)
       VALUES (?, ?, 'misconception', ?, datetime('now'))`
    ).bind(userId, concept, JSON.stringify([misconception])).run();
  }
}

/**
 * Generate a mental model summary for the tutor prompt.
 * This is injected into the system prompt so the tutor knows what to focus on.
 */
export async function buildMentalModelContext(env: Env, userId: number): Promise<string> {
  const model = await getStudentMentalModel(env, userId);
  if (model.length === 0) return '';

  const lines: string[] = ['MENTAL MODEL — What you believe this student knows:'];

  // Group by understanding level
  const misconceptions = model.filter(m => m.believed_understanding === 'misconception');
  const partial = model.filter(m => m.believed_understanding === 'partial');
  const solid = model.filter(m => m.believed_understanding === 'solid');
  const mastered = model.filter(m => m.believed_understanding === 'mastered');

  if (misconceptions.length > 0) {
    lines.push(`MISCONCEPTIONS (prioritas tertinggi!): ${misconceptions.map(m =>
      `${m.concept}${m.misconceptions.length > 0 ? ` [salah paham: ${m.misconceptions[0]}]` : ''}`
    ).join(', ')}`);
  }

  if (partial.length > 0) {
    lines.push(`PARTIAL: ${partial.map(m => m.concept).join(', ')} — perlu penguatan.`);
  }

  if (solid.length > 0) {
    lines.push(`SOLID: ${solid.map(m => m.concept).join(', ')} — sudah paham, jangan over-explain.`);
  }

  if (mastered.length > 0) {
    lines.push(`MASTERED: ${mastered.map(m => m.concept).join(', ')} — skip kecuali diminta.`);
  }

  return lines.join('\n');
}

// ═══════════════════════════════════════════════════════
// INFERENCE ENGINE — Determine understanding from evidence
// ═══════════════════════════════════════════════════════

function inferUnderstanding(
  evidence: EvidenceEntry[],
  misconceptions: string[],
): ConceptModel['believed_understanding'] {
  if (misconceptions.length > 0) return 'misconception';
  if (evidence.length === 0) return 'unknown';

  // Weight recent evidence more heavily
  const recentEvidence = evidence.slice(-10);
  const correctWeight = recentEvidence
    .filter(e => e.type === 'correct_answer' || e.type === 'self_explanation')
    .reduce((sum, e) => sum + e.weight, 0);
  const wrongWeight = recentEvidence
    .filter(e => e.type === 'wrong_answer')
    .reduce((sum, e) => sum + e.weight, 0);
  const totalWeight = correctWeight + wrongWeight;

  if (totalWeight === 0) return 'unknown';

  const ratio = correctWeight / totalWeight;

  if (ratio >= 0.9 && recentEvidence.length >= 5) return 'mastered';
  if (ratio >= 0.7) return 'solid';
  if (ratio >= 0.4) return 'partial';
  return 'misconception';
}

// ═══════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════

function mapRow(r: any): ConceptModel {
  return {
    concept: r.concept,
    believed_understanding: r.believed_understanding,
    evidence: safeJSON(r.evidence, []),
    misconceptions: safeJSON(r.misconceptions, []),
    confidence: r.confidence,
    times_assessed: r.times_assessed,
    last_assessed_at: r.last_assessed_at,
  };
}

function safeJSON(val: any, fallback: any): any {
  if (!val) return fallback;
  if (typeof val === 'object') return val;
  try { return JSON.parse(val); } catch { return fallback; }
}
