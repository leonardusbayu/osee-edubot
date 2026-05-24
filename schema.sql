-- EduBot D1 Schema Export
-- Source: edubot-db (production, uuid d501b671-128e-4a45-9d90-74b22e6691ce)
-- Generated: 2026-04-17
-- Usage: wrangler d1 execute edubot-staging-db --file=schema.sql --remote
-- Note: schema only, NO data (safe to apply to any fresh D1)
-- Remote D1 manages transactions internally; no BEGIN/COMMIT or PRAGMA wrappers.

-- ==================== TABLES (103) ====================
CREATE TABLE analytics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  event TEXT NOT NULL,
  data TEXT DEFAULT '{}',
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE announcements (id INTEGER PRIMARY KEY AUTOINCREMENT, class_id INTEGER REFERENCES classes(id), teacher_id INTEGER NOT NULL REFERENCES users(id), title TEXT NOT NULL, body TEXT NOT NULL, type TEXT DEFAULT 'announcement', due_date TEXT, created_at TEXT DEFAULT (datetime('now')));

CREATE TABLE api_usage (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  service TEXT NOT NULL,
  endpoint TEXT,
  tokens_used INTEGER DEFAULT 0,
  cost_usd REAL DEFAULT 0,
  user_id INTEGER,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE "attempt_answers" (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  attempt_id INTEGER NOT NULL REFERENCES test_attempts(id),
  content_id INTEGER REFERENCES test_contents(id),
  section TEXT NOT NULL,
  question_index INTEGER,
  answer_data TEXT NOT NULL,
  is_correct INTEGER,
  score REAL,
  ai_feedback TEXT,
  media_url TEXT,
  submitted_at TEXT DEFAULT (datetime('now')),
  time_spent_seconds INTEGER DEFAULT 0
);

CREATE TABLE badges (
  id TEXT PRIMARY KEY,                   -- e.g. 'streak_7', 'vocab_master', 'perfect_score'
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  icon TEXT NOT NULL,                    -- emoji
  category TEXT NOT NULL,                -- 'streak', 'accuracy', 'volume', 'social', 'special'
  requirement_type TEXT NOT NULL,        -- 'streak_days', 'total_xp', 'correct_count', 'perfect_score', 'referral_count', 'drill_score'
  requirement_value INTEGER NOT NULL,    -- threshold value
  xp_reward INTEGER DEFAULT 0
);

CREATE TABLE band_score_lookup (id INTEGER PRIMARY KEY AUTOINCREMENT, test_type TEXT NOT NULL, section TEXT NOT NULL, raw_min INTEGER NOT NULL, raw_max INTEGER NOT NULL, band REAL NOT NULL, UNIQUE(test_type, section, raw_min));

CREATE TABLE battle_pass (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, season TEXT NOT NULL, tier TEXT NOT NULL DEFAULT 'free', current_level INTEGER DEFAULT 0, xp_this_season INTEGER DEFAULT 0, purchased_at TEXT, created_at TEXT DEFAULT (datetime('now')), FOREIGN KEY (user_id) REFERENCES users(id), UNIQUE(user_id, season));

CREATE TABLE battle_pass_rewards (id INTEGER PRIMARY KEY AUTOINCREMENT, season TEXT NOT NULL, level INTEGER NOT NULL, tier TEXT NOT NULL DEFAULT 'free', reward_type TEXT NOT NULL, reward_value TEXT NOT NULL, description TEXT NOT NULL, UNIQUE(season, level, tier));

CREATE TABLE certificates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  cert_type TEXT NOT NULL,
  test_type TEXT,
  score REAL,
  band REAL,
  cert_data TEXT,
  created_at TEXT DEFAULT (datetime('now'))
, hash_id TEXT, target_score REAL, status TEXT DEFAULT 'active', issued_at TEXT DEFAULT (datetime('now')));

CREATE TABLE challenges (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  class_id INTEGER,
  challenger_id INTEGER NOT NULL,
  opponent_id INTEGER NOT NULL,
  section TEXT DEFAULT 'grammar',
  questions TEXT NOT NULL,
  challenger_score INTEGER DEFAULT 0,
  opponent_score INTEGER DEFAULT 0,
  status TEXT DEFAULT 'pending',
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE channel_analytics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_type TEXT NOT NULL, -- 'post', 'click', 'signup'
  post_type TEXT,
  user_id INTEGER,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE channel_hourly_stats (id INTEGER PRIMARY KEY AUTOINCREMENT, hour_bucket TEXT NOT NULL, content_type TEXT NOT NULL, posts_sent INTEGER DEFAULT 0, posts_failed INTEGER DEFAULT 0, UNIQUE(hour_bucket, content_type));

CREATE TABLE channel_posts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  post_type TEXT NOT NULL, -- 'vocab', 'quiz', 'grammar', 'idiom', 'spotlight', 'promo'
  post_content TEXT,
  message_id INTEGER,
  posted_at TEXT DEFAULT (datetime('now'))
, content_preview TEXT, sent_to_channel TEXT, status TEXT DEFAULT 'sent', error_message TEXT);

CREATE TABLE channel_referrals (id INTEGER PRIMARY KEY AUTOINCREMENT, referred_at TEXT DEFAULT (datetime('now')), new_user_id INTEGER, referrer_code TEXT, source_channel TEXT, signup_context TEXT, conversion_post_id INTEGER);

CREATE TABLE class_enrollments (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL REFERENCES users(id), class_id INTEGER NOT NULL REFERENCES classes(id), enrolled_at TEXT DEFAULT (datetime('now')), status TEXT DEFAULT 'active', UNIQUE(user_id, class_id));

CREATE TABLE class_leaderboard (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  class_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  week TEXT NOT NULL,
  questions_answered INTEGER DEFAULT 0,
  correct_answers INTEGER DEFAULT 0,
  bonus_points INTEGER DEFAULT 0,
  UNIQUE(class_id, user_id, week)
);

CREATE TABLE classes (id INTEGER PRIMARY KEY AUTOINCREMENT, teacher_id INTEGER NOT NULL REFERENCES users(id), name TEXT NOT NULL, description TEXT, test_type TEXT NOT NULL, invite_code TEXT UNIQUE, is_active INTEGER DEFAULT 1, created_at TEXT DEFAULT (datetime('now')), group_chat_id TEXT);

CREATE TABLE coin_log (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, amount INTEGER NOT NULL, source TEXT NOT NULL, detail TEXT, created_at TEXT DEFAULT (datetime('now')), FOREIGN KEY (user_id) REFERENCES users(id));

CREATE TABLE coin_shop (id TEXT PRIMARY KEY, name TEXT NOT NULL, description TEXT NOT NULL, price INTEGER NOT NULL, icon TEXT NOT NULL, effect_type TEXT NOT NULL, effect_value TEXT NOT NULL, active INTEGER DEFAULT 1);

CREATE TABLE companion_conversations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  status TEXT NOT NULL DEFAULT 'active',       -- active, bridged, ended, expired
  tier INTEGER NOT NULL DEFAULT 1,             -- 1=gentle nudge, 2=check-in, 3=win-back
  turn_count INTEGER NOT NULL DEFAULT 0,       -- number of back-and-forth exchanges
  sentiment TEXT DEFAULT NULL,                  -- last detected sentiment: positive, neutral, negative, distressed
  bridge_attempted INTEGER NOT NULL DEFAULT 0,  -- whether bot tried to redirect to study
  bridge_accepted INTEGER DEFAULT NULL,         -- whether student accepted the redirect (1/0/null)
  initiated_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_message_at TEXT NOT NULL DEFAULT (datetime('now')),
  ended_at TEXT DEFAULT NULL,
  summary TEXT DEFAULT NULL                     -- brief AI summary of the conversation for context
);

CREATE TABLE companion_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  conversation_id INTEGER NOT NULL REFERENCES companion_conversations(id),
  role TEXT NOT NULL,           -- 'bot' or 'user'
  content TEXT NOT NULL,
  sentiment TEXT DEFAULT NULL,  -- detected sentiment for user messages
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE content_ai_score_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  started_at TEXT DEFAULT (datetime('now')),
  finished_at TEXT,
  sample_size INTEGER,
  scored_count INTEGER DEFAULT 0,
  failed_count INTEGER DEFAULT 0,
  avg_overall REAL,
  fail_count INTEGER DEFAULT 0,     -- verdict = 'fail'
  concern_count INTEGER DEFAULT 0,  -- verdict = 'concern'
  total_cost_usd REAL,
  notes TEXT
);

CREATE TABLE content_ai_scores (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  content_id INTEGER NOT NULL,
  run_id INTEGER NOT NULL,
  section TEXT,
  question_type TEXT,
  -- Rubric scores (1-5)
  clarity_score INTEGER,
  answer_correctness INTEGER,
  option_quality INTEGER,
  passage_alignment INTEGER,
  overall_score INTEGER,
  -- Verdict + notes
  verdict TEXT,              -- 'pass' | 'concern' | 'fail'
  issues TEXT,               -- JSON array of issue strings
  ai_notes TEXT,             -- short natural-language summary
  cost_usd REAL,             -- estimated
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (content_id) REFERENCES test_contents(id)
);

CREATE TABLE content_anomalies (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  content_id INTEGER NOT NULL,
  flag_type TEXT NOT NULL,         -- 'low_accuracy' | 'high_skip' | 'too_fast' | 'too_slow'
  severity TEXT NOT NULL DEFAULT 'medium',  -- 'low' | 'medium' | 'high'
  section TEXT,
  question_type TEXT,
  -- Metrics snapshot at detection time
  total_attempts INTEGER NOT NULL,
  correct_count INTEGER NOT NULL,
  accuracy_rate REAL,              -- correct / graded (0..1)
  skip_count INTEGER NOT NULL DEFAULT 0,
  skip_rate REAL,                  -- skip / total (0..1)
  avg_time_seconds REAL,
  -- Lifecycle
  status TEXT NOT NULL DEFAULT 'open',  -- 'open' | 'acknowledged' | 'resolved' | 'false_positive'
  notes TEXT,
  detected_at TEXT DEFAULT (datetime('now')),
  resolved_at TEXT,
  resolved_by INTEGER,
  FOREIGN KEY (content_id) REFERENCES test_contents(id)
);

CREATE TABLE content_audit_findings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  content_id INTEGER NOT NULL,
  issue_code TEXT NOT NULL,        -- 'empty_option' | 'ultra_short_option' | 'dup_options' | 'missing_media' | 'missing_answer' | etc
  severity TEXT NOT NULL DEFAULT 'medium',  -- 'low' | 'medium' | 'high'
  section TEXT,
  question_type TEXT,
  message TEXT,                    -- human-readable description
  run_id INTEGER NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (content_id) REFERENCES test_contents(id)
);

CREATE TABLE content_audit_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  started_at TEXT DEFAULT (datetime('now')),
  finished_at TEXT,
  scanned_count INTEGER NOT NULL DEFAULT 0,
  error_count INTEGER NOT NULL DEFAULT 0,     -- rows with validator errors
  warning_count INTEGER NOT NULL DEFAULT 0,   -- rows with only warnings
  healthy_count INTEGER NOT NULL DEFAULT 0,
  -- JSON breakdown by issue_code: { "empty_option": 12, "dup_options": 3, ... }
  breakdown TEXT,
  -- Optional notes (e.g. "triggered by admin @leo")
  notes TEXT
);

CREATE TABLE content_reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  content_id INTEGER NOT NULL,          -- test_contents.id
  sub_index INTEGER,                    -- null for flat; 0..N for grouped sub-question
  user_id INTEGER,                      -- users.id (null allowed if anonymous/edge-case)
  reason_code TEXT NOT NULL,            -- 'wrong_answer' | 'broken_audio' | 'confusing_question' | 'broken_options' | 'typo' | 'other'
  free_text TEXT,                       -- optional user note
  section TEXT,                         -- denormalized for fast filtering
  question_type TEXT,                   -- denormalized for fast filtering
  attempt_id INTEGER,                   -- optional link to the test_attempts row
  status TEXT NOT NULL DEFAULT 'open',  -- 'open' | 'triaged' | 'fixed' | 'invalid'
  resolved_by INTEGER,                  -- admin user who closed it
  resolved_at TEXT,
  resolution_note TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (content_id) REFERENCES test_contents(id),
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (resolved_by) REFERENCES users(id)
);

CREATE TABLE conversation_analytics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    topic TEXT NOT NULL,
    message_count INTEGER DEFAULT 0,
    confusion_signals INTEGER DEFAULT 0,
    last_updated TEXT DEFAULT (datetime('now')),
    UNIQUE(user_id, topic)
);

CREATE TABLE conversation_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  context_type TEXT DEFAULT 'tutoring',
  created_at TEXT DEFAULT (datetime('now'))
, topic TEXT DEFAULT 'other', metadata TEXT DEFAULT '{}');

CREATE TABLE conversations (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL REFERENCES users(id), role TEXT NOT NULL, content TEXT NOT NULL, context_type TEXT DEFAULT 'tutoring', created_at TEXT DEFAULT (datetime('now')));

CREATE TABLE daily_question_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  question_date TEXT NOT NULL, -- YYYY-MM-DD format
  questions_answered INTEGER DEFAULT 0,
  bonus_used INTEGER DEFAULT 0, -- bonus questions consumed today
  UNIQUE(user_id, question_date)
);

CREATE TABLE daily_quests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  quest_date TEXT NOT NULL,              -- YYYY-MM-DD (WIB)
  quest_type TEXT NOT NULL,              -- 'answer_questions', 'speaking_drill', 'review_cards', 'speed_drill', 'writing_task'
  target_count INTEGER NOT NULL,         -- e.g. 5, 10
  current_count INTEGER DEFAULT 0,
  xp_reward INTEGER DEFAULT 50,
  completed INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE daily_quiz (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  class_id INTEGER NOT NULL,
  question_text TEXT NOT NULL,
  correct_answer TEXT NOT NULL,
  options TEXT DEFAULT '[]',
  posted_at TEXT,
  first_correct_user_id INTEGER,
  answered_count INTEGER DEFAULT 0,
  active INTEGER DEFAULT 1
);

CREATE TABLE "daily_study_logs" (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  log_date TEXT NOT NULL,
  questions_answered INTEGER DEFAULT 0,
  time_spent_seconds INTEGER DEFAULT 0,
  messages_sent INTEGER DEFAULT 0,
  sessions_count INTEGER DEFAULT 0,
  tests_completed INTEGER DEFAULT 0,
  correct_answers INTEGER DEFAULT 0,
  accuracy_percent INTEGER DEFAULT 0,
  top_section TEXT,
  weakest_section TEXT,
  updated_at TEXT DEFAULT (datetime('now')),
  UNIQUE(user_id, log_date)
);

CREATE TABLE daily_upgrade_nudges (
           user_id INTEGER NOT NULL,
           wib_date TEXT NOT NULL,
           nudged_at TEXT NOT NULL,
           PRIMARY KEY (user_id, wib_date)
         );

CREATE TABLE diagnostic_results (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  grammar_score INTEGER DEFAULT 0,
  grammar_total INTEGER DEFAULT 0,
  vocab_score INTEGER DEFAULT 0,
  vocab_total INTEGER DEFAULT 0,
  reading_score INTEGER DEFAULT 0,
  reading_total INTEGER DEFAULT 0,
  listening_score INTEGER DEFAULT 0,
  listening_total INTEGER DEFAULT 0,
  writing_band REAL,
  weaknesses TEXT DEFAULT '[]',
  estimated_band REAL,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE diagnostic_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  current_question INTEGER DEFAULT 0,
  answers TEXT DEFAULT '[]',
  status TEXT DEFAULT 'in_progress',
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE emotional_message_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  message_type TEXT NOT NULL,
  context TEXT DEFAULT NULL,  -- e.g. milestone number, section name, attempt_id
  sent_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE error_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source TEXT NOT NULL DEFAULT 'server',  -- 'client', 'server', 'bot'
  error_type TEXT,                         -- 'render', 'api', 'network', 'mic_permission', etc.
  message TEXT NOT NULL,
  stack TEXT,
  user_id INTEGER,
  url TEXT,                                -- Page URL or API endpoint
  metadata TEXT,                           -- JSON with extra context
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE error_spike_alerts (
         window_hour TEXT NOT NULL,
         source TEXT NOT NULL,
         alerted_at TEXT NOT NULL,
         PRIMARY KEY (window_hour, source)
       );

CREATE TABLE exercise_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  type TEXT NOT NULL,
  status TEXT DEFAULT 'active',
  prompt TEXT,
  expected_answer TEXT,
  metadata TEXT,
  score REAL,
  feedback TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  completed_at TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE forgetting_curve (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  skill TEXT NOT NULL,
  memory_strength REAL NOT NULL DEFAULT 1.0,
  last_review_at TEXT NOT NULL,
  estimated_retention REAL NOT NULL DEFAULT 1.0,
  review_count INTEGER DEFAULT 1,
  avg_recall_rate REAL DEFAULT 1.0,
  updated_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id),
  UNIQUE(user_id, skill)
);

CREATE TABLE friend_quest_members (id INTEGER PRIMARY KEY AUTOINCREMENT, quest_id INTEGER NOT NULL, user_id INTEGER NOT NULL, current_value INTEGER DEFAULT 0, completed INTEGER DEFAULT 0, joined_at TEXT DEFAULT (datetime('now')), FOREIGN KEY (quest_id) REFERENCES friend_quests(id), FOREIGN KEY (user_id) REFERENCES users(id), UNIQUE(quest_id, user_id));

CREATE TABLE friend_quests (id INTEGER PRIMARY KEY AUTOINCREMENT, creator_id INTEGER NOT NULL, quest_type TEXT NOT NULL, target_value INTEGER NOT NULL, deadline TEXT NOT NULL, status TEXT DEFAULT 'active', reward_coins INTEGER DEFAULT 100, created_at TEXT DEFAULT (datetime('now')), FOREIGN KEY (creator_id) REFERENCES users(id));

CREATE TABLE game_scores (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  game_type TEXT NOT NULL,               -- 'speed_drill', 'wordle', 'gap_fill'
  score INTEGER NOT NULL,
  time_seconds REAL,                     -- how long the round took
  correct_count INTEGER DEFAULT 0,
  total_count INTEGER DEFAULT 0,
  streak_bonus INTEGER DEFAULT 0,        -- consecutive correct answers bonus
  metadata TEXT,                         -- JSON: word list, difficulty, etc.
  xp_earned INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE irt_item_params (
  content_id INTEGER PRIMARY KEY,
  difficulty REAL NOT NULL DEFAULT 0.0,
  discrimination REAL NOT NULL DEFAULT 1.0,
  guessing REAL NOT NULL DEFAULT 0.25,
  total_responses INTEGER DEFAULT 0,
  total_correct INTEGER DEFAULT 0,
  last_calibrated_at TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE irt_student_ability (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  skill TEXT NOT NULL,
  theta REAL NOT NULL DEFAULT 0.0,
  standard_error REAL NOT NULL DEFAULT 1.0,
  responses_count INTEGER DEFAULT 0,
  last_updated_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id),
  UNIQUE(user_id, skill)
);

CREATE TABLE league_history (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, week_start TEXT NOT NULL, week_end TEXT NOT NULL, league TEXT NOT NULL, weekly_xp INTEGER DEFAULT 0, rank_in_league INTEGER, action TEXT, created_at TEXT DEFAULT (datetime('now')), FOREIGN KEY (user_id) REFERENCES users(id));

CREATE TABLE learning_curve_models (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  skill TEXT NOT NULL,
  a_max REAL NOT NULL DEFAULT 0.9,
  a_init REAL NOT NULL DEFAULT 0.2,
  rate REAL NOT NULL DEFAULT 0.3,
  r_squared REAL,
  data_points INTEGER DEFAULT 0,
  predicted_accuracy_2w REAL,
  predicted_ibt_section REAL,
  last_fitted_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id),
  UNIQUE(user_id, skill)
);

CREATE TABLE learning_curve_points (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  skill TEXT NOT NULL,
  practice_index INTEGER NOT NULL,
  accuracy REAL NOT NULL,
  cumulative_accuracy REAL NOT NULL,
  session_size INTEGER NOT NULL,
  recorded_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE lesson_cq_active (
  user_id INTEGER PRIMARY KEY,
  plan_id INTEGER,
  step_index INTEGER,
  concept TEXT,                     -- the skill being taught (e.g. 'present_perfect')
  question TEXT NOT NULL,           -- the CQ stem
  options TEXT NOT NULL,            -- JSON array of strings: ['A text', 'B text', ...]
  correct_letter TEXT NOT NULL,     -- 'A' | 'B' | 'C' | 'D'
  strategy_used TEXT,               -- NULL on first try; 'analogy' | 'simpler' | 'example' | 'visual' on reteach
  attempts INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE lesson_cq_attempts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  plan_id INTEGER,
  step_index INTEGER,
  concept TEXT,
  question TEXT,
  correct_letter TEXT,
  student_letter TEXT,
  was_correct INTEGER NOT NULL,     -- 0/1
  strategy_used TEXT,               -- which reteach strategy was in play (null = first try)
  attempt_num INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE lesson_plans (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  plan_type TEXT DEFAULT 'personalized',
  target_skills TEXT DEFAULT '[]',
  lessons TEXT DEFAULT '[]',
  current_step INTEGER DEFAULT 0,
  total_steps INTEGER DEFAULT 0,
  status TEXT DEFAULT 'active',
  difficulty_level INTEGER DEFAULT 3,
  estimated_minutes INTEGER DEFAULT 30,
  progress_percent INTEGER DEFAULT 0,
  generated_by TEXT DEFAULT 'ai',
  class_id INTEGER DEFAULT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  completed_at TEXT DEFAULT NULL
);

CREATE TABLE lesson_step_results (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  lesson_plan_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  step_index INTEGER NOT NULL,
  step_type TEXT NOT NULL,
  score REAL DEFAULT NULL,
  time_spent_sec INTEGER DEFAULT 0,
  response_data TEXT DEFAULT NULL,
  feedback TEXT DEFAULT NULL,
  completed_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (lesson_plan_id) REFERENCES lesson_plans(id)
);

CREATE TABLE payment_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  amount INTEGER NOT NULL,
  currency TEXT DEFAULT 'IDR',
  method TEXT NOT NULL, -- 'stars', 'gopay', 'bank_transfer', 'referral'
  stars_amount INTEGER, -- if paid with stars
  days_granted INTEGER NOT NULL,
  status TEXT DEFAULT 'completed',
  payment_id TEXT, -- external payment reference
  notes TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE payment_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  amount INTEGER NOT NULL,
  days INTEGER NOT NULL,
  method TEXT DEFAULT 'gopay', -- 'gopay', 'bank_transfer', 'other'
  status TEXT DEFAULT 'pending', -- 'pending', 'paid', 'cancelled', 'expired'
  payment_proof TEXT, -- optional: screenshot or reference
  notes TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  expires_at TEXT,
  confirmed_at TEXT,
  confirmed_by INTEGER,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE peer_reviews (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  class_id INTEGER,
  writer_id INTEGER NOT NULL,
  reviewer_id INTEGER,
  essay_text TEXT NOT NULL,
  review_text TEXT,
  ai_validation TEXT,
  status TEXT DEFAULT 'pending',
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE post_test_reviews (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  attempt_id INTEGER NOT NULL,
  concepts_to_review TEXT NOT NULL,        -- JSON array: ['inference', 'main_idea']
  current_index INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active',   -- active | completed | skipped
  wrong_count INTEGER NOT NULL DEFAULT 0,  -- diagnostic: how many wrongs in the attempt
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (attempt_id) REFERENCES test_attempts(id)
);

CREATE TABLE premium_expiry_notifications (
         user_id INTEGER PRIMARY KEY,
         notified_at TEXT NOT NULL,
         notified_for_expiry TEXT NOT NULL
       );

CREATE TABLE pronunciation_bank (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  word TEXT NOT NULL,
  ipa TEXT,
  category TEXT NOT NULL,
  subcategory TEXT,
  difficulty TEXT DEFAULT 'intermediate',
  test_type TEXT DEFAULT 'ALL',
  part_of_speech TEXT,
  example_sentence TEXT,
  common_mistake TEXT,
  tip TEXT,
  audio_cached INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE psych_profile (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  consistency_score REAL DEFAULT 0,
  persistence_score REAL DEFAULT 0,
  risk_tolerance REAL DEFAULT 0.5,
  processing_speed REAL DEFAULT 0,
  accuracy_under_pressure REAL DEFAULT 0,
  error_recovery_rate REAL DEFAULT 0,
  reading_preference REAL DEFAULT 0.5,
  detail_orientation REAL DEFAULT 0.5,
  stamina_index REAL DEFAULT 0.5,
  updated_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id),
  UNIQUE(user_id)
);

CREATE TABLE question_exposure (
  user_id INTEGER NOT NULL,              -- users.id
  content_id INTEGER NOT NULL,           -- test_contents.id
  first_seen_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_seen_at TEXT NOT NULL DEFAULT (datetime('now')),
  exposure_count INTEGER NOT NULL DEFAULT 1,
  source TEXT,                           -- 'test' | 'diagnostic' | 'lesson' | 'companion' | 'drill' | 'game'
  PRIMARY KEY (user_id, content_id),
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (content_id) REFERENCES test_contents(id)
);

CREATE TABLE referral_bonus_quota (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL UNIQUE,
  bonus_questions INTEGER DEFAULT 0, -- total accumulated bonus questions
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE referral_rewards (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  referrer_id INTEGER NOT NULL,
  referee_id INTEGER NOT NULL,
  reward_type TEXT, -- 'trial_extension', 'free_days', 'free_months'
  reward_days INTEGER DEFAULT 0,
  status TEXT DEFAULT 'pending', -- 'pending', 'applied', 'expired'
  created_at TEXT DEFAULT (datetime('now')),
  applied_at TEXT,
  FOREIGN KEY (referrer_id) REFERENCES users(id),
  FOREIGN KEY (referee_id) REFERENCES users(id)
);

CREATE TABLE review_sessions (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, current_review_id INTEGER NOT NULL, created_at TEXT DEFAULT (datetime('now')), UNIQUE(user_id));

CREATE TABLE skill_progress (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL,
  skill TEXT NOT NULL,
  test_type TEXT DEFAULT 'TOEFL_IBT',
  practiced_at TEXT NOT NULL DEFAULT (datetime('now')),
  questions_attempted INTEGER DEFAULT 0,
  correct_answers INTEGER DEFAULT 0,
  accuracy_percent INTEGER DEFAULT 0,
  time_spent_seconds INTEGER DEFAULT 0
);

CREATE TABLE skill_tracker (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL REFERENCES users(id), test_type TEXT NOT NULL, skill TEXT NOT NULL, proficiency_score REAL DEFAULT 1200, attempts_count INTEGER DEFAULT 0, last_updated TEXT DEFAULT (datetime('now')), UNIQUE(user_id, test_type, skill));

CREATE TABLE skill_trackers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  test_type TEXT NOT NULL,
  skill TEXT NOT NULL,
  proficiency_score REAL DEFAULT 1500.0,
  total_attempts INTEGER DEFAULT 0,
  correct_count INTEGER DEFAULT 0,
  last_updated TEXT DEFAULT (datetime('now'))
);

CREATE TABLE skill_weakness_summary (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL UNIQUE,
    -- Diagnostic scores (from diagnostic_results)
    grammar_score INTEGER,
    vocab_score INTEGER,
    reading_score INTEGER,
    listening_score INTEGER,
    writing_band REAL,
    estimated_band REAL,
    -- Practice accuracy (from attempt_answers)
    listening_accuracy REAL,
    reading_accuracy REAL,
    speaking_accuracy REAL,
    writing_accuracy REAL,
    total_practice_questions INTEGER,
    -- Chat analysis (from conversation_messages)
    top_chat_topics TEXT,  -- JSON array of top 5 topics
    confusion_topics TEXT,  -- JSON array of repeatedly confused topics
    chat_questions_count INTEGER,
    -- AI-generated insights
    ai_insights TEXT,  -- GPT analysis summary
    last_ai_analysis_at TEXT,
    last_updated TEXT DEFAULT (datetime('now'))
);

CREATE TABLE spaced_repetition (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  content_id INTEGER,
  section TEXT NOT NULL,
  question_type TEXT,
  question_data TEXT NOT NULL,
  correct_answer TEXT,
  student_answer TEXT,
  review_level INTEGER DEFAULT 0,
  next_review_at TEXT NOT NULL,
  last_reviewed_at TEXT,
  times_correct INTEGER DEFAULT 0,
  times_wrong INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now'))
, fsrs_state TEXT DEFAULT NULL);

CREATE TABLE speaking_dimension_scores (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  test_type TEXT NOT NULL,
  -- IELTS official 4 criteria
  fluency_coherence REAL,           -- Fluency & Coherence (IELTS) / Delivery (TOEFL)
  lexical_resource REAL,            -- Lexical Resource (IELTS) / Vocabulary (TOEFL)
  grammar_range REAL,               -- Grammatical Range & Accuracy
  pronunciation REAL,               -- Pronunciation
  -- Extended metrics
  relevancy_score REAL,             -- 0-1: how on-topic the response was
  word_count INTEGER,               -- total words in transcription
  speaking_rate REAL,               -- words per minute (estimated from duration)
  -- AI feedback per dimension
  fluency_note TEXT,
  lexical_note TEXT,
  grammar_note TEXT,
  pronunciation_note TEXT,
  created_at TEXT DEFAULT (datetime('now')), prosody_wpm INTEGER DEFAULT 0, prosody_pause_ratio REAL DEFAULT 0, prosody_long_pauses INTEGER DEFAULT 0, prosody_fillers INTEGER DEFAULT 0, prosody_repetitions INTEGER DEFAULT 0, prosody_fluency_score INTEGER DEFAULT 0, prosody_rhythm_score INTEGER DEFAULT 0, prosody_overall INTEGER DEFAULT 0, prosody_raw TEXT,
  FOREIGN KEY (session_id) REFERENCES speaking_sessions(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE speaking_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  prompt TEXT NOT NULL,
  test_type TEXT DEFAULT 'TOEFL_IBT',
  topic_type TEXT DEFAULT 'random',
  transcription TEXT,
  score REAL,
  feedback TEXT,
  status TEXT DEFAULT 'active',
  created_at TEXT DEFAULT (datetime('now')),
  completed_at TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE star_transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  amount INTEGER NOT NULL,
  type TEXT NOT NULL, -- 'purchase', 'payment', 'refund', 'reward'
  description TEXT,
  status TEXT DEFAULT 'completed', -- 'pending', 'completed', 'failed'
  created_at TEXT DEFAULT (datetime('now')), payment_id TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE streak_warning_notifications (
         user_id INTEGER NOT NULL,
         wib_date TEXT NOT NULL,
         notified_at TEXT NOT NULL,
         PRIMARY KEY (user_id, wib_date)
       );

CREATE TABLE student_mental_model (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  concept TEXT NOT NULL,
  believed_understanding TEXT DEFAULT 'unknown',
  evidence TEXT DEFAULT '[]',
  misconceptions TEXT DEFAULT '[]',
  last_assessed_at TEXT,
  confidence REAL DEFAULT 0.5,
  times_assessed INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  UNIQUE(user_id, concept)
);

CREATE TABLE student_profiles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL UNIQUE,
  learning_pace TEXT DEFAULT 'normal',
  avg_response_time_sec REAL DEFAULT 0,
  preferred_study_time TEXT DEFAULT NULL,
  avg_session_minutes REAL DEFAULT 0,
  frustration_score REAL DEFAULT 0,
  confidence_score REAL DEFAULT 0.5,
  engagement_level TEXT DEFAULT 'moderate',
  consecutive_correct INTEGER DEFAULT 0,
  consecutive_wrong INTEGER DEFAULT 0,
  longest_correct_streak INTEGER DEFAULT 0,
  grammar_errors TEXT DEFAULT '{}',
  vocab_errors TEXT DEFAULT '{}',
  reading_errors TEXT DEFAULT '{}',
  listening_errors TEXT DEFAULT '{}',
  skill_mastery TEXT DEFAULT '{}',
  current_topic TEXT DEFAULT NULL,
  current_lesson_step INTEGER DEFAULT 0,
  tutor_mode TEXT DEFAULT 'lesson',
  socratic_depth INTEGER DEFAULT 0,
  exercises_in_current_topic INTEGER DEFAULT 0,
  correct_in_current_topic INTEGER DEFAULT 0,
  topics_completed TEXT DEFAULT '[]',
  topics_in_progress TEXT DEFAULT '[]',
  total_tutor_sessions INTEGER DEFAULT 0,
  total_tutor_messages INTEGER DEFAULT 0,
  last_tutor_topic TEXT DEFAULT NULL,
  last_interaction_at TEXT DEFAULT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
, learning_style TEXT DEFAULT 'balanced', communication_style TEXT DEFAULT 'socratic', depth_level TEXT DEFAULT 'intermediate', target_band_score REAL DEFAULT NULL, study_goal TEXT DEFAULT NULL, daily_study_target_min INTEGER DEFAULT 30, preferred_language TEXT DEFAULT 'id', personality_notes TEXT DEFAULT NULL, auto_detected_style TEXT DEFAULT NULL, lesson_paused INTEGER DEFAULT 0, lesson_paused_at TEXT);

CREATE TABLE student_skills (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  skill TEXT NOT NULL,
  score INTEGER DEFAULT 0,
  total_attempts INTEGER DEFAULT 0,
  correct_attempts INTEGER DEFAULT 0,
  last_tested TEXT,
  UNIQUE(user_id, skill)
);

CREATE TABLE student_visual_exposures (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  visual_id INTEGER NOT NULL,
  seen_at TEXT NOT NULL DEFAULT (datetime('now')),
  feedback TEXT,                      -- 'helpful' | 'not_helpful' | NULL
  feedback_at TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (visual_id) REFERENCES visual_explanations(id)
);

CREATE TABLE study_plans (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  target_band REAL DEFAULT 4.0,
  target_date TEXT,
  total_days INTEGER,
  current_day INTEGER DEFAULT 0,
  plan_data TEXT DEFAULT '{}',
  status TEXT DEFAULT 'active',
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE system_slo_alerts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  metric TEXT NOT NULL,                  -- 'error_rate' | 'server_errors' | 'openai_errors' | 'whisper_errors' | 'activity_drop'
  severity TEXT NOT NULL DEFAULT 'medium',
  current_value REAL,
  baseline_value REAL,
  threshold REAL,
  state TEXT NOT NULL DEFAULT 'firing',  -- 'firing' | 'resolved'
  detail TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE system_slo_snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  window_minutes INTEGER NOT NULL,       -- always 60 for hourly, kept for flexibility
  attempt_count INTEGER DEFAULT 0,       -- test attempts finished in window
  answer_count INTEGER DEFAULT 0,        -- attempt_answers written in window
  speaking_count INTEGER DEFAULT 0,      -- speaking_sessions created in window
  server_error_count INTEGER DEFAULT 0,  -- error_logs source='server'
  client_error_count INTEGER DEFAULT 0,  -- error_logs source='client'
  bot_error_count INTEGER DEFAULT 0,     -- error_logs source='bot'
  openai_error_count INTEGER DEFAULT 0,  -- error_logs with error_type LIKE '%openai%' or message LIKE '%openai%'
  whisper_error_count INTEGER DEFAULT 0, -- error_logs with message LIKE '%whisper%'
  total_activity INTEGER DEFAULT 0,      -- attempts + answers + speaking
  error_rate REAL DEFAULT 0,             -- total_errors / total_activity
  snapshot_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE teacher_pricing (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  min_students INTEGER NOT NULL,
  max_students INTEGER NOT NULL,
  price_per_student INTEGER NOT NULL,
  is_active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE teacher_subscriptions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  teacher_id INTEGER NOT NULL,
  status TEXT DEFAULT 'trial', -- 'trial', 'active', 'expired', 'cancelled'
  trial_ends TEXT,
  subscribed_at TEXT,
  expires_at TEXT,
  student_count INTEGER DEFAULT 0,
  monthly_rate INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (teacher_id) REFERENCES users(id)
);

CREATE TABLE team_members (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  team_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  UNIQUE(team_id, user_id)
);

CREATE TABLE teams (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  class_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE test_attempts (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL REFERENCES users(id), test_type TEXT NOT NULL, mode TEXT DEFAULT 'practice', status TEXT DEFAULT 'in_progress', current_section TEXT, section_state TEXT DEFAULT '{}', started_at TEXT DEFAULT (datetime('now')), finished_at TEXT, time_remaining INTEGER, current_question_index INTEGER DEFAULT 0, section_start_times TEXT DEFAULT '{}', metadata TEXT DEFAULT '{}', content_ids TEXT, review_nudge_sent_at TEXT);

CREATE TABLE test_contents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  test_type TEXT NOT NULL,
  section TEXT NOT NULL,
  question_type TEXT NOT NULL,
  title TEXT,
  content TEXT NOT NULL,
  media_url TEXT,
  difficulty INTEGER DEFAULT 3,
  topic TEXT,
  source TEXT DEFAULT 'curated',
  status TEXT DEFAULT 'draft' CHECK(status IN ('draft', 'published', 'archived')),
  created_by INTEGER REFERENCES users(id),
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
, skill_tags TEXT DEFAULT '[]', cefr_level TEXT DEFAULT 'B1', bloom_level TEXT DEFAULT 'understand');

CREATE TABLE test_results (id INTEGER PRIMARY KEY AUTOINCREMENT, attempt_id INTEGER NOT NULL UNIQUE REFERENCES test_attempts(id), user_id INTEGER NOT NULL REFERENCES users(id), test_type TEXT NOT NULL, total_score REAL, section_scores TEXT NOT NULL DEFAULT '{}', band_score REAL, ai_summary TEXT, created_at TEXT DEFAULT (datetime('now')), detailed_feedback TEXT);

CREATE TABLE topic_mastery (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  topic TEXT NOT NULL,
  mastery_level INTEGER DEFAULT 0,
  exercises_attempted INTEGER DEFAULT 0,
  exercises_correct INTEGER DEFAULT 0,
  accuracy_percent REAL DEFAULT 0,
  current_difficulty INTEGER DEFAULT 1,
  highest_difficulty_passed INTEGER DEFAULT 0,
  first_attempted_at TEXT DEFAULT NULL,
  last_attempted_at TEXT DEFAULT NULL,
  last_reviewed_at TEXT DEFAULT NULL,
  next_review_at TEXT DEFAULT NULL,
  status TEXT DEFAULT 'not_started',
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  UNIQUE(user_id, topic)
);

CREATE TABLE tts_cache (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  text_hash TEXT UNIQUE NOT NULL,
  audio_data BLOB,
  voice TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE tutor_interactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  topic TEXT NOT NULL,
  interaction_type TEXT NOT NULL,
  tutor_mode TEXT NOT NULL,
  tutor_message TEXT NOT NULL,
  student_response TEXT DEFAULT NULL,
  was_correct INTEGER DEFAULT NULL,
  error_category TEXT DEFAULT NULL,
  response_time_sec REAL DEFAULT NULL,
  confidence_signal TEXT DEFAULT NULL,
  difficulty_level INTEGER DEFAULT 1,
  socratic_step INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE user_badges (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  badge_id TEXT NOT NULL,
  earned_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (badge_id) REFERENCES badges(id),
  UNIQUE(user_id, badge_id)
);

CREATE TABLE user_gamification (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER UNIQUE NOT NULL,
  xp INTEGER DEFAULT 0,
  level INTEGER DEFAULT 1,
  badges TEXT DEFAULT '[]',
  total_questions INTEGER DEFAULT 0,
  streak_best INTEGER DEFAULT 0,
  daily_limit_used INTEGER DEFAULT 0,
  daily_limit_date TEXT,
  referral_code TEXT UNIQUE,
  referred_by INTEGER,
  referral_count INTEGER DEFAULT 0,
  is_premium INTEGER DEFAULT 0,
  premium_until TEXT,
  tos_accepted INTEGER DEFAULT 0,
  tos_accepted_at TEXT
);

CREATE TABLE user_leagues (user_id INTEGER PRIMARY KEY, league TEXT NOT NULL DEFAULT 'bronze', weekly_xp INTEGER DEFAULT 0, week_start TEXT, prev_league TEXT, promoted_at TEXT, FOREIGN KEY (user_id) REFERENCES users(id));

CREATE TABLE user_messages (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL,
  message_type TEXT NOT NULL DEFAULT 'text',
  content_length INTEGER DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE user_sessions (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL,
  started_at TEXT NOT NULL DEFAULT (datetime('now')),
  ended_at TEXT,
  duration_seconds INTEGER,
  platform TEXT DEFAULT 'mini_app',
  source TEXT DEFAULT 'unknown',
  questions_answered INTEGER DEFAULT 0
);

CREATE TABLE user_xp (
  user_id INTEGER PRIMARY KEY,
  total_xp INTEGER DEFAULT 0,
  level INTEGER DEFAULT 1,
  current_streak INTEGER DEFAULT 0,      -- consecutive days with ≥1 activity
  longest_streak INTEGER DEFAULT 0,
  streak_freezes INTEGER DEFAULT 0,      -- purchasable with Stars
  last_activity_date TEXT,               -- YYYY-MM-DD (WIB)
  streak_updated_at TEXT DEFAULT (datetime('now')), coins INTEGER DEFAULT 0,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE users (id INTEGER PRIMARY KEY AUTOINCREMENT, telegram_id TEXT NOT NULL UNIQUE, role TEXT NOT NULL DEFAULT 'student', name TEXT NOT NULL, username TEXT, target_test TEXT, proficiency_level TEXT DEFAULT 'beginner', timezone TEXT DEFAULT 'UTC', is_active INTEGER DEFAULT 1, created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')), onboarding_complete INTEGER DEFAULT 0, is_premium INTEGER DEFAULT 0, premium_until TEXT, referred_by INTEGER, referral_code TEXT, referral_count INTEGER DEFAULT 0, is_founding_student INTEGER DEFAULT 0, source TEXT, current_streak INTEGER DEFAULT 0, longest_streak INTEGER DEFAULT 0, last_study_date TEXT);

CREATE TABLE visual_explanations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,

  -- Cache key fields (uniquely identify a generated visual)
  concept TEXT NOT NULL,              -- skill_tag, e.g. "inference", "subject_verb"
  explanation_type TEXT NOT NULL,     -- analogy | diagram | misconception_contrast | worked_example
  variant INTEGER NOT NULL DEFAULT 0, -- 0..N different visuals per (concept, type)
  content_id INTEGER,                 -- optional: per-question visual (NULL = concept-general)

  -- Storage
  r2_key TEXT NOT NULL,               -- R2 object key (e.g. "visual/inference/analogy/0.png")
  mime_type TEXT NOT NULL DEFAULT 'image/png',
  width INTEGER,
  height INTEGER,
  bytes INTEGER,                      -- size in bytes, for cost accounting

  -- Provenance — so we can regenerate if we improve the prompt or switch models
  prompt_used TEXT NOT NULL,
  model TEXT NOT NULL DEFAULT 'fal-ai/gemini-25-flash-image',
  generation_cost_usd REAL,           -- what we paid to make this (nullable if unknown)

  -- Quality / usage tracking
  hit_count INTEGER NOT NULL DEFAULT 0,
  helpful_count INTEGER NOT NULL DEFAULT 0,    -- 👍 from students
  not_helpful_count INTEGER NOT NULL DEFAULT 0,-- 👎 from students
  retired INTEGER NOT NULL DEFAULT 0,          -- 1 = don't serve, keep for audit

  generated_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_served_at TEXT
);

CREATE TABLE whisper_qa_flags (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  speaking_session_id INTEGER NOT NULL,
  flag_code TEXT NOT NULL,          -- 'too_short' | 'high_repetition' | 'no_punctuation' | 'gibberish' | 'hallucination_marker' | 'empty'
  severity TEXT NOT NULL DEFAULT 'medium',
  word_count INTEGER,
  unique_word_ratio REAL,
  repetition_ratio REAL,
  detail TEXT,
  status TEXT NOT NULL DEFAULT 'open',
  detected_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (speaking_session_id) REFERENCES speaking_sessions(id)
);

CREATE TABLE whisper_qa_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  started_at TEXT DEFAULT (datetime('now')),
  finished_at TEXT,
  scanned_count INTEGER DEFAULT 0,
  flagged_count INTEGER DEFAULT 0,
  breakdown TEXT,                   -- JSON { flag_code: count }
  notes TEXT
);

CREATE TABLE writing_criterion_scores (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  attempt_id INTEGER,               -- test_attempt that produced the essay
  user_id INTEGER NOT NULL,
  test_type TEXT NOT NULL,
  -- IELTS writing criteria
  task_achievement REAL,            -- Task Achievement / Task Response
  coherence_cohesion REAL,          -- Coherence & Cohesion
  lexical_resource REAL,            -- Lexical Resource
  grammar_range REAL,               -- Grammatical Range & Accuracy
  overall_band REAL,
  -- Extended
  relevancy_score REAL,             -- 0-1: on-topic gate
  word_count INTEGER,
  -- AI notes per criterion
  task_note TEXT,
  coherence_note TEXT,
  lexical_note TEXT,
  grammar_note TEXT,
  feedback_summary TEXT,            -- overall AI feedback in Indonesian
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE xp_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  amount INTEGER NOT NULL,
  source TEXT NOT NULL,                  -- 'question', 'speaking', 'writing', 'drill', 'quest', 'challenge', 'bonus'
  multiplier REAL DEFAULT 1.0,           -- 2x for first lesson of day, etc.
  detail TEXT,                           -- e.g. "speed_drill score=850"
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- ==================== INDEXES (105) ====================
CREATE INDEX idx_analytics_event ON analytics(event, created_at);
CREATE INDEX idx_api_usage_date ON api_usage(created_at);
CREATE INDEX idx_attempt_answers_attempt_id ON attempt_answers(attempt_id, section, question_index);
CREATE UNIQUE INDEX idx_attempt_answers_unique ON attempt_answers(attempt_id, section, question_index);
CREATE INDEX idx_certificates_hash ON certificates(hash_id);
CREATE INDEX idx_certificates_user ON certificates(user_id, test_type);
CREATE INDEX idx_channel_hourly_bucket ON channel_hourly_stats(hour_bucket);
CREATE INDEX idx_channel_posts_time ON channel_posts(posted_at);
CREATE INDEX idx_channel_posts_type ON channel_posts(post_type);
CREATE INDEX idx_channel_referrals_time ON channel_referrals(referred_at);
CREATE INDEX idx_cm_created ON conversation_messages(created_at);
CREATE INDEX idx_cm_topic ON conversation_messages(topic);
CREATE INDEX idx_cm_user_topic ON conversation_messages(user_id, topic);
CREATE INDEX idx_coin_log_user ON coin_log(user_id, created_at DESC);
CREATE INDEX idx_companion_initiated ON companion_conversations(initiated_at);
CREATE INDEX idx_companion_msg_conv ON companion_messages(conversation_id, created_at);
CREATE INDEX idx_companion_user_status ON companion_conversations(user_id, status);
CREATE INDEX idx_content_ai_score_runs_started
  ON content_ai_score_runs(started_at DESC);
CREATE INDEX idx_content_ai_scores_content
  ON content_ai_scores(content_id, created_at DESC);
CREATE INDEX idx_content_ai_scores_run
  ON content_ai_scores(run_id, overall_score ASC);
CREATE INDEX idx_content_ai_scores_verdict
  ON content_ai_scores(verdict, overall_score);
CREATE INDEX idx_content_anomalies_content
  ON content_anomalies(content_id, detected_at DESC);
CREATE INDEX idx_content_anomalies_flag
  ON content_anomalies(flag_type, status);
CREATE INDEX idx_content_anomalies_status
  ON content_anomalies(status, severity, detected_at DESC);
CREATE INDEX idx_content_audit_findings_code
  ON content_audit_findings(issue_code, severity);
CREATE INDEX idx_content_audit_findings_content
  ON content_audit_findings(content_id);
CREATE INDEX idx_content_audit_findings_run
  ON content_audit_findings(run_id);
CREATE INDEX idx_content_audit_runs_started
  ON content_audit_runs(started_at DESC);
CREATE INDEX idx_content_reports_content ON content_reports(content_id);
CREATE INDEX idx_content_reports_status ON content_reports(status, created_at DESC);
CREATE INDEX idx_content_reports_user ON content_reports(user_id, created_at DESC);
CREATE INDEX idx_conversation_user ON conversation_messages(user_id);
CREATE INDEX idx_conversations_user ON conversations(user_id, created_at);
CREATE INDEX idx_cq_attempts_concept
  ON lesson_cq_attempts(concept);
CREATE INDEX idx_cq_attempts_user
  ON lesson_cq_attempts(user_id, created_at DESC);
CREATE INDEX idx_daily_logs_user_date ON daily_question_logs(user_id, question_date);
CREATE UNIQUE INDEX idx_daily_quests_user_date_type
  ON daily_quests(user_id, quest_date, quest_type);
CREATE INDEX idx_emotional_log_user_type ON emotional_message_log(user_id, message_type, sent_at);
CREATE INDEX idx_error_logs_created ON error_logs(created_at DESC);
CREATE INDEX idx_error_logs_source ON error_logs(source, created_at DESC);
CREATE INDEX idx_exercise_active ON exercise_sessions(user_id, status);
CREATE INDEX idx_exercise_created ON exercise_sessions(user_id, created_at DESC);
CREATE INDEX idx_fc_user ON forgetting_curve(user_id);
CREATE INDEX idx_fq_members_user ON friend_quest_members(user_id, quest_id);
CREATE INDEX idx_game_scores_leaderboard
  ON game_scores(game_type, score DESC);
CREATE INDEX idx_game_scores_user_type
  ON game_scores(user_id, game_type, created_at DESC);
CREATE INDEX idx_gamification_user ON user_gamification(user_id);
CREATE INDEX idx_irt_ability_user ON irt_student_ability(user_id);
CREATE INDEX idx_lc_models_user ON learning_curve_models(user_id);
CREATE INDEX idx_lc_points_user_skill ON learning_curve_points(user_id, skill, practice_index);
CREATE INDEX idx_league_history_user ON league_history(user_id, week_start DESC);
CREATE INDEX idx_lesson_plans_class ON lesson_plans(class_id);
CREATE INDEX idx_lesson_plans_status ON lesson_plans(status);
CREATE INDEX idx_lesson_plans_user ON lesson_plans(user_id);
CREATE INDEX idx_lesson_step_results_plan ON lesson_step_results(lesson_plan_id);
CREATE INDEX idx_lesson_step_results_user ON lesson_step_results(user_id);
CREATE INDEX idx_mental_model_understanding ON student_mental_model(believed_understanding);
CREATE INDEX idx_mental_model_user ON student_mental_model(user_id);
CREATE INDEX idx_pronun_category ON pronunciation_bank(category, difficulty);
CREATE INDEX idx_pronun_difficulty ON pronunciation_bank(difficulty);
CREATE INDEX idx_pronun_test ON pronunciation_bank(test_type, category);
CREATE INDEX idx_psych_user ON psych_profile(user_id);
CREATE INDEX idx_ptr_attempt
  ON post_test_reviews(attempt_id);
CREATE INDEX idx_ptr_user_active
  ON post_test_reviews(user_id, status);
CREATE INDEX idx_qexp_content
  ON question_exposure(content_id);
CREATE INDEX idx_qexp_user_last_seen
  ON question_exposure(user_id, last_seen_at);
CREATE INDEX idx_referral_bonus_user ON referral_bonus_quota(user_id);
CREATE INDEX idx_skill_progress_skill ON skill_progress(user_id, skill, practiced_at DESC);
CREATE INDEX idx_skill_progress_user ON skill_progress(user_id, practiced_at DESC);
CREATE INDEX idx_speaking_dims_session
  ON speaking_dimension_scores(session_id);
CREATE INDEX idx_speaking_dims_user
  ON speaking_dimension_scores(user_id, test_type, created_at DESC);
CREATE INDEX idx_speaking_sessions_user ON speaking_sessions(user_id, status);
CREATE INDEX idx_sr_user_review ON spaced_repetition(user_id, next_review_at);
CREATE UNIQUE INDEX idx_star_transactions_payment_id
  ON star_transactions(payment_id) WHERE payment_id IS NOT NULL;
CREATE INDEX idx_star_transactions_user_created
  ON star_transactions(user_id, created_at DESC);
CREATE INDEX idx_student_profiles_user ON student_profiles(user_id);
CREATE INDEX idx_sve_user
  ON student_visual_exposures(user_id, seen_at DESC);
CREATE INDEX idx_sve_visual
  ON student_visual_exposures(visual_id);
CREATE INDEX idx_sws_user ON skill_weakness_summary(user_id);
CREATE INDEX idx_system_slo_alerts_metric
  ON system_slo_alerts(metric, created_at DESC);
CREATE INDEX idx_system_slo_alerts_state
  ON system_slo_alerts(state, created_at DESC);
CREATE INDEX idx_system_slo_snapshot_time
  ON system_slo_snapshots(snapshot_at DESC);
CREATE INDEX idx_test_attempts_user ON test_attempts(user_id);
CREATE INDEX idx_test_attempts_user_status
  ON test_attempts(user_id, status);
CREATE INDEX idx_test_contents_skills ON test_contents(test_type, section, cefr_level);
CREATE INDEX idx_test_contents_status ON test_contents(status, test_type);
CREATE INDEX idx_test_contents_type ON test_contents(test_type);
CREATE INDEX idx_test_contents_type_section_status
  ON test_contents(test_type, section, status);
CREATE INDEX idx_test_results_user ON test_results(user_id);
CREATE INDEX idx_topic_mastery_review ON topic_mastery(next_review_at);
CREATE INDEX idx_topic_mastery_user ON topic_mastery(user_id);
CREATE INDEX idx_tts_hash ON tts_cache(text_hash);
CREATE INDEX idx_tutor_interactions_topic ON tutor_interactions(user_id, topic);
CREATE INDEX idx_tutor_interactions_user ON tutor_interactions(user_id);
CREATE INDEX idx_user_messages_user ON user_messages(user_id, created_at DESC);
CREATE INDEX idx_user_sessions_user ON user_sessions(user_id, started_at DESC);
CREATE INDEX idx_users_telegram_id ON users(telegram_id);
CREATE UNIQUE INDEX idx_vis_cache_key
  ON visual_explanations(concept, explanation_type, variant, COALESCE(content_id, -1));
CREATE INDEX idx_vis_concept_type
  ON visual_explanations(concept, explanation_type, retired);
CREATE INDEX idx_vis_content_id
  ON visual_explanations(content_id)
  WHERE content_id IS NOT NULL;
CREATE INDEX idx_whisper_qa_runs_started
  ON whisper_qa_runs(started_at DESC);
CREATE INDEX idx_whisper_qa_session
  ON whisper_qa_flags(speaking_session_id);
CREATE INDEX idx_whisper_qa_status
  ON whisper_qa_flags(status, severity, detected_at DESC);
CREATE INDEX idx_writing_criteria_user
  ON writing_criterion_scores(user_id, test_type, created_at DESC);
CREATE INDEX idx_xp_log_user_date
  ON xp_log(user_id, created_at DESC);

-- ═══════════════════════════════════════════════════════
-- TRIPAY PAYMENT TRANSACTIONS
-- ═══════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS payment_transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  merchant_ref TEXT NOT NULL UNIQUE,
  tripay_reference TEXT,
  payment_method TEXT NOT NULL,
  payment_name TEXT,
  amount INTEGER NOT NULL,
  fee_merchant INTEGER DEFAULT 0,
  fee_customer INTEGER DEFAULT 0,
  status TEXT DEFAULT 'UNPAID',
  plan_days INTEGER NOT NULL,
  pay_code TEXT,
  checkout_url TEXT,
  expired_at TEXT,
  paid_at TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_payment_transactions_user
  ON payment_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_status
  ON payment_transactions(status);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_merchant_ref
  ON payment_transactions(merchant_ref);
