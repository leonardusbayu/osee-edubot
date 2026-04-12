import { Hono } from 'hono';
import type { Env } from '../types';

export const writingRoutes = new Hono<{ Bindings: Env }>();

// Evaluate a writing submission — AI scoring with detailed feedback
writingRoutes.post('/evaluate', async (c) => {
  if (!c.env.OPENAI_API_KEY) return c.json({ error: 'AI not configured' }, 500);

  const { text, prompt, task_type, test_type } = await c.req.json();
  if (!text || text.length < 10) return c.json({ error: 'Text too short' }, 400);

  const isIELTS = test_type === 'IELTS';
  const maxBand = isIELTS ? 9 : 6;
  const bandScale = isIELTS ? '1-9' : '1-6';

  const criteria = isIELTS
    ? 'Task Achievement, Coherence & Cohesion, Lexical Resource, Grammatical Range & Accuracy'
    : 'Grammatical Accuracy, Practical Communication, Academic Content Quality';

  const minWords = task_type === 'task1' ? 150 : task_type === 'task2' ? 250 : task_type === 'write_email' ? 50 : 100;
  const wordCount = text.split(/\s+/).filter(Boolean).length;

  const scoringPrompt = `Score this ${isIELTS ? 'IELTS' : 'TOEFL iBT'} writing response on a ${bandScale} band scale.

Task type: ${task_type || 'essay'}
Prompt: "${(prompt || '').substring(0, 500)}"
Minimum words required: ${minWords}
Student word count: ${wordCount}

Student's writing:
---
${text.substring(0, 3000)}
---

Score on these criteria (each ${bandScale}):
${criteria}

Respond in JSON only:
{
  "overall_band": <number in 0.5 increments>,
  "criteria": {
    ${isIELTS ? '"task_achievement": <n>, "coherence_cohesion": <n>, "lexical_resource": <n>, "grammatical_accuracy": <n>' : '"grammatical_accuracy": <n>, "communication": <n>, "academic_quality": <n>'}
  },
  "word_count_ok": ${wordCount >= minWords},
  "feedback": "<3-4 sentences of specific feedback in Bahasa Indonesia. Use 'kamu'. Reference specific sentences from the student's writing. Be constructive.>",
  "corrections": [
    {"original": "<exact wrong phrase from student>", "corrected": "<correct version>", "rule": "<grammar rule in 1 line>"}
  ],
  "strengths": "<1 specific thing done well>",
  "improvement": "<1 specific thing to practice>",
  "suggested_phrases": ["<useful phrase they could have used>", "<another>"]
}`;

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${c.env.OPENAI_API_KEY}` },
      body: JSON.stringify({
        model: 'gpt-4o',
        max_tokens: 1000,
        temperature: 0.3,
        messages: [
          { role: 'system', content: 'You are an expert IELTS/TOEFL writing examiner. Always respond with valid JSON only.' },
          { role: 'user', content: scoringPrompt },
        ],
      }),
    });

    const data: any = await response.json();
    const result = JSON.parse(data.choices?.[0]?.message?.content || '{}');

    // Log cost
    try {
      await c.env.DB.prepare('INSERT INTO api_usage (service, endpoint, tokens_used, cost_usd) VALUES (?, ?, ?, ?)')
        .bind('openai', 'writing-eval', 1000, 0.00015).run();
    } catch {}

    return c.json({
      word_count: wordCount,
      min_words: minWords,
      word_count_ok: wordCount >= minWords,
      overall_band: result.overall_band || 1,
      criteria: result.criteria || {},
      feedback: result.feedback || 'Tidak bisa memberikan feedback.',
      corrections: result.corrections || [],
      strengths: result.strengths || '',
      improvement: result.improvement || '',
      suggested_phrases: result.suggested_phrases || [],
    });
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});
