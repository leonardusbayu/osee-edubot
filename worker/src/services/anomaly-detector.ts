// Content anomaly detector — runs nightly via cron.
//
// Scans attempt_answers from the last 30 days, aggregates per content_id, and
// flags items with suspicious production signals:
//   • low_accuracy  — accuracy < 10% with ≥ 10 graded attempts
//                     (question may be wrong or broken options)
//   • high_skip     — skip rate > 70% with ≥ 10 total attempts
//                     (students bail — likely confusing or missing media)
//   • too_fast      — avg time < 5s with ≥ 10 attempts
//                     (students guess without reading — rewards randomness)
//   • too_slow      — avg time > 300s on non-grouped items (may indicate audio stuck)
//
// Each run is idempotent: if an open anomaly for (content_id, flag_type) already
// exists, we just update its metrics snapshot rather than inserting a new row.

import type { Env } from '../types';

export interface AnomalyMetrics {
  content_id: number;
  section: string | null;
  question_type: string | null;
  total: number;
  graded: number;       // attempts where is_correct is not null
  correct: number;
  skipped: number;      // answer_data is null/empty OR is_correct is null
  accuracy: number;     // correct / graded
  skip_rate: number;    // skipped / total
  avg_time: number;
}

export interface DetectionResult {
  scanned: number;
  flagged: number;
  new_opened: number;
  updated: number;
  auto_resolved: number;
}

const MIN_ATTEMPTS = 10;
const LOW_ACCURACY_THRESHOLD = 0.10;   // <10% correct
const HIGH_SKIP_THRESHOLD = 0.70;      // >70% skipped
const TOO_FAST_SECONDS = 5;
const TOO_SLOW_SECONDS = 300;

function severityFromDelta(ratio: number, threshold: number, worse: 'above' | 'below'): 'low' | 'medium' | 'high' {
  // Distance from threshold determines severity
  if (worse === 'below') {
    if (ratio < threshold / 3) return 'high';
    if (ratio < threshold / 1.5) return 'medium';
    return 'low';
  } else {
    if (ratio > Math.min(0.95, threshold + (1 - threshold) * 0.6)) return 'high';
    if (ratio > threshold + (1 - threshold) * 0.3) return 'medium';
    return 'low';
  }
}

/**
 * Aggregate per-content metrics over the last N days.
 */
export async function aggregateContentMetrics(env: Env, days: number = 30): Promise<AnomalyMetrics[]> {
  const { results } = await env.DB.prepare(
    `SELECT
        aa.content_id,
        tc.section AS section,
        tc.question_type AS question_type,
        COUNT(*) AS total,
        SUM(CASE WHEN aa.is_correct IS NOT NULL THEN 1 ELSE 0 END) AS graded,
        SUM(CASE WHEN aa.is_correct = 1 THEN 1 ELSE 0 END) AS correct,
        SUM(CASE WHEN aa.answer_data IS NULL OR aa.answer_data = '' OR aa.answer_data = '{}' OR aa.is_correct IS NULL THEN 1 ELSE 0 END) AS skipped,
        AVG(COALESCE(aa.time_spent_seconds, 0)) AS avg_time
       FROM attempt_answers aa
       LEFT JOIN test_contents tc ON tc.id = aa.content_id
      WHERE aa.content_id IS NOT NULL
        AND aa.submitted_at > datetime('now', ?)
      GROUP BY aa.content_id
     HAVING total >= ?`,
  ).bind(`-${days} days`, MIN_ATTEMPTS).all<any>();

  return (results || []).map((r: any) => {
    const graded = Number(r.graded) || 0;
    const correct = Number(r.correct) || 0;
    const total = Number(r.total) || 0;
    const skipped = Number(r.skipped) || 0;
    return {
      content_id: Number(r.content_id),
      section: r.section || null,
      question_type: r.question_type || null,
      total,
      graded,
      correct,
      skipped,
      accuracy: graded > 0 ? correct / graded : 0,
      skip_rate: total > 0 ? skipped / total : 0,
      avg_time: Number(r.avg_time) || 0,
    };
  });
}

/**
 * Apply flagging rules to metrics, returning flags to write.
 */
export function flagFromMetrics(m: AnomalyMetrics): Array<{ flag_type: string; severity: 'low' | 'medium' | 'high' }> {
  const flags: Array<{ flag_type: string; severity: 'low' | 'medium' | 'high' }> = [];

  // Only flag low accuracy if there are enough graded (not just total) attempts.
  if (m.graded >= MIN_ATTEMPTS && m.accuracy < LOW_ACCURACY_THRESHOLD) {
    flags.push({
      flag_type: 'low_accuracy',
      severity: severityFromDelta(m.accuracy, LOW_ACCURACY_THRESHOLD, 'below'),
    });
  }

  if (m.total >= MIN_ATTEMPTS && m.skip_rate > HIGH_SKIP_THRESHOLD) {
    flags.push({
      flag_type: 'high_skip',
      severity: severityFromDelta(m.skip_rate, HIGH_SKIP_THRESHOLD, 'above'),
    });
  }

  if (m.total >= MIN_ATTEMPTS && m.avg_time > 0 && m.avg_time < TOO_FAST_SECONDS) {
    // Only flag MCQ-type items — writing/speaking take longer naturally
    const qt = m.question_type || '';
    if (!['writing_essay', 'writing', 'speaking', 'independent_writing', 'integrated_writing'].includes(qt)) {
      flags.push({ flag_type: 'too_fast', severity: 'medium' });
    }
  }

  if (m.total >= MIN_ATTEMPTS && m.avg_time > TOO_SLOW_SECONDS) {
    const qt = m.question_type || '';
    // Writing/speaking legitimately take minutes — exclude
    if (!['writing_essay', 'writing', 'speaking', 'independent_writing', 'integrated_writing',
          'grouped_listening', 'grouped_reading'].includes(qt)) {
      flags.push({ flag_type: 'too_slow', severity: 'low' });
    }
  }

  return flags;
}

/**
 * Run the full detection pass. Safe to re-run — upserts on (content_id, flag_type, open).
 */
export async function runAnomalyDetection(env: Env, days: number = 30): Promise<DetectionResult> {
  const metrics = await aggregateContentMetrics(env, days);

  let newOpened = 0;
  let updated = 0;
  let autoResolved = 0;
  let flagged = 0;

  // Build a set of (content_id, flag_type) currently flagged by this run
  const activeKeys = new Set<string>();

  for (const m of metrics) {
    const flags = flagFromMetrics(m);
    if (flags.length === 0) continue;
    flagged++;

    for (const f of flags) {
      activeKeys.add(`${m.content_id}|${f.flag_type}`);

      // Check if an open anomaly for this (content, flag) already exists
      const existing = await env.DB.prepare(
        `SELECT id FROM content_anomalies
          WHERE content_id = ? AND flag_type = ? AND status = 'open'
          ORDER BY detected_at DESC LIMIT 1`,
      ).bind(m.content_id, f.flag_type).first<any>();

      if (existing) {
        // Update metrics snapshot
        await env.DB.prepare(
          `UPDATE content_anomalies
              SET severity = ?, total_attempts = ?, correct_count = ?,
                  accuracy_rate = ?, skip_count = ?, skip_rate = ?,
                  avg_time_seconds = ?, detected_at = datetime('now')
            WHERE id = ?`,
        ).bind(
          f.severity, m.total, m.correct, m.accuracy,
          m.skipped, m.skip_rate, m.avg_time, existing.id,
        ).run();
        updated++;
      } else {
        await env.DB.prepare(
          `INSERT INTO content_anomalies
             (content_id, flag_type, severity, section, question_type,
              total_attempts, correct_count, accuracy_rate,
              skip_count, skip_rate, avg_time_seconds)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        ).bind(
          m.content_id, f.flag_type, f.severity, m.section, m.question_type,
          m.total, m.correct, m.accuracy, m.skipped, m.skip_rate, m.avg_time,
        ).run();
        newOpened++;
      }
    }
  }

  // Auto-resolve: any open anomaly NOT in activeKeys has recovered
  const { results: openRows } = await env.DB.prepare(
    `SELECT id, content_id, flag_type FROM content_anomalies WHERE status = 'open'`,
  ).all<any>();

  for (const row of openRows || []) {
    const key = `${row.content_id}|${row.flag_type}`;
    if (!activeKeys.has(key)) {
      await env.DB.prepare(
        `UPDATE content_anomalies
            SET status = 'resolved', resolved_at = datetime('now'),
                notes = COALESCE(notes || ' | ', '') || 'auto-resolved: metrics recovered'
          WHERE id = ?`,
      ).bind(row.id).run();
      autoResolved++;
    }
  }

  return {
    scanned: metrics.length,
    flagged,
    new_opened: newOpened,
    updated,
    auto_resolved: autoResolved,
  };
}
