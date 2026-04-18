/**
 * Post-test review service.
 *
 * Wires the mini-app → bot feedback loop. When a student finishes a test,
 * the finish endpoint calls this service which:
 *   1. ingests each wrong answer into FSRS so spaced repetition picks it up,
 *   2. analyzes the attempt to find 1–3 concepts worth teaching (triage),
 *   3. sends a Telegram nudge with [Ya, review] / [Nanti] buttons,
 *   4. when the student accepts, drives a scripted walk through each concept
 *      using the existing teach-then-check engine (lesson_cq_active + the
 *      [CHECK] block parser in comprehension-check.ts).
 *
 * The "free to ignore" principle shapes every user-facing step: the nudge
 * is a single message (not repeated), each concept in the walk ends with a
 * "lanjut atau cukup?" choice, and the review record is marked 'skipped'
 * the moment the student taps any opt-out.
 */

import type { Env } from '../types';
import { addToReview } from './fsrs-engine';
import { sendMessage } from '../bot/webhook';

// ═══════════════════════════════════════════════════════
// CONFIG
// ═══════════════════════════════════════════════════════

// Absolute cap on concepts we'll teach in one wrap-up. Even if 10 concepts
// were missed, after 3 the student is exhausted and ROI drops. The rest stay
// in FSRS and resurface spaced-out over the following days.
const MAX_CONCEPTS_PER_REVIEW = 3;

// A concept needs at least this many misses in the attempt to be worth a
// dedicated teach block. Single misses on a concept are often careless —
// they go to FSRS but don't trigger a review conversation.
const MIN_MISSES_FOR_REVIEW = 1;

// ═══════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════

export interface AttemptAnalysis {
  attempt_id: number;
  user_id: number;
  wrong_count: number;
  total_scored: number;
  concept_clusters: ConceptCluster[];
  triaged_concepts: string[]; // the top N concepts, ordered for teaching
}

export interface ConceptCluster {
  concept: string;               // skill_tag, e.g. "inference"
  miss_count: number;
  example_content_ids: number[]; // up to 3 sample wrongs, for context
  mental_model_confidence: number | null; // 0-1 if known, null if never assessed
  priority_score: number;        // higher = teach first
}

// ═══════════════════════════════════════════════════════
// ANALYSIS
// ═══════════════════════════════════════════════════════

/**
 * Analyze an attempt: cluster wrong answers by concept (skill_tag), rank
 * them by teaching priority, and return the top N for the review walk.
 *
 * Priority formula (higher = teach first):
 *   miss_count           — more misses on same concept = bigger gap
 *   × (1 - confidence)   — lower mental-model confidence = more value in reteach
 *                          (unknown concepts get confidence=0.5 neutral treatment)
 *   × importance_weight  — foundational concepts (main_idea, inference) slightly
 *                          boosted because they underpin many other skills
 */
export async function analyzeAttempt(
  env: Env,
  attemptId: number,
  userId: number,
): Promise<AttemptAnalysis> {
  // Load wrong answers with their content for skill_tag extraction
  const wrongs = await env.DB.prepare(
    `SELECT aa.content_id, aa.section, tc.skill_tags
     FROM attempt_answers aa
     LEFT JOIN test_contents tc ON tc.id = aa.content_id
     WHERE aa.attempt_id = ? AND aa.is_correct = 0`
  ).bind(attemptId).all();

  const totalScored = await env.DB.prepare(
    `SELECT COUNT(*) AS n FROM attempt_answers
     WHERE attempt_id = ? AND is_correct IS NOT NULL`
  ).bind(attemptId).first() as any;

  const wrongRows = (wrongs.results || []) as any[];

  // Cluster misses by skill_tag.
  // A single content row has multiple skill_tags in a JSON array — a miss
  // contributes to every tag it carries. This intentionally gives broad
  // foundational concepts (e.g. "detail") more weight than narrow ones.
  const clusters = new Map<string, ConceptCluster>();
  for (const row of wrongRows) {
    const tags = safeParseArray(row.skill_tags);
    for (const tag of tags) {
      if (!tag) continue;
      if (!clusters.has(tag)) {
        clusters.set(tag, {
          concept: tag,
          miss_count: 0,
          example_content_ids: [],
          mental_model_confidence: null,
          priority_score: 0,
        });
      }
      const c = clusters.get(tag)!;
      c.miss_count++;
      if (c.example_content_ids.length < 3 && row.content_id) {
        c.example_content_ids.push(row.content_id);
      }
    }
  }

  // Enrich with mental-model confidence (best-effort, silently degrades)
  if (clusters.size > 0) {
    try {
      const placeholders = Array.from({ length: clusters.size }, () => '?').join(',');
      const mmRows = await env.DB.prepare(
        `SELECT concept, believed_understanding, confidence
         FROM student_mental_model
         WHERE user_id = ? AND concept IN (${placeholders})`
      ).bind(userId, ...Array.from(clusters.keys())).all();
      for (const r of ((mmRows.results || []) as any[])) {
        const c = clusters.get(r.concept);
        if (!c) continue;
        c.mental_model_confidence = typeof r.confidence === 'number' ? r.confidence : null;
      }
    } catch { /* best-effort */ }
  }

  // Priority scoring
  const importanceWeight: Record<string, number> = {
    // Foundational reading/listening skills that other skills depend on
    main_idea: 1.25,
    inference: 1.2,
    detail: 1.1,
    // Grammar foundations
    subject_verb: 1.2,
    tense: 1.15,
    // Everything else defaults to 1.0 via `?? 1.0`
  };

  for (const c of clusters.values()) {
    const conf = c.mental_model_confidence ?? 0.5; // neutral if unknown
    const importance = importanceWeight[c.concept] ?? 1.0;
    c.priority_score = c.miss_count * (1 - conf * 0.5) * importance;
  }

  const sortedClusters = Array.from(clusters.values())
    .filter((c) => c.miss_count >= MIN_MISSES_FOR_REVIEW)
    .sort((a, b) => b.priority_score - a.priority_score);

  const triaged = sortedClusters.slice(0, MAX_CONCEPTS_PER_REVIEW).map((c) => c.concept);

  return {
    attempt_id: attemptId,
    user_id: userId,
    wrong_count: wrongRows.length,
    total_scored: (totalScored?.n as number) || 0,
    concept_clusters: sortedClusters,
    triaged_concepts: triaged,
  };
}

// ═══════════════════════════════════════════════════════
// AI SUMMARY — student-facing one-paragraph Indonesian summary
// ═══════════════════════════════════════════════════════

/**
 * Turn an attempt analysis + section scores into a concise Indonesian
 * paragraph the student sees on their results page. Rule-based (no extra
 * GPT call) so it's instant and free — we already have all the structured
 * data from analyzeAttempt().
 *
 * Three moves, in order:
 *   1. Acknowledge the strongest section by name (something real to feel good about)
 *   2. Call out the top 1–2 priority concepts to focus on next
 *   3. Invite them to review or keep practicing — never scold
 *
 * Returns null if there's nothing meaningful to say (e.g. zero scored
 * answers), so the caller skips the UPDATE rather than writing a vague
 * "selamat, teruskan!" message.
 */
export function buildAttemptSummary(
  analysis: AttemptAnalysis,
  sectionScores: Record<string, number | null>,
  maxBand: number,
): string | null {
  if (!analysis || analysis.total_scored === 0) return null;

  const sectionNames: Record<string, string> = {
    reading: 'Reading',
    listening: 'Listening',
    speaking: 'Speaking',
    writing: 'Writing',
    structure: 'Structure',
  };
  const conceptNames: Record<string, string> = {
    main_idea: 'main idea',
    inference: 'inference',
    detail: 'detail',
    subject_verb: 'subject-verb agreement',
    tense: 'tenses',
    vocabulary_in_context: 'vocabulary in context',
    passive_voice: 'passive voice',
    conditionals: 'conditionals',
  };
  const pretty = (concept: string): string =>
    conceptNames[concept] ?? concept.replace(/_/g, ' ');

  // Find strongest section (highest absolute score, ignoring nulls/zeros)
  let topSection: string | null = null;
  let topScore = -1;
  for (const [section, score] of Object.entries(sectionScores)) {
    if (typeof score === 'number' && score > topScore) {
      topScore = score;
      topSection = section;
    }
  }

  const parts: string[] = [];

  if (topSection && topScore >= maxBand * 0.5) {
    // Real strength — call it out specifically
    parts.push(
      `${sectionNames[topSection] ?? topSection} kamu paling kuat (${topScore}/${maxBand}). Pertahankan.`,
    );
  } else if (analysis.wrong_count === 0) {
    parts.push(`Semua jawaban objektif kamu benar — solid banget.`);
  } else if (analysis.total_scored >= 5) {
    parts.push(`Kamu udah jawab ${analysis.total_scored} soal — progress-mu tercatat.`);
  }

  // Focus: top 1–2 priority concepts, with specific miss counts so the
  // feedback feels grounded in real data, not generic.
  if (analysis.triaged_concepts.length > 0) {
    const focus = analysis.triaged_concepts.slice(0, 2).map(pretty);
    const clusterMisses = analysis.concept_clusters
      .slice(0, 2)
      .map((c) => c.miss_count)
      .reduce((a, b) => a + b, 0);
    if (focus.length === 1) {
      parts.push(`Yang masih perlu latihan lagi: ${focus[0]}.`);
    } else {
      parts.push(`Yang masih perlu latihan: ${focus.join(' dan ')}${clusterMisses > 0 ? ` (${clusterMisses} jawaban meleset)` : ''}.`);
    }
    parts.push(`Kalau mau, aku bisa bantu review konsep ini lewat /review di bot — cuma 5 menit.`);
  } else if (analysis.wrong_count > 0) {
    // Wrongs exist but no tagged concepts — happens when content rows
    // have no skill_tags. Generic but still encouraging.
    parts.push(`Ada beberapa jawaban yang bisa di-review supaya makin mantap. Coba /review di bot.`);
  } else {
    parts.push(`Siap lanjut ke tes berikutnya?`);
  }

  return parts.join(' ');
}

// ═══════════════════════════════════════════════════════
// FSRS INGEST
// ═══════════════════════════════════════════════════════

/**
 * Feed every wrong answer from the attempt into the FSRS spaced-repetition
 * queue so /review surfaces them over the next few days. Non-blocking — any
 * single failure is logged but doesn't interrupt the others.
 *
 * Guards against double-ingest by checking if the same (user_id, content_id)
 * pair is already in spaced_repetition before inserting.
 */
export async function ingestWrongsToFsrs(
  env: Env,
  attemptId: number,
  userId: number,
): Promise<{ ingested: number; skipped: number }> {
  const wrongs = await env.DB.prepare(
    `SELECT aa.content_id, aa.section, aa.student_answer, tc.question_type, tc.content AS question_data
     FROM attempt_answers aa
     LEFT JOIN test_contents tc ON tc.id = aa.content_id
     WHERE aa.attempt_id = ? AND aa.is_correct = 0`
  ).bind(attemptId).all();

  let ingested = 0;
  let skipped = 0;

  for (const row of (wrongs.results || []) as any[]) {
    if (!row.content_id) { skipped++; continue; }

    // Skip if this (user, content) pair is already being reviewed — avoids
    // stacking duplicates every time the student retakes a similar test.
    try {
      const existing = await env.DB.prepare(
        `SELECT id FROM spaced_repetition WHERE user_id = ? AND content_id = ? LIMIT 1`
      ).bind(userId, row.content_id).first();
      if (existing) { skipped++; continue; }
    } catch { /* best-effort */ }

    try {
      // Best-effort correct_answer extraction — not critical for FSRS card
      // scheduling itself, but shows the right answer in /review later.
      let correctAnswer = '';
      try {
        const parsed = JSON.parse(String(row.question_data || '{}'));
        correctAnswer = String(parsed.correct_answer ?? parsed.answer ?? (parsed.answers?.[0] ?? ''));
      } catch { /* ignore */ }

      await addToReview(
        env,
        userId,
        String(row.section || ''),
        String(row.question_type || ''),
        String(row.question_data || '{}'),
        correctAnswer,
        String(row.student_answer || ''),
        row.content_id,
      );
      ingested++;
    } catch (e) {
      skipped++;
    }
  }

  return { ingested, skipped };
}

// ═══════════════════════════════════════════════════════
// NUDGE
// ═══════════════════════════════════════════════════════

/**
 * Send the post-test nudge to the student as a Telegram message with inline
 * [Ya, review] / [Nanti] buttons. Guarded by test_attempts.review_nudge_sent_at
 * so we never double-notify.
 *
 * Behavior:
 *   • If the attempt had zero wrongs or zero triaged concepts, skip silently
 *     (nothing to teach).
 *   • If triaged has 1 concept: "Mau review konsep {X} bareng?"
 *   • If triaged has 2+ concepts: "Mau review {X} dan {Y} bareng?"
 *
 * Returns the created post_test_reviews.id (or null if we decided not to nudge).
 */
export async function sendNudge(
  env: Env,
  userId: number,
  analysis: AttemptAnalysis,
): Promise<number | null> {
  if (analysis.triaged_concepts.length === 0 || analysis.wrong_count === 0) {
    return null;
  }

  // Idempotency: don't nudge twice for the same attempt
  const attempt = await env.DB.prepare(
    `SELECT review_nudge_sent_at FROM test_attempts WHERE id = ?`
  ).bind(analysis.attempt_id).first() as any;
  if (attempt?.review_nudge_sent_at) return null;

  // Resolve chat_id from users.telegram_id
  const user = await env.DB.prepare(
    `SELECT telegram_id, name FROM users WHERE id = ?`
  ).bind(userId).first() as any;
  if (!user?.telegram_id) return null;
  const chatId = parseInt(String(user.telegram_id), 10);
  if (!Number.isFinite(chatId)) return null;

  // Create the review record up-front so the callback can advance it later
  const insertRes = await env.DB.prepare(
    `INSERT INTO post_test_reviews (user_id, attempt_id, concepts_to_review, wrong_count, status)
     VALUES (?, ?, ?, ?, 'active')`
  ).bind(
    userId,
    analysis.attempt_id,
    JSON.stringify(analysis.triaged_concepts),
    analysis.wrong_count,
  ).run();

  const reviewId = Number(insertRes.meta?.last_row_id);
  if (!reviewId) return null;

  const conceptList = formatConceptList(analysis.triaged_concepts);
  const text = analysis.triaged_concepts.length === 1
    ? `Test selesai! Ada ${analysis.wrong_count} jawaban yang meleset. Yang paling penting: *${conceptList}*.\n\nMau kita review bareng biar nggak terulang?`
    : `Test selesai! Ada ${analysis.wrong_count} jawaban yang meleset. Yang paling penting dibahas: *${conceptList}*.\n\nMau kita review ${analysis.triaged_concepts.length} konsep itu bareng?`;

  const keyboard = {
    inline_keyboard: [[
      { text: 'Ya, review sekarang', callback_data: `ptr:start:${reviewId}` },
      { text: 'Nanti aja', callback_data: `ptr:skip:${reviewId}` },
    ]],
  };

  await sendMessage(env, chatId, text, keyboard);

  // Stamp the nudge so we don't re-fire
  await env.DB.prepare(
    `UPDATE test_attempts SET review_nudge_sent_at = datetime('now') WHERE id = ?`
  ).bind(analysis.attempt_id).run();

  return reviewId;
}

// ═══════════════════════════════════════════════════════
// REVIEW STATE MACHINE
// ═══════════════════════════════════════════════════════

export interface ActiveReview {
  id: number;
  user_id: number;
  attempt_id: number;
  concepts: string[];
  current_index: number;
  status: 'active' | 'completed' | 'skipped';
}

export async function loadActiveReview(env: Env, userId: number): Promise<ActiveReview | null> {
  try {
    const row = await env.DB.prepare(
      `SELECT * FROM post_test_reviews
       WHERE user_id = ? AND status = 'active'
       ORDER BY id DESC LIMIT 1`
    ).bind(userId).first() as any;
    if (!row) return null;
    return {
      id: row.id,
      user_id: row.user_id,
      attempt_id: row.attempt_id,
      concepts: safeParseArray(row.concepts_to_review),
      current_index: row.current_index || 0,
      status: row.status,
    };
  } catch { return null; }
}

export async function loadReviewById(env: Env, reviewId: number): Promise<ActiveReview | null> {
  try {
    const row = await env.DB.prepare(
      `SELECT * FROM post_test_reviews WHERE id = ?`
    ).bind(reviewId).first() as any;
    if (!row) return null;
    return {
      id: row.id,
      user_id: row.user_id,
      attempt_id: row.attempt_id,
      concepts: safeParseArray(row.concepts_to_review),
      current_index: row.current_index || 0,
      status: row.status,
    };
  } catch { return null; }
}

export async function advanceReview(env: Env, reviewId: number): Promise<void> {
  await env.DB.prepare(
    `UPDATE post_test_reviews SET current_index = current_index + 1, updated_at = datetime('now') WHERE id = ?`
  ).bind(reviewId).run();
}

export async function markReviewStatus(env: Env, reviewId: number, status: 'completed' | 'skipped'): Promise<void> {
  await env.DB.prepare(
    `UPDATE post_test_reviews SET status = ?, updated_at = datetime('now') WHERE id = ?`
  ).bind(status, reviewId).run();
}

/**
 * Prompt used to drive the tutor when it's time to teach the next concept.
 * Passed into getPrivateTutorResponse (lesson mode) as the "student message"
 * so the tutor emits a fresh teach+[CHECK] block for this concept.
 *
 * Deliberately first-person-student phrasing — the tutor's prompt engineering
 * expects a student turn, so this looks like the student asked for help.
 */
export function buildReviewTurnPrompt(concept: string, isFirst: boolean): string {
  const intro = isFirst
    ? 'Yuk mulai review test tadi.'
    : 'Oke lanjut ke konsep berikutnya.';
  return `${intro} Tolong ajarkan saya konsep "${concept}" dari nol — kasih penjelasan singkat dan jelas, lalu kasih satu soal [CHECK] supaya saya bisa cek apakah saya sudah paham.`;
}

// ═══════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════

function safeParseArray(v: any): string[] {
  if (!v) return [];
  if (Array.isArray(v)) return v;
  try {
    const parsed = JSON.parse(String(v));
    return Array.isArray(parsed) ? parsed.map((x) => String(x)) : [];
  } catch { return []; }
}

function formatConceptList(tags: string[]): string {
  const pretty = tags.map(humanizeConcept);
  if (pretty.length <= 1) return pretty[0] || '';
  if (pretty.length === 2) return `${pretty[0]} & ${pretty[1]}`;
  return `${pretty.slice(0, -1).join(', ')}, & ${pretty[pretty.length - 1]}`;
}

/** Turn "main_idea" into "Main Idea", "subject_verb" into "Subject-Verb", etc. */
export function humanizeConcept(tag: string): string {
  return tag
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}
