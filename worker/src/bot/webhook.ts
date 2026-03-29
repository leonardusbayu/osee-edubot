import type { Env, User } from '../types';
import { getTutorResponse } from '../services/ai';

// Telegram Bot API helper
function cleanForTelegram(text: string): string {
  // Strip markdown that Telegram can't render
  return text
    .replace(/#{1,6}\s*/g, '')         // Remove ### headers
    .replace(/\*\*(.+?)\*\*/g, '$1')   // **bold** → bold (Telegram HTML doesn't use **)
    .replace(/\*(.+?)\*/g, '$1')       // *italic* → italic
    .replace(/`{3}[\s\S]*?`{3}/g, '')  // Remove code blocks
    .replace(/`(.+?)`/g, '$1')         // Remove inline code
    .replace(/\[(.+?)\]\(.+?\)/g, '$1') // [link](url) → link
    .replace(/^[-*]\s/gm, '• ')        // - item → • item
    .replace(/\n{3,}/g, '\n\n')        // Max 2 newlines
    .trim();
}

async function sendMessage(env: Env, chatId: number, text: string, replyMarkup?: any) {
  const cleaned = cleanForTelegram(text);
  await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text: cleaned,
      reply_markup: replyMarkup,
    }),
  });
}

async function getOrCreateUser(env: Env, tgUser: any): Promise<User> {
  let user = await env.DB.prepare(
    'SELECT * FROM users WHERE telegram_id = ?'
  ).bind(tgUser.id).first() as User | null;

  if (!user) {
    const name = `${tgUser.first_name || ''} ${tgUser.last_name || ''}`.trim();
    await env.DB.prepare(
      'INSERT INTO users (telegram_id, name, username) VALUES (?, ?, ?)'
    ).bind(tgUser.id, name || 'User', tgUser.username || null).run();

    user = await env.DB.prepare(
      'SELECT * FROM users WHERE telegram_id = ?'
    ).bind(tgUser.id).first() as User;
  }

  return user;
}

// Send TTS audio as voice message via Telegram
async function sendTTSAudio(env: Env, chatId: number, text: string) {
  try {
    // Generate TTS audio from Worker's own TTS endpoint
    const workerUrl = env.WEBAPP_URL || 'https://edubot-api.edubot-leonardus.workers.dev';
    const ttsResponse = await fetch(`${workerUrl}/api/tts/speak?multi=true&text=${encodeURIComponent(text)}`);

    if (!ttsResponse.ok) return;

    const audioBuffer = await ttsResponse.arrayBuffer();

    // Send as voice message via Telegram
    const formData = new FormData();
    formData.append('chat_id', String(chatId));
    formData.append('voice', new Blob([audioBuffer], { type: 'audio/mpeg' }), 'audio.mp3');
    formData.append('caption', '🎧 Dengarkan audio ini:');

    await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendVoice`, {
      method: 'POST',
      body: formData,
    });
  } catch (e) {
    console.error('TTS audio send error:', e);
  }
}

// Save messages to conversation history for context
async function saveToHistory(env: Env, userId: number, userMsg: string, assistantMsg: string) {
  await env.DB.prepare(
    'INSERT INTO conversation_messages (user_id, role, content) VALUES (?, ?, ?)'
  ).bind(userId, 'user', userMsg).run();
  await env.DB.prepare(
    'INSERT INTO conversation_messages (user_id, role, content) VALUES (?, ?, ?)'
  ).bind(userId, 'assistant', assistantMsg).run();
}

// Inline keyboards
const testTypeKeyboard = {
  inline_keyboard: [
    [{ text: '🇺🇸 TOEFL iBT', callback_data: 'target_TOEFL_IBT' }],
    [{ text: '🇬🇧 IELTS', callback_data: 'target_IELTS' }],
    [{ text: '⏭ Skip', callback_data: 'target_skip' }],
  ],
};

const proficiencyKeyboard = {
  inline_keyboard: [
    [{ text: '🌱 Beginner', callback_data: 'level_beginner' }],
    [{ text: '🌿 Intermediate', callback_data: 'level_intermediate' }],
    [{ text: '🌳 Advanced', callback_data: 'level_advanced' }],
  ],
};

function mainMenuKeyboard(webappUrl: string) {
  return {
    keyboard: [
      [{ text: '📝 Latihan Tes', web_app: { url: `${webappUrl}/test` } }],
      [
        { text: '📖 Belajar' },
        { text: '🩺 Diagnostic' },
      ],
      [
        { text: '📊 Progress', web_app: { url: `${webappUrl}/progress` } },
        { text: '📅 Hari Ini' },
      ],
    ],
    resize_keyboard: true,
    is_persistent: true,
  };
}

function studyTopicKeyboard() {
  return {
    inline_keyboard: [
      [{ text: '📖 Pelajaran Hari Ini', callback_data: 'study_lesson' }],
      [
        { text: '🏋️ Drill', callback_data: 'study_drill' },
        { text: '🧠 Mini Test', callback_data: 'study_minitest' },
      ],
      // Grammar
      [
        { text: '📝 Articles', callback_data: 'lesson_articles' },
        { text: '⏰ Tenses', callback_data: 'lesson_tenses' },
      ],
      [
        { text: '🔗 Prepositions', callback_data: 'lesson_prepositions' },
        { text: '✅ S-V Agreement', callback_data: 'lesson_sv_agreement' },
      ],
      [
        { text: '🔄 Passive Voice', callback_data: 'lesson_passive_voice' },
        { text: '❓ Conditionals', callback_data: 'lesson_conditionals' },
      ],
      [
        { text: '👥 Relative Clause', callback_data: 'lesson_relative_clauses' },
        { text: '🧩 Word Formation', callback_data: 'lesson_word_formation' },
      ],
      // Vocabulary
      [
        { text: '📚 Kata Hari Ini', callback_data: 'lesson_word_of_day' },
        { text: '🎯 Academic Words', callback_data: 'lesson_academic_words' },
      ],
      [
        { text: '🤝 Collocations', callback_data: 'lesson_collocations' },
        { text: '♻️ Paraphrasing', callback_data: 'lesson_paraphrasing' },
      ],
      // Strategies
      [
        { text: '👁 Reading Tips', callback_data: 'lesson_reading_strategy' },
        { text: '👂 Listening Tips', callback_data: 'lesson_listening_strategy' },
      ],
      // Speaking & Writing
      [
        { text: '🗣 Template Speaking', callback_data: 'lesson_speaking_templates' },
        { text: '✍️ Template Writing', callback_data: 'lesson_writing_templates' },
      ],
      [
        { text: '🔊 Pronunciation', callback_data: 'lesson_pronunciation' },
        { text: '🔗 Linking Words', callback_data: 'lesson_linking_words' },
      ],
      // Engagement
      [
        { text: '🎯 Daily Challenge', callback_data: 'study_challenge' },
        { text: '📊 Score Estimator', callback_data: 'study_score' },
      ],
      [{ text: '❓ Tanya Bebas', callback_data: 'study_ask' }],
    ],
  };
}

function adminKeyboard(webappUrl: string) {
  return {
    keyboard: [
      [{ text: '📋 Manage Content', web_app: { url: `${webappUrl}/admin/content` } }],
      [{ text: '👥 Students', web_app: { url: `${webappUrl}/admin/students` } }],
      [{ text: '📖 Belajar' }],
    ],
    resize_keyboard: true,
  };
}

export async function handleWebhook(update: any, env: Env) {
  // Pre-checkout query — must respond OK for Telegram Payments
  if (update.pre_checkout_query) {
    await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/answerPreCheckoutQuery`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pre_checkout_query_id: update.pre_checkout_query.id, ok: true }),
    });
    return;
  }

  try {
    if (update.message) {
      // Handle payment events
      if (update.message.successful_payment) {
        const payment = update.message.successful_payment;
        const chatId = update.message.chat.id;
        const userId = parseInt(payment.invoice_payload.split('_')[1] || '0');
        if (userId > 0) {
          // Activate premium for 30 days
          const until = new Date(Date.now() + 30 * 86400000).toISOString();
          await env.DB.prepare('UPDATE user_gamification SET is_premium = 1, premium_until = ? WHERE user_id = ?')
            .bind(until, userId).run();
          await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: chatId, text: 'Premium aktif! Kamu sekarang punya akses unlimited selama 30 hari.' }),
          });
        }
        return;
      }

      // Handle voice messages — transcribe with Whisper then process as text
      if (update.message.voice || update.message.audio) {
        await handleVoiceMessage(update.message, env);
      } else {
        await handleMessage(update.message, env);
      }
    } else if (update.callback_query) {
      await handleCallbackQuery(update.callback_query, env);
    }
  } catch (e: any) {
    console.error('Webhook error:', e);
    // Try to notify user of error
    const chatId = update.message?.chat?.id || update.callback_query?.message?.chat?.id;
    if (chatId) {
      try {
        await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: chatId, text: `Error: ${e.message || 'unknown'}` }),
        });
      } catch {}
    }
  }
}

async function handleVoiceMessage(message: any, env: Env) {
  const chatId = message.chat.id;
  const tgUser = message.from;
  if (!tgUser) return;

  const user = await getOrCreateUser(env, tgUser);
  const voice = message.voice || message.audio;
  const fileId = voice.file_id;

  try {
    // Get file URL from Telegram
    const fileResp = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/getFile?file_id=${fileId}`);
    const fileData: any = await fileResp.json();
    const filePath = fileData.result?.file_path;
    if (!filePath) { await sendMessage(env, chatId, 'Gagal memproses audio.'); return; }

    // Download the file
    const audioResp = await fetch(`https://api.telegram.org/file/bot${env.TELEGRAM_BOT_TOKEN}/${filePath}`);
    const audioBytes = await audioResp.arrayBuffer();

    // Transcribe with Whisper
    const formData = new FormData();
    formData.append('file', new Blob([audioBytes], { type: 'audio/ogg' }), 'voice.ogg');
    formData.append('model', 'whisper-1');
    formData.append('response_format', 'text');

    const whisperResp = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${env.OPENAI_API_KEY}` },
      body: formData,
    });

    const transcription = (await whisperResp.text()).trim();

    if (!transcription || transcription.length < 2) {
      await sendMessage(env, chatId, 'Tidak terdeteksi suara. Coba kirim ulang.');
      return;
    }

    // Show what was heard
    await sendMessage(env, chatId, `Aku dengar: "${transcription}"`);

    // Log cost
    try {
      const duration = (voice.duration || 5) / 60;
      await env.DB.prepare('INSERT INTO api_usage (service, endpoint, tokens_used, cost_usd, user_id) VALUES (?, ?, ?, ?, ?)')
        .bind('openai-whisper', 'voice-input', voice.duration || 5, duration * 0.006, user.id).run();
    } catch {}

    // Process as text message
    message.text = transcription;
    await handleMessage(message, env);
  } catch (e: any) {
    await sendMessage(env, chatId, 'Gagal memproses voice message: ' + (e.message || ''));
  }
}

async function handleMessage(message: any, env: Env) {
  const chatId = message.chat.id;
  const text = message.text || '';
  const tgUser = message.from;

  if (!tgUser) return;

  const user = await getOrCreateUser(env, tgUser);
  const isGroup = message.chat.type === 'group' || message.chat.type === 'supergroup';
  const groupChatId = isGroup ? String(chatId) : null;

  // --- GROUP MESSAGE HANDLING ---
  if (isGroup) {
    // /addclass — teacher links group to class
    if (text.startsWith('/addclass')) {
      if (user.role !== 'teacher' && user.role !== 'admin') {
        await sendMessage(env, chatId, 'Hanya guru yang bisa menambahkan kelas.');
        return;
      }
      // Find teacher's class without group
      const cls = await env.DB.prepare(
        'SELECT * FROM classes WHERE teacher_id = ? AND group_chat_id IS NULL AND is_active = 1 ORDER BY created_at DESC LIMIT 1'
      ).bind(user.id).first() as any;
      if (!cls) {
        await sendMessage(env, chatId, 'Kamu belum punya kelas. Buat dulu via /admin di chat private.');
        return;
      }
      await env.DB.prepare('UPDATE classes SET group_chat_id = ? WHERE id = ?').bind(groupChatId, cls.id).run();
      await sendMessage(env, chatId, `Grup ini terhubung ke kelas "${cls.name}"!\n\nAku akan kirim quiz harian dan leaderboard mingguan di sini.`);
      return;
    }

    // /leaderboard — show current week
    if (text === '/leaderboard') {
      const { postWeeklyLeaderboard } = await import('../services/classroom');
      await postWeeklyLeaderboard(env);
      return;
    }

    // /checkin — attendance
    if (text === '/checkin') {
      await sendMessage(env, chatId, `${user.name} hadir! ${new Date().toLocaleDateString('id-ID')}`);
      return;
    }

    // Check if it's a quiz answer (single letter a-d)
    if (/^[a-d]$/i.test(text.trim())) {
      const { handleGroupQuizAnswer } = await import('../services/classroom');
      const result = await handleGroupQuizAnswer(env, groupChatId!, user.id, user.name, text.trim());
      if (result) {
        if (result.correct && result.first) {
          await sendMessage(env, chatId, `${result.userName} jawab benar PERTAMA! +5 bonus poin!`);
        } else if (result.correct) {
          await sendMessage(env, chatId, `${result.userName} juga benar!`);
        }
      }
      return;
    }

    // Check if it's an English response to discussion (longer text)
    if (text.length > 20 && /[a-zA-Z]/.test(text) && !text.startsWith('/')) {
      const { correctGrammarInGroup } = await import('../services/classroom');
      const correction = await correctGrammarInGroup(env, text);
      if (correction) {
        await sendMessage(env, chatId, `@${tgUser.username || user.name}:\n${correction}`);
      }
      return;
    }

    // Ignore other group messages
    return;
  }

  // --- PRIVATE CHAT HANDLING (existing code below) ---

  // Command handling
  if (text.startsWith('/')) {
    const command = text.split(' ')[0].split('@')[0];

    switch (command) {
      case '/start': {
        if (user.onboarding_complete) {
          await sendMessage(env, chatId,
            `Halo lagi, ${user.name}! 👋\n\nMau ngapain hari ini?`,
            mainMenuKeyboard(env.WEBAPP_URL),
          );
        } else {
          await sendMessage(env, chatId,
            `Halo ${tgUser.first_name}! 👋\n\n` +
            `Selamat datang di OSEE — Personal TOEFL iBT & IELTS Tutor.\n\n` +
            `Aku di sini buat bantu kamu persiapan tes bahasa Inggris. ` +
            `Nggak kaku, nggak boring — langsung praktek.\n\n` +
            `Pertama, kamu mau persiapan tes yang mana?`,
            testTypeKeyboard,
          );
        }
        return;
      }

      case '/help': {
        let helpText = `Perintah yang tersedia:\n\n` +
          `/start — Menu utama\n` +
          `/study — Belajar (22 topik)\n` +
          `/diagnostic — Tes penempatan\n` +
          `/today — Pelajaran hari ini\n` +
          `/review — Review soal salah\n` +
          `/settings — Ubah target & level\n` +
          `/join KODE — Gabung kelas\n` +
          `/challenge @user — Duel\n` +
          `/role — Profil + XP + badges\n` +
          `/referral — Kode referral kamu\n` +
          `/refer KODE — Pakai kode referral\n` +
          `/certificate — Sertifikat latihan\n` +
          `/tos — Syarat & ketentuan\n` +
          `/premium — Upgrade ke Premium\n` +
          `/help — Pesan ini\n\n` +
          `Kamu juga bisa kirim voice message — aku transkripsi dan jawab!`;

        if (user.role === 'teacher' || user.role === 'admin') {
          helpText += `\n\nGuru:\n` +
            `/admin — Panel guru\n` +
            `/broadcast — Kirim ke semua siswa\n` +
            `/addclass — Hubungkan grup ke kelas`;
        }
        if (user.role === 'admin') {
          helpText += `\n\nAdmin:\n` +
            `/promote @user role — Ubah role\n` +
            `/teacher KODE — Jadi guru\n` +
            `/stats — Statistik sistem\n` +
            `/setteachercode — Info kode guru`;
        }

        helpText += `\n\nRole kamu: ${user.role}`;
        await sendMessage(env, chatId, helpText);
        return;
      }

      case '/settings':
        await sendMessage(env, chatId, 'Pengaturan', {
          inline_keyboard: [
            [
              { text: '🇺🇸 TOEFL iBT', callback_data: 'setting_test_TOEFL_IBT' },
              { text: '🇬🇧 IELTS', callback_data: 'setting_test_IELTS' },
            ],
            [
              { text: '🌱 Beginner', callback_data: 'setting_level_beginner' },
              { text: '🌿 Intermediate', callback_data: 'setting_level_intermediate' },
              { text: '🌳 Advanced', callback_data: 'setting_level_advanced' },
            ],
          ],
        });
        return;

      case '/study':
        await sendMessage(env, chatId, 'Mau belajar apa?', studyTopicKeyboard());
        return;

      case '/review': {
        const { getDueReviews, getReviewStats } = await import('../services/spaced-repetition');
        const stats = await getReviewStats(env, user.id);
        if (stats.due === 0) {
          await sendMessage(env, chatId, `Tidak ada review yang perlu dikerjakan sekarang.\n\nTotal item: ${stats.total} | Sudah dikuasai: ${stats.mastered}\n\nReview berikutnya akan muncul otomatis.`);
        } else {
          const items = await getDueReviews(env, user.id, 1);
          if (items.length > 0) {
            const item = items[0] as any;
            const data = JSON.parse(item.question_data || '{}');
            await sendMessage(env, chatId, `Review (${stats.due} item tersisa)\n\nSection: ${item.section}\nKamu jawab: ${item.student_answer}\nJawaban benar: ${item.correct_answer}\n\nApakah kamu sudah paham sekarang? Ketik "ya" atau "belum"`);
          }
        }
        return;
      }

      case '/test':
        await sendMessage(env, chatId,
          '📝 Tap tombol "Latihan Tes" di keyboard bawah untuk mulai latihan.\n\nAtau ketik /study untuk belajar dulu.',
          mainMenuKeyboard(env.WEBAPP_URL),
        );
        return;

      case '/progress':
        await sendMessage(env, chatId,
          '📊 Tap tombol "Progress" di keyboard bawah untuk lihat perkembangan kamu.',
          mainMenuKeyboard(env.WEBAPP_URL),
        );
        return;

      case '/diagnostic': {
        const { startDiagnostic } = await import('../services/diagnostic');
        const intro = await startDiagnostic(env, user.id);
        await sendMessage(env, chatId, intro);
        return;
      }

      case '/today': {
        const { getTodayLesson } = await import('../services/studyplan');
        const lesson = await getTodayLesson(env, user.id);
        await sendMessage(env, chatId, lesson || 'Belum ada study plan. Ketik /diagnostic dulu untuk tes penempatan.');
        return;
      }

      case '/join': {
        const code = (text.split(' ')[1] || '').trim();
        if (!code) {
          await sendMessage(env, chatId, 'Ketik: /join KODE_KELAS\n\nContoh: /join ABC123');
          return;
        }
        try {
          const cls = await env.DB.prepare('SELECT * FROM classes WHERE invite_code = ? AND is_active = 1').bind(code.toUpperCase()).first() as any;
          if (!cls) {
            await sendMessage(env, chatId, 'Kode kelas tidak ditemukan. Pastikan kode yang kamu masukkan benar.');
            return;
          }
          const existing = await env.DB.prepare('SELECT id FROM class_enrollments WHERE user_id = ? AND class_id = ?').bind(user.id, cls.id).first();
          if (existing) {
            await sendMessage(env, chatId, `Kamu sudah terdaftar di kelas "${cls.name}".`);
            return;
          }
          await env.DB.prepare('INSERT INTO class_enrollments (user_id, class_id) VALUES (?, ?)').bind(user.id, cls.id).run();
          await sendMessage(env, chatId, `Berhasil bergabung ke kelas "${cls.name}"!`);
        } catch (e: any) {
          await sendMessage(env, chatId, 'Gagal bergabung: ' + (e.message || 'unknown'));
        }
        return;
      }

      case '/challenge': {
        // /challenge @username
        const target = (text.split(' ')[1] || '').replace('@', '').trim();
        if (!target) {
          await sendMessage(env, chatId, 'Ketik: /challenge @username\n\nContoh: /challenge @budi');
          return;
        }
        const opponent = await env.DB.prepare('SELECT * FROM users WHERE username = ?').bind(target).first() as any;
        if (!opponent) {
          await sendMessage(env, chatId, `User @${target} tidak ditemukan. Pastikan mereka sudah pernah pakai bot ini.`);
          return;
        }
        if (opponent.id === user.id) {
          await sendMessage(env, chatId, 'Nggak bisa challenge diri sendiri!');
          return;
        }
        try {
          const { createChallenge } = await import('../services/classroom');
          const ch = await createChallenge(env, user.id, opponent.id, null);
          const questions = ch.questions;
          // Send first question to challenger
          let msg = `Challenge vs @${target}!\n\n5 soal. Jawab semua, lalu lawanmu juga.\n\nSoal 1:\n${questions[0].q}`;
          await sendMessage(env, chatId, msg);
          // Notify opponent
          const oppTgId = parseInt(String(opponent.telegram_id).replace('.0', ''));
          await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: oppTgId, text: `${user.name} menantang kamu! Ketik /accept ${ch.challengeId} untuk terima.` }),
          });
        } catch (e: any) {
          await sendMessage(env, chatId, 'Gagal membuat challenge: ' + (e.message || ''));
        }
        return;
      }

      case '/admin':
        if (user.role !== 'teacher' && user.role !== 'admin') {
          await sendMessage(env, chatId, '⛔ Teachers and admins only.');
          return;
        }
        await sendMessage(env, chatId, '🏫 Admin Panel', adminKeyboard(env.WEBAPP_URL));
        return;

      case '/broadcast': {
        if (user.role !== 'teacher' && user.role !== 'admin') {
          await sendMessage(env, chatId, '⛔ Teachers and admins only.');
          return;
        }
        const msg = text.replace('/broadcast', '').trim();
        if (!msg) {
          await sendMessage(env, chatId, 'Usage: /broadcast <message>');
          return;
        }
        await sendMessage(env, chatId, `📢 Broadcast sent: ${msg}`);
        return;
      }

      // --- ROLE MANAGEMENT ---
      case '/teacher': {
        const code = (text.split(' ')[1] || '').trim();
        if (!code) {
          await sendMessage(env, chatId, 'Ketik: /teacher KODE_GURU\n\nMinta kode ke admin.');
          return;
        }
        if (code !== env.TEACHER_CODE) {
          await sendMessage(env, chatId, 'Kode salah. Minta kode yang benar ke admin.');
          return;
        }
        if (user.role === 'teacher' || user.role === 'admin') {
          await sendMessage(env, chatId, 'Kamu sudah menjadi guru/admin.');
          return;
        }
        await env.DB.prepare('UPDATE users SET role = ? WHERE id = ?').bind('teacher', user.id).run();
        await sendMessage(env, chatId, 'Selamat! Kamu sekarang terdaftar sebagai Guru.\n\nKetik /admin untuk buka panel guru.');
        return;
      }

      case '/promote': {
        if (user.role !== 'admin') {
          await sendMessage(env, chatId, '⛔ Hanya admin yang bisa promote user.');
          return;
        }
        const parts = text.split(' ');
        const targetName = (parts[1] || '').replace('@', '').trim();
        const targetRole = (parts[2] || '').trim().toLowerCase();
        if (!targetName || !['teacher', 'admin', 'student'].includes(targetRole)) {
          await sendMessage(env, chatId, 'Ketik: /promote @username teacher\nAtau: /promote @username admin\nAtau: /promote @username student');
          return;
        }
        const target = await env.DB.prepare('SELECT * FROM users WHERE username = ?').bind(targetName).first() as any;
        if (!target) {
          await sendMessage(env, chatId, `User @${targetName} tidak ditemukan.`);
          return;
        }
        await env.DB.prepare('UPDATE users SET role = ? WHERE id = ?').bind(targetRole, target.id).run();
        await sendMessage(env, chatId, `@${targetName} sekarang menjadi ${targetRole}.`);
        // Notify the promoted user
        const tgId = parseInt(String(target.telegram_id).replace('.0', ''));
        await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: tgId, text: `Role kamu diubah menjadi: ${targetRole} oleh admin.` }),
        });
        return;
      }

      case '/setteachercode': {
        if (user.role !== 'admin') {
          await sendMessage(env, chatId, '⛔ Hanya admin.');
          return;
        }
        await sendMessage(env, chatId, `Kode guru saat ini dikelola via environment variable.\n\nUntuk mengubah, jalankan:\nwrangler secret put TEACHER_CODE`);
        return;
      }

      case '/stats': {
        if (user.role !== 'admin') {
          await sendMessage(env, chatId, '⛔ Hanya admin.');
          return;
        }
        const userCount = await env.DB.prepare('SELECT COUNT(*) as c FROM users').first() as any;
        const questionCount = await env.DB.prepare('SELECT COUNT(*) as c FROM test_contents').first() as any;
        const attemptCount = await env.DB.prepare("SELECT COUNT(*) as c FROM test_attempts WHERE status = 'completed'").first() as any;
        const answerCount = await env.DB.prepare('SELECT COUNT(*) as c FROM attempt_answers').first() as any;
        const costTotal = await env.DB.prepare('SELECT SUM(cost_usd) as c FROM api_usage').first() as any;
        const teachers = await env.DB.prepare("SELECT COUNT(*) as c FROM users WHERE role = 'teacher'").first() as any;
        const classes = await env.DB.prepare('SELECT COUNT(*) as c FROM classes').first() as any;

        await sendMessage(env, chatId,
          `Statistik EduBot\n\n` +
          `Pengguna: ${userCount?.c || 0} (${teachers?.c || 0} guru)\n` +
          `Kelas: ${classes?.c || 0}\n` +
          `Soal di database: ${questionCount?.c || 0}\n` +
          `Tes selesai: ${attemptCount?.c || 0}\n` +
          `Jawaban total: ${answerCount?.c || 0}\n` +
          `Biaya API total: $${(costTotal?.c || 0).toFixed(4)}`
        );
        return;
      }

      case '/role': {
        const { getOrCreateGamification, formatLevel, formatBadges } = await import('../services/commercial');
        const gam = await getOrCreateGamification(env, user.id);
        const badges = JSON.parse(gam.badges || '[]');
        let msg = `Role: ${user.role}\n${formatLevel(gam.level || 1, gam.xp || 0)}\nXP: ${gam.xp || 0}\nSoal total: ${gam.total_questions || 0}`;
        if (badges.length > 0) msg += `\nBadges: ${formatBadges(badges)}`;
        if (gam.referral_code) msg += `\n\nKode referral kamu: ${gam.referral_code}\nBagikan ke teman untuk dapat bonus XP!`;
        await sendMessage(env, chatId, msg);
        return;
      }

      case '/referral': {
        const { getOrCreateGamification } = await import('../services/commercial');
        const g = await getOrCreateGamification(env, user.id);
        await sendMessage(env, chatId,
          `Kode referral kamu: ${g.referral_code}\n\n` +
          `Bagikan ke teman! Kalau mereka daftar pakai kode kamu:\n` +
          `- Kamu dapat +100 XP\n` +
          `- Teman dapat +50 XP\n\n` +
          `Referral berhasil: ${g.referral_count || 0} orang\n\n` +
          `Caranya: teman ketik /refer ${g.referral_code} saat pertama kali pakai bot.`
        );
        return;
      }

      case '/refer': {
        const code = (text.split(' ')[1] || '').trim();
        if (!code) {
          await sendMessage(env, chatId, 'Ketik: /refer KODE_REFERRAL');
          return;
        }
        const { processReferral } = await import('../services/commercial');
        const result = await processReferral(env, user.id, code);
        if (result) {
          await sendMessage(env, chatId, 'Referral berhasil! Kamu dapat +50 XP bonus.');
        } else {
          await sendMessage(env, chatId, 'Kode referral tidak valid atau sudah digunakan.');
        }
        return;
      }

      case '/certificate': {
        // Show last test result as certificate
        const lastResult = await env.DB.prepare(
          "SELECT tr.*, ta.test_type FROM test_results tr JOIN test_attempts ta ON tr.attempt_id=ta.id WHERE ta.user_id=? ORDER BY tr.created_at DESC LIMIT 1"
        ).bind(user.id).first() as any;
        if (!lastResult) {
          await sendMessage(env, chatId, 'Belum ada tes yang selesai. Kerjakan tes dulu untuk dapat sertifikat.');
          return;
        }
        const { generateCertificate } = await import('../services/commercial');
        const cert = await generateCertificate(env, user.id, user.name, lastResult.test_type, lastResult.total_score, lastResult.band_score || lastResult.total_score);
        await sendMessage(env, chatId, cert);
        return;
      }

      case '/tos': {
        const { TERMS_OF_SERVICE, acceptToS } = await import('../services/commercial');
        await acceptToS(env, user.id);
        await sendMessage(env, chatId, TERMS_OF_SERVICE);
        return;
      }

      case '/premium': {
        // Send Telegram Stars invoice
        try {
          await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendInvoice`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: chatId,
              title: 'EduBot Premium — 1 Bulan',
              description: 'Unlimited soal, Speaking evaluation, Study plan, Sertifikat, tanpa iklan.',
              payload: `premium_${user.id}_monthly`,
              currency: 'XTR', // Telegram Stars
              prices: [{ label: 'Premium 1 Bulan', amount: 150 }], // 150 Stars
            }),
          });
        } catch {
          await sendMessage(env, chatId, 'Pembayaran via Telegram Stars belum tersedia di platform kamu. Hubungi WA +62 811-2647-784 untuk upgrade.');
        }
        return;
      }
    }
  }

  // Free text — handle keyboard button texts and AI tutoring
  if (!user.onboarding_complete) {
    await sendMessage(env, chatId, 'Ketik /start dulu ya buat setup awal. Cuma sebentar kok!');
    return;
  }

  // Check if diagnostic session is active
  const diagSession = await env.DB.prepare(
    "SELECT id FROM diagnostic_sessions WHERE user_id = ? AND status = 'in_progress' AND created_at > datetime('now', '-30 minutes')"
  ).bind(user.id).first();

  if (diagSession) {
    // Handle "mulai" to start questions
    if (text.toLowerCase() === 'mulai') {
      const { getNextQuestion } = await import('../services/diagnostic');
      const next = await getNextQuestion(env, user.id);
      if (!next.done) {
        // Send TTS audio if it's a listening question
        if (next.audioText) {
          await sendTTSAudio(env, chatId, next.audioText);
        }
        await sendMessage(env, chatId, next.question);
      }
      return;
    }

    // Handle diagnostic answer
    const { submitAnswer, formatResults } = await import('../services/diagnostic');
    const result = await submitAnswer(env, user.id, text);

    // Send feedback
    await sendMessage(env, chatId, result.feedback);

    if (result.done && result.results) {
      // Send final results
      await sendMessage(env, chatId, formatResults(result.results));
    } else if (result.nextQuestion) {
      // Send TTS audio if next question is listening
      if (result.nextAudioText) {
        await sendTTSAudio(env, chatId, result.nextAudioText);
      }
      // Send next question
      await sendMessage(env, chatId, result.nextQuestion);
    }
    return;
  }

  // Check if user is providing a target date for study plan
  const recentDiag = await env.DB.prepare(
    "SELECT * FROM diagnostic_results WHERE user_id = ? ORDER BY created_at DESC LIMIT 1"
  ).bind(user.id).first() as any;

  const hasStudyPlan = await env.DB.prepare(
    "SELECT id FROM study_plans WHERE user_id = ? AND status = 'active'"
  ).bind(user.id).first();

  if (recentDiag && !hasStudyPlan) {
    // Check if user is sending a date
    const datePatterns = /(\d{1,2}\s*(bulan|minggu|hari)|januari|februari|maret|april|mei|juni|juli|agustus|september|oktober|november|desember|\d{1,2}[\/\-]\d{1,2})/i;
    if (datePatterns.test(text)) {
      // Parse rough date
      let targetDate: Date;
      const now = new Date();

      if (/(\d+)\s*bulan/i.test(text)) {
        const months = parseInt(text.match(/(\d+)\s*bulan/i)![1]);
        targetDate = new Date(now.getTime() + months * 30 * 24 * 60 * 60 * 1000);
      } else if (/(\d+)\s*minggu/i.test(text)) {
        const weeks = parseInt(text.match(/(\d+)\s*minggu/i)![1]);
        targetDate = new Date(now.getTime() + weeks * 7 * 24 * 60 * 60 * 1000);
      } else if (/(\d+)\s*hari/i.test(text)) {
        const days = parseInt(text.match(/(\d+)\s*hari/i)![1]);
        targetDate = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
      } else {
        // Default 2 months
        targetDate = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000);
      }

      const weaknesses = JSON.parse(recentDiag.weaknesses || '[]');
      const { generateStudyPlan } = await import('../services/studyplan');
      const plan = await generateStudyPlan(env, user.id, targetDate.toISOString(), weaknesses);
      await sendMessage(env, chatId, plan);
      return;
    }
  }

  // Handle keyboard buttons
  if (text === '📖 Belajar') {
    await sendMessage(env, chatId, 'Mau belajar apa?', studyTopicKeyboard());
    return;
  }

  if (text === '🩺 Diagnostic' || text.toLowerCase() === 'diagnostic' || text === '/diagnostic') {
    try {
      const { startDiagnostic } = await import('../services/diagnostic');
      const intro = await startDiagnostic(env, user.id);
      await sendMessage(env, chatId, intro);
    } catch (e: any) {
      await sendMessage(env, chatId, 'Error starting diagnostic: ' + (e.message || 'unknown'));
    }
    return;
  }

  if (text === '📅 Hari Ini' || text.toLowerCase() === 'hari ini' || text === '/today') {
    try {
      const { getTodayLesson } = await import('../services/studyplan');
      const lesson = await getTodayLesson(env, user.id);
      await sendMessage(env, chatId, lesson || 'Belum ada study plan. Tap "Diagnostic" dulu untuk tes penempatan.');
    } catch (e: any) {
      await sendMessage(env, chatId, 'Error: ' + (e.message || 'unknown'));
    }
    return;
  }

  const response = await getTutorResponse(env, user, text);
  await sendMessage(env, chatId, response);
}

async function handleCallbackQuery(query: any, env: Env) {
  const chatId = query.message?.chat?.id;
  const messageId = query.message?.message_id;
  const data = query.data;
  const tgUser = query.from;

  if (!chatId || !data || !tgUser) return;

  // Acknowledge callback
  await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/answerCallbackQuery`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ callback_query_id: query.id }),
  });

  const user = await getOrCreateUser(env, tgUser);

  // Settings changes
  if (data.startsWith('setting_test_')) {
    const test = data.replace('setting_test_', '');
    await env.DB.prepare('UPDATE users SET target_test = ? WHERE id = ?').bind(test, user.id).run();
    await editMessage(env, chatId, messageId, `Target tes diubah ke: ${test}`);
    return;
  }
  if (data.startsWith('setting_level_')) {
    const level = data.replace('setting_level_', '');
    await env.DB.prepare('UPDATE users SET proficiency_level = ? WHERE id = ?').bind(level, user.id).run();
    await editMessage(env, chatId, messageId, `Level diubah ke: ${level}`);
    return;
  }

  // Onboarding: target test
  if (data.startsWith('target_')) {
    const target = data.replace('target_', '');
    if (target !== 'skip') {
      await env.DB.prepare('UPDATE users SET target_test = ? WHERE id = ?').bind(target, user.id).run();
    }
    await editMessage(env, chatId, messageId,
      'Oke, noted! Sekarang, kira-kira level bahasa Inggris kamu sekarang gimana?',
      proficiencyKeyboard,
    );
    return;
  }

  // Onboarding: proficiency level
  if (data.startsWith('level_')) {
    const level = data.replace('level_', '');
    await env.DB.prepare(
      'UPDATE users SET proficiency_level = ?, onboarding_complete = 1 WHERE id = ?'
    ).bind(level, user.id).run();

    // Remove old inline keyboard
    await editMessage(env, chatId, messageId,
      `✅ Level: ${level}`,
    );

    // Send new message with web_app buttons (editMessage doesn't support web_app buttons)
    await sendMessage(env, chatId,
      '🎉 Siap! Kamu udah terdaftar.\n\n' +
      'Yang bisa kamu lakuin sekarang:\n' +
      '📝 Latihan tes — simulasi TOEFL iBT format 2026\n' +
      '📖 Belajar — pelajaran grammar, vocab, dan drill latihan\n' +
      '📊 Lihat progress — tracking skor dan skill kamu\n\n' +
      'Mau mulai dari mana?',
      mainMenuKeyboard(env.WEBAPP_URL),
    );
    return;
  }

  // Study topics
  if (data.startsWith('study_') || data.startsWith('lesson_')) {
    const freshUser = await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(user.id).first() as User;

    if (data === 'study_ask') {
      await editMessage(env, chatId, messageId, '❓ Ketik pertanyaan kamu, nanti aku bantu jawab!');
      return;
    }

    // Lesson topics — check prerequisites first, then use teaching engine
    if (data.startsWith('lesson_')) {
      const weakness = data.replace('lesson_', '');

      // Check prerequisites
      try {
        const { checkPrerequisites, formatPrereqWarning, LESSON_TO_SKILL } = await import('../services/prerequisites');
        const skill = LESSON_TO_SKILL[weakness] || weakness;
        const prereq = await checkPrerequisites(env, freshUser.id, skill);

        if (!prereq.ready) {
          // Student missing prerequisites — suggest matriculation
          const warning = formatPrereqWarning(skill, prereq.missingLabels);
          await editMessage(env, chatId, messageId, warning, {
            inline_keyboard: [
              [{ text: `Ajarkan ${prereq.missingLabels[0]}`, callback_data: `lesson_${prereq.missing[0]}` }],
              [{ text: 'Lanjut saja', callback_data: `force_${weakness}` }],
            ],
          });
          return;
        }
      } catch {}

      await editMessage(env, chatId, messageId, '⏳ Sedang menyiapkan pelajaran...');

      const { generateLesson } = await import('../services/teaching');
      const lesson = await generateLesson(env, freshUser, weakness);
      await sendMessage(env, chatId, lesson);

      // For pronunciation lessons, send audio examples
      if (weakness === 'pronunciation') {
        await sendTTSAudio(env, chatId, 'think. this. very. walked. needed. played.');
      }

      await saveToHistory(env, freshUser.id, `Pelajari topik: ${weakness}`, lesson);
      return;
    }

    // Force lesson (skip prerequisites)
    if (data.startsWith('force_')) {
      const weakness = data.replace('force_', '');
      await editMessage(env, chatId, messageId, '⏳ Sedang menyiapkan pelajaran...');

      const { generateLesson } = await import('../services/teaching');
      const lesson = await generateLesson(env, freshUser, weakness);
      await sendMessage(env, chatId, lesson);
      await saveToHistory(env, freshUser.id, `Pelajari topik: ${weakness}`, lesson);
      return;
    }

    // Quick drill
    if (data === 'study_drill') {
      await editMessage(env, chatId, messageId, '⏳ Membuat drill latihan...');

      const { generateDrill } = await import('../services/teaching');
      const drill = await generateDrill(env, freshUser, 'grammar', 'mixed');
      await sendMessage(env, chatId, drill);
      await saveToHistory(env, freshUser.id, 'Drill grammar', drill);
      return;
    }

    // Quiz — pick random weakness and generate quick quiz
    if (data === 'study_quiz') {
      await editMessage(env, chatId, messageId, '⏳ Membuat kuis...');

      const weaknesses = ['articles', 'sv_agreement', 'tenses', 'prepositions'];
      const randomWeak = weaknesses[Math.floor(Math.random() * weaknesses.length)];
      const { generateDrill } = await import('../services/teaching');
      const quiz = await generateDrill(env, freshUser, randomWeak, 'quick_quiz');
      await sendMessage(env, chatId, quiz);
      await saveToHistory(env, freshUser.id, `Kuis ${randomWeak}`, quiz);
      return;
    }

    // General study session
    if (data === 'study_lesson' || data === 'study_start') {
      await editMessage(env, chatId, messageId, '⏳ Menyiapkan pelajaran...');
      const prompt = `Pilih 1 topik (articles/tenses/prepositions/sv-agreement/passive-voice/conditionals). Kasih perbandingan Bahasa vs English (2 baris), 3 contoh kalimat, lalu 1 soal. Maks 8 baris. Plain text.`;
      const response = await getTutorResponse(env, freshUser, prompt);
      await sendMessage(env, chatId, response);
      return;
    }

    // Mini Mock Test — 5 random questions from different sections
    if (data === 'study_minitest') {
      await editMessage(env, chatId, messageId, '⏳ Membuat mini test...');
      const prompt = `Buat 1 soal TOEFL iBT (pilih acak: grammar/vocabulary/reading comprehension). Format: konteks singkat + 1 soal MCQ (A/B/C/D). Maks 8 baris. Plain text. Akhiri dengan "Jawab?"`;
      const response = await getTutorResponse(env, freshUser, prompt);
      await sendMessage(env, chatId, response);
      return;
    }

    // Daily Challenge
    if (data === 'study_challenge') {
      // Count today's answers
      const today = new Date().toISOString().split('T')[0];
      const todayCount = await env.DB.prepare(
        `SELECT COUNT(*) as count FROM attempt_answers aa
         JOIN test_attempts ta ON aa.attempt_id = ta.id
         WHERE ta.user_id = ? AND aa.submitted_at >= ?`
      ).bind(freshUser.id, today).first() as any;
      const count = todayCount?.count || 0;
      const target = 10;

      let msg = '';
      if (count >= target) {
        msg = `Target hari ini tercapai! Kamu sudah jawab ${count} soal hari ini. Keren!\n\nMau lanjut? Pilih topik di bawah:`;
      } else {
        msg = `Challenge hari ini: jawab ${target} soal.\n\nProgress: ${count}/${target} ${'🟩'.repeat(Math.min(count, target))}${'⬜'.repeat(Math.max(0, target - count))}\n\nTinggal ${target - count} lagi! Pilih topik:`;
      }
      await editMessage(env, chatId, messageId, msg, studyTopicKeyboard());
      return;
    }

    // Score Estimator
    if (data === 'study_score') {
      const stats = await env.DB.prepare(
        `SELECT section, COUNT(*) as total,
         SUM(CASE WHEN is_correct = 1 THEN 1 ELSE 0 END) as correct
         FROM attempt_answers aa
         JOIN test_attempts ta ON aa.attempt_id = ta.id
         WHERE ta.user_id = ?
         GROUP BY section`
      ).bind(freshUser.id).all();

      if (!stats.results.length) {
        await editMessage(env, chatId, messageId, 'Belum ada data latihan. Kerjakan beberapa soal dulu, nanti aku estimasi skor kamu.');
        return;
      }

      let msg = 'Estimasi Band Score kamu:\n\n';
      let totalAcc = 0;
      let sections = 0;
      for (const s of stats.results as any[]) {
        const acc = s.total > 0 ? Math.round((s.correct / s.total) * 100) : 0;
        const band = Math.min(6, Math.max(1, Math.round((acc / 100) * 6 * 2) / 2));
        const emoji = acc >= 67 ? '🟢' : acc >= 50 ? '🟡' : '🔴';
        msg += `${emoji} ${s.section}: Band ${band} (${acc}% dari ${s.total} soal)\n`;
        totalAcc += acc;
        sections++;
      }
      const avgBand = Math.min(6, Math.max(1, Math.round((totalAcc / sections / 100) * 6 * 2) / 2));
      msg += `\nEstimasi total: Band ${avgBand}\nTarget: Band 4\n`;
      msg += avgBand >= 4 ? '\nKamu sudah di jalur yang benar!' : `\nPerlu naik ${4 - avgBand} band lagi. Fokus di section merah.`;

      await editMessage(env, chatId, messageId, msg);
      return;
    }

    // Fallback: any remaining study_ callbacks
    if (data.startsWith('study_')) {
      await editMessage(env, chatId, messageId, '⏳ Sedang berpikir...');
      const response = await getTutorResponse(env, freshUser, 'Aku mau belajar bahasa Inggris untuk TOEFL iBT. Kasih 1 soal. Maks 8 baris. Plain text.');
      await sendMessage(env, chatId, response);
    }
  }
}

async function editMessage(env: Env, chatId: number, messageId: number, text: string, replyMarkup?: any) {
  await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/editMessageText`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      message_id: messageId,
      text,
      parse_mode: 'HTML',
      reply_markup: replyMarkup,
    }),
  });
}
