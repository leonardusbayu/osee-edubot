import type { Env, User } from '../types';
import { getTutorResponse } from '../services/ai';
import { getPrivateTutorResponse } from '../services/private-tutor';
import {
  startOnboarding,
  onTapStart,
  onPickTarget,
  onPickDeadline,
  onPickLevel,
  onPickCommit,
  onTrySubmit,
} from './onboarding';
import { maybeAppendNudge, toggleTips } from '../services/companion-nudge';

// Speaking practice prompts
const SPEAKING_PROMPTS: Record<string, string[]> = {
  TOEFL_IBT: [
    'Do you agree or disagree: It is better to study alone than in a group? Use specific reasons.',
    'Describe a place you have visited that impressed you. Explain why it was memorable.',
    'Some people prefer to live in a big city. Others prefer a small town. Which do you prefer and why?',
    'Talk about a teacher who has influenced you. Describe what made them special.',
    'Do you think technology helps or hinders communication between people?',
    'Describe an important event in your life and explain how it changed you.',
    'Some people think money is the most important factor in choosing a job. Do you agree?',
    'Talk about a book or movie that changed your perspective on something.',
    'What is your favorite season and why? Use specific reasons.',
    'Describe a skill you would like to learn and explain why it is important to you.',
  ],
  IELTS: [
    'Describe a time when you helped someone. What did you do and how did they react?',
    'Talk about a skill you would like to learn. Why is this skill important to you?',
    'Describe your favorite place to relax. What makes it special?',
    'Talk about a recent change in your life. How has it affected you?',
    'Describe a person you admire. What qualities do they have?',
    'Talk about a festival or celebration that is important in your culture.',
    'Describe something you bought recently that you are happy with.',
    'Talk about an activity you enjoy doing in your free time.',
    'Describe a piece of technology you find useful. Why do you find it helpful?',
    'Talk about a friend who is important to you. What makes them a good friend?',
  ],
  TOEIC: [
    'Describe your daily routine at work or school.',
    'Talk about a business meeting or presentation you attended.',
    'Describe the office or workplace where you spend most of your time.',
    'Talk about a professional goal you want to achieve.',
    'Describe a successful project you worked on.',
    'Talk about a challenge you faced at work and how you solved it.',
  ],
};

// ═══════════════════════════════════════════════════════
// SKILL-BASED EXERCISE DATA
// ═══════════════════════════════════════════════════════

const OPINION_TOPICS = [
  'Social media has more negative effects than positive effects on young people.',
  'Online education is just as effective as in-person learning.',
  'Everyone should learn at least one foreign language.',
  'Television has a negative effect on children\'s cognitive development.',
  'Young people should prioritize gaining work experience before pursuing higher education.',
  'Environmental protection should be the responsibility of governments, not individuals.',
  'Success in life is determined by hard work rather than luck.',
  'Reading physical books is more beneficial than reading digital books.',
  'Advertising has too much influence on consumer behavior.',
  'Remote work is more productive than working in an office.',
  'Universities should focus more on practical skills than theoretical knowledge.',
  'It is better to have a permanent job than to be self-employed.',
  'Traveling is more important than saving money.',
  'Traditional education methods are better than modern ones.',
  'Social networking websites have improved human relationships.',
  'Climate change is primarily caused by human activities.',
  'Government should invest more in renewable energy than traditional energy sources.',
  'Democracy is the best form of government.',
  'Wealthy nations have a responsibility to help developing countries.',
  'Food should be produced locally rather than imported.',
];

const ROLEPLAY_SCENARIOS = [
  {
    place: 'Bandara',
    situation: 'Pesawat kamu tertunda 3 jam. Minta alternatif ke staff.',
    role: 'penumpang'
  },
  {
    place: 'Restoran',
    situation: 'Kamu temukan rambut di makanan. Keluh polite ke pelayan.',
    role: 'pelanggan'
  },
  {
    place: 'Hotel',
    situation: 'AC kamarmu rusak. Hubungi reception untuk bantuan.',
    role: 'tamu'
  },
  {
    place: 'Toko',
    situation: 'Barang yang dibeli kemarin rusak. Minta pengembalian dana.',
    role: 'pembeli'
  },
  {
    place: 'Bank',
    situation: 'Ada masalah dengan transfer uang. Tanyakan ke customer service.',
    role: 'nasabah'
  },
  {
    place: 'Kantor dokter',
    situation: 'Diskusikan gejala sakit dengan dokter.',
    role: 'pasien'
  },
  {
    place: 'Kantor',
    situation: 'Minta extension deadline ke boss karena urgent project.',
    role: 'karyawan'
  },
  {
    place: 'Universitas',
    situation: 'Tanyakan tentang beasiswa ke admissions office.',
    role: 'calon siswa'
  },
];

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

export async function sendMessage(env: Env, chatId: number, text: string, replyMarkup?: any) {
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
  // Always store/query telegram_id as clean integer string (no ".0" suffix)
  const tgId = String(tgUser.id).replace('.0', '');

  let user = await env.DB.prepare(
    'SELECT * FROM users WHERE telegram_id = ?'
  ).bind(tgId).first() as User | null;

  if (!user) {
    const name = `${tgUser.first_name || ''} ${tgUser.last_name || ''}`.trim();
    // Generate referral code for new user
    const referralCode = `ref_${tgId}_${Date.now().toString(36)}`;
    // New users get 1-day trial
    const trialEnds = new Date();
    trialEnds.setDate(trialEnds.getDate() + 1);
    const trialEndsStr = trialEnds.toISOString();

    await env.DB.prepare(
      'INSERT INTO users (telegram_id, name, username, referral_code, is_premium, premium_until) VALUES (?, ?, ?, ?, 1, ?)'
    ).bind(tgId, name || 'User', tgUser.username || null, referralCode, trialEndsStr).run();

    user = await env.DB.prepare(
      'SELECT * FROM users WHERE telegram_id = ?'
    ).bind(tgId).first() as User;
  }

  return user;
}

/**
 * Inject an ID3v2.3 TLEN tag into an MP3 so players (including Telegram) can
 * read the total duration without scanning every frame. OpenAI `tts-1` MP3
 * output is CBR but has no XING/VBRI/ID3 header, so Telegram's probe reads 0
 * and displays an unplayable "00:00" widget even when we pass `duration` via
 * the bot API. Embedding TLEN in the file itself fixes it client-side.
 *
 * If the MP3 already carries an ID3v2 tag, strip it first so we don't stack two.
 */
function injectMp3Duration(mp3: ArrayBuffer, durationSec: number): ArrayBuffer {
  const mp3Bytes = new Uint8Array(mp3);

  // Skip an existing ID3v2 tag if present.
  let offset = 0;
  if (
    mp3Bytes.byteLength > 10 &&
    mp3Bytes[0] === 0x49 && mp3Bytes[1] === 0x44 && mp3Bytes[2] === 0x33
  ) {
    // ID3v2 size is syncsafe (7 bits per byte)
    const tagSize =
      (mp3Bytes[6] << 21) | (mp3Bytes[7] << 14) | (mp3Bytes[8] << 7) | mp3Bytes[9];
    offset = 10 + tagSize;
  }

  // TLEN body: encoding byte (0x00 = ISO-8859-1) + ASCII digits (ms)
  const durationMs = String(Math.max(1, Math.round(durationSec * 1000)));
  const textBytes = new TextEncoder().encode(durationMs);
  const frameBodySize = 1 + textBytes.byteLength;

  // ID3v2.3 frame header: 4-byte ID + 4-byte big-endian size + 2-byte flags
  const frame = new Uint8Array(10 + frameBodySize);
  frame[0] = 0x54; // 'T'
  frame[1] = 0x4c; // 'L'
  frame[2] = 0x45; // 'E'
  frame[3] = 0x4e; // 'N'
  frame[4] = (frameBodySize >>> 24) & 0xff;
  frame[5] = (frameBodySize >>> 16) & 0xff;
  frame[6] = (frameBodySize >>> 8) & 0xff;
  frame[7] = frameBodySize & 0xff;
  frame[8] = 0x00;
  frame[9] = 0x00;
  frame[10] = 0x00; // encoding
  frame.set(textBytes, 11);

  // ID3v2.3 tag header: "ID3" + version 2.3.0 + flags + syncsafe size
  const tagBodySize = frame.byteLength;
  const header = new Uint8Array(10);
  header[0] = 0x49; // 'I'
  header[1] = 0x44; // 'D'
  header[2] = 0x33; // '3'
  header[3] = 0x03;
  header[4] = 0x00;
  header[5] = 0x00;
  header[6] = (tagBodySize >>> 21) & 0x7f;
  header[7] = (tagBodySize >>> 14) & 0x7f;
  header[8] = (tagBodySize >>> 7) & 0x7f;
  header[9] = tagBodySize & 0x7f;

  const mp3Data = mp3Bytes.subarray(offset);
  const out = new Uint8Array(header.byteLength + frame.byteLength + mp3Data.byteLength);
  out.set(header, 0);
  out.set(frame, header.byteLength);
  out.set(mp3Data, header.byteLength + frame.byteLength);
  return out.buffer;
}

// Send TTS audio via Telegram.
// We request MP3 from OpenAI and deliver via sendAudio (not sendVoice).
// Why: OpenAI's `response_format: 'opus'` returns OGG Opus with missing/broken
// duration headers, which Telegram's sendVoice renders as an unplayable 00:00
// widget. MP3 via sendAudio is reliable, cached, and shows correct duration —
// as long as we also embed the duration inside the MP3 itself (see
// injectMp3Duration above), because Telegram ignores the API-level `duration`
// param in several clients and reads from the file instead.
async function sendTTSAudio(env: Env, chatId: number, text: string) {
  try {
    const { generateTTSAudioBuffer } = await import('../routes/tts');

    // Detect if text has speaker labels (Man:, Woman:, Professor:, etc.)
    const hasMultiSpeaker = /(?:Woman|Man|Male|Female|Professor|Instructor|Narrator|Student|Speaker)\s*[^:]*:/i.test(text);
    const audioBuffer = await generateTTSAudioBuffer(env, text, hasMultiSpeaker, 'alloy', 'mp3');

    if (!audioBuffer || audioBuffer.byteLength < 100) {
      console.error('TTS: generateTTSAudioBuffer returned null/empty for text:', text.substring(0, 80));
      await sendMessage(env, chatId, `🔊 Audio (teks):\n${text}\n\n⚠️ Audio gagal dimuat. Baca teks di atas sebagai pengganti.`);
      return;
    }

    // Estimate duration for Telegram. OpenAI `tts-1` MP3 is CBR without a
    // XING/VBRI header, so Telegram's own duration probe reads 0 and renders
    // a broken "00:00" widget that won't play on some clients. Passing an
    // explicit `duration` param fixes this entirely.
    //
    // Estimate two ways and take the max so we never understate:
    //   - bytes / ~18 KB/s  (OpenAI tts-1 mp3 is ~128-144 kbps ≈ 16-18 KB/s)
    //   - word_count * 0.36s  (typical TTS speaks ~165 WPM)
    const bytesEst = Math.ceil(audioBuffer.byteLength / 18000);
    const words = (text || '').trim().split(/\s+/).filter(Boolean).length;
    const wordsEst = Math.ceil(words * 0.36);
    const durationSec = Math.max(1, bytesEst, wordsEst);

    // Inject an ID3v2 TLEN tag into the MP3 so Telegram's *client-side* player
    // can read duration (the API-level `duration` param alone is insufficient —
    // several Telegram clients ignore it and probe the file).
    const taggedBuffer = injectMp3Duration(audioBuffer, durationSec);

    // Send via sendAudio with MP3 — plays reliably in Telegram with real duration.
    const formData = new FormData();
    formData.append('chat_id', String(chatId));
    formData.append('audio', new File([taggedBuffer], 'audio.mp3', { type: 'audio/mpeg' }));
    formData.append('title', 'EduBot Audio');
    formData.append('performer', 'EduBot');
    formData.append('duration', String(durationSec));

    const resp = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendAudio`, {
      method: 'POST',
      body: formData,
    });

    if (!resp.ok) {
      const err = await resp.text();
      console.error('TTS: sendAudio failed:', err);
      // Last-resort: send as voice. Telegram's sendVoice REQUIRES OGG Opus —
      // an MP3 there results in a broken widget too. Request a fresh OGG
      // buffer from OpenAI and ship that instead.
      try {
        const { generateTTSAudioBuffer } = await import('../routes/tts');
        const ogg = await generateTTSAudioBuffer(env, text, hasMultiSpeaker, 'alloy', 'opus');
        if (ogg) {
          const voiceForm = new FormData();
          voiceForm.append('chat_id', String(chatId));
          voiceForm.append('voice', new File([ogg], 'audio.ogg', { type: 'audio/ogg' }));
          voiceForm.append('duration', String(durationSec));
          const resp2 = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendVoice`, {
            method: 'POST',
            body: voiceForm,
          });
          if (!resp2.ok) {
            console.error('TTS: sendVoice fallback also failed:', await resp2.text());
            await sendMessage(env, chatId, `🔊 Audio:\n${text}`);
          }
        } else {
          await sendMessage(env, chatId, `🔊 Audio:\n${text}`);
        }
      } catch (fallbackErr) {
        console.error('TTS: opus fallback threw:', fallbackErr);
        await sendMessage(env, chatId, `🔊 Audio:\n${text}`);
      }
    }
  } catch (e) {
    console.error('TTS audio send error:', e);
    try {
      await sendMessage(env, chatId, `🔊 Audio:\n${text}`);
    } catch (fallbackErr) {
      console.error('TTS fallback message error:', fallbackErr);
    }
  }
}

// ═══════════════════════════════════════════════════════
// PHOTO SEND — for tutor-injected [VISUAL:concept:type] tags
// ═══════════════════════════════════════════════════════
// Upload bytes via multipart (not photo_url) because the image is served
// from /api/visual/:id/bytes on this same worker — Telegram can't reach
// a relative URL, and handing it an internal URL forces an extra round
// trip. Direct byte upload keeps it to one request.
async function sendPhoto(env: Env, chatId: number, photoBytes: ArrayBuffer, caption?: string, filename = 'visual.png', mimeType = 'image/png') {
  try {
    const form = new FormData();
    form.append('chat_id', String(chatId));
    form.append('photo', new File([photoBytes], filename, { type: mimeType }));
    if (caption) form.append('caption', caption);
    const resp = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendPhoto`, {
      method: 'POST',
      body: form,
    });
    if (!resp.ok) {
      const errText = await resp.text();
      console.error('sendPhoto failed:', errText);
      // Fallback: at least tell the student there was a visual so they
      // don't feel like the tutor silently dropped something. Caption
      // alone often carries the useful context.
      if (caption) await sendMessage(env, chatId, `🖼 (gambar gagal dimuat) ${caption}`);
    }
  } catch (e) {
    console.error('sendPhoto error:', e);
  }
}

// Resolve a [VISUAL:concept:type] tag: hit the cache, pull bytes from
// R2, send to Telegram as a photo. Swallows errors — a broken visual
// must never take down the tutor turn.
async function handleVisualTag(
  env: Env,
  chatId: number,
  userId: number,
  concept: string,
  type: string,
) {
  try {
    const svc = await import('../services/visual-explanation');
    const validTypes = ['analogy', 'diagram', 'misconception_contrast', 'worked_example'];
    if (!validTypes.includes(type)) {
      console.warn('[visual] tutor emitted invalid type, skipping:', type);
      return;
    }
    const result = await svc.getOrGenerateVisual(env, {
      concept,
      explanation_type: type as any,
      user_id: userId,
    });
    if (!result) return;
    const loaded = await svc.loadImageBytes(env, result.id);
    if (!loaded) return;
    // loaded.body is an R2 body stream; materialize to ArrayBuffer for
    // the multipart upload. R2 bodies are typically small (<1MB for
    // Nano Banana PNGs) so this is safe.
    const buf = await new Response(loaded.body as any).arrayBuffer();
    const prettyConcept = concept.replace(/_/g, ' ');
    const prettyType = type.replace(/_/g, ' ');
    await sendPhoto(env, chatId, buf, `${prettyConcept} — ${prettyType}`, `visual-${result.id}.png`, loaded.mime_type || 'image/png');
  } catch (e: any) {
    console.error('[visual] handleVisualTag failed (non-fatal):', e?.message || e);
  }
}

// Save messages to conversation history for context.
// Wrapped in try/catch because D1 write failures here must not cascade into the
// caller — losing a history row is cosmetic, but throwing would bubble up and
// kill the bot turn (e.g., the /lesson command would error after the user had
// already seen the lesson). Log and continue instead.
async function saveToHistory(env: Env, userId: number, userMsg: string, assistantMsg: string) {
  try {
    // Use persistConversationMessage so topic + is_confusion are tagged
    // per turn (BUGS.md #3). Previously these INSERTs wrote role+content
    // only — reports could count messages but not tell which concepts the
    // student was struggling with.
    const { persistConversationMessage } = await import('../services/chat-analysis');
    await persistConversationMessage(env, userId, 'user', userMsg);
    await persistConversationMessage(env, userId, 'assistant', assistantMsg);
  } catch (e) {
    console.warn('[webhook] saveToHistory failed (non-fatal):', e);
  }
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

function mainMenuKeyboard(webappUrl: string, tgId?: string | number) {
  // Ensure tg_id is clean (no .0 suffix) for URL params
  const cleanTgId = tgId ? String(tgId).replace('.0', '') : '';
  const tgParam = cleanTgId ? `?tg_id=${cleanTgId}` : '';
  return {
    keyboard: [
      [{ text: '📝 Latihan Tes', web_app: { url: `${webappUrl}/test${tgParam}` } }],
      [
        { text: '📖 Belajar' },
        { text: '🩺 Diagnostic' },
      ],
      [
        { text: '📊 Progress', web_app: { url: `${webappUrl}/progress${tgParam}` } },
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

function buildProgressBarInline(percent: number): string {
  const filled = Math.round(percent / 10);
  const empty = 10 - filled;
  return '[' + '█'.repeat(filled) + '░'.repeat(empty) + '] ' + percent + '%';
}

// ═══════════════════════════════════════════════════════
// SKILL-BASED LEARNING PATHS KEYBOARDS
// ═══════════════════════════════════════════════════════

function studyTopicKeyboard(targetTest?: string | null) {
  const testEmoji: Record<string, string> = {
    'TOEFL_IBT': '🇺🇸', 'IELTS': '🇬🇧', 'TOEFL_ITP': '📚', 'TOEIC': '🏢',
  };
  const tt = targetTest || 'TOEFL_IBT';
  const emoji = testEmoji[tt] || '📝';
  return {
    inline_keyboard: [
      [{ text: `${emoji} Target: ${tt.replace(/_/g, ' ')}  [Ganti →]`, callback_data: 'switch_test' }],
      [
        { text: '📖 Reading', callback_data: 'cat_reading' },
        { text: '🎧 Listening', callback_data: 'cat_listening' },
      ],
      [
        { text: '🗣 Speaking', callback_data: 'cat_speaking' },
        { text: '✍️ Writing', callback_data: 'cat_writing' },
      ],
      [
        { text: '📝 Grammar', callback_data: 'cat_grammar' },
        { text: '📚 Vocabulary', callback_data: 'cat_vocab' },
      ],
      [
        { text: '🏋️ Latihan', callback_data: 'cat_practice' },
        { text: '❓ Tanya Bebas', callback_data: 'study_ask' },
      ],
    ],
  };
}

function readingKeyboard(targetTest: string = '') {
  const rows: any[][] = [
    [{ text: '⚡ Speed Reading', callback_data: 'skill_speed_read' }],
    [{ text: '🔍 Scan & Find', callback_data: 'skill_scan_find' }],
    [{ text: '📖 Vocab in Context', callback_data: 'skill_vocab_context' }],
    [{ text: '📝 Summarize This', callback_data: 'skill_summarize' }],
  ];
  // Test-specific reading exercises
  if (targetTest === 'IELTS') {
    rows.push([{ text: '✅❌❓ True/False/Not Given', callback_data: 'skill_tfng' }]);
    rows.push([{ text: '🔤 Matching Headings', callback_data: 'skill_matching_headings' }]);
  }
  if (targetTest === 'TOEFL_IBT') {
    rows.push([{ text: '📌 Insert Sentence', callback_data: 'skill_insert_sentence' }]);
  }
  if (targetTest === 'TOEIC') {
    rows.push([{ text: '📧 Business Reading', callback_data: 'skill_biz_reading' }]);
  }
  if (targetTest === 'TOEFL_ITP') {
    rows.push([{ text: '🔧 Structure & Written Expression', callback_data: 'skill_structure_we' }]);
    rows.push([{ text: '✏️ Sentence Completion', callback_data: 'skill_sentence_completion' }]);
  }
  rows.push([{ text: '💡 Strategy Tips', callback_data: 'lesson_reading_strategy' }]);
  rows.push([{ text: '⬅️ Kembali', callback_data: 'back_study' }]);
  return { inline_keyboard: rows };
}

function listeningKeyboard(targetTest: string = '') {
  const rows: any[][] = [
    [{ text: '✍️ Dictation', callback_data: 'skill_dictation' }],
    [{ text: '📝 Note-Taking', callback_data: 'skill_note_take' }],
    [{ text: '🎯 Catch the Detail', callback_data: 'skill_catch_detail' }],
    [{ text: '🔥 Speed Listening', callback_data: 'skill_speed_listen' }],
  ];
  // Test-specific listening exercises
  if (targetTest === 'TOEIC') {
    rows.push([{ text: '📸 Photo Description', callback_data: 'skill_photo_desc' }]);
    rows.push([{ text: '💬 Quick Response', callback_data: 'skill_quick_response' }]);
  }
  rows.push([{ text: '🔗 Pronunciation Drill', callback_data: 'pronun_random' }]);
  rows.push([{ text: '⬅️ Kembali', callback_data: 'back_study' }]);
  return { inline_keyboard: rows };
}

function speakingKeyboard(targetTest: string = '') {
  const rows: any[][] = [
    [{ text: '📸 Describe Picture', callback_data: 'skill_describe_pic' }],
    [{ text: '💭 Express Opinion', callback_data: 'skill_opinion' }],
    [{ text: '🎭 Role Play', callback_data: 'skill_roleplay' }],
    [{ text: '🎤 Shadowing', callback_data: 'skill_shadow' }],
  ];
  // Test-specific speaking exercises
  if (targetTest === 'IELTS') {
    rows.push([{ text: '🎴 Cue Card (Part 2)', callback_data: 'skill_cue_card' }]);
  }
  if (targetTest === 'TOEFL_IBT') {
    rows.push([{ text: '🔗 Integrated Speaking', callback_data: 'skill_integrated_speak' }]);
  }
  rows.push([{ text: '📋 Templates', callback_data: 'lesson_speaking_templates' }]);
  rows.push([{ text: '⬅️ Kembali', callback_data: 'back_study' }]);
  return { inline_keyboard: rows };
}

function writingKeyboard(targetTest: string = '') {
  const rows: any[][] = [
    [{ text: '✏️ Fix Sentence', callback_data: 'skill_fix_sentence' }],
    [{ text: '🔄 Paraphrase', callback_data: 'skill_paraphrase' }],
    [{ text: '📊 Describe Chart', callback_data: 'skill_describe_chart' }],
    [{ text: '📧 Email Response', callback_data: 'skill_email_write' }],
    [{ text: '📄 Essay Builder', callback_data: 'skill_essay_build' }],
  ];
  // Test-specific writing exercises
  if (targetTest === 'TOEFL_IBT') {
    rows.push([{ text: '🔗 Integrated Writing', callback_data: 'skill_integrated_write' }]);
  }
  rows.push([{ text: '📋 Templates', callback_data: 'lesson_writing_templates' }]);
  rows.push([{ text: '⬅️ Kembali', callback_data: 'back_study' }]);
  return { inline_keyboard: rows };
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
      [{ text: '🔊 Pronunciation Drill', callback_data: 'pronun_random' }],
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
      [{ text: '🎛️ Admin Panel', web_app: { url: `${webappUrl}/admin/panel?tg_id=${tgId}` } }],
      [{ text: '📋 Manage Content', web_app: { url: `${webappUrl}/admin/content?tg_id=${tgId}` } }],
      [{ text: '👥 Students', web_app: { url: `${webappUrl}/admin/students?tg_id=${tgId}` } }],
      [{ text: '📊 Dashboard', web_app: { url: `${webappUrl}/dashboard?tg_id=${tgId}` } }],
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
      } catch (sendErr) {
        console.error('Failed to send error message to user:', sendErr);
      }
    }
  }
}

async function handleVoiceMessage(message: any, env: Env) {
  const chatId = message.chat.id;
  const tgUser = message.from;
  if (!tgUser) return;

  const user = await getOrCreateUser(env, tgUser);
  const voice = message.voice || message.audio;
  if (!voice) {
    await sendMessage(env, chatId, 'Gagal memproses audio. Voice message tidak terdeteksi.');
    return;
  }
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

    // Transcribe with Whisper (word-level timestamps for prosody analysis)
    const { transcribeWithTimestamps, analyzeProsody, prosodyContextForScorer } = await import('../services/prosody');
    const whisperResult = await transcribeWithTimestamps(env.OPENAI_API_KEY, audioBytes);
    const transcription = whisperResult.text;
    const prosodyMetrics = analyzeProsody(whisperResult.verbose);

    if (!transcription || transcription.length < 2) {
      await sendMessage(env, chatId, 'Tidak terdeteksi suara. Coba kirim ulang.');
      return;
    }

    // Log Whisper cost
    try {
      const duration = (voice.duration || 5) / 60;
      await env.DB.prepare('INSERT INTO api_usage (service, endpoint, tokens_used, cost_usd, user_id) VALUES (?, ?, ?, ?, ?)')
        .bind('openai-whisper', 'voice-input', voice.duration || 5, duration * 0.006, user.id).run();
    } catch (e) {
      console.error('Whisper cost tracking error:', e);
    }

    // Check for active speaking session
    try {
      const session = await env.DB.prepare(
        'SELECT * FROM speaking_sessions WHERE user_id = ? AND status = ? ORDER BY created_at DESC LIMIT 1'
      ).bind(user.id, 'active').first() as any;

      if (session) {
        // Handle IELTS 3-part multi-step flow
        const sessionMeta = session.feedback ? (() => { try { return JSON.parse(session.feedback); } catch { return null; } })() : null;
        if (sessionMeta?.mode === 'ielts_3part') {
          try {
            const part = sessionMeta.current_part || 1;
            sessionMeta.responses = sessionMeta.responses || [];
            sessionMeta.responses.push({ part, transcription });

            if (part === 1) {
              const idx = (sessionMeta.part1_index || 0) + 1;
              if (idx < sessionMeta.part1_questions.length) {
                // Next Part 1 question
                sessionMeta.part1_index = idx;
                await env.DB.prepare('UPDATE speaking_sessions SET feedback = ? WHERE id = ?')
                  .bind(JSON.stringify(sessionMeta), session.id).run();
                await sendMessage(env, chatId,
                  `✅ Diterima!\n\n❓ *Pertanyaan ${idx + 1}/${sessionMeta.part1_questions.length}:*\n"${sessionMeta.part1_questions[idx]}"\n\n🎙️ Kirim voice message.`);
                return;
              } else {
                // Move to Part 2
                sessionMeta.current_part = 2;
                await env.DB.prepare('UPDATE speaking_sessions SET feedback = ? WHERE id = ?')
                  .bind(JSON.stringify(sessionMeta), session.id).run();
                await sendMessage(env, chatId,
                  `✅ Part 1 selesai!\n\n` +
                  `🎯 *IELTS Speaking Test — Part 2*\n\n` +
                  `📋 *Cue Card:*\n"${sessionMeta.part2_cue}"\n\n` +
                  `Kamu harus membahas:\n• ${sessionMeta.part2_bullets.split(', ').join('\n• ')}\n\n` +
                  `⏱️ *Persiapan 1 menit, lalu bicara 1-2 menit.*\n🎙️ Kirim voice message saat siap.`);
                return;
              }
            } else if (part === 2) {
              // Move to Part 3 — generate follow-up questions based on Part 2 topic
              sessionMeta.current_part = 3;
              sessionMeta.part3_index = 0;
              const part3Questions = [
                `Why do you think ${sessionMeta.part2_cue.toLowerCase().includes('person') ? 'people' : 'this topic'} is important in society today?`,
                `How has this changed compared to the past?`,
                `What do you think will happen in the future regarding this?`,
                `Do you think there are any negative aspects? Why or why not?`,
                `How does this relate to your country or culture specifically?`,
              ];
              sessionMeta.part3_questions = part3Questions;
              await env.DB.prepare('UPDATE speaking_sessions SET feedback = ? WHERE id = ?')
                .bind(JSON.stringify(sessionMeta), session.id).run();
              await sendMessage(env, chatId,
                `✅ Part 2 selesai!\n\n` +
                `🎯 *IELTS Speaking Test — Part 3*\n\n` +
                `Examiner akan bertanya pertanyaan abstrak terkait topik Part 2.\n\n` +
                `❓ *Pertanyaan 1/5:*\n"${part3Questions[0]}"\n\n🎙️ Kirim voice message.`);
              return;
            } else if (part === 3) {
              const idx = (sessionMeta.part3_index || 0) + 1;
              if (idx < (sessionMeta.part3_questions?.length || 5)) {
                const question = sessionMeta.part3_questions?.[idx] || `Pertanyaan ${idx + 1}`;
                sessionMeta.part3_index = idx;
                await env.DB.prepare('UPDATE speaking_sessions SET feedback = ? WHERE id = ?')
                  .bind(JSON.stringify(sessionMeta), session.id).run();
                await sendMessage(env, chatId,
                  `✅ Diterima!\n\n❓ *Pertanyaan ${idx + 1}/5:*\n"${question}"\n\n🎙️ Kirim voice message.`);
                return;
              } else {
                // All 3 parts complete — do final scoring
                const allTranscripts = sessionMeta.responses.map((r: any) => r.transcription).join('\n\n');
                const { scoreInterview } = await import('../routes/speaking');
                const result = await scoreInterview(env.OPENAI_API_KEY, allTranscripts,
                  `IELTS 3-Part Speaking Test. Part 2 topic: ${sessionMeta.part2_cue}`, 'IELTS', 9);

                await env.DB.prepare(
                  'UPDATE speaking_sessions SET transcription = ?, score = ?, feedback = ?, status = ?, completed_at = ? WHERE id = ?'
                ).bind(allTranscripts, result.score, JSON.stringify({ ...result.criteria, mode: 'ielts_3part', response_count: sessionMeta.responses.length }),
                  'completed', new Date().toISOString(), session.id).run();

                if (result.dimensions) {
                  const d = result.dimensions;
                  try {
                    await env.DB.prepare(
                      `INSERT INTO speaking_dimension_scores
                         (session_id, user_id, test_type, fluency_coherence, lexical_resource,
                          grammar_range, pronunciation, relevancy_score, word_count, speaking_rate,
                          fluency_note, lexical_note, grammar_note, pronunciation_note)
                       VALUES (?, ?, 'IELTS', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
                    ).bind(session.id, user.id, d.fluency_coherence, d.lexical_resource,
                      d.grammar_range, d.pronunciation, d.relevancy_score,
                      result.word_count || 0, null,
                      d.fluency_note, d.lexical_note, d.grammar_note, d.pronunciation_note).run();
                  } catch (e) { console.error('3part dim insert error:', e); }
                }

                const dim = result.dimensions;
                await sendMessage(env, chatId,
                  `🎯 *IELTS Speaking Test — SELESAI!*\n\n` +
                  `⭐ *Skor Keseluruhan: ${result.score}/9*\n\n` +
                  `📊 *4 Dimensi:*\n` +
                  (dim ? `🗣 Fluency & Coherence: *${dim.fluency_coherence}*\n` +
                    `📚 Lexical Resource: *${dim.lexical_resource}*\n` +
                    `✏️ Grammar Range: *${dim.grammar_range}*\n` +
                    `🔊 Pronunciation: *${dim.pronunciation}*\n` : '') +
                  `\n📝 Respon: ${sessionMeta.responses.length} jawaban (Part 1-3)\n\n` +
                  `✅ *Kelebihan:* ${result.strengths}\n` +
                  `🎯 *Untuk diperbaiki:* ${result.improvement}\n\n` +
                  `💡 ${result.feedback}`);
                return;
              }
            }
          } catch (e: any) {
            console.error('3-part speaking error:', e);
            await sendMessage(env, chatId, 'Gagal memproses IELTS 3-part. Coba lagi.');
            return;
          }
        }

        // Score the speaking response using GPT-4o with 4-dimension rubric + prosody
        try {
          const { scoreInterview } = await import('../routes/speaking');
          const maxBand = session.test_type === 'IELTS' ? 9 : 6;
          const prosodyCtx = prosodyContextForScorer(prosodyMetrics);
          const result = await scoreInterview(env.OPENAI_API_KEY, transcription, session.prompt, session.test_type, maxBand, prosodyCtx);

          // Update session with results
          await env.DB.prepare(
            'UPDATE speaking_sessions SET transcription = ?, score = ?, feedback = ?, status = ?, completed_at = ? WHERE id = ?'
          ).bind(
            transcription,
            result.score,
            JSON.stringify(result.criteria),
            'completed',
            new Date().toISOString(),
            session.id
          ).run();

          // Store per-dimension scores + prosody for trend tracking
          if (result.dimensions) {
            const d = result.dimensions;
            const wpm = prosodyMetrics.words_per_minute || (voice.duration && voice.duration > 0
              ? Math.round((result.word_count || 0) / (voice.duration / 60))
              : null);
            try {
              await env.DB.prepare(
                `INSERT INTO speaking_dimension_scores
                   (session_id, user_id, test_type, fluency_coherence, lexical_resource,
                    grammar_range, pronunciation, relevancy_score, word_count, speaking_rate,
                    fluency_note, lexical_note, grammar_note, pronunciation_note,
                    prosody_wpm, prosody_pause_ratio, prosody_long_pauses, prosody_fillers,
                    prosody_repetitions, prosody_fluency_score, prosody_rhythm_score,
                    prosody_overall, prosody_raw)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
              ).bind(
                session.id, user.id, session.test_type,
                d.fluency_coherence, d.lexical_resource, d.grammar_range, d.pronunciation,
                d.relevancy_score, result.word_count || 0, wpm,
                d.fluency_note, d.lexical_note, d.grammar_note, d.pronunciation_note,
                prosodyMetrics.words_per_minute, prosodyMetrics.pause_ratio,
                prosodyMetrics.long_pauses, prosodyMetrics.filler_count,
                prosodyMetrics.repetition_count, prosodyMetrics.fluency_score,
                prosodyMetrics.rhythm_score, prosodyMetrics.overall_delivery,
                prosodyMetrics.raw_json
              ).run();
            } catch (e) {
              console.error('Dimension score insert error:', e);
            }
          }

          // Log speaking evaluation cost (estimate: ~200 tokens with dimensions)
          try {
            await env.DB.prepare('INSERT INTO api_usage (service, endpoint, tokens_used, cost_usd, user_id) VALUES (?, ?, ?, ?, ?)')
              .bind('openai-gpt4o', 'speaking-eval', 200, 0.002, user.id).run();
          } catch (e) {
            console.error('Speaking eval cost tracking error:', e);
          }

          // Build dimension display
          const dim = result.dimensions;
          const dimText = dim
            ? `🗣 Fluency & Coherence: *${dim.fluency_coherence}*\n` +
              `📚 Lexical Resource: *${dim.lexical_resource}*\n` +
              `✏️ Grammar Range: *${dim.grammar_range}*\n` +
              `🔊 Pronunciation: *${dim.pronunciation}*`
            : `• Fluency: ${result.criteria.fluency_coherence || '—'}\n` +
              `• Lexical: ${result.criteria.lexical_resource || '—'}\n` +
              `• Grammar: ${result.criteria.grammar_range || '—'}\n` +
              `• Pronunciation: ${result.criteria.pronunciation || '—'}`;

          const dimNotes = dim && (dim.fluency_note || dim.grammar_note)
            ? `\n\n🔍 *Detail:*\n` +
              (dim.fluency_note ? `• _${dim.fluency_note}_\n` : '') +
              (dim.lexical_note ? `• _${dim.lexical_note}_\n` : '') +
              (dim.grammar_note ? `• _${dim.grammar_note}_\n` : '') +
              (dim.pronunciation_note ? `• _${dim.pronunciation_note}_` : '')
            : '';

          // Prosody insights line
          const prosodyText = prosodyMetrics.words_per_minute > 0
            ? `\n\n🎵 *Delivery Analysis:*\n` +
              `• Kecepatan: ${prosodyMetrics.words_per_minute} kata/menit` +
              (prosodyMetrics.words_per_minute < 100 ? ' _(agak lambat)_' : prosodyMetrics.words_per_minute > 180 ? ' _(terlalu cepat)_' : ' _(bagus!)_') +
              `\n• Jeda panjang: ${prosodyMetrics.long_pauses}` +
              (prosodyMetrics.long_pauses > 3 ? ' _(kurangi jeda panjang)_' : '') +
              `\n• Filler words: ${prosodyMetrics.filler_count}` +
              (prosodyMetrics.filler_count > 5 ? ' _(terlalu banyak um/uh)_' : '') +
              `\n• Delivery score: ${prosodyMetrics.overall_delivery}/100`
            : '';

          // Send detailed feedback with 4 dimensions + prosody
          await sendMessage(env, chatId,
            `🎤 *Speaking Evaluation*\n\n` +
            `📝 *Kamu berkata:* "${transcription}"\n\n` +
            `⭐ *Skor Keseluruhan:* ${result.score}/${maxBand}\n\n` +
            `📊 *4 Dimensi Penilaian:*\n${dimText}` +
            dimNotes +
            prosodyText +
            `\n\n✅ *Kelebihan:* ${result.strengths || 'Bagus!'}\n\n` +
            `🎯 *Untuk diperbaiki:* ${result.improvement || 'Terus praktik!'}\n\n` +
            `💡 *Feedback:* ${result.feedback || 'Tidak bisa memberikan feedback.'}`
          );
          return;
        } catch (e: any) {
          console.error('Speaking scoring error:', e);
          await sendMessage(env, chatId, 'Gagal menilai speaking. Coba lagi.');
          return;
        }
      }
    } catch (e: any) {
      console.error('Speaking session check error:', e);
      // Continue with normal message handling if session check fails
    }

    // Check for active exercise session awaiting voice input
    try {
      const activeExercise = await env.DB.prepare(
        `SELECT * FROM exercise_sessions WHERE user_id = ? AND status = 'active' ORDER BY created_at DESC LIMIT 1`
      ).bind(user.id).first() as any;

      if (activeExercise) {
        const meta = JSON.parse(activeExercise.metadata || '{}');
        if (meta.input === 'voice') {
          const { scoreTextAnswer, getStepDisplay, getStepInputType, getTotalSteps, renderSummary } = await import('../services/exercise-engine');

          // For voice exercises, use transcription as the answer
          await sendMessage(env, chatId, `🎤 *Kamu bilang:* "${transcription}"`);

          const { score, feedback } = await scoreTextAnswer(env, activeExercise.type, meta.lesson, meta.step, transcription);
          meta.scores.push(score);

          // Theory-of-Mind: record evidence for voice-answered exercise
          try {
            const { recordEvidence } = await import('../services/mental-model');
            const evidenceType = score >= 60 ? 'correct_answer' : 'wrong_answer';
            const weight = score >= 80 ? 0.7 : score >= 50 ? 0.4 : 0.6;
            await recordEvidence(env, user.id, activeExercise.type, evidenceType, `voice step ${meta.step} score=${score}`, weight);
          } catch (e) { console.error('recordEvidence (voice) error:', e); }

          meta.step += 1;
          const total = getTotalSteps(activeExercise.type);

          if (meta.step >= total) {
            meta.input = null;
            const avgScore = meta.scores.length > 0 ? Math.round(meta.scores.reduce((a: number, b: number) => a + b, 0) / meta.scores.length) : 0;
            await env.DB.prepare(
              'UPDATE exercise_sessions SET status = ?, score = ?, metadata = ?, completed_at = ? WHERE id = ?'
            ).bind('completed', avgScore, JSON.stringify(meta), new Date().toISOString(), activeExercise.id).run();
            await sendMessage(env, chatId, feedback);
            const summary = renderSummary(activeExercise.type, meta.lesson, meta.scores, meta.hints || 0);
            await sendMessage(env, chatId, summary.text, summary.keyboard);
          } else {
            meta.input = null;
            await env.DB.prepare(
              'UPDATE exercise_sessions SET metadata = ? WHERE id = ?'
            ).bind(JSON.stringify(meta), activeExercise.id).run();

            await sendMessage(env, chatId, feedback, {
              inline_keyboard: [[{ text: '➡️ Soal Berikutnya', callback_data: `ex_n_${activeExercise.id}` }]],
            });
          }
          return;
        }
      }
    } catch (e: any) {
      console.error('Exercise voice handler error:', e);
    }

    // Show what was heard
    await sendMessage(env, chatId, `Aku dengar: "${transcription}"`);

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

        // "Ask AI why" deep link — frontend stored the question server-side,
        // we retrieve it here and kick off a tutor response directly.
        if (startParam === 'ask') {
          try {
            const pending = await env.DB.prepare(
              `SELECT question FROM pending_tutor_questions
               WHERE user_id = ? AND datetime(created_at) > datetime('now', '-1 hour')`
            ).bind(user.id).first() as any;

            if (pending?.question) {
              // Consume immediately so it can't be replayed
              await env.DB.prepare(
                'DELETE FROM pending_tutor_questions WHERE user_id = ?'
              ).bind(user.id).run();

              // Acknowledge, then stream tutor response
              await sendMessage(env, chatId, '🤖 Oke, aku bantuin jelasin kenapa salah...');

              try {
                const { getTutorResponse } = await import('../services/ai');
                const reply = await getTutorResponse(env, user, pending.question);
                await sendMessage(env, chatId, reply);
              } catch (e) {
                console.error('ask-why tutor error:', e);
                await sendMessage(env, chatId, 'Maaf, AI-nya lagi error. Coba ketik pertanyaanmu langsung ya.');
              }
              return;
            } else {
              await sendMessage(env, chatId, 'Pertanyaan kamu udah expired (atau gagal disimpan). Ketik pertanyaannya langsung ke sini ya, aku jawab!');
              return;
            }
          } catch (e) {
            console.error('ask deep-link error:', e);
          }
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
          const testEmoji: Record<string, string> = {
            'TOEFL_IBT': '🇺🇸', 'IELTS': '🇬🇧', 'TOEFL_ITP': '📚', 'TOEIC': '🏢',
          };
          const tt = user.target_test || 'TOEFL_IBT';
          const tEmoji = testEmoji[tt] || '📝';

          // Streak badge
          const streak = Number(user.current_streak || 0);
          let streakLine = '';
          if (streak >= 2) {
            const fire = streak >= 30 ? '🔥🔥🔥' : streak >= 7 ? '🔥🔥' : '🔥';
            streakLine = `\n${fire} Streak: *${streak} hari berturut-turut!*`;
          } else if (streak === 1) {
            streakLine = `\n✨ Baru mulai streak — jaga terus biar ada api-nya! 🔥`;
          }

          await sendMessage(env, chatId,
            `Halo lagi, ${user.name}! 👋\n\n${tEmoji} Target: *${tt.replace(/_/g, ' ')}*${streakLine}\n\nMau ngapain hari ini?`,
            mainMenuKeyboard(env.WEBAPP_URL, user.telegram_id),
          );
        } else {
          // Conversational 6-screen onboarding (welcome → target → deadline
          // → level → commitment → try-one → handoff). Resumes from last
          // screen if the user /start'd mid-flow.
          await startOnboarding(env, chatId, user, tgUser.first_name);
        }
        return;
      }

      case '/help': {
        // Role-based interactive help
        const studentHelp = `📚 *Perintah Belajar*\n\n` +
          `/diagnostic — Tes penempatan dulu\n` +
          `/study — Pilih topik belajar\n` +
          `/lesson — Lesson plan personal (AI)\n` +
          `/today — Pelajaran hari ini\n` +
          `/review — Review soal (FSRS adaptive)\n` +
          `/speak — Latihan speaking (voice message)\n` +
          `/pronounce — Drill pronunciation 254 kata\n` +
          `/challenge @user — Duel 5 soal\n\n` +
          `💡 *Tips:* Kirim voice message untuk tutor 24/7!`;

        const progressHelp = `📊 *Progress & Profile*\n\n` +
          `/progress — Lihat semua statistik kamu\n` +
          `/profile — Profil lengkap + mental model\n` +
          `/plan — Lihat semua lesson plans\n` +
          `/mystyle — Atur gaya belajar & komunikasi\n` +
          `/role — Lihat XP, level, badges\n` +
          `/settings — Ubah target tes & level\n` +
          `/certificate — Download sertifikat\n\n` +
          `📈 *Tracking:* Skor kamu terus dipantau otomatis!`;

        const premiumHelp = `⭐ *Premium & Referral*\n\n` +
          `/premium — Cek status atau upgrade\n` +
          `/redeem KODE — Tukar kode premium (dari guru)\n` +
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
          `/gencodes N DAYS label — Generate N premium codes\n` +
          `/codestatus [batch] — Check code redemption rate\n` +
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
              `Kamu adalah siswa pilot pertama kami! Akses premium gratis selamanya.\n\n` +
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

      case '/leaderboard':
      case '/league': {
        // Previously the league data (user_leagues, league_history) was
        // populated but never surfaced to users — data dead-ended in the
        // DB. This exposes the weekly leaderboard + the user's own rank.
        // Tracks P2 BUGS.md #9.
        try {
          const { getLeagueProfile, getLeagueLeaderboard } = await import('../services/leagues');
          const profile = await getLeagueProfile(env, user.id);
          const leaderboard = await getLeagueLeaderboard(env, profile.league, 10);

          const leagueEmoji: Record<string, string> = {
            bronze: '🥉',
            silver: '🥈',
            gold: '🥇',
            diamond: '💎',
            champion: '👑',
          };
          const emoji = leagueEmoji[profile.league] || '🏆';
          const leagueName = profile.league.charAt(0).toUpperCase() + profile.league.slice(1);

          let msg = `${emoji} *${leagueName} League — Minggu ini*\n\n`;
          msg += `Kamu: #${profile.rank}/${profile.total_in_league} (${profile.weekly_xp} XP)\n\n`;
          msg += `*Top 10:*\n`;

          if (leaderboard.length === 0) {
            msg += `Belum ada yang earn XP minggu ini. Jadi yang pertama! 💪`;
          } else {
            const rows = leaderboard as any[];
            for (let i = 0; i < rows.length; i++) {
              const r = rows[i];
              const name = r.full_name || r.username || `User ${r.user_id}`;
              const marker = r.user_id === user.id ? '👉 ' : '';
              const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `  ${i + 1}.`;
              msg += `${marker}${medal} ${name} — ${r.weekly_xp} XP\n`;
            }
          }

          msg += `\n━━━━━━━━━━━━━\n`;
          msg += `Kumpulkan XP sebanyak mungkin sebelum Minggu malam — top 20% naik league, bottom 20% turun. Jawab soal, review, speaking = XP.`;

          await sendMessage(env, chatId, msg);
        } catch (e: any) {
          console.error('/leaderboard error:', e);
          await sendMessage(env, chatId, 'Leaderboard belum bisa dimuat. Coba lagi nanti.');
        }
        return;
      }

      case '/shop':
      case '/toko': {
        // Coin shop UI. Table was seeded in migration 041 but never had a
        // surface — coins accumulated silently. This exposes the 5 items
        // with inline buttons; purchase is handled by the shop_buy_<id>
        // callback below. Tracks P2 BUGS.md #8.
        try {
          const { getUserBalance } = await import('../services/coins');
          const balance = await getUserBalance(env, user.id);

          const items = await env.DB.prepare(
            `SELECT id, name, description, price, icon FROM coin_shop
               WHERE active = 1 ORDER BY price ASC`
          ).all();

          let msg = `🪙 *Shop — Balance: ${balance} coins*\n\n`;
          const keyboard: any[][] = [];

          for (const raw of (items.results || []) as any[]) {
            msg += `${raw.icon} *${raw.name}* — ${raw.price} coins\n${raw.description}\n\n`;
            const canAfford = balance >= raw.price;
            keyboard.push([{
              text: `${canAfford ? raw.icon : '🔒'} ${raw.name} (${raw.price})`,
              callback_data: `shop_buy_${raw.id}`,
            }]);
          }

          msg += `Coins didapat dari latihan — makin banyak jawab soal, makin banyak coins. Random bonus drops juga (1 in 5).`;

          await sendMessage(env, chatId, msg, { inline_keyboard: keyboard });
        } catch (e: any) {
          console.error('/shop error:', e);
          await sendMessage(env, chatId, 'Shop belum bisa dimuat. Coba lagi nanti.');
        }
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

      case '/referral_leaderboard':
      case '/leaderboard_referral': {
        // Weekly top-10 referrers (signups in last 7 days)
        const top = await env.DB.prepare(
          `SELECT u.id, u.name, COUNT(ref.id) as count
           FROM users u
           JOIN users ref ON ref.referred_by = u.id
           WHERE ref.created_at >= datetime('now', '-7 days')
           GROUP BY u.id, u.name
           ORDER BY count DESC
           LIMIT 10`
        ).all() as any;

        let msg = `🏆 *Top Referrer Minggu Ini*\n\n`;
        if (!top.results || top.results.length === 0) {
          msg += `Belum ada referral minggu ini. Jadi yang pertama! 🚀\n\nKetik /referral buat ambil kode kamu.`;
        } else {
          const medals = ['🥇', '🥈', '🥉'];
          for (let i = 0; i < top.results.length; i++) {
            const r = top.results[i];
            const rank = medals[i] || `${i + 1}.`;
            const name = (r.name || `User ${r.id}`).substring(0, 20);
            msg += `${rank} ${name} — ${r.count} referral\n`;
          }
          // Where am I?
          const myRank = await env.DB.prepare(
            `SELECT COUNT(*) as c FROM (
               SELECT u.id, COUNT(ref.id) as cnt
               FROM users u
               JOIN users ref ON ref.referred_by = u.id
               WHERE ref.created_at >= datetime('now', '-7 days')
               GROUP BY u.id
               HAVING cnt > (
                 SELECT COUNT(*) FROM users ref2 WHERE ref2.referred_by = ? AND ref2.created_at >= datetime('now', '-7 days')
               )
             )`
          ).bind(user.id).first() as any;
          const myCount = await env.DB.prepare(
            `SELECT COUNT(*) as c FROM users WHERE referred_by = ? AND created_at >= datetime('now', '-7 days')`
          ).bind(user.id).first() as any;
          msg += `\n📍 Posisi kamu: #${(myRank?.c || 0) + 1} (${myCount?.c || 0} referral minggu ini)`;
        }
        msg += `\n\n💡 Reward: setiap referral yang upgrade premium = +7 hari premium gratis buat kamu.`;

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

      case '/progress': {
        // Unified on buildStudentReport — previously this command and
        // /profile hand-rolled overlapping SQL which drifted. Now both
        // read from the canonical report; the formatters decide what
        // view to surface. Tracks P2 BUGS.md #7.
        try {
          const { buildStudentReport } = await import('../services/student-report');
          const { formatProgressMessage } = await import('../services/bot-report-formatters');
          const report = await buildStudentReport(env, user.id);
          if (!report) {
            await sendMessage(env, chatId, 'Belum ada data progress. Mulai dengan /test atau /diagnostic.');
            return;
          }
          await sendMessage(env, chatId, formatProgressMessage(report), mainMenuKeyboard(env.WEBAPP_URL, user.telegram_id));
        } catch (e) {
          console.error('Progress command error:', e);
          await sendMessage(env, chatId, 'Gagal memuat progress. Coba lagi nanti.');
        }
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
        await sendMessage(env, chatId, '📚 *Menu Belajar*\n\nPilih skill yang mau dilatih:', studyTopicKeyboard(user.target_test || 'TOEFL_IBT'));
        return;

      // ═══════════════════════════════════════════════════════
      // PERSONALIZED LEARNING COMMANDS
      // ═══════════════════════════════════════════════════════

      case '/mystyle': {
        // Set learning preferences (Ranedeer-style)
        await sendMessage(env, chatId,
          `🎨 *Personalisasi Gaya Belajar*\n\n` +
          `Pilih gaya belajar yang paling cocok buat kamu:`,
          {
            inline_keyboard: [
              [
                { text: '👁️ Visual', callback_data: 'style_learn_visual' },
                { text: '💬 Verbal', callback_data: 'style_learn_verbal' },
              ],
              [
                { text: '🏃 Active', callback_data: 'style_learn_active' },
                { text: '🤔 Reflective', callback_data: 'style_learn_reflective' },
              ],
              [
                { text: '⚖️ Balanced (default)', callback_data: 'style_learn_balanced' },
              ],
            ],
          }
        );
        return;
      }

      case '/profile': {
        // Unified on buildStudentReport alongside /progress — see the
        // /progress handler above for rationale. The formatter returns a
        // profile-shaped view of the same canonical data. BUGS.md #7.
        try {
          const { buildStudentReport } = await import('../services/student-report');
          const { formatProfileMessage } = await import('../services/bot-report-formatters');
          const report = await buildStudentReport(env, user.id);
          if (!report) {
            await sendMessage(env, chatId, 'Belum ada profil. Mulai dengan /test atau /diagnostic dulu.');
            return;
          }
          await sendMessage(env, chatId, formatProfileMessage(report), {
            inline_keyboard: [
              [
                { text: '🎨 Ubah Gaya Belajar', callback_data: 'profile_change_style' },
                { text: '🎯 Set Target Score', callback_data: 'profile_set_target' },
              ],
              [
                { text: '📝 Mulai Lesson Plan', callback_data: 'start_lesson_plan' },
              ],
            ],
          });
        } catch (e) {
          console.error('Profile command error:', e);
          await sendMessage(env, chatId, 'Gagal memuat profil. Coba lagi nanti.');
        }
        return;
      }

      case '/lesson': {
        // Generate or continue personalized lesson plan
        const { getActivePlan, generatePersonalizedPlan, formatTopicName } = await import('../services/lesson-engine');

        const activePlan = await getActivePlan(env, user.id);

        const step = activePlan?.lessons?.[activePlan.current_step];
        if (activePlan && activePlan.current_step < activePlan.total_steps && step) {
          // Continue existing plan
          const progressBar = buildProgressBarInline(activePlan.progress_percent);

          let msg = `📖 *${activePlan.title}*\n`;
          msg += `Step ${(step.index ?? activePlan.current_step) + 1}/${activePlan.total_steps} ${progressBar}\n\n`;
          msg += `*${step.title || 'Lesson step'}*\n`;
          msg += `(${step.expected_minutes ?? 5} menit)\n\n`;
          msg += `Ketik sesuatu untuk mulai step ini, atau "skip" untuk lanjut ke step berikutnya.`;

          await sendMessage(env, chatId, msg, {
            inline_keyboard: [
              [
                { text: '▶️ Mulai Step Ini', callback_data: `lesson_start_${activePlan.id}` },
                { text: '⏭️ Skip', callback_data: `lesson_skip_${activePlan.id}` },
              ],
              [
                { text: '⏸️ Pause Plan', callback_data: `lesson_pause_${activePlan.id}` },
              ],
            ],
          });
        } else {
          // Generate new plan
          await sendMessage(env, chatId, '🤖 Generating lesson plan berdasarkan analisis profilmu...');
          try {
            const plan = await generatePersonalizedPlan(env, user);
            const skills = plan.target_skills.map(s => formatTopicName(s)).join(', ');

            let msg = `📖 *Lesson Plan Baru!*\n\n`;
            msg += `*${plan.title}*\n`;
            msg += `${plan.description}\n\n`;
            msg += `📚 Skills: ${skills}\n`;
            msg += `⏱️ Estimasi: ${plan.estimated_minutes} menit\n`;
            msg += `📝 ${plan.total_steps} steps\n\n`;
            msg += `Ketik /lesson lagi untuk mulai!`;

            await sendMessage(env, chatId, msg);
          } catch (e: any) {
            console.error('Lesson plan error:', e);
            await sendMessage(env, chatId, 'Gagal generate lesson plan. Coba lagi nanti ya.');
          }
        }
        return;
      }

      case '/plan': {
        // Show all lesson plans (active and completed)
        const plans = await env.DB.prepare(
          `SELECT id, title, plan_type, status, progress_percent, total_steps, current_step, estimated_minutes, created_at
           FROM lesson_plans WHERE user_id = ? ORDER BY created_at DESC LIMIT 10`
        ).bind(user.id).all();

        if (!plans.results || plans.results.length === 0) {
          await sendMessage(env, chatId,
            `📋 Belum ada lesson plan.\n\nKetik /lesson untuk generate plan pertamamu!`
          );
          return;
        }

        let msg = `📋 *Lesson Plans*\n\n`;
        for (const p of plans.results as any[]) {
          const statusIcon = p.status === 'completed' ? '✅' : p.status === 'active' ? '▶️' : '⏸️';
          const progress = buildProgressBarInline(p.progress_percent);
          msg += `${statusIcon} *${p.title}*\n`;
          msg += `   ${progress} (${p.current_step}/${p.total_steps} steps)\n`;
          msg += `   ${p.plan_type} | ${p.estimated_minutes}min\n\n`;
        }

        await sendMessage(env, chatId, msg);
        return;
      }

      case '/review': {
        // Cancel any existing review session first
        await env.DB.prepare('DELETE FROM review_sessions WHERE user_id = ?').bind(user.id).run();

        const { getDueReviews, getReviewStats, getNextUpcomingReview, getFallbackPractice } = await import('../services/fsrs-engine');
        const stats = await getReviewStats(env, user.id);
        if (stats.due === 0) {
          const masteredNote = stats.mastered > 0 ? ` Kamu udah kuasai ${stats.mastered} item — keren!` : '';

          // Zero-queue fallback: tell user when next review is + suggest alternative practice
          const upcoming = await getNextUpcomingReview(env, user.id);
          let nextLine = '';
          if (upcoming) {
            const mins = upcoming.minutes_until;
            if (mins < 60) nextLine = `\n\n⏰ Review berikutnya dalam ~${mins} menit.`;
            else if (mins < 1440) nextLine = `\n\n⏰ Review berikutnya dalam ~${Math.round(mins / 60)} jam.`;
            else nextLine = `\n\n⏰ Review berikutnya ${Math.round(mins / 1440)} hari lagi.`;
          }

          const fallback = await getFallbackPractice(env, user.id);
          let suggestLine = '\n\nMau tetap produktif? Coba /today (pelajaran hari ini) atau /lesson (pelajaran personal).';
          if (fallback) {
            suggestLine = `\n\n💡 Aku saranin latihan ${fallback.section} — itu yang paling perlu kamu perkuat sekarang.\nKetik /study buat mulai.`;
          }

          const nudge = await maybeAppendNudge(env, user.id);
          await sendMessage(env, chatId, `Belum ada yang perlu di-review sekarang. Santai dulu aja! 😎${masteredNote}${nextLine}${suggestLine}${nudge}`);
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

      case '/warmup': {
        // Pre-test drill offer — bot picks 1-2 weakest concepts and offers
        // a quick mini-app drill before the student starts a real test.
        // Zero weak signals → politely decline; don't fabricate drills.
        try {
          // Optional section filter: /warmup reading | /warmup listening
          const parts = text.trim().split(/\s+/);
          const rawSection = (parts[1] || '').toLowerCase();
          const validSections = new Set(['reading', 'listening', 'speaking', 'writing', 'structure']);
          const sectionFilter = validSections.has(rawSection) ? rawSection : undefined;

          const { suggestDrills } = await import('../services/pre-test-drill');
          const sugg = await suggestDrills(env, user.id, sectionFilter, 3);
          if (!sugg) {
            await sendMessage(env, chatId,
              sectionFilter
                ? `Belum ada sinyal kelemahan di *${sectionFilter}* — coba /test langsung aja, atau /diagnostic kalau belum pernah.`
                : 'Belum ada sinyal kelemahan yang kuat buat drill terarah. Coba /diagnostic dulu kalau kamu belum ambil — hasilnya yang dipakai buat nyusun warm-up.',
            );
            return;
          }

          const primary = sugg.concepts[0];
          const conceptBtn = primary.concept.slice(0, 40); // fit in 64-byte callback cap
          const cb = `drill:go:${conceptBtn}:${sugg.count}`;

          await sendMessage(env, chatId, sugg.rationale, {
            inline_keyboard: [
              [{ text: `🎯 Mulai drill (${sugg.count} soal)`, callback_data: cb }],
              [{ text: 'Nggak dulu', callback_data: 'drill:skip' }],
            ],
          });
        } catch (e: any) {
          console.error('/warmup error:', e);
          await sendMessage(env, chatId, 'Ada masalah nyiapin warm-up. Coba lagi sebentar ya.');
        }
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
                [{ text: '📝 Mulai Practice Test', web_app: { url: `${env.WEBAPP_URL}/test?tg_id=${String(user.telegram_id).replace('.0', '')}` } }],
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
              [{ text: '📝 Mulai Practice Test', web_app: { url: `${env.WEBAPP_URL}/test?tg_id=${String(user.telegram_id).replace('.0', '')}` } }],
              [{ text: '🗣️ Speaking Practice', web_app: { url: `${env.WEBAPP_URL}/test?tg_id=${String(user.telegram_id).replace('.0', '')}&section=speaking` } }],
              [{ text: '📖 Belajar Topik', callback_data: 'cat_practice' }],
            ],
          }
        );
        return;
      }

      case '/diagnostic': {
        const { startDiagnostic } = await import('../services/diagnostic');
        const intro = await startDiagnostic(env, user);
        await sendMessage(env, chatId, intro);
        return;
      }

      case '/speak': {
        // Speaking practice — select topic type
        await sendMessage(env, chatId,
          `🎤 *Speaking Practice*\n\n` +
          `Latihan speaking dengan voice message. Tutor AI akan menilai pronunciation, fluency, grammar, dan vocabulary kamu.\n\n` +
          `Pilih topik:`,
          {
            inline_keyboard: [
              [
                { text: '🎲 Random', callback_data: 'speak_topic_random' },
              ],
              [
                { text: '💭 Opinion', callback_data: 'speak_topic_opinion' },
                { text: '📖 Describe', callback_data: 'speak_topic_describe' },
              ],
              [
                { text: '🎯 IELTS 3-Part Test', callback_data: 'speak_topic_ielts3part' },
              ],
            ],
          }
        );
        return;
      }

      case '/pronounce': {
        // Pronunciation practice from pronunciation_bank
        const pronunCategories = [
          { text: '🦷 TH Sounds', callback_data: 'pronun_cat_th_sounds' },
          { text: '🔤 Vowel Pairs', callback_data: 'pronun_cat_vowel_pairs' },
          { text: '🎯 Word Stress', callback_data: 'pronun_cat_word_stress' },
          { text: '🔚 Final Consonants', callback_data: 'pronun_cat_final_consonants' },
          { text: '🔄 R & L Sounds', callback_data: 'pronun_cat_r_and_l' },
          { text: '🤫 Silent Letters', callback_data: 'pronun_cat_silent_letters' },
          { text: '📚 Academic Vocab', callback_data: 'pronun_cat_academic_vocab' },
          { text: '🔗 Connected Speech', callback_data: 'pronun_cat_connected_speech' },
          { text: '❌ Commonly Wrong', callback_data: 'pronun_cat_commonly_mispronounced' },
          { text: '🗣️ Sentence Practice', callback_data: 'pronun_cat_sentence_practice' },
          { text: '🔊 Schwa Sound', callback_data: 'pronun_cat_schwa_sound' },
          { text: '👥 Homophones', callback_data: 'pronun_cat_homophones' },
          { text: '🔢 Numbers & Dates', callback_data: 'pronun_cat_numbers_dates' },
          { text: '💼 Business English', callback_data: 'pronun_cat_business_english' },
          { text: '📝 Academic Phrases', callback_data: 'pronun_cat_academic_phrases' },
          { text: '🌊 IELTS Topics', callback_data: 'pronun_cat_ielts_topics' },
          { text: '🎓 TOEFL Listening', callback_data: 'pronun_cat_toefl_listening' },
          { text: '😜 Tongue Twisters', callback_data: 'pronun_cat_tongue_twisters' },
          { text: '🆚 W & V Sounds', callback_data: 'pronun_cat_w_and_v' },
        ];
        // Build 2-column layout
        const pronunRows = [];
        for (let i = 0; i < pronunCategories.length; i += 2) {
          if (i + 1 < pronunCategories.length) {
            pronunRows.push([pronunCategories[i], pronunCategories[i + 1]]);
          } else {
            pronunRows.push([pronunCategories[i]]);
          }
        }
        pronunRows.push([{ text: '🎲 Random Word', callback_data: 'pronun_random' }]);
        await sendMessage(env, chatId,
          `🔊 *Pronunciation Practice*\n\n` +
          `Latihan pengucapan kata & kalimat bahasa Inggris. Pilih kategori di bawah — ` +
          `kamu akan dapat kata + IPA + tips + audio.\n\n` +
          `📊 254 kata/frasa tersedia dari 19 kategori\n` +
          `🎯 Disesuaikan untuk TOEFL, IELTS, TOEIC`,
          { inline_keyboard: pronunRows }
        );
        return;
      }

      case '/today': {
        const { getTodayLesson } = await import('../services/studyplan');
        const lesson = await getTodayLesson(env, user.id);
        const base = lesson || 'Belum ada study plan. Ketik /diagnostic dulu untuk tes penempatan.';
        const nudge = await maybeAppendNudge(env, user.id);
        await sendMessage(env, chatId, base + nudge);
        // Track /today usage for analytics
        try {
          await env.DB.prepare(
            "INSERT INTO analytics (user_id, event, data) VALUES (?, 'study_plan_viewed', ?)"
          ).bind(user.id, JSON.stringify({ timestamp: new Date().toISOString() })).run();
        } catch (e) {
          console.error('Analytics insert error:', e);
        }
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

      // ═══════════════════════════════════════════════════════
      // PREMIUM REDEMPTION CODES — teacher-as-reseller channel
      // ═══════════════════════════════════════════════════════
      // Students redeem one-time codes that teachers bought in bulk from
      // the admin. Bypasses the Telegram Stars billing friction for
      // students who don't have it set up. Migration 053.

      case '/redeem': {
        // Rate-limit: loose check against recent /redeem attempts to deter
        // brute-force enumeration. The code space is 32^10 (infeasible to
        // brute-force regardless) but we still cap attempts per user.
        const rawCode = (text.split(/\s+/).slice(1).join(' ') || '').trim();
        if (!rawCode) {
          await sendMessage(env, chatId,
            `🎟️ *Tukar Kode Premium*\n\n` +
            `Ketik: /redeem KODE-KAMU\n\n` +
            `Contoh: /redeem OSEE-7K3PM-9X2RH\n\n` +
            `Kode biasanya dapat dari guru kamu. Satu kode = satu akun premium.`
          );
          return;
        }

        try {
          const { redeemCode } = await import('../services/premium-codes');
          const result = await redeemCode(env, user.id, rawCode);

          if (result.success) {
            const expiry = result.new_expiry
              ? new Date(result.new_expiry).toLocaleDateString('id-ID', {
                  year: 'numeric', month: 'long', day: 'numeric',
                })
              : '(tidak diketahui)';
            await sendMessage(env, chatId,
              `🎉 *Kode Berhasil Ditukar!*\n\n` +
              `✨ Premium aktif untuk ${result.days_granted} hari\n` +
              `📅 Berlaku sampai: ${expiry}\n\n` +
              `Sekarang kamu bisa:\n` +
              `• Unlimited soal latihan\n` +
              `• AI Tutor 24/7\n` +
              `• Speaking evaluation\n` +
              `• Study plan personalized\n\n` +
              `Coba /test atau /study untuk mulai!`
            );
          } else {
            const errMsg: Record<string, string> = {
              not_found: '❌ Kode tidak ditemukan. Pastikan kode yang kamu ketik benar persis.',
              already_redeemed: '⚠️ Kode ini sudah pernah ditukar. Satu kode hanya bisa dipakai sekali.',
              expired: '⏰ Kode ini sudah kadaluarsa. Minta kode baru ke guru/admin.',
              invalid_format: '❌ Format kode salah. Contoh yang benar: OSEE-7K3PM-9X2RH',
            };
            await sendMessage(env, chatId,
              errMsg[result.error || ''] || '❌ Gagal menukar kode. Coba lagi.'
            );
          }
        } catch (e: any) {
          console.error('/redeem error:', e);
          await sendMessage(env, chatId, '⚠️ Sistem sedang error. Coba lagi sebentar lagi.');
        }
        return;
      }

      case '/quiet': {
        // Toggle companion feature-discovery nudges on/off.
        // Students who find the 1-per-day tips annoying can mute them here;
        // daily study reminders + streak warnings are unaffected.
        const state = await toggleTips(env, user.id);
        await sendMessage(env, chatId,
          state === 'off'
            ? `🔕 Tip harian dimatiin. Aku gak bakal kasih saran fitur lagi sampai kamu /quiet lagi.`
            : `🔔 Tip harian aktif lagi. Aku bakal kasih saran fitur yang belum kamu coba (max 1x sehari).`
        );
        return;
      }

      case '/gencodes': {
        if (user.role !== 'admin') {
          await sendMessage(env, chatId, 'Command ini hanya untuk admin.');
          return;
        }
        // Syntax: /gencodes COUNT DAYS "batch_label" [notes]
        // Example: /gencodes 50 30 budi_mar26 "50 seats for Budi's class"
        const parts = text.match(/^\/gencodes\s+(\d+)\s+(\d+)(?:\s+(\S+))?(?:\s+(.+))?$/i);
        if (!parts) {
          await sendMessage(env, chatId,
            `Usage: /gencodes COUNT DAYS [batch_label] [notes]\n\n` +
            `Examples:\n` +
            `• /gencodes 50 30 budi_mar26\n` +
            `  → 50 codes × 30 days each, batch='budi_mar26'\n` +
            `• /gencodes 10 7 trial_batch "Jan trial for 10 students"\n` +
            `• /gencodes 20 90 — (no batch label)\n\n` +
            `Limits: 1-500 codes, 1-730 days per code.`
          );
          return;
        }
        const count = parseInt(parts[1]);
        const days = parseInt(parts[2]);
        const batchId = parts[3] || null;
        const notes = parts[4] || null;

        if (count > 500) {
          await sendMessage(env, chatId, 'Max 500 codes per batch. Split into multiple /gencodes.');
          return;
        }

        try {
          const { generateCodes } = await import('../services/premium-codes');
          const codes = await generateCodes(env, user.id, count, days, batchId, notes);

          // Send summary first
          await sendMessage(env, chatId,
            `✅ ${codes.length} codes generated\n` +
            `⏱️ ${days} days each\n` +
            `🏷️ Batch: ${batchId || '(none)'}\n\n` +
            `Codes below (copy and send to teacher). Each line = one code.`
          );

          // Chunk codes into messages of ~30 lines each (Telegram 4096 char limit)
          const CHUNK = 30;
          for (let i = 0; i < codes.length; i += CHUNK) {
            const slice = codes.slice(i, i + CHUNK);
            const block = slice.map((c) => c.code).join('\n');
            await sendMessage(env, chatId, '```\n' + block + '\n```');
          }

          if (batchId) {
            await sendMessage(env, chatId, `Track redemptions with: /codestatus ${batchId}`);
          }
        } catch (e: any) {
          console.error('/gencodes error:', e);
          await sendMessage(env, chatId, `⚠️ Generation failed: ${e.message}`);
        }
        return;
      }

      case '/codestatus': {
        if (user.role !== 'admin') {
          await sendMessage(env, chatId, 'Command ini hanya untuk admin.');
          return;
        }
        const batchId = (text.split(/\s+/)[1] || '').trim();
        try {
          const { getBatchStats, listRecentBatches } = await import('../services/premium-codes');

          if (!batchId) {
            // No batch specified — list all recent batches
            const batches = await listRecentBatches(env, 20);
            if (batches.length === 0) {
              await sendMessage(env, chatId, 'Belum ada batch kode. Generate dengan /gencodes COUNT DAYS label.');
              return;
            }
            let msg = `📦 *Recent batches (${batches.length})*\n\n`;
            for (const b of batches) {
              const rate = b.total > 0 ? Math.round((b.redeemed / b.total) * 100) : 0;
              const date = (b.created_at || '').slice(0, 10);
              msg += `• \`${b.batch_id}\` — ${b.redeemed}/${b.total} redeemed (${rate}%) · ${b.days}d · ${date}\n`;
            }
            msg += `\nDetails: /codestatus BATCH_ID`;
            await sendMessage(env, chatId, msg);
            return;
          }

          const stats = await getBatchStats(env, batchId);
          if (stats.total === 0) {
            await sendMessage(env, chatId, `Batch \`${batchId}\` tidak ada. List batch: /codestatus (tanpa argumen)`);
            return;
          }
          const rate = Math.round((stats.redeemed / stats.total) * 100);
          let msg = `📦 *Batch: ${batchId}*\n\n`;
          msg += `Total codes: ${stats.total}\n`;
          msg += `Redeemed: ${stats.redeemed} (${rate}%)\n`;
          msg += `Unused: ${stats.unused}\n`;
          if (stats.expired > 0) msg += `Expired: ${stats.expired}\n`;
          msg += `Days per code: ${stats.days_per_code || '?'}\n`;
          if (stats.sample_codes.length > 0) {
            msg += `\nFirst ${stats.sample_codes.length} unused (for reprinting):\n\`\`\`\n`;
            msg += stats.sample_codes.join('\n');
            msg += `\n\`\`\``;
          }
          await sendMessage(env, chatId, msg);
        } catch (e: any) {
          console.error('/codestatus error:', e);
          await sendMessage(env, chatId, `⚠️ Error: ${e.message}`);
        }
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

        // --- Core counts ---
        const [userCount, questionCount, attemptCount, answerCount, costTotal, teachers, classes] = await Promise.all([
          env.DB.prepare('SELECT COUNT(*) as c FROM users').first() as Promise<any>,
          env.DB.prepare('SELECT COUNT(*) as c FROM test_contents').first() as Promise<any>,
          env.DB.prepare("SELECT COUNT(*) as c FROM test_attempts WHERE status = 'completed'").first() as Promise<any>,
          env.DB.prepare("SELECT COUNT(*) as c FROM attempt_answers WHERE NOT (is_correct IS NULL AND section NOT IN ('speaking','writing'))").first() as Promise<any>,
          env.DB.prepare('SELECT SUM(cost_usd) as c FROM api_usage').first() as Promise<any>,
          env.DB.prepare("SELECT COUNT(*) as c FROM users WHERE role = 'teacher'").first() as Promise<any>,
          env.DB.prepare('SELECT COUNT(*) as c FROM classes').first() as Promise<any>,
        ]);

        // --- Extended analytics ---
        const [accuracy, activeToday, active7d, premiumCount, todayCost, sectionBreakdown, topStudents] = await Promise.all([
          // Overall accuracy (speaking/writing use score in answer_data)
          env.DB.prepare(
            `SELECT COUNT(*) as total,
                    SUM(CASE
                      WHEN is_correct = 1 THEN 1
                      WHEN is_correct IS NULL AND section IN ('speaking','writing')
                           AND json_extract(answer_data, '$.score') >= 5 THEN 1
                      ELSE 0
                    END) as correct
             FROM attempt_answers`
          ).first() as Promise<any>,
          // Active today — conversation_messages is the primary activity source
          env.DB.prepare(
            `SELECT COUNT(DISTINCT user_id) as c FROM (
               SELECT user_id FROM conversation_messages WHERE date(created_at) = date('now')
               UNION SELECT ta.user_id FROM attempt_answers aa JOIN test_attempts ta ON aa.attempt_id = ta.id WHERE date(aa.submitted_at) = date('now')
               UNION SELECT user_id FROM daily_question_logs WHERE question_date = date('now')
             )`
          ).first() as Promise<any>,
          // Active last 7 days
          env.DB.prepare(
            `SELECT COUNT(DISTINCT user_id) as c FROM (
               SELECT user_id FROM conversation_messages WHERE created_at >= datetime('now', '-7 days')
               UNION SELECT ta.user_id FROM attempt_answers aa JOIN test_attempts ta ON aa.attempt_id = ta.id WHERE aa.submitted_at >= datetime('now', '-7 days')
               UNION SELECT user_id FROM daily_question_logs WHERE question_date >= date('now', '-7 days')
             )`
          ).first() as Promise<any>,
          // Premium users
          env.DB.prepare(
            `SELECT COUNT(*) as c FROM users WHERE is_premium = 1`
          ).first() as Promise<any>,
          // Today's API cost
          env.DB.prepare(
            `SELECT SUM(cost_usd) as c FROM api_usage WHERE created_at >= date('now')`
          ).first() as Promise<any>,
          // Answers by section (include speaking/writing scores)
          env.DB.prepare(
            `SELECT section, COUNT(*) as total,
                    SUM(CASE
                      WHEN is_correct = 1 THEN 1
                      WHEN is_correct IS NULL AND section IN ('speaking','writing')
                           AND json_extract(answer_data, '$.score') >= 5 THEN 1
                      ELSE 0
                    END) as correct
             FROM attempt_answers WHERE section IS NOT NULL
             GROUP BY section ORDER BY total DESC`
          ).all() as Promise<any>,
          // Top 5 students by questions answered (last 7 days)
          env.DB.prepare(
            `SELECT u.name, COUNT(*) as answered,
                    SUM(CASE
                      WHEN aa.is_correct = 1 THEN 1
                      WHEN aa.is_correct IS NULL AND aa.section IN ('speaking','writing')
                           AND json_extract(aa.answer_data, '$.score') >= 5 THEN 1
                      ELSE 0
                    END) as correct
             FROM attempt_answers aa
             JOIN test_attempts ta ON aa.attempt_id = ta.id
             JOIN users u ON ta.user_id = u.id
             WHERE aa.submitted_at >= datetime('now', '-7 days')
             GROUP BY ta.user_id ORDER BY answered DESC LIMIT 5`
          ).all() as Promise<any>,
        ]);

        const overallAcc = accuracy?.total > 0
          ? Math.round((accuracy.correct / accuracy.total) * 100)
          : 0;

        // Format section stats
        let sectionMsg = '';
        for (const s of (sectionBreakdown?.results || [])) {
          const acc = s.total > 0 ? Math.round((s.correct as number / (s.total as number)) * 100) : 0;
          const icon = acc >= 70 ? '🟢' : acc >= 50 ? '🟡' : '🔴';
          sectionMsg += `  ${icon} ${(s.section as string).charAt(0).toUpperCase() + (s.section as string).slice(1)}: ${(s.total as number).toLocaleString('id-ID')} soal (${acc}%)\n`;
        }

        // Format top students
        let topMsg = '';
        for (let i = 0; i < (topStudents?.results || []).length; i++) {
          const st = topStudents.results[i] as any;
          const acc = st.answered > 0 ? Math.round((st.correct / st.answered) * 100) : 0;
          topMsg += `  ${i + 1}. ${st.name} — ${st.answered} soal (${acc}%)\n`;
        }

        await sendMessage(env, chatId,
          `📊 *Statistik EduBot*\n\n` +
          `*— Pengguna —*\n` +
          `👥 Total: ${(userCount?.c || 0).toLocaleString('id-ID')} (${(teachers?.c || 0).toLocaleString('id-ID')} guru)\n` +
          `⭐ Premium: ${(premiumCount?.c || 0).toLocaleString('id-ID')}\n` +
          `🟢 Aktif hari ini: ${(activeToday?.c || 0).toLocaleString('id-ID')}\n` +
          `📅 Aktif 7 hari: ${(active7d?.c || 0).toLocaleString('id-ID')}\n` +
          `🏫 Kelas: ${(classes?.c || 0).toLocaleString('id-ID')}\n\n` +
          `*— Konten & Latihan —*\n` +
          `📝 Soal di database: ${(questionCount?.c || 0).toLocaleString('id-ID')}\n` +
          `✅ Tes selesai: ${(attemptCount?.c || 0).toLocaleString('id-ID')}\n` +
          `💬 Jawaban total: ${(answerCount?.c || 0).toLocaleString('id-ID')}\n` +
          `🎯 Akurasi keseluruhan: ${overallAcc}%\n\n` +
          (sectionMsg ? `*— Per Section —*\n${sectionMsg}\n` : '') +
          (topMsg ? `*— Top Students (7 Hari) —*\n${topMsg}\n` : '') +
          `*— Biaya API —*\n` +
          `💰 Hari ini: $${Number(todayCost?.c || 0).toFixed(3)}\n` +
          `💰 Total: $${Number(costTotal?.c || 0).toFixed(2)}`
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

      case '/realscore': {
        // Format: /realscore IELTS 6.5   or   /realscore TOEFL_IBT 95
        // Helps calibrate the bot's predictions against real test outcomes.
        const parts = text.trim().split(/\s+/);
        if (parts.length < 3) {
          await sendMessage(env, chatId,
            `📊 *Lapor Skor Tes Asli*\n\n` +
            `Bantu kita kalibrasi prediksi bot dengan skor real kamu:\n\n` +
            `\`/realscore IELTS 6.5\`\n` +
            `\`/realscore TOEFL_IBT 95\`\n` +
            `\`/realscore TOEIC 850\`\n\n` +
            `Nama test: IELTS, TOEFL_IBT, TOEIC, TOEFL_ITP\n` +
            `Kita pakai data ini (anonim) untuk bikin prediksi bot makin akurat 🎯`,
          );
          return;
        }
        const testType = parts[1].toUpperCase();
        const realOverall = Number(parts[2]);
        if (!['IELTS', 'TOEFL_IBT', 'TOEIC', 'TOEFL_ITP'].includes(testType)) {
          await sendMessage(env, chatId, `❌ Test type tidak valid. Pilih: IELTS, TOEFL_IBT, TOEIC, TOEFL_ITP`);
          return;
        }
        if (!Number.isFinite(realOverall) || realOverall < 0) {
          await sendMessage(env, chatId, `❌ Skor tidak valid`);
          return;
        }
        if (testType === 'IELTS' && realOverall > 9) {
          await sendMessage(env, chatId, `❌ IELTS overall 0-9`);
          return;
        }
        const { submitRealScore } = await import('../services/calibration');
        try {
          const r = await submitRealScore(env, { userId: user.id, testType, realOverall });
          let msg = `✅ Skor tercatat: *${realOverall}* (${testType})\n\n`;
          if (r.predicted.overall !== null) {
            const delta = realOverall - r.predicted.overall;
            const deltaStr = delta === 0 ? 'persis sama' :
                             delta > 0 ? `+${delta.toFixed(1)} (bot under-estimate)` :
                             `${delta.toFixed(1)} (bot over-estimate)`;
            msg += `Prediksi bot terakhir: ${r.predicted.overall}\n`;
            msg += `Selisih: ${deltaStr}\n\n`;
          }
          msg += `Makasih! Data kamu bantu nge-tune akurasi bot 🙏`;
          await sendMessage(env, chatId, msg);
        } catch (e: any) {
          await sendMessage(env, chatId, `❌ Gagal: ${e?.message || 'error'}`);
        }
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
    const { markReviewed, getDueReviews, getReviewStats } = await import('../services/fsrs-engine');
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
      await sendMessage(env, chatId, 'Diagnostic dibatalkan. Mau ngapain sekarang?', mainMenuKeyboard(env.WEBAPP_URL, user.telegram_id));
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

      // 3-day premium trial announcement (granted server-side inside submitAnswer)
      if ((result as any).trialGranted) {
        await sendMessage(env, chatId,
          `🎁 *Selamat! Kamu dapat 3 hari Premium GRATIS!*\n\n` +
          `Karena udah selesaiin diagnostic, aku kasih akses penuh selama 72 jam:\n` +
          `• ♾️ Unlimited soal\n` +
          `• 🎤 Speaking evaluation (Whisper AI)\n` +
          `• 📝 Writing feedback detail\n` +
          `• 🤖 AI Tutor 24/7\n\n` +
          `Mulai sekarang. Nggak perlu kartu kredit. Tinggal pakai! 🚀`,
          { parse_mode: 'Markdown' } as any
        );
      }

      await sendMessage(env, chatId,
        resultsText + `\n\n🎯 Langkah Selanjutnya?\n\nMau langsung buat study plan personal?`,
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
      const plan = await generateStudyPlan(env, user.id, targetDate.toISOString(), weaknesses, user.target_test || undefined);
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
    await sendMessage(env, chatId, 'Mau belajar apa nih? Pilih kategori di bawah, atau langsung ketik aja, misal "belajar grammar" 👇', studyTopicKeyboard(user.target_test));
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

  // ═══════════════════════════════════════════════════════
  // CHECK FOR ACTIVE EXERCISE SESSION (Multi-step lessons)
  // ═══════════════════════════════════════════════════════
  const activeExercise = await env.DB.prepare(
    `SELECT * FROM exercise_sessions WHERE user_id = ? AND status = 'active' ORDER BY created_at DESC LIMIT 1`
  ).bind(user.id).first() as any;

  if (activeExercise) {
    try {
      const meta = JSON.parse(activeExercise.metadata || '{}');
      const lower = text.toLowerCase().trim();

      // Navigation commands work anytime during an active exercise
      if (['quit', 'selesai', 'keluar', 'stop', 'berhenti'].includes(lower)) {
        const { renderSummary, getTotalSteps } = await import('../services/exercise-engine');
        const avgScore = meta.scores?.length > 0 ? Math.round(meta.scores.reduce((a: number, b: number) => a + b, 0) / meta.scores.length) : 0;
        await env.DB.prepare(
          'UPDATE exercise_sessions SET status = ?, score = ?, metadata = ?, completed_at = ? WHERE id = ?'
        ).bind('completed', avgScore, JSON.stringify(meta), new Date().toISOString(), activeExercise.id).run();

        if (meta.scores?.length > 0) {
          const summary = renderSummary(activeExercise.type, meta.lesson, meta.scores, meta.hints || 0);
          await sendMessage(env, chatId, summary.text, summary.keyboard);
        } else {
          await sendMessage(env, chatId, '👋 Lesson dihentikan. Kembali ke /study kapan saja!');
        }
        return;
      }

      if (['skip', 'lewat'].includes(lower) && meta.input) {
        const { getStepDisplay, getStepInputType, getTotalSteps, renderSummary } = await import('../services/exercise-engine');
        meta.scores.push(0);
        meta.step += 1;
        const total = getTotalSteps(activeExercise.type);

        if (meta.step >= total) {
          const avgScore = meta.scores.length > 0 ? Math.round(meta.scores.reduce((a: number, b: number) => a + b, 0) / meta.scores.length) : 0;
          await env.DB.prepare(
            'UPDATE exercise_sessions SET status = ?, score = ?, metadata = ?, completed_at = ? WHERE id = ?'
          ).bind('completed', avgScore, JSON.stringify(meta), new Date().toISOString(), activeExercise.id).run();
          const summary = renderSummary(activeExercise.type, meta.lesson, meta.scores, meta.hints || 0);
          await sendMessage(env, chatId, summary.text, summary.keyboard);
          return;
        }

        const inputType = getStepInputType(activeExercise.type, meta.step);
        meta.input = inputType === 'text' ? 'text' : inputType === 'voice' ? 'voice' : null;
        await env.DB.prepare(
          'UPDATE exercise_sessions SET metadata = ? WHERE id = ?'
        ).bind(JSON.stringify(meta), activeExercise.id).run();

        await sendMessage(env, chatId, '⏭ Dilewati.');
        const display = getStepDisplay(activeExercise.type, meta.lesson, meta.step, activeExercise.id);
        await sendMessage(env, chatId, display.text, display.keyboard);
        if (display.tts_text) await sendTTSAudio(env, chatId, display.tts_text);
        return;
      }

      if (['hint', 'bantuan'].includes(lower) && meta.input) {
        const { getStepHint } = await import('../services/exercise-engine');
        meta.hints = (meta.hints || 0) + 1;
        await env.DB.prepare(
          'UPDATE exercise_sessions SET metadata = ? WHERE id = ?'
        ).bind(JSON.stringify(meta), activeExercise.id).run();
        const hint = getStepHint(activeExercise.type, meta.lesson, meta.step);
        await sendMessage(env, chatId, hint);
        return;
      }

      // Text input — only when awaiting text
      if (meta.input === 'text') {
        const { scoreTextAnswer, getStepDisplay, getStepInputType, getTotalSteps, renderSummary } = await import('../services/exercise-engine');

        const { score, feedback } = await scoreTextAnswer(env, activeExercise.type, meta.lesson, meta.step, text);
        meta.scores.push(score);

        // Theory-of-Mind: record evidence about this concept
        try {
          const { recordEvidence } = await import('../services/mental-model');
          const evidenceType = score >= 60 ? 'correct_answer' : 'wrong_answer';
          const weight = score >= 80 ? 0.7 : score >= 50 ? 0.4 : 0.6;
          await recordEvidence(env, user.id, activeExercise.type, evidenceType, `step ${meta.step} score=${score}`, weight);
        } catch (e) { console.error('recordEvidence (text) error:', e); }

        // Study streak: any engagement counts + compassionate streak recovery
        try {
          const { updateStreak } = await import('../services/analytics');
          const streakResult = await updateStreak(env, user.id);
          if (streakResult?.streakBroken && streakResult.previousStreak >= 3) {
            const { getStreakRecoveryMessage } = await import('../services/companion');
            const recoveryMsg = getStreakRecoveryMessage(user.name, streakResult.previousStreak);
            await sendMessage(env, chatId, recoveryMsg);
          }
        } catch (e) { console.error('updateStreak (text) error:', e); }

        meta.step += 1;
        const total = getTotalSteps(activeExercise.type);

        if (meta.step >= total) {
          meta.input = null;
          const avgScore = meta.scores.length > 0 ? Math.round(meta.scores.reduce((a: number, b: number) => a + b, 0) / meta.scores.length) : 0;
          await env.DB.prepare(
            'UPDATE exercise_sessions SET status = ?, score = ?, metadata = ?, completed_at = ? WHERE id = ?'
          ).bind('completed', avgScore, JSON.stringify(meta), new Date().toISOString(), activeExercise.id).run();
          await sendMessage(env, chatId, feedback);
          const summary = renderSummary(activeExercise.type, meta.lesson, meta.scores, meta.hints || 0);
          await sendMessage(env, chatId, summary.text, summary.keyboard);
        } else {
          meta.input = null; // Waiting for Next button
          await env.DB.prepare(
            'UPDATE exercise_sessions SET metadata = ? WHERE id = ?'
          ).bind(JSON.stringify(meta), activeExercise.id).run();

          await sendMessage(env, chatId, feedback, {
            inline_keyboard: [[{ text: '➡️ Soal Berikutnya', callback_data: `ex_n_${activeExercise.id}` }]],
          });
        }
        return;
      }

      // If not awaiting input, fall through to AI tutor
    } catch (e: any) {
      console.error('Exercise text handler error:', e);
      // Fall through to AI tutor on error
    }
  }

  // Check if user has an active companion conversation (re-engagement chat)
  try {
    const { getActiveCompanionConversation, handleCompanionReply, markBridgeAccepted } = await import('../services/companion');
    const companionConv = await getActiveCompanionConversation(env, user.id);
    if (companionConv) {
      // Student wants to study — bridge accepted!
      const studyWords = ['latihan', 'belajar', 'study', 'test', 'soal', 'mulai', 'ayo', 'siap', 'mau coba'];
      if (studyWords.some(w => text.toLowerCase().includes(w))) {
        await markBridgeAccepted(env, user.id);
        await sendMessage(env, chatId,
          `Oke, ayo! 💪 Mau ngapain?\n\nKetik /study buat belajar, /test buat latihan soal, atau /review buat review.`,
          mainMenuKeyboard(env.WEBAPP_URL, user.telegram_id)
        );
        return;
      }

      const result = await handleCompanionReply(env, user, text);
      if (result) {
        await sendMessage(env, chatId, result.text);
        // If bridge is ready, add gentle CTA buttons
        if (result.bridgeReady) {
          await sendMessage(env, chatId, 'Btw, kalau mau, aku bisa siapin latihan ringan buat kamu 😊', {
            inline_keyboard: [
              [
                { text: '📚 Mau coba latihan', callback_data: 'companion_bridge_accept' },
                { text: '💬 Lanjut ngobrol', callback_data: 'companion_continue' },
              ],
            ],
          });
        }
      }
      return;
    }
  } catch (e) {
    console.error('Companion conversation check error:', e);
    // Fall through to normal tutor on error
  }

  // Check daily quota for free users before AI tutor response
  try {
    const { checkTestAccess, trackQuestionAnswer } = await import('../services/premium');
    const access = await checkTestAccess(env, user.id);
    if (!access.allowed) {
      await sendMessage(env, chatId,
        `⚠️ Kuota harian habis (${access.used_today}/${access.daily_limit} soal).\n\n` +
        `Kuota direset besok jam 00:00 WIB.\n` +
        `Ketik /premium untuk akses unlimited! 🚀\n\n` +
        `Atau ajak teman pakai /referral untuk bonus kuota! 🎁`);
      return;
    }
    // Track this as a question usage
    const trackResult = await trackQuestionAnswer(env, user.id);
    if (trackResult.upgradeNudge) {
      await sendMessage(env, chatId,
        `⚡ *Heads up!* Udah 7/10 soal hari ini.\n\n` +
        `3 soal lagi terus quota harian habis. Mau unlimited?\n` +
        `💎 Cuma Rp 30rb/minggu = Rp 4rb/hari.\n\n` +
        `Ketik /premium atau /buy buat upgrade.`
      );
    }
  } catch (e) {
    console.error('Bot conversation quota check error:', e);
    // Don't block if quota check fails — let the conversation continue
  }

  // Use private tutor for rich tracking (student profiles, topic mastery, tutor interactions)
  let response: string;
  let tutorProfile: any = null;
  try {
    const result = await getPrivateTutorResponse(env, user, text);
    response = result.text;
    tutorProfile = result.profile;
  } catch (e: any) {
    // Surface the actual error — "falling back to generic" with no detail
    // obscured a real persona failure for days. Include message + stack so
    // `wrangler tail` shows what exactly is breaking.
    console.error('[private-tutor] FAILED — falling back to generic tutor:',
      e?.message || e, e?.stack?.split('\n').slice(0, 4).join(' | '));
    response = await getTutorResponse(env, user, text);
    await saveToHistory(env, user.id, text, response);
  }

  // ── Teach-then-check: extract [CHECK] block if tutor emitted one ──
  // Done BEFORE [AUDIO] parsing so audio inside teach_text is handled correctly.
  // Always strip the block from rendered text so markup never leaks to the user,
  // but only promote it to an active CQ when in lesson mode AND not paused.
  let pendingCq: import('../services/comprehension-check').ComprehensionCheck | null = null;
  let lessonIsPaused = false;
  try {
    const { parseCheckBlock, isLessonPaused } = await import('../services/comprehension-check');
    const parsed = parseCheckBlock(response);
    if (parsed.cq) {
      response = parsed.teach_text;
      if (tutorProfile && tutorProfile.tutor_mode === 'lesson') {
        lessonIsPaused = await isLessonPaused(env, user.id).catch(() => false);
        if (!lessonIsPaused) pendingCq = parsed.cq;
      }
    }
  } catch (e) {
    console.error('CQ parse failed (ignored):', e);
  }

  // ── Extract [VISUAL:concept:type] tags ─────────────────────
  // Format: [VISUAL:inference:analogy] on its own line (or inline).
  // Allowed types checked inside handleVisualTag; unknown types are
  // logged + skipped (never break the tutor turn on a bad tag).
  // We strip these BEFORE [AUDIO] parsing so both can coexist.
  const visualPattern = /\[VISUAL:([a-z0-9_]+):([a-z_]+)\]/gi;
  const visualMatches = [...response.matchAll(visualPattern)].map((m) => ({
    concept: m[1].toLowerCase(),
    type: m[2].toLowerCase(),
  }));
  if (visualMatches.length > 0) {
    response = response.replace(visualPattern, '').replace(/\n{3,}/g, '\n\n').trim();
  }

  // Check if AI tutor response contains [AUDIO] tag(s)
  // Support multiple [AUDIO] blocks in one response
  const audioPattern = /\[AUDIO\]\s*(.+?)(?=\n\s*\[AUDIO\]|\n\s*Soal:|\n\s*Question:|$)/gis;
  const audioMatches = [...response.matchAll(audioPattern)];

  if (audioMatches.length > 0) {
    // Strip all [AUDIO] blocks from the text response
    let textResponse = response.replace(audioPattern, '').trim();
    if (textResponse) {
      await sendMessage(env, chatId, textResponse);
    }
    // Send visuals BEFORE audio — the picture usually accompanies the
    // text explanation, while audio is a separate listening act.
    for (const v of visualMatches) {
      await handleVisualTag(env, chatId, user.id, v.concept, v.type);
    }
    // Send each audio block as TTS
    for (const match of audioMatches) {
      const audioText = match[1].trim();
      if (audioText.length > 0) {
        await sendTTSAudio(env, chatId, audioText);
      }
    }
  } else {
    await sendMessage(env, chatId, response);
    // Visuals get sent after the text even in the no-audio branch.
    for (const v of visualMatches) {
      await handleVisualTag(env, chatId, user.id, v.concept, v.type);
    }

    // Auto-detect: if user asked for audio/pronunciation but AI forgot [AUDIO] tag,
    // extract English words from AI response and send TTS as follow-up
    const userAskedAudio = /\b(audio|suara|dengarin|dengarkan|ucapkan|pronunciation|cara baca|cara ngomong|bunyikan|play|putar)\b/i.test(text);
    if (userAskedAudio) {
      // Try to find quoted English words/phrases in the AI response
      const quotedWords = response.match(/"([A-Za-z\s,.'-]+)"/g);
      if (quotedWords && quotedWords.length > 0) {
        const wordsToSpeak = quotedWords.map(w => w.replace(/"/g, '').trim()).filter(w => w.length > 0).join('. ');
        if (wordsToSpeak.length > 0 && wordsToSpeak.length < 500) {
          await sendTTSAudio(env, chatId, wordsToSpeak);
        }
      }
    }
  }

  // ── Send the comprehension check, if the tutor emitted one ──
  if (pendingCq) {
    try {
      const { saveActiveCq, formatCqMessage, buildCqKeyboard } = await import('../services/comprehension-check');
      const { getActivePlan } = await import('../services/lesson-engine');
      const plan = await getActivePlan(env, user.id).catch(() => null);
      await saveActiveCq(env, user.id, pendingCq, {
        plan_id: plan?.id ?? null,
        step_index: plan?.current_step ?? null,
        concept: tutorProfile?.current_topic ?? null,
        strategy_used: null, // first attempt
      });
      await sendMessage(env, chatId, formatCqMessage(pendingCq), buildCqKeyboard(pendingCq.options));
    } catch (e) {
      console.error('send CQ failed (ignored):', e);
    }
  }

  // Study break reminder — check if they've been studying for a long stretch
  try {
    const { checkStudyBreakNeeded } = await import('../services/companion');
    const breakMsg = await checkStudyBreakNeeded(env, user.id, user.name);
    if (breakMsg) {
      // Small delay so it doesn't feel robotic — send after the tutor reply
      await sendMessage(env, chatId, breakMsg);
    }
  } catch (e) {
    // Silent fail — break reminders are nice-to-have, not critical
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

  // ═══════════════════════════════════════════════════════
  // COMPREHENSION CHECK (teach-then-check flow)
  //   cq:a:<letter>  — student picked an answer
  //   cq:p           — "tunggu dulu" (pause)
  //   cq:r           — resume from paused state
  // ═══════════════════════════════════════════════════════
  if (data === 'cq:p') {
    try {
      const { setLessonPaused, buildResumeKeyboard } = await import('../services/comprehension-check');
      await setLessonPaused(env, user.id, true);
      await sendMessage(env, chatId,
        `⏸ Oke, kita berhenti dulu. Tanya apapun yang bikin bingung — aku jawab santai.\n\nKalau udah siap lanjut, tap tombol di bawah.`,
        buildResumeKeyboard(),
      );
    } catch (e) {
      console.error('cq:pause failed:', e);
    }
    return;
  }

  if (data === 'cq:r') {
    try {
      const { setLessonPaused, loadActiveCq, formatCqMessage, buildCqKeyboard } = await import('../services/comprehension-check');
      await setLessonPaused(env, user.id, false);
      const active = await loadActiveCq(env, user.id);
      if (active) {
        // Re-emit the same pending CQ so the student can answer now
        await sendMessage(env, chatId,
          `▶️ Oke, lanjut lesson. Coba jawab ini dulu:\n\n` +
          formatCqMessage({
            question: active.question,
            options: active.options,
            correct_letter: active.correct_letter,
          }),
          buildCqKeyboard(active.options),
        );
      } else {
        await sendMessage(env, chatId, `▶️ Lanjut. Kirim pesan apapun buat lanjutin lesson.`);
      }
    } catch (e) {
      console.error('cq:resume failed:', e);
    }
    return;
  }

  if (data.startsWith('cq:a:')) {
    const picked = data.slice(5).toUpperCase();
    try {
      const cqSvc = await import('../services/comprehension-check');
      const active = await cqSvc.loadActiveCq(env, user.id);
      if (!active) {
        await sendMessage(env, chatId, 'Hmm, ga nemu soal yang aktif. Mungkin udah expired — kirim pesan lagi biar lanjut lesson.');
        return;
      }
      const wasCorrect = picked === active.correct_letter;
      await cqSvc.bumpAttempts(env, user.id);
      const attemptNum = (active.attempts || 0) + 1;
      await cqSvc.logCqAttempt(env, user.id, active, picked, wasCorrect, attemptNum);
      await cqSvc.updateMentalModelFromCq(env, user.id, active, wasCorrect, attemptNum);

      if (wasCorrect) {
        await cqSvc.clearActiveCq(env, user.id);
        const congrats = attemptNum === 1
          ? `✅ Benar! Langsung paham di percobaan pertama.`
          : `✅ Nah, gitu! Kali ini tepat.`;
        await sendMessage(env, chatId, congrats);

        // ── Post-test review bridge ─────────────────────────────────
        // If this CQ resolved a concept that matches the current post-test
        // review's active concept, advance the review and offer the student
        // a choice: continue with the next concept or stop.
        try {
          const ptr = await import('../services/post-test-review');
          const review = await ptr.loadActiveReview(env, user.id);
          if (review && review.current_index < review.concepts.length) {
            const expectedConcept = review.concepts[review.current_index];
            if (active.concept && active.concept === expectedConcept) {
              await ptr.advanceReview(env, review.id);
              const isLast = (review.current_index + 1) >= review.concepts.length;
              if (isLast) {
                await ptr.markReviewStatus(env, review.id, 'completed');
                await sendMessage(env, chatId,
                  '🎉 Mantap! Semua konsep udah dibahas. Soal serupa bakal muncul lagi di /review buat ngetes ingatan kamu.',
                );
              } else {
                const nextConcept = review.concepts[review.current_index + 1]
                  .split('_').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
                await sendMessage(env, chatId,
                  `Mau lanjut ke *${nextConcept}* atau cukup dulu?`,
                  {
                    inline_keyboard: [[
                      { text: 'Lanjut', callback_data: `ptr:next:${review.id}` },
                      { text: 'Cukup dulu', callback_data: `ptr:done:${review.id}` },
                    ]],
                  },
                );
              }
              return;
            }
          }
        } catch (e) {
          console.error('ptr bridge from cq resolve failed (non-fatal):', e);
        }

        // Default: nudge the lesson forward — student's next message continues naturally
        await sendMessage(env, chatId, 'Lanjut ya.');
        return;
      }

      // Wrong: pick a new strategy and reteach
      if (attemptNum >= 3) {
        // Hard limit: after 3 wrongs, stop the loop and go human
        await cqSvc.clearActiveCq(env, user.id);
        await sendMessage(env, chatId,
          `😌 Udah 3x nyoba. Santai aja — konsep ini memang butuh waktu. Jawabannya ${active.correct_letter}: ${active.options[active.correct_letter.charCodeAt(0) - 65]}\n\nTanya bagian mana yang bikin bingung, kita bahas pelan-pelan.`,
        );
        await cqSvc.setLessonPaused(env, user.id, true);
        return;
      }

      const nextStrat = cqSvc.nextReteachStrategy(active.strategy_used as any);
      const prevCq: import('../services/comprehension-check').ComprehensionCheck = {
        question: active.question,
        options: active.options,
        correct_letter: active.correct_letter,
      };

      // Ask the tutor to reteach using the chosen strategy + emit a new CHECK
      const prompt = cqSvc.buildReteachPrompt(
        active.concept || 'konsep',
        nextStrat,
        user.name || 'kamu',
        prevCq,
        picked,
      );

      // Reuse the generic tutor — no persona drift, just raw strategy-driven reteach
      const reteachResp = await getTutorResponse(env, user, prompt).catch((e: any) => {
        console.error('reteach tutor call failed:', e);
        return null;
      });

      if (!reteachResp) {
        await sendMessage(env, chatId,
          `Belum tepat. Jawaban yang benar ${active.correct_letter}. Coba kita bahas lagi — tanya bagian yang kurang jelas ya.`,
        );
        return;
      }

      const parsed = cqSvc.parseCheckBlock(reteachResp);
      // Prefix with a gentle acknowledgement so the student knows why we're re-explaining
      const prefix = `🔄 Belum tepat. Coba pendekatan lain:\n\n`;
      await sendMessage(env, chatId, prefix + (parsed.teach_text || reteachResp));

      if (parsed.cq) {
        await cqSvc.saveActiveCq(env, user.id, parsed.cq, {
          plan_id: active.plan_id,
          step_index: active.step_index,
          concept: active.concept,
          strategy_used: nextStrat,
        });
        await sendMessage(env, chatId, cqSvc.formatCqMessage(parsed.cq), cqSvc.buildCqKeyboard(parsed.cq.options));
      } else {
        // Tutor didn't emit a fresh CHECK — keep the old one live so attempts count carries
        await sendMessage(env, chatId,
          `Coba jawab lagi soal yang tadi:\n\n` + cqSvc.formatCqMessage(prevCq),
          cqSvc.buildCqKeyboard(prevCq.options),
        );
      }
    } catch (e) {
      console.error('cq answer handler failed:', e);
    }
    return;
  }

  // ═══════════════════════════════════════════════════════
  // POST-TEST REVIEW CALLBACKS
  //   ptr:start:<reviewId>  — student accepted the review offer; teach concept[0]
  //   ptr:skip:<reviewId>   — student deferred; mark skipped, no follow-up
  //   ptr:next:<reviewId>   — "lanjut konsep berikutnya" after finishing a block
  //   ptr:done:<reviewId>   — "cukup dulu" after a block — ends cleanly
  // ═══════════════════════════════════════════════════════
  if (data.startsWith('ptr:')) {
    try {
      const parts = data.split(':');
      const action = parts[1];
      const reviewId = parseInt(parts[2] || '0', 10);
      if (!Number.isFinite(reviewId) || reviewId <= 0) {
        await sendMessage(env, chatId, 'Sesi review tidak valid.');
        return;
      }
      const ptr = await import('../services/post-test-review');
      const review = await ptr.loadReviewById(env, reviewId);
      if (!review || review.user_id !== user.id) {
        await sendMessage(env, chatId, 'Sesi review tidak ditemukan.');
        return;
      }

      if (action === 'skip') {
        await ptr.markReviewStatus(env, reviewId, 'skipped');
        await sendMessage(env, chatId, 'Oke, nanti aja. Soal-soal yang meleset tetep masuk /review ya — bakal muncul pelan-pelan.');
        return;
      }

      if (action === 'done') {
        await ptr.markReviewStatus(env, reviewId, 'completed');
        await sendMessage(env, chatId, 'Siap, cukup dulu. Nice work — konsep sisanya masih bisa dilanjut nanti lewat /review. 💪');
        return;
      }

      // 'start' and 'next' both kick off teaching the current concept.
      // 'start' also logs the acceptance; 'next' advances before teaching.
      if (action === 'next') {
        await ptr.advanceReview(env, reviewId);
      }

      // Re-load after the (possible) advance to get the updated index
      const fresh = await ptr.loadReviewById(env, reviewId);
      if (!fresh) return;

      if (fresh.current_index >= fresh.concepts.length) {
        await ptr.markReviewStatus(env, reviewId, 'completed');
        await sendMessage(env, chatId, '🎉 Selesai! Semua konsep yang kita target udah dibahas. Soal serupa bakal muncul di /review buat ngetes ingatan.');
        return;
      }

      const concept = fresh.concepts[fresh.current_index];
      const isFirst = action === 'start';
      const prompt = ptr.buildReviewTurnPrompt(concept, isFirst);

      // Drive the tutor with the concept prompt so it emits teach + [CHECK].
      // This reuses the same engine as normal chat — private-tutor first,
      // generic tutor as fallback.
      let response: string;
      try {
        const result = await getPrivateTutorResponse(env, user, prompt);
        response = result.text;
      } catch (e: any) {
        console.error('[ptr] private-tutor failed, falling back:', e?.message || e);
        response = await getTutorResponse(env, user, prompt);
      }

      // Parse the [CHECK] block and wire up the active CQ. Tag the CQ with
      // the review context so the CQ resolver knows to advance this review
      // after a correct answer.
      try {
        const cqSvc = await import('../services/comprehension-check');
        const parsed = cqSvc.parseCheckBlock(response);
        const teachText = parsed.teach_text || response;
        await sendMessage(env, chatId, teachText);
        if (parsed.cq) {
          // Note: bridge back to this review is via (user_id + concept match)
          // when the CQ resolves — see post-test-review advance block in cq:a
          await cqSvc.saveActiveCq(env, user.id, parsed.cq, {
            plan_id: null,
            step_index: fresh.current_index,
            concept,
            strategy_used: null,
          });
          await sendMessage(env, chatId, cqSvc.formatCqMessage(parsed.cq), cqSvc.buildCqKeyboard(parsed.cq.options));
        } else {
          // Tutor didn't emit a CHECK block — offer lanjut/cukup anyway
          await sendMessage(env, chatId, 'Mau lanjut ke konsep berikutnya atau cukup dulu?', {
            inline_keyboard: [[
              { text: 'Lanjut', callback_data: `ptr:next:${reviewId}` },
              { text: 'Cukup dulu', callback_data: `ptr:done:${reviewId}` },
            ]],
          });
        }
      } catch (e) {
        console.error('[ptr] CQ parse/save failed:', e);
        await sendMessage(env, chatId, response);
      }
    } catch (e) {
      console.error('ptr callback error:', e);
      await sendMessage(env, chatId, 'Ada masalah buka sesi review. Coba lagi sebentar lagi ya.');
    }
    return;
  }

  // ═══════════════════════════════════════════════════════
  // PRE-TEST DRILL CALLBACKS
  //   drill:go:<concept>:<count>  — open the mini app drill for this concept
  //   drill:skip                  — student declined the drill offer
  // Callback_data cap is 64 bytes — concept names are short skill_tags so
  // fitting two colons + a count stays under the limit for known tags.
  // ═══════════════════════════════════════════════════════
  if (data.startsWith('drill:')) {
    try {
      const parts = data.split(':');
      const action = parts[1];

      if (action === 'skip') {
        await sendMessage(env, chatId, 'Oke, nggak perlu warm-up. Siap aja langsung /test kalau mau mulai.');
        return;
      }

      if (action === 'go') {
        const concept = String(parts[2] || '');
        const count = parseInt(parts[3] || '3', 10) || 3;
        if (!concept) {
          await sendMessage(env, chatId, 'Drill tidak valid. Coba /warmup lagi.');
          return;
        }
        const { buildDrillUrl } = await import('../services/pre-test-drill');
        const url = buildDrillUrl(env, concept, count);
        // Telegram web_app buttons open inside the Telegram client — best UX for mini app.
        await sendMessage(env, chatId, `🎯 Buka drill *${concept.replace(/_/g, ' ')}* (${count} soal) di mini app:`, {
          inline_keyboard: [[
            { text: `🚀 Mulai drill (${count} soal)`, web_app: { url } },
          ]],
        });
        return;
      }
    } catch (e) {
      console.error('drill callback error:', e);
    }
    return;
  }

  // ═══════════════════════════════════════════════════════
  // COMPANION RE-ENGAGEMENT CALLBACKS
  // ═══════════════════════════════════════════════════════
  if (data.startsWith('companion_')) {
    try {
      const { handleCompanionReply, markBridgeAccepted, getActiveCompanionConversation } = await import('../services/companion');

      if (data === 'companion_bridge_accept') {
        // Student accepted the redirect to study!
        await markBridgeAccepted(env, user.id);
        await sendMessage(env, chatId,
          `Oke, ayo! 💪 Mau ngapain?\n\nKetik /study buat belajar, /test buat latihan soal, atau /review buat review.`,
          mainMenuKeyboard(env.WEBAPP_URL, user.telegram_id)
        );
        return;
      }

      if (data === 'companion_later') {
        // Respect their choice
        await sendMessage(env, chatId, 'Oke, nggak apa-apa! Aku di sini kapan aja kamu mau ngobrol atau belajar. Take care! 💙');
        // End the companion conversation gracefully
        await env.DB.prepare(
          `UPDATE companion_conversations SET status = 'ended', ended_at = datetime('now')
           WHERE user_id = ? AND status = 'active'`
        ).bind(user.id).run();
        return;
      }

      if (data === 'companion_continue') {
        await sendMessage(env, chatId, 'Oke, lanjut ngobrol aja! Cerita apa aja, aku dengerin 😊');
        return;
      }

      // Mood-based responses for Tier 2 check-in buttons
      // Map button data to natural language so GPT can respond contextually
      const moodToText: Record<string, string> = {
        'companion_mood_ok': 'Aku baik-baik aja kok',
        'companion_mood_low': 'Lagi agak down sih',
        'companion_mood_hard': 'Soalnya susah banget',
        'companion_mood_talk': 'Mau ngobrol aja',
      };

      if (moodToText[data]) {
        const moodText = moodToText[data];
        // Route through GPT conversation for a natural, contextual response
        const result = await handleCompanionReply(env, user, moodText);
        if (result) {
          await sendMessage(env, chatId, result.text);
          if (result.bridgeReady) {
            await sendMessage(env, chatId, 'Btw, kalau mau, aku bisa siapin latihan ringan buat kamu 😊', {
              inline_keyboard: [
                [
                  { text: '📚 Mau coba latihan', callback_data: 'companion_bridge_accept' },
                  { text: '💬 Lanjut ngobrol', callback_data: 'companion_continue' },
                ],
              ],
            });
          }
        } else {
          // Fallback if GPT fails
          const fallback: Record<string, string> = {
            'companion_mood_ok': 'Syukurlah! 😊 Lagi ngapain aja belakangan? Cerita dong',
            'companion_mood_low': 'Aku dengerin. Mau cerita? Nggak usah sungkan, apapun boleh 💙',
            'companion_mood_hard': 'Hmm, bagian mana yang paling bikin pusing? Mungkin aku bisa bantu jelasin pelan-pelan',
            'companion_mood_talk': 'Oke, aku di sini! Cerita apa aja, aku dengerin 💬',
          };
          await sendMessage(env, chatId, fallback[data] || 'Aku di sini! Cerita aja 😊');
        }
        return;
      }
    } catch (e) {
      console.error('Companion callback error:', e);
      await sendMessage(env, chatId, 'Ada masalah. Coba lagi ya!');
    }
    return;
  }

  // ═══════════════════════════════════════════════════════
  // SPEAKING PRACTICE CALLBACKS
  // ═══════════════════════════════════════════════════════
  if (data.startsWith('speak_topic_')) {
    const topicType = data.replace('speak_topic_', '');
    const testType = user.target_test || 'TOEFL_IBT';
    const prompts = SPEAKING_PROMPTS[testType] || SPEAKING_PROMPTS.TOEFL_IBT;

    let selectedPrompt = '';
    let selectedType = topicType;

    // IELTS 3-Part Speaking Test — full simulation
    if (topicType === 'ielts3part') {
      const part1Questions = [
        'What is your full name?',
        'Where are you from?',
        'Do you work or study?',
        'What do you enjoy doing in your free time?',
        'How often do you use the internet?',
      ];
      const part2Topics = [
        { cue: 'Describe a book you have recently read.', bullets: 'what the book was about, why you read it, what you learned from it, how it made you feel' },
        { cue: 'Describe a place you visited that you found interesting.', bullets: 'where it was, when you went, what you did there, why it was interesting' },
        { cue: 'Describe a person who has influenced you.', bullets: 'who this person is, how you know them, what they did, why they influenced you' },
        { cue: 'Describe a skill you would like to learn.', bullets: 'what skill it is, why you want to learn it, how you would learn it, how it would benefit you' },
        { cue: 'Describe an important decision you made.', bullets: 'what the decision was, when you made it, how you made it, what the result was' },
      ];
      const topic = part2Topics[Math.floor(Math.random() * part2Topics.length)];

      // Store as multi-part session with metadata
      const metadata = JSON.stringify({
        mode: 'ielts_3part',
        current_part: 1,
        part1_questions: part1Questions,
        part1_index: 0,
        part2_cue: topic.cue,
        part2_bullets: topic.bullets,
        responses: [],
      });

      try {
        const session = await env.DB.prepare(
          `INSERT INTO speaking_sessions (user_id, prompt, test_type, topic_type, status)
           VALUES (?, ?, 'IELTS', 'ielts_3part', 'active') RETURNING id`,
        ).bind(user.id, JSON.stringify({ part1: part1Questions, part2: topic })).first() as any;

        // Store metadata in feedback column temporarily
        await env.DB.prepare(
          `UPDATE speaking_sessions SET feedback = ? WHERE id = ?`,
        ).bind(metadata, session.id).run();

        await editMessage(env, chatId, messageId,
          `🎯 *IELTS Speaking Test — Part 1*\n\n` +
          `Examiner akan bertanya tentang topik familiar. Kirim voice message untuk menjawab.\n\n` +
          `❓ *Pertanyaan 1/5:*\n"${part1Questions[0]}"\n\n` +
          `🎙️ Kirim voice message untuk menjawab.`,
        );
      } catch (e: any) {
        console.error('3-part speaking error:', e);
        await sendMessage(env, chatId, 'Gagal membuat sesi IELTS 3-part. Coba lagi.');
      }
      return;
    }

    if (topicType === 'random') {
      selectedPrompt = prompts[Math.floor(Math.random() * prompts.length)];
    } else if (topicType === 'opinion') {
      const opinionPrompts = prompts.filter((p: string) => p.toLowerCase().includes('agree') || p.toLowerCase().includes('prefer') || p.toLowerCase().includes('do you think'));
      selectedPrompt = opinionPrompts.length > 0 ? opinionPrompts[Math.floor(Math.random() * opinionPrompts.length)] : prompts[0];
      selectedType = 'opinion';
    } else if (topicType === 'describe') {
      const describePrompts = prompts.filter((p: string) => p.toLowerCase().includes('describe'));
      selectedPrompt = describePrompts.length > 0 ? describePrompts[Math.floor(Math.random() * describePrompts.length)] : prompts[0];
      selectedType = 'describe';
    }

    try {
      // Insert speaking session
      const session = await env.DB.prepare(
        'INSERT INTO speaking_sessions (user_id, prompt, test_type, topic_type, status) VALUES (?, ?, ?, ?, ?) RETURNING id'
      ).bind(user.id, selectedPrompt, testType, selectedType, 'active').first() as any;

      // Send the prompt
      await editMessage(env, chatId, messageId,
        `🎤 *Speaking Task*\n\n` +
        `📝 *Prompt:* "${selectedPrompt}"\n\n` +
        `⏱️ *Waktu:* 60 detik\n\n` +
        `🎙️ *Instruksi:*\n` +
        `1. Tekan tombol microphone\n` +
        `2. Jawab prompt di atas\n` +
        `3. Kirim voice message\n\n` +
        `Tutor AI akan menilai pronunciation, fluency, grammar, vocabulary kamu.`
      );
    } catch (e: any) {
      console.error('Speaking session error:', e);
      await sendMessage(env, chatId, 'Gagal membuat sesi speaking. Coba lagi.');
    }
    return;
  }

  // Quick test switch from study menu
  if (data === 'switch_test') {
    const currentTest = user.target_test || 'TOEFL_IBT';
    const testOptions: Record<string, string> = {
      'TOEFL_IBT': '🇺🇸 TOEFL iBT',
      'IELTS': '🇬🇧 IELTS',
      'TOEFL_ITP': '📚 TOEFL ITP',
      'TOEIC': '🏢 TOEIC',
    };
    const buttons = Object.entries(testOptions).map(([key, label]) => ({
      text: key === currentTest ? `✅ ${label}` : label,
      callback_data: `quickswitch_${key}`,
    }));
    await editMessage(env, chatId, messageId,
      `🎯 *Ganti Target Tes*\n\nTarget kamu sekarang: *${currentTest.replace(/_/g, ' ')}*\n\nPilih tes yang mau kamu pelajari:`,
      {
        inline_keyboard: [
          [buttons[0], buttons[1]],
          [buttons[2], buttons[3]],
          [{ text: '⬅️ Kembali ke Belajar', callback_data: 'back_study' }],
        ],
      }
    );
    return;
  }

  if (data.startsWith('quickswitch_')) {
    const test = data.replace('quickswitch_', '');
    const SWITCH_VALID = ['TOEFL_IBT', 'TOEFL_ITP', 'IELTS', 'TOEIC'];
    if (!SWITCH_VALID.includes(test)) return;
    await env.DB.prepare('UPDATE users SET target_test = ? WHERE id = ?').bind(test, user.id).run();
    // Show updated study menu with new test badge
    const tt = test;
    await editMessage(env, chatId, messageId,
      `✅ Target tes diubah ke *${tt.replace(/_/g, ' ')}*!\n\nMau belajar apa nih? Pilih kategori di bawah 👇`,
      studyTopicKeyboard(tt),
    );
    return;
  }

  // Settings changes
  const VALID_TEST_TYPES = ['TOEFL_IBT', 'TOEFL_ITP', 'IELTS', 'TOEIC'];
  const VALID_LEVELS = ['beginner', 'intermediate', 'advanced'];

  if (data.startsWith('setting_test_')) {
    const test = data.replace('setting_test_', '');
    if (!VALID_TEST_TYPES.includes(test)) {
      console.error(`Invalid test type from settings callback: ${test}`);
      return;
    }
    await env.DB.prepare('UPDATE users SET target_test = ? WHERE id = ?').bind(test, user.id).run();
    await editMessage(env, chatId, messageId,
      `✅ Target tes diubah ke: ${test.replace(/_/g, ' ')}\n\nKetik /help jika butuh bantuan.`
    );
    return;
  }
  if (data.startsWith('setting_level_')) {
    const level = data.replace('setting_level_', '');
    if (!VALID_LEVELS.includes(level)) {
      console.error(`Invalid proficiency level from settings callback: ${level}`);
      return;
    }
    await env.DB.prepare('UPDATE users SET proficiency_level = ? WHERE id = ?').bind(level, user.id).run();
    await editMessage(env, chatId, messageId,
      `✅ Level diubah ke: ${level}\n\nKetik /help jika butuh bantuan.`
    );
    return;
  }

  // ═══════════════════════════════════════════════════════
  // LEARNING STYLE CALLBACKS
  // ═══════════════════════════════════════════════════════
  if (data.startsWith('style_learn_')) {
    const style = data.replace('style_learn_', '');
    // Ensure a profile row exists — UPDATE on a missing row is a silent no-op
    // and the user's choice would never persist. This is the bug that made
    // /mystyle feel like it did nothing for brand-new users.
    await env.DB.prepare(
      'INSERT OR IGNORE INTO student_profiles (user_id) VALUES (?)'
    ).bind(user.id).run();
    await env.DB.prepare(
      'UPDATE student_profiles SET learning_style = ?, updated_at = datetime(\'now\') WHERE user_id = ?'
    ).bind(style, user.id).run();

    // Now ask for communication style
    await editMessage(env, chatId, messageId,
      `✅ Gaya belajar: *${style}*\n\nSekarang pilih gaya komunikasi tutor:`,
      {
        inline_keyboard: [
          [
            { text: '🧠 Socratic (tanya balik)', callback_data: 'style_comm_socratic' },
          ],
          [
            { text: '📖 Storytelling', callback_data: 'style_comm_storytelling' },
            { text: '🎓 Formal', callback_data: 'style_comm_formal' },
          ],
          [
            { text: '😎 Casual', callback_data: 'style_comm_casual' },
            { text: '🎯 Direct', callback_data: 'style_comm_direct' },
          ],
        ],
      }
    );
    return;
  }

  if (data.startsWith('style_comm_')) {
    const commStyle = data.replace('style_comm_', '');
    await env.DB.prepare(
      'INSERT OR IGNORE INTO student_profiles (user_id) VALUES (?)'
    ).bind(user.id).run();
    await env.DB.prepare(
      'UPDATE student_profiles SET communication_style = ?, updated_at = datetime(\'now\') WHERE user_id = ?'
    ).bind(commStyle, user.id).run();

    // Ask for depth level
    await editMessage(env, chatId, messageId,
      `✅ Komunikasi: *${commStyle}*\n\nTerakhir — level kedalaman materi:`,
      {
        inline_keyboard: [
          [
            { text: '🌱 Beginner', callback_data: 'style_depth_beginner' },
            { text: '🌿 Elementary', callback_data: 'style_depth_elementary' },
          ],
          [
            { text: '🌳 Intermediate', callback_data: 'style_depth_intermediate' },
          ],
          [
            { text: '🏔️ Advanced', callback_data: 'style_depth_advanced' },
            { text: '⭐ Expert', callback_data: 'style_depth_expert' },
          ],
        ],
      }
    );
    return;
  }

  if (data.startsWith('style_depth_')) {
    const depth = data.replace('style_depth_', '');
    await env.DB.prepare(
      'INSERT OR IGNORE INTO student_profiles (user_id) VALUES (?)'
    ).bind(user.id).run();
    await env.DB.prepare(
      'UPDATE student_profiles SET depth_level = ?, updated_at = datetime(\'now\') WHERE user_id = ?'
    ).bind(depth, user.id).run();

    await editMessage(env, chatId, messageId,
      `✅ *Profil belajar tersimpan!*\n\n` +
      `Tutor sekarang akan menyesuaikan:\n` +
      `- Cara menjelaskan sesuai gaya belajarmu\n` +
      `- Gaya komunikasi yang kamu suka\n` +
      `- Kedalaman materi sesuai levelmu\n\n` +
      `Profil ini otomatis berkembang seiring interaksimu.\n` +
      `Ketik /profile untuk lihat profil lengkap.`
    );
    return;
  }

  // Profile callbacks
  if (data === 'profile_change_style') {
    await editMessage(env, chatId, messageId,
      `🎨 *Ubah Gaya Belajar*\n\nPilih:`,
      {
        inline_keyboard: [
          [
            { text: '👁️ Visual', callback_data: 'style_learn_visual' },
            { text: '💬 Verbal', callback_data: 'style_learn_verbal' },
          ],
          [
            { text: '🏃 Active', callback_data: 'style_learn_active' },
            { text: '🤔 Reflective', callback_data: 'style_learn_reflective' },
          ],
          [
            { text: '⚖️ Balanced', callback_data: 'style_learn_balanced' },
          ],
        ],
      }
    );
    return;
  }

  if (data === 'profile_set_target') {
    await editMessage(env, chatId, messageId,
      `🎯 *Set Target Score*\n\nPilih target kamu:`,
      {
        inline_keyboard: [
          [
            { text: 'TOEFL 80+', callback_data: 'target_score_80' },
            { text: 'TOEFL 90+', callback_data: 'target_score_90' },
            { text: 'TOEFL 100+', callback_data: 'target_score_100' },
          ],
          [
            { text: 'IELTS 6.0', callback_data: 'target_band_6.0' },
            { text: 'IELTS 6.5', callback_data: 'target_band_6.5' },
            { text: 'IELTS 7.0+', callback_data: 'target_band_7.0' },
          ],
        ],
      }
    );
    return;
  }

  if (data.startsWith('target_score_')) {
    const score = parseFloat(data.replace('target_score_', ''));
    await env.DB.prepare(
      'UPDATE student_profiles SET target_band_score = ? WHERE user_id = ?'
    ).bind(score, user.id).run();
    await editMessage(env, chatId, messageId, `✅ Target score diset ke: ${score}+`);
    return;
  }

  if (data.startsWith('target_band_')) {
    const band = parseFloat(data.replace('target_band_', ''));
    await env.DB.prepare(
      'UPDATE student_profiles SET target_band_score = ? WHERE user_id = ?'
    ).bind(band, user.id).run();
    await editMessage(env, chatId, messageId, `✅ Target band diset ke: ${band}`);
    return;
  }

  // Lesson plan callbacks
  if (data === 'start_lesson_plan') {
    await editMessage(env, chatId, messageId, '🤖 Generating lesson plan...');
    try {
      const { generatePersonalizedPlan, formatTopicName } = await import('../services/lesson-engine');
      const plan = await generatePersonalizedPlan(env, user);
      const skills = plan.target_skills.map((s: string) => formatTopicName(s)).join(', ');

      await sendMessage(env, chatId,
        `📖 *${plan.title}*\n\n${plan.description}\n\n` +
        `📚 Skills: ${skills}\n⏱️ ${plan.estimated_minutes} menit | 📝 ${plan.total_steps} steps\n\n` +
        `Ketik /lesson untuk mulai!`
      );
    } catch (e: any) {
      await sendMessage(env, chatId, 'Gagal generate plan. Coba lagi ya.');
    }
    return;
  }

  if (data.startsWith('lesson_start_') || data.startsWith('lesson_skip_') || data.startsWith('lesson_complete_')) {
    const planId = parseInt(data.replace(/lesson_(start|skip|complete)_/, ''));
    const isSkip = data.startsWith('lesson_skip_');
    const isComplete = data.startsWith('lesson_complete_');

    if (isSkip || isComplete) {
      const { advanceLessonStep } = await import('../services/lesson-engine');
      // Passing stepResult makes the advance durably recorded in
      // lesson_step_results. Skip writes feedback='skipped' (score stays
      // null). Complete writes feedback='completed' with score=1.0 so
      // reports can show which steps the student actually finished.
      //
      // Previously `lesson_complete_*` didn't exist: there was no path
      // that advanced current_step on natural completion, so real learners
      // stayed stuck on step 0 forever while only skip-mashers progressed.
      // Tracks P1 BUGS.md #6.
      await advanceLessonStep(env, planId, user.id, {
        score: isComplete ? 1.0 : (null as any),
        time_spent_sec: 0,
        response_data: null as any,
        feedback: isComplete ? 'completed' : 'skipped',
      });
    }

    // Send the current step's instruction to tutor mode
    const { getActivePlan } = await import('../services/lesson-engine');
    const plan = await getActivePlan(env, user.id);
    if (plan && plan.current_step < plan.total_steps) {
      const step = plan.lessons[plan.current_step];
      await editMessage(env, chatId, messageId,
        `📖 *${step.title}*\n\n` +
        `Kirim pesan apapun untuk mulai step ini dengan tutor.\n\n` +
        `Kalau sudah selesai ngobrol sama tutor dan paham materinya, tap "✅ Selesai" di bawah — baru step berikutnya kebuka.`,
        {
          inline_keyboard: [
            [
              { text: '✅ Selesai step ini', callback_data: `lesson_complete_${planId}` },
              { text: '⏭️ Skip', callback_data: `lesson_skip_${planId}` },
            ],
            [
              { text: '⏸️ Pause plan', callback_data: `lesson_pause_${planId}` },
            ],
          ],
        },
      );
      // Set tutor mode to lesson with the step's topic
      await env.DB.prepare(
        `UPDATE student_profiles SET tutor_mode = 'lesson', current_topic = ?, current_lesson_step = ? WHERE user_id = ?`
      ).bind(step.skill, step.index, user.id).run();
    } else {
      await editMessage(env, chatId, messageId, '🎉 Lesson plan selesai semua! Ketik /lesson untuk plan baru.');
    }
    return;
  }

  if (data.startsWith('shop_buy_')) {
    // Purchase flow for coin_shop items. Atomic: spendCoins uses a
    // conditional UPDATE so double-tapping the button can't overdraw.
    // Effects that can't be applied cleanly right now ("coming soon")
    // refund the coins before returning so the user isn't penalized.
    const itemId = data.replace('shop_buy_', '');
    try {
      const item = await env.DB.prepare(
        `SELECT id, name, price, effect_type, effect_value, icon FROM coin_shop WHERE id = ? AND active = 1`
      ).bind(itemId).first() as any;

      if (!item) {
        await editMessage(env, chatId, messageId, '❌ Item tidak ditemukan.');
        return;
      }

      const { spendCoins } = await import('../services/coins');
      const spend = await spendCoins(env, user.id, item.price, 'shop_purchase', item.id);
      if (!spend.success) {
        await editMessage(env, chatId, messageId,
          `🪙 Coins kurang. Butuh ${item.price}, kamu punya ${spend.total_coins}. Latihan lagi dulu ya.`
        );
        return;
      }

      // Apply effect. Each branch is best-effort; on failure we refund
      // the coins so the student isn't left short + empty-handed.
      let effectMsg = '';
      let refund = false;
      try {
        if (item.effect_type === 'streak_freeze') {
          const n = parseInt(String(item.effect_value || '1'));
          await env.DB.prepare(
            `UPDATE user_xp SET streak_freezes = COALESCE(streak_freezes, 0) + ? WHERE user_id = ?`
          ).bind(n, user.id).run();
          effectMsg = `🧊 +${n} Streak Freeze aktif. Streak kamu aman kalau lupa belajar ${n} hari.`;
        } else if (item.effect_type === 'extra_questions') {
          const n = parseInt(String(item.effect_value || '5'));
          // Bump referral_bonus_quota so today's quota check picks it up.
          await env.DB.prepare(
            `INSERT INTO referral_bonus_quota (user_id, bonus_questions)
             VALUES (?, ?)
             ON CONFLICT(user_id) DO UPDATE SET
               bonus_questions = referral_bonus_quota.bonus_questions + ?,
               updated_at = datetime('now')`
          ).bind(user.id, n, n).run();
          effectMsg = `📝 +${n} soal bonus ditambahkan. Total quota hari ini naik.`;
        } else {
          // Effects we haven't implemented yet (xp_multiplier, premium_hours,
          // challenge_skip). Refund so the coin drain isn't punitive.
          refund = true;
          effectMsg = `🚧 "${item.name}" masih dalam pengembangan. Coins dikembalikan.`;
        }
      } catch (effErr: any) {
        console.error('shop effect error:', effErr);
        refund = true;
        effectMsg = `⚠️ Pembelian gagal. Coins dikembalikan. Coba lagi nanti.`;
      }

      if (refund) {
        try {
          await env.DB.prepare(
            `UPDATE user_xp SET coins = COALESCE(coins, 0) + ? WHERE user_id = ?`
          ).bind(item.price, user.id).run();
          await env.DB.prepare(
            `INSERT INTO coin_log (user_id, amount, source, detail) VALUES (?, ?, 'shop_refund', ?)`
          ).bind(user.id, item.price, item.id).run();
        } catch (e) { console.error('refund failed:', e); }
      }

      await editMessage(env, chatId, messageId,
        `${item.icon} *${item.name}* — ${refund ? 'refund' : 'aktif'}\n\n${effectMsg}\n\nKetik /shop untuk lihat item lain.`
      );
    } catch (e: any) {
      console.error('shop_buy error:', e);
      await editMessage(env, chatId, messageId, '⚠️ Pembelian gagal. Coba lagi nanti.');
    }
    return;
  }

  if (data.startsWith('lesson_pause_')) {
    const planId = parseInt(data.replace('lesson_pause_', ''));
    await env.DB.prepare(
      `UPDATE lesson_plans SET status = 'paused', updated_at = datetime('now') WHERE id = ? AND user_id = ?`
    ).bind(planId, user.id).run();
    await editMessage(env, chatId, messageId, '⏸️ Lesson plan di-pause. Ketik /lesson untuk lanjut kapan saja.');
    return;
  }

  // ─── Conversational onboarding callbacks ────────────────────────────
  // Flow: welcome → target → deadline → level → commitment → tryone → done
  // All screens edit the same message; completion sends a fresh message
  // with the main keyboard.

  if (data === 'onb_start') {
    const { text, keyboard } = await onTapStart(env, user);
    await editMessage(env, chatId, messageId, text, keyboard);
    return;
  }

  if (data.startsWith('onb_target_')) {
    const target = data.replace('onb_target_', '');
    const { text, keyboard } = await onPickTarget(env, user, target);
    await editMessage(env, chatId, messageId, text, keyboard);
    return;
  }

  if (data.startsWith('onb_deadline_')) {
    const code = data.replace('onb_deadline_', '');
    const { text, keyboard } = await onPickDeadline(env, user, code);
    await editMessage(env, chatId, messageId, text, keyboard);
    return;
  }

  if (data.startsWith('onb_level_')) {
    const code = data.replace('onb_level_', '');
    const { text, keyboard } = await onPickLevel(env, user, code);
    await editMessage(env, chatId, messageId, text, keyboard);
    return;
  }

  if (data.startsWith('onb_commit_')) {
    const minutes = parseInt(data.replace('onb_commit_', ''), 10);
    const { text, keyboard } = await onPickCommit(env, user, minutes);
    await editMessage(env, chatId, messageId, text, keyboard);
    return;
  }

  if (data.startsWith('onb_try_')) {
    const correct = data === 'onb_try_correct';
    const tgUser = (query.from || {}) as any;
    const firstName = tgUser.first_name || user.name || 'kamu';
    const { answerText, doneText, doneKeyboard } = await onTrySubmit(
      env, user, correct, firstName,
    );
    // Replace the question with the reaction (Correct! / Hampir…)
    await editMessage(env, chatId, messageId, answerText);
    // Send the "setup complete" summary with handoff buttons
    await sendMessage(env, chatId, doneText, doneKeyboard);
    return;
  }

  if (data === 'onb_done_diag') {
    await editMessage(env, chatId, messageId, '🩺 Diagnostic dimulai — semangat!');
    // Kick off diagnostic by dispatching /diagnostic internally. Simpler:
    // show the main keyboard + ask user to tap /diagnostic manually so the
    // command runs through its normal entry path (consistent state handling).
    await sendMessage(env, chatId,
      `Ketik /diagnostic untuk memulai. 20 soal, kurang lebih 15 menit.\n\n` +
      `Tenang — ini bukan tes beneran, cuma buat aku tau skill kamu di titik mana.`,
      mainMenuKeyboard(env.WEBAPP_URL, user.telegram_id),
    );
    return;
  }

  if (data === 'onb_done_menu') {
    await editMessage(env, chatId, messageId, '📖 Main menu aktif.');
    await sendMessage(env, chatId,
      `Oke, santai dulu. Kalau siap, /diagnostic kapan aja — ` +
      `atau langsung coba /study buat pilih topik belajar.\n\n` +
      `Aku di sini 24/7 💛`,
      mainMenuKeyboard(env.WEBAPP_URL, user.telegram_id),
    );
    return;
  }

  // Study category sub-menus
  // NEW SKILL-BASED CATEGORIES
  if (data === 'cat_reading') {
    const tt = user.target_test || 'TOEFL_IBT';
    await editMessage(env, chatId, messageId, `📖 *Reading Skills* (${tt.replace('_', ' ')}) — Pilih latihan:`, readingKeyboard(tt));
    return;
  }
  if (data === 'cat_listening') {
    const tt = user.target_test || 'TOEFL_IBT';
    await editMessage(env, chatId, messageId, `🎧 *Listening Skills* (${tt.replace('_', ' ')}) — Pilih latihan:`, listeningKeyboard(tt));
    return;
  }
  if (data === 'cat_speaking') {
    const tt = user.target_test || 'TOEFL_IBT';
    await editMessage(env, chatId, messageId, `🗣 *Speaking Skills* (${tt.replace('_', ' ')}) — Pilih latihan:`, speakingKeyboard(tt));
    return;
  }
  if (data === 'cat_writing') {
    const tt = user.target_test || 'TOEFL_IBT';
    await editMessage(env, chatId, messageId, `✍️ *Writing Skills* (${tt.replace('_', ' ')}) — Pilih latihan:`, writingKeyboard(tt));
    return;
  }

  // TRADITIONAL CATEGORIES
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
    await editMessage(env, chatId, messageId, '📚 *Menu Belajar*\n\nPilih skill yang mau dilatih:', studyTopicKeyboard(user.target_test || 'TOEFL_IBT'));
    return;
  }
  if (data === 'back_target') {
    // User hit "Kembali" on level selection — return to target-test picker
    await editMessage(env, chatId, messageId,
      `📋 *Step 1 dari 2 — Pilih Target Tes*\n\n` +
      `Kamu mau persiapan tes yang mana?`,
      testTypeKeyboard,
    );
    return;
  }

  // ═══════════════════════════════════════════════════════
  // PRONUNCIATION BANK CALLBACKS
  // ═══════════════════════════════════════════════════════

  if (data.startsWith('pronun_cat_') || data === 'pronun_random') {
    const category = data === 'pronun_random' ? null : data.replace('pronun_cat_', '');

    try {
      let word: any;
      if (category) {
        // Get random word from specific category
        word = await env.DB.prepare(
          'SELECT * FROM pronunciation_bank WHERE category = ? ORDER BY RANDOM() LIMIT 1'
        ).bind(category).first();
      } else {
        // Random from any category
        word = await env.DB.prepare(
          'SELECT * FROM pronunciation_bank ORDER BY RANDOM() LIMIT 1'
        ).first();
      }

      if (!word) {
        await editMessage(env, chatId, messageId, 'Belum ada kata di kategori ini. Coba kategori lain!');
        return;
      }

      // Format the pronunciation card
      const catLabels: Record<string, string> = {
        th_sounds: '🦷 TH Sounds', vowel_pairs: '🔤 Vowel Pairs', word_stress: '🎯 Word Stress',
        final_consonants: '🔚 Final Consonants', r_and_l: '🔄 R & L Sounds', silent_letters: '🤫 Silent Letters',
        academic_vocab: '📚 Academic Vocab', connected_speech: '🔗 Connected Speech',
        commonly_mispronounced: '❌ Commonly Wrong', sentence_practice: '🗣️ Sentence Practice',
        schwa_sound: '🔊 Schwa Sound', homophones: '👥 Homophones', numbers_dates: '🔢 Numbers & Dates',
        business_english: '💼 Business English', academic_phrases: '📝 Academic Phrases',
        ielts_topics: '🌊 IELTS Topics', toefl_listening: '🎓 TOEFL Listening',
        tongue_twisters: '😜 Tongue Twisters', w_and_v: '🆚 W & V Sounds',
      };
      const diffEmoji: Record<string, string> = { beginner: '🟢', intermediate: '🟡', advanced: '🔴' };
      const testLabels: Record<string, string> = {
        ALL: '📋 Semua Tes', TOEFL_IBT: '📘 TOEFL iBT', IELTS: '📗 IELTS', TOEIC: '📙 TOEIC',
      };

      const isSentence = word.part_of_speech === 'sentence' || word.part_of_speech === 'phrase';
      const wordDisplay = isSentence ? `"${word.word}"` : `**${word.word}**`;
      const ipaLine = word.ipa ? `\n🔤 IPA: \`${word.ipa}\`` : '';

      let card = `${catLabels[word.category] || word.category}\n` +
        `${diffEmoji[word.difficulty] || '🟡'} ${word.difficulty} — ${testLabels[word.test_type] || word.test_type}\n\n` +
        `${wordDisplay}${ipaLine}\n`;

      if (word.example_sentence && !isSentence) {
        card += `\n💬 _${word.example_sentence}_\n`;
      }
      if (word.common_mistake) {
        card += `\n❌ Kesalahan umum: ${word.common_mistake}`;
      }
      if (word.tip) {
        card += `\n✅ Tips: ${word.tip}`;
      }

      const buttons = [
        [{ text: '🔊 Dengarkan Audio', callback_data: `pronun_audio_${word.id}` }],
        [
          { text: '🔄 Kata Lain', callback_data: category ? `pronun_cat_${category}` : 'pronun_random' },
          { text: '📋 Kategori', callback_data: 'pronun_menu' },
        ],
      ];

      await editMessage(env, chatId, messageId, card, { inline_keyboard: buttons });
    } catch (e: any) {
      console.error('Pronunciation bank error:', e);
      await editMessage(env, chatId, messageId, 'Terjadi error saat mengambil data. Coba lagi nanti.');
    }
    return;
  }

  // Audio playback for pronunciation word
  if (data.startsWith('pronun_audio_')) {
    const wordId = parseInt(data.replace('pronun_audio_', ''));
    try {
      const word = await env.DB.prepare('SELECT * FROM pronunciation_bank WHERE id = ?').bind(wordId).first() as any;
      if (!word) {
        await sendMessage(env, chatId, 'Kata tidak ditemukan.');
        return;
      }
      // Send TTS audio as voice message
      const textToSpeak = word.part_of_speech === 'sentence' || word.part_of_speech === 'phrase'
        ? word.word
        : `${word.word}. ... ${word.example_sentence || word.word}`;
      await sendTTSAudio(env, chatId, textToSpeak);
    } catch (e: any) {
      console.error('Pronunciation audio error:', e);
      await sendMessage(env, chatId, '❌ Gagal mengirim audio. Coba lagi nanti.');
    }
    return;
  }

  // Back to pronunciation menu
  if (data === 'pronun_menu') {
    const pronunCategories = [
      { text: '🦷 TH Sounds', callback_data: 'pronun_cat_th_sounds' },
      { text: '🔤 Vowel Pairs', callback_data: 'pronun_cat_vowel_pairs' },
      { text: '🎯 Word Stress', callback_data: 'pronun_cat_word_stress' },
      { text: '🔚 Final Consonants', callback_data: 'pronun_cat_final_consonants' },
      { text: '🔄 R & L Sounds', callback_data: 'pronun_cat_r_and_l' },
      { text: '🤫 Silent Letters', callback_data: 'pronun_cat_silent_letters' },
      { text: '📚 Academic Vocab', callback_data: 'pronun_cat_academic_vocab' },
      { text: '🔗 Connected Speech', callback_data: 'pronun_cat_connected_speech' },
      { text: '❌ Commonly Wrong', callback_data: 'pronun_cat_commonly_mispronounced' },
      { text: '🗣️ Sentence Practice', callback_data: 'pronun_cat_sentence_practice' },
      { text: '🔊 Schwa Sound', callback_data: 'pronun_cat_schwa_sound' },
      { text: '👥 Homophones', callback_data: 'pronun_cat_homophones' },
      { text: '🔢 Numbers & Dates', callback_data: 'pronun_cat_numbers_dates' },
      { text: '💼 Business English', callback_data: 'pronun_cat_business_english' },
      { text: '📝 Academic Phrases', callback_data: 'pronun_cat_academic_phrases' },
      { text: '🌊 IELTS Topics', callback_data: 'pronun_cat_ielts_topics' },
      { text: '🎓 TOEFL Listening', callback_data: 'pronun_cat_toefl_listening' },
      { text: '😜 Tongue Twisters', callback_data: 'pronun_cat_tongue_twisters' },
      { text: '🆚 W & V Sounds', callback_data: 'pronun_cat_w_and_v' },
    ];
    const pronunRows = [];
    for (let i = 0; i < pronunCategories.length; i += 2) {
      if (i + 1 < pronunCategories.length) {
        pronunRows.push([pronunCategories[i], pronunCategories[i + 1]]);
      } else {
        pronunRows.push([pronunCategories[i]]);
      }
    }
    pronunRows.push([{ text: '🎲 Random Word', callback_data: 'pronun_random' }]);
    await editMessage(env, chatId, messageId,
      `🔊 *Pronunciation Practice*\n\nPilih kategori:`,
      { inline_keyboard: pronunRows }
    );
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
      } catch (e) {
        console.error('Prerequisite check error:', e);
        // Continue with lesson even if prereq check fails
      }

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
        // For pronunciation lessons, send audio from pronunciation_bank
        if (weakness === 'pronunciation') {
          try {
            const sampleWords = await env.DB.prepare(
              'SELECT word FROM pronunciation_bank WHERE part_of_speech != ? ORDER BY RANDOM() LIMIT 6'
            ).bind('sentence').all();
            if (sampleWords.results && sampleWords.results.length > 0) {
              const wordsText = sampleWords.results.map((w: any) => w.word).join('. ');
              await sendTTSAudio(env, chatId, wordsText);
            } else {
              await sendTTSAudio(env, chatId, 'think. this. very. walked. needed. played.');
            }
          } catch {
            await sendTTSAudio(env, chatId, 'think. this. very. walked. needed. played.');
          }
          await sendMessage(env, chatId, '💡 Ketik /pronounce untuk latihan pronunciation lengkap dengan 254 kata dari 19 kategori!');
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
      // Track daily quota for free users
      try {
        const { trackQuestionAnswer, checkTestAccess } = await import('../services/premium');
        const access = await checkTestAccess(env, freshUser.id);
        if (!access.allowed) {
          await editMessage(env, chatId, messageId,
            `⚠️ Kuota harian habis (${access.used_today}/${access.daily_limit} soal).\n\n` +
            `Reset besok jam 00:00 WIB.\nKetik /premium untuk unlimited akses.`);
          return;
        }
        const trackResult = await trackQuestionAnswer(env, freshUser.id);
        if (trackResult.upgradeNudge) {
          await sendMessage(env, chatId,
            `⚡ Udah 7/10 soal hari ini — 3 soal lagi habis. Mau unlimited?\n💎 /premium (Rp 30rb/7 hari)`);
        }
      } catch (e) {
        console.error('Quota tracking error in study_lesson:', e);
      }
      await editMessage(env, chatId, messageId, '⏳ Menyiapkan pelajaran...');
      const prompt = `Pilih 1 topik (articles/tenses/prepositions/sv-agreement/passive-voice/conditionals). Kasih perbandingan Bahasa vs English (2 baris), 3 contoh kalimat, lalu 1 soal. Maks 8 baris. Plain text.`;
      const response = await getTutorResponse(env, freshUser, prompt);
      await sendMessage(env, chatId, response);
      return;
    }

    // Mini Mock Test — 5 random questions from different sections
    if (data === 'study_minitest') {
      // Track daily quota for free users
      try {
        const { trackQuestionAnswer, checkTestAccess } = await import('../services/premium');
        const access = await checkTestAccess(env, freshUser.id);
        if (!access.allowed) {
          await editMessage(env, chatId, messageId,
            `⚠️ Kuota harian habis (${access.used_today}/${access.daily_limit} soal).\n\n` +
            `Reset besok jam 00:00 WIB.\nKetik /premium untuk unlimited akses.`);
          return;
        }
        await trackQuestionAnswer(env, freshUser.id);
      } catch (trackErr) {
        console.error('trackQuestionAnswer error:', trackErr);
      }
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
         WHERE ta.user_id = ? AND aa.submitted_at >= ?
           AND NOT (aa.is_correct IS NULL AND aa.section NOT IN ('speaking','writing'))`
      ).bind(freshUser.id, today).first() as any;
      const count = todayCount?.count || 0;
      const target = 10;

      let msg = '';
      if (count >= target) {
        msg = `Target hari ini tercapai! Kamu sudah jawab ${count} soal hari ini. Keren!\n\nMau lanjut? Pilih topik di bawah:`;
      } else {
        msg = `Challenge hari ini: jawab ${target} soal.\n\nProgress: ${count}/${target} ${'🟩'.repeat(Math.min(count, target))}${'⬜'.repeat(Math.max(0, target - count))}\n\nTinggal ${target - count} lagi! Pilih topik:`;
      }
      await editMessage(env, chatId, messageId, msg, studyTopicKeyboard(user.target_test));
      return;
    }

    // Score Estimator
    if (data === 'study_score') {
      const stats = await env.DB.prepare(
        `SELECT section, COUNT(*) as total,
         SUM(CASE
           WHEN is_correct = 1 THEN 1
           WHEN is_correct IS NULL AND section IN ('speaking','writing')
                AND json_extract(answer_data, '$.score') >= 5 THEN 1
           ELSE 0
         END) as correct
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
      // Track daily quota for free users
      try {
        const { trackQuestionAnswer, checkTestAccess } = await import('../services/premium');
        const access = await checkTestAccess(env, freshUser.id);
        if (!access.allowed) {
          await editMessage(env, chatId, messageId,
            `⚠️ Kuota harian habis (${access.used_today}/${access.daily_limit} soal).\n\n` +
            `Reset besok jam 00:00 WIB.\nKetik /premium untuk unlimited akses.`);
          return;
        }
        await trackQuestionAnswer(env, freshUser.id);
      } catch (trackErr) {
        console.error('trackQuestionAnswer error:', trackErr);
      }
      await editMessage(env, chatId, messageId, '⏳ Sedang berpikir...');
      const response = await getTutorResponse(env, freshUser, 'Aku mau belajar bahasa Inggris untuk TOEFL iBT. Kasih 1 soal. Maks 8 baris. Plain text.');
      await sendMessage(env, chatId, response);
      return;
    }
  }

  // ═══════════════════════════════════════════════════════
  // UNIFIED SKILL EXERCISE HANDLER (Multi-step lessons)
  // ═══════════════════════════════════════════════════════

  const skillMatch = data.match(/^skill_(.+)$/);
  if (skillMatch) {
    const exerciseType = skillMatch[1];
    try {
      const { generateLesson, createLessonMeta, getStepDisplay, getStepInputType, getTotalSteps } = await import('../services/exercise-engine');

      // Cancel any existing active exercise
      await env.DB.prepare(
        `UPDATE exercise_sessions SET status = 'abandoned' WHERE user_id = ? AND status = 'active'`
      ).bind(user.id).run();

      await editMessage(env, chatId, messageId, '⏳ Membuat lesson...');

      const userLevel = user.proficiency_level || 'intermediate';
      const targetTest = user.target_test || 'TOEFL_IBT';
      const lesson = await generateLesson(env, exerciseType, userLevel, targetTest);
      if (!lesson) {
        await editMessage(env, chatId, messageId, '❌ Gagal membuat lesson. Coba lagi.');
        return;
      }

      const meta = createLessonMeta(lesson);
      const sessionResult = await env.DB.prepare(
        'INSERT INTO exercise_sessions (user_id, type, status, metadata) VALUES (?, ?, ?, ?) RETURNING id'
      ).bind(user.id, exerciseType, 'active', JSON.stringify(meta)).first() as any;

      if (!sessionResult?.id) throw new Error('Failed to create session');
      const sessionId = sessionResult.id;

      // Render step 0 (teach)
      const display = getStepDisplay(exerciseType, lesson, 0, sessionId);
      await editMessage(env, chatId, messageId, display.text, display.keyboard);
      if (display.tts_text) await sendTTSAudio(env, chatId, display.tts_text);
    } catch (e: any) {
      console.error('Exercise start error:', e);
      await editMessage(env, chatId, messageId, '❌ Error: ' + (e.message || 'unknown'));
    }
    return;
  }

  // ═══════════════════════════════════════════════════════
  // EXERCISE NAVIGATION CALLBACKS (ex_n_, ex_h_, ex_s_, ex_a_, ex_q_)
  // ═══════════════════════════════════════════════════════

  const exNavMatch = data.match(/^ex_([nhsaq])_(\d+)(?:_([A-F]))?$/);
  if (exNavMatch) {
    const [, action, sessionIdStr, mcqOption] = exNavMatch;
    const sessionId = parseInt(sessionIdStr);

    try {
      const { getStepDisplay, getStepInputType, getTotalSteps, getStepHint, scoreMCQ, renderSummary, getConfig } = await import('../services/exercise-engine');
      type LessonMeta = import('../services/exercise-engine').LessonMeta;

      const session = await env.DB.prepare(
        'SELECT * FROM exercise_sessions WHERE id = ? AND user_id = ?'
      ).bind(sessionId, user.id).first() as any;

      if (!session || session.status !== 'active') {
        await editMessage(env, chatId, messageId, '⚠️ Session tidak ditemukan atau sudah selesai.');
        return;
      }

      const meta: LessonMeta = JSON.parse(session.metadata || '{}');
      meta.scores = meta.scores || [];
      meta.hints = meta.hints || 0;
      const exerciseType = session.type;
      const total = getTotalSteps(exerciseType);

      // ── NEXT (advance to next step) ──
      if (action === 'n') {
        meta.step += 1;

        // Check if lesson is complete
        if (meta.step >= total) {
          const summary = renderSummary(exerciseType, meta.lesson, meta.scores, meta.hints);
          const avgScore = meta.scores.length > 0 ? Math.round(meta.scores.reduce((a: number, b: number) => a + b, 0) / meta.scores.length) : 0;
          await env.DB.prepare(
            'UPDATE exercise_sessions SET status = ?, score = ?, metadata = ?, completed_at = ? WHERE id = ?'
          ).bind('completed', avgScore, JSON.stringify(meta), new Date().toISOString(), sessionId).run();
          await editMessage(env, chatId, messageId, summary.text, summary.keyboard);
          return;
        }

        // Determine input type for next step
        const inputType = getStepInputType(exerciseType, meta.step);
        meta.input = inputType === 'text' ? 'text' : inputType === 'voice' ? 'voice' : null;

        await env.DB.prepare(
          'UPDATE exercise_sessions SET metadata = ? WHERE id = ?'
        ).bind(JSON.stringify(meta), sessionId).run();

        const display = getStepDisplay(exerciseType, meta.lesson, meta.step, sessionId);
        await editMessage(env, chatId, messageId, display.text, display.keyboard);
        if (display.tts_text) await sendTTSAudio(env, chatId, display.tts_text);
        return;
      }

      // ── HINT ──
      if (action === 'h') {
        meta.hints += 1;
        await env.DB.prepare(
          'UPDATE exercise_sessions SET metadata = ? WHERE id = ?'
        ).bind(JSON.stringify(meta), sessionId).run();

        const hint = getStepHint(exerciseType, meta.lesson, meta.step);
        await sendMessage(env, chatId, hint);
        return;
      }

      // ── SKIP (score 0, advance) ──
      if (action === 's') {
        meta.scores.push(0);
        meta.step += 1;

        if (meta.step >= total) {
          const summary = renderSummary(exerciseType, meta.lesson, meta.scores, meta.hints);
          const avgScore = meta.scores.length > 0 ? Math.round(meta.scores.reduce((a: number, b: number) => a + b, 0) / meta.scores.length) : 0;
          await env.DB.prepare(
            'UPDATE exercise_sessions SET status = ?, score = ?, metadata = ?, completed_at = ? WHERE id = ?'
          ).bind('completed', avgScore, JSON.stringify(meta), new Date().toISOString(), sessionId).run();
          await editMessage(env, chatId, messageId, summary.text, summary.keyboard);
          return;
        }

        const inputType = getStepInputType(exerciseType, meta.step);
        meta.input = inputType === 'text' ? 'text' : inputType === 'voice' ? 'voice' : null;

        await env.DB.prepare(
          'UPDATE exercise_sessions SET metadata = ? WHERE id = ?'
        ).bind(JSON.stringify(meta), sessionId).run();

        await sendMessage(env, chatId, '⏭ Dilewati.');
        const display = getStepDisplay(exerciseType, meta.lesson, meta.step, sessionId);
        await sendMessage(env, chatId, display.text, display.keyboard);
        if (display.tts_text) await sendTTSAudio(env, chatId, display.tts_text);
        return;
      }

      // ── MCQ ANSWER ──
      if (action === 'a' && mcqOption) {
        const mcqResult = scoreMCQ(exerciseType, meta.lesson, meta.step, mcqOption);
        let { score, feedback } = mcqResult;
        meta.scores.push(score);

        // Personalize wrong-answer feedback: wrap with AI call that references
        // student context (weak concepts, streak, recent mistakes). Best-effort —
        // falls back to the canned `feedback` above on any failure.
        if (score < 60 && mcqResult.question_text && mcqResult.correct_letter) {
          try {
            const { generatePersonalizedWrongAnswerFeedback } = await import('../services/student-context');
            const personalized = await generatePersonalizedWrongAnswerFeedback(env, user.id, {
              question: mcqResult.question_text,
              student_answer: mcqResult.student_letter || mcqOption,
              correct_answer: mcqResult.correct_letter,
              options: mcqResult.options,
              canned_explanation: mcqResult.explanation_text || '',
              section: mcqResult.section || exerciseType,
            });
            if (personalized && personalized.trim().length > 0) feedback = personalized;
          } catch (e) {
            console.error('mcq: personalized feedback failed, using canned:', e);
          }
        }

        // Theory-of-Mind: record evidence
        try {
          const { recordEvidence } = await import('../services/mental-model');
          const evidenceType = score >= 60 ? 'correct_answer' : 'wrong_answer';
          const weight = score >= 80 ? 0.6 : 0.5; // MCQ evidence is slightly weaker than free-text
          await recordEvidence(env, user.id, exerciseType, evidenceType, `MCQ step ${meta.step} picked=${mcqOption}`, weight);
        } catch (e) { console.error('recordEvidence (mcq) error:', e); }

        // Study streak
        try {
          const { updateStreak } = await import('../services/analytics');
          await updateStreak(env, user.id);
        } catch (e) { console.error('updateStreak (mcq) error:', e); }

        meta.step += 1;

        const isLastStep = meta.step >= total;
        if (isLastStep) {
          const avgScore = meta.scores.length > 0 ? Math.round(meta.scores.reduce((a: number, b: number) => a + b, 0) / meta.scores.length) : 0;
          await env.DB.prepare(
            'UPDATE exercise_sessions SET status = ?, score = ?, metadata = ?, completed_at = ? WHERE id = ?'
          ).bind('completed', avgScore, JSON.stringify(meta), new Date().toISOString(), sessionId).run();

          await editMessage(env, chatId, messageId, feedback);
          const summary = renderSummary(exerciseType, meta.lesson, meta.scores, meta.hints);
          await sendMessage(env, chatId, summary.text, summary.keyboard);
        } else {
          const inputType = getStepInputType(exerciseType, meta.step);
          meta.input = inputType === 'text' ? 'text' : inputType === 'voice' ? 'voice' : null;

          await env.DB.prepare(
            'UPDATE exercise_sessions SET metadata = ? WHERE id = ?'
          ).bind(JSON.stringify(meta), sessionId).run();

          // Show feedback + next question button
          await editMessage(env, chatId, messageId, feedback, {
            inline_keyboard: [[{ text: '➡️ Soal Berikutnya', callback_data: `ex_n_${sessionId}` }]],
          });
        }
        return;
      }

      // ── QUIT ──
      if (action === 'q') {
        const avgScore = meta.scores.length > 0 ? Math.round(meta.scores.reduce((a: number, b: number) => a + b, 0) / meta.scores.length) : 0;
        await env.DB.prepare(
          'UPDATE exercise_sessions SET status = ?, score = ?, metadata = ?, completed_at = ? WHERE id = ?'
        ).bind('completed', avgScore, JSON.stringify(meta), new Date().toISOString(), sessionId).run();

        if (meta.scores.length > 0) {
          const summary = renderSummary(exerciseType, meta.lesson, meta.scores, meta.hints);
          await editMessage(env, chatId, messageId, summary.text, summary.keyboard);
        } else {
          await editMessage(env, chatId, messageId, '👋 Lesson dihentikan. Kembali ke /study kapan saja!');
        }
        return;
      }
    } catch (e: any) {
      console.error('Exercise nav error:', e);
      await sendMessage(env, chatId, '❌ Error: ' + (e.message || 'unknown'));
    }
    return;
  }

  // study_menu callback (back to main study menu)
  if (data === 'study_menu') {
    await editMessage(env, chatId, messageId, '📚 *Menu Belajar*\n\nPilih skill yang mau dilatih:', studyTopicKeyboard(user.target_test || 'TOEFL_IBT'));
    return;
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

// Old exercise handlers removed — now using exercise-engine.ts for multi-step lessons

async function editMessage(env: Env, chatId: number, messageId: number, text: string, replyMarkup?: any) {
  await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/editMessageText`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      message_id: messageId,
      text,
      parse_mode: 'Markdown',
      reply_markup: replyMarkup,
    }),
  });
}
