// Weekly content auditor (Layer 5).
//
// Iterates all published test_contents rows, runs them through validateRow
// in 'publish' mode, and persists findings + a per-run summary. Safe to run
// alongside normal traffic since reads are paginated and writes are batched.
//
// Trigger points:
//   • Monday morning cron (weekly)
//   • POST /api/audit/run (admin on-demand)
//
// Output tables:
//   content_audit_runs       — one per invocation
//   content_audit_findings   — one per (content_id × issue_code)

import type { Env } from '../types';
import { validateRow } from './content-validator';

export interface AuditResult {
  run_id: number;
  scanned: number;
  errors: number;
  warnings: number;
  healthy: number;
  breakdown: Record<string, number>;
  duration_ms: number;
}

/**
 * Heuristic code-extraction from a validator message so findings can be
 * bucketed. validateContent doesn't emit codes today — keep this map in
 * sync if new messages are added.
 */
function codeFromMessage(msg: string): string {
  const m = msg.toLowerCase();
  if (m.includes('empty text')) return 'empty_option';
  if (m.includes('ultra-short')) return 'ultra_short_option';
  if (m.includes('identical')) return 'duplicate_options';
  if (m.includes('near-paraphrase')) return 'paraphrase_options';
  if (m.includes('fewer than 2 options')) return 'too_few_options';
  if (m.includes('no correct answer')) return 'missing_answer';
  if (m.includes('no question_text')) return 'missing_question_text';
  if (m.includes('listening row requires')) return 'missing_audio';
  if (m.includes('media_url must start')) return 'bad_media_url';
  if (m.includes('no questions[] array')) return 'empty_grouped';
  if (m.includes('invalid json')) return 'invalid_json';
  if (m.includes('answer-out-of-range')) return 'answer_out_of_range';
  if (m.includes('explanation-mismatch')) return 'explanation_mismatch';
  return 'other';
}

function severityFor(code: string): 'low' | 'medium' | 'high' {
  switch (code) {
    case 'invalid_json':
    case 'missing_answer':
    case 'missing_audio':
    case 'empty_option':
    case 'duplicate_options':
    case 'answer_out_of_range':
      return 'high';
    case 'too_few_options':
    case 'bad_media_url':
    case 'empty_grouped':
    case 'explanation_mismatch':
      return 'medium';
    default:
      return 'low';
  }
}

/**
 * Run a full audit pass. Batched page-size of 500 rows to stay within D1
 * subrequest budget. Clears previous findings (we only keep the latest run's).
 */
export async function runContentAudit(env: Env, opts: { notes?: string } = {}): Promise<AuditResult> {
  const startedAt = Date.now();

  // Create the run row first so we can tag findings with it
  const runInsert = await env.DB.prepare(
    `INSERT INTO content_audit_runs (started_at, notes) VALUES (datetime('now'), ?)`,
  ).bind(opts.notes || null).run();
  const runId = Number(runInsert.meta?.last_row_id || 0);

  // Clear previous findings (rolling snapshot model)
  await env.DB.prepare(`DELETE FROM content_audit_findings`).run();

  const breakdown: Record<string, number> = {};
  let scanned = 0;
  let errorRows = 0;
  let warningRows = 0;
  let healthyRows = 0;

  const PAGE = 500;
  let offset = 0;

  while (true) {
    const { results } = await env.DB.prepare(
      `SELECT id, section, question_type, content, media_url, title
         FROM test_contents
        WHERE status = 'published'
        ORDER BY id ASC
        LIMIT ? OFFSET ?`,
    ).bind(PAGE, offset).all<any>();

    if (!results || results.length === 0) break;

    for (const row of results) {
      scanned++;
      const v = validateRow(
        {
          section: row.section,
          question_type: row.question_type,
          content: row.content,
          media_url: row.media_url,
          title: row.title,
        },
        { mode: 'publish' },
      );

      const allMessages = [
        ...v.errors.map((m) => ({ m, isError: true })),
        ...v.warnings.map((m) => ({ m, isError: false })),
      ];

      if (v.errors.length > 0) errorRows++;
      else if (v.warnings.length > 0) warningRows++;
      else { healthyRows++; continue; }

      // Dedupe by code within this row so a finding == unique (row, code)
      const seen = new Set<string>();
      for (const { m, isError } of allMessages) {
        const code = codeFromMessage(m);
        if (seen.has(code)) continue;
        seen.add(code);

        const sev = isError ? severityFor(code) : (severityFor(code) === 'high' ? 'medium' : 'low');
        breakdown[code] = (breakdown[code] || 0) + 1;

        await env.DB.prepare(
          `INSERT INTO content_audit_findings
             (content_id, issue_code, severity, section, question_type, message, run_id)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
        ).bind(row.id, code, sev, row.section, row.question_type, m.slice(0, 500), runId).run();
      }
    }

    if (results.length < PAGE) break;
    offset += PAGE;
  }

  // Finalize run row
  await env.DB.prepare(
    `UPDATE content_audit_runs
        SET finished_at = datetime('now'),
            scanned_count = ?, error_count = ?, warning_count = ?, healthy_count = ?,
            breakdown = ?
      WHERE id = ?`,
  ).bind(scanned, errorRows, warningRows, healthyRows, JSON.stringify(breakdown), runId).run();

  return {
    run_id: runId,
    scanned,
    errors: errorRows,
    warnings: warningRows,
    healthy: healthyRows,
    breakdown,
    duration_ms: Date.now() - startedAt,
  };
}
