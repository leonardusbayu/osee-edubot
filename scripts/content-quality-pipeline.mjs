// Content quality pipeline for EduBot.
//
// Fills explanation gaps + enriches skill_tags for test_contents rows
// using GPT-4o-mini. Runs in batches via the OpenAI API. Writes updates
// to a local SQL file that the operator can review + apply with:
//   npx wrangler d1 execute edubot-db --remote --file=./scripts/content-quality-updates.sql
//
// Usage:
//   export OPENAI_API_KEY=sk-...
//   node scripts/content-quality-pipeline.mjs [--limit=10] [--dry-run]
//
// Default limit is 10 to avoid hammering the OpenAI API. The script
// pauses 500ms between GPT calls to stay under the 5 req/s rate limit
// on the standard plan.

import { execSync } from 'node:child_process';
import fs from 'node:fs';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
if (!OPENAI_API_KEY) {
  console.error('Missing OPENAI_API_KEY env var');
  process.exit(1);
}

const args = process.argv.slice(2);
const limit = parseInt(args.find((a) => a.startsWith('--limit='))?.split('=')[1] || '10');
const dryRun = args.includes('--dry-run');

console.log(`Content quality pipeline -- limit=${limit} dryRun=${dryRun}`);

function fetchRows() {
  const cmd = `npx wrangler d1 execute edubot-db --remote --command "SELECT id, test_type, section, question_type, content, skill_tags FROM test_contents WHERE status='published' AND (content NOT LIKE '%\\\\\\"explanation\\\\\\"%' OR skill_tags IS NULL OR skill_tags = '[]' OR skill_tags = '') ORDER BY id LIMIT ${limit}" --json`;
  const out = execSync(cmd, {
    cwd: 'D:\\\\claude telegram bot\\\\worker',
    env: { ...process.env },
    encoding: 'utf8',
    maxBuffer: 100 * 1024 * 1024,
  });
  const jsonStart = out.indexOf('[');
  if (jsonStart < 0) throw new Error('No JSON found in wrangler output');
  const j = JSON.parse(out.substring(jsonStart));
  return (Array.isArray(j) ? j[0].results : j.results) || [];
}

async function enrichRow(row) {
  let content;
  try { content = JSON.parse(row.content); } catch { return null; }

  let questionText = '';
  let options = [];
  let correctAnswer = '';

  if (content.question_text && Array.isArray(content.options)) {
    questionText = String(content.question_text || '');
    options = content.options.map((o) => typeof o === 'string' ? o : (o?.text || ''));
    correctAnswer = String(content.answers || '');
    if (Array.isArray(content.answers) && content.answers[0]) correctAnswer = String(content.answers[0]);
  } else if (Array.isArray(content.questions) && content.questions[0]) {
    const q = content.questions[0];
    questionText = String(q.question_text || q.script || '');
    options = (q.options || []).map((o) => typeof o === 'string' ? o : (o?.text || ''));
    correctAnswer = String(q.answers || '');
    if (Array.isArray(q.answers) && q.answers[0]) correctAnswer = String(q.answers[0]);
  } else {
    return null;
  }

  if (!questionText || !correctAnswer || options.length < 2) return null;

  const prompt = `You are an exam prep content editor. Given a multiple-choice question, generate a concise explanation and assign skill tags.

Question: ${questionText.substring(0, 600)}
Options: ${options.join(' | ')}
Correct answer: ${correctAnswer}

Respond in JSON only:
{
  "explanation": "<2-3 sentences explaining why the correct answer is right and the common mistake for each wrong answer>",
  "skill_tags": ["<2-4 fine-grained skill tags, e.g. inference_causal, detail_numerical, main_idea_global, vocabulary_context, tone_attitude>"]
}

Skill tag vocabulary: inference_causal, inference_tone, inference_purpose, detail_specific, detail_numerical, main_idea_global, main_idea_local, vocabulary_context, vocabulary_word_form, organization_structure, rhetorical_purpose, sentence_insertion`;

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        max_tokens: 300,
        temperature: 0.3,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: 'You are an expert English test prep content editor. Respond with valid JSON only.' },
          { role: 'user', content: prompt },
        ],
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const raw = data.choices?.[0]?.message?.content || '';
    const parsed = JSON.parse(raw);
    return {
      explanation: String(parsed.explanation || '').substring(0, 800),
      skill_tags: Array.isArray(parsed.skill_tags) ? parsed.skill_tags.slice(0, 4) : [],
    };
  } catch (e) {
    console.error(`  GPT error for row ${row.id}: ${e?.message || e}`);
    return null;
  }
}

function escapeSqlString(s) {
  return String(s).replace(/'/g, "''").replace(/\\/g, '\\\\').replace(/\n/g, ' ');
}

async function main() {
  const rows = fetchRows();
  console.log(`Found ${rows.length} rows to process`);

  const updates = [];
  let processed = 0;
  let skipped = 0;

  for (const row of rows) {
    process.stdout.write(`[${processed + 1}/${rows.length}] id=${row.id} (${row.test_type}/${row.section}/${row.question_type}) ... `);

    const enrichment = await enrichRow(row);
    if (!enrichment || (!enrichment.explanation && enrichment.skill_tags.length === 0)) {
      console.log('SKIP (no enrichment)');
      skipped++;
      continue;
    }

    let content;
    try { content = JSON.parse(row.content); } catch { console.log('SKIP (bad JSON)'); skipped++; continue; }

    if (enrichment.explanation) {
      if (content.questions && Array.isArray(content.questions)) {
        for (const q of content.questions) {
          if (!q.explanation) q.explanation = enrichment.explanation;
        }
      } else {
        content.explanation = enrichment.explanation;
      }
    }

    if (enrichment.skill_tags.length > 0) {
      const newTags = enrichment.skill_tags;
      let existing = [];
      try { existing = JSON.parse(row.skill_tags || '[]'); } catch { /* fine */ }
      if (!Array.isArray(existing)) existing = [];
      const merged = Array.from(new Set([...existing, ...newTags])).slice(0, 6);
      content._merged_skill_tags = JSON.stringify(merged);
    }

    const newContent = JSON.stringify(content).replace(/'/g, "''");
    const setClauses = [`content = '${newContent}'`];
    if (enrichment.skill_tags.length > 0) {
      setClauses.push(`skill_tags = '${escapeSqlString(content._merged_skill_tags || '[]')}'`);
    }
    updates.push(`UPDATE test_contents SET ${setClauses.join(', ')} WHERE id = ${row.id};`);
    delete content._merged_skill_tags;

    console.log('OK');
    processed++;
    await new Promise((r) => setTimeout(r, 500));
  }

  const outPath = 'scripts/content-quality-updates.sql';
  const header = `-- Content quality pipeline output\n-- Generated by scripts/content-quality-pipeline.mjs\n-- Apply with: npx wrangler d1 execute edubot-db --remote --file=./scripts/content-quality-updates.sql\n-- Processed: ${processed} rows, Skipped: ${skipped} rows\n\n`;
  fs.writeFileSync(outPath, header + updates.join('\n') + '\n');

  if (dryRun) {
    console.log(`\nDRY RUN: would write ${updates.length} UPDATE statements to ${outPath}`);
    console.log('Run without --dry-run to actually write the file.');
  } else {
    console.log(`\nWrote ${updates.length} UPDATE statements to ${outPath}`);
    console.log('Apply with: npx wrangler d1 execute edubot-db --remote --file=./scripts/content-quality-updates.sql');
  }
}

main().catch((e) => {
  console.error('Fatal:', e);
  process.exit(1);
});
