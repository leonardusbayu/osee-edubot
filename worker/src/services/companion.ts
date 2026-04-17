/**
 * Companion Service — Proactive re-engagement for idle students.
 *
 * When students go idle the bot reaches out as a supportive friend,
 * listens to whatever they want to talk about, and gently bridges
 * them back to their study goals once they feel heard.
 *
 * Three tiers based on idle duration:
 *   Tier 1 (1 day idle)  — micro-challenge with a fun question
 *   Tier 2 (3 days idle) — empathetic check-in conversation
 *   Tier 3 (7+ days)     — personalised win-back with progress data
 */

import type { Env, User } from '../types';

// ─────────────────── Emotional Message Tracking ───────────────────

/**
 * Log that an emotional message was sent, for anti-spam deduplication.
 */
async function logEmotionalMessage(env: Env, userId: number, type: string, context?: string): Promise<void> {
  try {
    await env.DB.prepare(
      `INSERT INTO emotional_message_log (user_id, message_type, context) VALUES (?, ?, ?)`
    ).bind(userId, type, context || null).run();
  } catch (e) {
    console.error('Failed to log emotional message:', e);
  }
}

/**
 * Check if an emotional message of a given type was sent recently.
 */
async function wasEmotionalMessageSentRecently(
  env: Env, userId: number, type: string, withinMinutes: number, context?: string
): Promise<boolean> {
  try {
    let query = `SELECT id FROM emotional_message_log WHERE user_id = ? AND message_type = ? AND sent_at > datetime('now', '-${withinMinutes} minutes')`;
    const binds: any[] = [userId, type];
    if (context) {
      query += ` AND context = ?`;
      binds.push(context);
    }
    query += ` LIMIT 1`;
    const row = await env.DB.prepare(query).bind(...binds).first();
    return !!row;
  } catch (e) {
    console.error('Failed to check emotional message log:', e);
    return false; // On error, allow sending (better UX than silently suppressing)
  }
}

// ─────────────────── System Prompt ───────────────────

const COMPANION_SYSTEM_PROMPT = `PERAN: Kamu teman dekat yang hangat dan perhatian. Nama kamu Edu.
Kamu BUKAN tutor sekarang. Kamu teman yang genuinely peduli sama kehidupan mereka.

KONTEKS SISWA:
Nama: {name}
Target tes: {target_test}
Level: {level}
Progress: {progress_summary}
Idle: {idle_days} hari nggak aktif
Waktu sekarang: {current_time} WIB ({time_period})
Hari: {day_name}
Percakapan terakhir: {last_conversation_summary}

ATURAN UTAMA:
1. DENGARKAN DULU. Jangan langsung ajak belajar.
2. Bicara kayak teman dekat di WhatsApp. Santai, hangat, pakai bahasa gaul Indonesia.
3. Boleh campur Bahasa + English secukupnya — natural kayak anak muda.
4. MAKSIMAL 6 baris per pesan. Pendek, personal, warm.
5. Pakai emoji sesekali (1-2 per pesan, nggak lebay).
6. JANGAN pakai heading, bold, markdown. Plain text aja.
7. JANGAN menggurui atau bilang "kamu harus belajar".
8. Kalau mereka cerita masalah, VALIDASI perasaan mereka dulu.
9. JANGAN pura-pura jadi psikolog atau konselor profesional.
10. Tanya hal-hal kehidupan sehari-hari — ini yang bikin kamu beda dari bot biasa.

SENTUHAN HANGAT — KEHIDUPAN SEHARI-HARI:
Kamu peduli sama mereka sebagai manusia, bukan cuma siswa. Selipin hal-hal ini secara natural:
- "Udah makan belum?" / "Jangan lupa makan ya"
- "Lagi apa nih?" / "Hari ini ngapain aja?"
- "Weekend ada rencana seru?"
- "Gimana kuliahnya/sekolahnya/kerjaannya?"
- "Tidur cukup nggak belakangan?"
- Kalau mereka cerita tentang sesuatu sebelumnya, TANYAIN FOLLOW UP.
  Contoh: kalau dulu mereka bilang mau ujian, tanya "Gimana ujiannya kemarin?"

WAKTU-SADAR (time-aware):
- Pagi (05-11): "Pagi! Udah sarapan belum?" / energi positif, semangat pagi
- Siang (11-14): "Udah makan siang belum nih?" / santai, nggak berat
- Sore (14-18): "Gimana hari ini?" / reflektif, tanya kabar
- Malam (18-22): "Malam! Lagi santai ya?" / rileks, ngobrol ringan
- Larut malam (22-05): WAJIB ingatkan istirahat dengan lembut.
  "Eh, udah jam {current_time} lho. Jangan begadang ya 😴"
  "Aku seneng kamu mau ngobrol, tapi istirahat juga penting. Besok lanjut ya!"
  Kalau mereka tetap mau ngobrol, boleh lanjut 1-2 pesan tapi tetap ingatkan lagi.

HARI-SADAR (day-aware):
- Senin: "Semangat Senin! Biasanya hari pertama tuh berat ya 😅"
- Jumat: "TGIF! Ada rencana weekend?"
- Weekend: "Weekend nih! Lagi santai atau malah sibuk?"

ALUR PERCAKAPAN:
- Pesan 1-3: Dengarkan. Tanya kabar. Respon dengan empati. Tanya hal kehidupan sehari-hari.
- Pesan 4-5: Beri afirmasi atau dorongan ringan. Selipin "udah makan belum?" kalau belum nanya.
- Pesan 5+: HANYA kalau mood sudah membaik, bridge secara natural.
  Contoh bridge: "Btw, kemarin progress kamu udah {progress_summary} lho. Mau santai cobain 5 menit aja?"
  Kalau mereka nggak mau, HORMATI. Bilang "Oke, nggak apa-apa. Aku di sini kapan aja kamu mau ngobrol."

CONTOH PESAN YANG BENAR:
"Hei, lama nggak ngobrol! Gimana kabarnya? Udah makan belum? 😊"
"Wah, pasti capek banget ya. Wajar sih kalau butuh istirahat dulu. Jangan lupa minum air ya"
"TGIF! Weekend mau ngapain? Cerita dong"
"Eh, udah jam 11 malem lho. Nggak boleh begadang terus ya 😴 Besok kita lanjut!"
"Gimana ujiannya kemarin? Lancar nggak?"

CONTOH YANG SALAH (JANGAN DITIRU):
"Hei! Kamu udah 5 hari nggak belajar. Ayo belajar lagi!"
"Jangan menyerah! Kamu harus konsisten belajar setiap hari."
"Sebagai AI, saya menyarankan Anda untuk..."
"Menurut penelitian, belajar setiap hari dapat meningkatkan..."

SAFETY:
- Kalau mereka cerita serius (self-harm, depresi berat, krisis), JANGAN pura-pura bisa bantu.
  Bilang: "Aku dengerin kamu. Ini penting banget, dan aku saranin kamu ngobrol sama orang yang kamu percaya — keluarga, teman, atau konselor. Kamu nggak sendirian."
- JANGAN diagnosa atau kasih saran medis/psikologis.
- Kalau larut malam dan mereka terdengar sedih/lelah, prioritaskan suruh istirahat.

SENTIMENT_ANALYSIS:
Setelah setiap respons, tambahkan baris terakhir PERSIS format ini (ini akan di-parse, jangan ubah formatnya):
[SENTIMENT: positive|neutral|negative|distressed]
[BRIDGE_READY: yes|no]`;

// ─────────────────── Time Awareness (WIB = UTC+7) ───────────────────

function getWIBTime(): { hour: number; timeStr: string; period: string; dayName: string } {
  const now = new Date();
  const wib = new Date(now.getTime() + 7 * 60 * 60 * 1000);
  const hour = wib.getUTCHours();
  const min = wib.getUTCMinutes();
  const timeStr = `${String(hour).padStart(2, '0')}:${String(min).padStart(2, '0')}`;

  let period: string;
  if (hour >= 5 && hour < 11) period = 'pagi';
  else if (hour >= 11 && hour < 14) period = 'siang';
  else if (hour >= 14 && hour < 18) period = 'sore';
  else if (hour >= 18 && hour < 22) period = 'malam';
  else period = 'larut malam';

  const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
  const dayName = days[wib.getUTCDay()];

  return { hour, timeStr, period, dayName };
}

function isLateNight(): boolean {
  const { hour } = getWIBTime();
  return hour >= 22 || hour < 5;
}

// ─────────────────── Contextual Memory ───────────────────

async function getLastConversationSummary(env: Env, userId: number): Promise<string> {
  // Get the last completed companion conversation's messages
  const lastConv = await env.DB.prepare(
    `SELECT id, tier, sentiment FROM companion_conversations
     WHERE user_id = ? AND status IN ('ended', 'bridged', 'expired')
     ORDER BY ended_at DESC LIMIT 1`
  ).bind(userId).first() as any;

  if (!lastConv) return 'belum pernah ngobrol sebelumnya';

  // Get last few user messages from that conversation for context
  const msgs = await env.DB.prepare(
    `SELECT content FROM companion_messages
     WHERE conversation_id = ? AND role = 'user'
     ORDER BY created_at DESC LIMIT 3`
  ).bind(lastConv.id).all();

  if (!msgs.results?.length) return 'pernah ngobrol tapi nggak banyak cerita';

  const topics = (msgs.results as any[])
    .map(m => m.content)
    .filter(c => !c.startsWith('[mood:'))
    .join('; ')
    .substring(0, 200);

  const sentimentNote = lastConv.sentiment === 'negative'
    ? ' (terakhir kelihatan agak down)'
    : lastConv.sentiment === 'positive'
    ? ' (terakhir mood-nya bagus)'
    : '';

  return topics ? `Terakhir cerita: "${topics}"${sentimentNote}` : 'pernah ngobrol sebelumnya' + sentimentNote;
}

// ─────────────────── Types ───────────────────

interface CompanionConversation {
  id: number;
  user_id: number;
  status: string;
  tier: number;
  turn_count: number;
  sentiment: string | null;
  bridge_attempted: number;
  bridge_accepted: number | null;
  initiated_at: string;
  last_message_at: string;
}

interface CompanionResponse {
  text: string;
  sentiment: string;
  bridgeReady: boolean;
  conversationId: number;
}

// ─────────────────── Idle Detection ───────────────────

/**
 * Find students who have been idle and haven't been contacted recently.
 */
export async function findIdleStudents(env: Env): Promise<{
  tier1: { user_id: number; telegram_id: number; name: string; idle_days: number }[];
  tier2: { user_id: number; telegram_id: number; name: string; idle_days: number }[];
  tier3: { user_id: number; telegram_id: number; name: string; idle_days: number }[];
}> {
  // Get all students with their last activity timestamp
  // Last activity = most recent of: conversation_messages, attempt_answers, or diagnostic_sessions
  // NOTE: MAX(a, b, c) with multiple args is a scalar variadic (returns max of values),
  // not an aggregate, so HAVING is illegal. Wrap in subquery and filter via WHERE instead.
  const students = await env.DB.prepare(`
    SELECT * FROM (
      SELECT
        u.id as user_id,
        u.telegram_id,
        u.name,
        u.target_test,
        u.proficiency_level,
        CAST(
          julianday('now') - julianday(
            MAX(
              -- Fall back to u.created_at (not epoch), so users who never engaged
              -- show idle_days = account age, not 9000+ years.
              COALESCE((SELECT MAX(created_at) FROM conversation_messages WHERE user_id = u.id), u.created_at),
              COALESCE((SELECT MAX(submitted_at) FROM attempt_answers aa JOIN test_attempts ta ON aa.attempt_id = ta.id WHERE ta.user_id = u.id), u.created_at),
              COALESCE((SELECT MAX(created_at) FROM diagnostic_sessions WHERE user_id = u.id), u.created_at)
            )
          )
        AS INTEGER) as idle_days
      FROM users u
      WHERE u.onboarding_complete = 1
        AND u.role IN ('student', 'teacher', 'admin')
        -- Exclude users who already have an active companion conversation
        AND u.id NOT IN (
          SELECT user_id FROM companion_conversations
          WHERE status = 'active'
        )
        -- Exclude users who were contacted in the last 48 hours (don't spam)
        AND u.id NOT IN (
          SELECT user_id FROM companion_conversations
          WHERE initiated_at > datetime('now', '-48 hours')
        )
    )
    WHERE idle_days >= 1
    ORDER BY idle_days DESC
    LIMIT 50
  `).all();

  const tier1: any[] = [];
  const tier2: any[] = [];
  const tier3: any[] = [];

  for (const s of students.results as any[]) {
    const entry = {
      user_id: s.user_id,
      telegram_id: parseInt(String(s.telegram_id).replace('.0', '')),
      name: s.name || 'Teman',
      idle_days: s.idle_days,
    };

    if (s.idle_days >= 7) {
      tier3.push(entry);
    } else if (s.idle_days >= 3) {
      tier2.push(entry);
    } else if (s.idle_days >= 1) {
      tier1.push(entry);
    }
  }

  return { tier1, tier2, tier3 };
}

// ─────────────────── Outreach Messages ───────────────────

/**
 * Generate a Tier 1 gentle nudge — a fun micro-question, not a lecture.
 */
export async function generateTier1Nudge(env: Env, userId: number, name: string): Promise<string> {
  // Grab a question from their weakest skill area. Entire DB section is
  // best-effort — any failure (missing column, no data) falls through to
  // the warm greeting fallback below instead of surfacing as an outreach
  // error that drops the whole tier1 send.
  let weakSection = 'reading';
  try {
    const weakness = await env.DB.prepare(`
      SELECT section, AVG(CASE WHEN is_correct = 1 THEN 1.0 ELSE 0.0 END) as accuracy
      FROM attempt_answers aa
      JOIN test_attempts ta ON aa.attempt_id = ta.id
      WHERE ta.user_id = ? AND aa.is_correct IS NOT NULL
      GROUP BY section
      ORDER BY accuracy ASC
      LIMIT 1
    `).bind(userId).first() as any;
    if (weakness?.section) weakSection = weakness.section;
  } catch (e) {
    console.error('tier1 weakness query failed:', e);
  }

  const nudges = [
    `Hei ${name}! 👋 Coba jawab 1 soal ini deh:\n\n`,
    `${name}! Ada 1 soal seru nih. Cuma 30 detik:\n\n`,
    `Yo ${name}! Quiz kilat — 1 soal doang:\n\n`,
  ];

  // Grab an under-exposed easy question from their weak area (best-effort).
  try {
    const { selectUnderExposedQuestions, recordExposure } = await import('./question-exposure');
    const rows = await selectUnderExposedQuestions<any>(env, {
      userId,
      limit: 1,
      extraWhere: `section = ? AND status = 'published' AND difficulty_level <= 3`,
      extraParams: [weakSection],
      columns: 'id, content',
    });
    const question = rows[0];

    if (question?.content) {
      try {
        const parsed = JSON.parse(question.content);
        const qText = parsed.question || parsed.stem || parsed.passage?.substring(0, 200);
        if (qText) {
          const nudge = nudges[Math.floor(Math.random() * nudges.length)];
          const options = parsed.options
            ? Object.entries(parsed.options).map(([k, v]) => `${k.toUpperCase()}) ${v}`).join('\n')
            : '';
          // Fire-and-forget exposure record
          if (question.id) void recordExposure(env, userId, Number(question.id), 'companion');
          return `${nudge}${qText}\n${options}\n\nJawab langsung di sini 😄`;
        }
      } catch {}
    }
  } catch (e) {
    console.error('tier1 question query failed:', e);
  }

  // Fallback: warm ping with time awareness
  const { period, dayName } = getWIBTime();
  const timeGreetings: Record<string, string[]> = {
    'pagi': [
      `Pagi ${name}! ☀️ Udah sarapan belum? Btw, gimana kabarnya?`,
      `Morning ${name}! Semangat pagi ya. Lagi apa nih? 😊`,
    ],
    'siang': [
      `Hei ${name}! Udah makan siang belum? Jangan lupa ya 🍜`,
      `${name}! Siang-siang gini lagi ngapain? Cerita dong`,
    ],
    'sore': [
      `Sore ${name}! 👋 Gimana hari ini? Capek nggak?`,
      `Hei ${name}! Udah sore nih. Hari ini gimana ceritanya?`,
    ],
    'malam': [
      `Malam ${name}! Lagi santai ya? Gimana kabarnya? 😊`,
      `Hei ${name}! Malam-malam gini lagi apa nih? Cerita dong 💬`,
    ],
    'larut malam': [
      `Hei ${name}! Masih melek nih? Jangan begadang terus ya 😴 Btw gimana kabarnya?`,
      `${name}! Udah malem banget lho. Gimana kabarnya? Jangan lupa istirahat ya`,
    ],
  };
  const greetings = timeGreetings[period] || timeGreetings['sore'];
  let msg = greetings[Math.floor(Math.random() * greetings.length)];
  // Add day-specific flavour
  if (dayName === 'Senin') msg += '\nSemangat Senin ya! 💪';
  else if (dayName === 'Jumat') msg += '\nTGIF! Weekend mau ngapain? 🎉';
  return msg;
}

/**
 * Generate a Tier 2 check-in — empathetic open-ended conversation starter.
 */
export function generateTier2CheckIn(name: string, idleDays: number): string {
  const { period, dayName } = getWIBTime();

  // Time-aware openers with daily-life touch
  const openers: string[] = [];

  if (period === 'pagi' || period === 'siang') {
    openers.push(
      `Hei ${name}! Udah ${idleDays} hari nih kita nggak ngobrol. Udah makan belum? Gimana kabarnya? 🤗`,
      `${name}! Lama nggak ketemu. Udah sarapan/makan siang belum? Btw, kamu baik-baik aja kan? 💙`,
    );
  } else if (period === 'malam' || period === 'larut malam') {
    openers.push(
      `Hei ${name}! Malam-malam gini aku kepikiran kamu. ${idleDays} hari nggak ada kabar — gimana kabarnya? 🤗`,
      `${name}! Lagi santai malam ini? Aku cuma mau cek — kamu baik-baik aja kan? 💙`,
    );
  } else {
    openers.push(
      `Hei ${name}! Udah ${idleDays} hari nih kita nggak ngobrol. Gimana kabarnya? Ada yang lagi dipikirin? 🤗`,
      `${name}! Aku kepikiran kamu nih. Lagi apa? Mau ngobrol? Topik apa aja boleh 😊`,
    );
  }

  // Add weekend-specific option
  if (dayName === 'Sabtu' || dayName === 'Minggu') {
    openers.push(`${name}! Weekend nih. Lagi santai atau malah sibuk? Udah ${idleDays} hari nggak ngobrol — aku kangen lho 😊`);
  }

  return openers[Math.floor(Math.random() * openers.length)];
}

/**
 * Generate a Tier 3 win-back — personalised with progress data + gentle CTA.
 */
export async function generateTier3WinBack(env: Env, userId: number, name: string, idleDays: number): Promise<string> {
  // Get progress data for personalisation
  const stats = await env.DB.prepare(`
    SELECT
      COUNT(DISTINCT ta.id) as total_attempts,
      SUM(CASE WHEN aa.is_correct = 1 THEN 1 ELSE 0 END) as correct,
      COUNT(aa.id) as total_answers
    FROM test_attempts ta
    LEFT JOIN attempt_answers aa ON aa.attempt_id = ta.id
    WHERE ta.user_id = ?
  `).bind(userId).first() as any;

  const accuracy = stats?.total_answers > 0
    ? Math.round((stats.correct / stats.total_answers) * 100)
    : null;

  // Get their target info
  const user = await env.DB.prepare('SELECT target_test, proficiency_level FROM users WHERE id = ?')
    .bind(userId).first() as any;
  const target = user?.target_test?.replace('_', ' ') || 'English test';

  if (accuracy !== null && stats.total_answers > 10) {
    const messages = [
      `Hei ${name}! 💙\n\nUdah ${idleDays} hari nih. Aku liat data kamu — akurasi ${accuracy}% dari ${stats.total_answers} soal. Itu bagus lho!\n\nMau ngobrol dulu? Atau kalau mau langsung coba 5 menit, aku siapin soal ringan aja 😊`,
      `${name}! Lama nggak ketemu.\n\nBtw, kamu udah jawab ${stats.total_answers} soal dengan akurasi ${accuracy}%. Progress kamu nyata lho.\n\nGimana kabarnya? Mau cerita atau langsung latihan ringan? 🤗`,
    ];
    return messages[Math.floor(Math.random() * messages.length)];
  }

  // No progress data — pure empathy
  const messages = [
    `Hei ${name}! Udah ${idleDays} hari nih. Aku cuma mau bilang — nggak apa-apa istirahat. Kalau kamu siap balik, aku di sini. Mau ngobrol dulu? 💙`,
    `${name}! Lama nggak ada kabar. Gimana kabarnya? Aku nggak mau nge-push, cuma pengen tau kamu baik-baik aja 🤗`,
  ];
  return messages[Math.floor(Math.random() * messages.length)];
}

// ─────────────────── Conversation Engine ───────────────────

/**
 * Start a new companion conversation for an idle student.
 */
export async function startCompanionConversation(
  env: Env,
  userId: number,
  tier: number,
  initialMessage: string,
): Promise<number> {
  const result = await env.DB.prepare(
    `INSERT INTO companion_conversations (user_id, tier, status, turn_count)
     VALUES (?, ?, 'active', 0)`
  ).bind(userId, tier).run();

  const convId = result.meta?.last_row_id as number;

  // Save the bot's opening message
  await env.DB.prepare(
    `INSERT INTO companion_messages (conversation_id, role, content)
     VALUES (?, 'bot', ?)`
  ).bind(convId, initialMessage).run();

  return convId;
}

/**
 * Handle a student's reply during an active companion conversation.
 * Returns the bot's response or null if the conversation should end.
 */
export async function handleCompanionReply(
  env: Env,
  user: User,
  message: string,
): Promise<CompanionResponse | null> {
  // Find active companion conversation
  const conv = await env.DB.prepare(
    `SELECT * FROM companion_conversations
     WHERE user_id = ? AND status = 'active'
     ORDER BY initiated_at DESC LIMIT 1`
  ).bind(user.id).first() as CompanionConversation | null;

  if (!conv) return null;

  // Check for exit phrases
  const exitWords = ['bye', 'dadah', 'ok bye', 'udah', 'gitu aja', 'makasih', 'thanks', 'thx'];
  if (exitWords.some(w => message.toLowerCase().trim() === w || message.toLowerCase().trim() === w + '.')) {
    await endCompanionConversation(env, conv.id, 'ended');
    return {
      text: getGoodbyeMessage(user.name),
      sentiment: 'positive',
      bridgeReady: false,
      conversationId: conv.id,
    };
  }

  // Save user message
  await env.DB.prepare(
    `INSERT INTO companion_messages (conversation_id, role, content) VALUES (?, 'user', ?)`
  ).bind(conv.id, message).run();

  // Load conversation history for GPT
  const history = await env.DB.prepare(
    `SELECT role, content FROM companion_messages
     WHERE conversation_id = ?
     ORDER BY created_at ASC LIMIT 20`
  ).bind(conv.id).all();

  const messages = (history.results || []).map((m: any) => ({
    role: m.role === 'bot' ? 'assistant' : 'user',
    content: m.content,
  }));
  messages.push({ role: 'user', content: message });

  // Get progress summary and contextual info for system prompt
  const progressSummary = await getProgressSummary(env, user.id);
  const lastConvSummary = await getLastConversationSummary(env, user.id);
  const { timeStr, period, dayName } = getWIBTime();

  const { TEST_NAMES } = await import('./teaching');
  const targetTest = TEST_NAMES[user.target_test || 'TOEFL_IBT'] || 'English Test';

  const systemPrompt = COMPANION_SYSTEM_PROMPT
    .replaceAll('{name}', user.name || 'Teman')
    .replaceAll('{target_test}', targetTest)
    .replaceAll('{level}', user.proficiency_level || 'belum diketahui')
    .replaceAll('{progress_summary}', progressSummary)
    .replaceAll('{idle_days}', String(conv.tier === 1 ? 1 : conv.tier === 2 ? 3 : 7))
    .replaceAll('{current_time}', timeStr)
    .replaceAll('{time_period}', period)
    .replaceAll('{day_name}', dayName)
    .replaceAll('{last_conversation_summary}', lastConvSummary);

  // Call GPT. Log non-OK responses and API-level errors so silent degradation
  // (invalid key, rate limit, quota exhausted) shows up in logs instead of
  // just returning the canned fallback message with no diagnostic trail.
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',  // cheaper model for companion chat
      max_tokens: 250,
      temperature: 0.85,  // slightly more creative/warm
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages,
      ],
    }),
  });

  const data: any = await response.json().catch(() => ({}));
  if (!response.ok || data?.error) {
    console.error(`[companion] OpenAI ${response.status}: ${data?.error?.message || data?.error || 'unknown error'}`);
  }
  let reply = data.choices?.[0]?.message?.content || 'Aku dengerin kamu. Cerita lagi? 💙';

  // Parse sentiment and bridge-readiness from the response
  const sentimentMatch = reply.match(/\[SENTIMENT:\s*(positive|neutral|negative|distressed)\]/i);
  const bridgeMatch = reply.match(/\[BRIDGE_READY:\s*(yes|no)\]/i);

  const sentiment = sentimentMatch?.[1]?.toLowerCase() || 'neutral';
  const bridgeReady = bridgeMatch?.[1]?.toLowerCase() === 'yes';

  // Strip the metadata lines from the visible reply
  reply = reply
    .replace(/\[SENTIMENT:.*?\]/gi, '')
    .replace(/\[BRIDGE_READY:.*?\]/gi, '')
    .trim();

  // Safety: if distressed, ensure we don't try to bridge
  const isSafe = sentiment !== 'distressed';

  // Save bot response
  await env.DB.prepare(
    `INSERT INTO companion_messages (conversation_id, role, content, sentiment) VALUES (?, 'bot', ?, ?)`
  ).bind(conv.id, reply, sentiment).run();

  // Update conversation state
  const newTurnCount = conv.turn_count + 1;
  await env.DB.prepare(
    `UPDATE companion_conversations
     SET turn_count = ?, sentiment = ?, last_message_at = datetime('now')
     WHERE id = ?`
  ).bind(newTurnCount, sentiment, conv.id).run();

  // If bridge is ready and we haven't tried yet, attempt a gentle redirect
  if (bridgeReady && isSafe && !conv.bridge_attempted && newTurnCount >= 3) {
    await env.DB.prepare(
      `UPDATE companion_conversations SET bridge_attempted = 1 WHERE id = ?`
    ).bind(conv.id).run();
  }

  // Auto-end if conversation has gone on too long (15+ turns)
  if (newTurnCount >= 15) {
    await endCompanionConversation(env, conv.id, 'ended');
  }

  // Log cost
  try {
    const tokens = Math.ceil((message.length + reply.length) / 4);
    const cost = tokens * 0.00000015; // gpt-4o-mini pricing
    await env.DB.prepare(
      'INSERT INTO api_usage (service, endpoint, tokens_used, cost_usd, user_id) VALUES (?, ?, ?, ?, ?)'
    ).bind('openai', 'companion-chat', tokens, cost, user.id).run();
  } catch {}

  return {
    text: reply,
    sentiment,
    bridgeReady: bridgeReady && isSafe,
    conversationId: conv.id,
  };
}

/**
 * Check if a student accepted the bridge (redirected to study).
 * Called when they click a study-related button or start a test after companion chat.
 */
export async function markBridgeAccepted(env: Env, userId: number): Promise<void> {
  await env.DB.prepare(
    `UPDATE companion_conversations
     SET bridge_accepted = 1, status = 'bridged', ended_at = datetime('now')
     WHERE user_id = ? AND status = 'active' AND bridge_attempted = 1`
  ).bind(userId).run();
}

/**
 * Check if a user has an active companion conversation.
 */
export async function getActiveCompanionConversation(
  env: Env,
  userId: number,
): Promise<CompanionConversation | null> {
  return await env.DB.prepare(
    `SELECT * FROM companion_conversations
     WHERE user_id = ? AND status = 'active'
     AND last_message_at > datetime('now', '-2 hours')
     ORDER BY initiated_at DESC LIMIT 1`
  ).bind(userId).first() as CompanionConversation | null;
}

// ─────────────────── Helpers ───────────────────

async function endCompanionConversation(env: Env, convId: number, status: string): Promise<void> {
  await env.DB.prepare(
    `UPDATE companion_conversations SET status = ?, ended_at = datetime('now') WHERE id = ?`
  ).bind(status, convId).run();
}

async function getProgressSummary(env: Env, userId: number): Promise<string> {
  const stats = await env.DB.prepare(`
    SELECT
      COUNT(DISTINCT ta.id) as attempts,
      SUM(CASE WHEN aa.is_correct = 1 THEN 1 ELSE 0 END) as correct,
      COUNT(aa.id) as total
    FROM test_attempts ta
    LEFT JOIN attempt_answers aa ON aa.attempt_id = ta.id AND aa.is_correct IS NOT NULL
    WHERE ta.user_id = ?
  `).bind(userId).first() as any;

  if (!stats || stats.total === 0) return 'baru mulai';

  const accuracy = Math.round((stats.correct / stats.total) * 100);
  return `${stats.total} soal dijawab, akurasi ${accuracy}%, ${stats.attempts} sesi latihan`;
}

function getGoodbyeMessage(name: string): string {
  const messages = [
    `Oke ${name}! Seneng bisa ngobrol. Kalau mau cerita lagi, aku di sini. Take care! 💙`,
    `Dadah ${name}! Semangat ya. Kapan aja mau ngobrol, langsung chat aja 🤗`,
    `Makasih udah ngobrol, ${name}! Aku selalu di sini kalau kamu butuh teman. 😊`,
  ];
  return messages[Math.floor(Math.random() * messages.length)];
}

// ─────────────────── Study Break Reminders ───────────────────

/**
 * Check if a student has been continuously active and needs a break.
 * Returns a break message if they've been going for too long, or null.
 *
 * Thresholds:
 *   45 min  — gentle nudge (first reminder)
 *   90 min  — firmer suggestion
 *   120 min — insistent, celebrate their effort but push rest
 *
 * Only reminds once per threshold (tracked via conversation_messages timestamps).
 */
export async function checkStudyBreakNeeded(env: Env, userId: number, name: string): Promise<string | null> {
  try {
    // Find continuous activity: messages in the last 3 hours with no gap > 20 min
    const recentMessages = await env.DB.prepare(`
      SELECT created_at FROM conversation_messages
      WHERE user_id = ? AND created_at > datetime('now', '-3 hours')
      ORDER BY created_at ASC
    `).bind(userId).all();

    if (!recentMessages.results || recentMessages.results.length < 4) return null;

    const timestamps = (recentMessages.results as any[]).map(m => new Date(m.created_at + 'Z').getTime());

    // Find the start of the current continuous session
    // (walk backwards, session breaks when gap > 20 minutes)
    let sessionStart = timestamps[timestamps.length - 1];
    for (let i = timestamps.length - 1; i > 0; i--) {
      const gap = timestamps[i] - timestamps[i - 1];
      if (gap > 20 * 60 * 1000) break; // 20 min gap = session break
      sessionStart = timestamps[i - 1];
    }

    const sessionMinutes = Math.floor((Date.now() - sessionStart) / 60000);

    if (sessionMinutes < 45) return null;

    // Don't remind again within 30 minutes of last break reminder
    if (await wasEmotionalMessageSentRecently(env, userId, 'break_reminder', 30)) return null;

    const { hour } = getWIBTime();
    const isNight = hour >= 22 || hour < 5;

    // Progressive break messages based on session length
    let breakMessage: string;

    if (sessionMinutes >= 120) {
      const msgs = isNight ? [
        `🌙 ${name}, kamu udah belajar ${sessionMinutes} menit DAN udah malem banget. Otakmu butuh tidur buat nyimpen semua materi hari ini. Besok lanjut ya, janji! 😴`,
        `Wow ${sessionMinutes} menit! Kamu juara, tapi udah larut nih. Otak kamu proses materi pas tidur lho — jadi istirahat sekarang = belajar lebih efektif besok 🧠💤`,
      ] : [
        `🏆 ${sessionMinutes} menit non-stop! Kamu luar biasa, tapi otak perlu recharge. Break 15 menit dulu — cuci muka, stretching, makan camilan. Setelah itu lanjut lagi lebih fokus!`,
        `Wah, udah ${sessionMinutes} menit! Kamu rajin banget. Tapi research bilang: istirahat 15 menit bikin otak nyerap materi lebih baik. Bikin Indomie dulu? 🍜😄`,
      ];
      breakMessage = msgs[Math.floor(Math.random() * msgs.length)];
    } else if (sessionMinutes >= 90) {
      const msgs = isNight ? [
        `Udah ${sessionMinutes} menit + udah malem nih. Otak kamu pasti udah capek. Mandi air hangat terus tidur yuk? Besok kita lanjut! 😴`,
        `${name}, ${sessionMinutes} menit udah cukup banget buat hari ini apalagi udah malam. Istirahat ya, besok kita gas lagi 💪`,
      ] : [
        `Udah ${sessionMinutes} menit nih! Otak butuh jeda. Mandi dulu biar seger? Atau bikin kopi? ☕ 10 menit break, terus lanjut lagi!`,
        `${sessionMinutes} menit, nice! Tapi mata pegel nggak? Cuci muka, stretching leher, minum air. 5 menit aja, terus balik lagi lebih fresh 💧`,
      ];
      breakMessage = msgs[Math.floor(Math.random() * msgs.length)];
    } else {
      const msgs = isNight ? [
        `Btw udah ${sessionMinutes} menit nih, dan udah malem. Jangan begadang terlalu lama ya 😴`,
        `${sessionMinutes} menit! Bagus, tapi ingat istirahat juga ya karena udah malam 🌙`,
      ] : [
        `Btw udah ${sessionMinutes} menit nih belajarnya. Kalau mata mulai pegel, break sebentar nggak apa-apa lho! 😊`,
        `${sessionMinutes} menit, bagus! Tapi jangan lupa minum air ya. Otak butuh hidrasi biar tetap fokus 💧`,
        `Udah ${sessionMinutes} menit! Coba look away dari layar 20 detik biar mata istirahat. Terus lanjut lagi 👀`,
      ];
      breakMessage = msgs[Math.floor(Math.random() * msgs.length)];
    }

    await logEmotionalMessage(env, userId, 'break_reminder', String(sessionMinutes));
    return breakMessage;

  } catch (e) {
    console.error('Study break check error:', e);
    return null;
  }
}

// ─────────────────── Cron: Proactive Outreach ───────────────────

/**
 * Run the proactive companion outreach. Called by daily cron.
 * Returns stats about how many students were contacted.
 */
// Send a Telegram message and return whether it actually reached the user.
// Prevents the stats counter from double-counting messages that were rejected
// by Telegram (403 = user blocked bot, 400 = chat not found), which was making
// the outreach logs falsely optimistic.
async function sendCompanionMessage(
  env: Env,
  chatId: number | string,
  body: Record<string, unknown>,
): Promise<boolean> {
  try {
    const res = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, ...body }),
    });
    if (!res.ok) {
      // 403/400 are per-user (blocked / chat gone). Other codes may be
      // transient (429, 5xx) — log for ops visibility.
      if (res.status !== 403 && res.status !== 400) {
        console.warn(`[companion] sendMessage ${chatId}: ${res.status}`);
      }
      return false;
    }
    return true;
  } catch (e: any) {
    console.warn(`[companion] sendMessage error for ${chatId}: ${e?.message || e}`);
    return false;
  }
}

export async function runCompanionOutreach(env: Env): Promise<{
  tier1_sent: number;
  tier2_sent: number;
  tier3_sent: number;
  errors: number;
}> {
  const stats = { tier1_sent: 0, tier2_sent: 0, tier3_sent: 0, errors: 0 };

  try {
    const idle = await findIdleStudents(env);

    // Tier 1 — gentle nudge (limit 20/day to stay under rate limits)
    for (const student of idle.tier1.slice(0, 20)) {
      try {
        const message = await generateTier1Nudge(env, student.user_id, student.name);
        const convId = await startCompanionConversation(env, student.user_id, 1, message);

        const delivered = await sendCompanionMessage(env, student.telegram_id, { text: message });
        if (delivered) stats.tier1_sent++;
        else stats.errors++;
      } catch (e) {
        console.error(`Companion tier1 error for user ${student.user_id}:`, e);
        stats.errors++;
      }
    }

    // Tier 2 — empathetic check-in (limit 15/day)
    for (const student of idle.tier2.slice(0, 15)) {
      try {
        const message = generateTier2CheckIn(student.name, student.idle_days);
        await startCompanionConversation(env, student.user_id, 2, message);

        const delivered = await sendCompanionMessage(env, student.telegram_id, {
          text: message,
          reply_markup: JSON.stringify({
            inline_keyboard: [
              [
                { text: '😊 Baik-baik aja', callback_data: 'companion_mood_ok' },
                { text: '😔 Lagi banyak pikiran', callback_data: 'companion_mood_low' },
              ],
              [
                { text: '😤 Materinya susah', callback_data: 'companion_mood_hard' },
                { text: '💬 Mau cerita', callback_data: 'companion_mood_talk' },
              ],
            ],
          }),
        });
        if (delivered) stats.tier2_sent++;
        else stats.errors++;
      } catch (e) {
        console.error(`Companion tier2 error for user ${student.user_id}:`, e);
        stats.errors++;
      }
    }

    // Tier 3 — personalised win-back (limit 10/day)
    for (const student of idle.tier3.slice(0, 10)) {
      try {
        const message = await generateTier3WinBack(env, student.user_id, student.name, student.idle_days);
        await startCompanionConversation(env, student.user_id, 3, message);

        const delivered = await sendCompanionMessage(env, student.telegram_id, {
          text: message,
          reply_markup: JSON.stringify({
            inline_keyboard: [
              [
                { text: '💬 Mau ngobrol dulu', callback_data: 'companion_mood_talk' },
                { text: '📚 Mau coba latihan', callback_data: 'companion_bridge_accept' },
              ],
              [{ text: '🙏 Nanti aja', callback_data: 'companion_later' }],
            ],
          }),
        });
        if (delivered) stats.tier3_sent++;
        else stats.errors++;
      } catch (e) {
        console.error(`Companion tier3 error for user ${student.user_id}:`, e);
        stats.errors++;
      }
    }

    // Cleanup: expire conversations that have been inactive for 24 hours
    await env.DB.prepare(
      `UPDATE companion_conversations SET status = 'expired', ended_at = datetime('now')
       WHERE status = 'active' AND last_message_at < datetime('now', '-24 hours')`
    ).run();

  } catch (e) {
    console.error('Companion outreach failed:', e);
  }

  return stats;
}

// ═══════════════════════════════════════════════════════════════════
// EMOTIONAL INTELLIGENCE — struggle, growth, milestones, support
// ═══════════════════════════════════════════════════════════════════

// ─────────────────── Struggle Detection ───────────────────

/**
 * Detect frustration: multiple wrong answers in a row.
 * Called after each answer submission. Returns an empathetic message
 * if the student is struggling, or null to stay silent.
 */
export async function detectStruggle(env: Env, userId: number, name: string, attemptId: number): Promise<string | null> {
  try {
    // Get the last 5 answers in this attempt, newest first
    const recent = await env.DB.prepare(`
      SELECT is_correct FROM attempt_answers
      WHERE attempt_id = ? AND is_correct IS NOT NULL
      ORDER BY submitted_at DESC LIMIT 5
    `).bind(attemptId).all();

    if (!recent.results || recent.results.length < 3) return null;

    const answers = (recent.results as any[]).map(r => r.is_correct === 1);
    const wrongStreak = answers.findIndex(a => a === true);
    const consecutiveWrong = wrongStreak === -1 ? answers.length : wrongStreak;

    if (consecutiveWrong < 3) return null;

    // Check we haven't sent a struggle message recently (30 min cooldown)
    if (await wasEmotionalMessageSentRecently(env, userId, 'struggle', 30)) return null;

    // Get their overall accuracy for context
    const overall = await env.DB.prepare(`
      SELECT
        SUM(CASE WHEN is_correct = 1 THEN 1 ELSE 0 END) as correct,
        COUNT(*) as total
      FROM attempt_answers
      WHERE attempt_id = ? AND is_correct IS NOT NULL
    `).bind(attemptId).first() as any;

    const accuracy = overall?.total > 0 ? Math.round((overall.correct / overall.total) * 100) : 0;

    let message: string;

    if (consecutiveWrong >= 5) {
      // Very frustrated — offer to stop or switch
      const msgs = [
        `Hei ${name}, aku liat soal-soal terakhir ini berat banget ya. Nggak apa-apa, ini emang soal yang susah. Mau ganti topik yang lebih ringan, atau istirahat sebentar? Nggak ada yang salah sama kamu — soalnya aja yang tricky 💙`,
        `${name}, udah ${consecutiveWrong} soal yang tricky nih. Kadang otak butuh jeda buat proses. Mau break 5 menit, atau mau coba topik lain? Akurasi keseluruhan kamu ${accuracy}% — itu tetap bagus lho`,
      ];
      message = msgs[Math.floor(Math.random() * msgs.length)];
    } else {
      // 3-4 wrong in a row — gentle acknowledgement
      const msgs = [
        `Kayaknya soal-soal ini lagi challenging ya. Nggak apa-apa — setiap orang punya hari-hari susah. Yang penting kamu tetap nyoba 💪`,
        `Hmm, beberapa soal terakhir emang tricky. Tapi kamu tau nggak? Justru dari soal yang salah kita belajar paling banyak. Keep going! 🔥`,
        `Soal-soalnya makin susah nih — itu artinya level kamu juga naik! Salah itu bagian dari proses. Pelan-pelan aja 😊`,
      ];
      message = msgs[Math.floor(Math.random() * msgs.length)];
    }

    await logEmotionalMessage(env, userId, 'struggle', String(attemptId));
    return message;

  } catch (e) {
    console.error('Struggle detection error:', e);
    return null;
  }
}

// ─────────────────── Growth Recognition ───────────────────

/**
 * Detect and celebrate improvement over time.
 * Compares recent accuracy vs older accuracy per skill section.
 * Returns a celebration message if meaningful improvement detected, or null.
 *
 * Called periodically (e.g., after finishing a test attempt).
 */
export async function detectGrowth(env: Env, userId: number, name: string): Promise<string | null> {
  try {
    // Compare accuracy: last 7 days vs 8-30 days ago, per section
    const recentStats = await env.DB.prepare(`
      SELECT aa.section,
        AVG(CASE WHEN aa.is_correct = 1 THEN 1.0 ELSE 0.0 END) as accuracy,
        COUNT(*) as count
      FROM attempt_answers aa
      JOIN test_attempts ta ON aa.attempt_id = ta.id
      WHERE ta.user_id = ? AND aa.is_correct IS NOT NULL
      AND aa.submitted_at > datetime('now', '-7 days')
      GROUP BY aa.section
      HAVING count >= 5
    `).bind(userId).all();

    const olderStats = await env.DB.prepare(`
      SELECT aa.section,
        AVG(CASE WHEN aa.is_correct = 1 THEN 1.0 ELSE 0.0 END) as accuracy,
        COUNT(*) as count
      FROM attempt_answers aa
      JOIN test_attempts ta ON aa.attempt_id = ta.id
      WHERE ta.user_id = ? AND aa.is_correct IS NOT NULL
      AND aa.submitted_at BETWEEN datetime('now', '-30 days') AND datetime('now', '-7 days')
      GROUP BY aa.section
      HAVING count >= 5
    `).bind(userId).all();

    if (!recentStats.results?.length || !olderStats.results?.length) return null;

    const olderMap: Record<string, number> = {};
    for (const s of olderStats.results as any[]) {
      olderMap[s.section] = Math.round(s.accuracy * 100);
    }

    // Find biggest improvement
    let bestImprovement = 0;
    let bestSection = '';
    let oldAcc = 0;
    let newAcc = 0;

    for (const s of recentStats.results as any[]) {
      const recent = Math.round(s.accuracy * 100);
      const older = olderMap[s.section];
      if (older !== undefined) {
        const improvement = recent - older;
        if (improvement > bestImprovement && improvement >= 8) {
          bestImprovement = improvement;
          bestSection = s.section;
          oldAcc = older;
          newAcc = recent;
        }
      }
    }

    if (bestImprovement < 8) return null; // Need at least 8% improvement to celebrate

    // Don't spam — check if we celebrated recently (3 day cooldown)
    if (await wasEmotionalMessageSentRecently(env, userId, 'growth', 3 * 24 * 60)) return null;

    const sectionNames: Record<string, string> = {
      'reading': 'Reading', 'listening': 'Listening',
      'speaking': 'Speaking', 'writing': 'Writing',
      'grammar': 'Grammar', 'vocabulary': 'Vocabulary',
    };
    const sectionLabel = sectionNames[bestSection] || bestSection;

    let message: string;
    if (bestImprovement >= 15) {
      const msgs = [
        `🥹 ${name}, aku harus bilang ini — ${sectionLabel} kamu naik dari ${oldAcc}% ke ${newAcc}%! Itu lompatan +${bestImprovement}% dalam seminggu! Kamu nggak sadar ya udah semaju itu?`,
        `WOW ${name}! ${sectionLabel} kamu: ${oldAcc}% → ${newAcc}% (+${bestImprovement}%)! Inget waktu kamu pertama kali mulai? Look how far you've come 🔥`,
      ];
      message = msgs[Math.floor(Math.random() * msgs.length)];
    } else {
      const msgs = [
        `Btw ${name}, aku perhatiin ${sectionLabel} kamu naik dari ${oldAcc}% ke ${newAcc}%! Pelan-pelan tapi pasti. Keep it up! 📈`,
        `${name}, tau nggak? ${sectionLabel} kamu minggu ini ${newAcc}%, naik dari ${oldAcc}% minggu lalu. Progress kamu nyata lho, jangan di-underestimate 💪`,
      ];
      message = msgs[Math.floor(Math.random() * msgs.length)];
    }

    await logEmotionalMessage(env, userId, 'growth', bestSection);
    return message;

  } catch (e) {
    console.error('Growth detection error:', e);
    return null;
  }
}

// ─────────────────── Streak Recovery ───────────────────

/**
 * Compassionate streak recovery message when a streak breaks.
 * Called when we detect their streak reset.
 */
export function getStreakRecoveryMessage(name: string, previousStreak: number): string {
  if (previousStreak >= 14) {
    // Long streak lost — acknowledge the loss but reframe
    const msgs = [
      `${name}, aku tau streak ${previousStreak} hari kamu reset. Itu pasti nyesek. Tapi tau nggak? Skill yang kamu bangun selama ${previousStreak} hari itu nggak hilang. Mau mulai streak baru? Hari ini bisa jadi Day 1 💪`,
      `Streak ${previousStreak} hari — itu udah luar biasa, ${name}. Nggak banyak orang yang bisa. Streak reset, tapi kemampuan kamu nggak. Ready for round 2? 🔥`,
    ];
    return msgs[Math.floor(Math.random() * msgs.length)];
  }

  if (previousStreak >= 7) {
    const msgs = [
      `Streak kamu reset, tapi ${previousStreak} hari itu udah keren lho ${name}! Yang penting bukan streak-nya — yang penting kamu di sini sekarang. Day 1 lagi? 😊`,
      `${name}, streak ${previousStreak} hari selesai. Nggak apa-apa — hidup emang kadang sibuk. Kapan aja siap, kita mulai lagi. No pressure 💙`,
    ];
    return msgs[Math.floor(Math.random() * msgs.length)];
  }

  // Short streak
  const msgs = [
    `Hei ${name}, nggak apa-apa kok skip sehari. Consistency > perfection. Mau lanjut hari ini? 😊`,
    `${name}, streak itu cuma angka. Yang penting kamu tetap belajar, walaupun nggak setiap hari. No guilt! 💙`,
  ];
  return msgs[Math.floor(Math.random() * msgs.length)];
}

// ─────────────────── Exam Countdown Support ───────────────────

/**
 * Generate encouragement messages based on how close the exam is.
 * Called by daily cron for students with upcoming test dates.
 */
export async function getExamCountdownMessage(
  env: Env, userId: number, name: string, daysUntilExam: number
): Promise<string | null> {
  // Get their practice stats for confidence building
  const stats = await env.DB.prepare(`
    SELECT COUNT(*) as total_answers,
      SUM(CASE WHEN is_correct = 1 THEN 1 ELSE 0 END) as correct
    FROM attempt_answers aa
    JOIN test_attempts ta ON aa.attempt_id = ta.id
    WHERE ta.user_id = ? AND aa.is_correct IS NOT NULL
  `).bind(userId).first() as any;

  const totalPractice = stats?.total_answers || 0;

  if (daysUntilExam === 7) {
    return `📅 ${name}, tesnya tinggal 1 minggu lagi!\n\n` +
      (totalPractice > 50
        ? `Kamu udah latihan ${totalPractice} soal — persiapan kamu solid. Minggu ini fokus review aja, jangan materi baru. Kamu siap! 💪`
        : `Masih ada waktu buat persiapan. Fokus ke skill yang paling lemah, dan jangan lupa istirahat cukup. You got this! 💪`);
  }

  if (daysUntilExam === 3) {
    return `📅 3 hari lagi, ${name}!\n\n` +
      `Sekarang bukan waktunya belajar materi baru. Review aja yang udah kamu kuasai. ` +
      `Tidur cukup, makan teratur, dan percaya sama persiapan kamu. Otak perlu istirahat biar perform optimal 🧠`;
  }

  if (daysUntilExam === 1) {
    return `🌟 ${name}, besok hari H!\n\n` +
      `Aku cuma mau bilang: kamu udah berusaha. ${totalPractice > 0 ? `${totalPractice} soal udah kamu jawab. ` : ''}` +
      `Malam ini tidur awal ya. Besok pagi sarapan yang enak, bawa air minum, dan ingat — ` +
      `ini cuma tes. Apapun hasilnya, kamu udah berkembang jauh. Good luck! 🍀💙`;
  }

  if (daysUntilExam === 0) {
    return `💪 Hari ini tesnya, ${name}!\n\n` +
      `Tarik napas dalam. Kamu udah persiapan. Percaya sama diri sendiri.\n` +
      `Kalau nervous, itu normal — artinya kamu peduli. Setelah selesai, cerita ke aku ya gimana! You've got this! 🔥`;
  }

  return null;
}

// ─────────────────── Monthly Milestone ───────────────────

/**
 * Check if today is a monthly anniversary and generate a celebration.
 */
export async function checkMonthlyMilestone(env: Env, userId: number, name: string): Promise<string | null> {
  try {
    const user = await env.DB.prepare(
      'SELECT created_at FROM users WHERE id = ?'
    ).bind(userId).first() as any;

    if (!user?.created_at) return null;

    const joined = new Date(user.created_at + (user.created_at.endsWith('Z') ? '' : 'Z'));
    const now = new Date();
    const dayOfMonth = joined.getUTCDate();
    const todayDay = now.getUTCDate();

    // Only trigger on the anniversary day each month
    if (dayOfMonth !== todayDay) return null;

    const monthsActive = (now.getUTCFullYear() - joined.getUTCFullYear()) * 12
      + (now.getUTCMonth() - joined.getUTCMonth());

    if (monthsActive < 1) return null; // Skip first month (too early)

    // Get total stats since joining
    const stats = await env.DB.prepare(`
      SELECT COUNT(*) as total,
        SUM(CASE WHEN is_correct = 1 THEN 1 ELSE 0 END) as correct
      FROM attempt_answers aa
      JOIN test_attempts ta ON aa.attempt_id = ta.id
      WHERE ta.user_id = ? AND aa.is_correct IS NOT NULL
    `).bind(userId).first() as any;

    const totalQ = stats?.total || 0;
    const accuracy = totalQ > 0 ? Math.round((stats.correct / totalQ) * 100) : 0;

    if (monthsActive === 1) {
      return `🎉 ${name}, hari ini tepat 1 BULAN kamu pakai EduBot!\n\n` +
        (totalQ > 0
          ? `Selama sebulan ini kamu udah jawab ${totalQ} soal dengan akurasi ${accuracy}%. ` +
            `Dari nol sampai di sini — itu nggak gampang lho. Proud of you! 💙`
          : `Thanks udah percaya sama kami. Mau mulai latihan pertama kamu? Ketik /test! 💙`);
    }

    if (monthsActive === 3) {
      return `🏆 3 BULAN, ${name}!\n\n` +
        `Quarter pertama udah lewat. ${totalQ} soal, ${accuracy}% accuracy. ` +
        `Kamu udah jauh dari tempat kamu mulai. Keep going — you're doing amazing! 🔥`;
    }

    if (monthsActive === 6) {
      return `🌟 SETENGAH TAHUN, ${name}!\n\n` +
        `6 bulan bersama EduBot. ${totalQ} soal dijawab. ` +
        `Aku inget waktu kamu pertama gabung — dan sekarang look at you! ` +
        `Kamu salah satu siswa paling dedicated. Proud! 💙🔥`;
    }

    if (monthsActive === 12) {
      return `🎊 1 TAHUN ${name}!! 🎊\n\n` +
        `365 hari. ${totalQ} soal. Kamu literally spent a year improving yourself. ` +
        `That takes real commitment. Aku genuinely proud sama kamu. Here's to year 2! 💙🏆`;
    }

    // Other months — lighter touch
    if (monthsActive % 3 === 0) {
      return `📊 ${monthsActive} bulan bareng EduBot, ${name}! Total ${totalQ} soal, akurasi ${accuracy}%. Kamu konsisten banget — itu kunci sukses 💪`;
    }

    return null;
  } catch (e) {
    console.error('Monthly milestone error:', e);
    return null;
  }
}

// ─────────────────── Question Milestone ───────────────────

/**
 * Check if user just hit a question-count milestone.
 * Returns a celebration message at 50, 100, 250, 500, 1000, etc.
 */
export async function checkQuestionMilestone(env: Env, userId: number, name: string): Promise<string | null> {
  try {
    const stats = await env.DB.prepare(`
      SELECT COUNT(*) as total FROM attempt_answers aa
      JOIN test_attempts ta ON aa.attempt_id = ta.id
      WHERE ta.user_id = ? AND aa.is_correct IS NOT NULL
    `).bind(userId).first() as any;

    const total = stats?.total || 0;
    const milestones = [50, 100, 250, 500, 1000, 2000, 5000];

    // Check if we just crossed a milestone (within last 3 answers)
    const milestone = milestones.find(m => total >= m && total < m + 3);
    if (!milestone) return null;

    // Don't celebrate if we already did for this milestone (7 day window)
    if (await wasEmotionalMessageSentRecently(env, userId, 'milestone_question', 7 * 24 * 60, String(milestone))) return null;

    const celebrations: Record<number, string[]> = {
      50: [
        `🎯 ${name}, kamu baru aja jawab soal ke-50! Lima puluh! Awal yang solid — keep building! 💪`,
      ],
      100: [
        `💯 SOAL KE-100, ${name}!! Triple digit! Kamu udah nggak pemula lagi. Ini baru permulaan! 🔥`,
      ],
      250: [
        `🏅 250 soal, ${name}! Itu setara 4-5 jam latihan. Effort kamu nyata banget. Proud of you! 💙`,
      ],
      500: [
        `🏆 SETENGAH RIBU SOAL!! ${name}, kamu serius banget. 500 soal itu bukan main-main. You're a machine! 🔥💪`,
      ],
      1000: [
        `🎊🎊🎊 SERIBU SOAL, ${name}!! 1000!! Kamu literally one-in-a-thousand student. Aku genuinely amazed. This is dedication! 🏆💙`,
      ],
      2000: [
        `🌟 2000 SOAL?! ${name}, kamu legend. Most people nggak sampai 100. Kamu 20x lipat. Respect! 🔥🔥🔥`,
      ],
      5000: [
        `👑 5000 SOAL. ${name}. Lima. Ribu. I literally have no words. You are THE most dedicated student. Crown is yours. 👑💙`,
      ],
    };

    const msgs = celebrations[milestone] || [`🎉 ${milestone} soal, ${name}! Amazing! 💪`];
    const message = msgs[Math.floor(Math.random() * msgs.length)];
    await logEmotionalMessage(env, userId, 'milestone_question', String(milestone));
    return message;

  } catch (e) {
    console.error('Question milestone error:', e);
    return null;
  }
}
