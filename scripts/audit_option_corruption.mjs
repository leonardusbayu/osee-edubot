#!/usr/bin/env node
// Scans all published test_contents for questions whose answer options look
// corrupted/truncated — the "A. Ms  B. Mr  C. Mr  D. Ms" pattern.
//
// Flags (per sub-question):
//   - TITLE_ONLY:     all options normalize to just a name-title (Mr/Ms/Mrs/Dr/Miss/Prof)
//   - ULTRA_SHORT:    all options are ≤ 4 chars after normalization
//   - DUP_OPTIONS:    2+ options are identical after normalization
//   - EMPTY_OPTION:   at least one option text is empty/blank
//   - UNEXPECTED_AUDIO: mediaUrl / audio_url present on a non-listening section
//
// Output:
//   scripts/audit_option_corruption.out.json — full list of offending rows
//   stdout — count-by-bucket + sample offenders

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const workerDir = path.resolve(__dirname, '..', 'worker');
const OUT = path.join(__dirname, 'audit_option_corruption.out.json');

function sqlSelect(sql) {
  const raw = execSync(
    `npx wrangler d1 execute edubot-db --remote --json --command "${sql}"`,
    { cwd: workerDir, encoding: 'utf8', maxBuffer: 200 * 1024 * 1024 },
  );
  const start = raw.indexOf('[');
  if (start < 0) return [];
  return JSON.parse(raw.slice(start))[0]?.results || [];
}

const normalize = (t) =>
  String(t ?? '').toLowerCase().replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();

const TITLE_RE = /^(mr|mrs|ms|miss|dr|prof|sir|madam)\.?$/i;

function optionText(o) {
  if (typeof o === 'string') return o;
  if (!o || typeof o !== 'object') return '';
  return o.text || o.label || o.value || o.content || o.option_text || o.answer || '';
}

function flagSub(sub, parentSection, parentQType, parentHasAudio) {
  const rawOpts = sub.options || sub.choices || [];
  if (!rawOpts.length) return null;
  const texts = rawOpts.map((o) => normalize(optionText(o)));
  const flags = [];

  if (texts.every((t) => TITLE_RE.test(t))) flags.push('TITLE_ONLY');
  if (texts.every((t) => t.length > 0 && t.length <= 4)) flags.push('ULTRA_SHORT');
  if (texts.some((t) => !t)) flags.push('EMPTY_OPTION');
  {
    const nonEmpty = texts.filter(Boolean);
    const uniq = new Set(nonEmpty);
    if (nonEmpty.length >= 2 && uniq.size < nonEmpty.length) flags.push('DUP_OPTIONS');
  }

  return flags.length ? { flags, texts: rawOpts.map(optionText) } : null;
}

const PAGE = 500;
const LISTENING_SECTIONS = new Set(['listening', 'listen', 'audio']);

console.log('Scanning published test_contents for option-corruption...');
const findings = [];
const buckets = { TITLE_ONLY: 0, ULTRA_SHORT: 0, DUP_OPTIONS: 0, EMPTY_OPTION: 0, UNEXPECTED_AUDIO: 0 };
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

    const section = String(r.section || '').toLowerCase();
    const isListening = LISTENING_SECTIONS.has(section) || /listen/i.test(r.question_type || '');
    const hasAudioField = !!(c.mediaUrl || c.media_url || c.audio_url || c.audioUrl || c.audio);

    // UNEXPECTED_AUDIO: audio field on a non-listening row
    if (hasAudioField && !isListening) {
      findings.push({
        id: r.id, test_type: r.test_type, section: r.section, question_type: r.question_type,
        subIndex: -1, flags: ['UNEXPECTED_AUDIO'],
        detail: { audioFields: Object.keys(c).filter((k) => /audio|media/i.test(k)) },
      });
      buckets.UNEXPECTED_AUDIO++;
    }

    // Grouped schema (has questions array)
    const subs = Array.isArray(c.questions) ? c.questions : null;
    if (subs) {
      subs.forEach((sq, i) => {
        const f = flagSub(sq, section, r.question_type, hasAudioField);
        if (f) {
          f.flags.forEach((flag) => buckets[flag]++);
          findings.push({
            id: r.id, test_type: r.test_type, section: r.section, question_type: r.question_type,
            subIndex: i, flags: f.flags, texts: f.texts,
            question_text: sq.question_text || sq.question || '',
          });
        }
      });
    } else {
      // Flat schema
      const f = flagSub(c, section, r.question_type, hasAudioField);
      if (f) {
        f.flags.forEach((flag) => buckets[flag]++);
        findings.push({
          id: r.id, test_type: r.test_type, section: r.section, question_type: r.question_type,
          subIndex: 0, flags: f.flags, texts: f.texts,
          question_text: c.question_text || c.question || c.prompt || '',
        });
      }
    }
  }
  if (rows.length < PAGE) break;
}
process.stdout.write('\n');

fs.writeFileSync(OUT, JSON.stringify(findings, null, 2));

console.log(`\nScanned ${scanned} published rows.`);
console.log(`Total findings: ${findings.length}`);
console.log('\nBy bucket:');
for (const [k, v] of Object.entries(buckets)) console.log(`  ${k.padEnd(18)} ${v}`);

// Group by question_type for a quick where-is-this-happening view
const byType = {};
for (const f of findings) {
  const key = `${f.question_type}  [${f.section}]`;
  byType[key] = (byType[key] || 0) + 1;
}
console.log('\nBy question_type + section:');
for (const [k, v] of Object.entries(byType).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${v.toString().padStart(4)}  ${k}`);
}

// Show worst offenders
console.log('\nSample offenders (first 10):');
for (const f of findings.slice(0, 10)) {
  const tag = f.flags.join('+');
  const preview = f.subIndex === -1
    ? `audio on non-listening`
    : `opts=${JSON.stringify(f.texts).slice(0, 100)}`;
  console.log(`  #${f.id}:${f.subIndex}  ${f.question_type}/${f.section}  [${tag}]  ${preview}`);
}

console.log(`\nFull report: ${OUT}\n`);
