/**
 * Pre-test drill service.
 *
 * The bot-directs-student-to-mini-app half of the feedback loop. Given a
 * user and an upcoming section, this picks their 1–3 weakest concepts and
 * constructs a mini-app deep link that loads a targeted drill.
 *
 * Why not just route them to the section practice and let RNG pick?
 * Because most weakness signals we have are specific: a student with low
 * mental-model confidence on "inference" benefits far more from 3 targeted
 * inference questions than from 10 random reading questions (which might
 * not touch inference at all). Weakness-targeted drills convert the mental
 * model's signal into practice volume.
 *
 * Weakness sources, in priority order:
 *   1. student_mental_model rows where believed_understanding is
 *      'misconception' | 'unknown' | 'partial' — strongest signal, comes
 *      from actual tutor conversations.
 *   2. Recent wrong answers (last 50) in attempt_answers, clustered by
 *      skill_tag — fallback when mental model is sparse (which it often is
 *      for new users).
 *   3. Section-wide accuracy from learning curves — weakest-signal fallback,
 *      just pick the section and let the drill be generic.
 *
 * Zero weakness signals? We return null and the caller skips the offer.
 * The bot should never make up a drill for the sake of suggesting one.
 */

import type { Env } from '../types';
import { humanizeConcept } from './post-test-review';

export interface WeakConcept {
  concept: string;            // skill_tag
  signal: 'mental_model' | 'recent_wrongs' | 'section_accuracy';
  evidence_count: number;     // misses, low-confidence events, etc.
  section_hint?: string;      // which section this concept lives in (best-effort)
}

export interface DrillSuggestion {
  concepts: WeakConcept[];
  url: string;                 // mini-app deep link with ?drill params
  count: number;               // question count the drill will load
  rationale: string;           // one-line reason string for the bot message
}

// ═══════════════════════════════════════════════════════
// WEAK CONCEPT DETECTION
// ═══════════════════════════════════════════════════════

export async function pickWeakConcepts(
  env: Env,
  userId: number,
  sectionFilter?: string, // optional: 'reading' | 'listening' | ...
  maxConcepts: number = 2,
): Promise<WeakConcept[]> {
  const results: WeakConcept[] = [];
  const seen = new Set<string>();

  // 1. Mental model — strongest signal
  try {
    const mmRows = await env.DB.prepare(
      `SELECT concept, believed_understanding, confidence, times_assessed
       FROM student_mental_model
       WHERE user_id = ?
         AND believed_understanding IN ('misconception', 'unknown', 'partial')
       ORDER BY
         CASE believed_understanding
           WHEN 'misconception' THEN 0
           WHEN 'unknown' THEN 1
           WHEN 'partial' THEN 2
           ELSE 3
         END,
         confidence ASC,
         times_assessed DESC
       LIMIT 10`
    ).bind(userId).all();

    for (const r of ((mmRows.results || []) as any[])) {
      if (results.length >= maxConcepts) break;
      if (seen.has(r.concept)) continue;
      // Only include if a question exists for this concept (avoid offering
      // drills we can't populate)
      if (!await conceptHasQuestions(env, r.concept, sectionFilter)) continue;
      seen.add(r.concept);
      results.push({
        concept: r.concept,
        signal: 'mental_model',
        evidence_count: r.times_assessed || 1,
      });
    }
  } catch { /* best-effort */ }

  if (results.length >= maxConcepts) return results;

  // 2. Recent wrong answers — fallback. Cluster last 50 wrongs by skill_tag.
  try {
    let query = `SELECT tc.skill_tags
                 FROM attempt_answers aa
                 JOIN test_contents tc ON tc.id = aa.content_id
                 WHERE aa.user_id = ? AND aa.is_correct = 0`;
    const params: any[] = [userId];
    if (sectionFilter) {
      query += ' AND aa.section = ?';
      params.push(sectionFilter);
    }
    query += ' ORDER BY aa.id DESC LIMIT 50';

    const recent = await env.DB.prepare(query).bind(...params).all();
    const counts = new Map<string, number>();
    for (const row of ((recent.results || []) as any[])) {
      try {
        const tags = JSON.parse(String(row.skill_tags || '[]'));
        if (!Array.isArray(tags)) continue;
        for (const tag of tags) {
          if (!tag) continue;
          counts.set(tag, (counts.get(tag) || 0) + 1);
        }
      } catch { /* ignore */ }
    }
    const sorted = Array.from(counts.entries())
      .filter(([, n]) => n >= 2) // 2+ misses on same tag before we call it weak
      .sort((a, b) => b[1] - a[1]);
    for (const [concept, n] of sorted) {
      if (results.length >= maxConcepts) break;
      if (seen.has(concept)) continue;
      if (!await conceptHasQuestions(env, concept, sectionFilter)) continue;
      seen.add(concept);
      results.push({
        concept,
        signal: 'recent_wrongs',
        evidence_count: n,
      });
    }
  } catch { /* best-effort */ }

  return results;
}

/** Returns true if at least one published question exists for the concept. */
async function conceptHasQuestions(env: Env, concept: string, sectionFilter?: string): Promise<boolean> {
  try {
    const like = `%"${concept}"%`;
    let q = `SELECT id FROM test_contents
             WHERE status = 'published' AND skill_tags LIKE ?`;
    const params: any[] = [like];
    if (sectionFilter) {
      q += ' AND section = ?';
      params.push(sectionFilter);
    }
    q += ' LIMIT 1';
    const row = await env.DB.prepare(q).bind(...params).first();
    return !!row;
  } catch { return false; }
}

// ═══════════════════════════════════════════════════════
// DRILL URL + SUGGESTION
// ═══════════════════════════════════════════════════════

/**
 * Build a mini-app URL with drill params. The frontend (TestSelection.tsx)
 * detects these params and loads a targeted drill instead of the normal
 * section picker.
 */
export function buildDrillUrl(env: Env, concept: string, count: number = 3): string {
  const base = (env as any).WEBAPP_URL || 'https://edubot-webapp.pages.dev';
  const params = new URLSearchParams({
    drill: '1',
    concept,
    count: String(count),
  });
  return `${base}/?${params.toString()}`;
}

/**
 * Top-level helper: picks weak concepts + builds a single drill suggestion
 * (first concept gets the drill; any remaining weak concepts are included
 * in the suggestion for display but the first click targets the top one).
 * Returns null if there's nothing weak enough to drill on.
 */
export async function suggestDrills(
  env: Env,
  userId: number,
  sectionFilter?: string,
  count: number = 3,
): Promise<DrillSuggestion | null> {
  const weak = await pickWeakConcepts(env, userId, sectionFilter, 2);
  if (weak.length === 0) return null;

  const primary = weak[0];
  const url = buildDrillUrl(env, primary.concept, count);

  const conceptDisplay = weak.map((w) => humanizeConcept(w.concept)).join(', ');
  const rationale = weak[0].signal === 'mental_model'
    ? `Saya lihat *${conceptDisplay}* masih terasa belum mantap dari diskusi kita — ${count} soal drill bisa bantu ngetes.`
    : `Jawaban salah kamu belakangan banyak di *${conceptDisplay}* — ${count} soal drill bisa bantu nutup gap-nya.`;

  return {
    concepts: weak,
    url,
    count,
    rationale,
  };
}
