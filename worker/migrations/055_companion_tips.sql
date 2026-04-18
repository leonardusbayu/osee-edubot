-- 055 — Companion feature-discovery nudges.
--
-- Students learn 2-3 commands during onboarding and miss the other 20.
-- This system surfaces 1 unused feature per day via the companion voice,
-- tied to what the student has actually done (event-driven, not calendar).
--
-- Design:
--   - Each tip has required_events (must have done) + blocker_events (skip
--     if already done) so we only nudge about genuinely-undiscovered features.
--   - Hard cap: 1 tip per user per day, enforced via companion_tips_shown.
--   - cooldown_days per tip prevents re-nagging the same suggestion.
--   - Click tracking lets us down-weight ignored tips later.
--   - Tips render in companion voice — warm + specific, never generic.

CREATE TABLE IF NOT EXISTS companion_tips (
  id TEXT PRIMARY KEY,                     -- 'try_review_after_study'
  feature TEXT NOT NULL,                   -- '/review', '/speak', etc.
  priority INTEGER DEFAULT 5,              -- 1 = highest, shown first
  required_events TEXT,                    -- JSON array; all must be true
  blocker_events TEXT,                     -- JSON array; any true = skip
  min_days_since_signup INTEGER DEFAULT 0, -- protect brand-new users
  message TEXT NOT NULL,                   -- companion-voice nudge copy
  cta_command TEXT,                        -- '/review' — optional deep link
  cooldown_days INTEGER DEFAULT 7,         -- don't re-show within N days
  active INTEGER DEFAULT 1                 -- kill-switch per tip
);

CREATE TABLE IF NOT EXISTS companion_tips_shown (
  user_id INTEGER NOT NULL,
  tip_id TEXT NOT NULL,
  shown_at TEXT DEFAULT (datetime('now')),
  clicked INTEGER DEFAULT 0,
  PRIMARY KEY (user_id, tip_id, shown_at),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_tips_shown_user_date
  ON companion_tips_shown(user_id, shown_at);

-- ─── Seed tips ──────────────────────────────────────────────────────────
-- Event vocabulary (computed at dispatch time, see companion-nudge.ts):
--   studied_once, reviewed_once, used_speak, used_pronounce, used_lesson,
--   used_challenge, used_diagnostic, used_today, has_lesson_plan,
--   opened_today_today, streak_3, streak_7, week_old, month_old,
--   free_user, quota_used_high, referred_someone, answered_correctly_100

INSERT OR REPLACE INTO companion_tips VALUES
-- Early-stage: fresh from onboarding, guide toward first-study habit
('try_diagnostic_first', '/diagnostic', 1,
 '[]', '["used_diagnostic"]', 0,
 'Psst — sebelum mulai latihan, coba /diagnostic dulu (20 soal, 15 menit). Biar aku tahu persis skill kamu di titik mana, baru bisa kasih lesson yang pas 🎯',
 '/diagnostic', 3, 1),

('try_today_after_diagnostic', '/today', 2,
 '["used_diagnostic"]', '["used_today"]', 0,
 'Diagnostic kamu udah kelar — sekarang /today ya! Aku udah bikinin pelajaran hari ini, khusus buat kamu 📅',
 '/today', 3, 1),

-- Core habit: review + spaced repetition
('try_review_after_study', '/review', 2,
 '["studied_once"]', '["reviewed_once"]', 1,
 'Besok coba /review ya — soal-soal yang tadi kamu salah bakal aku kumpulin di sana. 5 menit aja, tapi ngaruh banget ke daya ingat 🔁',
 '/review', 7, 1),

('review_due_reminder', '/review', 2,
 '["reviewed_once", "streak_3"]', '[]', 4,
 'Ada soal-soal yang waktunya di-review hari ini. /review bentar yuk — kalau skip, besok numpuk 📚',
 '/review', 3, 1),

-- Speaking discovery (highest-value premium feature)
('try_voice_message', 'voice', 3,
 '["studied_once"]', '["used_speak"]', 1,
 'Eh, kamu udah nyoba kirim *voice message* ke aku belum? Aku bisa jadi tutor speaking 24/7 — kirim aja rekaman kamu bahas topik apapun, langsung dapet feedback 🎤',
 NULL, 7, 1),

('try_speak_command', '/speak', 3,
 '["week_old"]', '["used_speak"]', 7,
 'Speaking practice pakai /speak — aku bacakan soal, kamu jawab pakai voice, langsung dapet skor Whisper + AI. Coba deh, 2 menit aja 🗣',
 '/speak', 14, 1),

('try_pronounce', '/pronounce', 4,
 '["month_old"]', '["used_pronounce"]', 30,
 'Mau polishing pronunciation? /pronounce — 254 kata drill, AI dengerin dan kasih tau mana yang perlu dibenerin. 5 menit sehari udah kerasa bedanya 🔊',
 '/pronounce', 30, 1),

-- Lesson / plan discovery
('try_lesson_plan', '/lesson', 3,
 '["used_diagnostic"]', '["has_lesson_plan"]', 2,
 'AI bisa bikinin *lesson plan personal* — progresif, nyambung sama weak-spot kamu. /lesson sekali, dipakai berhari-hari 📖',
 '/lesson', 14, 1),

('today_waiting', '/today', 1,
 '["has_lesson_plan"]', '["opened_today_today"]', 0,
 'Lesson plan kamu udah nunggu dari pagi 👀 /today bentar aja, 5 menit udah cukup buat hari ini.',
 '/today', 1, 1),

-- Social / gamification
('try_challenge', '/challenge', 5,
 '["streak_3", "week_old"]', '["used_challenge"]', 7,
 'Belajar bareng temen 3x lebih nempel 🎮 /challenge @nama_teman — duel 5 soal, seru + bikin inget.',
 NULL, 14, 1),

-- Commitment / streak reinforcement
('streak_milestone_7', 'streak', 4,
 '["streak_7"]', '[]', 7,
 'Wow, 7 hari streak! 🔥 Kamu udah masuk 10% student yang konsisten. Jaga terus ya — aku catet tiap hari kamu nongol.',
 NULL, 30, 1),

-- Free user funnels
('referral_quota_bonus', '/referral', 6,
 '["free_user", "quota_used_high"]', '["referred_someone"]', 2,
 'Tinggal sedikit kuota hari ini. /referral — ajak 1 teman, kamu dapet +5 soal extra tiap hari ⚡',
 '/referral', 5, 1),

('premium_after_engagement', '/premium', 7,
 '["week_old", "streak_3", "free_user"]', '[]', 7,
 'Kamu konsisten banget 💛 Kalau mau unlock unlimited + AI tutor 24/7 + speaking Whisper, /premium — paket 7 hari cuma 375⭐ (Rp 30rb).',
 '/premium', 14, 1),

-- Customization
('try_mystyle', '/mystyle', 6,
 '["week_old"]', '[]', 7,
 'Aku bisa adapt cara ngajar sesuai gaya kamu — visual, reading, hands-on, dll. /mystyle sekali, beda selamanya 🎨',
 '/mystyle', 60, 1),

-- Profile / self-awareness
('try_profile', '/profile', 5,
 '["week_old"]', '[]', 7,
 '/profile bakal nunjukin peta skill kamu — mana yang udah jago, mana yang masih lemah, misconception apa aja. Transparan banget 📊',
 '/profile', 30, 1);
