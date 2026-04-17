// Classical-test-theory item analysis.
// Finds mis-keyed answers by looking at who gets items right vs wrong.
// Runs daily (piggybacks on the existing morning cron).
//
// The core trick: rank attempts by overall accuracy, split top-half vs
// bottom-half, and for each item compute the gap between those two groups'
// accuracy on that item. If the gap is negative (the better students miss
// it), the key is likely wrong.
//
// Thresholds chosen for 20+ sample sizes — smaller samples produce noise.

import type { Env } from '../types';

export interface AnalysisResult {
  scanned: number;
  flagged: number;
  likely_miskeyed: number;
  low_discrimination: number;
  too_easy: number;
  too_hard: number;
  duration_ms: number;
}

interface AttemptRow {
  attempt_id: number;
  content_id: number;
  is_correct: number;
}

const MIN_ATTEMPTS = 20;
const HIGH_SAMPLE = 50;  // stricter thresholds kick in at this size

function flagForItem(stats: {
  n: number;
  p: number;
  upperP: number;
  lowerP: number;
  disc: number;
}): { flag: string; severity: 'low' | 'medium' | 'high' } | null {
  const { n, p, disc } = stats;

  // 1. Likely miskeyed — negative or near-zero discrimination with non-trivial p
  if (disc < -0.05 && p > 0.15 && p < 0.85) {
    return { flag: 'likely_miskeyed', severity: 'high' };
  }
  if (disc < 0.0 && p > 0.25 && p < 0.75 && n >= HIGH_SAMPLE) {
    return { flag: 'likely_miskeyed', severity: 'high' };
  }

  // 2. Low discrimination — item isn't telling good students apart from weak
  if (disc < 0.1 && p > 0.2 && p < 0.8 && n >= HIGH_SAMPLE) {
    return { flag: 'low_discrimination', severity: 'medium' };
  }

  // 3. Trivial items — everyone right (not measuring anything)
  if (p > 0.95 && n >= HIGH_SAMPLE) {
    return { flag: 'too_easy', severity: 'low' };
  }

  // 4. Impossible items — almost no one right (likely broken, not just hard)
  if (p < 0.05 && n >= HIGH_SAMPLE) {
    return { flag: 'too_hard', severity: 'high' };
  }

  return null;
}

export async function runItemAnalysis(env: Env): Promise<AnalysisResult> {
  const startedAt = Date.now();

  // Pull every graded attempt_answer row with its attempt_id, joined with
  // test_contents to get section/type. We only look at objective items
  // (is_correct is 0 or 1) from the last 90 days.
  const { results } = await env.DB.prepare(
    `SELECT aa.attempt_id AS attempt_id,
            aa.content_id AS content_id,
            CASE WHEN aa.is_correct = 1 THEN 1 ELSE 0 END AS is_correct,
            tc.section AS section,
            tc.question_type AS question_type
       FROM attempt_answers aa
       JOIN test_contents tc ON tc.id = aa.content_id
      WHERE aa.content_id IS NOT NULL
        AND aa.is_correct IS NOT NULL
        AND aa.submitted_at > datetime('now', '-90 days')`,
  ).all<any>();

  const rows: AttemptRow[] = (results || []).map((r: any) => ({
    attempt_id: Number(r.attempt_id),
    content_id: Number(r.content_id),
    is_correct: Number(r.is_correct),
  }));

  if (rows.length === 0) {
    return {
      scanned: 0, flagged: 0,
      likely_miskeyed: 0, low_discrimination: 0,
      too_easy: 0, too_hard: 0,
      duration_ms: Date.now() - startedAt,
    };
  }

  // Per-attempt overall accuracy (how well did this attempt do overall?)
  const attemptAgg = new Map<number, { total: number; correct: number }>();
  for (const r of rows) {
    const agg = attemptAgg.get(r.attempt_id) || { total: 0, correct: 0 };
    agg.total += 1;
    agg.correct += r.is_correct;
    attemptAgg.set(r.attempt_id, agg);
  }
  const attemptScore = new Map<number, number>();
  for (const [aid, { total, correct }] of attemptAgg) {
    if (total >= 3) {
      // Require at least 3 scored items in the attempt for it to be a
      // meaningful ranking point — otherwise each attempt is just 1 item.
      attemptScore.set(aid, correct / total);
    }
  }

  // Global median attempt score (for upper/lower split)
  const scores = Array.from(attemptScore.values()).sort((a, b) => a - b);
  if (scores.length < 10) {
    return {
      scanned: 0, flagged: 0,
      likely_miskeyed: 0, low_discrimination: 0,
      too_easy: 0, too_hard: 0,
      duration_ms: Date.now() - startedAt,
    };
  }
  const median = scores[Math.floor(scores.length / 2)];

  // Per-content stats
  interface ContentAgg {
    section: string | null;
    question_type: string | null;
    totalN: number;
    totalCorrect: number;
    upperN: number;
    upperCorrect: number;
    lowerN: number;
    lowerCorrect: number;
  }
  const byContent = new Map<number, ContentAgg>();
  // We need section/question_type — re-pull with join metadata
  const metaByContent = new Map<number, { section: string | null; qt: string | null }>();
  for (const r of (results || [])) {
    metaByContent.set(Number(r.content_id), {
      section: r.section || null,
      qt: r.question_type || null,
    });
  }

  for (const r of rows) {
    const score = attemptScore.get(r.attempt_id);
    if (score === undefined) continue;

    const agg = byContent.get(r.content_id) || {
      section: metaByContent.get(r.content_id)?.section || null,
      question_type: metaByContent.get(r.content_id)?.qt || null,
      totalN: 0, totalCorrect: 0,
      upperN: 0, upperCorrect: 0,
      lowerN: 0, lowerCorrect: 0,
    };
    agg.totalN += 1;
    agg.totalCorrect += r.is_correct;
    if (score >= median) {
      agg.upperN += 1;
      agg.upperCorrect += r.is_correct;
    } else {
      agg.lowerN += 1;
      agg.lowerCorrect += r.is_correct;
    }
    byContent.set(r.content_id, agg);
  }

  let scanned = 0;
  let flagged = 0;
  const counts = { likely_miskeyed: 0, low_discrimination: 0, too_easy: 0, too_hard: 0 };

  // Build the current active-key set so we can resolve recovered items
  const activeKeys = new Set<string>();

  for (const [contentId, agg] of byContent) {
    if (agg.totalN < MIN_ATTEMPTS) continue;
    scanned++;

    const p = agg.totalCorrect / agg.totalN;
    const upperP = agg.upperN > 0 ? agg.upperCorrect / agg.upperN : 0;
    const lowerP = agg.lowerN > 0 ? agg.lowerCorrect / agg.lowerN : 0;
    const disc = upperP - lowerP;

    const f = flagForItem({ n: agg.totalN, p, upperP, lowerP, disc });
    if (!f) continue;
    flagged++;
    (counts as any)[f.flag]++;
    activeKeys.add(`${contentId}|${f.flag}`);

    // Upsert: if an open finding of this type exists for this content, update it
    const existing = await env.DB.prepare(
      `SELECT id FROM item_analysis_findings
        WHERE content_id = ? AND flag_type = ? AND status = 'open'
        ORDER BY detected_at DESC LIMIT 1`,
    ).bind(contentId, f.flag).first<any>();

    if (existing) {
      await env.DB.prepare(
        `UPDATE item_analysis_findings
            SET severity = ?, total_attempts = ?, p_value = ?,
                upper_p = ?, lower_p = ?, discrimination = ?,
                detected_at = datetime('now')
          WHERE id = ?`,
      ).bind(f.severity, agg.totalN, p, upperP, lowerP, disc, existing.id).run();
    } else {
      await env.DB.prepare(
        `INSERT INTO item_analysis_findings
           (content_id, section, question_type, total_attempts,
            p_value, upper_p, lower_p, discrimination,
            flag_type, severity)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).bind(
        contentId, agg.section, agg.question_type, agg.totalN,
        p, upperP, lowerP, disc,
        f.flag, f.severity,
      ).run();
    }
  }

  // Auto-resolve findings that no longer trigger
  const { results: openFindings } = await env.DB.prepare(
    `SELECT id, content_id, flag_type FROM item_analysis_findings WHERE status = 'open'`,
  ).all<any>();
  for (const row of openFindings || []) {
    const key = `${row.content_id}|${row.flag_type}`;
    if (!activeKeys.has(key)) {
      await env.DB.prepare(
        `UPDATE item_analysis_findings
            SET status = 'resolved', resolved_at = datetime('now'),
                notes = COALESCE(notes || ' | ', '') || 'auto-resolved: recovered'
          WHERE id = ?`,
      ).bind(row.id).run();
    }
  }

  return {
    scanned, flagged,
    ...counts,
    duration_ms: Date.now() - startedAt,
  };
}
