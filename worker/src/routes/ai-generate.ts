import { Hono } from 'hono';
import type { Env } from '../types';
import { getAuthUser } from '../services/auth';

export const aiGenRoutes = new Hono<{ Bindings: Env }>();

// Auth helper: accept JWT (teacher/admin) OR API key
async function requireTeacherOrApiKey(c: any): Promise<any> {
  // Check API key first
  const apiKey = c.req.header('X-API-Key') || c.req.header('x-admin-secret');
  if (apiKey && (apiKey === c.env.ADMIN_API_KEY || apiKey === c.env.ADMIN_SECRET)) {
    return { id: 0, role: 'admin', name: 'API Admin' };
  }
  // Fall back to JWT auth
  const user = await getAuthUser(c.req.raw, c.env);
  if (!user || (user.role !== 'teacher' && user.role !== 'admin')) {
    return null;
  }
  return user;
}

// Teacher: AI-generate questions from a passage
aiGenRoutes.post('/questions', async (c) => {
  const user = await requireTeacherOrApiKey(c);
  if (!user) {
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
    return c.json({ error: 'AI generation failed' }, 500);
  }
});

// Teacher: AI-generate standalone questions for a test type
aiGenRoutes.post('/batch-generate', async (c) => {
  const user = await requireTeacherOrApiKey(c);
  if (!user) {
    return c.json({ error: 'Teacher access required' }, 403);
  }

  if (!c.env.OPENAI_API_KEY) return c.json({ error: 'AI not configured' }, 500);

  const { test_type, section, question_type, count, difficulty } = await c.req.json();
  if (!test_type || !section) return c.json({ error: 'test_type and section required' }, 400);

  const numQuestions = Math.min(count || 5, 10);
  const diffLevel = difficulty || 3;

  // Build test-specific prompt
  const prompts: Record<string, string> = {
    'TOEIC/listening/photographs': `Generate ${numQuestions} TOEIC Part 1 (Photographs) questions. Each has a scene description and 4 audio statement options. Format: grouped_listening with passage_script (scene description) and questions (each with 4 options A-D and correct answer).`,
    'TOEIC/listening/question_response': `Generate ${numQuestions} TOEIC Part 2 (Question-Response) questions. Each has a spoken question/statement and 3 response options. Format: grouped_listening with questions.`,
    'TOEIC/listening/conversations': `Generate ${numQuestions} TOEIC Part 3 (Conversations) questions. Create a short dialogue between 2 speakers about a work situation, then 3 comprehension questions with 4 options each.`,
    'TOEIC/listening/talks': `Generate ${numQuestions} TOEIC Part 4 (Talks) questions. Create a short monologue (announcement/voicemail/news), then 3 questions with 4 options each.`,
    'TOEIC/reading/incomplete_sentences': `Generate ${numQuestions} TOEIC Part 5 (Incomplete Sentences) questions. Each has a sentence with a blank and 4 options testing grammar or vocabulary. Difficulty: ${diffLevel}/5.`,
    'TOEIC/reading/text_completion': `Generate ${numQuestions} TOEIC Part 6 (Text Completion) questions. Create a short text (email/memo/notice) with 3-4 blanks, each with 4 options.`,
    'TOEIC/reading/reading_comprehension': `Generate ${numQuestions} TOEIC Part 7 (Reading Comprehension) questions. Create a passage (email/ad/article) and 3-4 comprehension questions with 4 options each.`,
  };

  const testKey = `${test_type}/${section}/${question_type || 'default'}`;
  const specificPrompt = prompts[testKey];

  const systemMsg = `You are an expert English test question writer. Generate practice questions for standardized English tests.
Always respond with valid JSON only. Use this exact format:
{
  "type": "${section === 'listening' ? 'grouped_listening' : section === 'reading' ? 'grouped_reading' : 'grouped_writing'}",
  "group_name": "AI Generated ${test_type} ${section}",
  "direction": "...",
  "passage": "...",
  "passage_script": "...",
  "questions": [
    {
      "index": 0,
      "question_text": "...",
      "options": [{"key": "A", "text": "..."}, {"key": "B", "text": "..."}, {"key": "C", "text": "..."}, {"key": "D", "text": "..."}],
      "answers": ["A"],
      "explanation": "..."
    }
  ]
}
For listening questions, include passage_script (what is spoken aloud).
For reading questions, include passage (the reading text).
Make questions realistic, professional, and at difficulty level ${diffLevel}/5.`;

  const userPrompt = specificPrompt ||
    `Generate ${numQuestions} ${test_type} ${section} questions (type: ${question_type || 'multiple_choice'}). Difficulty: ${diffLevel}/5. Include explanations.`;

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${c.env.OPENAI_API_KEY}` },
      body: JSON.stringify({
        model: 'gpt-4o',
        max_tokens: 4000,
        temperature: 0.8,
        messages: [
          { role: 'system', content: systemMsg },
          { role: 'user', content: userPrompt },
        ],
      }),
    });

    const data: any = await response.json();
    const rawContent = data.choices?.[0]?.message?.content || '{}';

    // Parse JSON — handle markdown code blocks
    const jsonStr = rawContent.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const content = JSON.parse(jsonStr);

    // Determine question_type for DB
    const dbQuestionType = question_type ||
      (content.type === 'grouped_listening' ? (
        section === 'listening' && test_type === 'TOEIC' ? 'conversations' : 'listen_conversation'
      ) : content.type === 'grouped_reading' ? 'reading_comprehension' : 'multiple_choice');

    const questionCount = content.questions?.length || 0;

    // Save to DB as draft
    const createdBy = user.id > 0 ? user.id : null;
    await c.env.DB.prepare(
      `INSERT INTO test_contents (test_type, section, question_type, title, content, media_url, difficulty, topic, source, status, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'ai_generated', 'draft', ?)`
    ).bind(
      test_type, section, dbQuestionType,
      `AI ${test_type} ${section} ${questionCount}Q — ${new Date().toISOString().split('T')[0]}`,
      JSON.stringify(content),
      null,
      diffLevel,
      `AI Generated ${test_type} ${section}`,
      createdBy,
    ).run();

    // Log API cost
    const tokens = data.usage?.total_tokens || 4000;
    const cost = (tokens / 1000) * 0.005; // gpt-4o pricing estimate
    try {
      await c.env.DB.prepare(
        'INSERT INTO api_usage (service, endpoint, tokens_used, cost_usd, user_id) VALUES (?, ?, ?, ?, ?)'
      ).bind('openai', 'batch-generate', tokens, cost, createdBy).run();
    } catch {}

    return c.json({
      generated: questionCount,
      test_type,
      section,
      question_type: dbQuestionType,
      difficulty: diffLevel,
      status: 'draft',
      content,
      cost_usd: cost.toFixed(4),
    });
  } catch (e: any) {
    console.error('Batch generate error:', e);
    return c.json({ error: 'AI generation failed', debug: e.message }, 500);
  }
});

// Get content gap analysis — shows which test types and sections need more questions
aiGenRoutes.get('/content-gaps', async (c) => {
  const user = await requireTeacherOrApiKey(c);
  if (!user) {
    return c.json({ error: 'Teacher access required' }, 403);
  }

  const counts = await c.env.DB.prepare(`
    SELECT test_type, section, question_type, COUNT(*) as count
    FROM test_contents WHERE status = 'published'
    GROUP BY test_type, section, question_type
    ORDER BY test_type, section, count ASC
  `).all();

  // Define minimum targets
  const targets: Record<string, number> = {
    'TOEFL_IBT/reading': 200,
    'TOEFL_IBT/listening': 200,
    'TOEFL_IBT/speaking': 50,
    'TOEFL_IBT/writing': 50,
    'IELTS/reading': 150,
    'IELTS/listening': 150,
    'IELTS/writing': 50,
    'IELTS/speaking': 50,
    'TOEFL_ITP/listening': 100,
    'TOEFL_ITP/structure': 100,
    'TOEFL_ITP/reading': 100,
    'TOEIC/listening': 100,
    'TOEIC/reading': 100,
  };

  // Aggregate by test_type/section
  const sectionCounts: Record<string, number> = {};
  for (const row of counts.results as any[]) {
    const key = `${row.test_type}/${row.section}`;
    sectionCounts[key] = (sectionCounts[key] || 0) + row.count;
  }

  const gaps: any[] = [];
  for (const [key, target] of Object.entries(targets)) {
    const current = sectionCounts[key] || 0;
    if (current < target) {
      gaps.push({
        test_type: key.split('/')[0],
        section: key.split('/')[1],
        current,
        target,
        deficit: target - current,
        priority: current < target * 0.3 ? 'high' : current < target * 0.6 ? 'medium' : 'low',
      });
    }
  }

  gaps.sort((a, b) => b.deficit - a.deficit);

  return c.json({
    total_published: Object.values(sectionCounts).reduce((a, b) => a + b, 0),
    by_section: counts.results,
    gaps,
    recommendations: gaps.slice(0, 5).map(g =>
      `${g.test_type} ${g.section}: needs ${g.deficit} more questions (currently ${g.current}/${g.target})`
    ),
  });
});
