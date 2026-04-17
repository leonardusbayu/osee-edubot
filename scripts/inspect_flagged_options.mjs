#!/usr/bin/env node
// Dumps the full options + question for every dupeWarn'd proposal so we
// can eyeball whether the warnings are real duplicates or false positives.

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const IN = path.join(__dirname, 'reconstruct_reading.out.json');
const proposals = JSON.parse(fs.readFileSync(IN, 'utf8'));
const flagged = proposals.filter((p) => p.dupeWarn);

console.log(`Flagged proposals: ${flagged.length}\n`);
for (const p of flagged) {
  console.log(`=== #${p.id}${p.subIndex != null ? `:${p.subIndex}` : ''}  [ans=${p.answer}]  dup=${p.dupeWarn.join(',')}`);
  console.log(`Q: ${p.question}`);
  p.newOptions.forEach((t, i) => console.log(`  ${'ABCD'[i]}. ${t}`));
  console.log();
}
