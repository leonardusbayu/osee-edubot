#!/usr/bin/env npx tsx
/**
 * Explanation Enrichment Script
 * 
 * For each question in test_contents with an empty explanation,
 * generate one using GPT-4 and backfill the database.
 * 
 * Usage: npx tsx scripts/enrich-explanations.ts
 * 
 * Prerequisites:
 *   cd worker && npx wrangler d1 execute edubot-db --remote after testing
 */

const D1_DATABASE_ID = 'd501b671-128e-4a45-9d90-74b22e6691ce';

async function getOpenAIKey(): Promise<string> {
  // In local dev, reads from .env
  // In CI/CD, set OPENAI_API_KEY env var
  const key = process.env.OPENAI_API_KEY;
  if (!key) {
    // Try to read from worker/.env
    try {
      const fs = await import('fs');
      const envFile = fs.readFileSync('./worker/.env', 'utf-8');
      const match = envFile.match(/OPENAI_API_KEY=(.+)/);
      if (match) return match[1].trim();
    } catch {}
    throw new Error('OPENAI_API_KEY not found in environment');
  }
  return key;
}

async function queryD1(sql: string, params: any[] = []): Promise<any[]> {
  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${process.env.CLOUDFLARE_ACCOUNT_ID}/d1/database/${D1_DATABASE_ID}/query`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.CLOUDFLARE_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ sql, params }),
    }
  );
  const data = await response.json();
  if (!data.success) throw new Error(`D1 error: ${JSON.stringify(data.errors)}`);
  return data.result?.[0]?.results || [];
}

async function updateQuestionExplanation(id: number, explanation: string): Promise<void> {
  // Parse existing content, update explanation, re-stringify
  const existing = await queryD1(
    'SELECT content FROM test_contents WHERE id = ?',
    [id]
  );
  if (!existing.length) return;

  let content: any = {};
  try { content = JSON.parse(existing[0].content || '{}'); } catch {}

  content.explanation = explanation;

  await queryD1(
    'UPDATE test_contents SET content = ? WHERE id = ?',
    [JSON.stringify(content), id]
  );
}

async function generateExplanation(question: any, apiKey: string): Promise<string> {
  const questionText = question.question_text || question.passage_text || question.sentence || '';
  const section = question.section || 'reading';
  const questionType = question.question_type || 'multiple_choice';

  const prompt = `You are a TOEFL/IELTS expert teacher. Generate a clear, helpful explanation for this ${section} question.

Question type: ${questionType}

${questionText ? `Question: ${questionText.substring(0, 500)}` : ''}
${question.options?.length ? `Options:\n${question.options.map((o: any) => `${o.key}. ${o.text}`).join('\n')}` : ''}
${question.correct_answer ? `Correct answer: ${question.correct_answer}` : ''}
${question.passage ? `Passage excerpt: ${question.passage.substring(0, 300)}...` : ''}

Write the explanation in Indonesian (Bahasa Indonesia), as if explaining to an intermediate English learner. Be specific about WHY the correct answer is right and why the other options are wrong. Keep it under 150 words. Format: just the explanation text, no headers or labels.`;

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      max_tokens: 300,
      temperature: 0.3,
      messages: [
        {
          role: 'system',
          content: 'You are a helpful TOEFL/IELTS teacher. Always respond with only the explanation text, nothing else.',
        },
        { role: 'user', content: prompt },
      ],
    }),
  });

  const data: any = await response.json();
  if (!data.choices?.[0]?.message?.content) {
    throw new Error(`OpenAI API error: ${JSON.stringify(data)}`);
  }
  return data.choices[0].message.content.trim();
}

async function main() {
  console.log('🚀 Starting explanation enrichment...\n');

  const apiKey = await getOpenAIKey();
  console.log('✓ OpenAI API key loaded');

  // Find questions with empty explanations
  const questions = await queryD1(`
    SELECT id, test_type, section, question_type, content
    FROM test_contents
    WHERE status = 'published'
    LIMIT 100
  `);

  console.log(`Found ${questions.length} published questions to check`);

  let enriched = 0;
  let skipped = 0;
  let errors = 0;

  for (const q of questions) {
    let content: any = {};
    try { content = JSON.parse(q.content || '{}'); } catch {}

    const hasExplanation = content.explanation &&
      content.explanation.length > 10 &&
      !content.explanation.includes('explanation') &&
      content.explanation.trim() !== '';

    if (hasExplanation) {
      skipped++;
      continue;
    }

    // Check if grouped questions have explanations
    if (content.questions?.length) {
      const allHaveExplanations = content.questions.every((sq: any) =>
        sq.explanation && sq.explanation.length > 10
      );
      if (allHaveExplanations) {
        skipped++;
        continue;
      }
    }

    console.log(`\nProcessing Q${q.id} (${q.test_type}/${q.section}/${q.question_type})...`);

    try {
      const explanation = await generateExplanation(content, apiKey);
      await updateQuestionExplanation(q.id, explanation);
      enriched++;
      console.log(`  ✅ Explanation generated: "${explanation.substring(0, 80)}..."`);
    } catch (e: any) {
      errors++;
      console.error(`  ❌ Error: ${e.message}`);
    }

    // Rate limit: 1 request per second max
    await new Promise(r => setTimeout(r, 1100));
  }

  console.log(`\n📊 Results:`);
  console.log(`   Enriched: ${enriched}`);
  console.log(`   Skipped (already have explanations): ${skipped}`);
  console.log(`   Errors: ${errors}`);

  if (enriched > 0) {
    console.log(`\n✅ Successfully enriched ${enriched} questions.`);
    console.log(`   Re-run this script to continue with remaining questions.`);
  } else if (errors > 0) {
    console.log(`\n⚠️  No questions enriched but ${errors} errors occurred. Check API key and retry.`);
  } else {
    console.log(`\n🎉 All questions already have explanations!`);
  }
}

main().catch(e => {
  console.error('Fatal error:', e);
  process.exit(1);
});
