import type { Env, User } from '../types';

const TUTOR_SYSTEM_PROMPT = `PERAN: Tutor {target_test} dari OSEE.
DIRI: "Aku". SISWA: "kamu". NAMA SISWA: {name}. LEVEL: {proficiency_level}. TARGET: {target_test}.

WAJIB IKUTI FORMAT INI. TIDAK ADA PENGECUALIAN:

1. MAKSIMAL 8 BARIS per pesan. Lebih = GAGAL.
2. JANGAN pakai heading (#), bold (**), atau markdown apapun. Plain text saja.
3. JANGAN buka dengan "Oke, [nama]! Mari kita..." — langsung ke inti.
4. KASIH 1 SOAL SAJA per pesan. Tunggu jawaban dulu.
5. Tulis kayak chat WhatsApp, bukan esai.

CONTOH PESAN YANG BENAR:

"Di Bahasa kita: Dia pergi, Mereka pergi — verb sama.

English beda. Verb ikut subject:
She goes (pakai S)
They go (tanpa S)

Coba: The cat (run/runs) fast.
Mana yang bener?"

CONTOH PESAN YANG SALAH (JANGAN DITIRU):

"Oke, L! Mari kita bahas Subject-Verb Agreement. SVA adalah aturan dimana subjek dan kata kerja harus cocok..."

ALUR MENGAJAR:
Pesan 1: Perbandingan Bahasa vs English (2 baris) + 3 contoh + 1 soal
Pesan 2 (setelah siswa jawab): Feedback singkat + soal berikutnya (lebih susah)
Pesan 3: Feedback + soal lebih susah lagi
...dst sampai 5 soal

KOREKSI:
Benar: "Bener! [kenapa 1 baris]. Lanjut yang lebih tricky..."
Salah: "Belum tepat. Jawabannya [X] karena [1 baris]. Coba lagi: [soal baru]"

MOTIVASI (sisipkan 1 per 3 pesan):
"Tanpa latihan hari ini, otak kamu lupa 20% materi kemarin"
"3 bener berturut-turut! Otakmu mulai nangkep polanya"

KELEMAHAN ORANG INDONESIA — selalu kaitkan:
Articles: Bahasa nggak punya a/an/the
S-V: Dia pergi = Mereka pergi, tapi English beda
Tenses: Bahasa pakai sudah/sedang/akan, English ubah verb
Prepositions: di = at/on/in, English punya 3

INFO: osee.co.id | WA +62 811-2647-784`;


const ESSAY_SCORING_PROMPT = `You are an expert English proficiency test scorer. Score the following essay.

Test Type: {test_type}
Task Type: {task_type}
Prompt: {prompt}
Criteria: {criteria}
Scale: {scale}

Essay:
---
{essay}
---

Respond in JSON:
{
  "overall_score": <number>,
  "criteria_scores": {"<criterion>": <number>},
  "feedback": {
    "strengths": ["..."],
    "weaknesses": ["..."],
    "suggestions": ["..."]
  }
}`;

// --- OpenAI Chat Completions ---

async function openaiChat(
  apiKey: string,
  model: string,
  systemPrompt: string,
  messages: { role: string; content: string }[],
  maxTokens: number = 400,
): Promise<string> {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages,
      ],
    }),
  });

  const data: any = await response.json();
  return data.choices?.[0]?.message?.content || 'Sorry, I could not generate a response.';
}

export async function getTutorResponse(
  env: Env,
  user: User,
  message: string,
): Promise<string> {
  if (!env.OPENAI_API_KEY) {
    return 'AI tutoring is not configured. Set OPENAI_API_KEY.';
  }

  // Load recent conversation
  const history = await env.DB.prepare(
    'SELECT role, content FROM conversation_messages WHERE user_id = ? ORDER BY created_at DESC LIMIT 10'
  ).bind(user.id).all();

  const messages: { role: string; content: string }[] = [];
  if (history.results) {
    for (const msg of [...history.results].reverse()) {
      messages.push({ role: msg.role as string, content: msg.content as string });
    }
  }
  messages.push({ role: 'user', content: message });

  const systemPrompt = TUTOR_SYSTEM_PROMPT
    .replace('{name}', user.name)
    .replace('{target_test}', user.target_test || 'Not specified')
    .replace('{proficiency_level}', user.proficiency_level || 'Unknown');

  // gpt-4o-mini for simple queries (~$0.15/1M tokens), gpt-4o for complex (~$2.50/1M tokens)
  const simpleKeywords = ['define', 'meaning of', 'what does', 'translate', 'synonym'];
  const model = simpleKeywords.some((kw) => message.toLowerCase().includes(kw))
    ? 'gpt-4o-mini'
    : 'gpt-4o-mini'; // Use mini for everything to keep costs low; switch to gpt-4o for scoring

  try {
    const text = await openaiChat(env.OPENAI_API_KEY, model, systemPrompt, messages);

    // Save conversation
    await env.DB.prepare(
      'INSERT INTO conversation_messages (user_id, role, content) VALUES (?, ?, ?)'
    ).bind(user.id, 'user', message).run();
    await env.DB.prepare(
      'INSERT INTO conversation_messages (user_id, role, content) VALUES (?, ?, ?)'
    ).bind(user.id, 'assistant', text).run();

    // Log API usage for cost tracking
    try {
      const tokens = Math.ceil((message.length + text.length) / 4); // rough estimate
      const cost = model === 'gpt-4o-mini' ? tokens * 0.00000015 : tokens * 0.0000025;
      await env.DB.prepare(
        'INSERT INTO api_usage (service, endpoint, tokens_used, cost_usd, user_id) VALUES (?, ?, ?, ?, ?)'
      ).bind('openai', model, tokens, cost, user.id).run();
    } catch {}

    return text;
  } catch (e: any) {
    console.error('OpenAI API error:', e);
    return 'Maaf, ada masalah. Coba lagi ya.';
  }
}

export async function scoreEssay(
  env: Env,
  essay: string,
  testType: string,
  taskType: string,
  prompt: string,
  criteria: string[],
  scale: string = '1-6',
): Promise<any> {
  if (!env.OPENAI_API_KEY) return { error: 'AI not configured', overall_score: 0 };

  const scoringPrompt = ESSAY_SCORING_PROMPT
    .replace('{test_type}', testType)
    .replace('{task_type}', taskType)
    .replace('{prompt}', prompt)
    .replace('{criteria}', criteria.join(', '))
    .replace('{scale}', scale)
    .replace('{essay}', essay);

  try {
    // Use gpt-4o for scoring accuracy
    const text = await openaiChat(
      env.OPENAI_API_KEY,
      'gpt-4o',
      'You are an expert English test scorer. Always respond with valid JSON only.',
      [{ role: 'user', content: scoringPrompt }],
      2048,
    );
    return JSON.parse(text);
  } catch (e: any) {
    return { error: e.message, overall_score: 0 };
  }
}

export async function transcribeAudio(env: Env, audioBytes: ArrayBuffer): Promise<string | null> {
  if (!env.OPENAI_API_KEY) return null;

  try {
    const formData = new FormData();
    formData.append('file', new Blob([audioBytes], { type: 'audio/webm' }), 'recording.webm');
    formData.append('model', 'whisper-1');
    formData.append('response_format', 'text');

    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.OPENAI_API_KEY}` },
      body: formData,
    });

    return await response.text();
  } catch (e) {
    console.error('Whisper error:', e);
    return null;
  }
}
