#!/usr/bin/env npx tsx
/**
 * Bulk Content Generator
 *
 * Learns from existing published questions in a target bucket and generates
 * new ones in the same style — same difficulty range, same question-stem
 * patterns, same distractor logic, rotated topics. New questions land as
 * status='draft' + source='ai_generated', then an inline quality sampler
 * grades each on a 5-axis rubric and auto-promotes verdict='pass' with
 * overall >= 4 to status='published'. Concerns + fails stay as draft for
 * manual review.
 *
 * Designed for the "students feel it's repetitive" problem — thin buckets
 * (TOEFL iBT Speaking: 70 items, IELTS Reading: 8 items) can't be fixed
 * with a better sampler, the pool is just too small.
 *
 * Usage:
 *   cd repo-root
 *   export CLOUDFLARE_API_TOKEN=...       # or put in worker/.env
 *   export CLOUDFLARE_ACCOUNT_ID=...
 *   export OPENAI_API_KEY=sk-...          # or put in worker/.env
 *
 *   npx tsx scripts/bulk-generate-content.ts \
 *     --test TOEFL_IBT --section speaking --type listen_and_repeat \
 *     --count 50
 *
 *   Flags:
 *     --test        test_type value (TOEFL_IBT, IELTS, TOEFL_ITP, TOEIC)
 *     --section     reading | listening | speaking | writing | structure
 *     --type        question_type within that section
 *     --count       how many NEW questions to generate (default 20, max 100)
 *     --batch       how many per GPT call (default 5)
 *     --dry-run     generate + grade but don't write to DB
 *
 * Cost estimate: ~$0.006 per generated question (GPT-4o-mini gen + gpt-4o-mini
 * QA) — 50 questions ≈ $0.30.
 *
 * Safety rails:
 *   - Hard max 100 questions per run
 *   - Rate limited: 2s between GPT calls
 *   - Never reuses phrase length >=5 words from references (prompt-enforced +
 *     a post-check that rejects obvious copies)
 *   - Only promotes verdict='pass' && overall>=4 to status='published'
 */

import { readFileSync } from 'fs';
import { join } from 'path';

const D1_DATABASE_ID = 'd501b671-128e-4a45-9d90-74b22e6691ce';
const HARD_MAX_COUNT = 100;
const DEFAULT_BATCH_SIZE = 5;
const FEW_SHOT_COUNT = 10;
const RATE_LIMIT_MS = 2000;

// ─── CLI ARG PARSING ────────────────────────────────────────────────────

function parseArgs(): {
  testType: string;
  section: string;
  questionType: string;
  count: number;
  batchSize: number;
  dryRun: boolean;
} {
  const args = process.argv.slice(2);
  const out: any = { count: 20, batchSize: DEFAULT_BATCH_SIZE, dryRun: false };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    const next = args[i + 1];
    if (a === '--test') { out.testType = next; i++; }
    else if (a === '--section') { out.section = next; i++; }
    else if (a === '--type') { out.questionType = next; i++; }
    else if (a === '--count') { out.count = Math.min(parseInt(next), HARD_MAX_COUNT); i++; }
    else if (a === '--batch') { out.batchSize = Math.max(1, Math.min(10, parseInt(next))); i++; }
    else if (a === '--dry-run') { out.dryRun = true; }
  }
  if (!out.testType || !out.section || !out.questionType) {
    console.error('Missing required flags. Example:');
    console.error('  npx tsx scripts/bulk-generate-content.ts --test TOEFL_IBT --section speaking --type listen_and_repeat --count 50');
    process.exit(1);
  }
  return out;
}

// ─── SECRETS ────────────────────────────────────────────────────────────

function readEnvFallback(name: string): string | null {
  try {
    const envFile = readFileSync(join(process.cwd(), 'worker', '.env'), 'utf-8');
    const match = envFile.match(new RegExp(`^${name}=(.+)$`, 'm'));
    return match ? match[1].trim() : null;
  } catch {
    return null;
  }
}

function requireSecret(name: string): string {
  const v = process.env[name] || readEnvFallback(name);
  if (!v) {
    console.error(`Missing ${name}. Set it via env var or put it in worker/.env.`);
    process.exit(1);
  }
  return v;
}

// ─── D1 REST API ────────────────────────────────────────────────────────

async function queryD1(
  accountId: string,
  apiToken: string,
  sql: string,
  params: any[] = [],
): Promise<any[]> {
  const resp = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/d1/database/${D1_DATABASE_ID}/query`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ sql, params }),
    },
  );
  const data: any = await resp.json();
  if (!data.success) throw new Error(`D1 error: ${JSON.stringify(data.errors)}`);
  return data.result?.[0]?.results || [];
}

// ─── OpenAI ─────────────────────────────────────────────────────────────

async function openaiJsonCall(
  apiKey: string,
  systemPrompt: string,
  userPrompt: string,
  model: string = 'gpt-4o-mini',
): Promise<any> {
  const resp = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      max_tokens: 3000,
      temperature: 0.8,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    }),
  });
  if (!resp.ok) {
    const err = await resp.text().catch(() => '');
    throw new Error(`OpenAI ${resp.status}: ${err.substring(0, 400)}`);
  }
  const data: any = await resp.json();
  const raw = data.choices?.[0]?.message?.content || '{}';
  return JSON.parse(raw);
}

// ─── GENERATION ─────────────────────────────────────────────────────────

const GEN_SYSTEM = `You are an expert TOEFL/IELTS/TOEIC test-item writer. Produce exam-authentic questions that match the style, tone, difficulty calibration, and structural patterns of the provided REFERENCE examples — but generate NEW topics, NEW passages, NEW questions.

RULES (non-negotiable):
1. Never reuse any phrase longer than 4 words verbatim from the references.
2. Rotate topics. If references are biology-heavy, pick history / art / social science instead.
3. Preserve the distractor logic: wrong options should be plausible, distinct, and non-overlapping.
4. Match the difficulty by vocabulary density and cognitive demand, not by making questions trickier.
5. For listening/audio types, use speaker labels (Professor:, Man:, Woman:) with natural hedging.
6. Output strict JSON only — no prose, no commentary.`;

function buildGenUserPrompt(
  testType: string,
  section: string,
  questionType: string,
  batchSize: number,
  references: any[],
  avoidTopics: string[],
): string {
  const refsBlock = references.map((r, i) => `--- REFERENCE ${i + 1} ---\n${JSON.stringify(r.content_parsed, null, 2)}`).join('\n\n');
  const avoidBlock = avoidTopics.length > 0
    ? `Topics OVERREPRESENTED in the bank — avoid: ${avoidTopics.join(', ')}.`
    : 'No topic restrictions.';

  return `Generate ${batchSize} new ${testType} ${section} ${questionType} questions.

${avoidBlock}

Study these ${references.length} REAL EXAMPLES from our bank for style, difficulty, distractor patterns, topic scope:

${refsBlock}

Return JSON in this exact shape:
{
  "questions": [
    {
      "title": "short identifier",
      "content": { /* same shape as the reference content objects — grouped_reading, grouped_listening, grouped_speaking, or flat depending on references */ },
      "difficulty": 1-5,
      "topic": "short topic tag",
      "skill_tags": ["tag1", "tag2"]
    },
    ... ${batchSize} items total
  ]
}

Critical: the content shape must MATCH the references — same JSON structure, same fields. Do not invent fields.`;
}

// ─── QUALITY SAMPLING ───────────────────────────────────────────────────

const QA_SYSTEM = `You are an expert TOEFL/IELTS test-item reviewer. Grade each question on a 5-axis rubric (1-5 each).

Rubric:
- clarity: Is the question clearly worded and unambiguous?
- answer_correctness: Is the marked correct answer actually correct and the others actually wrong?
- option_quality: Are the distractors plausible, distinct, non-overlapping, and not obvious giveaways?
- passage_alignment: Does the question match what the passage/audio says? (If no passage, rate 5)
- overall: Your overall quality judgement.

Verdict:
- "pass" if overall >= 4
- "concern" if overall == 3
- "fail" if overall <= 2

Return strict JSON: { "clarity": int, "answer_correctness": int, "option_quality": int, "passage_alignment": int, "overall": int, "verdict": "pass"|"concern"|"fail", "issues": [strings], "notes": string }`;

function buildQaUserPrompt(content: any, title: string | null): string {
  return `Grade this question:

Title: ${title || '(no title)'}
Content:
${JSON.stringify(content, null, 2)}`;
}

// ─── MAIN ───────────────────────────────────────────────────────────────

async function main() {
  const { testType, section, questionType, count, batchSize, dryRun } = parseArgs();
  const accountId = requireSecret('CLOUDFLARE_ACCOUNT_ID');
  const apiToken = requireSecret('CLOUDFLARE_API_TOKEN');
  const openaiKey = requireSecret('OPENAI_API_KEY');

  console.log(`\n━━━ Bulk Content Generator ━━━`);
  console.log(`Target: ${testType} / ${section} / ${questionType}`);
  console.log(`Generating: ${count} (batch size ${batchSize})${dryRun ? ' [DRY RUN]' : ''}\n`);

  // 1. Check existing coverage
  const countRow = await queryD1(
    accountId,
    apiToken,
    `SELECT COUNT(*) AS n FROM test_contents WHERE test_type = ? AND section = ? AND question_type = ? AND status = 'published'`,
    [testType, section, questionType],
  );
  const existing = Number(countRow[0]?.n || 0);
  console.log(`Current published: ${existing}`);

  // 2. Pull few-shot references (spread across difficulty)
  const refs = await queryD1(
    accountId,
    apiToken,
    `SELECT id, title, content, difficulty, topic, skill_tags FROM test_contents
      WHERE test_type = ? AND section = ? AND question_type = ? AND status = 'published'
      ORDER BY RANDOM() LIMIT ?`,
    [testType, section, questionType, FEW_SHOT_COUNT],
  );
  if (refs.length < 3) {
    console.error(`\n⚠️  Only ${refs.length} reference questions in the bank. Need at least 3 for meaningful few-shot. Consider seeding a few by hand first.`);
    process.exit(1);
  }
  console.log(`Loaded ${refs.length} few-shot references.`);
  // Parse content JSON for each reference
  for (const r of refs) {
    try { (r as any).content_parsed = JSON.parse(r.content || '{}'); }
    catch { (r as any).content_parsed = {}; }
  }

  // 3. Check over-represented topics to avoid
  const topicRows = await queryD1(
    accountId,
    apiToken,
    `SELECT topic, COUNT(*) AS n FROM test_contents
      WHERE test_type = ? AND section = ? AND question_type = ? AND status = 'published' AND topic IS NOT NULL
      GROUP BY topic ORDER BY n DESC LIMIT 5`,
    [testType, section, questionType],
  );
  const avoidTopics = topicRows.slice(0, 3).map((r: any) => String(r.topic)).filter(Boolean);
  if (avoidTopics.length) console.log(`Avoid topics: ${avoidTopics.join(', ')}`);

  // 4. Generation loop
  const totalBatches = Math.ceil(count / batchSize);
  const generated: any[] = [];
  let genFailures = 0;

  for (let b = 0; b < totalBatches; b++) {
    const thisBatch = Math.min(batchSize, count - generated.length);
    if (thisBatch <= 0) break;

    console.log(`\n  Batch ${b + 1}/${totalBatches} — generating ${thisBatch}…`);
    try {
      const prompt = buildGenUserPrompt(testType, section, questionType, thisBatch, refs, avoidTopics);
      const output = await openaiJsonCall(openaiKey, GEN_SYSTEM, prompt);
      const newQs = Array.isArray(output?.questions) ? output.questions : [];
      if (newQs.length === 0) {
        console.warn(`  ⚠️  Empty batch. Skipping.`);
        genFailures++;
      } else {
        generated.push(...newQs);
        console.log(`  ✓ ${newQs.length} questions generated`);
      }
    } catch (e: any) {
      console.error(`  ✗ Batch failed: ${e.message}`);
      genFailures++;
    }
    await new Promise((r) => setTimeout(r, RATE_LIMIT_MS));
  }

  if (generated.length === 0) {
    console.error(`\n❌ No questions generated. Aborting.`);
    process.exit(1);
  }

  // 5. Anti-copy guard: drop any generated item whose content shares a ≥5-word
  //    substring with any reference. Prevents accidental verbatim leaks.
  const refTexts = refs.map((r: any) => JSON.stringify(r.content_parsed || {}).toLowerCase());
  function hasLongCopy(s: string): boolean {
    const lower = s.toLowerCase();
    const words = lower.split(/\s+/);
    for (let i = 0; i <= words.length - 5; i++) {
      const ngram = words.slice(i, i + 5).join(' ');
      if (ngram.length < 20) continue;
      for (const ref of refTexts) {
        if (ref.includes(ngram)) return true;
      }
    }
    return false;
  }
  const beforeGuard = generated.length;
  const filtered = generated.filter((q) => !hasLongCopy(JSON.stringify(q.content || {})));
  const copyDrops = beforeGuard - filtered.length;
  if (copyDrops > 0) console.log(`\n🛡  Dropped ${copyDrops} items with >=5-word copy from references`);

  // 6. Quality-score each and decide promotion
  console.log(`\n━━━ Quality Pass ━━━`);
  let passed = 0, concern = 0, failed = 0, dbErrors = 0;
  const insertResults: Array<{ status: string; verdict: string; overall: number; title: string }> = [];

  for (let i = 0; i < filtered.length; i++) {
    const q = filtered[i];
    const title = q.title || `AI ${testType} ${section} ${i + 1}`;
    const content = q.content;
    const difficulty = Number(q.difficulty) || 3;
    const topic = q.topic || null;
    const skillTags = Array.isArray(q.skill_tags) ? JSON.stringify(q.skill_tags) : '[]';

    if (!content || typeof content !== 'object') {
      console.warn(`  [${i + 1}] skipped: invalid content shape`);
      continue;
    }

    let verdict: 'pass' | 'concern' | 'fail' = 'fail';
    let overall = 0;
    try {
      const qa = await openaiJsonCall(openaiKey, QA_SYSTEM, buildQaUserPrompt(content, title));
      verdict = qa.verdict || 'fail';
      overall = Number(qa.overall) || 0;
    } catch (e: any) {
      console.warn(`  [${i + 1}] QA call failed: ${e.message} — treating as concern`);
      verdict = 'concern';
      overall = 3;
    }

    // Decide status: promote only if pass AND overall>=4
    const promote = verdict === 'pass' && overall >= 4;
    const status = promote ? 'published' : 'draft';

    if (!dryRun) {
      try {
        await queryD1(
          accountId,
          apiToken,
          `INSERT INTO test_contents
             (test_type, section, question_type, title, content, difficulty, topic, source, status, skill_tags)
           VALUES (?, ?, ?, ?, ?, ?, ?, 'ai_generated', ?, ?)`,
          [testType, section, questionType, title, JSON.stringify(content), difficulty, topic, status, skillTags],
        );
      } catch (e: any) {
        dbErrors++;
        console.error(`  [${i + 1}] DB insert failed: ${e.message}`);
        continue;
      }
    }

    insertResults.push({ status, verdict, overall, title });
    if (verdict === 'pass') passed++;
    else if (verdict === 'concern') concern++;
    else failed++;
    console.log(`  [${i + 1}/${filtered.length}] ${verdict} (${overall}/5) → ${status} — ${title}`);
    await new Promise((r) => setTimeout(r, 500));
  }

  // 7. Summary
  console.log(`\n━━━ Summary ━━━`);
  console.log(`Generated:   ${generated.length}`);
  console.log(`Copy-drops:  ${copyDrops}`);
  console.log(`QA'd:        ${filtered.length}`);
  console.log(`Passed→pub:  ${passed}`);
  console.log(`Concern:     ${concern}  (kept as draft — review manually)`);
  console.log(`Failed:      ${failed}  (kept as draft)`);
  console.log(`DB errors:   ${dbErrors}`);
  console.log(`Gen failures:${genFailures}`);
  if (dryRun) console.log(`\n[DRY RUN — nothing written]`);
  else console.log(`\nReview drafts with:\n  SELECT id, title, status FROM test_contents WHERE source='ai_generated' AND status='draft' AND test_type='${testType}' AND section='${section}' AND question_type='${questionType}' ORDER BY created_at DESC;`);
}

main().catch((e) => {
  console.error('\nFATAL:', e.message || e);
  process.exit(1);
});
