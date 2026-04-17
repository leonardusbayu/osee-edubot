#!/usr/bin/env node
// Reconstructs the 635 reading-section sub-questions whose options[].text is "".
// For each row: sends passage_text + question_text + correct-answer letter +
// explanation to GPT-4o-mini, asks for the 4 option texts back as JSON, and
// writes them into options[].text while preserving is_answer.
//
// The explanation field already describes each option (e.g. "A ❌ Incorrect:
// The text says X...") so GPT has strong grounding for reconstruction.
//
// Default is dry-run. Re-run with --apply to push UPDATE statements to D1.
//
// Run from repo root:
//   node scripts/reconstruct_reading_options.mjs            # dry run
//   node scripts/reconstruct_reading_options.mjs --apply    # push to D1
//   node scripts/reconstruct_reading_options.mjs --limit 5  # sample first N
//
// Cost: 635 × ~800 tok in + 80 tok out @ gpt-4o-mini ≈ $0.20
// Runtime: ~4 min with concurrency=5.

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const workerDir = path.resolve(__dirname, '..', 'worker');
const OUT = path.join(__dirname, 'reconstruct_reading.out.json');

const APPLY = process.argv.includes('--apply');
const LIMIT = (() => {
  const i = process.argv.indexOf('--limit');
  return i > -1 ? parseInt(process.argv[i + 1], 10) || 0 : 0;
})();
const CONCURRENCY = 5;

// --- Key loading (same pattern as backfill_listening_questions.mjs) -----
function loadKey() {
  const candidates = [
    path.join(workerDir, '.dev.vars'),
    path.join(workerDir, '.env'),
    path.resolve(__dirname, '..', '.env'),
  ];
  for (const p of candidates) {
    if (!fs.existsSync(p)) continue;
    const m = fs.readFileSync(p, 'utf8').match(/^\s*OPENAI_API_KEY\s*=\s*["']?([^"'\r\n]+)["']?/m);
    if (m) { console.log(`Using OPENAI_API_KEY from ${path.relative(process.cwd(), p)}`); return m[1].trim(); }
  }
  if (process.env.OPENAI_API_KEY) { console.log('Using OPENAI_API_KEY from process.env'); return process.env.OPENAI_API_KEY; }
  return null;
}
const apiKey = loadKey();
if (!apiKey) { console.error('OPENAI_API_KEY not found in worker/.dev.vars, worker/.env, .env, or process.env'); process.exit(1); }

// --- D1 helpers --------------------------------------------------------
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
  const tmp = path.join(__dirname, `.recon_tmp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.sql`);
  fs.writeFileSync(tmp, sqlText, 'utf8');
  try {
    execSync(`npx wrangler d1 execute edubot-db --remote --file="${tmp}"`, { cwd: workerDir, stdio: 'pipe' });
  } finally {
    fs.unlinkSync(tmp);
  }
}

// --- 1. Collect ---------------------------------------------------------
console.log('Scanning for reading rows with empty options...');
const todo = [];
let scanned = 0;
const PAGE = 500;
for (let off = 0; off < 20000; off += PAGE) {
  const rows = sqlSelect(
    `SELECT id, test_type, section, question_type, content FROM test_contents WHERE status = 'published' AND section = 'reading' ORDER BY id LIMIT ${PAGE} OFFSET ${off};`,
  );
  if (!rows.length) break;
  scanned += rows.length;
  process.stdout.write(`\r  scanned ${scanned} reading rows...`);

  for (const r of rows) {
    let c; try { c = JSON.parse(r.content); } catch { continue; }

    const passage = String(c.passage_text || c.passage || '').trim();
    if (!passage) continue;

    // Flat schema: options lives directly on c
    if (Array.isArray(c.options) && c.options.length) {
      const hasEmpty = c.options.every((o) => typeof o === 'object' && !String(o.text || '').trim());
      if (hasEmpty) {
        const answer = Array.isArray(c.answers) ? c.answers[0] : (c.correct_answer || c.answer || '');
        todo.push({
          id: r.id, test_type: r.test_type, question_type: r.question_type,
          passage, question: c.question_text || c.question || '',
          explanation: c.explanation || '', answer, content: c, flat: true,
        });
      }
    }
    // Grouped schema (rare for reading but handle it)
    if (Array.isArray(c.questions)) {
      c.questions.forEach((sq, i) => {
        if (!Array.isArray(sq.options) || !sq.options.length) return;
        const hasEmpty = sq.options.every((o) => typeof o === 'object' && !String(o.text || '').trim());
        if (!hasEmpty) return;
        const answer = Array.isArray(sq.answers) ? sq.answers[0] : (sq.correct_answer || sq.answer || '');
        todo.push({
          id: r.id, test_type: r.test_type, question_type: r.question_type, subIndex: i,
          passage, question: sq.question_text || sq.question || '',
          explanation: sq.explanation || c.explanation || '', answer, content: c, flat: false,
        });
      });
    }
  }
  if (rows.length < PAGE) break;
}
process.stdout.write('\n');
console.log(`\nFound ${todo.length} sub-questions to reconstruct.`);

const work = LIMIT > 0 ? todo.slice(0, LIMIT) : todo;
if (LIMIT > 0) console.log(`--limit ${LIMIT} applied → processing ${work.length}.`);
if (!work.length) { console.log('Nothing to do.'); process.exit(0); }

// --- 2. Reconstruct via GPT-4o-mini -------------------------------------
async function askGPT(item, retryNote = '') {
  const ans = String(item.answer || '').toUpperCase();
  const prompt = `You are reconstructing the four answer options (A, B, C, D) for a TOEFL reading comprehension multiple-choice question. The original option texts were lost during data import, but the explanation describes each option's content.

PASSAGE:
"""
${item.passage}
"""

QUESTION: ${item.question}

CORRECT ANSWER LETTER: ${ans}

EXPLANATION (describes what each option was about and why it's right or wrong):
"""
${item.explanation}
"""

Rules (CRITICAL — violating any rule produces an unusable question):
1. Option "${ans}" must be the ONLY option that is factually correct according to the passage.
2. Each of the other three options must assert a DIFFERENT factual claim that CONTRADICTS the passage — wrong date, wrong person, wrong place, wrong quantity, wrong cause, wrong action, etc. They must NOT be paraphrases or rewordings of the correct answer with different verbs/synonyms.
3. No two options may describe the same fact — every option must be verifiably distinct in content (not just in wording).
4. Each option should be roughly the same length and phrasing style (ITP-typical: a single clause or sentence, no "None of the above" / "All of the above").
5. Mine the EXPLANATION above for the specific wrong claim each distractor was making — e.g. if the explanation says "A ❌ Incorrect: this is the date the reservation was made", then option A should be the reservation-made date, not a paraphrase of the class date.
${retryNote}
Respond with ONLY a JSON object of this exact shape, no markdown, no commentary:
{"A": "...", "B": "...", "C": "...", "D": "..."}`;

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.2,
      max_tokens: 400,
      response_format: { type: 'json_object' },
    }),
  });
  if (!res.ok) throw new Error(`OpenAI ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const j = await res.json();
  const raw = j.choices?.[0]?.message?.content?.trim() || '{}';
  const obj = JSON.parse(raw);
  const keys = ['A', 'B', 'C', 'D'];
  const out = keys.map((k) => String(obj[k] || '').trim());
  if (out.some((t) => !t)) throw new Error(`missing key(s) in ${JSON.stringify(obj)}`);
  return out; // [A_text, B_text, C_text, D_text]
}

console.log(`\nReconstructing via GPT-4o-mini (concurrency=${CONCURRENCY})...`);
const proposals = [];
let done = 0, failed = 0;

// Simple concurrency pool
// Jaccard similarity over content-word tokens (ignoring stop words + length).
// Returns 0..1 where ≥0.55 = probably duplicate/paraphrase.
const STOP = new Set('a an the of to and or but for with in on at by is are was were be been being will would should could can may might have has had do does did not no it its this that these those as from into about after before during their there his her our your my'.split(' '));
function contentWords(s) {
  return new Set(String(s).toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter((w) => w.length > 2 && !STOP.has(w)));
}
function jaccard(a, b) {
  if (!a.size || !b.size) return 0;
  let inter = 0;
  for (const w of a) if (b.has(w)) inter++;
  return inter / (a.size + b.size - inter);
}
function findNearDupes(texts) {
  const sets = texts.map(contentWords);
  const pairs = [];
  for (let i = 0; i < 4; i++) for (let j = i + 1; j < 4; j++) {
    const sim = jaccard(sets[i], sets[j]);
    if (sim >= 0.55) pairs.push([i, j, sim]);
  }
  return pairs;
}

async function worker(queue) {
  while (queue.length) {
    const item = queue.shift();
    try {
      let texts = await askGPT(item);
      let dupes = findNearDupes(texts);
      if (dupes.length) {
        const letters = dupes.map(([i, j, s]) => `${'ABCD'[i]}/${'ABCD'[j]}=${s.toFixed(2)}`).join(', ');
        const retryNote = `\nPREVIOUS ATTEMPT FAILED: options ${letters} were near-paraphrases of each other. Regenerate with TRULY distinct factual content for every option.\n`;
        texts = await askGPT(item, retryNote);
        dupes = findNearDupes(texts);
      }
      proposals.push({
        id: item.id,
        subIndex: item.subIndex ?? null,
        question_type: item.question_type,
        answer: item.answer,
        question: item.question,
        newOptions: texts,
        dupeWarn: dupes.length ? dupes.map(([i, j, s]) => `${'ABCD'[i]}~${'ABCD'[j]}:${s.toFixed(2)}`) : undefined,
      });
      const targetOpts = item.flat ? item.content.options : item.content.questions[item.subIndex].options;
      for (let k = 0; k < 4 && k < targetOpts.length; k++) {
        targetOpts[k].text = texts[k];
      }
      done++;
    } catch (e) {
      console.error(`\n  #${item.id}${item.subIndex != null ? `:${item.subIndex}` : ''} failed — ${e.message}`);
      failed++;
    }
    process.stdout.write(`\r  done ${done}  failed ${failed}  (of ${work.length})  `);
  }
}

const queue = [...work];
await Promise.all(Array.from({ length: CONCURRENCY }, () => worker(queue)));
process.stdout.write('\n');

fs.writeFileSync(OUT, JSON.stringify(proposals, null, 2));
console.log(`\nWrote ${proposals.length} proposals to ${OUT}`);

console.log('\nSample proposals (first 5):');
for (const p of proposals.slice(0, 5)) {
  const warn = p.dupeWarn ? `  ⚠ dup: ${p.dupeWarn.join(',')}` : '';
  console.log(`  #${p.id}${p.subIndex != null ? `:${p.subIndex}` : ''}  [ans=${p.answer}]${warn}  Q: ${p.question.slice(0, 80)}`);
  p.newOptions.forEach((t, i) => console.log(`      ${'ABCD'[i]}. ${t.slice(0, 100)}`));
}

const flagged = proposals.filter((p) => p.dupeWarn);
if (flagged.length) {
  console.log(`\n⚠ ${flagged.length} proposals still have duplicate-option warnings after retry.`);
  console.log(`   IDs: ${flagged.map((p) => `#${p.id}${p.subIndex != null ? `:${p.subIndex}` : ''}`).slice(0, 20).join(' ')}${flagged.length > 20 ? ' ...' : ''}`);
  console.log(`   Review these in ${path.basename(OUT)} before --apply.`);
} else {
  console.log(`\n✓ No duplicate-option warnings remain.`);
}

if (!APPLY) {
  console.log('\nDRY RUN — no writes. Review the JSON, then re-run with --apply to push to D1.\n');
  process.exit(0);
}

// --- 3. Apply -----------------------------------------------------------
console.log('\nApplying UPDATEs to D1...');

// Group by row id so we write each row once even if it had multiple subs
const byRow = new Map();
for (const item of work) {
  if (!byRow.has(item.id)) byRow.set(item.id, item.content);
}

const lines = [];
for (const [id, content] of byRow) {
  const json = JSON.stringify(content).replace(/'/g, "''");
  lines.push(`UPDATE test_contents SET content = '${json}' WHERE id = ${id};`);
}

const CHUNK = 25;
let applied = 0, applyFailed = 0;
for (let i = 0; i < lines.length; i += CHUNK) {
  const batch = lines.slice(i, i + CHUNK).join('\n');
  try {
    sqlExecFile(batch);
    applied += Math.min(CHUNK, lines.length - i);
  } catch (e) {
    console.error(`\n  chunk ${i}..${i + CHUNK} failed — ${String(e.message || e).slice(0, 200)}`);
    applyFailed += Math.min(CHUNK, lines.length - i);
  }
  process.stdout.write(`\r  applied ~${applied}/${lines.length} rows...`);
}
process.stdout.write('\n');
console.log(`\nDone. Updated ~${applied} rows, ${applyFailed} failed.`);
console.log(`Proposals log: ${OUT}\n`);
