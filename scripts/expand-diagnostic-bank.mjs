#!/usr/bin/env node
// Pull questions from test_contents + insert into diagnostic_question_bank
// with difficulty variation. Run once to expand the diagnostic bank.
//
// Usage:
//   CLOUDFLARE_API_TOKEN=... node scripts/expand-diagnostic-bank.mjs
//
// Output: a SQL file at scripts/099_expand_diagnostic_bank.sql that
// you then apply with `npx wrangler d1 execute edubot-db --remote --file=...`.

import { execSync } from 'node:child_process';
import fs from 'node:fs';

const CF_TOKEN = process.env.CLOUDFLARE_API_TOKEN;
if (!CF_TOKEN) {
  console.error('Missing CLOUDFLARE_API_TOKEN env var');
  process.exit(1);
}

// Map diagnostic sections → test_contents sections
// (diagnostic uses 'grammar'/'vocabulary', test_contents uses 'structure'/'reading' etc)
const SECTION_MAP = {
  TOEFL_IBT: { grammar: null, vocabulary: null, reading: 'reading', listening: 'listening' },  // iBT has no grammar section
  TOEFL_ITP: { grammar: 'structure', vocabulary: null, reading: 'reading', listening: 'listening' },
  IELTS: { grammar: null, vocabulary: null, reading: 'reading', listening: 'listening' },
  TOEIC: { grammar: null, vocabulary: 'reading', reading: 'reading', listening: 'listening' },  // TOEIC reading has vocab in incomplete_sentences
};

const TARGET_TEST = process.argv[2] || null;  // optional: only one test type
const tests = TARGET_TEST ? [TARGET_TEST] : ['TOEFL_IBT', 'TOEFL_ITP', 'IELTS', 'TOEIC'];

function fetchRows(testType, section, difficulty, limit) {
  const cmd = `npx wrangler d1 execute edubot-db --remote --command "SELECT id, content, skill_tags FROM test_contents WHERE test_type='${testType}' AND section='${section}' AND difficulty=${difficulty} AND status='published' ORDER BY RANDOM() LIMIT ${limit}" --json`;
  const out = execSync(cmd, {
    cwd: 'D:\\claude telegram bot\\worker',
    env: { ...process.env, CLOUDFLARE_API_TOKEN: CF_TOKEN },
    encoding: 'utf8',
    maxBuffer: 100 * 1024 * 1024,
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  const j = JSON.parse(out);
  return (Array.isArray(j) ? j[0].results : j.results) || [];
}

// Extract a flat question object from a test_contents.content JSON.
// Different question_types have different shapes — we normalize to:
//   { question_text, options, correct_answer }
function normalizeQuestion(content) {
  let c;
  try { c = JSON.parse(content); } catch { return null; }
  // Flat structure: question_text + options at top level
  if (c.question_text && Array.isArray(c.options)) {
    // Determine the correct answer. The `answers` field can be:
    //   - a letter string ("a", "b", "c", "d") — map to option index
    //   - an array of letters (["a"]) — take first
    //   - an array of option texts (["Some text"]) — match against options
    // The `is_answer: true` flag on options is unreliable in the
    // source data (often all false), so we don't trust it.
    let correctAnswer = '';
    const ans = c.answers;
    if (Array.isArray(ans) && ans.length > 0) {
      const first = String(ans[0] || '').trim();
      if (/^[a-zA-Z]$/.test(first) && c.options[letterToIndex(first)]) {
        correctAnswer = c.options[letterToIndex(first)].text || first;
      } else {
        correctAnswer = first;
      }
    } else if (typeof ans === 'string') {
      const a = ans.trim();
      if (/^[a-zA-Z]$/.test(a) && c.options[letterToIndex(a)]) {
        correctAnswer = c.options[letterToIndex(a)].text || a;
      } else {
        correctAnswer = a;
      }
    }
    // Fall back to the first option with is_answer: true (rare but present)
    if (!correctAnswer) {
      const marked = c.options.find((o) => o.is_answer === true);
      if (marked) correctAnswer = marked.text || '';
    }
    return {
      question_text: c.question_text,
      options: c.options.map((o) => ({ text: o.text, is_answer: o.is_answer === true })),
      correct_answer: correctAnswer,
    };
  }
  // Grouped: questions[] array
  if (Array.isArray(c.questions) && c.questions.length > 0) {
    const q = c.questions[0];
    let correctAnswer = '';
    const ans = q.answers;
    if (Array.isArray(ans) && ans.length > 0) {
      const first = String(ans[0] || '').trim();
      if (/^[a-zA-Z]$/.test(first) && q.options && q.options[letterToIndex(first)]) {
        correctAnswer = q.options[letterToIndex(first)].text || first;
      } else {
        correctAnswer = first;
      }
    } else if (typeof ans === 'string') {
      const a = ans.trim();
      if (q.options && /^[a-zA-Z]$/.test(a) && q.options[letterToIndex(a)]) {
        correctAnswer = q.options[letterToIndex(a)].text || a;
      } else {
        correctAnswer = a;
      }
    }
    return {
      question_text: q.question_text || q.script || '',
      options: (q.options || []).map((o) => ({ text: o.text, is_answer: o.is_answer === true })),
      correct_answer: correctAnswer,
    };
  }
  return null;
}

function letterToIndex(letter) {
  const lower = letter.toLowerCase();
  if (lower === 'a') return 0;
  if (lower === 'b') return 1;
  if (lower === 'c') return 2;
  if (lower === 'd') return 3;
  if (lower === 'e') return 4;
  return -1;
}

let nextId = 1000;  // start after existing seed ids
const sqlLines = [];
sqlLines.push('-- 099: Expand diagnostic_question_bank with questions pulled from test_contents.');
sqlLines.push('-- Generated by scripts/expand-diagnostic-bank.mjs');
sqlLines.push('-- Adds difficulty variation (2, 3, 4) per topic so the diagnostic can branch.');
sqlLines.push('');

for (const testType of tests) {
  const sectionMap = SECTION_MAP[testType];
  console.log(`Processing ${testType}...`);

  for (const [diagSection, tcSection] of Object.entries(sectionMap)) {
    if (!tcSection) continue;  // test has no equivalent section

    for (const difficulty of [2, 3, 4]) {
      // Try to get 3 questions per (section, difficulty)
      const rows = fetchRows(testType, tcSection, difficulty, 3);
      console.log(`  ${testType} ${diagSection} d=${difficulty}: found ${rows.length} rows`);

      for (const row of rows) {
        const normalized = normalizeQuestion(row.content);
        if (!normalized || !normalized.question_text || !normalized.options || !normalized.correct_answer) continue;

        // Extract topic from skill_tags (first tag)
        let topic = diagSection;
        try {
          const tags = JSON.parse(row.skill_tags || '[]');
          if (Array.isArray(tags) && tags.length > 0) topic = tags[0];
        } catch {}

        // Escape strings for SQL
        const esc = (s) => String(s || '').replace(/'/g, "''").replace(/\n/g, ' ').substring(0, 1000);
        const questionEsc = esc(normalized.question_text);
        const optionsEsc = esc(JSON.stringify(normalized.options));
        const answerEsc = esc(normalized.correct_answer);
        const tcId = row.id;

        sqlLines.push(
          `INSERT OR IGNORE INTO diagnostic_question_bank (id, test_type, section, topic, question, options, correct_answer, explanation, difficulty, is_active, source) ` +
          `VALUES (${nextId}, '${testType}', '${diagSection}', '${topic}', '${questionEsc}', '${optionsEsc}', '${answerEsc}', 'Pulled from test_contents id=${tcId}', ${difficulty}, 1, 'test_contents');`
        );
        nextId++;
      }
    }
  }
}

fs.writeFileSync('D:\\claude telegram bot\\worker\\migrations\\099_expand_diagnostic_bank.sql', sqlLines.join('\n') + '\n');
console.log(`\nWrote ${sqlLines.length - 3} INSERT lines to worker/migrations/099_expand_diagnostic_bank.sql`);