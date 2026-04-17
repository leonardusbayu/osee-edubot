#!/usr/bin/env node
// Deep-inspection of listening items where any sub-question's question_text normalizes
// to "listen to the audio" (catches all variations: parens, punctuation, case).
//
// For each matching parent row, classify whether the audio is still retrievable:
//   (a) sub.script present       → UI plays audio, placeholder is only cosmetic
//   (b) parent.passage_script    → UI plays audio, placeholder is only cosmetic
//   (c) parent.media_url only    → audio is an attached file
//   (d) none of the above        → truly broken content, needs regeneration
//
// Run from repo root: node scripts/inspect_broken_listening.mjs

import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const workerDir = path.resolve(__dirname, '..', 'worker');

// Use --command with a single-line SQL (matches duplicate_audit, which works).
// No LIKE / parens — we do filtering in Node to avoid shell escape issues.
function query(sql) {
  let raw;
  try {
    raw = execSync(
      `npx wrangler d1 execute edubot-db --remote --json --command "${sql}"`,
      { cwd: workerDir, encoding: 'utf8', maxBuffer: 200 * 1024 * 1024 },
    );
  } catch (e) {
    console.error('wrangler query failed');
    console.error('SQL:', sql);
    console.error(e.stderr || e.message);
    process.exit(1);
  }
  const start = raw.indexOf('[');
  if (start < 0) return [];
  return JSON.parse(raw.slice(start))[0]?.results || [];
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

console.log('\n=== Deep Inspection: listen-to-the-audio placeholder items ===\n');

const matches = [];
let scanned = 0;
for (let off = 0; off < 20000; off += PAGE) {
  const rows = query(`SELECT id, test_type, section, question_type, media_url, content FROM test_contents WHERE status = 'published' ORDER BY id LIMIT ${PAGE} OFFSET ${off};`);
  if (rows.length === 0) break;
  scanned += rows.length;
  process.stdout.write(`\r  scanned ${scanned}...`);

  for (const r of rows) {
    let c;
    try { c = JSON.parse(r.content); } catch { continue; }
    const subs = Array.isArray(c.questions) ? c.questions : [];
    let anyPlaceholder = false;
    for (const sq of subs) {
      const qt = normalize(sq.question_text || sq.question || sq.prompt || sq.text || '');
      if (qt === TARGET_NORM) { anyPlaceholder = true; break; }
    }
    if (!anyPlaceholder) continue;

    const parentScript = String(c.passage_script || c.passage || c.script || '').trim();
    let placeholderCount = 0, subScriptCount = 0;
    for (const sq of subs) {
      if (normalize(sq.question_text || sq.question || '') === TARGET_NORM) {
        placeholderCount++;
        const subScript = String(sq.script || sq.audio_text || '').trim();
        if (subScript.length > 10) subScriptCount++;
      }
    }

    let cat;
    if (subScriptCount === placeholderCount) cat = 'subScript';
    else if (parentScript.length > 10)       cat = 'parentPassage';
    else if (r.media_url)                    cat = 'mediaUrl';
    else                                     cat = 'broken';

    matches.push({
      id: r.id, test_type: r.test_type, question_type: r.question_type,
      subs: subs.length, placeholderCount, subScriptCount,
      parentScriptLen: parentScript.length, mediaUrl: r.media_url || null,
      cat, rawContent: r.content,
    });
  }
  if (rows.length < PAGE) break;
}
process.stdout.write('\n');

console.log(`\nScanned ${scanned} rows. Found ${matches.length} parent rows with the placeholder.\n`);

const buckets = { subScript: [], parentPassage: [], mediaUrl: [], broken: [] };
for (const m of matches) buckets[m.cat].push(m);

console.log('Breakdown:');
console.log(`  ${buckets.subScript.length.toString().padStart(4)}  sub has own script           → audio plays; field label is cosmetic`);
console.log(`  ${buckets.parentPassage.length.toString().padStart(4)}  parent passage_script        → audio plays; field label is cosmetic`);
console.log(`  ${buckets.mediaUrl.length.toString().padStart(4)}  media_url only               → audio file attached`);
console.log(`  ${buckets.broken.length.toString().padStart(4)}  NO audio anywhere            → truly broken, needs content fix`);
console.log();

for (const [name, arr] of Object.entries(buckets)) {
  if (arr.length === 0) continue;
  console.log(`--- ${name} (${arr.length} items) ---`);
  const byType = new Map();
  for (const m of arr) {
    const k = `${m.test_type}/${m.question_type}`;
    byType.set(k, (byType.get(k) || 0) + 1);
  }
  [...byType.entries()].sort((a, b) => b[1] - a[1]).forEach(([k, n]) => console.log(`    ${n.toString().padStart(4)}  ${k}`));
  console.log(`    sample ids: ${arr.slice(0, 10).map(m => `#${m.id}`).join(', ')}`);
  console.log();
}

// Full JSON dump of one sample from the biggest bucket
const biggestName = Object.entries(buckets).sort((a, b) => b[1].length - a[1].length)[0][0];
const biggest = buckets[biggestName];
if (biggest.length > 0) {
  const sample = biggest[0];
  console.log(`=== Full JSON for sample #${sample.id} (bucket: ${biggestName}) ===\n`);
  try {
    const parsed = JSON.parse(sample.rawContent);
    console.log(JSON.stringify(parsed, null, 2).slice(0, 3500));
  } catch {
    console.log(String(sample.rawContent).slice(0, 3500));
  }
  console.log();
}

// Reference good item if any
const goodRow = query(`SELECT id, content FROM test_contents WHERE status = 'published' AND question_type = 'listen_short_dialogue' ORDER BY id LIMIT 5;`);
let good = null;
for (const r of goodRow) {
  try {
    const c = JSON.parse(r.content);
    if (Array.isArray(c.questions) && c.questions.some(sq => {
      const qt = normalize(sq.question_text || '');
      return qt && qt !== TARGET_NORM && qt.length > 5;
    })) {
      good = { id: r.id, content: c };
      break;
    }
  } catch {}
}
if (good) {
  console.log(`=== Reference known-good listen_short_dialogue (#${good.id}) ===\n`);
  console.log(JSON.stringify(good.content, null, 2).slice(0, 2500));
  console.log();
} else {
  console.log('(no placeholder-free listen_short_dialogue found in first 5 — the ingestion bug may affect ALL items of this type)\n');
}
