-- 049_visual_explanations.sql
-- Cache layer for AI-generated visual explanations (Gemini 2.5 Flash Image
-- via fal.ai, a.k.a. "Nano Banana"). Every image is an expensive API call
-- (~$0.03-0.04), but most are conceptually universal — an inference diagram
-- generated for student A is equally useful for student B. So we generate
-- once, cache keyed by (concept, explanation_type, variant), and serve
-- forever.
--
-- Two tables:
--   visual_explanations — the cache: one row per generated image. Bytes
--     live in R2 (keyed by `r2_key`); this table holds metadata + hit
--     tracking. `concept` is the skill_tag (e.g. "inference"). `variant`
--     lets us store multiple analogies per concept so a student who's
--     already seen one can see a different one next time.
--
--   student_visual_exposures — tracks which visuals each student has seen,
--     so the serving code can rotate variants instead of re-showing the
--     same image. Also captures helpfulness feedback if the tutor asks
--     "did this help?" so we can retire low-performing variants later.

CREATE TABLE IF NOT EXISTS visual_explanations (
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

-- The hot lookup path: "do we already have an analogy for inference?"
CREATE INDEX IF NOT EXISTS idx_vis_concept_type
  ON visual_explanations(concept, explanation_type, retired);

-- For per-question cached visuals
CREATE INDEX IF NOT EXISTS idx_vis_content_id
  ON visual_explanations(content_id)
  WHERE content_id IS NOT NULL;

-- Uniqueness: within (concept, explanation_type, content_id), each variant
-- number should be unique. Using a partial index because content_id is often NULL
-- and SQLite treats NULLs as distinct in unique constraints.
CREATE UNIQUE INDEX IF NOT EXISTS idx_vis_cache_key
  ON visual_explanations(concept, explanation_type, variant, COALESCE(content_id, -1));

-- ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS student_visual_exposures (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  visual_id INTEGER NOT NULL,
  seen_at TEXT NOT NULL DEFAULT (datetime('now')),
  feedback TEXT,                      -- 'helpful' | 'not_helpful' | NULL
  feedback_at TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (visual_id) REFERENCES visual_explanations(id)
);

CREATE INDEX IF NOT EXISTS idx_sve_user
  ON student_visual_exposures(user_id, seen_at DESC);

CREATE INDEX IF NOT EXISTS idx_sve_visual
  ON student_visual_exposures(visual_id);

-- Prevent showing the same visual to the same user twice in quick succession.
-- We allow re-exposure eventually (spaced repetition of visuals is fine), so
-- this is NOT a UNIQUE constraint — just a fast lookup for "has this user
-- seen visual X recently?"
