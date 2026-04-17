#!/usr/bin/env node
// Pulls the ULTRA_SHORT finding IDs from the audit output and dumps each
// row's full options + question so we can see the actual corruption pattern.

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const workerDir = path.resolve(__dirname, '..', 'worker');
const AUDIT = path.join(__dirname, 'audit_option_corruption.out.json');

const findings = JSON.parse(fs.readFileSync(AUDIT, 'utf8'));
const ids = [...new Set(findings.filter((f) => f.flags.includes('ULTRA_SHORT')).map((f) => f.id))];
console.log(`ULTRA_SHORT distinct rows: ${ids.length}`);
console.log(`Sampling first 8...\n`);

function sqlSelect(sql) {
  const raw = execSync(
    `npx wrangler d1 execute edubot-db --remote --json --command "${sql}"`,
    { cwd: workerDir, encoding: 'utf8', maxBuffer: 50 * 1024 * 1024 },
  );
  const start = raw.indexOf('[');
  if (start < 0) return [];
  return JSON.parse(raw.slice(start))[0]?.results || [];
}

for (const id of ids.slice(0, 8)) {
  const rows = sqlSelect(`SELECT id, test_type, section, question_type, content FROM test_contents WHERE id = ${id};`);
  if (!rows.length) continue;
  const r = rows[0];
  console.log(`=== #${r.id}  ${r.test_type}/${r.section}/${r.question_type} ===`);
  try {
    const c = JSON.parse(r.content);
    const subs = Array.isArray(c.questions) ? c.questions : [c];
    subs.forEach((sq, i) => {
      const opts = sq.options || sq.choices || [];
      const q = sq.question_text || sq.question || '(no question)';
      console.log(`  [${i}] Q: ${q.slice(0, 120)}`);
      opts.forEach((o, j) => {
        const t = typeof o === 'string' ? o : (o.text || o.label || '');
        console.log(`      ${String.fromCharCode(65 + j)}. "${t}"`);
      });
    });
  } catch (e) {
    console.log('  PARSE ERROR:', e.message);
  }
  console.log();
}
