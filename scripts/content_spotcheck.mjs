#!/usr/bin/env node
// Content quality spot-check — samples 50 published questions from D1 and flags real issues.
// Run from repo root: node scripts/content_spotcheck.mjs
//
// Schema knowledge baked in (from TestRunner.tsx):
//   FLAT:    { question, correct_answer|answer, options, explanation, passage? }
//   GROUPED: { type: 'grouped_*', passage_script|passage_text|passage, questions: [...] }
//
// Per-question-type exemptions:
//   complete_the_words:    passage_text IS the question, top-level `answers` holds blank letters
//   build_sentence:        sub.passage template IS the question, options are word tiles
//   listen_choose_response: each sub has its own `script` (audio) — no parent passage needed
//   question_response:     audio-only prompt, no text question expected
//   photographs:           image-based, no text question expected

import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const workerDir = path.resolve(__dirname, '..', 'worker');

const sql = `SELECT id, test_type, section, question_type, title, content, media_url, difficulty, topic FROM test_contents WHERE status = 'published' ORDER BY RANDOM() LIMIT 50;`;

console.log('\n=== Content Spot-Check (50 random published) ===\n');

let raw;
try {
  raw = execSync(
    `npx wrangler d1 execute edubot-db --remote --json --command "${sql}"`,
    { cwd: workerDir, encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 },
  );
} catch (e) {
  console.error('wrangler d1 execute failed.');
  console.error('Ensure you are logged in:  cd worker && npx wrangler login');
  console.error(e.stderr || e.message);
  process.exit(1);
}

const jsonStart = raw.indexOf('[');
if (jsonStart < 0) {
  console.error('Could not find JSON in wrangler output');
  console.error(raw.slice(0, 500));
  process.exit(1);
}
const data = JSON.parse(raw.slice(jsonStart));
const rows = data[0]?.results || [];

console.log(`Got ${rows.length} rows from D1.\n`);

// Question types where passage/script/image IS the question (don't require question_text)
const PASSAGE_IS_QUESTION = new Set([
  'complete_the_words',
  'build_sentence',
  'listen_choose_response',
  'question_response',
  'photographs',
  'listen_and_repeat',
  'take_interview',
  'write_email',
  'write_academic_discussion',
  'integrated_writing',
]);

// Question types where the sub-question has its own script/audio (not a shared passage)
const PER_SUB_AUDIO = new Set([
  'listen_choose_response',
  'question_response',
  'photographs',
  'listen_and_repeat',
  'take_interview',
]);

// Question types that are free-response (no single correct answer)
const FREE_RESPONSE = new Set([
  'essay',
  'free_response',
  'write_email',
  'write_academic_discussion',
  'integrated_writing',
  'listen_and_repeat',
  'take_interview',
  'build_sentence',
]);

const issues = [];
const seen = new Map();

const NON_LATIN = /[\u4e00-\u9fff\u3040-\u30ff\uac00-\ud7af\u0400-\u04ff]/;

function str(v) { return (v == null ? '' : String(v)).trim(); }

function optionsText(opts) {
  if (!Array.isArray(opts)) return '';
  return opts.map((o) => {
    if (typeof o === 'string') return o;
    return o.text || o.label || o.value || o.content || o.answer || o.option_text || `(${o.key || '?'})`;
  }).join('|');
}

function correctInOptions(correct, opts) {
  if (!Array.isArray(opts) || opts.length === 0 || !correct) return true;
  const c = String(correct).trim().toLowerCase();
  return opts.some((o, i) => {
    if (typeof o === 'string') return o.toLowerCase() === c;
    const candidates = [o.key, o.id, o.label, o.text, o.value, String(i), String.fromCharCode(65 + i)];
    return candidates.some(x => x != null && String(x).trim().toLowerCase() === c);
  });
}

// Validate one atomic question (flat, or one element of grouped.questions)
function validateAtomic(id, section, qType, q, parentQType, isSub = false) {
  const locator = isSub ? `[#${id}:${q.index ?? '?'}]` : `[#${id}]`;
  const effectiveType = parentQType || qType;

  const qText = str(q.question_text || q.question || q.prompt || q.text);
  const subScript = str(q.script || q.audio_text);
  const subImage = str(q.image_url || q.media_url);
  const subPassage = str(q.passage);
  const answers = q.answers || q.correct_answers
    || (q.correct_answer != null ? [q.correct_answer] : null)
    || (q.answer != null ? [q.answer] : null);
  const correct = Array.isArray(answers) ? str(answers[0]) : str(answers);
  const options = q.options || q.choices || [];
  const explanation = str(q.explanation);

  // Question text: only required if passage/script/image isn't the question itself
  const hasOwnPrompt = subScript.length > 0 || subImage.length > 0 || subPassage.length > 0;
  const passageIsQuestion = PASSAGE_IS_QUESTION.has(effectiveType);
  const needsQuestionText = section !== 'writing' && section !== 'speaking' && !passageIsQuestion && !hasOwnPrompt;
  if (!qText && needsQuestionText) {
    issues.push(`${locator} ${section}/${effectiveType}: empty question text`);
  }

  // Correct answer required unless free-response
  if (!correct && !FREE_RESPONSE.has(effectiveType) && section !== 'writing' && section !== 'speaking') {
    issues.push(`${locator} ${section}/${effectiveType}: missing correct answer`);
  }

  // MCQ check — only when we have both a correct answer and options
  if (correct && Array.isArray(options) && options.length > 0) {
    if (!correctInOptions(correct, options)) {
      issues.push(`${locator} MCQ: correct "${correct}" not in options [${optionsText(options).slice(0, 80)}]`);
    }
  }

  if (explanation && explanation.length > 0 && explanation.length < 20) {
    issues.push(`${locator} explanation too short: "${explanation}"`);
  }

  if (NON_LATIN.test(qText + explanation)) {
    issues.push(`${locator} non-Latin character leak in question`);
  }

  // Duplicate detection — only for atomic items with meaningful text
  const dupKey = qText.length >= 20 ? qText.slice(0, 80) : '';
  if (dupKey && seen.has(dupKey)) {
    issues.push(`${locator} duplicate question_text (first seen ${seen.get(dupKey)})`);
  } else if (dupKey) {
    seen.set(dupKey, locator);
  }
}

for (const r of rows) {
  let parsed = {};
  try { parsed = typeof r.content === 'string' ? JSON.parse(r.content) : (r.content || {}); }
  catch { issues.push(`[#${r.id}] content column is not valid JSON`); continue; }

  const isGrouped = Array.isArray(parsed.questions) && parsed.questions.length > 0;

  if (isGrouped) {
    const passage = str(parsed.passage_script || parsed.passage || parsed.script || parsed.reading_passage || parsed.passage_text);

    if (r.section === 'reading' && passage && passage.length < 100) {
      issues.push(`[#${r.id}] reading passage too short (${passage.length} chars)`);
    }

    // Listening passage check: for PER_SUB_AUDIO types, sub items carry their own script — skip parent check
    if (r.section === 'listening' && !PER_SUB_AUDIO.has(r.question_type)) {
      if (!passage && !r.media_url) {
        issues.push(`[#${r.id}] listening item has no passage_script AND no media_url`);
      }
    }

    if (NON_LATIN.test(passage)) {
      issues.push(`[#${r.id}] non-Latin character leak in passage`);
    }

    for (const sub of parsed.questions) {
      validateAtomic(r.id, r.section, r.question_type, sub, r.question_type, true);
    }
  } else {
    const passage = str(parsed.passage || parsed.reading_passage || parsed.passage_text);
    if (r.section === 'reading' && passage && passage.length < 100 && !PASSAGE_IS_QUESTION.has(r.question_type)) {
      issues.push(`[#${r.id}] reading passage too short (${passage.length} chars)`);
    }
    if (NON_LATIN.test(passage)) {
      issues.push(`[#${r.id}] non-Latin character leak in passage`);
    }
    validateAtomic(r.id, r.section, r.question_type, parsed, r.question_type, false);
  }
}

if (issues.length === 0) {
  console.log('All sampled questions passed basic checks.\n');
} else {
  console.log(`Found ${issues.length} issues:\n`);
  issues.forEach((i) => console.log(`  ${i}`));
  console.log();
}

process.exit(issues.length > 0 ? 1 : 0);
