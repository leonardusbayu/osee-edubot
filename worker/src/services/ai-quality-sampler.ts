// Weekly AI quality sampler (Layer 4).
//
// Samples N random published items (stratified across sections), asks
// GPT-4o-mini to grade each on a 5-axis rubric, and persists results so
// we can track quality drift and find low-scoring items without waiting
// for student reports.
//
// Cost: ~50 calls × ~500 tokens each × $0.15/M input + $0.60/M output ≈
//       $0.003 per run. Trivially cheap.
//
// The model outputs structured JSON (enforced via response_format).

import type { Env } from '../types';

export interface SamplerResult {
  run_id: number;
  sample_size: number;
  scored: number;
  failed: number;
  avg_overall: number;
  fail_count: number;
  concern_count: number;
  total_cost_usd: number;
  duration_ms: number;
}

interface RubricScore {
  clarity: number;
  answer_correctness: number;
  option_quality: number;
  passage_alignment: number;
  overall: number;
  verdict: 'pass' | 'concern' | 'fail';
  issues: string[];
  notes: string;
}

const SYSTEM_PROMPT = `You are an expert TOEFL/IELTS test-item reviewer. Grade each question on a 5-axis rubric (1-5 each).

Rubric:
- clarity: Is the question clearly worded and unambiguous?
- answer_correctness: Is the marked correct answer actually correct and the others actually wrong?
- option_quality: Are the distractors plausible, distinct, non-overlapping, and not obvious giveaways?
- passage_alignment: Does the question match what the passage/audio says? (If no passage, rate 5)
- overall: Your overall quality judgement.

Verdict:
- "pass" = overall >= 4, ready to use
- "concern" = overall == 3, usable but has minor issues
- "fail" = overall <= 2, should be fixed or removed

Return strict JSON:
{
  "clarity": int,
  "answer_correctness": int,
  "option_quality": int,
  "passage_alignment": int,
  "overall": int,
  "verdict": "pass" | "concern" | "fail",
  "issues": ["short strings describing each problem"],
  "notes": "one-sentence summary"
}`;

function buildUserPrompt(row: any): string {
  let content: any = {};
  try { content = JSON.parse(row.content || '{}'); } catch {}

  const parts: string[] = [];
  parts.push(`Section: ${row.section} | Type: ${row.question_type}`);
  if (content.direction) parts.push(`Direction: ${content.direction}`);
  if (content.passage || content.passage_text) {
    parts.push(`Passage: ${String(content.passage || content.passage_text).slice(0, 2000)}`);
  }

  if (Array.isArray(content.questions) && content.questions.length > 0) {
    // Grouped — sample first sub-question
    const sub = content.questions[0];
    parts.push(`Question (sub 1 of ${content.questions.length}): ${sub.question_text || sub.prompt || ''}`);
    if (Array.isArray(sub.options)) {
      parts.push('Options:');
      sub.options.forEach((o: any, i: number) => {
        const text = typeof o === 'string' ? o : (o.text || '');
        const mark = o.is_answer || o.is_correct ? ' ← CORRECT' : '';
        parts.push(`  ${String.fromCharCode(65 + i)}. ${text}${mark}`);
      });
    }
    if (Array.isArray(sub.answers) && sub.answers.length > 0) {
      parts.push(`Marked correct: ${sub.answers.join(', ')}`);
    }
  } else {
    if (content.question_text) parts.push(`Question: ${content.question_text}`);
    if (Array.isArray(content.options) && content.options.length > 0) {
      parts.push('Options:');
      content.options.forEach((o: any, i: number) => {
        const text = typeof o === 'string' ? o : (o.text || '');
        const mark = o.is_answer || o.is_correct ? ' ← CORRECT' : '';
        parts.push(`  ${String.fromCharCode(65 + i)}. ${text}${mark}`);
      });
    }
    if (Array.isArray(content.answers) && content.answers.length > 0) {
      parts.push(`Marked correct: ${content.answers.join(', ')}`);
    }
  }

  if (content.explanation) {
    parts.push(`Author's explanation: ${String(content.explanation).slice(0, 400)}`);
  }

  return parts.join('\n');
}

async function scoreItem(env: Env, row: any): Promise<{ score: RubricScore | null; cost: number; error?: string }> {
  const userPrompt = buildUserPrompt(row);

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        temperature: 0,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userPrompt },
        ],
      }),
    });

    const data: any = await res.json();
    if (data.error) return { score: null, cost: 0, error: data.error.message || 'API error' };

    const raw = data.choices?.[0]?.message?.content || '{}';
    const parsed = JSON.parse(raw);

    const usage = data.usage || {};
    const inTok = Number(usage.prompt_tokens || 0);
    const outTok = Number(usage.completion_tokens || 0);
    const cost = (inTok * 0.15 + outTok * 0.60) / 1_000_000;

    const score: RubricScore = {
      clarity: Math.max(1, Math.min(5, Math.round(Number(parsed.clarity) || 0))),
      answer_correctness: Math.max(1, Math.min(5, Math.round(Number(parsed.answer_correctness) || 0))),
      option_quality: Math.max(1, Math.min(5, Math.round(Number(parsed.option_quality) || 0))),
      passage_alignment: Math.max(1, Math.min(5, Math.round(Number(parsed.passage_alignment) || 0))),
      overall: Math.max(1, Math.min(5, Math.round(Number(parsed.overall) || 0))),
      verdict: ['pass', 'concern', 'fail'].includes(parsed.verdict) ? parsed.verdict : 'concern',
      issues: Array.isArray(parsed.issues) ? parsed.issues.slice(0, 10).map(String) : [],
      notes: String(parsed.notes || '').slice(0, 500),
    };

    return { score, cost };
  } catch (e: any) {
    return { score: null, cost: 0, error: e?.message || 'fetch failed' };
  }
}

/**
 * Run a sampler pass. Stratifies across sections so one section doesn't
 * dominate the sample.
 */
export async function runAiQualitySampler(env: Env, opts: { sampleSize?: number; notes?: string } = {}): Promise<SamplerResult> {
  const startedAt = Date.now();
  const sampleSize = opts.sampleSize ?? 50;

  if (!env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY not configured');
  }

  // Insert run row up front
  const runInsert = await env.DB.prepare(
    `INSERT INTO content_ai_score_runs (started_at, sample_size, notes)
     VALUES (datetime('now'), ?, ?)`,
  ).bind(sampleSize, opts.notes || null).run();
  const runId = Number(runInsert.meta?.last_row_id || 0);

  // Stratified sample: sample_size / #sections per section, fallback to random if under-represented
  const sections = ['reading', 'listening', 'speaking', 'writing'];
  const perSection = Math.max(1, Math.floor(sampleSize / sections.length));
  const sampled: any[] = [];

  for (const section of sections) {
    const { results } = await env.DB.prepare(
      `SELECT id, section, question_type, content, media_url
         FROM test_contents
        WHERE status = 'published' AND section = ?
        ORDER BY RANDOM()
        LIMIT ?`,
    ).bind(section, perSection).all<any>();
    sampled.push(...(results || []));
  }

  // Top up with any-section random if we're short
  if (sampled.length < sampleSize) {
    const need = sampleSize - sampled.length;
    const ids = new Set(sampled.map((r) => r.id));
    const { results } = await env.DB.prepare(
      `SELECT id, section, question_type, content, media_url
         FROM test_contents
        WHERE status = 'published'
        ORDER BY RANDOM()
        LIMIT ?`,
    ).bind(need * 2).all<any>();
    for (const r of (results || [])) {
      if (sampled.length >= sampleSize) break;
      if (!ids.has(r.id)) { sampled.push(r); ids.add(r.id); }
    }
  }

  let scored = 0;
  let failed = 0;
  let totalCost = 0;
  let overallSum = 0;
  let failCount = 0;
  let concernCount = 0;

  // Sequential to avoid rate limits in a cron context (Workers has 6-subrequest
  // cap on fetch() concurrency by default anyway). 50 items × ~1s each ≈ under
  // the 30s subrequest timeout on scheduled handler.
  for (const row of sampled) {
    const { score, cost, error } = await scoreItem(env, row);
    if (!score) {
      failed++;
      if (error) console.warn(`[ai-quality] score failed for content ${row.id}: ${error}`);
      continue;
    }
    scored++;
    totalCost += cost;
    overallSum += score.overall;
    if (score.verdict === 'fail') failCount++;
    else if (score.verdict === 'concern') concernCount++;

    await env.DB.prepare(
      `INSERT INTO content_ai_scores
         (content_id, run_id, section, question_type,
          clarity_score, answer_correctness, option_quality, passage_alignment,
          overall_score, verdict, issues, ai_notes, cost_usd)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).bind(
      row.id, runId, row.section, row.question_type,
      score.clarity, score.answer_correctness, score.option_quality, score.passage_alignment,
      score.overall, score.verdict, JSON.stringify(score.issues), score.notes, cost,
    ).run();
  }

  const avgOverall = scored > 0 ? overallSum / scored : 0;

  await env.DB.prepare(
    `UPDATE content_ai_score_runs
        SET finished_at = datetime('now'),
            scored_count = ?, failed_count = ?,
            avg_overall = ?, fail_count = ?, concern_count = ?,
            total_cost_usd = ?
      WHERE id = ?`,
  ).bind(scored, failed, avgOverall, failCount, concernCount, totalCost, runId).run();

  return {
    run_id: runId,
    sample_size: sampleSize,
    scored,
    failed,
    avg_overall: avgOverall,
    fail_count: failCount,
    concern_count: concernCount,
    total_cost_usd: totalCost,
    duration_ms: Date.now() - startedAt,
  };
}
