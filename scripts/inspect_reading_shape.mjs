#!/usr/bin/env node
// Dumps the raw JSON content of a handful of reading-section rows so we
// can see what schema they use for options (which the main audit is
// mis-parsing as empty).

import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const workerDir = path.resolve(__dirname, '..', 'worker');

function sqlSelect(sql) {
  const raw = execSync(
    `npx wrangler d1 execute edubot-db --remote --json --command "${sql}"`,
    { cwd: workerDir, encoding: 'utf8', maxBuffer: 50 * 1024 * 1024 },
  );
  const start = raw.indexOf('[');
  if (start < 0) return [];
  return JSON.parse(raw.slice(start))[0]?.results || [];
}

// A few IDs from the empty-option audit + a wider sample across question types.
const IDS = [2, 3, 9, 15, 40, 100, 500, 1000];

for (const id of IDS) {
  const rows = sqlSelect(
    `SELECT id, test_type, section, question_type, content FROM test_contents WHERE id = ${id};`,
  );
  if (!rows.length) { console.log(`#${id}: not found\n`); continue; }
  const r = rows[0];
  console.log(`\n=== #${r.id}  ${r.test_type} / ${r.section} / ${r.question_type} ===`);
  try {
    const c = JSON.parse(r.content);
    console.log('TOP-LEVEL KEYS:', Object.keys(c));
    // If there's a questions array, show the keys of the first sub
    if (Array.isArray(c.questions) && c.questions.length) {
      console.log(`questions[0] KEYS:`, Object.keys(c.questions[0]));
      console.log(`questions[0].options shape:`, JSON.stringify(c.questions[0].options, null, 2)?.slice(0, 500));
    } else {
      console.log('options shape:', JSON.stringify(c.options, null, 2)?.slice(0, 500));
      console.log('choices shape:', JSON.stringify(c.choices, null, 2)?.slice(0, 500));
    }
    // Short preview of the whole JSON
    console.log('--- RAW (first 800 chars) ---');
    console.log(r.content.slice(0, 800));
  } catch (e) {
    console.log('PARSE ERROR:', e.message);
    console.log(r.content.slice(0, 400));
  }
}
