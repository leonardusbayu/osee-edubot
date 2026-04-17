// Scoring-reliability audit.
//
// Picks recent writing essays and speaking transcripts, re-scores each K
// times at temperature=0 using the same prompt, and records the variance.
// If the same answer gets scores of 4.0, 5.5, 3.5 across three tries, the
// rubric is underspecified and student trust is being silently destroyed.
//
// Runs on-demand via admin route, or monthly via cron. ~$0.05/run.

import type { Env } from '../types';

export interface ReliabilityResult {
  run_id: number;
  kind: 'writing' | 'speaking';
  sample_size: number;
  scored: number;
  failed: number;
  avg_stddev: number;
  max_stddev: number;
  noisy_count: number;
  avg_mean_score: number;
  total_cost_usd: number;
  duration_ms: number;
}

const NOISY_THRESHOLD = 0.5;

const WRITING_SYSTEM_PROMPT = `You are an expert IELTS/TOEFL writing grader. Score the essay on a 0-9 band scale following the standard IELTS Task 2 rubric (Task Response, Coherence & Cohesion, Lexical Resource, Grammar). Return strict JSON: {"overall": number, "task_response": number, "coherence": number, "lexical": number, "grammar": number}`;

const SPEAKING_SYSTEM_PROMPT = `You are an expert IELTS/TOEFL speaking grader. Score the transcript on a 0-9 band scale (Fluency & Coherence, Lexical Resource, Grammar, Pronunciation proxy from word-choice patterns). Return strict JSON: {"overall": number, "fluency": number, "lexical": number, "grammar": number, "pronunciation": number}`;

async function scoreOnce(
  env: Env,
  kind: 'writing' | 'speaking',
  text: string,
  promptCtx: string,
): Promise<{ overall: number | null; cost: number; error?: string }> {
  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',      // same model as production scorer
        temperature: 0,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: kind === 'writing' ? WRITING_SYSTEM_PROMPT : SPEAKING_SYSTEM_PROMPT },
          { role: 'user', content: `Prompt:\n${promptCtx}\n\nResponse:\n${text}` },
        ],
      }),
    });
    const data: any = await res.json();
    if (data.error) return { overall: null, cost: 0, error: data.error.message };
    const parsed = JSON.parse(data.choices?.[0]?.message?.content || '{}');
    const overall = Number(parsed.overall);
    if (!Number.isFinite(overall)) return { overall: null, cost: 0, error: 'no overall' };

    const usage = data.usage || {};
    const cost = ((usage.prompt_tokens || 0) * 0.15 + (usage.completion_tokens || 0) * 0.60) / 1_000_000;
    return { overall, cost };
  } catch (e: any) {
    return { overall: null, cost: 0, error: e?.message || 'fetch failed' };
  }
}

function stddev(nums: number[]): number {
  if (nums.length < 2) return 0;
  const mean = nums.reduce((a, b) => a + b, 0) / nums.length;
  const variance = nums.reduce((a, x) => a + (x - mean) ** 2, 0) / nums.length;
  return Math.sqrt(variance);
}

async function fetchWritingSample(env: Env, sampleSize: number): Promise<Array<{ id: number; user_id: number | null; prompt: string; text: string; score: number | null }>> {
  const { results } = await env.DB.prepare(
    `SELECT aa.id, aa.answer_data, aa.score, aa.content_id,
            ta.user_id AS user_id,
            tc.content AS content
       FROM attempt_answers aa
       JOIN test_attempts ta ON ta.id = aa.attempt_id
  LEFT JOIN test_contents tc ON tc.id = aa.content_id
      WHERE aa.section = 'writing'
        AND aa.answer_data IS NOT NULL
        AND aa.score IS NOT NULL
        AND aa.submitted_at > datetime('now', '-90 days')
      ORDER BY RANDOM()
      LIMIT ?`,
  ).bind(sampleSize).all<any>();

  const items: Array<{ id: number; user_id: number | null; prompt: string; text: string; score: number | null }> = [];
  for (const r of results || []) {
    let text = '';
    try {
      const d = JSON.parse(r.answer_data || '{}');
      text = d.text || d.essay || d.answer || '';
    } catch {}
    if (!text || text.length < 50) continue;

    let prompt = '';
    try {
      const c = JSON.parse(r.content || '{}');
      prompt = c.question_text || c.prompt || c.direction || '';
    } catch {}
    items.push({
      id: Number(r.id),
      user_id: r.user_id !== undefined ? Number(r.user_id) : null,
      prompt: String(prompt).slice(0, 2000),
      text: String(text).slice(0, 4000),
      score: r.score !== null ? Number(r.score) : null,
    });
  }
  return items;
}

async function fetchSpeakingSample(env: Env, sampleSize: number): Promise<Array<{ id: number; user_id: number | null; prompt: string; text: string; score: number | null }>> {
  const { results } = await env.DB.prepare(
    `SELECT id, user_id, prompt, transcription, score
       FROM speaking_sessions
      WHERE transcription IS NOT NULL
        AND LENGTH(transcription) > 30
        AND score IS NOT NULL
        AND created_at > datetime('now', '-90 days')
      ORDER BY RANDOM()
      LIMIT ?`,
  ).bind(sampleSize).all<any>();

  return (results || []).map((r: any) => ({
    id: Number(r.id),
    user_id: r.user_id !== undefined ? Number(r.user_id) : null,
    prompt: String(r.prompt || '').slice(0, 2000),
    text: String(r.transcription || '').slice(0, 4000),
    score: r.score !== null ? Number(r.score) : null,
  }));
}

export async function runScoringReliability(
  env: Env,
  opts: { kind: 'writing' | 'speaking'; sampleSize?: number; regrades?: number; notes?: string } = { kind: 'writing' },
): Promise<ReliabilityResult> {
  const startedAt = Date.now();
  const sampleSize = opts.sampleSize ?? 15;
  const regrades = opts.regrades ?? 3;

  if (!env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY not configured');

  const runInsert = await env.DB.prepare(
    `INSERT INTO scoring_reliability_runs (kind, sample_size, regrades_per_item, notes)
     VALUES (?, ?, ?, ?)`,
  ).bind(opts.kind, sampleSize, regrades, opts.notes || null).run();
  const runId = Number(runInsert.meta?.last_row_id || 0);

  const items = opts.kind === 'writing'
    ? await fetchWritingSample(env, sampleSize)
    : await fetchSpeakingSample(env, sampleSize);

  let scored = 0;
  let failed = 0;
  const stddevs: number[] = [];
  const means: number[] = [];
  let totalCost = 0;
  let noisyCount = 0;

  for (const item of items) {
    const scores: number[] = [];
    let itemCost = 0;
    let anyFail = false;

    for (let k = 0; k < regrades; k++) {
      const r = await scoreOnce(env, opts.kind, item.text, item.prompt);
      itemCost += r.cost;
      if (r.overall === null) { anyFail = true; continue; }
      scores.push(r.overall);
    }

    if (scores.length < 2) {
      failed++;
      continue;
    }
    scored++;

    const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
    const sd = stddev(scores);
    const drift = item.score !== null ? mean - item.score : 0;
    const isNoisy = sd > NOISY_THRESHOLD ? 1 : 0;

    stddevs.push(sd);
    means.push(mean);
    totalCost += itemCost;
    if (isNoisy) noisyCount++;

    await env.DB.prepare(
      `INSERT INTO scoring_reliability_samples
         (run_id, kind, source_id, user_id, original_score,
          regrade_scores, mean_score, stddev, drift_vs_original,
          is_noisy, cost_usd)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).bind(
      runId, opts.kind, item.id, item.user_id, item.score,
      JSON.stringify(scores), mean, sd, drift, isNoisy, itemCost,
    ).run();

    if (anyFail) console.warn(`[scoring-reliability] partial regrade for ${opts.kind}#${item.id}`);
  }

  const avgStd = stddevs.length > 0 ? stddevs.reduce((a, b) => a + b, 0) / stddevs.length : 0;
  const maxStd = stddevs.length > 0 ? Math.max(...stddevs) : 0;
  const avgMean = means.length > 0 ? means.reduce((a, b) => a + b, 0) / means.length : 0;

  await env.DB.prepare(
    `UPDATE scoring_reliability_runs
        SET finished_at = datetime('now'),
            scored_count = ?, failed_count = ?,
            avg_stddev = ?, max_stddev = ?, noisy_count = ?,
            avg_mean_score = ?, total_cost_usd = ?
      WHERE id = ?`,
  ).bind(scored, failed, avgStd, maxStd, noisyCount, avgMean, totalCost, runId).run();

  return {
    run_id: runId,
    kind: opts.kind,
    sample_size: items.length,
    scored,
    failed,
    avg_stddev: avgStd,
    max_stddev: maxStd,
    noisy_count: noisyCount,
    avg_mean_score: avgMean,
    total_cost_usd: totalCost,
    duration_ms: Date.now() - startedAt,
  };
}
