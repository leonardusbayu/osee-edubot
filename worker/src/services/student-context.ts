/**
 * Student Context Service — Personalization layer.
 *
 * Aggregates a compact snapshot of who the student is and how they've
 * been doing, so every AI-generated response (wrong-answer feedback,
 * companion chat, lesson transitions) can reference concrete details
 * about THIS student instead of sending canned text.
 *
 * Philosophy: fast and best-effort. Every field has a safe default.
 * If a query fails, we degrade gracefully — the caller still gets
 * a usable context object so the canned fallback can ship.
 */

import type { Env } from '../types';

export interface StudentContext {
  name: string;
  target_test: string;            // e.g. "TOEFL iBT", "IELTS"
  level: string;                   // beginner..expert
  learning_style: string;          // visual, verbal, active, reflective, balanced
  comm_style: string;              // socratic, storytelling, formal, casual, direct
  depth_level: string;             // beginner..expert
  streak_days: number;             // current study streak
  consecutive_wrong: number;       // how many wrong in a row
  consecutive_correct: number;
  total_answered: number;
  accuracy_pct: number | null;     // null if no answers yet
  recent_mistakes: {               // last 5 wrong answers, most recent first
    section: string;
    topic?: string;
    question_stub: string;         // first ~60 chars of the question
    submitted_at?: string;
  }[];
  weak_concepts: {                 // bottom 3 concepts by mental-model understanding
    concept: string;
    understanding: string;         // unknown, misconception, partial, solid, mastered
    misconceptions?: string[];
  }[];
  repeated_mistake_section?: string; // section missed 3+ times in last 10 answers (flag for feedback)
}

const DEFAULT_CTX: StudentContext = {
  name: 'Teman',
  target_test: 'English Test',
  level: 'intermediate',
  learning_style: 'balanced',
  comm_style: 'casual',
  depth_level: 'intermediate',
  streak_days: 0,
  consecutive_wrong: 0,
  consecutive_correct: 0,
  total_answered: 0,
  accuracy_pct: null,
  recent_mistakes: [],
  weak_concepts: [],
};

/**
 * Build a compact student context snapshot. Never throws — returns
 * sane defaults on any query failure so callers can always proceed.
 */
export async function getStudentContext(env: Env, userId: number): Promise<StudentContext> {
  const ctx: StudentContext = { ...DEFAULT_CTX, recent_mistakes: [], weak_concepts: [] };

  // 1. User + profile (single join). Profile may not exist yet.
  try {
    const row = await env.DB.prepare(`
      SELECT
        u.name, u.target_test, u.proficiency_level, u.current_streak,
        sp.learning_style, sp.communication_style, sp.depth_level,
        sp.consecutive_correct, sp.consecutive_wrong
      FROM users u
      LEFT JOIN student_profiles sp ON sp.user_id = u.id
      WHERE u.id = ?
    `).bind(userId).first() as any;

    if (row) {
      ctx.name = row.name || ctx.name;
      ctx.target_test = (row.target_test || 'English_Test').replaceAll('_', ' ');
      ctx.level = row.proficiency_level || ctx.level;
      ctx.streak_days = Number(row.current_streak || 0);
      ctx.learning_style = row.learning_style || ctx.learning_style;
      ctx.comm_style = row.communication_style || ctx.comm_style;
      ctx.depth_level = row.depth_level || ctx.depth_level;
      ctx.consecutive_correct = Number(row.consecutive_correct || 0);
      ctx.consecutive_wrong = Number(row.consecutive_wrong || 0);
    }
  } catch (e) {
    console.error('student-context user/profile query failed:', e);
  }

  // 2. Overall accuracy (one aggregate query).
  try {
    const stats = await env.DB.prepare(`
      SELECT
        COUNT(aa.id) AS total,
        SUM(CASE WHEN aa.is_correct = 1 THEN 1 ELSE 0 END) AS correct
      FROM attempt_answers aa
      JOIN test_attempts ta ON aa.attempt_id = ta.id
      WHERE ta.user_id = ? AND aa.is_correct IS NOT NULL
    `).bind(userId).first() as any;
    const total = Number(stats?.total || 0);
    const correct = Number(stats?.correct || 0);
    ctx.total_answered = total;
    ctx.accuracy_pct = total > 0 ? Math.round((correct / total) * 100) : null;
  } catch (e) {
    console.error('student-context stats query failed:', e);
  }

  // 3. Last 10 answers — extract recent mistakes + repeated-section flag.
  // JOIN test_contents to get the question text (content is JSON).
  try {
    const recent = await env.DB.prepare(`
      SELECT aa.section, aa.is_correct, aa.submitted_at, tc.content AS content_json
      FROM attempt_answers aa
      JOIN test_attempts ta ON aa.attempt_id = ta.id
      LEFT JOIN test_contents tc ON aa.content_id = tc.id
      WHERE ta.user_id = ? AND aa.is_correct IS NOT NULL
      ORDER BY aa.submitted_at DESC
      LIMIT 10
    `).bind(userId).all();

    const rows = (recent.results || []) as any[];
    const sectionMissCount: Record<string, number> = {};
    for (const r of rows) {
      if (r.is_correct === 0) {
        // Parse question stub defensively — content may be JSON or plain text or null.
        let stub = '';
        try {
          if (r.content_json) {
            const qd = typeof r.content_json === 'string' ? JSON.parse(r.content_json) : r.content_json;
            stub = String(qd?.question || qd?.stem || qd?.passage || qd?.text || '').substring(0, 60);
          }
        } catch {
          stub = String(r.content_json || '').substring(0, 60);
        }
        if (ctx.recent_mistakes.length < 5) {
          ctx.recent_mistakes.push({
            section: r.section || 'unknown',
            question_stub: stub.trim() || '(tanpa preview)',
            submitted_at: r.submitted_at,
          });
        }
        sectionMissCount[r.section] = (sectionMissCount[r.section] || 0) + 1;
      }
    }
    // Repeated-mistake section: missed 3+ times in last 10 answers.
    for (const [section, n] of Object.entries(sectionMissCount)) {
      if (n >= 3) { ctx.repeated_mistake_section = section; break; }
    }
  } catch (e) {
    console.error('student-context recent-mistakes query failed:', e);
  }

  // 4. Mental-model weak concepts.
  try {
    const weak = await env.DB.prepare(`
      SELECT concept, believed_understanding, misconceptions
      FROM student_mental_model
      WHERE user_id = ?
        AND believed_understanding IN ('unknown', 'misconception', 'partial')
      ORDER BY
        CASE believed_understanding
          WHEN 'misconception' THEN 1
          WHEN 'unknown' THEN 2
          WHEN 'partial' THEN 3
          ELSE 4 END ASC,
        updated_at DESC
      LIMIT 3
    `).bind(userId).all();

    for (const row of (weak.results || []) as any[]) {
      let mis: string[] = [];
      try {
        const parsed = JSON.parse(row.misconceptions || '[]');
        if (Array.isArray(parsed)) mis = parsed.slice(0, 2).map(String);
      } catch {}
      ctx.weak_concepts.push({
        concept: row.concept,
        understanding: row.believed_understanding,
        misconceptions: mis.length ? mis : undefined,
      });
    }
  } catch (e) {
    console.error('student-context mental-model query failed:', e);
  }

  return ctx;
}

/**
 * Render a compact student context block for inclusion in AI system prompts.
 * Trimmed to essentials so token cost stays low.
 */
export function formatContextForPrompt(ctx: StudentContext): string {
  const lines: string[] = [];
  lines.push(`SISWA: ${ctx.name} (target: ${ctx.target_test}, level: ${ctx.level})`);
  lines.push(`GAYA BELAJAR: ${ctx.learning_style}, komunikasi: ${ctx.comm_style}, depth: ${ctx.depth_level}`);

  if (ctx.total_answered > 0 && ctx.accuracy_pct !== null) {
    lines.push(`TRACK RECORD: ${ctx.total_answered} soal, akurasi ${ctx.accuracy_pct}%`);
  }

  if (ctx.streak_days > 0) {
    lines.push(`STREAK: ${ctx.streak_days} hari`);
  }

  if (ctx.consecutive_wrong >= 3) {
    lines.push(`⚠️ LAGI STRUGGLE: ${ctx.consecutive_wrong} wrong in a row — extra empathy, reframe as learning`);
  } else if (ctx.consecutive_correct >= 3) {
    lines.push(`🔥 LAGI ON FIRE: ${ctx.consecutive_correct} benar berturut-turut`);
  }

  if (ctx.repeated_mistake_section) {
    lines.push(`POLA: sering salah di "${ctx.repeated_mistake_section}" (3+ kali dari 10 soal terakhir)`);
  }

  if (ctx.recent_mistakes.length > 0) {
    const stubs = ctx.recent_mistakes.slice(0, 3).map(m => `[${m.section}] ${m.question_stub}`).join(' | ');
    lines.push(`SOAL YG BARU DISALAH: ${stubs}`);
  }

  if (ctx.weak_concepts.length > 0) {
    const weak = ctx.weak_concepts.map(w => {
      const mis = w.misconceptions?.length ? ` (misconception: ${w.misconceptions[0]})` : '';
      return `${w.concept}=${w.understanding}${mis}`;
    }).join(', ');
    lines.push(`WEAK CONCEPTS: ${weak}`);
  }

  return lines.join('\n');
}

// ─────────────────────────────────────────────────────────────
// Personalized Feedback Generator
// ─────────────────────────────────────────────────────────────

export interface FeedbackInput {
  question: string;                  // the question text
  student_answer: string;            // what they submitted (letter or text)
  correct_answer: string;            // the correct letter or text
  options?: Record<string, string> | string[]; // answer options if MCQ
  canned_explanation: string;        // the pre-written glossary/explanation
  section: string;                   // reading, listening, vocabulary, grammar, etc.
  topic?: string;                    // finer-grained topic if available
}

/**
 * Generate personalized wrong-answer feedback.
 *
 * Takes the raw inputs plus student context, calls gpt-4o-mini, and
 * returns a 2-4 line Indonesian feedback message that references THIS
 * student's history and the specific mistake — not a generic glossary line.
 *
 * Always returns a usable string: on any AI failure, falls back to the
 * canned format so the user still sees the correct answer and explanation.
 */
export async function generatePersonalizedWrongAnswerFeedback(
  env: Env,
  userId: number,
  input: FeedbackInput,
): Promise<string> {
  const cannedFallback = `Belum tepat. Jawaban: ${input.correct_answer.toUpperCase()}\n${input.canned_explanation || ''}`.trim();

  // Skip AI call if no API key configured.
  if (!env.OPENAI_API_KEY) return cannedFallback;

  let ctx: StudentContext;
  try {
    ctx = await getStudentContext(env, userId);
  } catch {
    return cannedFallback;
  }

  // Build options string for the prompt so AI can reference the distractor.
  let optionsStr = '';
  if (input.options) {
    if (Array.isArray(input.options)) {
      const labels = ['A', 'B', 'C', 'D', 'E', 'F'];
      optionsStr = input.options.map((v, i) => `${labels[i]}) ${v}`).join(' | ');
    } else {
      optionsStr = Object.entries(input.options).map(([k, v]) => `${k.toUpperCase()}) ${v}`).join(' | ');
    }
  }

  const contextBlock = formatContextForPrompt(ctx);
  const cleanQuestion = String(input.question).substring(0, 400);
  const cleanExplanation = String(input.canned_explanation).substring(0, 300);

  const systemPrompt = `PERAN: Kamu Edu, tutor Bahasa Inggris yang hangat dan personal.
Kamu BUKAN tutor generic — kamu sudah kenal siswa ini. Ketika mereka salah, berikan feedback yang:
1. Spesifik ke kesalahan mereka — bukan glossary umum.
2. Referensi data siswa kalau relevan (pola kesalahan, streak, akurasi keseluruhan).
3. Hangat dan singkat (MAKSIMAL 4 baris).
4. Bahasa Indonesia santai (boleh campur istilah English yg natural), sesuaikan dengan gaya komunikasi siswa.
5. Jangan pakai heading/bold/markdown. Plain text.
6. Jangan menggurui. Kalau mereka sudah 3+ salah berturut-turut, TURUNKAN TENSI — validasi dulu, baru jelasin.
7. WAJIB awali dengan "Belum tepat." supaya konsisten. Setelah itu, kasih jawaban benar + insight personal.
8. JANGAN pura-pura tau hal yang nggak ada di konteks — stick to the data yang diberikan.

KONTEKS SISWA:
${contextBlock}

CONTOH OUTPUT BAGUS:
"Belum tepat — jawabannya B (make). 'Make a decision' itu collocation tetap di English, nggak bisa 'do a decision'. Btw, aku liat 'make vs do' udah kamu salah 2x minggu ini — worth catet ya 📝"

CONTOH OUTPUT JELEK (JANGAN DITIRU):
"Belum tepat. Jawaban: B. Make = membuat." ← terlalu robotik, nggak ada sentuhan personal
"Kamu harus belajar lebih giat lagi!" ← menggurui`;

  const userPrompt = `SOAL (${input.section}${input.topic ? ' / ' + input.topic : ''}):
${cleanQuestion}
${optionsStr ? `OPSI: ${optionsStr}` : ''}

JAWABAN SISWA: ${input.student_answer}
JAWABAN BENAR: ${input.correct_answer}
PENJELASAN KANONIK (untuk referensi): ${cleanExplanation}

Tulis feedback personal sekarang. Maksimal 4 baris.`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000); // 8s budget

    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${env.OPENAI_API_KEY}`,
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        max_tokens: 180,
        temperature: 0.65,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
      }),
    });

    clearTimeout(timeout);
    const data: any = await res.json();
    let reply = String(data?.choices?.[0]?.message?.content || '').trim();
    if (!reply) return cannedFallback;

    // Defensive: strip stray markdown that might sneak in.
    reply = reply.replace(/\*\*/g, '').replace(/^#+\s*/gm, '').trim();

    // Safety: ensure the response starts with "Belum tepat" — some models drift.
    if (!/^belum tepat/i.test(reply)) {
      reply = `Belum tepat. Jawaban: ${input.correct_answer.toUpperCase()}. ${reply}`;
    }

    // Log cost (best-effort).
    try {
      const tokens = Math.ceil((userPrompt.length + systemPrompt.length + reply.length) / 4);
      await env.DB.prepare(
        'INSERT INTO api_usage (service, endpoint, tokens_used, cost_usd, user_id) VALUES (?, ?, ?, ?, ?)'
      ).bind('openai', 'personalized-feedback', tokens, tokens * 0.00000015, userId).run();
    } catch {}

    return reply;
  } catch (e) {
    console.error('personalized feedback failed, using canned fallback:', e);
    return cannedFallback;
  }
}
