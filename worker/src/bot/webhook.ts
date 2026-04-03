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
    // Generate referral code for new user
    const referralCode = `ref_${tgUser.id}_${Date.now().toString(36)}`;
    // New users get 1-day trial
    const trialEnds = new Date();
    trialEnds.setDate(trialEnds.getDate() + 1);
    const trialEndsStr = trialEnds.toISOString();

    await env.DB.prepare(
      'INSERT INTO users (telegram_id, name, username, referral_code, is_premium, premium_until) VALUES (?, ?, ?, ?, 1, ?)'
    ).bind(tgUser.id, name || 'User', tgUser.username || null, referralCode, trialEndsStr).run();

    user = await env.DB.prepare(
      'SELECT * FROM users WHERE telegram_id = ?'
    ).bind(tgUser.id).first() as User;
  }

  return user;
}

// Send TTS audio as voice message via Telegram
async function sendTTSAudio(env: Env, chatId: number, text: string) {
  try {
    const { generateTTSAudioBuffer } = await import('../routes/tts');
    const audioBuffer = await generateTTSAudioBuffer(env, text, true);

    if (!audioBuffer) {
      console.log('generateTTSAudioBuffer returned null');
      return;
    }

    // Send as voice message via Telegram
    const formData = new FormData();
    formData.append('chat_id', String(chatId));
    formData.append('audio', new Blob([audioBuffer], { type: 'audio/mpeg' }), 'audio.mp3');
    formData.append('caption', '🎧 Dengarkan audio ini:');

    await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendAudio`, {
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
    [{ text: '🇺🇸 TOEFL iBT', callback_data: 'target_TOEFL_IBT' }, { text: '🇬🇧 IELTS', callback_data: 'target_IELTS' }],
    [{ text: '📚 TOEFL ITP', callback_data: 'target_TOEFL_ITP' }, { text: '🏢 TOEIC', callback_data: 'target_TOEIC' }],
    [{ text: '⏭ Nanti saja', callback_data: 'target_skip' }],
  ],
};

const proficiencyKeyboard = {
  inline_keyboard: [
    [{ text: '🌱 Beginner', callback_data: 'level_beginner' }, { text: '🌿 Intermediate', callback_data: 'level_intermediate' }],
    [{ text: '🌳 Advanced', callback_data: 'level_advanced' }],
    [{ text: '◀️ Kembali', callback_data: 'back_target' }],
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
      [
        { text: '💬 Tanya Admin', url: 'https://wa.me/628112467784' },
        { text: '💳 Upgrade Premium' },
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
        { text: '📝 Grammar', callback_data: 'cat_grammar' },
        { text: '📚 Vocabulary', callback_data: 'cat_vocab' },
      ],
      [
        { text: '🎯 Skills & Strategy', callback_data: 'cat_skills' },
        { text: '🏋️ Latihan', callback_data: 'cat_practice' },
      ],
      [{ text: '❓ Tanya Bebas', callback_data: 'study_ask' }],
    ],
  };
}

function grammarKeyboard() {
  return {
    inline_keyboard: [
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
      [{ text: '⬅️ Kembali', callback_data: 'back_study' }],
    ],
  };
}

function vocabKeyboard() {
  return {
    inline_keyboard: [
      [
        { text: '📚 Kata Hari Ini', callback_data: 'lesson_word_of_day' },
        { text: '🎯 Academic Words', callback_data: 'lesson_academic_words' },
      ],
      [
        { text: '🤝 Collocations', callback_data: 'lesson_collocations' },
        { text: '♻️ Paraphrasing', callback_data: 'lesson_paraphrasing' },
      ],
      [{ text: '⬅️ Kembali', callback_data: 'back_study' }],
    ],
  };
}

function skillsKeyboard() {
  return {
    inline_keyboard: [
      [{ text: '🎧 Listening Practice (Audio)', callback_data: 'lesson_listening_practice' }],
      [
        { text: '👁 Reading Tips', callback_data: 'lesson_reading_strategy' },
        { text: '👂 Listening Tips', callback_data: 'lesson_listening_strategy' },
      ],
      [
        { text: '🗣 Speaking Template', callback_data: 'lesson_speaking_templates' },
        { text: '✍️ Writing Template', callback_data: 'lesson_writing_templates' },
      ],
      [
        { text: '🔊 Pronunciation', callback_data: 'lesson_pronunciation' },
        { text: '🔗 Linking Words', callback_data: 'lesson_linking_words' },
      ],
      [{ text: '⬅️ Kembali', callback_data: 'back_study' }],
    ],
  };
}

function practiceKeyboard() {
  return {
    inline_keyboard: [
      [{ text: '🏋️ Drill Grammar', callback_data: 'study_drill' }],
      [{ text: '🧠 Mini Test', callback_data: 'study_minitest' }],
      [{ text: '🎯 Daily Challenge', callback_data: 'study_challenge' }],
      [{ text: '📊 Score Estimator', callback_data: 'study_score' }],
      [{ text: '⬅️ Kembali', callback_data: 'back_study' }],
    ],
  };
}

function adminKeyboard(webappUrl: string, tgId: number) {
  return {
    keyboard: [
      [{ text: '📋 Manage Content', web_app: { url: `${webappUrl}/admin/content?tg_id=${tgId}` } }],
      [{ text: '👥 Students', web_app: { url: `${webappUrl}/admin/students?tg_id=${tgId}` } }],
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
        const parts = payment.invoice_payload.split('_');
        const userId = parseInt(parts[1] || '0');
        const days = parseInt(parts[2] || '30');
        if (userId > 0) {
          // Get current premium_until to extend instead of overwrite
          const current = await env.DB.prepare('SELECT premium_until FROM users WHERE id = ?').bind(userId).first() as any;
          let expiresAt = new Date();
          if (current?.premium_until) {
            const existing = new Date(current.premium_until);
            if (existing > expiresAt) {
              expiresAt = existing;
            }
          }
          expiresAt.setDate(expiresAt.getDate() + days);
          await env.DB.prepare('UPDATE users SET is_premium = 1, premium_until = ? WHERE id = ?')
            .bind(expiresAt.toISOString(), userId).run();
          await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              chat_id: chatId, 
              text: `🎉 *Premium Aktif!*\n\nKamu sekarang punya akses premium selama ${days} hari!\n📅 Berakhir: ${expiresAt.toLocaleDateString('id-ID')}\n\nKetik /premium untuk cek status.`,
              parse_mode: 'Markdown'
            }),
          });
        }
        return;
      }

      // Handle photos/images — currently not supported, let user know
      if (update.message.photo) {
        const chatId = update.message.chat.id;
        await sendMessage(env, chatId,
          `📷 Fitur analisis gambar belum tersedia.\n\n` +
          `Saat ini aku bisa bantu dengan:\n` +
          `• Text chat — ketik pertanyaanmu\n` +
          `• Voice message — kirim untuk latihan speaking\n` +
          `• /diagnostic — tes penempatan\n\n` +
          `Apa yang ingin kamu pelajari?`
        );
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
        // Handle start param for tracking (referral codes or channel sources)
        const startParam = text.split(' ')[1];

        // Channel source tracking (quiz_channel, vocab_daily, grammar_tip, idiom_daily, spotlight, promo)
        if (startParam && ['quiz_channel', 'vocab_daily', 'grammar_tip', 'idiom_daily', 'spotlight', 'promo'].includes(startParam)) {
          await env.DB.prepare(
            'UPDATE users SET source = ? WHERE id = ? AND source IS NULL'
          ).bind('channel_' + startParam, user.id).run();

          // Log channel click analytics
          await env.DB.prepare(
            'INSERT INTO channel_analytics (event_type, post_type, user_id) VALUES (?, ?, ?)'
          ).bind('click', startParam, user.id).run();
        }

        // Referral code handling
        if (startParam && startParam.startsWith('ref_') && !user.referred_by) {
          // Apply referral
          const referrer = await env.DB.prepare(
            'SELECT id FROM users WHERE referral_code = ?'
          ).bind(startParam).first() as any;

          if (referrer && referrer.id !== user.id) {
            await env.DB.prepare(
              'UPDATE users SET referred_by = ? WHERE id = ?'
            ).bind(referrer.id, user.id).run();

            await env.DB.prepare(
              'INSERT INTO referral_rewards (referrer_id, referee_id, reward_type, reward_days, status) VALUES (?, ?, ?, ?, ?)'
            ).bind(referrer.id, user.id, 'pending', 0, 'pending').run();

            await sendMessage(env, chatId,
              `🎉 *Referral Applied!*\n\n` +
              `Kamu menggunakan kode referral dari temanmu.\n\n` +
              `Setelah kamu upgrade ke premium, dia akan dapat reward!`
            );
          }
        }

        // Cancel any active diagnostic session so the user isn't stuck
        await env.DB.prepare(
          "UPDATE diagnostic_sessions SET status = 'cancelled' WHERE user_id = ? AND status = 'in_progress'"
        ).bind(user.id).run();

        if (user.onboarding_complete) {
          await sendMessage(env, chatId,
            `Halo lagi, ${user.name}! 👋\n\nMau ngapain hari ini?`,
            mainMenuKeyboard(env.WEBAPP_URL),
          );
        } else {
          await sendMessage(env, chatId,
            `Halo ${tgUser.first_name}! 👋\n\n` +
            `Selamat datang di EduBot — Personal TOEFL iBT & IELTS Tutor.\n\n` +
            `Aku di sini buat bantu kamu persiapan tes bahasa Inggris. ` +
            `Nggak kaku, nggak boring — langsung practise.\n\n` +
            `📋 *Step 1 dari 2 — Pilih Target Tes*\n\n` +
            `Kamu mau persiapan tes yang mana?`,
            testTypeKeyboard,
          );
        }
        return;
      }

      case '/help': {
        // Role-based interactive help
        const studentHelp = `📚 *Perintah Belajar*\n\n` +
          `/diagnostic — Tes penempatan dulu\n` +
          `/study — Pilih topik belajar\n` +
          `/today — Pelajaran hari ini\n` +
          `/review — Review soal yang salah\n` +
          `/challenge @user — Duel 5 soal\n\n` +
          `💡 *Tips:* Kirim voice message untuk latihan speaking!`;

        const progressHelp = `📊 *Progress & Profile*\n\n` +
          `/role — Lihat XP, level, badges\n` +
          `/settings — Ubah target tes & level\n` +
          `/certificate — Download sertifikat\n\n` +
          `📈 *Tracking:* Skor kamu terus dipantau otomatis!`;

        const premiumHelp = `⭐ *Premium & Referral*\n\n` +
          `/premium — Cek status atau upgrade\n` +
          `/referral — Lihat kode & link referral\n\n` +
          `🎁 *Referral:* Ajak teman = dapat gratis!`;

        const teacherHelp = `👨‍🏫 *Teacher Commands*\n\n` +
          `/admin — Dashboard siswa\n` +
          `/broadcast — Kirim ke semua siswa\n` +
          `/addclass — Hubungkan grup Telegram\n` +
          `/today — Check daily class activity`;

        const adminHelp = `👑 *Admin Commands*\n\n` +
          `/stats — Statistik sistem\n` +
          `/promote @user role — Ubah role user\n` +
          `/teacher KODE — Buat kode guru baru\n` +
          `/markfounders — Mark founding students\n` +
          `/pendingpayments — Lihat payment pending\n` +
          `/confirm [ID] — Konfirmasi pembayaran\n` +
          `/reject [ID] — Tolak pembayaran`;

        const mainHelp = `🤖 *EduBot Help*\n\n` +
          `Pilih kategori di bawah untuk lihat perintah:\n\n` +
          `📚 Belajar\n` +
          `📊 Progress\n` +
          `⭐ Premium\n` +
          `💬 Umum`;

        let inlineKeyboard: any[][] = [
          [{ text: '📚 Belajar', callback_data: 'help_study' }],
          [{ text: '📊 Progress', callback_data: 'help_progress' }],
          [{ text: '⭐ Premium', callback_data: 'help_premium' }],
          [{ text: '💬 Umum', callback_data: 'help_general' }],
        ];

        if (user.role === 'teacher' || user.role === 'admin') {
          inlineKeyboard.push([{ text: '👨‍🏫 Teacher', callback_data: 'help_teacher' }]);
        }
        if (user.role === 'admin') {
          inlineKeyboard.push([{ text: '👑 Admin', callback_data: 'help_admin' }]);
        }

        await sendMessage(env, chatId,
          `🤖 *EduBot Help*\n\n` +
          `📋 Role kamu: *${user.role}*\n\n` +
          `Pilih kategori untuk lihat perintah:`,
          { inline_keyboard: inlineKeyboard }
        );
        return;
      }

      case '/premium':
      case '/subscribe': {
        const { checkPremium } = await import('../services/premium');
        const info = await checkPremium(env, user.id);

        if (info.is_premium) {
          if (info.is_founding_student) {
            await sendMessage(env, chatId,
              `🏆 *Founding Student*\n\n` +
              `Kamu adalah bagian dari第一批 siswa pilot! Akses premium gratis selamanya.\n\n` +
              `Terima kasih sudah percaya EduBot dari awal! 🎉`
            );
          } else {
            await sendMessage(env, chatId,
              `✅ *Premium Active*\n\n` +
              `Akses premium kamu aktif${info.days_remaining ? ` untuk ${info.days_remaining} hari lagi` : ''}.\n\n` +
              `Berakhir: ${info.trial_ends ? new Date(info.trial_ends).toLocaleDateString('id-ID') : 'Unknown'}`
            );
          }
          return;
        }

        // Show purchase options
        // Stars pricing: Rp 80 per Star
        // 7 days = Rp 30,000 = 375 Stars
        // 30 days = Rp 99,000 = 1,238 Stars
        // 90 days = Rp 270,000 = 3,375 Stars
        // 180 days = Rp 500,000 = 6,250 Stars
        // 365 days = Rp 950,000 = 11,875 Stars
        await sendMessage(env, chatId,
          `⭐ *Upgrade Premium*\n\n` +
          `Trial kamu sudah berakhir. Upgrade untuk akses tak terbatas!\n\n` +
          `📦 *Paket Premium:*\n` +
          `• 7 hari = 375 ⭐ (Rp 30.000)\n` +
          `• 30 hari = 1.238 ⭐ (Rp 99.000)\n` +
          `• 90 hari = 3.375 ⭐ (Rp 270.000)\n` +
          `• 180 hari = 6.250 ⭐ (Rp 500.000)\n` +
          `• 365 hari = 11.875 ⭐ (Rp 950.000)\n\n` +
          `💡 *Tips:* Kumpulkan referral 5 teman = 1 bulan gratis!\n\n` +
          `Kirim /referral untuk lihat kode referral kamu.`,
          {
            inline_keyboard: [
              [{ text: '💳 Beli dengan Telegram Stars', callback_data: 'buy_stars' }],
              [{ text: '📤 Beli via GoPay', callback_data: 'buy_gopay' }],
            ],
          }
        );
        return;
      }

      case '/referral': {
        const { checkPremium, getReferralRewardDays } = await import('../services/premium');

        // Get referral stats
        const paidCount = await env.DB.prepare(
          `SELECT COUNT(*) as c FROM referral_rewards WHERE referrer_id = ? AND status = 'earned'`
        ).bind(user.id).first() as any;

        const pendingCount = await env.DB.prepare(
          `SELECT COUNT(*) as c FROM referral_rewards WHERE referrer_id = ? AND status = 'pending'`
        ).bind(user.id).first() as any;

        const userData = await env.DB.prepare(
          'SELECT referral_code FROM users WHERE id = ?'
        ).bind(user.id).first() as any;

        const code = userData?.referral_code || `ref_${user.id}_${Date.now().toString(36)}`;
        if (!userData?.referral_code) {
          await env.DB.prepare(
            'UPDATE users SET referral_code = ? WHERE id = ?'
          ).bind(code, user.id).run();
        }

        const botUsername = 'osee_IBT_IELTS_tutor_bot';
        const referralLink = `https://t.me/${botUsername}?start=${code}`;

        // Calculate next reward
        const currentPaid = paidCount?.c || 0;
        const nextReward = getReferralRewardDays(currentPaid);
        const referralsToNext = currentPaid >= 5 ? 'MAX!' : currentPaid >= 3 ? '2 more for 30 days!' : currentPaid >= 1 ? '2 more for 30 days!' : '1 more for 3 days!';

        await sendMessage(env, chatId,
          `👥 *Referral Program*\n\n` +
          `Teman kamu signup lewat link kamu + jadi paid user = kamu dapat reward!\n\n` +
          `📊 *Statistik:*\n` +
          `• Kode: \`${code}\`\n` +
          `✅ Referral paid: ${currentPaid}\n` +
          `⏳ Pending: ${pendingCount?.c || 0}\n\n` +
          `🎁 *Reward:*\n` +
          `• 1 teman paid = 3 hari gratis\n` +
          `• 3 teman paid = 1 minggu gratis\n` +
          `• 5 teman paid = 1 bulan gratis\n\n` +
          `📈 Next reward: ${nextReward} hari (${referralsToNext})\n\n` +
          `🔗 *Link Referral:*\n` +
          `${referralLink}\n\n` +
          `Share ke teman-teman kamu!`,
          {
            inline_keyboard: [
              [{ text: '📋 Copy Link', callback_data: 'copy_referral' }],
              [{ text: '📊 Detail Stats', callback_data: 'referral_stats' }],
            ],
          }
        );
        return;
      }

      case '/referral_stats': {
        const { getReferralRewardDays } = await import('../services/premium');

        const rewards = await env.DB.prepare(
          `SELECT rr.*, u.name as referee_name 
           FROM referral_rewards rr 
           JOIN users u ON rr.referee_id = u.id 
           WHERE rr.referrer_id = ? ORDER BY rr.created_at DESC LIMIT 20`
        ).bind(user.id).all() as any;

        const paidCount = await env.DB.prepare(
          `SELECT COUNT(*) as c FROM referral_rewards WHERE referrer_id = ? AND status = 'earned'`
        ).bind(user.id).first() as any;

        const totalDays = await env.DB.prepare(
          `SELECT SUM(reward_days) as total FROM referral_rewards WHERE referrer_id = ? AND status = 'earned'`
        ).bind(user.id).first() as any;

        let msg = `📊 *Referral Stats*\n\n`;
        msg += `✅ Paid referrals: ${paidCount?.c || 0}\n`;
        msg += `🎁 Total days earned: ${totalDays?.total || 0} hari\n\n`;

        if (!rewards.results || rewards.results.length === 0) {
          msg += `Belum ada referral yang sudah payment.`;
        } else {
          msg += `*Riwayat:*\n`;
          for (const r of rewards.results) {
            const date = new Date(r.created_at).toLocaleDateString('id-ID', { day: '2-digit', month: 'short' });
            const status = r.status === 'earned' ? '✅' : r.status === 'pending' ? '⏳' : '❌';
            const days = r.reward_days > 0 ? `(+${r.reward_days} hari)` : '';
            msg += `${status} ${r.referee_name || 'User #'+r.referee_id} ${days} — ${date}\n`;
          }
        }

        await sendMessage(env, chatId, msg);
        return;
      }

      case '/buy':
      case '/pembelian': {
        await sendMessage(env, chatId,
          `💳 *Pembelian Premium*\n\n` +
          `Pilih metode pembayaran:\n\n` +
          `1️⃣ *Telegram Stars* (Instant)\n` +
          `   • 7 hari = 375 ⭐\n` +
          `   • 30 hari = 1.238 ⭐\n` +
          `   • 90 hari = 3.375 ⭐\n\n` +
          `2️⃣ *GoPay / Transfer* (Manual)\n` +
          `   • Transfer ke rekening kami\n` +
          `   • Konfirmasi manual oleh admin\n\n` +
          `3️⃣ *WhatsApp*\n` +
          `   • Chat kami untuk metode lain\n` +
          `   • wa.me/628112467784\n\n` +
          `Kirim angka (1/2/3) untuk pilih metode atau ketik /premium untuk detail lengkap.`,
          {
            inline_keyboard: [
              [{ text: '1️⃣ Beli via Stars', callback_data: 'buy_stars' }],
              [{ text: '2️⃣ Beli via GoPay', callback_data: 'buy_gopay' }],
              [{ text: '3️⃣ Hubungi WhatsApp', url: 'https://wa.me/628112467784' }],
            ],
          }
        );
        return;
      }

      case '/settings':
        await sendMessage(env, chatId, 'Pengaturan Target & Level:', {
          inline_keyboard: [
            [
              { text: '🇺🇸 TOEFL iBT', callback_data: 'setting_test_TOEFL_IBT' },
              { text: '🇬🇧 IELTS', callback_data: 'setting_test_IELTS' },
            ],
            [
              { text: '📚 TOEFL ITP', callback_data: 'setting_test_TOEFL_ITP' },
              { text: '🏢 TOEIC', callback_data: 'setting_test_TOEIC' },
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
        // Cancel any existing review session first
        await env.DB.prepare('DELETE FROM review_sessions WHERE user_id = ?').bind(user.id).run();

        const { getDueReviews, getReviewStats } = await import('../services/spaced-repetition');
        const stats = await getReviewStats(env, user.id);
        if (stats.due === 0) {
          const masteredNote = stats.mastered > 0 ? ` Kamu udah kuasai ${stats.mastered} item — keren!` : '';
          await sendMessage(env, chatId, `Belum ada yang perlu di-review sekarang. Santai dulu aja! 😎${masteredNote}\n\nNanti aku kabarin kalau udah waktunya review.`);
        } else {
          const items = await getDueReviews(env, user.id, 1);
          if (items.length > 0) {
            const item = items[0] as any;
            // Save review session
            await env.DB.prepare(
              'INSERT OR REPLACE INTO review_sessions (user_id, current_review_id) VALUES (?, ?)'
            ).bind(user.id, item.id).run();
            const remaining = stats.due > 1 ? `\n\nMasih ada ${stats.due - 1} soal lagi setelah ini.` : '';
            await sendMessage(env, chatId, `Yuk review! 📝\n\nSoal ${item.section}:\n"${item.question_data}"\n\nJawaban kamu sebelumnya: ${item.student_answer}\nJawaban yang benar: ${item.correct_answer}\n\nUdah paham sekarang kenapa? Ketik "ya" atau "belum" — kalau belum, aku jelaskan.${remaining}\n\nKetik /cancel review untuk keluar.`);
          }
        }
        return;
      }

      case '/cancel': {
        // Check if it's a review cancellation
        if (text.toLowerCase().includes('review')) {
          const session = await env.DB.prepare('SELECT id FROM review_sessions WHERE user_id = ?').bind(user.id).first();
          if (session) {
            await env.DB.prepare('DELETE FROM review_sessions WHERE user_id = ?').bind(user.id).run();
            await sendMessage(env, chatId, '✅ Review dibatalkan.\n\nKetik /review untuk mulai lagi kapan saja.');
          } else {
            await sendMessage(env, chatId, 'Tidak ada sesi review yang aktif.');
          }
          return;
        }
        // Generic cancel — not in review mode
        await sendMessage(env, chatId, 'Tidak ada sesi yang bisa dibatalkan.');
        return;
      }

      case '/test':
      case '/quiz': {
        const { checkTestAccess } = await import('../services/premium');
        const access = await checkTestAccess(env, user.id);

        if (!access.is_premium && !access.allowed) {
          await sendMessage(env, chatId,
            `🔒 *Mini App Premium*\n\n` +
            `Batas harian tercapai!\n\n` +
            `📊 Hari ini: ${access.used_today}/${access.daily_limit} soal\n` +
            `🎁 Bonus dari referral: ${access.bonus_quota} soal\n` +
            `⏰ Reset otomatis jam 00:00 WIB\n\n` +
            `🗣️ Premium = Speaking practice + unlimited soal\n` +
            `⬆️ Upgrade ke Premium untuk akses penuh!`,
            {
              inline_keyboard: [
                [{ text: '⭐ Upgrade Premium', callback_data: 'buy_stars' }],
                [{ text: '📤 via GoPay', callback_data: 'buy_gopay' }],
                [{ text: '🎁 Dapat Bonus — Undang Teman', callback_data: 'copy_referral' }],
              ],
            }
          );
          return;
        }

        if (!access.is_premium && access.allowed) {
          // Free user with remaining quota
          await sendMessage(env, chatId,
            `📝 *Practice Test + Speaking*\n\n` +
            `📊 Sisa harian: ${access.remaining} soal\n` +
            `${access.bonus_quota > 0 ? `🎁 Bonus referral: ${access.bonus_quota} soal\n` : ''}` +
            `⏰ Reset jam 00:00 WIB\n\n` +
            `🗣️ Premium: Speaking practice dengan evaluasi AI.\n` +
            `📖 Reading, Listening, Writing — termasuk free!\n\n` +
            `Buka aplikasi untuk mulai.`,
            {
              inline_keyboard: [
                [{ text: '📝 Mulai Practice Test', web_app: { url: `${env.WEBAPP_URL}/test?tg_id=${user.telegram_id}` } }],
                [{ text: '⭐ Upgrade Premium', callback_data: 'buy_stars' }],
              ],
            }
          );
          return;
        }

        // Premium user
        await sendMessage(env, chatId,
          `📝 *Practice Test + Speaking*\n\n` +
          `👑 Premium Access — Unlimited\n\n` +
          `🗣️ *Speaking Practice* — Coba evaluasi AI untuk pronunciation & fluency!\n` +
          `📝 Reading, Listening, Writing — semua unlimited.\n\n` +
          `Buka aplikasi untuk mulai.`,
          {
            inline_keyboard: [
              [{ text: '📝 Mulai Practice Test', web_app: { url: `${env.WEBAPP_URL}/test?tg_id=${user.telegram_id}` } }],
              [{ text: '🗣️ Speaking Practice', web_app: { url: `${env.WEBAPP_URL}/test?tg_id=${user.telegram_id}&section=speaking` } }],
              [{ text: '📖 Belajar Topik', callback_data: 'cat_practice' }],
            ],
          }
        );
        return;
      }

      case '/progress':
        await sendMessage(env, chatId,
          '📊 *Progress Dashboard*\n\nLihat perkembangan belajar kamu di sini.\n\nTermasuk: total soal, akurasi per section, dan estimasi band score.',
          {
            inline_keyboard: [
              [{ text: '📊 Lihat Progress', web_app: { url: `${env.WEBAPP_URL}/progress` } }],
            ],
          }
        );
        return;

      case '/diagnostic': {
        const { startDiagnostic } = await import('../services/diagnostic');
        const intro = await startDiagnostic(env, user);
        await sendMessage(env, chatId, intro);
        return;
      }

      case '/today': {
        const { getTodayLesson } = await import('../services/studyplan');
        const lesson = await getTodayLesson(env, user.id);
        await sendMessage(env, chatId, lesson || 'Belum ada study plan. Ketik /diagnostic dulu untuk tes penempatan.');
        // Track /today usage for analytics
        try {
          await env.DB.prepare(
            "INSERT INTO analytics (user_id, event, data) VALUES (?, 'study_plan_viewed', ?)"
          ).bind(user.id, JSON.stringify({ timestamp: new Date().toISOString() })).run();
        } catch {}
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
          // Show challenger the first question
          let msg = `🎯 Challenge vs @${target}!\n\n` +
            `📋 5 soal grammar. Jawab dan kirim ke lawan.\n\n` +
            `Soal 1:\n${questions[0].q}\n\n` +
            `⏳ Menunggu @${target} accept...\n` +
            `Ketik /cancel_challenge untuk batalkan.`;
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

      case '/cancel_challenge': {
        // Cancel pending challenge created by this user
        const pendingChallenge = await env.DB.prepare(
          "SELECT id, opponent_id FROM challenges WHERE challenger_id = ? AND status = 'pending' ORDER BY id DESC LIMIT 1"
        ).bind(user.id).first() as any;

        if (!pendingChallenge) {
          await sendMessage(env, chatId, 'Tidak ada challenge yang pending untuk dibatalkan.');
          return;
        }

        await env.DB.prepare(
          "UPDATE challenges SET status = 'cancelled' WHERE id = ?"
        ).bind(pendingChallenge.id).run();

        // Notify opponent
        const opponent = await env.DB.prepare('SELECT telegram_id, name FROM users WHERE id = ?').bind(pendingChallenge.opponent_id).first() as any;
        if (opponent?.telegram_id) {
          const oppTgId = parseInt(String(opponent.telegram_id).replace('.0', ''));
          await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: oppTgId, text: `@${user.name} membatalkan challenge mereka.` }),
          });
        }

        await sendMessage(env, chatId, '✅ Challenge dibatalkan.');
        return;
      }

      case '/accept': {
        // /accept challengeId
        const challengeId = parseInt(text.split(' ')[1] || '0');
        if (!challengeId) {
          await sendMessage(env, chatId, 'Usage: /accept [challenge_id]\n\nContoh: /accept 42\n\nCari challenge_id dari notification yang dikirim bot.');
          return;
        }

        // Find the challenge
        const challenge = await env.DB.prepare(
          'SELECT * FROM challenges WHERE id = ?'
        ).bind(challengeId).first() as any;

        if (!challenge) {
          await sendMessage(env, chatId, '❌ Challenge tidak ditemukan.');
          return;
        }

        // Verify current user is the opponent
        if (challenge.opponent_id !== user.id) {
          await sendMessage(env, chatId, '❌ Kamu bukan opponent di challenge ini.');
          return;
        }

        // Check if challenge is still pending
        if (challenge.status !== 'pending') {
          await sendMessage(env, chatId, '❌ Challenge ini sudah tidak aktif. Mungkin sudah selesai atau kadaluarsa.');
          return;
        }

        // Check timeout (1 hour)
        const createdAt = new Date(challenge.created_at);
        const now = new Date();
        const hoursPassed = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60);
        if (hoursPassed > 1) {
          await env.DB.prepare("UPDATE challenges SET status = 'expired' WHERE id = ?").bind(challengeId).run();
          await sendMessage(env, chatId, '❌ Challenge sudah kadaluarsa (lebih dari 1 jam). Minta challenge baru dari lawan.');
          return;
        }

        // Parse questions
        const questions = JSON.parse(challenge.questions);

        // Send all 5 questions to opponent
        let questionText = `🎯 Challenge!\n\n` +
          `Jawab 5 soal berikut. Ketik jawaban dengan format:\n` +
          `a,b,c,d,a (huruf kecil, pisahkan dengan koma)\n\n`;

        for (let i = 0; i < questions.length; i++) {
          questionText += `\nSoal ${i + 1}:\n${questions[i].q}\n`;
        }

        await sendMessage(env, chatId, questionText + '\n\nBalas dengan jawabanmu sekarang!');

        // Store that this user is in challenge answer mode
        await env.DB.prepare(
          'UPDATE challenges SET status = ? WHERE id = ?'
        ).bind('opponent_answers', challengeId).run();

        return;
      }

      case '/admin':
        if (user.role !== 'teacher' && user.role !== 'admin') {
          await sendMessage(env, chatId, '⛔ Teachers and admins only.');
          return;
        }
        await sendMessage(env, chatId, '🏫 Admin Panel', adminKeyboard(env.WEBAPP_URL, user.telegram_id));
        return;

      case '/broadcast': {
        if (user.role !== 'teacher' && user.role !== 'admin') {
          await sendMessage(env, chatId, '⛔ Teachers and admins only.');
          return;
        }
        const msg = text.replace('/broadcast', '').trim();
        if (!msg) {
          await sendMessage(env, chatId, 'Usage: /broadcast <message>\n\nContoh: /broadcast Selamat datang di kelas baru!');
          return;
        }
        // Get all students (users with role student or all non-admin)
        const students = await env.DB.prepare(
          "SELECT telegram_id FROM users WHERE role = 'student' OR role = 'user'"
        ).all() as any;
        let sent = 0;
        for (const student of students.results || []) {
          const tgId = parseInt(String(student.telegram_id).replace('.0', ''));
          if (tgId) {
            await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ chat_id: tgId, text: `📢 *Announcement:*\n\n${msg}` }),
            });
            sent++;
          }
        }
        await sendMessage(env, chatId, `📢 Broadcast sent to ${sent} students:\n\n"${msg}"`);
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

      case '/teacher_subscribe': {
        // Teachers only
        if (user.role !== 'teacher' && user.role !== 'admin') {
          await sendMessage(env, chatId, '⛔ Hanya guru yang bisa subscribe. Ketik /teacher KODE untuk jadi guru.');
          return;
        }

        // Show teacher subscription options
        const studentCount = await env.DB.prepare(
          `SELECT COUNT(*) as count FROM class_enrollments ce 
           JOIN classes c ON ce.class_id = c.id 
           WHERE c.teacher_id = ?`
        ).bind(user.id).first() as any;

        const count = studentCount?.count || 0;

        await sendMessage(env, chatId,
          `👨‍🏫 *Teacher Premium Subscription*\n\n` +
          `Siswa terdaftar: ${count} siswa\n\n` +
          `📦 *Paket Langganan:*\n\n` +
          `1️⃣ 1 bulan = ${(count * 50000).toLocaleString('id-ID')} ⭐\n` +
          `2️⃣ 3 bulan = ${(count * 150000).toLocaleString('id-ID')} ⭐\n` +
          `3️⃣ 6 bulan = ${(count * 300000).toLocaleString('id-ID')} ⭐\n` +
          `4️⃣ 12 bulan = ${(count * 600000).toLocaleString('id-ID')} ⭐\n\n` +
          `Klik tombol di bawah untuk beli via Telegram Stars.`,
          {
            inline_keyboard: [
              [{ text: `1️⃣ 1 Bulan`, callback_data: 'teacher_sub_1' }],
              [{ text: `2️⃣ 3 Bulan`, callback_data: 'teacher_sub_2' }],
              [{ text: `3️⃣ 6 Bulan`, callback_data: 'teacher_sub_3' }],
              [{ text: `4️⃣ 12 Bulan`, callback_data: 'teacher_sub_4' }],
            ],
          }
        );
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
          `📊 *Statistik EduBot* (All Time)\n\n` +
          `👥 Pengguna: ${(userCount?.c || 0).toLocaleString('id-ID')} (${(teachers?.c || 0).toLocaleString('id-ID')} guru)\n` +
          `🏫 Kelas: ${(classes?.c || 0).toLocaleString('id-ID')}\n` +
          `📝 Soal di database: ${(questionCount?.c || 0).toLocaleString('id-ID')}\n` +
          `✅ Tes selesai: ${(attemptCount?.c || 0).toLocaleString('id-ID')}\n` +
          `💬 Jawaban total: ${(answerCount?.c || 0).toLocaleString('id-ID')}\n` +
          `💰 Biaya API total: $${Number(costTotal?.c || 0).toFixed(2)}`
        );
        return;
      }

      case '/markfounders': {
        if (user.role !== 'admin') {
          await sendMessage(env, chatId, '⛔ Hanya admin.');
          return;
        }
        // Mark all users who have chatted as founding students (free forever)
        const result = await env.DB.prepare(
          `UPDATE users SET is_premium = 1, premium_until = '2099-12-31', is_founding_student = 1
           WHERE id IN (
             SELECT DISTINCT user_id FROM conversation_messages
             WHERE user_id IS NOT NULL
           ) AND is_founding_student = 0`
        ).run();

        const count = result.meta?.changes || 0;
        await sendMessage(env, chatId,
          `✅ *Founding Students Marked*\n\n` +
          `${count} users marked as founding students (free forever).\n\n` +
          `They now have unlimited premium access.`
        );
        return;
      }

      case '/pendingpayments':
      case '/payments': {
        if (user.role !== 'admin') {
          await sendMessage(env, chatId, '⛔ Hanya admin.');
          return;
        }
        const payments = await env.DB.prepare(
          `SELECT pr.id, pr.user_id, u.name as user_name, pr.amount, pr.days, pr.method, pr.status, pr.created_at
           FROM payment_requests pr
           JOIN users u ON pr.user_id = u.id
           WHERE pr.status = 'pending'
           ORDER BY pr.created_at DESC
           LIMIT 10`
        ).all() as any;

        if (!payments.results || payments.results.length === 0) {
          await sendMessage(env, chatId, '✅ Tidak ada pembayaran pending.');
          return;
        }

        let msg = `💳 *Pending Payments* (${payments.results.length})\n\n`;
        for (const p of payments.results) {
          const date = new Date(p.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
          msg += `*#${p.id}* - ${p.user_name}\n`;
          msg += `💰 Rp ${p.amount.toLocaleString('id-ID')} (${p.days} hari)\n`;
          msg += `📅 ${date}\n\n`;
        }
        msg += `Ketik /confirm [ID] untuk konfirmasi\n atau /reject [ID] untuk tolak`;

        await sendMessage(env, chatId, msg);
        return;
      }

      case '/confirm': {
        if (user.role !== 'admin') {
          await sendMessage(env, chatId, '⛔ Hanya admin.');
          return;
        }
        const paymentId = parseInt(text.split(' ')[1] || '0');
        if (!paymentId) {
          await sendMessage(env, chatId, 'Usage: /confirm [payment_id]\nContoh: /confirm 5');
          return;
        }

        const payment = await env.DB.prepare(
          'SELECT * FROM payment_requests WHERE id = ? AND status = ?'
        ).bind(paymentId, 'pending').first() as any;

        if (!payment) {
          await sendMessage(env, chatId, '❌ Payment tidak ditemukan atau sudah diproses.');
          return;
        }

// Grant premium
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + payment.days);
        await env.DB.prepare(
          'UPDATE users SET is_premium = 1, premium_until = ? WHERE id = ?'
        ).bind(expiresAt.toISOString(), payment.user_id).run();

        // Grant referral reward to referrer if applicable
        try {
          const { grantReferralReward } = await import('../services/premium');
          await grantReferralReward(env, payment.user_id, payment.days, env.TELEGRAM_BOT_TOKEN);
        } catch (e) {
          console.error('Referral reward error:', e);
        }

        // Update payment status
        await env.DB.prepare(
          "UPDATE payment_requests SET status = 'paid', confirmed_at = datetime('now'), confirmed_by = ? WHERE id = ?"
        ).bind(user.id, paymentId).run();

        // Log to payment history
        await env.DB.prepare(
          'INSERT INTO payment_history (user_id, amount, method, days_granted, status, payment_id) VALUES (?, ?, ?, ?, ?, ?)'
        ).bind(payment.user_id, payment.amount, payment.method, payment.days, 'completed', `manual_${paymentId}`).run();

        // Notify user
          const userData = await env.DB.prepare('SELECT telegram_id, role FROM users WHERE id = ?').bind(payment.user_id).first() as any;
          if (userData) {
            const tgId = parseInt(String(userData.telegram_id).replace('.0', ''));
            const isTeacher = userData.role === 'teacher' || userData.role === 'admin';
            const handbookType = isTeacher ? 'teacher' : 'student';
            const handbookUrl = `${env.WEBAPP_URL}/api/handbook/${handbookType}`;
            
            await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                chat_id: tgId,
                text: `🎉 *Pembayaran Dikonfirmasi!*\n\n` +
                  `Premium kamu aktif untuk ${payment.days} hari!\n` +
                  `Expired: ${expiresAt.toLocaleDateString('id-ID')}\n\n` +
                  `Sekarang kamu bisa akses semua fitur premium. Ketik /premium untuk cek status.\n\n` +
                  `📚 Handbook sudah dikirim! Silakan cek pesan dari bot.`
              }),
            });
            // Send appropriate handbook
            const caption = isTeacher 
              ? '📚 *Teacher Handbook* — Panduan lengkap mengelola kelas dengan EduBot. Simpan untuk referensi!'
              : '📚 *Student Handbook* — Panduan lengkap menggunakan EduBot. Simpan untuk referensi!';
            await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendDocument`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                chat_id: tgId,
                document: handbookUrl,
                caption
              }),
            });
          }

        await sendMessage(env, chatId, `✅ Payment #${paymentId} confirmed. Premium granted for ${payment.days} days.`);
        return;
      }

      case '/reject': {
        if (user.role !== 'admin') {
          await sendMessage(env, chatId, '⛔ Hanya admin.');
          return;
        }
        const paymentId = parseInt(text.split(' ')[1] || '0');
        if (!paymentId) {
          await sendMessage(env, chatId, 'Usage: /reject [payment_id]\nContoh: /reject 5');
          return;
        }

        // Get payment details before cancelling
        const payment = await env.DB.prepare(
          'SELECT user_id FROM payment_requests WHERE id = ? AND status = ?'
        ).bind(paymentId, 'pending').first() as any;

        if (!payment) {
          await sendMessage(env, chatId, '❌ Payment tidak ditemukan atau sudah diproses.');
          return;
        }

        // Cancel the payment
        await env.DB.prepare(
          "UPDATE payment_requests SET status = 'cancelled' WHERE id = ? AND status = 'pending'"
        ).bind(paymentId).run();

        // Notify the user whose payment was rejected
        const userData = await env.DB.prepare('SELECT telegram_id FROM users WHERE id = ?').bind(payment.user_id).first() as any;
        if (userData) {
          const tgId = parseInt(String(userData.telegram_id).replace('.0', ''));
          await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              chat_id: tgId, 
              text: `❌ *Pembayaran Ditolak*\n\n` +
                `Payment #${paymentId} kamu ditolak.\n` +
                `Silakan hubungi admin @oseeadmin untuk info lebih lanjut.`
            }),
          });
        }

        await sendMessage(env, chatId, `❌ Payment #${paymentId} rejected. User notified.`);
        return;
      }

      case '/requestpayment': {
        // Parse: /requestpayment 30 99000
        const parts = text.split(' ');
        const days = parseInt(parts[1] || '0');
        const amount = parseInt(parts[2] || '0');

        if (!days || !amount) {
          await sendMessage(env, chatId,
            `💳 *Request Payment*\n\n` +
            `Usage: /requestpayment [days] [amount]\n\n` +
            `Contoh: /requestpayment 30 99000\n\n` +
            `Ini akan buat request pembayaran. Admin akan cek dan konfirmasi setelah kamu transfer.`
          );
          return;
        }

        // Create payment request
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 1); // Expire in 24 hours

        await env.DB.prepare(
          'INSERT INTO payment_requests (user_id, amount, days, status, expires_at) VALUES (?, ?, ?, ?, ?)'
        ).bind(user.id, amount, days, 'pending', expiresAt.toISOString()).run();

        // Get the created request
        const request = await env.DB.prepare(
          'SELECT id FROM payment_requests WHERE user_id = ? ORDER BY id DESC LIMIT 1'
        ).bind(user.id).first() as any;

        // Calculate expiry hours remaining
        const now = new Date();
        const hoursLeft = Math.max(0, Math.round((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60)));

        await sendMessage(env, chatId,
          `✅ *Payment Request Dibuat!*\n\n` +
          `📋 Request #${request.id}\n` +
          `💰 Rp ${amount.toLocaleString('id-ID')} (${days} hari)\n` +
          `⏰ Berlaku: ${hoursLeft} jam lagi\n\n` +
          `📱 *Transfer ke:*\n` +
          `🟢 GoPay: 085643597072\n` +
          `   a.n. Leonardus Bayu Ari P\n\n` +
          `⚠️ Setelah transfer, ketik:\n` +
          `/paid Sudah transfer GoPay 085643597072 a.n. Leonardus Bayu Ari P\n\n` +
          `atau hubungi @oseeadmin untuk konfirmasi.`
        );
        return;
      }

      case '/paid': {
        const proof = text.split(' ').slice(1).join(' ').trim();
        if (!proof) {
          await sendMessage(env, chatId, 
            '📋 *Cara Submit Payment*\n\n' +
            'Transfer ke:\n' +
            '🟢 GoPay: 085643597072\n' +
            '   a.n. Leonardus Bayu Ari P\n\n' +
            'Contoh: /paid Sudah transfer GoPay 085643597072 a.n. Leonardus Bayu Ari P'
          );
          return;
        }

        // Find pending payment
        const pending = await env.DB.prepare(
          "SELECT id, amount, days FROM payment_requests WHERE user_id = ? AND status = 'pending' ORDER BY id DESC LIMIT 1"
        ).bind(user.id).first() as any;

        if (!pending) {
          await sendMessage(env, chatId, '❌ Tidak ada pending payment. Ketik /requestpayment dulu.');
          return;
        }

        await env.DB.prepare(
          'UPDATE payment_requests SET payment_proof = ?, status = ? WHERE id = ?'
        ).bind(proof, 'paid', pending.id).run();

        // Notify admin
        const admins = await env.DB.prepare("SELECT telegram_id FROM users WHERE role = 'admin'").all() as any;
        for (const admin of admins.results || []) {
          const tgId = parseInt(String(admin.telegram_id).replace('.0', ''));
          if (tgId) {
            await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                chat_id: tgId,
                text: `💰 *New Payment Submitted!*\n\nUser: @${user.username || user.name}\nAmount: Rp ${pending.amount.toLocaleString('id-ID')}\nDays: ${pending.days}\n\nBukti: ${proof}\n\nRequest #${pending.id}`,
              }),
            });
          }
        }

        await sendMessage(env, chatId,
          `✅ *Bukti Pembayaran Terkirim!*\n\n` +
          `📋 Request #${pending.id}\n` +
          `💰 Rp ${pending.amount.toLocaleString('id-ID')}\n\n` +
          `Kami akan cek dan konfirmasi dalam 1x24 jam.\n` +
          `Saber ya! 🙏`
        );
        return;
      }

      case '/myorders': {
        // Show user's payment history
        const payments = await env.DB.prepare(
          `SELECT id, amount, days, method, status, created_at, expires_at 
           FROM payment_requests WHERE user_id = ? ORDER BY id DESC LIMIT 10`
        ).bind(user.id).all() as any;

        if (!payments.results || payments.results.length === 0) {
          await sendMessage(env, chatId,
            `📋 *Riwayat Pembayaran*\n\n` +
            `Belum ada riwayat pembayaran.\n\n` +
            `Ketik /requestpayment [days] [amount] untuk mulai.`
          );
          return;
        }

        let msg = `📋 *Riwayat Pembayaran*\n\n`;
        const now = new Date();

        for (const p of payments.results) {
          const date = new Date(p.created_at).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
          const isExpired = p.status === 'pending' && new Date(p.expires_at) < now;
          const statusIcon = isExpired ? '⏰' : p.status === 'pending' ? '⏳' : p.status === 'paid' ? '✅' : p.status === 'cancelled' ? '❌' : '❓';
          const statusText = isExpired ? 'Expired' : p.status === 'pending' ? 'Pending' : p.status === 'paid' ? 'Lunas' : p.status === 'cancelled' ? 'Ditolak' : p.status;
          
          msg += `${statusIcon} *#${p.id}* — ${date}\n`;
          msg += `   💰 Rp ${Number(p.amount).toLocaleString('id-ID')} (${p.days} hari)\n`;
          msg += `   📌 Status: ${statusText}\n\n`;
        }

        await sendMessage(env, chatId, msg);
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

      case '/agent': {
        if (user.role !== 'teacher' && user.role !== 'admin') {
          await sendMessage(env, chatId, 'Hanya untuk guru/admin.');
          return;
        }
        const goal = text.replace('/agent', '').trim();
        if (!goal) {
          await sendMessage(env, chatId,
            'Ketik: /agent [perintah]\n\nContoh:\n' +
            '- /agent siapa siswa paling lemah?\n' +
            '- /agent kirim reminder ke siswa inactive\n' +
            '- /agent buatkan 10 soal reading tentang technology\n' +
            '- /agent berapa biaya API bulan ini?\n' +
            '- /agent publish semua draft questions\n' +
            '- /agent analisis performa kelas');
          return;
        }
        await sendMessage(env, chatId, 'Agent sedang bekerja...');
        try {
          const { runAgent } = await import('../services/agent');
          const result = await runAgent(env, user, goal);
          await sendMessage(env, chatId, result);
        } catch (e: any) {
          await sendMessage(env, chatId, 'Agent error: ' + (e.message || 'unknown'));
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

  // Check if user is answering a review question (ya/belum)
  const reviewSession = await env.DB.prepare(
    'SELECT * FROM review_sessions WHERE user_id = ?'
  ).bind(user.id).first() as any;

  if (reviewSession) {
    const { markReviewed, getDueReviews, getReviewStats } = await import('../services/spaced-repetition');
    const item = await env.DB.prepare('SELECT * FROM spaced_repetition WHERE id = ?').bind(reviewSession.current_review_id).first() as any;

    if (item) {
      const understood = text.toLowerCase() === 'ya' || text.toLowerCase() === 'y';
      await markReviewed(env, item.id, understood);

      // Clean up session
      await env.DB.prepare('DELETE FROM review_sessions WHERE user_id = ?').bind(user.id).run();

      // Check if more reviews due
      const stats = await getReviewStats(env, user.id);
      if (stats.due > 0) {
        const items = await getDueReviews(env, user.id, 1);
        if (items.length > 0) {
          const nextItem = items[0] as any;
          // Start new session
          await env.DB.prepare(
            'INSERT OR REPLACE INTO review_sessions (user_id, current_review_id) VALUES (?, ?)'
          ).bind(user.id, nextItem.id).run();
          const remaining = stats.due > 1 ? `\n\nMasih ada ${stats.due - 1} soal lagi setelah ini.` : '';
          await sendMessage(env, chatId, `${understood ? '👍' : '📚'} ${understood ? 'Oke, next!' : 'Oke, aku jelaskan ya...'}\n\nSoal ${nextItem.section}:\n"${nextItem.question_data}"\n\nJawaban kamu sebelumnya: ${nextItem.student_answer}\nJawaban yang benar: ${nextItem.correct_answer}\n\nKetik "ya" atau "belum".${remaining}\n\nKetik /cancel review untuk keluar.`);
          return;
        }
      }

      // No more reviews
      await sendMessage(env, chatId,
        `🎉 *Sesi Review Selesai!*\n\n` +
        `Kamu sudah review semua soal yang perlu diulang.\n` +
        `${stats.mastered} soal udah kamu kuasai. Pertahankan! 💪\n\n` +
        `Sesi berikutnya akan muncul lagi nanti sesuai jadwal.`
      );
      return;
    }
  }

  // Check if user is answering a challenge (status = 'opponent_answers')
  const activeChallenge = await env.DB.prepare(
    "SELECT * FROM challenges WHERE opponent_id = ? AND status = 'opponent_answers' ORDER BY id DESC LIMIT 1"
  ).bind(user.id).first() as any;

  if (activeChallenge) {
    // Parse answer format "a,b,c,d,a"
    const answers = text.split(',').map((a: string) => a.trim().toLowerCase());
    if (answers.length !== 5) {
      await sendMessage(env, chatId, '❌ Format salah! Jawab dengan: a,b,c,d,a\n\nContoh: a,b,c,a,d');
      return;
    }
    const validAnswers = ['a', 'b', 'c', 'd'];
    for (const a of answers) {
      if (!validAnswers.includes(a)) {
        await sendMessage(env, chatId, `❌ Jawaban "${a}" tidak valid. Gunakan huruf a, b, c, atau d.\n\nFormat: a,b,c,d,a`);
        return;
      }
    }

    // Submit answers
    const { submitChallengeAnswer } = await import('../services/classroom');
    const result = await submitChallengeAnswer(env, activeChallenge.id, user.id, answers);
    if (!result) {
      await sendMessage(env, chatId, '❌ Challenge sudah tidak valid.');
      return;
    }

    // Get challenger info
    const challenger = await env.DB.prepare('SELECT telegram_id, name FROM users WHERE id = ?').bind(activeChallenge.challenger_id).first() as any;

    // Update challenge status to completed
    await env.DB.prepare(
      "UPDATE challenges SET status = 'completed' WHERE id = ?"
    ).bind(activeChallenge.id).run();

    // Send result to opponent
    await sendMessage(env, chatId,
      `✅ Jawaban submitted!\n\n` +
      `Skor kamu: ${result.score}/${result.total}\n\n` +
      `Challenger (@${challenger?.name || 'unknown'}) juga harus jawab. Winner akan diumumkan setelah mereka selesai.`
    );

    // Notify challenger
    if (challenger?.telegram_id) {
      const challengerTgId = parseInt(String(challenger.telegram_id).replace('.0', ''));
      await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: challengerTgId,
          text: `📊 Challenge Update!\n\n` +
            `@${user.name || 'Player'} sudah selesai jawab!\n` +
            `Skor mereka: ${result.score}/${result.total}\n\n` +
            `Sekarang giliran kamu! Challenge masih aktif — ketik jawabanmu.`
        }),
      });
    }
    return;
  }

  // Check if diagnostic session is active
  const diagSession = await env.DB.prepare(
    "SELECT id FROM diagnostic_sessions WHERE user_id = ? AND status = 'in_progress' AND created_at > datetime('now', '-30 minutes')"
  ).bind(user.id).first();

  if (diagSession) {
    // Allow user to cancel diagnostic with batal/cancel/stop
    const cancelWords = ['batal', 'cancel', 'stop', 'keluar', 'exit'];
    if (cancelWords.includes(text.toLowerCase())) {
      await env.DB.prepare(
        "UPDATE diagnostic_sessions SET status = 'cancelled' WHERE user_id = ? AND status = 'in_progress'"
      ).bind(user.id).run();
      await sendMessage(env, chatId, 'Diagnostic dibatalkan. Mau ngapain sekarang?', mainMenuKeyboard(env.WEBAPP_URL));
      return;
    }

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
      // Send final results with CTA
      const resultsText = formatResults(result.results).replace(
        '\n\nMau aku buatkan study plan? Ketik kapan target tes kamu (contoh: "2 bulan lagi" atau "1 Juni 2026")',
        ''
      );
      await sendMessage(env, chatId,
        resultsText + `\n\n🎯 *下一步?*\n\nMau langsung buat study plan personal?`,
        {
          inline_keyboard: [
            [{ text: '📚 Buat Study Plan', callback_data: 'diag_start_studyplan' }],
            [{ text: '📖 Mulai Belajar Sekarang', callback_data: 'cat_practice' }],
          ],
        }
      );
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
  if (text === '💬 Tanya Admin' || text.includes('Tanya Admin') || text.includes('WA') || text.includes('WhatsApp')) {
    await sendMessage(env, chatId,
      `📱 *Hubungi Admin*\n\n` +
      `Chat ke WhatsApp kami:\n` +
      `wa.me/628112467784\n\n` +
      `atau ketik /help untuk bantuan lain.`
    );
    return;
  }

  if (text === '💳 Upgrade Premium') {
    await sendMessage(env, chatId,
      `💎 *Upgrade Premium*\n\n` +
      `Dapatkan akses unlimited ke semua fitur!\n\n` +
      `Kirim /premium untuk lihat status atau /buy untuk beli.`
    );
    return;
  }

  if (text === '📖 Belajar') {
    await sendMessage(env, chatId, 'Mau belajar apa nih? Pilih kategori di bawah, atau langsung ketik aja, misal "belajar grammar" 👇', studyTopicKeyboard());
    return;
  }

  if (text === '🩺 Diagnostic' || text.toLowerCase() === 'diagnostic' || text === '/diagnostic') {
    try {
      const { startDiagnostic } = await import('../services/diagnostic');
      const intro = await startDiagnostic(env, user);
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

  // --- Natural language intent matching for study topics ---
  const lower = text.toLowerCase().trim();
  const studyIntent = matchStudyIntent(lower);
  if (studyIntent) {
    if (studyIntent.type === 'lesson') {
      await sendMessage(env, chatId, '⏳ Oke, siapin dulu ya...');
      const { generateLesson } = await import('../services/teaching');
      const lesson = await generateLesson(env, user, studyIntent.topic);

      // Extract [AUDIO] content and send as TTS voice message
      // Matches everything from [AUDIO] up until it hits "Soal:", "Question:", or end of string.
      const audioMatch = lesson.match(/\[AUDIO\]\s*([\s\S]+?)(?=\n\s*Soal:|\n\s*Question:|$)/i);
      if (audioMatch) {
        const audioText = audioMatch[1].trim();
        const questionText = lesson.replace(/\[AUDIO\]\s*([\s\S]+?)(?=\n\s*Soal:|\n\s*Question:|$)/i, '').trim();
        await sendTTSAudio(env, chatId, audioText);
        await sendMessage(env, chatId, questionText);
      } else {
        await sendMessage(env, chatId, lesson);
      }

      await saveToHistory(env, user.id, text, lesson);
      return;
    }
    if (studyIntent.type === 'category') {
      await sendMessage(env, chatId, studyIntent.message, studyIntent.keyboard());
      return;
    }
  }

  const response = await getTutorResponse(env, user, text);

  // Check if AI tutor response contains [AUDIO] tag (e.g., follow-up listening exercises)
  const audioMatch = response.match(/\[AUDIO\]\s*([\s\S]+?)(?=\n\s*Soal:|\n\s*Question:|$)/i);
  if (audioMatch) {
    const audioText = audioMatch[1].trim();
    const questionText = response.replace(/\[AUDIO\]\s*([\s\S]+?)(?=\n\s*Soal:|\n\s*Question:|$)/i, '').trim();
    await sendTTSAudio(env, chatId, audioText);
    await sendMessage(env, chatId, questionText);
  } else {
    await sendMessage(env, chatId, response);
  }
}

// Match free-text study intents like "belajar listening", "latihan grammar", etc.
function matchStudyIntent(text: string): { type: 'lesson'; topic: string } | { type: 'category'; message: string; keyboard: () => any } | null {
  // Direct topic mappings
  const topicMap: Record<string, string> = {
    'listening': 'listening_practice',
    'listening tips': 'listening_strategy',
    'listening strategy': 'listening_strategy',
    'dengar': 'listening_practice',
    'soal listening': 'listening_practice',
    'audio listening': 'listening_practice',
    'latihan listening': 'listening_practice',
    'listening practice': 'listening_practice',
    'listening audio': 'listening_practice',
    'reading': 'reading_strategy',
    'reading tips': 'reading_strategy',
    'reading strategy': 'reading_strategy',
    'baca': 'reading_strategy',
    'speaking': 'speaking_templates',
    'speaking template': 'speaking_templates',
    'ngomong': 'speaking_templates',
    'bicara': 'speaking_templates',
    'writing': 'writing_templates',
    'writing template': 'writing_templates',
    'nulis': 'writing_templates',
    'menulis': 'writing_templates',
    'articles': 'articles',
    'article': 'articles',
    'tenses': 'tenses',
    'tense': 'tenses',
    'prepositions': 'prepositions',
    'preposition': 'prepositions',
    'subject verb': 'sv_agreement',
    'sv agreement': 'sv_agreement',
    'passive voice': 'passive_voice',
    'passive': 'passive_voice',
    'conditionals': 'conditionals',
    'conditional': 'conditionals',
    'relative clause': 'relative_clauses',
    'relative clauses': 'relative_clauses',
    'word formation': 'word_formation',
    'collocations': 'collocations',
    'collocation': 'collocations',
    'paraphrasing': 'paraphrasing',
    'paraphrase': 'paraphrasing',
    'academic words': 'academic_words',
    'academic vocabulary': 'academic_words',
    'pronunciation': 'pronunciation',
    'linking words': 'linking_words',
  };

  // Category mappings
  const categoryMap: Record<string, { message: string; keyboard: () => any }> = {
    'grammar': { message: 'Grammar — pilih topik:', keyboard: grammarKeyboard },
    'vocab': { message: 'Vocabulary — pilih topik:', keyboard: vocabKeyboard },
    'vocabulary': { message: 'Vocabulary — pilih topik:', keyboard: vocabKeyboard },
    'kosakata': { message: 'Vocabulary — pilih topik:', keyboard: vocabKeyboard },
    'skills': { message: 'Skills & Strategy — pilih topik:', keyboard: skillsKeyboard },
    'strategy': { message: 'Skills & Strategy — pilih topik:', keyboard: skillsKeyboard },
    'strategi': { message: 'Skills & Strategy — pilih topik:', keyboard: skillsKeyboard },
    'latihan': { message: 'Latihan — mau ngapain?', keyboard: practiceKeyboard },
    'practice': { message: 'Latihan — mau ngapain?', keyboard: practiceKeyboard },
    'drill': { message: 'Latihan — mau ngapain?', keyboard: practiceKeyboard },
  };

  // Strip common prefixes: "belajar X", "latihan X", "mau X", "study X", "learn X"
  const prefixes = /^(belajar|latihan|mau belajar|mau latihan|study|learn|practice|aku mau|pengen|ingin)\s+/i;
  const stripped = text.replace(prefixes, '').trim();

  // Try exact match on stripped text first
  if (topicMap[stripped]) return { type: 'lesson', topic: topicMap[stripped] };
  if (categoryMap[stripped]) return { type: 'category', ...categoryMap[stripped] };

  // Try match on full text
  if (topicMap[text]) return { type: 'lesson', topic: topicMap[text] };
  if (categoryMap[text]) return { type: 'category', ...categoryMap[text] };

  // Fuzzy: check if any key is contained in the text
  for (const [key, topic] of Object.entries(topicMap)) {
    if (key.length >= 4 && text.includes(key)) {
      return { type: 'lesson', topic };
    }
  }
  for (const [key, cat] of Object.entries(categoryMap)) {
    if (key.length >= 4 && text.includes(key)) {
      return { type: 'category', ...cat };
    }
  }

  return null;
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
    await editMessage(env, chatId, messageId,
      `✅ Target tes diubah ke: ${test}\n\nKetik /help jika butuh bantuan.`
    );
    return;
  }
  if (data.startsWith('setting_level_')) {
    const level = data.replace('setting_level_', '');
    await env.DB.prepare('UPDATE users SET proficiency_level = ? WHERE id = ?').bind(level, user.id).run();
    await editMessage(env, chatId, messageId,
      `✅ Level diubah ke: ${level}\n\nKetik /help jika butuh bantuan.`
    );
    return;
  }

  // Onboarding: target test
  if (data.startsWith('target_')) {
    const target = data.replace('target_', '');
    if (target === 'back') {
      // Back to target selection
      await editMessage(env, chatId, messageId,
        `📋 *Step 1 dari 2 — Pilih Target Tes*\n\n` +
        `Kamu mau persiapan tes yang mana?`,
        testTypeKeyboard,
      );
      return;
    }
    if (target !== 'skip') {
      await env.DB.prepare('UPDATE users SET target_test = ? WHERE id = ?').bind(target, user.id).run();
    } else {
      // Skip = default to TOEFL_IBT
      await env.DB.prepare('UPDATE users SET target_test = ? WHERE id = ?').bind('TOEFL_IBT', user.id).run();
      await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/answerCallbackQuery`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          callback_query_id: query.id,
          text: '⚠️ Dilewati — default TOEFL iBT. Bisa diubah di /settings.',
        }),
      });
    }
    await editMessage(env, chatId, messageId,
      `📋 *Step 2 dari 2 — Pilih Level Bahasa Inggris*\n\n` +
      `Kira-kira level bahasa Inggris kamu sekarang gimana?`,
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
      `✅ Setup Selesai!`,
    );

    // Send celebration + main menu
    await sendMessage(env, chatId,
      `🎉✨ *Selamat, ${user.name}!*\n\n` +
      `Kamu sekarang terdaftar di EduBot!\n\n` +
      `📋 *Yang bisa kamu lakuin sekarang:*\n` +
      `• 📝 Latihan — simulasi tes penuh\n` +
      `• 📖 Belajar — grammar, vocab, materi\n` +
      `• 📊 Lihat progress — tracking skor\n` +
      `• 🩺 Diagnostic — tahu level kamu sekarang\n\n` +
      `💡 *Saran:* Mulai dengan /diagnostic untuk tahu skill kamu di titik mana!\n\n` +
      `Mau mulai dari mana?`,
      mainMenuKeyboard(env.WEBAPP_URL),
    );
    return;
  }

  // Study category sub-menus
  if (data === 'cat_grammar') {
    await editMessage(env, chatId, messageId, 'Grammar — pilih topik:', grammarKeyboard());
    return;
  }
  if (data === 'cat_vocab') {
    await editMessage(env, chatId, messageId, 'Vocabulary — pilih topik:', vocabKeyboard());
    return;
  }
  if (data === 'cat_skills') {
    await editMessage(env, chatId, messageId, 'Skills & Strategy — pilih topik:', skillsKeyboard());
    return;
  }
  if (data === 'cat_practice') {
    await editMessage(env, chatId, messageId, 'Latihan — mau ngapain?', practiceKeyboard());
    return;
  }
  if (data === 'back_study') {
    await editMessage(env, chatId, messageId, 'Mau belajar apa?', studyTopicKeyboard());
    return;
  }

  // Diagnostic completed — start study plan
  if (data === 'diag_start_studyplan') {
    await editMessage(env, chatId, messageId,
      `📅 *Buat Study Plan*\n\n` +
      `Kapan target tes kamu?\n\n` +
      `Contoh:\n` +
      `• "2 bulan lagi"\n` +
      `• "1 Juni 2026"\n` +
      `• "3 minggu lagi"`
    );
    return;
  }

  // Study topics
  if (data.startsWith('study_') || data.startsWith('lesson_')) {
    const freshUser = await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(user.id).first() as User;

    if (data === 'study_ask') {
      await editMessage(env, chatId, messageId, 'Oke, langsung aja ketik pertanyaan kamu! Tentang grammar, vocab, strategi tes, atau apapun tentang TOEFL/IELTS. Aku bantu jawab 💬');
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

      // Extract [AUDIO] content and send as TTS voice message
      const audioMatch = lesson.match(/\[AUDIO\]\s*([\s\S]+?)(?=\n\s*Soal:|\n\s*Question:|$)/i);
      if (audioMatch) {
        const audioText = audioMatch[1].trim();
        const questionText = lesson.replace(/\[AUDIO\]\s*([\s\S]+?)(?=\n\s*Soal:|\n\s*Question:|$)/i, '').trim();
        await sendTTSAudio(env, chatId, audioText);
        await sendMessage(env, chatId, questionText);
      } else {
        await sendMessage(env, chatId, lesson);
        // For pronunciation lessons, send audio examples
        if (weakness === 'pronunciation') {
          await sendTTSAudio(env, chatId, 'think. this. very. walked. needed. played.');
        }
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
      return;
    }
  }

    // Copy referral link
    if (data === 'copy_referral') {
      const botUsername = 'osee_IBT_IELTS_tutor_bot';
      const referralLink = `https://t.me/${botUsername}?start=${user.referral_code || ''}`;
      await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/answerCallbackQuery`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          callback_query_id: query.id,
          text: '📋 Link referral disalin! Bagikan ke teman.',
        }),
      });
      await editMessage(env, chatId, messageId,
        `📢 *Share Referral Link*\n\n` +
        `Bagikan link ini ke teman:\n\n` +
        `${referralLink}\n\n` +
        `Setiap teman yang daftar dan beli premium, kamu dapat hadiah!`
      );
      return;
    }

    if (data === 'referral_stats') {
      const { getReferralRewardDays } = await import('../services/premium');

      const rewards = await env.DB.prepare(
        `SELECT rr.*, u.name as referee_name 
         FROM referral_rewards rr 
         JOIN users u ON rr.referee_id = u.id 
         WHERE rr.referrer_id = ? ORDER BY rr.created_at DESC LIMIT 20`
      ).bind(user.id).all() as any;

      const paidCount = await env.DB.prepare(
        `SELECT COUNT(*) as c FROM referral_rewards WHERE referrer_id = ? AND status = 'earned'`
      ).bind(user.id).first() as any;

      const totalDays = await env.DB.prepare(
        `SELECT SUM(reward_days) as total FROM referral_rewards WHERE referrer_id = ? AND status = 'earned'`
      ).bind(user.id).first() as any;

      let msg = `📊 *Referral Stats*\n\n`;
      msg += `✅ Paid referrals: ${paidCount?.c || 0}\n`;
      msg += `🎁 Total days earned: ${totalDays?.total || 0} hari\n\n`;

      if (!rewards.results || rewards.results.length === 0) {
        msg += `Belum ada referral yang sudah payment.`;
      } else {
        msg += `*Riwayat:*\n`;
        for (const r of rewards.results) {
          const date = new Date(r.created_at).toLocaleDateString('id-ID', { day: '2-digit', month: 'short' });
          const status = r.status === 'earned' ? '✅' : r.status === 'pending' ? '⏳' : '❌';
          const days = r.reward_days > 0 ? `(+${r.reward_days} hari)` : '';
          msg += `${status} ${r.referee_name || 'User #'+r.referee_id} ${days} — ${date}\n`;
        }
      }

      await editMessage(env, chatId, messageId, msg);
      return;
    }

    // Premium purchase with Telegram Stars
    if (data === 'buy_stars') {
      await editMessage(env, chatId, messageId,
        `⭐ *Pembelian Premium via Telegram Stars*\n\n` +
        `Pilih paket:\n\n` +
        `1️⃣ 7 hari = 375 ⭐ (Rp 30.000)\n` +
        `2️⃣ 30 hari = 1.238 ⭐ (Rp 99.000)\n` +
        `3️⃣ 90 hari = 3.375 ⭐ (Rp 270.000)\n` +
        `4️⃣ 180 hari = 6.250 ⭐ (Rp 500.000)\n` +
        `5️⃣ 365 hari = 11.875 ⭐ (Rp 950.000)\n\n` +
        `Klik tombol di bawah untuk beli.`,
        {
          inline_keyboard: [
            [{ text: '1️⃣ 7 Hari', callback_data: 'sub_1' }],
            [{ text: '2️⃣ 30 Hari', callback_data: 'sub_2' }],
            [{ text: '3️⃣ 90 Hari', callback_data: 'sub_3' }],
            [{ text: '4️⃣ 180 Hari', callback_data: 'sub_4' }],
            [{ text: '5️⃣ 365 Hari', callback_data: 'sub_5' }],
            [{ text: '◀️ Kembali', callback_data: 'back_premium' }],
          ],
        }
      );
      return;
    }

    // Premium purchase with GoPay
    if (data === 'buy_gopay') {
      await editMessage(env, chatId, messageId,
        `💳 *Pembelian Premium via GoPay*\n\n` +
        `Transfer ke:\n\n` +
        `🟢 GoPay: 085643597072\n` +
        `   a.n. Leonardus Bayu Ari P\n\n` +
        `Setelah transfer, ketik:\n` +
        `/paid Sudah transfer GoPay 085643597072 a.n. Leonardus Bayu Ari P\n\n` +
        `atau hubungi @oseeadmin untuk konfirmasi.`,
        {
          inline_keyboard: [
            [{ text: '📤 Sudah Transfer', callback_data: 'gopay_confirm' }],
            [{ text: '◀️ Kembali', callback_data: 'back_premium' }],
          ],
        }
      );
      return;
    }

    // GoPay confirm - ask user to submit payment proof
    if (data === 'gopay_confirm') {
      await editMessage(env, chatId, messageId,
        `📋 *Submit Payment Proof*\n\n` +
        `Ketik command berikut dengan bukti transfer:\n\n` +
        `/paid Sudah transfer GoPay 085643597072 a.n. Leonardus Bayu Ari P\n\n` +
        `Ganti dengan screenshot atau detail transfer kamu.`
      );
      return;
    }

    // Back to premium menu
    if (data === 'back_premium') {
      const { checkPremium } = await import('../services/premium');
      const info = await checkPremium(env, user.id);
      if (info.is_premium) {
        await editMessage(env, chatId, messageId,
          `⭐ *Status Premium*\n\n` +
          `🎉 Premium aktif!\n` +
          `${info.days_remaining ? `Sisa hari: ${info.days_remaining} hari\n` : ''}` +
          `${info.trial_ends ? `Trial berakhir: ${new Date(info.trial_ends).toLocaleDateString('id-ID')}\n` : ''}` +
          `\nTerima kasih sudah upgrade!`
        );
      } else {
        await editMessage(env, chatId, messageId,
          `💎 *Upgrade Premium*\n\n` +
          `Dapatkan akses unlimited ke semua fitur:\n\n` +
          `✅ Unlimited soal latihan\n` +
          `✅ AI Tutor 24/7\n` +
          `✅ Speaking practice\n` +
          `✅ Study plan personal\n\n` +
          `Pilih metode pembayaran:`,
          {
            inline_keyboard: [
              [{ text: '⭐ via Telegram Stars', callback_data: 'buy_stars' }],
              [{ text: '📤 via GoPay', callback_data: 'buy_gopay' }],
            ],
          }
        );
      }
      return;
    }

    // Help category callbacks
    if (data === 'help_study') {
      await editMessage(env, chatId, messageId,
        `📚 *Perintah Belajar*\n\n` +
        `/diagnostic — Tes penempatan dulu\n` +
        `/study — Pilih topik belajar\n` +
        `/today — Pelajaran hari ini\n` +
        `/review — Review soal yang salah\n` +
        `/challenge @user — Duel 5 soal\n\n` +
        `💡 Kirim voice message = latihan speaking!`,
        { inline_keyboard: [[{ text: '◀️ Kembali', callback_data: 'help_main' }]] }
      );
      return;
    }
    if (data === 'help_progress') {
      await editMessage(env, chatId, messageId,
        `📊 *Progress & Profile*\n\n` +
        `/role — Lihat XP, level, badges\n` +
        `/settings — Ubah target tes & level\n` +
        `/certificate — Download sertifikat\n\n` +
        `📈 Skor kamu terus dipantau!`,
        { inline_keyboard: [[{ text: '◀️ Kembali', callback_data: 'help_main' }]] }
      );
      return;
    }
    if (data === 'help_premium') {
      await editMessage(env, chatId, messageId,
        `⭐ *Premium & Referral*\n\n` +
        `/premium — Cek status atau upgrade\n` +
        `/referral — Lihat kode & link referral\n\n` +
        `🎁 Ajak teman = dapat gratis!`,
        { inline_keyboard: [[{ text: '◀️ Kembali', callback_data: 'help_main' }]] }
      );
      return;
    }
    if (data === 'help_general') {
      await editMessage(env, chatId, messageId,
        `💬 *Perintah Umum*\n\n` +
        `/help — Menu help ini\n` +
        `/join KODE — Gabung kelas\n` +
        `/refer KODE — Pakai kode referral\n` +
        `/buy — Cara beli premium\n` +
        `/tos — Syarat & ketentuan\n\n` +
        `Kirim pesan apapun untuk chat dengan AI tutor!\n\n` +
        `📱 Butuh bantuan?\n` +
        `WhatsApp: wa.me/628112467784`,
        { inline_keyboard: [
          [{ text: '💳 Beli Premium', callback_data: 'buy_stars' }],
          [{ text: '◀️ Kembali', callback_data: 'help_main' }],
        ] }
      );
      return;
    }
    if (data === 'help_teacher') {
      await editMessage(env, chatId, messageId,
        `👨‍🏫 *Teacher Commands*\n\n` +
        `/admin — Dashboard siswa\n` +
        `/broadcast — Kirim ke semua siswa\n` +
        `/addclass — Hubungkan grup Telegram\n` +
        `/today — Check daily class activity`,
        { inline_keyboard: [[{ text: '◀️ Kembali', callback_data: 'help_main' }]] }
      );
      return;
    }
    if (data === 'help_admin') {
      await editMessage(env, chatId, messageId,
        `👑 *Admin Commands*\n\n` +
        `/stats — Statistik sistem\n` +
        `/promote @user role — Ubah role user\n` +
        `/teacher KODE — Buat kode guru baru\n` +
        `/markfounders — Mark founding students`,
        { inline_keyboard: [[{ text: '◀️ Kembali', callback_data: 'help_main' }]] }
      );
      return;
    }
    if (data === 'help_main') {
      // Refresh main help with role-appropriate buttons
      let inlineKeyboard: any[][] = [
        [{ text: '📚 Belajar', callback_data: 'help_study' }],
        [{ text: '📊 Progress', callback_data: 'help_progress' }],
        [{ text: '⭐ Premium', callback_data: 'help_premium' }],
        [{ text: '💬 Umum', callback_data: 'help_general' }],
      ];
      if (user.role === 'teacher' || user.role === 'admin') {
        inlineKeyboard.push([{ text: '👨‍🏫 Teacher', callback_data: 'help_teacher' }]);
      }
      if (user.role === 'admin') {
        inlineKeyboard.push([{ text: '👑 Admin', callback_data: 'help_admin' }]);
      }
      await editMessage(env, chatId, messageId,
        `🤖 *EduBot Help*\n\n` +
        `📋 Role kamu: *${user.role}*\n\n` +
        `Pilih kategori untuk lihat perintah:`,
        { inline_keyboard: inlineKeyboard }
      );
      return;
    }

    // Subscription purchase callbacks
    if (data.startsWith('sub_')) {
      const planMap: Record<string, { days: number; stars: number; label: string }> = {
        'sub_1': { days: 7, stars: 375, label: '7 Hari' },
        'sub_2': { days: 30, stars: 1238, label: '30 Hari' },
        'sub_3': { days: 90, stars: 3375, label: '90 Hari' },
        'sub_4': { days: 180, stars: 6250, label: '180 Hari' },
        'sub_5': { days: 365, stars: 11875, label: '365 Hari' },
      };
      const plan = planMap[data];
      if (!plan) return;

try {
        await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendInvoice`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            title: `EduBot Premium — ${plan.label}`,
            description: 'Akses premium EduBot tanpa batas. Unlimited soal, Speaking eval, Study plan.',
            payload: `premium_${user.id}_${plan.days}_${Date.now()}`,
            currency: 'XTR',
            prices: [{ label: `Premium ${plan.label}`, amount: plan.stars }],
          }),
        });
      } catch (e) {
        await editMessage(env, chatId, messageId, '❌ Gagal membuat invoice. Hubungi @oseeadmin.');
      }
      return;
    }

    // Teacher subscription purchase callbacks
    if (data.startsWith('teacher_sub_')) {
      if (user.role !== 'teacher' && user.role !== 'admin') {
        await editMessage(env, chatId, messageId, '⛔ Hanya guru yang bisa subscribe.');
        return;
      }

      const planMap: Record<string, { months: number; stars: number; label: string }> = {
        'teacher_sub_1': { months: 1, stars: 50000, label: '1 Bulan' },
        'teacher_sub_2': { months: 3, stars: 150000, label: '3 Bulan' },
        'teacher_sub_3': { months: 6, stars: 300000, label: '6 Bulan' },
        'teacher_sub_4': { months: 12, stars: 600000, label: '12 Bulan' },
      };
      const plan = planMap[data];
      if (!plan) return;

      try {
        await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendInvoice`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            title: `EduBot Teacher — ${plan.label}`,
            description: 'Subscription guru untuk kelola kelas. Akses dashboard, analytics, dan student management.',
            payload: `teacher_premium_${user.id}_${plan.months}_${Date.now()}`,
            currency: 'XTR',
            prices: [{ label: `Teacher ${plan.label}`, amount: plan.stars }],
          }),
        });
      } catch (e) {
        await editMessage(env, chatId, messageId, '❌ Gagal membuat invoice. Hubungi @oseeadmin.');
      }
      return;
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
