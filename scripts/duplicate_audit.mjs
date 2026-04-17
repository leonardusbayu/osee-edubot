#!/usr/bin/env node
// Full-table duplicate audit — scans every published row in test_contents,
// extracts atomic question texts (both flat and grouped schemas), and reports
// groups of duplicates. Walks the table in pages so one D1 query stays small.
//
// Run from repo root: node scripts/duplicate_audit.mjs

import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const workerDir = path.resolve(__dirname, '..', 'worker');

const PAGE_SIZE = 500;
const MAX_PAGES = 40; // safety cap → up to 20k rows

function fetchPage(offset) {
  const sql = `SELECT id, test_type, section, question_type, content FROM test_contents WHERE status = 'published' ORDER BY id LIMIT ${PAGE_SIZE} OFFSET ${offset};`;
  let raw;
  try {
    raw = execSync(
      `npx wrangler d1 execute edubot-db --remote --json --command "${sql}"`,
      { cwd: workerDir, encoding: 'utf8', maxBuffer: 50 * 1024 * 1024 },
    );
  } catch (e) {
    console.error(`wrangler query failed at offset ${offset}`);
    console.error(e.stderr || e.message);
    process.exit(1);
  }
  const start = raw.indexOf('[');
  if (start < 0) return [];
  return JSON.parse(raw.slice(start))[0]?.results || [];
}

function normalize(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/<[^>]+>/g, '')      // strip HTML tags
    .replace(/\s+/g, ' ')
    .replace(/[^\w\s'-]/g, '')    // strip punctuation
    .trim();
}

// Yields { text, qId, subIndex, testType, section, questionType } for every atomic question
function* extractQuestions(row) {
  let c = {};
  try { c = typeof row.content === 'string' ? JSON.parse(row.content) : (row.content || {}); } catch { return; }

  const common = {
    qId: row.id,
    testType: row.test_type,
    section: row.section,
    questionType: row.question_type,
  };

  if (Array.isArray(c.questions) && c.questions.length > 0) {
    for (let i = 0; i < c.questions.length; i++) {
      const sq = c.questions[i];
      const text = sq.question_text || sq.question || sq.prompt || sq.text || '';
      if (text && String(text).trim().length >= 20) {
        yield { ...common, subIndex: i, text: String(text) };
      }
    }
  } else {
    const text = c.question || c.prompt || c.text || c.question_text || '';
    if (text && String(text).trim().length >= 20) {
      yield { ...common, subIndex: null, text: String(text) };
    }
  }
}

console.log('\n=== Full-Table Duplicate Audit ===\n');

// Collect
const byNorm = new Map();
let totalRows = 0;
let totalQuestions = 0;

for (let page = 0; page < MAX_PAGES; page++) {
  const rows = fetchPage(page * PAGE_SIZE);
  if (rows.length === 0) break;
  totalRows += rows.length;
  process.stdout.write(`\r  fetched ${totalRows} rows...`);

  for (const row of rows) {
    for (const q of extractQuestions(row)) {
      totalQuestions++;
      const key = normalize(q.text);
      if (!key) continue;
      if (!byNorm.has(key)) byNorm.set(key, []);
      byNorm.get(key).push(q);
    }
  }

  if (rows.length < PAGE_SIZE) break;
}
process.stdout.write('\n');

console.log(`\nScanned ${totalRows} rows, ${totalQuestions} atomic questions.\n`);

// Filter to dupes
const dupes = [...byNorm.entries()]
  .filter(([, items]) => items.length > 1)
  .sort((a, b) => b[1].length - a[1].length);

if (dupes.length === 0) {
  console.log('No duplicates found.\n');
  process.exit(0);
}

// Summary
const totalDupeItems = dupes.reduce((s, [, items]) => s + items.length, 0);
const uniqueDupeGroups = dupes.length;
const extraDupeRows = totalDupeItems - uniqueDupeGroups; // dupe count beyond "first occurrence"

console.log(`${uniqueDupeGroups} duplicate groups covering ${totalDupeItems} occurrences`);
console.log(`  (${extraDupeRows} "extra" occurrences — i.e. rows that repeat text already seen)\n`);

// Break down by test_type and section
const bySection = new Map();
for (const [, items] of dupes) {
  for (const item of items.slice(1)) { // count extras only
    const key = `${item.testType}/${item.section}/${item.questionType}`;
    bySection.set(key, (bySection.get(key) || 0) + 1);
  }
}
console.log('Duplicate extras by test_type/section/question_type:');
[...bySection.entries()]
  .sort((a, b) => b[1] - a[1])
  .forEach(([k, n]) => console.log(`  ${n.toString().padStart(4)}  ${k}`));

// Top N dup groups by occurrence count
console.log('\nTop 15 dup groups by occurrence count:');
for (const [norm, items] of dupes.slice(0, 15)) {
  const preview = items[0].text.replace(/\s+/g, ' ').slice(0, 90);
  const ids = items.map(i => i.subIndex != null ? `#${i.qId}:${i.subIndex}` : `#${i.qId}`).join(', ');
  console.log(`  [${items.length}x] "${preview}${preview.length === 90 ? '…' : ''}"`);
  console.log(`         ${ids}`);
}

console.log();
process.exit(0);
