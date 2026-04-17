#!/usr/bin/env node
// Backfills missing question_text in 103 broken TOEFL ITP listening items.
//
// Strategy: for each sub-question whose question_text normalizes to
// "listen to the audio", send the parent passage_script + options +
// correct-answer key to GPT-4o-mini and have it generate the natural
// ITP-style question that fits. The TTS audio already plays correctly;
// only the on-screen question text needs fixing.
//
// Default is dry-run — proposals are written to scripts/backfill_listening.out.json
// for review. Re-run with --apply to push UPDATE statements to D1.
//
// Requires: OPENAI_API_KEY env var (not read from wrangler secrets).
//
// Run from repo root:
//   OPENAI_API_KEY=sk-...  node scripts/backfill_listening_questions.mjs
//   OPENAI_API_KEY=sk-...  node scripts/backfill_listening_questions.mjs --apply
//
// Cost estimate: ~103 calls × ~500 tok in + 30 tok out @ gpt-4o-mini ≈ $0.05
// Runtime: ~1-2 min (sequential).

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const workerDir = path.resolve(__dirname, '..', 'worker');
const OUT_PATH = path.join(__dirname, 'backfill_listening.out.json');

const APPLY = process.argv.includes('--apply');
const LIMIT = (() => {
  const i = process.argv.indexOf('--limit');
  return i > -1 ? parseInt(process.argv[i + 1], 10) || 0 : 0;
})();

// Resolve OPENAI_API_KEY. Files win over env to avoid stale/placeholder
// env vars from earlier shell sessions silently overriding the real key.
//   1. worker/.dev.vars
//   2. worker/.env
//   3. ./.env (repo root)
//   4. process.env.OPENAI_API_KEY (fallback)
function loadKey() {
  const candidates = [
    path.join(workerDir, '.dev.vars'),
    path.join(workerDir, '.env'),
    path.resolve(__dirname, '..', '.env'),
  ];
  for (const p of candidates) {
    if (!fs.existsSync(p)) continue;
    const txt = fs.readFileSync(p, 'utf8');
    const m = txt.match(/^\s*OPENAI_API_KEY\s*=\s*["']?([^"'\r\n]+)["']?/m);
    if (m) {
      console.log(`Using OPENAI_API_KEY from ${path.relative(process.cwd(), p)}`);
      return m[1].trim();
    }
  }
  if (process.env.OPENAI_API_KEY) {
    console.log('Using OPENAI_API_KEY from process.env');
    return process.env.OPENAI_API_KEY;
  }
  return null;
}
const apiKey = loadKey();
if (!apiKey) {
  console.error('OPENAI_API_KEY not found.');
  console.error('  Looked in: env, worker/.dev.vars, worker/.env, .env');
  console.error('  Add a line like:   OPENAI_API_KEY=sk-...   to worker/.dev.vars');
  process.exit(1);
}

// --- D1 helpers -----------------------------------------------------------

function sqlSelect(sql) {
  const raw = execSync(
    `npx wrangler d1 execute edubot-db --remote --json --command "${sql}"`,
    { cwd: workerDir, encoding: 'utf8', maxBuffer: 200 * 1024 * 1024 },
  );
  const start = raw.indexOf('[');
  if (start < 0) return [];
  return JSON.parse(raw.slice(start))[0]?.results || [];
}

function sqlExecFile(sqlText) {
  // Write to a tmp file to bypass shell-escape hell for large JSON blobs.
  const tmp = path.join(__dirname, `.backfill_tmp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.sql`);
  fs.writeFileSync(tmp, sqlText, 'utf8');
  try {
    execSync(
      `npx wrangler d1 execute edubot-db --remote --file="${tmp}"`,
      { cwd: workerDir, stdio: 'pipe' },
    );
  } finally {
    fs.unlinkSync(tmp);
  }
}

function normalize(t) {
  return String(t || '')
    .toLowerCase()
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .replace(/[^\w\s'-]/g, '')
    .trim();
}

const TARGET_NORM = 'listen to the audio';
const PAGE = 500;

// --- 1. Collect ------------------------------------------------------------

console.log('Scanning published rows for placeholder sub-questions...');
const todo = [];
let scanned = 0;
for (let off = 0; off < 20000; off += PAGE) {
  const rows = sqlSelect(
    `SELECT id, test_type, section, question_type, content FROM test_contents WHERE status = 'published' ORDER BY id LIMIT ${PAGE} OFFSET ${off};`,
  );
  if (!rows.length) break;
  scanned += rows.length;
  process.stdout.write(`\r  scanned ${scanned}...`);

  for (const r of rows) {
    let c;
    try { c = JSON.parse(r.content); } catch { continue; }
    const subs = Array.isArray(c.questions) ? c.questions : [];
    if (!subs.length) continue;
    const passage = String(c.passage_script || c.passage || c.script || '').trim();
    if (passage.length < 20) continue; // nothing to ground the question in

    const subsNeedingFix = [];
    subs.forEach((sq, i) => {
      if (normalize(sq.question_text || sq.question || '') === TARGET_NORM) {
        subsNeedingFix.push({
          index: i,
          options: sq.options || sq.choices || [],
          answer: Array.isArray(sq.answers)
            ? sq.answers[0]
            : (sq.correct_answer ?? sq.answer ?? ''),
        });
      }
    });
    if (subsNeedingFix.length) {
      todo.push({
        id: r.id,
        test_type: r.test_type,
        question_type: r.question_type,
        passage,
        content: c,
        subsNeedingFix,
      });
    }
  }
  if (rows.length < PAGE) break;
}
process.stdout.write('\n');
console.log(`\nScanned ${scanned} rows. ${todo.length} parent items need backfill.`);

const work = LIMIT > 0 ? todo.slice(0, LIMIT) : todo;
if (LIMIT > 0) console.log(`--limit ${LIMIT} applied → processing ${work.length}.`);

if (work.length === 0) {
  console.log('Nothing to do.');
  process.exit(0);
}

// --- 2. Generate via GPT-4o-mini ------------------------------------------

const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];

function renderOptions(options) {
  return options.map((o, i) => {
    const txt = typeof o === 'string'
      ? o
      : (o.text || o.label || o.value || o.content || o.option_text || o.answer || '');
    const key = typeof o === 'object' && o !== null
      ? (o.key || o.id || LETTERS[i])
      : LETTERS[i];
    return `  ${key}. ${txt}`;
  }).join('\n');
}

async function askGPT(passage, options, answer, qType) {
  const prompt = `You are writing one TOEFL ITP listening comprehension question.

Listening passage (the actual audio content):
"""
${passage}
"""

Answer choices:
${renderOptions(options)}

Correct answer: ${answer}

Write ONE natural TOEFL ITP-style question that:
- Tests understanding of the passage above
- Has "${answer}" as its unambiguous correct answer given the other options
- Matches real ITP phrasing (e.g. "What does the man mean?", "What can be inferred about the woman?", "Why does the man say this?", "What is the main topic of the talk?", "What does the woman imply?", "What will the man probably do next?")
- Is a single sentence ending in a question mark
- Contains NO quotation marks, NO leading "Question:" label, NO option letters, NO explanations

Output ONLY the question text. Nothing else.`;

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      max_tokens: 80,
    }),
  });
  if (!res.ok) throw new Error(`OpenAI ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const j = await res.json();
  let out = j.choices?.[0]?.message?.content?.trim() || '';
  // strip wrapping quotes / leading "Question:" / trailing whitespace
  out = out.replace(/^["'`]+|["'`]+$/g, '').replace(/^Question\s*:?\s*/i, '').trim();
  return out;
}

console.log(`\nGenerating questions via GPT-4o-mini...`);
const proposals = [];
let done = 0, failed = 0;
for (const item of work) {
  for (const sub of item.subsNeedingFix) {
    try {
      const q = await askGPT(item.passage, sub.options, sub.answer, item.question_type);
      if (!q || !q.endsWith('?')) throw new Error(`bad output: "${q.slice(0, 80)}"`);
      proposals.push({
        id: item.id,
        question_type: item.question_type,
        subIndex: sub.index,
        answer: sub.answer,
        oldQuestion: item.content.questions[sub.index].question_text,
        newQuestion: q,
      });
      item.content.questions[sub.index].question_text = q;
      done++;
    } catch (e) {
      console.error(`\n  #${item.id}:${sub.index} failed — ${e.message}`);
      failed++;
    }
    process.stdout.write(`\r  generated ${done}  failed ${failed}  (of ${work.reduce((s, it) => s + it.subsNeedingFix.length, 0)})...`);
  }
}
process.stdout.write('\n');

fs.writeFileSync(OUT_PATH, JSON.stringify(proposals, null, 2));
console.log(`\nWrote ${proposals.length} proposals to ${OUT_PATH}`);

// Show a few samples for quick sanity-check
console.log('\nSample proposals (first 5):');
for (const p of proposals.slice(0, 5)) {
  console.log(`  #${p.id}:${p.subIndex}  [ans=${p.answer}]  ${p.newQuestion}`);
}

if (!APPLY) {
  console.log('\nDRY RUN — no writes. Review the JSON, then re-run with --apply to push to D1.\n');
  process.exit(0);
}

// --- 3. Apply -------------------------------------------------------------

console.log('\nApplying UPDATEs to D1...');
let updated = 0, updateFailed = 0;

// Build one SQL file with all UPDATEs for atomic-ish batch execution.
// (D1 --file runs statements sequentially; if one fails the rest still attempt.)
const lines = [];
for (const item of work) {
  if (!item.subsNeedingFix.length) continue;
  const json = JSON.stringify(item.content).replace(/'/g, "''");
  lines.push(`UPDATE test_contents SET content = '${json}' WHERE id = ${item.id};`);
}

// Chunk into groups of ~25 statements to keep each file reasonably small.
const CHUNK = 25;
for (let i = 0; i < lines.length; i += CHUNK) {
  const batch = lines.slice(i, i + CHUNK).join('\n');
  try {
    sqlExecFile(batch);
    updated += Math.min(CHUNK, lines.length - i);
  } catch (e) {
    console.error(`\n  chunk ${i}..${i + CHUNK} failed — ${String(e.message || e).slice(0, 200)}`);
    updateFailed += Math.min(CHUNK, lines.length - i);
  }
  process.stdout.write(`\r  applied ~${updated}/${lines.length} rows...`);
}
process.stdout.write('\n');
console.log(`\nDone. Updated ~${updated} rows, ${updateFailed} failed.`);
console.log(`Proposals log: ${OUT_PATH}\n`);
