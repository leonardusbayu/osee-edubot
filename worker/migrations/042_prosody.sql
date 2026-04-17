-- 042: Prosody analysis — store word-level timing metrics from Whisper
-- Adds prosody columns to speaking_dimension_scores

ALTER TABLE speaking_dimension_scores ADD COLUMN prosody_wpm INTEGER DEFAULT 0;
ALTER TABLE speaking_dimension_scores ADD COLUMN prosody_pause_ratio REAL DEFAULT 0;
ALTER TABLE speaking_dimension_scores ADD COLUMN prosody_long_pauses INTEGER DEFAULT 0;
ALTER TABLE speaking_dimension_scores ADD COLUMN prosody_fillers INTEGER DEFAULT 0;
ALTER TABLE speaking_dimension_scores ADD COLUMN prosody_repetitions INTEGER DEFAULT 0;
ALTER TABLE speaking_dimension_scores ADD COLUMN prosody_fluency_score INTEGER DEFAULT 0;
ALTER TABLE speaking_dimension_scores ADD COLUMN prosody_rhythm_score INTEGER DEFAULT 0;
ALTER TABLE speaking_dimension_scores ADD COLUMN prosody_overall INTEGER DEFAULT 0;
ALTER TABLE speaking_dimension_scores ADD COLUMN prosody_raw TEXT;
