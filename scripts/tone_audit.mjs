#!/usr/bin/env node
// Indonesian tone audit — scan source for user-facing string anti-patterns.
// Run from repo root: node scripts/tone_audit.mjs

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const SCAN_DIRS = [
  path.join(ROOT, 'worker', 'src'),
  path.join(ROOT, 'frontend', 'src'),
];

const EXT = new Set(['.ts', '.tsx']);

function walk(dir) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
      out.push(...walk(full));
    } else if (EXT.has(path.extname(entry.name))) {
      out.push(full);
    }
  }
  return out;
}

const files = SCAN_DIRS.flatMap(walk);
const issues = [];

const CJK_CYRILLIC = /[\u4e00-\u9fff\u3040-\u30ff\uac00-\ud7af\u0400-\u04ff]/;
const FORMAL_ANDA = /\bAnda\b/;
// A user-facing shouting line looks like a sendMessage/alert call with CAPS.
// We detect it by looking for backtick/quote strings containing multiple
// ALL-CAPS words that are NOT SQL keywords and NOT inside a .prepare() call.
const SHOUTING = /(?:sendMessage|editMessage|alert|toast)\s*\([^)]*['"`][^'"`]*\b[A-Z]{4,}\s+[A-Z]{4,}\b/;
const SQL_KEYWORDS = /\b(SELECT|INSERT|UPDATE|DELETE|FROM|WHERE|VALUES|CREATE|TABLE|INDEX|INTO|JOIN|ORDER|GROUP|LIMIT|ON|AS|IF|AND|OR|NOT|NULL|PRIMARY|KEY|UNIQUE|REPLACE|CONFLICT|DO|IS|BETWEEN|LIKE|IN|SET|CASE|WHEN|THEN|ELSE|END|COUNT|SUM|AVG|MAX|MIN|BY|DESC|ASC|LEFT|RIGHT|OUTER|INNER|UNION|ALL)\b/;
const UNTRANSLATED_ERR = [
  "'Something went wrong'",
  "'An error occurred'",
  "'Please try again later'",
];

for (const file of files) {
  const rel = path.relative(ROOT, file);
  const lines = fs.readFileSync(file, 'utf8').split('\n');

  lines.forEach((line, i) => {
    const n = i + 1;
    // Skip comments for CJK/Cyrillic check
    const isComment = /^\s*(\/\/|\*)/.test(line);

    if (!isComment && CJK_CYRILLIC.test(line)) {
      issues.push({
        type: 'CJK/Cyrillic leak',
        where: `${rel}:${n}`,
        line: line.trim().slice(0, 150),
      });
    }

    if (FORMAL_ANDA.test(line) && (rel.includes('bot') || rel.includes('pages'))) {
      issues.push({
        type: 'Formal Anda',
        where: `${rel}:${n}`,
        line: line.trim().slice(0, 150),
      });
    }

    // Skip SQL-heavy lines (prepare statements have ALL-CAPS keywords but aren't user-facing)
    const isSql = /\.prepare\(|env\.DB\.prepare/.test(line) || (SQL_KEYWORDS.test(line) && /(SELECT|INSERT|UPDATE|DELETE|CREATE).*FROM|INTO|TABLE/.test(line));
    if (!isSql && SHOUTING.test(line)) {
      issues.push({
        type: 'Shouting in user-facing call',
        where: `${rel}:${n}`,
        line: line.trim().slice(0, 150),
      });
    }

    for (const pat of UNTRANSLATED_ERR) {
      if (line.includes(pat)) {
        issues.push({
          type: 'Untranslated error',
          where: `${rel}:${n}`,
          line: line.trim().slice(0, 150),
        });
      }
    }
  });
}

console.log('\n=== Indonesian Tone Audit ===\n');
console.log(`Scanned ${files.length} files.\n`);

if (issues.length === 0) {
  console.log('No tone issues found. Bahasa voice is consistent.\n');
  process.exit(0);
}

const grouped = {};
for (const i of issues) {
  (grouped[i.type] ||= []).push(i);
}

for (const [type, list] of Object.entries(grouped)) {
  console.log(`${type}  (${list.length})`);
  for (const i of list) {
    console.log(`  ${i.where}`);
    console.log(`    ${i.line}`);
  }
  console.log();
}

console.log(`=== Total: ${issues.length} issues ===\n`);
process.exit(1);
