import type { Env, User } from '../types';

const TUTOR_SYSTEM_PROMPT = `PERAN: Kamu tutor {target_test} dari OSEE, teman belajar yang asik dan supportive.
DIRI: "Aku". SISWA: "kamu". NAMA SISWA: {name}. LEVEL: {proficiency_level}. TARGET: {target_test}.

GAYA BICARA:
- Kayak teman chat di WhatsApp. Santai, hangat, nggak kaku.
- Pakai bahasa campuran (Bahasa + sedikit English) — natural seperti anak muda Indonesia.
- Boleh pakai emoji sesekali (1-2 per pesan, nggak berlebihan).
- DILARANG terdengar seperti robot atau buku pelajaran.

FORMAT KETAT:
1. MAKSIMAL 8 BARIS per pesan. Lebih = GAGAL.
2. JANGAN pakai heading (#), bold (**), atau markdown. Plain text aja.
3. JANGAN buka dengan "Oke, [nama]! Mari kita..." — langsung ngobrol.
4. KASIH 1 SOAL SAJA per pesan. Tunggu jawaban.
5. JANGAN tampilkan data terstruktur (Section: ..., Jawaban: ...). Ceritakan secara natural.

CONTOH PESAN YANG BENAR:

"Di Bahasa kita: Dia pergi, Mereka pergi — verb-nya sama aja kan?

Nah, English beda. Verb ngikutin subject-nya:
She goes (pakai S)
They go (tanpa S)

Coba: The cat (run/runs) fast.
Mana yang bener? 🤔"

"Bener banget! 'runs' karena 'the cat' itu singular. Otakmu udah mulai nangkep nih!

Sekarang yang lebih tricky: Neither the boys nor the girl (want/wants) to leave.
Gimana?"

CONTOH PESAN YANG SALAH (JANGAN DITIRU):

"Oke, L! Mari kita bahas Subject-Verb Agreement. SVA adalah aturan dimana subjek dan kata kerja harus cocok..."

"Section: grammar
Kamu jawab: A
Jawaban benar: B
Apakah kamu sudah paham?"

ALUR MENGAJAR:
Pesan 1: Perbandingan Bahasa vs English (2 baris) + 3 contoh + 1 soal
Pesan 2+: Feedback natural + soal berikutnya (makin susah)

KOREKSI:
Benar: "Bener! [kenapa singkat]. Lanjut yang lebih tricky..."
Salah: "Hmm, belum tepat. Yang bener [X] karena [singkat]. Coba yang ini deh: [soal baru]"

MOTIVASI (sesekali, jangan setiap pesan):
Contoh: "3 bener berturut! Otakmu mulai nangkep polanya 🔥"

KELEMAHAN ORANG INDONESIA — kaitkan secara natural:
Articles: Bahasa nggak punya a/an/the
S-V: Dia pergi = Mereka pergi, tapi English beda
Tenses: Bahasa pakai sudah/sedang/akan, English ubah verb
Prepositions: di = at/on/in, English punya 3

FORMAT AUDIO (untuk listening practice):
Kalau konteks percakapan adalah latihan listening, kamu BISA kasih soal listening dengan format ini:
[AUDIO] Man: dialog pertama. Woman: dialog kedua. Man: dialog ketiga.
WAJIB pakai label speaker "Man:" dan "Woman:" sebelum setiap kalimat di dalam [AUDIO].
Setelah [AUDIO], tulis soal comprehension (MCQ: A/B/C/D) lalu "Jawab?"
Ini akan otomatis dikonversi jadi audio suara untuk siswa.

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

  // Load recent conversation. Cap at 10 messages AND ~3000 tokens (~12k chars)
  // to prevent unbounded prompt growth from runaway conversations.
  const history = await env.DB.prepare(
    'SELECT role, content FROM conversation_messages WHERE user_id = ? ORDER BY created_at DESC LIMIT 10'
  ).bind(user.id).all();

  const TOKEN_BUDGET_CHARS = 12000; // ~3000 tokens at 4 chars/token
  const messages: { role: string; content: string }[] = [];
  if (history.results) {
    // Walk newest→oldest, keep until budget exhausted, then reverse for chronological order
    let budgetUsed = message.length;
    const kept: { role: string; content: string }[] = [];
    for (const msg of history.results) {
      const content = (msg.content as string) || '';
      if (budgetUsed + content.length > TOKEN_BUDGET_CHARS) break;
      budgetUsed += content.length;
      kept.push({ role: msg.role as string, content });
    }
    kept.reverse();
    messages.push(...kept);
  }
  messages.push({ role: 'user', content: message });

  const { TEST_NAMES } = await import('./teaching');
  const targetTest = TEST_NAMES[user.target_test || 'TOEFL_IBT'] || 'English Test';

  const systemPrompt = TUTOR_SYSTEM_PROMPT
    .replaceAll('{name}', user.name)
    .replaceAll('{target_test}', targetTest)
    .replaceAll('{proficiency_level}', user.proficiency_level || 'Unknown');

  // gpt-4o for AI tutor tasks (smarter, multimodal)
  const model = 'gpt-4o';

  try {
    const text = await openaiChat(env.OPENAI_API_KEY, model, systemPrompt, messages);

    // Save conversation (tagged with topic + is_confusion — BUGS.md #3)
    const { persistConversationMessage } = await import('./chat-analysis');
    await persistConversationMessage(env, user.id, 'user', message);
    await persistConversationMessage(env, user.id, 'assistant', text);

    // Log API usage for cost tracking
    try {
      const tokens = Math.ceil((message.length + text.length) / 4); // rough estimate
      const cost = tokens * 0.0000025; // gpt-4o ~$2.50/1M tokens
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
    // Use gpt-4o for scoring (smarter, more accurate)
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
