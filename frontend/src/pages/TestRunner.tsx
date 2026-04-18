import { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTestStore } from '../stores/test';
import { authedFetch, getTelegramUserId } from '../api/authedFetch';
import { startOfflineSyncService, stopOfflineSyncService, syncPendingAnswers } from '../utils/offline-sync';
import Timer from '../components/Timer';
import AudioRecorder from '../components/AudioRecorder';
import ReportIssueButton from '../components/ReportIssueButton';
import { hapticTap, hapticCorrect, hapticWrong, hapticHeavy, hapticSelection } from '../utils/haptic';

const API_URL = (import.meta.env.VITE_API_URL as string) || 'https://edubot-api.edubot-leonardus.workers.dev/api';

function stripHtml(str: string): string {
  if (!str) return '';
  return str.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim();
}

// Join a possibly-root-relative media path (e.g. `/api/audio/images/ielts/3882.png`
// for IELTS Task 1 charts) with API_URL, avoiding the common trap where both
// halves include `/api` and you end up hitting `/api/api/...` which 404s.
// Kept local because the codebase already uses `${API_URL}${path}` in several
// spots and we want to centralise the normalisation without changing call shape.
function toAbsoluteApiUrl(path: string): string {
  if (!path) return path;
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  const apiEndsWithApi = /\/api\/?$/.test(API_URL);
  const normalized = apiEndsWithApi && path.startsWith('/api/') ? path.slice(4) : path;
  // Guarantee exactly one `/` at the seam.
  const base = API_URL.replace(/\/+$/, '');
  const tail = normalized.startsWith('/') ? normalized : `/${normalized}`;
  return `${base}${tail}`;
}

// Resolve the Telegram user ID for direct media requests. The <audio> element
// loads TTS URLs via a plain GET without our JWT header, so we append tg_id as
// a query param — the worker's auth fallback accepts it. Uses the shared
// cached helper (sessionStorage) so navigation like `/test` → `/test/:id`
// (which wipes query params) doesn't leave us without a tg_id mid-session.
function getTgIdForMedia(): string | null {
  return getTelegramUserId();
}

// Build a TTS URL that will authenticate correctly when loaded by <audio>.
// Appends tg_id query param when available so the worker can resolve the user
// without JWT/X-Telegram-User-Id headers (which the browser does not send for
// <audio src>).
function buildTtsUrl(text: string, opts: { multi?: boolean; voice?: string; maxChars?: number } = {}): string | null {
  const clean = (text || '').trim();
  if (!clean) return null;
  const maxChars = opts.maxChars ?? 4000;
  const params = new URLSearchParams();
  if (opts.multi) params.set('multi', 'true');
  if (opts.voice) params.set('voice', opts.voice);
  params.set('text', clean.substring(0, maxChars));
  const tgId = getTgIdForMedia();
  if (tgId) params.set('tg_id', tgId);
  return `${API_URL}/tts/speak?${params.toString()}`;
}

const AudioWithError = ({
  src,
  className,
  onPlay,
  fallbackText,
}: {
  src: string;
  className?: string;
  onPlay?: () => void;
  // Optional: the spoken text so the user can still do the exercise visually
  // even when TTS is down (OpenAI outage, worker 5xx, CORS quirk on iOS
  // webview, etc.). For listen-and-repeat this is the sentence to repeat;
  // showing it beats leaving the user staring at "coba refresh" forever.
  fallbackText?: string;
}) => {
  const [err, setErr] = useState(false);
  const [attempt, setAttempt] = useState(0);
  if (!src) return null;
  if (err) {
    return (
      <div className="bg-tg-secondary rounded-lg p-3 text-sm space-y-2">
        <p className="text-tg-hint">
          🔇 Audio belum bisa diputar. Coba lagi, atau lanjut pakai teks.
        </p>
        {fallbackText && (
          <p className="text-tg-text font-medium leading-relaxed">{fallbackText}</p>
        )}
        <button
          type="button"
          onClick={() => { setErr(false); setAttempt((a) => a + 1); }}
          className="text-xs px-2 py-1 rounded-lg bg-tg-button/10 text-tg-button font-medium"
        >
          🔄 Coba lagi
        </button>
      </div>
    );
  }
  return (
    <audio
      // Bust the browser's negative-cache on retry by bumping a query param —
      // without this, clicking "Coba lagi" would just replay the error since
      // <audio> remembers the failed src.
      key={attempt}
      controls
      src={attempt > 0 ? `${src}${src.includes('?') ? '&' : '?'}_r=${attempt}` : src}
      className={className}
      onError={() => setErr(true)}
      onPlay={onPlay}
    />
  );
};

// Fisher-Yates shuffle. Used to randomize the visual order of multiple-
// choice options per render so students don't start pattern-matching on
// "answer is usually B." Each option carries its own letter (A/B/C/D or a
// .key), so scoring is unaffected by display order — student clicks a
// letter, server compares that letter to correct_answer. Previously the
// DB-stored option order was served verbatim, making the experience feel
// stale across sessions.
function shuffleArray<T>(arr: T[]): T[] {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export default function TestRunner() {
  const { attemptId } = useParams<{ attemptId: string }>();
  const navigate = useNavigate();
  const {
    sections, currentSection, currentQuestionIndex,
    setCurrentSection, setQuestionIndex, saveAnswer, answers,
    prefetchedQuestions, isPrefetchingQuestions, prefetchQuestions,
    networkAvailable, setNetworkAvailable,
    pendingAnswers,
  } = useTestStore();

  // Student-facing pending-sync state. Previously offline-sync dropped
  // answers silently after maxRetries — student saw "Test Complete" but the
  // answers never reached the server. Now we surface the queue so they
  // know something's off AND can manually retry. Tracks P1 BUGS.md #1.
  const [showSyncRetrying, setShowSyncRetrying] = useState(false);
  const pendingCount = pendingAnswers.length;
  const deadCount = pendingAnswers.filter((a) => a.retries >= a.maxRetries).length;
  const manualResyncInFlight = useRef(false);

  const handleManualResync = useCallback(async () => {
    if (manualResyncInFlight.current || !attemptId) return;
    manualResyncInFlight.current = true;
    setShowSyncRetrying(true);
    try {
      await syncPendingAnswers(parseInt(attemptId));
    } finally {
      manualResyncInFlight.current = false;
      // Leave the banner visible for 1.5s so the user sees the result.
      setTimeout(() => setShowSyncRetrying(false), 1500);
    }
  }, [attemptId]);

  const [questions, setQuestions] = useState<any[]>([]);
  const [sectionTimeSeconds, setSectionTimeSeconds] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [writingText, setWritingText] = useState('');
  const [sentenceOrder, setSentenceOrder] = useState<string[]>([]);
  const [blankInputs, setBlankInputs] = useState<string[]>([]);
  const [speakingResult, setSpeakingResult] = useState<any>(null);
  const [speakingLoading, setSpeakingLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitRetries, setSubmitRetries] = useState(0);
  const [transitioning, setTransitioning] = useState(false);
  const [showExplanation, setShowExplanation] = useState(false);
  const [currentExplanation, setCurrentExplanation] = useState('');
  const [audioLoadError, setAudioLoadError] = useState(false);
  const [audioPlayed, setAudioPlayed] = useState(false);
  const [questionsLoading, setQuestionsLoading] = useState(false);
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [offlineMode, setOfflineMode] = useState(false);
  const [encouragement, setEncouragement] = useState<string | null>(null);
  const questionStartTimeRef = useRef<number>(Date.now());
  // Tracks whether the component is still mounted. Used to guard async
  // setState calls (notably the speaking evaluation pipeline, which awaits a
  // multi-second upload+Whisper+GPT chain and often outlives the section the
  // user was on). React emits warnings when you setState on an unmounted
  // component, and the state mutation leaks memory in longer sessions.
  const isMountedRef = useRef(true);
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const currentQuestion = questions[currentQuestionIndex];

  // Shuffled-for-display version of the current question's options.
  // useMemo keyed on the question id+subIndex so shuffling is stable
  // within one question view (prevents re-shuffle on unrelated state
  // changes like timer ticks) but regenerates when the student moves
  // to the next question. Preserves the per-option letter (A/B/C/D),
  // so scoring is untouched.
  const shuffledOptions = useMemo(() => {
    const opts = currentQuestion?.options;
    if (!Array.isArray(opts) || opts.length === 0) return opts;
    return shuffleArray(opts);
  }, [currentQuestion?.id, currentQuestion?._subIndex, currentQuestionIndex]);
  const currentSectionInfo = sections.find((s) => s.id === currentSection);

  // Load questions for current section from prefetched cache or API
  useEffect(() => {
    const stored = useTestStore.getState();
    if (stored.attemptId && currentSection) {
      loadSectionQuestions();
    }
  }, [currentSection]);

  async function loadSectionQuestions() {
    setQuestionsLoading(true);
    try {
      const state = useTestStore.getState();
      const qType = state.questionType;

      // Check if we have prefetched questions for this section
      const cachedQuestions = currentSection ? prefetchedQuestions[currentSection] : null;
      if (cachedQuestions && cachedQuestions.length > 0) {
        console.log('[EduBot] Loading from prefetched cache:', currentSection, cachedQuestions.length, 'questions');
        const allQuestions: any[] = [];

        for (const q of cachedQuestions) {
          const mapped = mapQuestion(q);
          if (mapped?._grouped) {
            allQuestions.push(...mapped.items);
          } else if (mapped) {
            allQuestions.push(mapped);
          }
        }

        console.log('[EduBot] Mapped to', allQuestions.length, 'display questions');
        setQuestions(allQuestions.length > 0 ? allQuestions : getFallbackQuestions());
        setOfflineMode(true);
        setQuestionsLoading(false);
        return;
      }

      // Fallback: fetch from API
      // Drill mode: shorter limit + skill_tag filter so we load exactly the
      // concept-targeted questions. Falls back gracefully if the tag isn't
      // recognized server-side (backend ignores unknown drill_concept).
      const drillConcept = state.drillConcept;
      const drillCount = state.drillCount || 3;
      const effectiveLimit = drillConcept ? Math.max(1, Math.min(10, drillCount)) : 10;
      const params = new URLSearchParams({ limit: String(effectiveLimit) });
      if (qType) params.set('question_type', qType);
      if (drillConcept) params.set('drill_concept', drillConcept);
      // Pass test_type so the backend doesn't default to TOEFL_IBT for
      // IELTS / TOEFL_ITP / TOEIC attempts. Without this, an IELTS Writing
      // attempt was getting 0 rows (TOEFL_IBT has no task1/task2) and the
      // UI fell through to the reading-passage fallback below.
      if (state.testType) params.set('test_type', state.testType);
      const url = `/api/tests/questions/${currentSection}?${params.toString()}`;
      console.log('[EduBot] Loading questions from API:', url);
      const response = await authedFetch(url);
      if (response.ok) {
        const data = await response.json();
        console.log('[EduBot] Loaded', data.questions?.length || 0, 'raw questions for', currentSection);
        const allQuestions: any[] = [];

        for (const q of data.questions) {
          const mapped = mapQuestion(q);
          if (mapped?._grouped) {
            allQuestions.push(...mapped.items);
          } else if (mapped) {
            allQuestions.push(mapped);
          }
        }

        console.log('[EduBot] Mapped to', allQuestions.length, 'display questions');
        setQuestions(allQuestions.length > 0 ? allQuestions : getFallbackQuestions());
        setOfflineMode(false);
      } else {
        console.error('[EduBot] Questions endpoint failed:', response.status);
        setQuestions(getFallbackQuestions());
      }
    } catch (e) {
      console.error('[EduBot] loadSectionQuestions error:', e);
      setQuestions(getFallbackQuestions());
    } finally {
      setQuestionsLoading(false);
    }
  }

  // Extract option texts from explanation field
  // Data format: "ExplanationA ❌ Incorrect: text...B ❌ Incorrect: text...C ⭕ Correct: text...D ❌ Incorrect: text..."
  function extractOptionsFromExplanation(explanation: string): string[] {
    if (!explanation || explanation.length < 10) return [];

    // Find option markers in two formats:
    // Format 1: "A ❌ Incorrect:" or "A ⭕ Correct:"
    // Format 2: "(A) ❌ Incorrect:" or "(A) ⭕ Correct:"
    const markers: { letter: string; pos: number }[] = [];
    for (const letter of ['A', 'B', 'C', 'D']) {
      const patterns = [
        '(' + letter + ') \u274c Incorrect:',   // (A) ❌
        '(' + letter + ') \u2b55 Correct:',     // (A) ⭕
        '(' + letter + ') Incorrect:',
        '(' + letter + ') Correct:',
        letter + ' \u274c Incorrect:',           // A ❌
        letter + ' \u2b55 Correct:',             // A ⭕
        letter + ' Incorrect:',
        letter + ' Correct:',
      ];
      for (const p of patterns) {
        const idx = explanation.indexOf(p);
        if (idx >= 0) {
          markers.push({ letter, pos: idx + p.length });
          break;
        }
      }
    }

    if (markers.length < 2) return [];

    // Sort by position
    markers.sort((a, b) => a.pos - b.pos);

    const options: string[] = [];
    for (let i = 0; i < markers.length; i++) {
      const start = markers[i].pos;
      const end = i + 1 < markers.length ? markers[i + 1].pos - 20 : explanation.length;
      let text = explanation.substring(start, end).trim();

      // Clean up: remove leading quotes and "The text states"
      text = text
        .replace(/^The text states,?\s*[''""\u2018\u2019\u201c\u201d]*/i, '')
        .replace(/^The text mentions,?\s*[''""\u2018\u2019\u201c\u201d]*/i, '')
        .replace(/^The passage states,?\s*[''""\u2018\u2019\u201c\u201d]*/i, '')
        .trim();

      // First sentence, max 100 chars
      const firstSentence = text.split(/\.\s/)[0] || text;
      let short = firstSentence.length > 100 ? firstSentence.substring(0, 97) + '...' : firstSentence;
      if (short.length < 2) short = text.substring(0, 100);

      options.push(markers[i].letter + '. ' + short);
    }

    return options;
  }

  // Get usable options from question data
  function getOptions(c: any): string[] {
    // Check if options have actual text
    if (c.options?.length > 0) {
      const withText = c.options.filter((o: any) => {
        if (typeof o === 'string') return o.trim().length > 0;
        if (typeof o === 'object' && o.text) return o.text.trim().length > 0;
        return false;
      });
      if (withText.length >= 2) {
        return withText.map((o: any, i: number) => {
          const text = typeof o === 'string' ? o : o.text;
          const letter = String.fromCharCode(65 + i);
          return text.match(/^[A-D][\.\)]/i) ? text : `${letter}. ${text}`;
        });
      }
    }
    // Try extracting from explanation
    const fromExplanation = extractOptionsFromExplanation(c.explanation || '');
    if (fromExplanation.length >= 2) return fromExplanation;
    // Fallback
    return ['A.', 'B.', 'C.', 'D.'];
  }

  // Map D1 question format to display format
  function mapQuestion(q: any): any {
    const c = q.content || {};
    const type = q.question_type;

    // ─── Universal grouped_listening handler ──────────────────
    // Catches ALL listening question types from any test (TOEFL IBT/ITP, IELTS, TOEIC)
    // as long as their content JSON has type: "grouped_listening"
    if (c.type === 'grouped_listening' && c.questions?.length > 0) {
      const passageScript = stripHtml(c.passage_script || '');
      const ttsUrl = passageScript.length > 10
        ? buildTtsUrl(passageScript, { multi: true, maxChars: 4000 })
        : null;

      const items: any[] = [];

      // Only show listening_passage step if there's actual audio or text to show
      if (ttsUrl || passageScript.length > 10) {
        items.push({
          id: q.id,
          type: 'listening_passage',
          instruction: stripHtml(c.direction || 'Listen to the audio.'),
          passage: passageScript,
          audio_url: ttsUrl,
          group_name: stripHtml(c.group_name || ''),
        });
      }

      // Then each question
      for (let i = 0; i < c.questions.length; i++) {
        const sq = c.questions[i];
        const opts = (sq.options || []).map((o: any) => `${o.key}. ${stripHtml(o.text || '')}`);

        // Some questions have their own audio (e.g., per-question scripts)
        let qAudioUrl = null;
        const qScript = stripHtml(sq.script || '');
        if (qScript.length > 10) {
          qAudioUrl = buildTtsUrl(qScript, { multi: true, maxChars: 2000 });
        }

        // Per-question image (e.g., TOEIC Part 1 photographs)
        const qImageUrl = sq.image_url
          ? toAbsoluteApiUrl(sq.image_url)
          : null;

        // Determine if it's fill-in-blank (no options) or multiple choice
        if (opts.length >= 2) {
          items.push({
            id: q.id,
            _subIndex: i,
            type: 'listening',
            instruction: '',
            question: stripHtml(sq.question_text || ''),
            options: opts,
            correct: (sq.answers?.[0] || '').toUpperCase(),
            explanation: stripHtml(sq.explanation || ''),
            audio_url: qAudioUrl,
            image_url: qImageUrl,
          });
        } else {
          // Fill-in-blank listening (e.g., IELTS Section 1 note completion)
          items.push({
            id: q.id,
            _subIndex: i,
            type: 'fill_blank',
            instruction: stripHtml(c.direction || 'Complete the notes.'),
            question: stripHtml(sq.question_text || ''),
            correct: sq.answers?.[0] || '',
            explanation: stripHtml(sq.explanation || ''),
            audio_url: qAudioUrl,
            image_url: qImageUrl,
          });
        }
      }

      return { _grouped: true, items };
    }

    // ─── Universal grouped_reading handler ──────────────────
    // Catches ALL reading question types with grouped format
    if (c.type === 'grouped_reading' && c.questions?.length > 0 && !['reading_passage', 'error_identification'].includes(type)) {
      const passage = stripHtml(c.passage || '');
      const items: any[] = [];
      for (let i = 0; i < c.questions.length; i++) {
        const sq = c.questions[i];
        const opts = (sq.options || []).map((o: any) => `${o.key}. ${stripHtml(o.text || '')}`);
        items.push({
          id: q.id,
          _subIndex: i,
          type: 'multiple_choice',
          passage,
          question: stripHtml(sq.question_text || ''),
          options: opts.length >= 2 ? opts : getOptions(sq),
          correct: (sq.answers?.[0] || '').toUpperCase(),
          explanation: stripHtml(sq.explanation || ''),
        });
      }
      return { _grouped: true, items };
    }

    if (type === 'complete_the_words') {
      // Transform {{letters}} into blanks: "dama{{ges}}" → "dama___"
      const rawPassage = c.passage_text || '';
      const blanks: string[] = [];
      const displayPassage = rawPassage.replace(/\{\{([^}]+)\}\}/g, (_: string, letters: string) => {
        blanks.push(letters);
        return '_'.repeat(Math.max(letters.length, 3));
      });
      return {
        id: q.id,
        type: 'complete_the_words',
        instruction: c.direction || 'Fill in the missing letters.',
        passage: displayPassage,
        blanks,  // The correct answers for each blank
        answers: c.answers || blanks,
        explanation: c.explanation || '',
      };
    }

    if (type === 'reading_passage') {
      // Grouped reading passage — flatten into passage display + individual questions
      if (c.type === 'grouped_reading' && c.questions?.length > 0) {
        const passage = stripHtml(c.passage || '');
        const items: any[] = [];
        for (let i = 0; i < c.questions.length; i++) {
          const sq = c.questions[i];
          const opts = (sq.options || []).map((o: any) => `${o.key}. ${stripHtml(o.text || '')}`);
          items.push({
            id: q.id,
            _subIndex: i,
            type: 'multiple_choice',
            passage,
            question: stripHtml(sq.question_text || ''),
            options: opts.length >= 2 ? opts : getOptions(sq),
            correct: (sq.answers?.[0] || '').toUpperCase(),
            explanation: stripHtml(sq.explanation || ''),
          });
        }
        return { _grouped: true, items };
      }
      // Fallback
      return {
        id: q.id,
        type: 'multiple_choice',
        passage: stripHtml(c.passage || c.passage_text || ''),
        question: stripHtml(c.question_text || ''),
        options: getOptions(c),
        correct: (c.answers?.[0] || '').toUpperCase(),
        explanation: stripHtml(c.explanation || ''),
      };
    }

    if (type === 'error_identification') {
      // Grouped error identification — flatten into individual questions.
      // Skip sub-items whose sentence AND portion list are both empty:
      // some legacy TOEFL_ITP imports have blank content that would render
      // as a Q1/10 card with nothing to read or tap (silent dead end).
      if (c.type === 'grouped_reading' && c.questions?.length > 0) {
        const items: any[] = [];
        for (let i = 0; i < c.questions.length; i++) {
          const sq = c.questions[i];
          const sentence = stripHtml(sq.question_text || '');
          const opts = (sq.options || []).map((o: any) => ({ key: o.key, text: stripHtml(o.text || '') }));
          if (!sentence && opts.length === 0) continue;
          items.push({
            id: q.id,
            _subIndex: i,
            type: 'error_identification',
            instruction: stripHtml(c.direction || 'Find the error in this sentence.'),
            sentence,
            portions: opts,
            correct: (sq.answers?.[0] || '').toUpperCase(),
            explanation: stripHtml(sq.explanation || ''),
          });
        }
        if (items.length === 0) return null;
        return items.length === 1 ? items[0] : { _grouped: true, items };
      }
      // Fallback single question. The AI-generated error_id schema embeds
      // the instruction at the top of question_text (e.g. "Identify the
      // error in the following sentence:\n<actual sentence>"). Split on the
      // first newline so the instruction doesn't show up twice — once as
      // the generic instruction and again inside the displayed sentence.
      const rawQText = stripHtml(c.question_text || '');
      let instr = stripHtml(c.direction || '');
      let sentence = rawQText;
      const nlIdx = rawQText.indexOf('\n');
      if (nlIdx > 0 && /identif|find the error/i.test(rawQText.slice(0, nlIdx))) {
        if (!instr) instr = rawQText.slice(0, nlIdx).replace(/:$/, '').trim();
        sentence = rawQText.slice(nlIdx + 1).trim();
      }
      if (!instr) instr = 'Find the error in this sentence.';
      const portions = (c.options || []).map((o: any) => ({ key: o.key, text: stripHtml(o.text || '') }));
      if (!sentence && portions.length === 0) return null;
      return {
        id: q.id,
        type: 'error_identification',
        instruction: instr,
        sentence,
        portions,
        correct: (c.answers?.[0] || '').toUpperCase(),
        explanation: stripHtml(c.explanation || ''),
      };
    }

    if (['read_in_daily_life', 'read_academic_passage'].includes(type)) {
      const passageText = c.passage_text || '';
      const audioUrl = passageText.length > 10 && passageText.length <= 2000
        ? buildTtsUrl(passageText, { maxChars: 2000 })
        : null;
      return {
        id: q.id,
        type: 'multiple_choice',
        passage: passageText,
        question: c.question_text || '',
        options: getOptions(c),
        correct: (c.answers?.[0] || '').toUpperCase(),
        explanation: c.explanation || '',
        audio_url: audioUrl,
      };
    }

    if ([
      // TOEFL iBT listening
      'listen_choose_response', 'listen_conversation', 'listen_announcement', 'listen_academic_talk',
      // TOEFL ITP listening
      'listen_short_dialogue', 'listen_long_conversation', 'listen_talk',
      // TOEIC listening
      'photographs', 'question_response', 'conversations', 'talks',
    ].includes(type)) {
      // NEW: Grouped listening — c has passage_script + questions array
      if (c.type === 'grouped_listening' && c.questions?.length > 0) {
        const passageScript = stripHtml(c.passage_script || '');
        const ttsUrl = passageScript.length > 10
          ? buildTtsUrl(passageScript, { multi: true, maxChars: 4000 })
          : null;

        const items: any[] = [];

        // Only show listening_passage step if there's actual audio or text
        if (ttsUrl || passageScript.length > 10) {
          items.push({
            id: q.id,
            type: 'listening_passage',
            instruction: stripHtml(c.direction || 'Listen to the audio.'),
            passage: passageScript,
            audio_url: ttsUrl,
            group_name: stripHtml(c.group_name || ''),
          });
        }

        // Then each question
        for (let i = 0; i < c.questions.length; i++) {
          const sq = c.questions[i];
          const opts = (sq.options || []).map((o: any) => `${o.key}. ${stripHtml(o.text || '')}`);
          let qAudioUrl = null;
          const qScript = stripHtml(sq.script || '');
          if (qScript.length > 10) {
            qAudioUrl = buildTtsUrl(qScript, { multi: true, maxChars: 2000 });
          }

          const qImageUrl = sq.image_url
            ? toAbsoluteApiUrl(sq.image_url)
            : null;

          items.push({
            id: q.id,
            _subIndex: i,
            type: 'listening',
            instruction: '',
            question: stripHtml(sq.question_text || ''),
            options: opts.length >= 2 ? opts : getOptions(sq),
            correct: (sq.answers?.[0] || '').toUpperCase(),
            explanation: stripHtml(sq.explanation || ''),
            audio_url: qAudioUrl,
            image_url: qImageUrl,
          });
        }

        return { _grouped: true, items };
      }

      // Fallback: old single-question format
      const audioText = c.passage_text || c.passage_script || '';
      const ttsUrl = audioText.length > 10
        ? buildTtsUrl(audioText, { multi: true, maxChars: 2000 })
        : null;

      let options = getOptions(c);
      if (options.length < 2 && c.options?.length > 0 && c.options[0]?.key) {
        options = c.options.map((o: any) => `${o.key}. ${o.text || ''}`);
      }

      return {
        id: q.id,
        type: 'listening',
        instruction: c.direction || 'Listen to the audio, then answer the question.',
        passage: audioText,
        question: c.question_text || '',
        options,
        correct: (c.answers?.[0] || '').toUpperCase(),
        audio_url: ttsUrl,
        explanation: c.explanation || '',
      };
    }

    if (type === 'listen_and_repeat' || type === 'take_interview') {
      // Grouped speaking — each group has direction + multiple questions with scripts
      if (c.type === 'grouped_speaking' && c.questions?.length > 0) {
        const items: any[] = [];

        for (let i = 0; i < c.questions.length; i++) {
          const sq = c.questions[i];
          // Different ingestion paths populate different fields:
          //   - parse-ielts / parse-ielts-extra put text in sq.script
          //   - AI-generated iBT content puts it in sq.question_text
          //   - TOEIC parser uses sq.script (from transcripts)
          // Fall through to the first non-empty one so we don't silently ship
          // an empty card with no audio AND no prompt.
          const script = stripHtml(sq.script || sq.question_text || '');
          const ttsUrl = script.length > 3
            ? buildTtsUrl(script, { multi: true, maxChars: 2000 })
            : null;

          if (type === 'listen_and_repeat') {
            items.push({
              id: q.id,
              _subIndex: i,
              type: 'listen_and_repeat',
              instruction: stripHtml(c.direction || 'Listen and repeat the sentence.'),
              prompt: script,
              audio_url: ttsUrl,
              group_name: stripHtml(c.group_name || ''),
            });
          } else {
            items.push({
              id: q.id,
              _subIndex: i,
              type: 'take_interview',
              instruction: stripHtml(c.direction || 'Answer the question naturally.'),
              prompt: script,
              audio_url: ttsUrl,
              group_name: stripHtml(c.group_name || ''),
            });
          }
        }

        return { _grouped: true, items };
      }

      // Fallback single question
      const prompt = stripHtml(c.passage_text || c.question_text || '');
      return {
        id: q.id,
        type,
        instruction: stripHtml(c.direction || ''),
        prompt,
        audio_url: prompt.length > 0
          ? buildTtsUrl(prompt, { multi: true, maxChars: 2000 })
          : null,
      };
    }

    if (type === 'build_sentence' || type === 'write_email' || type === 'write_academic_discussion' || type === 'integrated_writing') {
      // Grouped writing
      if (c.type === 'grouped_writing' && c.questions?.length > 0) {
        const items: any[] = [];
        for (let i = 0; i < c.questions.length; i++) {
          const sq = c.questions[i];
          if (type === 'build_sentence') {
            // Extract words from options
            const opts = (sq.options || []);
            const words = opts.map((o: any) => stripHtml(o.text || o.key || ''));
            // Build the sentence template (passage with {{a}} {{b}} slots)
            const passage = stripHtml(sq.passage || '');
            // Correct sentence: replace placeholders with option values in order
            let correctSentence = passage;
            for (const o of opts) {
              correctSentence = correctSentence.replace(`{{${o.key}}}`, stripHtml(o.text || ''));
            }

            items.push({
              id: q.id,
              _subIndex: i,
              type: 'build_sentence',
              instruction: stripHtml(c.direction || 'Susun kata menjadi kalimat yang tepat.'),
              passage: passage.replace(/\{\{[^}]+\}\}/g, '____'),  // Show blanks
              words: [...words].sort(() => Math.random() - 0.5),
              correct: correctSentence,
            });
          } else if (type === 'integrated_writing') {
            // TOEFL iBT Integrated Writing: read passage + write summary
            const passage = stripHtml(sq.passage || '');
            const questionText = stripHtml(sq.question_text || 'Summarize the main points made in the passage.');
            items.push({
              id: q.id,
              _subIndex: i,
              type: 'write_academic_discussion',
              instruction: stripHtml(c.direction || 'Read the passage below. Then write a response that summarizes the main points. Your response should be between 150 and 225 words.'),
              prompt: questionText,
              contexts: [{ text: passage, label: 'Reading Passage' }],
              audio_url: null,
              time_limit: 1200,
              model_answer: stripHtml(sq.model_answer || ''),
            });
          } else if (type === 'write_email') {
            const prompt = stripHtml(sq.passage || sq.question_text || '');
            const contexts = (sq.illustrated_passages || []).map((ip: any) => ({
              text: stripHtml(ip.text || ''),
              label: stripHtml(ip.label || ''),
            }));
            // Generate audio for the scenario
            const scenarioAudio = prompt.length > 10
              ? buildTtsUrl(prompt, { voice: 'alloy', maxChars: 2000 })
              : null;
            items.push({
              id: q.id,
              _subIndex: i,
              type: 'write_email',
              instruction: stripHtml(c.direction || 'Write an email.'),
              prompt: prompt || 'Write an email response.',
              contexts,
              audio_url: scenarioAudio,
              time_limit: 420,
              model_answer: stripHtml(sq.model_answer || ''),
            });
          } else {
            const prompt = stripHtml(sq.passage || sq.question_text || '');
            const contexts = (sq.illustrated_passages || []).map((ip: any) => ({
              text: stripHtml(ip.text || ''),
              label: stripHtml(ip.label || ''),
            }));
            // Generate audio for professor's lecture (first context)
            const profAudio = contexts.length > 0 && contexts[0].text.length > 10
              ? buildTtsUrl(contexts[0].text, { multi: true, maxChars: 2000 })
              : null;
            items.push({
              id: q.id,
              _subIndex: i,
              type: 'write_academic_discussion',
              instruction: stripHtml(c.direction || 'Write your response.'),
              prompt: prompt || 'Write a contribution to the discussion.',
              contexts,
              audio_url: profAudio,
              time_limit: 600,
              model_answer: stripHtml(sq.model_answer || ''),
            });
          }
        }
        return { _grouped: true, items };
      }

      // Fallback
      if (type === 'build_sentence') {
        const words = (c.passage_text || '').replace(/\{\{.*?\}\}/g, '').split(/\s+/).filter(Boolean);
        return {
          id: q.id,
          type: 'build_sentence',
          instruction: stripHtml(c.direction || 'Arrange the words correctly.'),
          words: words.length > 1 ? words.sort(() => Math.random() - 0.5) : ['arrange', 'these', 'words'],
          correct: words.join(' '),
        };
      }
      return {
        id: q.id,
        type,
        instruction: stripHtml(c.direction || ''),
        prompt: stripHtml(c.question_text || c.passage_text || 'Write your response.'),
        time_limit: type === 'write_email' ? 420 : 600,
      };
    }

    // fill_blank (TOEFL ITP style)
    if (type === 'fill_blank' || type === 'fill_in_blank' || type === 'sentence_completion' || type === 'summary_completion') {
      // All are text-fill question types rendered as textarea
      return {
        id: q.id,
        type: 'fill_blank',
        instruction: stripHtml(c.direction || (type === 'fill_in_blank' ? 'Complete the sentence with the correct word.' : 'Fill in the blanks to complete the text.')),
        passage: c.passage_text || c.passage || '',
        question: c.question_text || '',
        time_limit: 420,
      };
    }

    // IELTS True/False/Not Given
    if (type === 'true_false_not_given') {
      return {
        id: q.id,
        type: 'true_false_not_given',
        passage: c.passage_text || c.passage || '',
        question: c.question_text || '',
        options: (c.options || []).length >= 2
          ? c.options.map((o: any) => o.text || o)
          : ['True', 'False', 'Not Given'],
        correct: (c.answers?.[0] || '').toUpperCase(),
        explanation: c.explanation || '',
      };
    }

    // IELTS Matching headings / Matching information / Matching features
    if (['matching_headings', 'matching_information', 'matching_features', 'matching'].includes(type)) {
      // Grouped matching — flatten into individual match questions
      if (c.type === 'grouped_reading' && c.questions?.length > 0) {
        const items: any[] = [];
        for (let i = 0; i < c.questions.length; i++) {
          const sq = c.questions[i];
          items.push({
            id: q.id,
            _subIndex: i,
            type: 'matching',
            instruction: stripHtml(c.direction || 'Match each item to its correct match.'),
            passage: c.passage_text || c.passage || '',
            question: stripHtml(sq.question_text || ''),
            options: (sq.options || c.options || []).map((o: any) => ({
              key: o.key || o,
              text: o.text || o,
            })),
            correct: (sq.answers?.[0] || '').toUpperCase(),
            explanation: stripHtml(sq.explanation || ''),
          });
        }
        return { _grouped: true, items };
      }

      return {
        id: q.id,
        type: 'matching',
        instruction: stripHtml(c.direction || 'Match each item to its correct match.'),
        passage: c.passage_text || c.passage || '',
        question: c.question_text || '',
        options: (c.options || []).map((o: any) => ({
          key: o.key || o,
          text: o.text || o,
        })),
        correct: (c.answers?.[0] || '').toUpperCase(),
        explanation: c.explanation || '',
      };
    }

    // IELTS Note completion
    if (type === 'note_completion') {
      return {
        id: q.id,
        type: 'fill_blank',
        instruction: stripHtml(c.direction || 'Complete the notes with the correct word or number.'),
        passage: c.passage_text || c.passage || '',
        question: c.question_text || '',
        time_limit: 420,
      };
    }

    // IELTS Map / Diagram labeling
    if (type === 'map_diagram_labeling') {
      return {
        id: q.id,
        type: 'fill_blank',
        instruction: stripHtml(c.direction || 'Label the diagram with the correct answer.'),
        passage: c.passage_text || c.passage || '',
        question: c.question_text || '',
        image_url: c.image_url || null,
        time_limit: 420,
      };
    }

    // IELTS Writing Task 1 (graphs/charts) — premium only
    if (type === 'task1') {
      // Unpack grouped_writing if needed — data may be nested in questions[0]
      const sq = (c.type === 'grouped_writing' && c.questions?.length > 0) ? c.questions[0] : c;
      const contexts = (sq.illustrated_passages || c.illustrated_passages || []).map((ip: any) => ({
        text: stripHtml(ip.text || ''),
        label: stripHtml(ip.label || ''),
        image_url: ip.image_url || null,
      }));
      // Chart/graph image for IELTS Task 1 (top-level or nested)
      const chartImage = sq.image_url || c.image_url || null;
      const chartImageUrl = chartImage ? toAbsoluteApiUrl(chartImage) : null;
      // Use a dedicated render type — previously reused 'write_email', which
      // put an "Email Writing" badge, "Dear Professor..." placeholder, and a
      // "formal email response" hint on a chart-description task. Those are
      // iBT academic-discussion copy, wrong for IELTS Task 1.
      return {
        id: q.id,
        type: 'ielts_task1',
        instruction: stripHtml(c.direction || sq.direction || 'Describe the chart in at least 150 words.'),
        passage: sq.passage_text || sq.passage || c.passage_text || '',
        contexts,
        prompt: sq.question_text || c.question_text || 'Describe the chart below.',
        time_limit: 1200, // IELTS Task 1: 20 minutes
        model_answer: stripHtml(sq.model_answer || c.model_answer || ''),
        premium_only: true,
        image_url: chartImageUrl,
      };
    }

    // IELTS Writing Task 2 (essay)
    if (type === 'task2') {
      // Unpack grouped_writing if needed — data may be nested in questions[0]
      const sq = (c.type === 'grouped_writing' && c.questions?.length > 0) ? c.questions[0] : c;
      return {
        id: q.id,
        type: 'write_academic_discussion',
        instruction: stripHtml(c.direction || sq.direction || 'Write an essay of at least 250 words addressing the topic below.'),
        passage: sq.passage_text || sq.passage || c.passage_text || '',
        prompt: sq.question_text || c.question_text || '',
        contexts: (sq.illustrated_passages || []).map((ip: any) => ({
          text: stripHtml(ip.text || ''),
          label: stripHtml(ip.label || ''),
        })),
        time_limit: 1200,
        model_answer: stripHtml(sq.model_answer || c.model_answer || ''),
        premium_only: true,
      };
    }

    // IELTS Speaking Part 1 (Q&A)
    if (type === 'part1') {
      const script = stripHtml(c.passage_text || c.question_text || '');
      return {
        id: q.id,
        type: 'take_interview',
        instruction: stripHtml(c.direction || 'Answer the following questions naturally.'),
        prompt: script,
        audio_url: script.length > 3
          ? buildTtsUrl(script, { maxChars: 2000 })
          : null,
        premium_only: true,
      };
    }

    // IELTS Speaking Part 2 (Long turn) — premium
    if (type === 'part2') {
      return {
        id: q.id,
        type: 'take_interview',
        instruction: stripHtml(c.direction || 'Speak for 1-2 minutes about the topic.'),
        prompt: stripHtml(c.passage_text || c.question_text || ''),
        time_limit: 120,
        premium_only: true,
      };
    }

    // IELTS Speaking Part 3 (Discussion) — premium
    if (type === 'part3') {
      return {
        id: q.id,
        type: 'take_interview',
        instruction: stripHtml(c.direction || 'Discuss the topic in detail.'),
        prompt: stripHtml(c.passage_text || c.question_text || ''),
        premium_only: true,
      };
    }

    // TOEFL iBT Insert text / Prose summary
    if (type === 'insert_text' || type === 'prose_summary') {
      return {
        id: q.id,
        type: 'multiple_choice',
        instruction: stripHtml(c.direction || 'Select the correct answer.'),
        passage: c.passage_text || c.passage || '',
        question: c.question_text || '',
        options: getOptions(c),
        correct: (c.answers?.[0] || '').toUpperCase(),
        explanation: c.explanation || '',
      };
    }

    // (photographs + question_response now handled by the grouped listening block above)

    // TOEIC Reading Part 5 — Incomplete Sentences
    if (type === 'incomplete_sentences') {
      return {
        id: q.id,
        type: 'multiple_choice',
        instruction: stripHtml(c.direction || 'Select the best answer to complete the sentence.'),
        passage: '',
        question: c.question_text || '',
        options: getOptions(c),
        correct: (c.answers?.[0] || '').toUpperCase(),
        explanation: c.explanation || '',
      };
    }

    // TOEIC Reading Part 6 — Text Completion
    if (type === 'text_completion') {
      return {
        id: q.id,
        type: 'fill_blank',
        instruction: stripHtml(c.direction || 'Fill in the blanks to complete the text.'),
        passage: c.passage_text || c.passage || '',
        question: c.question_text || '',
        time_limit: 420,
      };
    }

    // TOEIC Reading Part 7 — Reading Comprehension
    if (type === 'reading_comprehension') {
      return {
        id: q.id,
        type: 'multiple_choice',
        passage: c.passage_text || c.passage || '',
        question: c.question_text || '',
        options: getOptions(c),
        correct: (c.answers?.[0] || '').toUpperCase(),
        explanation: c.explanation || '',
      };
    }

    // Default: multiple choice
    return {
      id: q.id,
      type: 'multiple_choice',
      question: c.question_text || 'Question',
      options: c.options?.length > 0 ? c.options : ['A', 'B.', 'C.', 'D.'],
      correct: c.answers?.[0] || '',
      passage: c.passage_text || c.passage || '',
    };
  }

  // Previously returned three hardcoded reading-passage questions as a
  // "graceful degradation" when the API returned nothing. That masked real
  // bugs (e.g. IELTS Writing fetched with wrong test_type → 0 rows → user
  // sees a reading question in the Writing section). Worse, the fallback
  // IDs were strings like 'fallback-1', which broke the Report button
  // (backend rejects non-numeric content_id). Returning [] surfaces the
  // underlying problem; the UI now shows an explicit empty state instead.
  function getFallbackQuestions(): any[] {
    return [];
  }

  useEffect(() => {
    if (currentSectionInfo) {
      setSectionTimeSeconds(currentSectionInfo.duration_minutes * 60);
    }
  }, [currentSection]);

  useEffect(() => {
    setSelectedAnswer(null);
    setWritingText('');
    setSentenceOrder([]);
    setBlankInputs([]);
    setSpeakingResult(null);
    setSpeakingLoading(false);
    setSubmitting(false);
    setAudioPlayed(false);
    questionStartTimeRef.current = Date.now();
  }, [currentQuestionIndex, currentSection]);

  // Monitor network status, prefetch, and start sync service on mount
  useEffect(() => {
    let activeSessionId: number | null = null;

    // Network monitoring
    const handleOnline = () => {
      setNetworkAvailable(true);
      console.log('[EduBot] Network is online');
    };
    const handleOffline = () => {
      setNetworkAvailable(false);
      console.log('[EduBot] Network is offline');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Start session, prefetch questions, and start sync service
    (async () => {
      try {
        const res = await authedFetch('/api/analytics/session/start', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ platform: 'mini_app', source: 'test' }),
        });
        if (res.ok) {
          const data = await res.json();
          activeSessionId = data.session_id;
          setSessionId(data.session_id);
        } else {
          console.warn('[TestRunner] analytics/session/start returned', res.status);
        }
      } catch (e) {
        console.warn('[TestRunner] analytics/session/start errored:', e);
      }

      // Prefetch all questions for offline-first mode
      if (attemptId) {
        const success = await prefetchQuestions(parseInt(attemptId));
        console.log('[EduBot] Question prefetch:', success ? 'success' : 'failed');
      }

      // Start background sync service
      startOfflineSyncService();
    })();

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      stopOfflineSyncService();

      if (activeSessionId) {
        authedFetch('/api/analytics/session/end', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ session_id: activeSessionId, questions_answered: currentQuestionIndex }),
        }).catch(() => {});
      }
    };
  }, [attemptId, prefetchQuestions]);

  // Track message on each question load
  useEffect(() => {
    if (currentQuestion) {
      authedFetch('/api/analytics/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message_type: 'question_view', content_length: 0 }),
      }).catch(() => {});
    }
  }, [currentQuestionIndex]);

  const handleSubmitAnswer = useCallback(async () => {
    if (!currentSection || !currentQuestion || submitting) return;
    setSubmitting(true);
    hapticTap();

    let answerData: any = {};

    const advanceWithTransition = (fn: () => void) => {
      setTransitioning(true);
      setTimeout(() => { fn(); setTransitioning(false); }, 150);
    };

    // Listening passage — just advance, no answer to save
    if (currentQuestion.type === 'listening_passage') {
      if (currentQuestion.audio_url && !audioPlayed) {
        setSubmitError('Dengarkan audio terlebih dahulu sebelum melanjutkan.');
        setSubmitting(false);
        return;
      }
      setSubmitError(null);
      if (currentQuestionIndex + 1 < questions.length) {
        advanceWithTransition(() => setQuestionIndex(currentQuestionIndex + 1));
      }
      setSubmitting(false);
      return;
    }

    if (currentQuestion.type === 'multiple_choice' || currentQuestion.type === 'listening' || currentQuestion.type === 'error_identification' || currentQuestion.type === 'true_false_not_given' || currentQuestion.type === 'matching') {
      answerData = { selected: selectedAnswer, correct_answer: currentQuestion.correct };
    } else if (currentQuestion.type === 'write_email' || currentQuestion.type === 'write_academic_discussion' || currentQuestion.type === 'ielts_task1') {
      answerData = { text: writingText };
    } else if (currentQuestion.type === 'build_sentence') {
      answerData = { text: sentenceOrder.join(' ') };
    } else if (currentQuestion.type === 'complete_the_words') {
      const allCorrect = currentQuestion.blanks?.every((ans: string, i: number) =>
        (blankInputs[i] || '').trim().toLowerCase() === ans.trim().toLowerCase()
      ) || false;
      answerData = {
        blanks: blankInputs,
        correct: currentQuestion.answers,
        selected: allCorrect ? 'correct' : 'incorrect',
        correct_answer: 'correct',
      };
    } else if (currentQuestion.type === 'fill_blank') {
      answerData = { text: writingText };
    }

    saveAnswer(currentSection, currentQuestionIndex, answerData);

    const timeSpentSeconds = Math.round((Date.now() - questionStartTimeRef.current) / 1000);

    let saved = false;
    // Generate ONE idempotency key for this logical submission. All retries
    // within this loop reuse it, so if a prior POST actually persisted but
    // the response was lost (common on poor mobile), the server dedups
    // instead of creating a duplicate row. Matches the offline-sync queue
    // pattern. Server-side: migration 052 + tests.ts safeUuid check.
    const submitUuid =
      (typeof crypto !== 'undefined' && typeof (crypto as any).randomUUID === 'function')
        ? (crypto as any).randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;

    for (let retry = 0; retry < 3; retry++) {
      try {
        const response = await authedFetch(`/api/tests/attempt/${attemptId}/answer`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            section: currentSection,
            question_index: currentQuestionIndex,
            content_id: currentQuestion?.id || null,
            sub_question_index: currentQuestion?._subIndex ?? null,
            answer_data: answerData,
            time_spent_seconds: timeSpentSeconds,
            client_uuid: submitUuid,
          }),
        });

        if (response.ok) {
          saved = true;
          setSubmitError(null);
          setSubmitRetries(0);
          // Check for encouragement message (struggle detection, milestones)
          try {
            const resData = await response.json();
            if (resData.encouragement) {
              setEncouragement(resData.encouragement);
              setTimeout(() => setEncouragement(null), 8000); // Auto-dismiss after 8s
            }
          } catch { /* ignore parse error */ }
          break;
        }

        const data = await response.json().catch(() => ({}));
        if (data.code === 'LIMIT_REACHED') {
          navigate('/test?limit_reached=1');
          return;
        }

        // Show error but allow retry (only on first/second attempt)
        if (retry < 2) {
          await new Promise(r => setTimeout(r, 1000 + retry * 500)); // exponential backoff
          continue;
        }
      } catch (err) {
        if (retry < 2) {
          await new Promise(r => setTimeout(r, 1000 + retry * 500));
          continue;
        }
      }
    }

    if (!saved) {
      setSubmitError('Jawaban disimpan secara lokal. Akan disinkronkan saat online.');
      setSubmitRetries(prev => prev + 1);
      setSubmitting(false);

      // Allow advancing even if sync failed — we have local cache
      if (submitRetries >= 2) {
        // After 3 consecutive failures, allow proceeding but track pending answers
        console.log('[EduBot] Queuing answer for later sync');
        setTimeout(() => {
          advanceToNext();
        }, 500);
      }
      return;
    }

    // Types that have a definite correct answer and should show explanation
    const hasExplanation = currentQuestion.explanation &&
      !['listening_passage', 'write_email', 'write_academic_discussion', 'ielts_task1', 'listen_and_repeat', 'take_interview'].includes(currentQuestion.type);

    if (hasExplanation) {
      // Haptic feedback based on correctness
      const isCorrect = answerData.selected === answerData.correct_answer;
      isCorrect ? hapticCorrect() : hapticWrong();
      // Show explanation for 1.5s then advance
      setCurrentExplanation(currentQuestion.explanation || '');
      setShowExplanation(true);
      setTimeout(() => {
        setShowExplanation(false);
        advanceToNext();
      }, 1500);
    } else {
      advanceToNext();
    }

    function advanceToNext() {
      if (currentQuestionIndex + 1 < questions.length) {
        advanceWithTransition(() => setQuestionIndex(currentQuestionIndex + 1));
      } else {
        const currentIdx = sections.findIndex((s) => s.id === currentSection);
        // Guard: if currentSection isn't in the sections list (edge case: stale
        // state, dynamic section swap), findIndex returns -1 and the naive
        // `currentIdx + 1` check would jump back to sections[0] instead of
        // finishing. Treat "not found" as "past the end".
        if (currentIdx >= 0 && currentIdx + 1 < sections.length) {
          const nextSection = sections[currentIdx + 1].id;
          advanceWithTransition(() => setCurrentSection(nextSection));
          authedFetch(`/api/tests/attempt/${attemptId}/section/${nextSection}`, { method: 'POST' }).catch(() => {});
        } else {
          handleFinish();
        }
      }
    }
  }, [selectedAnswer, writingText, sentenceOrder, currentSection, currentQuestionIndex, questions, submitting, currentQuestion]);

  async function handleFinish() {
    hapticHeavy(); // Strong feedback on test completion
    // First, try to sync all pending answers if network is available
    if (networkAvailable && attemptId) {
      console.log('[EduBot] Syncing pending answers before finish...');
      await syncPendingAnswers(parseInt(attemptId));
    }

    // Retry up to 3 times to ensure the backend marks the test as completed
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const res = await authedFetch(`/api/tests/attempt/${attemptId}/finish`, { method: 'POST' });
        if (res.ok) {
          // Check for growth message
          try {
            const finishData = await res.json();
            if (finishData.growth_message) {
              // Store temporarily so TestResults can display it
              try { sessionStorage.setItem('edubot_growth_msg', finishData.growth_message); } catch {}
            }
          } catch { /* ignore */ }
          break;
        }
        // Wait before retry
        if (attempt < 2) await new Promise(r => setTimeout(r, 1000));
      } catch {
        if (attempt < 2) await new Promise(r => setTimeout(r, 1000));
      }
    }
    navigate(`/test/${attemptId}/results`);
  }

  function handleSectionExpire() {
    const currentIdx = sections.findIndex((s) => s.id === currentSection);
    // Same -1 guard as advanceToNext: unknown section → finish, don't wrap to 0.
    if (currentIdx >= 0 && currentIdx + 1 < sections.length) {
      setCurrentSection(sections[currentIdx + 1].id);
    } else {
      handleFinish();
    }
  }

  async function handleRecordingComplete(blob: Blob) {
    if (!currentSection || !currentQuestion) return;

    // Helper: only setState when still mounted. The evaluate() call can take
    // 10+ seconds (upload → Whisper → GPT scoring), and the user may have
    // navigated away mid-request.
    const safeSetResult = (v: any) => { if (isMountedRef.current) setSpeakingResult(v); };
    const safeSetLoading = (v: boolean) => { if (isMountedRef.current) setSpeakingLoading(v); };

    safeSetResult(null);
    safeSetLoading(true);

    try {
      // Pick a filename that matches the blob type so the server MIME whitelist
      // (audio/webm, audio/mp4, audio/ogg, etc.) accepts it. Safari on iOS records
      // as audio/mp4 — forcing .webm there would make the backend reject it.
      const blobType = (blob.type || 'audio/webm').toLowerCase();
      let filename = 'recording.webm';
      if (blobType.includes('mp4') || blobType.includes('m4a') || blobType.includes('aac')) filename = 'recording.mp4';
      else if (blobType.includes('ogg')) filename = 'recording.ogg';
      else if (blobType.includes('mpeg') || blobType.includes('mp3')) filename = 'recording.mp3';
      else if (blobType.includes('wav')) filename = 'recording.wav';

      // Upload audio + evaluate in one call
      const formData = new FormData();
      formData.append('audio', blob, filename);
      formData.append('prompt', currentQuestion.prompt || '');
      formData.append('question_type', currentQuestion.type || 'interview');

      const response = await authedFetch('/api/speaking/evaluate', {
        method: 'POST',
        body: formData,
      });

      // Parse JSON body even on error responses — the server ships useful
      // error context (e.g. PREMIUM_REQUIRED with an upgrade URL) that we must
      // surface to the user instead of a generic "Evaluasi gagal".
      let result: any = null;
      try { result = await response.json(); } catch { /* non-JSON error */ }

      if (response.ok && result) {
        safeSetResult(result);

        // Save answer with score (saveAnswer updates Zustand which survives
        // unmount, so it's fine to call regardless of mount state).
        saveAnswer(currentSection, currentQuestionIndex, {
          audio: true,
          transcription: result.transcription,
          score: result.score,
        });

        // Submit to backend
        try {
          // Speaking-only submit path has no retry loop (AudioRecorder
          // handles retry at audio-upload tier), but still benefit from
          // the idempotency key — if the server ACK'd but the client lost
          // connection, advancing forward won't double-count the score.
          const speakingUuid =
            (typeof crypto !== 'undefined' && typeof (crypto as any).randomUUID === 'function')
              ? (crypto as any).randomUUID()
              : `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
          const submitResp = await authedFetch(`/api/tests/attempt/${attemptId}/answer`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              section: currentSection,
              question_index: currentQuestionIndex,
              content_id: currentQuestion?.id || null,
              sub_question_index: currentQuestion?._subIndex ?? null,
              answer_data: { audio: true, transcription: result.transcription, score: result.score },
              client_uuid: speakingUuid,
            }),
          });

          if (!submitResp.ok) {
            try {
              const data = await submitResp.json();
              if (data.code === 'LIMIT_REACHED') {
                navigate('/test?limit_reached=1');
                return;
              }
            } catch {}
            console.error('Speaking answer submission failed:', submitResp.status);
          }
        } catch (err) {
          console.error('Speaking answer sync error:', err);
        }
      } else {
        // Build a useful error message from the server payload.
        const code = result?.code;
        const serverMsg = result?.message || result?.error;

        if (code === 'PREMIUM_REQUIRED') {
          safeSetResult({
            error: serverMsg || 'Speaking evaluation hanya untuk pengguna Premium. Upgrade untuk akses unlimited.',
            upgrade_url: result?.upgrade_url || 'https://t.me/OSEE_TOEFL_IELTS_TOEIC_study_bot?start=premium',
            premium_required: true,
          });
        } else if (response.status === 401) {
          safeSetResult({ error: 'Sesi login kamu sudah habis. Buka ulang mini app dari bot Telegram.' });
        } else if (response.status === 400 && serverMsg) {
          // Surface MIME / "no audio" messages directly
          safeSetResult({ error: serverMsg });
        } else {
          safeSetResult({
            error: serverMsg || `Evaluasi gagal (status ${response.status}). Coba rekam ulang.`,
          });
        }
      }
    } catch (e: any) {
      safeSetResult({ error: e?.message || 'Network error. Cek koneksi internet dan coba lagi.' });
    } finally {
      safeSetLoading(false);
    }
  }

  function advanceAfterSpeaking() {
    setSpeakingResult(null);
    if (currentQuestionIndex + 1 < questions.length) {
      setQuestionIndex(currentQuestionIndex + 1);
    } else {
      const currentIdx = sections.findIndex((s) => s.id === currentSection);
      // Same -1 guard: finish if currentSection isn't in the sections list.
      if (currentIdx >= 0 && currentIdx + 1 < sections.length) {
        setCurrentSection(sections[currentIdx + 1].id);
      } else {
        handleFinish();
      }
    }
  }

  if (!currentSection || questionsLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen p-4">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-tg-button mx-auto mb-4"></div>
          <p className="text-tg-hint">Memuat soal...</p>
        </div>
      </div>
    );
  }

  // Empty state: loading finished but we have no questions for this section.
  // This happens when the bank legitimately has no rows for this (test_type,
  // section, question_type) combo, or when an auth failure prevented prefetch.
  // Either way: don't silently show wrong-section content.
  if (!currentQuestion) {
    return (
      <div className="flex items-center justify-center min-h-screen p-4">
        <div className="text-center max-w-sm">
          <div className="text-4xl mb-4">📭</div>
          <h2 className="text-lg font-semibold mb-2">Belum ada soal</h2>
          <p className="text-sm text-tg-hint mb-4">
            Bagian <span className="capitalize font-medium">{currentSection}</span> belum
            memiliki soal yang bisa dimuat untuk tes ini. Coba bagian lain atau kembali
            ke daftar tes.
          </p>
          <button
            onClick={() => navigate('/test')}
            className="px-4 py-2 rounded-lg bg-tg-button text-tg-button-text text-sm font-medium"
          >
            Kembali ke daftar tes
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Encouragement toast */}
      {encouragement && (
        <div
          className="fixed top-2 left-2 right-2 z-50 p-3 rounded-lg bg-tg-secondary border border-tg-hint/20 text-tg-text text-sm shadow-lg animate-fade-in"
          style={{ animation: 'fadeIn 0.3s ease-out' }}
          onClick={() => setEncouragement(null)}
        >
          {encouragement}
        </div>
      )}

      {/* Pending sync banner — surfaces offline-queued answers so the
          student isn't left thinking their submission went through when
          it hasn't. Two visual states: warning (queued, retrying) and
          danger (some answers exhausted retries — need manual action). */}
      {pendingCount > 0 && (
        <div
          className={`fixed top-2 left-2 right-2 z-50 p-3 rounded-lg text-sm shadow-lg ${
            deadCount > 0
              ? 'bg-red-500/15 border border-red-500/40 text-red-600 dark:text-red-300'
              : 'bg-amber-500/15 border border-amber-500/40 text-amber-700 dark:text-amber-300'
          }`}
        >
          <div className="flex items-center justify-between gap-2">
            <p className="flex-1 leading-tight">
              {deadCount > 0
                ? `⚠️ ${deadCount} jawaban gagal tersinkron. Tekan "Coba kirim" atau cek koneksi internet.`
                : `📡 ${pendingCount} jawaban sedang menunggu terkirim…`}
            </p>
            <button
              type="button"
              onClick={handleManualResync}
              disabled={showSyncRetrying || !networkAvailable}
              className="text-xs px-2 py-1 rounded-lg bg-tg-button text-tg-button-text font-medium disabled:opacity-50 whitespace-nowrap"
            >
              {showSyncRetrying ? 'Mengirim…' : 'Coba kirim'}
            </button>
          </div>
          {!networkAvailable && (
            <p className="text-xs mt-1 opacity-80">Internet belum aktif. Akan dikirim otomatis saat online.</p>
          )}
        </div>
      )}

      {/* Header */}
      <div className="sticky top-0 bg-tg-bg border-b border-tg-secondary z-10 px-4 py-3">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-sm font-medium text-tg-button capitalize">{currentSection}</span>
            <span className="text-sm text-tg-hint ml-2">
              Q{currentQuestionIndex + 1}/{questions.length}
            </span>
            {!networkAvailable && (
              <span className="text-xs text-orange-500 ml-2">📴 Offline</span>
            )}
            {offlineMode && (
              <span className="text-xs text-blue-500 ml-2">💾 Cached</span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <ReportIssueButton
              contentId={currentQuestion?.id}
              attemptId={attemptId ? Number(attemptId) : null}
              compact
            />
            <Timer initialSeconds={sectionTimeSeconds} onExpire={handleSectionExpire} />
          </div>
        </div>
        <div className="flex gap-1 mt-2">
          {sections.map((s) => (
            <div
              key={s.id}
              className={`flex-1 h-1 rounded-full ${
                s.id === currentSection ? 'bg-tg-button'
                : sections.indexOf(s) < sections.findIndex((x) => x.id === currentSection) ? 'bg-green-400'
                : 'bg-tg-secondary'
              }`}
            />
          ))}
        </div>
      </div>

      {/* Content */}
      <div className={`flex-1 p-4 overflow-y-auto ${transitioning ? 'opacity-0' : 'opacity-100 animate-fadeIn'}`} style={{transition: 'opacity 0.15s ease'}}>
        {/* Listening passage — audio only, listen first */}
        {currentQuestion.type === 'listening_passage' && (
          <>
            {currentQuestion.group_name && (
              <p className="text-sm font-semibold text-tg-button mb-2">{currentQuestion.group_name}</p>
            )}
            {currentQuestion.instruction && (
              <p className="text-sm text-tg-hint mb-3">{currentQuestion.instruction}</p>
            )}
            {currentQuestion.audio_url ? (
              <div className="bg-tg-secondary rounded-xl p-6 mb-4 text-center">
                <p className="text-4xl mb-3">🎧</p>
                <p className="text-sm font-medium mb-4">Dengarkan audio berikut dengan seksama</p>
                {currentQuestion.passage && currentQuestion.passage.length > 4000 && (
                  <p className="text-xs text-orange-500 mb-2">⚠️ Audio panjang — bagian akhir mungkin terpotong</p>
                )}
                <AudioWithError src={currentQuestion.audio_url} className="w-full" onPlay={() => setAudioPlayed(true)} />
              </div>
            ) : (
              <div className="bg-tg-secondary rounded-xl p-4 mb-4">
                <p className="text-sm text-tg-hint mb-2">Audio tidak tersedia. Baca transkrip:</p>
                <div className="text-sm leading-relaxed whitespace-pre-line">
                  {currentQuestion.passage}
                </div>
              </div>
            )}
            {currentQuestion.passage && currentQuestion.audio_url && (
              <details className="mb-4">
                <summary className="text-sm text-tg-hint cursor-pointer">Lihat transkrip (untuk latihan)</summary>
                <div className="bg-tg-secondary rounded-lg p-3 mt-2 text-sm leading-relaxed whitespace-pre-line">
                  {currentQuestion.passage}
                </div>
              </details>
            )}
          </>
        )}

        {/* Listening question — after passage */}
        {currentQuestion.type === 'listening' && (
          <>
            {currentQuestion.instruction && (
              <p className="text-sm text-tg-hint mb-3">{currentQuestion.instruction}</p>
            )}
            {/* Photograph image (TOEIC Part 1) */}
            {currentQuestion.image_url && (
              <div className="mb-4">
                <img src={currentQuestion.image_url} alt="Question photograph" className="w-full rounded-lg border border-tg-secondary" />
              </div>
            )}
            {currentQuestion.audio_url ? (
              <div className="bg-tg-secondary rounded-xl p-4 mb-4">
                <p className="text-sm font-medium mb-2">🎧 Dengarkan:</p>
                <AudioWithError src={currentQuestion.audio_url} className="w-full" />
              </div>
            ) : (
              !currentQuestion.question || currentQuestion.question === '(Listen to the audio)' ? (
                <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3 mb-4 text-sm text-yellow-800">
                  📝 Audio belum tersedia untuk soal ini. Jawab berdasarkan pilihan yang ada.
                </div>
              ) : null
            )}
            {currentQuestion.question && currentQuestion.question !== '(Listen to the audio)' && (
              <p className="font-medium mb-4">{currentQuestion.question}</p>
            )}
          </>
        )}

        {/* Non-listening, non-writing types — show passage, instruction, audio, prompt, question.
            listen_and_repeat + take_interview render their own audio + prompt in the speaking
            block below (see line ~1967); including them here caused two failed-audio widgets
            to stack on top of each other for the IELTS Speaking flow. */}
        {currentQuestion.type !== 'listening' && currentQuestion.type !== 'listening_passage' && currentQuestion.type !== 'write_email' && currentQuestion.type !== 'write_academic_discussion' && currentQuestion.type !== 'ielts_task1' && currentQuestion.type !== 'fill_blank' && currentQuestion.type !== 'listen_and_repeat' && currentQuestion.type !== 'take_interview' && (
          <>
            {/* Image for IELTS graph/map/diagram questions */}
            {currentQuestion.image_url && (
              <div className="mb-4">
                <img src={currentQuestion.image_url} alt="Question image" className="w-full rounded-lg border border-tg-secondary" />
              </div>
            )}

            {currentQuestion.passage && (
              <div className="bg-tg-secondary rounded-lg p-4 mb-4 text-sm leading-relaxed whitespace-pre-line">
                {currentQuestion.passage}
              </div>
            )}

            {currentQuestion.instruction && (
              <p className="text-sm text-tg-hint mb-3">{currentQuestion.instruction}</p>
            )}

            {currentQuestion.audio_url && (
              <AudioWithError src={currentQuestion.audio_url} className="w-full mb-4" />
            )}

            {currentQuestion.prompt && (
              <div className="bg-tg-secondary rounded-lg p-4 mb-4">
                <p className="font-medium">{currentQuestion.prompt}</p>
              </div>
            )}

            {currentQuestion.question && (
              <p className="font-medium mb-4">{currentQuestion.question}</p>
            )}

            {/* Premium-only lock for IELTS Writing/Speaking tasks */}
            {currentQuestion.premium_only && (
              <div className="bg-gradient-to-r from-yellow-400/20 to-orange-500/20 border border-yellow-500/30 rounded-xl p-4 mb-4 text-center">
                <p className="text-2xl mb-1">🔒</p>
                <p className="font-semibold text-sm">Premium Content</p>
                <p className="text-xs text-tg-hint mt-1">Upgrade untuk akses soal ini</p>
                <a
                  href="https://t.me/OSEE_TOEFL_IELTS_TOEIC_study_bot?start=premium"
                  className="block mt-3 bg-yellow-500 text-black font-bold py-2 px-4 rounded-lg text-sm"
                >
                  ⭐ Upgrade Premium
                </a>
              </div>
            )}

            {/* IELTS True/False/Not Given */}
            {currentQuestion.type === 'true_false_not_given' && (
              <div className="space-y-2 mb-4">
                {['TRUE', 'FALSE', 'NOT GIVEN'].map((opt) => {
                  const letter = opt.charAt(0);
                  return (
                    <button
                      key={opt}
                      onClick={() => { hapticSelection(); setSelectedAnswer(letter); }}
                      className={`w-full text-left p-3 rounded-lg border-2 transition-colors ${
                        selectedAnswer === letter ? 'border-tg-button bg-tg-button/10' : 'border-tg-secondary bg-tg-secondary'
                      }`}
                    >
                      <span className="font-bold mr-2">{opt}</span>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Matching UI */}
            {currentQuestion.type === 'matching' && currentQuestion.options && (
              <div className="space-y-2 mb-4">
                {(shuffledOptions || currentQuestion.options).map((option: any, i: number) => {
                  const key = typeof option === 'string' ? option.charAt(0) : option.key;
                  const text = typeof option === 'string' ? option : option.text;
                  return (
                    <button
                      key={key || i}
                      onClick={() => { hapticSelection(); setSelectedAnswer(String(key)); }}
                      className={`w-full text-left p-3 rounded-lg border-2 transition-colors ${
                        selectedAnswer === String(key) ? 'border-tg-button bg-tg-button/10' : 'border-tg-secondary bg-tg-secondary'
                      }`}
                    >
                      <span className="font-bold mr-2">({key})</span>
                      <span className="text-sm">{text}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* Error Identification — sentence with labeled portions */}
        {currentQuestion.type === 'error_identification' && currentQuestion.portions && (
          <div className="mb-4">
            {/* Instruction is already rendered by the generic non-listening
                block above — don't render it again here or it shows twice
                (e.g. "Find the error." printed on two consecutive lines). */}
            {/* Full sentence */}
            <div className="bg-tg-secondary rounded-lg p-4 mb-4">
              <p className="text-sm leading-relaxed">{currentQuestion.sentence}</p>
            </div>
            {/* Tappable portion labels. When the portion text equals the
                key (e.g. the AI-generated schema where options are just
                labels "A"/"B"/"C"/"D" pointing back to inline markers in
                the sentence), suppress the duplicate text so the button
                shows "(A)" instead of the redundant "(A) A". */}
            <div className="grid grid-cols-2 gap-2">
              {currentQuestion.portions.map((portion: { key: string; text: string }) => {
                const isLabelOnly = !portion.text || portion.text.trim() === portion.key;
                return (
                  <button
                    key={portion.key}
                    onClick={() => { hapticSelection(); setSelectedAnswer(portion.key); }}
                    className={`text-left p-3 rounded-lg border-2 transition-colors ${
                      selectedAnswer === portion.key
                        ? 'border-tg-button bg-tg-button/10'
                        : 'border-tg-secondary bg-tg-secondary'
                    }`}
                  >
                    <span className="text-xs font-bold text-tg-button mr-1">({portion.key})</span>
                    {!isLabelOnly && <span className="text-sm">{portion.text}</span>}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Multiple choice (including listening) */}
        {currentQuestion.options && (currentQuestion.type === 'multiple_choice' || currentQuestion.type === 'listening') && (
          <div className="space-y-2 mb-4">
            {(shuffledOptions || currentQuestion.options).map((option: string, i: number) => {
              const letter = option.charAt(0);
              return (
                <button
                  key={i}
                  onClick={() => { hapticSelection(); setSelectedAnswer(letter); }}
                  className={`w-full text-left p-3 rounded-lg border-2 transition-colors ${
                    selectedAnswer === letter ? 'border-tg-button bg-tg-button/10' : 'border-tg-secondary bg-tg-secondary'
                  }`}
                >
                  {option}
                </button>
              );
            })}
          </div>
        )}

        {/* Complete the words — fill in missing letters */}
        {currentQuestion.type === 'complete_the_words' && currentQuestion.blanks && (
          <div className="mb-4">
            <p className="text-sm text-tg-hint mb-3">Isi huruf yang hilang untuk melengkapi kata:</p>
            <div className="space-y-2">
              {currentQuestion.blanks.map((answer: string, i: number) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="text-sm font-mono text-tg-hint w-8">{i + 1}.</span>
                  <input
                    type="text"
                    value={blankInputs[i] || ''}
                    onChange={(e) => {
                      const newInputs = [...blankInputs];
                      newInputs[i] = e.target.value;
                      setBlankInputs(newInputs);
                    }}
                    placeholder={'_'.repeat((answer || '').length)}
                    className="flex-1 p-2 rounded-lg border border-tg-secondary bg-tg-bg text-sm font-mono focus:outline-none focus:border-tg-button"
                    maxLength={(answer || '').length + 5}
                  />
                  <span className="text-xs text-tg-hint">{answer.length} huruf</span>
                  {blankInputs[i] && blankInputs[i].length >= answer.length && (
                    <span className={`text-sm ${blankInputs[i].trim().toLowerCase() === answer.trim().toLowerCase() ? 'text-green-500' : 'text-red-400'}`}>
                      {blankInputs[i].trim().toLowerCase() === answer.trim().toLowerCase() ? '✓' : '✗'}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Build sentence */}
        {currentQuestion.type === 'build_sentence' && (
          <div className="mb-4">
            <div className="bg-tg-secondary rounded-lg p-3 min-h-[48px] mb-3 flex flex-wrap gap-2">
              {sentenceOrder.map((word, i) => (
                <span key={i} onClick={() => setSentenceOrder(sentenceOrder.filter((_, idx) => idx !== i))}
                  className="bg-tg-button text-tg-button-text px-3 py-1 rounded-lg cursor-pointer text-sm">{word}</span>
              ))}
              {sentenceOrder.length === 0 && <span className="text-tg-hint text-sm">Tap kata di bawah untuk menyusun kalimat</span>}
            </div>
            <div className="flex flex-wrap gap-2">
              {(currentQuestion.words as string[]).filter((w: string) => !sentenceOrder.includes(w)).map((word: string, i: number) => (
                <button key={i} onClick={() => setSentenceOrder([...sentenceOrder, word])}
                  className="bg-tg-secondary px-3 py-1 rounded-lg text-sm border border-tg-hint/30">{word}</button>
              ))}
            </div>
          </div>
        )}

        {/* Writing — Redesigned with visual hierarchy */}
        {(currentQuestion.type === 'write_email' || currentQuestion.type === 'write_academic_discussion' || currentQuestion.type === 'ielts_task1') && (
          <div className="mb-4">

            {/* Task type badge + timer header */}
            <div className="flex items-center justify-between mb-3">
              <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${
                currentQuestion.type === 'write_email'
                  ? 'bg-green-100 text-green-700'
                  : currentQuestion.type === 'write_academic_discussion'
                  ? 'bg-purple-100 text-purple-700'
                  : currentQuestion.type === 'ielts_task1'
                  ? 'bg-blue-100 text-blue-700'
                  : 'bg-orange-100 text-orange-700'
              }`}>
                {currentQuestion.type === 'write_email' ? '✉️ Email Writing' :
                 currentQuestion.type === 'write_academic_discussion' ? '💬 Academic Discussion' :
                 currentQuestion.type === 'ielts_task1' ? '📊 IELTS Writing Task 1' :
                 '📝 Fill in the Blank'}
              </span>
              {currentQuestion.time_limit && (
                <span className="inline-flex items-center gap-1 text-xs text-tg-hint bg-tg-secondary px-2.5 py-1 rounded-full">
                  ⏱ {Math.floor(currentQuestion.time_limit / 60)} min
                </span>
              )}
            </div>

            {/* Audio for writing prompt */}
            {currentQuestion.audio_url && (
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-3 mb-3 border border-blue-100">
                <p className="text-xs text-blue-600 font-medium mb-2">🔊 Listen to the instructions:</p>
                <AudioWithError src={currentQuestion.audio_url} className="w-full" />
              </div>
            )}

            {/* Chart/graph image for IELTS Writing Task 1 */}
            {currentQuestion.image_url && (
              <div className="mb-4 rounded-xl overflow-hidden border border-gray-200 shadow-sm">
                <img src={currentQuestion.image_url} alt="Chart or diagram" className="w-full" loading="eager" />
              </div>
            )}

            {/* Context panels — professor, students, email scenario */}
            {currentQuestion.contexts?.length > 0 && (
              <div className="space-y-3 mb-4">
                {currentQuestion.contexts.map((ctx: any, i: number) => {
                  // Determine role styling
                  const label = ctx.label || (
                    currentQuestion.type === 'write_academic_discussion'
                      ? (i === 0 ? 'Professor' : `Student ${i}`)
                      : currentQuestion.type === 'write_email'
                      ? (i === 0 ? 'Scenario' : 'Context')
                      : `Reading Passage`
                  );
                  const isProf = label.toLowerCase().includes('professor') || label.toLowerCase().includes('dr.') || label.toLowerCase().includes('dr ');
                  const isStudent = label.toLowerCase().includes('student') || (!isProf && i > 0 && currentQuestion.type === 'write_academic_discussion');
                  const isReading = label.toLowerCase().includes('reading') || label.toLowerCase().includes('passage');
                  const isEmail = currentQuestion.type === 'write_email' && i === 0;

                  // Avatar emoji
                  const avatar = isProf ? '👨‍🏫' : isEmail ? '📧' : isReading ? '📖' : isStudent && i === 1 ? '🧑' : isStudent && i === 2 ? '👩' : '💬';

                  // Card colors
                  const cardStyle = isProf
                    ? 'bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200'
                    : isReading
                    ? 'bg-gradient-to-br from-amber-50 to-yellow-50 border-amber-200'
                    : isEmail
                    ? 'bg-gradient-to-br from-green-50 to-emerald-50 border-green-200'
                    : i === 1
                    ? 'bg-gradient-to-br from-violet-50 to-purple-50 border-violet-200'
                    : 'bg-gradient-to-br from-pink-50 to-rose-50 border-pink-200';

                  const labelColor = isProf ? 'text-blue-700' : isReading ? 'text-amber-700' : isEmail ? 'text-green-700' : i === 1 ? 'text-violet-700' : 'text-pink-700';

                  return (
                    <div key={i} className={`rounded-xl p-4 text-sm leading-relaxed border ${cardStyle}`}>
                      {/* Role header with avatar */}
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-lg">{avatar}</span>
                        <span className={`font-bold text-sm ${labelColor}`}>{label}</span>
                        {isProf && <span className="text-xs bg-blue-200 text-blue-800 px-1.5 py-0.5 rounded-full font-medium">Instructor</span>}
                      </div>
                      {/* Content with quotation styling for students */}
                      <div className={`text-gray-700 ${isStudent ? 'border-l-3 border-l-gray-300 pl-3 italic' : ''}`}
                        style={isStudent ? { borderLeftWidth: '3px' } : {}}>
                        <p className="whitespace-pre-line">{ctx.text}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Instruction prompt */}
            {currentQuestion.prompt && currentQuestion.prompt.length > 5 && (
              <div className="bg-gradient-to-r from-tg-secondary to-tg-bg rounded-xl p-4 mb-3 border border-tg-hint/20">
                <p className="text-xs font-bold text-tg-button mb-1.5">📋 Your Task:</p>
                <p className="text-sm text-gray-700 leading-relaxed">{currentQuestion.prompt}</p>
              </div>
            )}

            {/* Word count requirement hint */}
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg px-3 py-2 mb-3 flex items-center gap-2">
              <span className="text-yellow-600 text-sm">💡</span>
              <span className="text-xs text-yellow-700">
                {currentQuestion.type === 'write_email'
                  ? 'Write a complete email response. Use formal language and address all points.'
                  : currentQuestion.type === 'write_academic_discussion'
                  ? 'Write at least 100 words. Express your opinion and support it with reasons.'
                  : currentQuestion.type === 'ielts_task1'
                  ? 'Describe the chart/graph. Report main trends and make comparisons. Write at least 150 words.'
                  : 'Complete the text with appropriate words or phrases.'}
              </span>
            </div>

            {/* Writing area */}
            <div className="relative">
              <textarea value={writingText} onChange={(e) => setWritingText(e.target.value)}
                placeholder={
                  currentQuestion.type === 'write_email'
                    ? "Dear Professor...\n\nI am writing to..."
                    : currentQuestion.type === 'write_academic_discussion'
                    ? "I believe that... The main reason is..."
                    : currentQuestion.type === 'ielts_task1'
                    ? "The chart shows...\n\nOverall,..."
                    : "Type your answer here..."
                }
                className="w-full h-52 p-4 rounded-xl border-2 border-tg-secondary bg-white resize-none focus:outline-none focus:border-tg-button transition-colors text-sm leading-relaxed" />
              {/* Word counter bar */}
              {(() => {
                const wordCount = writingText.split(/\s+/).filter(Boolean).length;
                const target = currentQuestion.type === 'write_email' ? 175 : currentQuestion.type === 'ielts_task1' ? 150 : 100;
                const max = currentQuestion.type === 'write_email' ? 225 : currentQuestion.type === 'ielts_task1' ? 250 : 300;
                const progress = Math.min(100, (wordCount / target) * 100);
                const isOver = wordCount > max;
                return (
                  <div className="mt-2 px-1">
                    <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden mb-1.5">
                      <div className={`h-full rounded-full transition-all ${isOver ? 'bg-red-400' : progress >= 100 ? 'bg-green-400' : progress >= 60 ? 'bg-yellow-400' : 'bg-gray-400'}`}
                        style={{ width: `${Math.min(100, (wordCount / max) * 100)}%` }} />
                    </div>
                    <div className="flex items-center justify-between">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                        isOver ? 'bg-red-100 text-red-700'
                          : wordCount >= target ? 'bg-green-100 text-green-700'
                          : wordCount >= target * 0.5 ? 'bg-yellow-100 text-yellow-700'
                          : 'bg-gray-100 text-gray-500'
                      }`}>
                        {wordCount} kata
                        {wordCount >= target && !isOver && ' ✓'}
                        {isOver && ' (terlalu panjang)'}
                      </span>
                      <span className="text-xs text-tg-hint">
                        {currentQuestion.type === 'write_email'
                          ? 'Target: 150-200 kata'
                          : currentQuestion.type === 'write_academic_discussion'
                          ? 'Min: 100 kata'
                          : currentQuestion.type === 'ielts_task1'
                          ? 'Min: 150 kata'
                          : ''}
                      </span>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        )}

        {/* Fill in the blank — textarea */}
        {currentQuestion.type === 'fill_blank' && (
          <div className="mb-4">
            <textarea value={writingText} onChange={(e) => setWritingText(e.target.value)}
              placeholder="Type your answer here..."
              className="w-full h-32 p-3 rounded-lg border border-tg-secondary bg-tg-bg resize-none focus:outline-none focus:border-tg-button text-sm" />
            <div className="flex justify-between text-xs text-tg-hint mt-1">
              <span>{writingText.split(/\s+/).filter(Boolean).length} words</span>
            </div>
          </div>
        )}

        {/* Speaking — Listen and Repeat + Interview */}
        {(currentQuestion.type === 'listen_and_repeat' || currentQuestion.type === 'take_interview') && (
          <div className="mb-4">
            {currentQuestion.group_name && (
              <p className="text-sm font-semibold text-tg-button mb-2">{currentQuestion.group_name}</p>
            )}

            {/* Audio prompt. We pass the prompt text as fallbackText so when
                TTS fails (OpenAI outage, Telegram iOS webview quirks, etc.)
                the student can still read the sentence and record their
                attempt instead of being blocked. */}
            {currentQuestion.audio_url && !speakingResult && (
              <div className="bg-tg-secondary rounded-xl p-4 mb-4 text-center">
                <p className="text-3xl mb-2">{currentQuestion.type === 'listen_and_repeat' ? '🔊' : '🎙️'}</p>
                <p className="text-sm font-medium mb-3">
                  {currentQuestion.type === 'listen_and_repeat' ? 'Dengarkan kalimat ini:' : 'Dengarkan pertanyaan:'}
                </p>
                <AudioWithError
                  src={currentQuestion.audio_url}
                  className="w-full mb-3"
                  fallbackText={currentQuestion.prompt}
                />
              </div>
            )}

            {/* Text prompt (fallback or interview) */}
            {currentQuestion.prompt && !currentQuestion.audio_url && !speakingResult && (
              <div className="bg-tg-secondary rounded-xl p-4 mb-4">
                <p className="font-medium">{currentQuestion.prompt}</p>
              </div>
            )}

            {/* Recording + Loading */}
            {!speakingResult && !speakingLoading && (
              <>
                <p className="text-sm text-tg-hint text-center mb-2">
                  {currentQuestion.type === 'listen_and_repeat' ? 'Sekarang ulangi:' : 'Jawab secara spontan:'}
                </p>
                <AudioRecorder onRecordingComplete={handleRecordingComplete} />
              </>
            )}

            {speakingLoading && (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-tg-button mx-auto mb-3"></div>
                <p className="text-sm text-tg-hint">Menilai jawaban kamu...</p>
              </div>
            )}

            {/* Speaking Results */}
            {speakingResult && !speakingResult.error && (
              <div className="space-y-3">
                {/* Transcription */}
                <div className="bg-tg-secondary rounded-xl p-4">
                  <p className="text-xs text-tg-hint mb-1">Kamu bilang:</p>
                  <p className="text-sm italic">"{speakingResult.transcription}"</p>
                </div>

                {/* Score */}
                <div className="bg-tg-secondary rounded-xl p-4 text-center">
                  <p className="text-3xl font-bold" style={{
                    color: speakingResult.score >= 4 ? '#22c55e' : speakingResult.score >= 3 ? '#f59e0b' : '#ef4444'
                  }}>
                    Band {speakingResult.score}
                  </p>
                  {speakingResult.accuracy !== undefined && (
                    <p className="text-sm text-tg-hint">Akurasi kata: {speakingResult.accuracy}%</p>
                  )}
                </div>

                {/* Criteria scores */}
                {speakingResult.criteria && Object.keys(speakingResult.criteria).length > 0 && (
                  <div className="bg-tg-secondary rounded-xl p-3">
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      {Object.entries(speakingResult.criteria).map(([key, val]) => (
                        <div key={key} className="flex justify-between">
                          <span className="text-tg-hint capitalize">{key.replace(/_/g, ' ')}</span>
                          <span className="font-medium">{String(val)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Word results for Listen & Repeat */}
                {speakingResult.word_results && (
                  <div className="bg-tg-secondary rounded-xl p-3">
                    <p className="text-xs text-tg-hint mb-2">Kata per kata:</p>
                    <div className="flex flex-wrap gap-1">
                      {speakingResult.word_results.map((w: any, i: number) => (
                        <span key={i} className={`text-sm px-2 py-0.5 rounded ${
                          w.matched ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                        }`}>
                          {w.word}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Feedback */}
                {speakingResult.feedback && (
                  <div className="bg-tg-secondary border border-tg-hint/20 rounded-xl p-3">
                    <p className="text-sm text-tg-text">{speakingResult.feedback}</p>
                  </div>
                )}

                {/* Next button */}
                <button onClick={advanceAfterSpeaking}
                  className="w-full bg-tg-button text-tg-button-text py-3 rounded-xl font-medium">
                  Selanjutnya
                </button>
              </div>
            )}

            {/* Error */}
            {speakingResult?.error && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700">
                {speakingResult.premium_required ? '🔒 ' : ''}
                {speakingResult.error}
                {speakingResult.premium_required && speakingResult.upgrade_url && (
                  <a
                    href={speakingResult.upgrade_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block mt-3 px-4 py-2 rounded-lg bg-tg-button text-tg-button-text font-medium text-center"
                  >
                    Upgrade ke Premium
                  </a>
                )}
                <button
                  onClick={() => setSpeakingResult(null)}
                  className="block mt-2 text-tg-button"
                >
                  Coba lagi
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      {!['listen_and_repeat', 'take_interview'].includes(currentQuestion.type) && (
        <div className="sticky bottom-0 bg-tg-bg border-t border-tg-secondary p-4">
          {submitError && (
            <div className="bg-red-50 border border-red-300 rounded-xl p-3 mb-3 text-sm">
              <p className="font-medium text-red-700">⚠️ {submitError}</p>
              <p className="text-red-600 mt-1 text-xs">Tekan tombol di bawah untuk coba lagi.</p>
            </div>
          )}
          {showExplanation && currentExplanation && currentExplanation.trim().length > 5 && (
            <div className="bg-tg-secondary border border-tg-hint/20 rounded-xl p-3 mb-3 text-sm">
              <p className="font-medium text-tg-link mb-1">💡 Penjelasan:</p>
              <p className="text-tg-text leading-relaxed">{currentExplanation}</p>
            </div>
          )}
          <button onClick={handleSubmitAnswer} disabled={submitting || showExplanation}
            className={`w-full py-3 rounded-xl font-medium disabled:opacity-50 active:scale-95 transition-transform ${submitError ? 'bg-red-500 text-white' : 'bg-tg-button text-tg-button-text'}`}>
            {submitting ? 'Menyimpan...' : submitError ? 'Coba Lagi' : currentQuestion.type === 'listening_passage'
              ? 'Lanjut ke Soal'
              : currentQuestionIndex + 1 === questions.length
                ? sections.findIndex((s) => s.id === currentSection) + 1 === sections.length
                  ? 'Selesai'
                  : 'Section Berikutnya'
                : 'Selanjutnya'}
          </button>
        </div>
      )}
    </div>
  );
}
