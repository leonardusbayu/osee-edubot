import { Hono } from 'hono';
import type { Env } from '../types';
import { getAuthUser } from '../services/auth';

export const aiGenRoutes = new Hono<{ Bindings: Env }>();

// Teacher: AI-generate questions from a passage
aiGenRoutes.post('/questions', async (c) => {
  const user = await getAuthUser(c.req.raw, c.env);
  if (!user || (user.role !== 'teacher' && user.role !== 'admin')) {
    return c.json({ error: 'Teacher access required' }, 403);
  }

  if (!c.env.OPENAI_API_KEY) return c.json({ error: 'AI not configured' }, 500);

  const { passage, test_type, section, question_type, count } = await c.req.json();
  if (!passage || passage.length < 50) return c.json({ error: 'Passage too short (min 50 chars)' }, 400);

  const numQuestions = Math.min(count || 5, 10);
  const testLabel = test_type === 'IELTS' ? 'IELTS Academic' : 'TOEFL iBT';

  const prompt = `Generate ${numQuestions} ${testLabel} ${section || 'reading'} questions from this passage.

Passage:
"${passage.substring(0, 2000)}"

Question type: ${question_type || 'multiple_choice'}

${question_type === 'true_false_not_given' ? `
For each question, provide:
- statement (a claim about the passage)
- answer: TRUE, FALSE, or NOT GIVEN
- explanation: why this answer is correct
` : `
For each question, provide:
- question text
- 4 options (A, B, C, D)
- correct answer letter
- explanation
`}

Respond in JSON array format:
[
  {
    "question_text": "...",
    "options": [{"key": "A", "text": "..."}, ...],
    "answers": ["A"],
    "explanation": "..."
  }
]`;

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${c.env.OPENAI_API_KEY}` },
      body: JSON.stringify({
        model: 'gpt-4o',
        max_tokens: 2000,
        temperature: 0.7,
        messages: [
          { role: 'system', content: 'Generate IELTS/TOEFL practice questions. Always respond with valid JSON array only.' },
          { role: 'user', content: prompt },
        ],
      }),
    });

    const data: any = await response.json();
    const questions = JSON.parse(data.choices?.[0]?.message?.content || '[]');

    // Save to database
    const content = {
      type: section === 'listening' ? 'grouped_listening' : section === 'speaking' ? 'grouped_speaking' : section === 'writing' ? 'grouped_writing' : 'grouped_reading',
      group_name: `AI Generated — ${new Date().toISOString().split('T')[0]}`,
      passage: passage.substring(0, 3000),
      direction: 'Read the passage and answer the questions.',
      questions: questions.map((q: any, i: number) => ({ index: i, ...q })),
      question_count: questions.length,
    };

    await c.env.DB.prepare(
      "INSERT INTO test_contents (test_type, section, question_type, title, content, media_url, difficulty, topic, source, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    ).bind(
      test_type || 'TOEFL_IBT', section || 'reading', question_type || 'multiple_choice',
      `AI Generated ${questions.length}Q`, JSON.stringify(content), '', '3', 'AI Generated', 'ai_generated', 'draft'
    ).run();

    // Log cost
    try {
      await c.env.DB.prepare('INSERT INTO api_usage (service, endpoint, tokens_used, cost_usd, user_id) VALUES (?, ?, ?, ?, ?)')
        .bind('openai', 'ai-generate', 2000, 0.0003, user.id).run();
    } catch {}

    return c.json({ generated: questions.length, questions, status: 'draft (needs teacher approval)' });
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});
