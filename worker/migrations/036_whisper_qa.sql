-- 036_whisper_qa.sql
-- Flags from automated inspection of Whisper transcripts.
-- Speaking evaluation = Whisper → GPT. If Whisper hallucinates or garbles
-- the audio, the GPT score is grading fiction. We detect the common
-- failure modes: too-short transcripts, excessive repetition, missing
-- punctuation, hallucination markers.

CREATE TABLE IF NOT EXISTS whisper_qa_flags (
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

CREATE INDEX IF NOT EXISTS idx_whisper_qa_status
  ON whisper_qa_flags(status, severity, detected_at DESC);

CREATE INDEX IF NOT EXISTS idx_whisper_qa_session
  ON whisper_qa_flags(speaking_session_id);

CREATE TABLE IF NOT EXISTS whisper_qa_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  started_at TEXT DEFAULT (datetime('now')),
  finished_at TEXT,
  scanned_count INTEGER DEFAULT 0,
  flagged_count INTEGER DEFAULT 0,
  breakdown TEXT,                   -- JSON { flag_code: count }
  notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_whisper_qa_runs_started
  ON whisper_qa_runs(started_at DESC);
