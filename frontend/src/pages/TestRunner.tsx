import { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTestStore } from '../stores/test';
import { authedFetch } from '../api/authedFetch';
import Timer from '../components/Timer';
import AudioRecorder from '../components/AudioRecorder';

const API_URL = (import.meta.env.VITE_API_URL as string) || 'https://edubot-api.edubot-leonardus.workers.dev/api';

function stripHtml(str: string): string {
  if (!str) return '';
  return str.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim();
}

const AudioWithError = ({ src, className }: { src: string; className?: string }) => {
  const [err, setErr] = useState(false);
  if (!src) return null;
  if (err) {
    return (
      <div className="bg-tg-secondary rounded-lg p-3 text-sm text-tg-hint">
        Audio tidak dapat diputar — coba refresh halaman
      </div>
    );
  }
  return (
    <audio
      controls
      src={src}
      className={className}
      onError={() => setErr(true)}
    />
  );
};

export default function TestRunner() {
  const { attemptId } = useParams<{ attemptId: string }>();
  const navigate = useNavigate();
  const {
    sections, currentSection, currentQuestionIndex,
    setCurrentSection, setQuestionIndex, saveAnswer, answers,
  } = useTestStore();

  const [questions, setQuestions] = useState<any[]>([]);
  const [sectionTimeSeconds, setSectionTimeSeconds] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [writingText, setWritingText] = useState('');
  const [sentenceOrder, setSentenceOrder] = useState<string[]>([]);
  const [blankInputs, setBlankInputs] = useState<string[]>([]);
  const [speakingResult, setSpeakingResult] = useState<any>(null);
  const [speakingLoading, setSpeakingLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [transitioning, setTransitioning] = useState(false);
  const [showExplanation, setShowExplanation] = useState(false);
  const [currentExplanation, setCurrentExplanation] = useState('');
  const [audioLoadError, setAudioLoadError] = useState(false);
  const [questionsLoading, setQuestionsLoading] = useState(false);
  const [sessionId, setSessionId] = useState<number | null>(null);
  const questionStartTimeRef = useRef<number>(Date.now());

  const currentQuestion = questions[currentQuestionIndex];
  const currentSectionInfo = sections.find((s) => s.id === currentSection);

  // Load questions for current section from stored test data
  useEffect(() => {
    const stored = useTestStore.getState();
    if (stored.attemptId && currentSection) {
      // Questions were stored when test was started
      loadSectionQuestions();
    }
  }, [currentSection]);

  async function loadSectionQuestions() {
    setQuestionsLoading(true);
    try {
      const qType = useTestStore.getState().questionType;
      const url = `/api/tests/questions/${currentSection}?limit=10${qType ? '&question_type=' + qType : ''}`;
      const response = await authedFetch(url);
      if (response.ok) {
        const data = await response.json();
        const allQuestions: any[] = [];

        for (const q of data.questions) {
          const mapped = mapQuestion(q);
          if (mapped?._grouped) {
            // Flatten grouped listening: passage + questions
            allQuestions.push(...mapped.items);
          } else if (mapped) {
            allQuestions.push(mapped);
          }
        }

        setQuestions(allQuestions.length > 0 ? allQuestions : getFallbackQuestions());
      } else {
        setQuestions(getFallbackQuestions());
      }
    } catch {
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
        ? `${API_URL}/tts/speak?multi=true&text=${encodeURIComponent(passageScript.substring(0, 4000))}`
        : null;

      const items: any[] = [];

      // First item: listen to the passage
      items.push({
        id: q.id,
        type: 'listening_passage',
        instruction: stripHtml(c.direction || 'Listen to the audio.'),
        passage: passageScript,
        audio_url: ttsUrl,
        group_name: stripHtml(c.group_name || ''),
      });

      // Then each question
      for (const sq of c.questions) {
        const opts = (sq.options || []).map((o: any) => `${o.key}. ${stripHtml(o.text || '')}`);

        // Some questions have their own audio (e.g., per-question scripts)
        let qAudioUrl = null;
        const qScript = stripHtml(sq.script || '');
        if (qScript.length > 10) {
          qAudioUrl = `${API_URL}/tts/speak?multi=true&text=${encodeURIComponent(qScript.substring(0, 2000))}`;
        }

        // Determine if it's fill-in-blank (no options) or multiple choice
        if (opts.length >= 2) {
          items.push({
            id: q.id,
            type: 'listening',
            instruction: '',
            question: stripHtml(sq.question_text || ''),
            options: opts,
            correct: (sq.answers?.[0] || '').toUpperCase(),
            explanation: stripHtml(sq.explanation || ''),
            audio_url: qAudioUrl,
          });
        } else {
          // Fill-in-blank listening (e.g., IELTS Section 1 note completion)
          items.push({
            id: q.id,
            type: 'fill_blank',
            instruction: stripHtml(c.direction || 'Complete the notes.'),
            question: stripHtml(sq.question_text || ''),
            correct: sq.answers?.[0] || '',
            explanation: stripHtml(sq.explanation || ''),
            audio_url: qAudioUrl,
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
      for (const sq of c.questions) {
        const opts = (sq.options || []).map((o: any) => `${o.key}. ${stripHtml(o.text || '')}`);
        items.push({
          id: q.id,
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
        for (const sq of c.questions) {
          const opts = (sq.options || []).map((o: any) => `${o.key}. ${stripHtml(o.text || '')}`);
          items.push({
            id: q.id,
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
      // Grouped error identification — flatten into individual questions
      if (c.type === 'grouped_reading' && c.questions?.length > 0) {
        const items: any[] = [];
        for (const sq of c.questions) {
          const opts = (sq.options || []).map((o: any) => ({ key: o.key, text: stripHtml(o.text || '') }));
          items.push({
            id: q.id,
            type: 'error_identification',
            instruction: stripHtml(c.direction || 'Find the error in this sentence.'),
            sentence: stripHtml(sq.question_text || ''),
            portions: opts,
            correct: (sq.answers?.[0] || '').toUpperCase(),
            explanation: stripHtml(sq.explanation || ''),
          });
        }
        return items.length === 1 ? items[0] : { _grouped: true, items };
      }
      // Fallback single question
      return {
        id: q.id,
        type: 'error_identification',
        instruction: stripHtml(c.direction || 'Find the error in this sentence.'),
        sentence: stripHtml(c.question_text || ''),
        portions: (c.options || []).map((o: any) => ({ key: o.key, text: stripHtml(o.text || '') })),
        correct: (c.answers?.[0] || '').toUpperCase(),
        explanation: stripHtml(c.explanation || ''),
      };
    }

    if (['read_in_daily_life', 'read_academic_passage'].includes(type)) {
      const passageText = c.passage_text || '';
      const audioUrl = passageText.length > 10 && passageText.length <= 2000
        ? `${API_URL}/tts/speak?text=${encodeURIComponent(passageText.substring(0, 2000))}`
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
          ? `${API_URL}/tts/speak?multi=true&text=${encodeURIComponent(passageScript.substring(0, 4000))}`
          : null;

        const items: any[] = [];

        // First item: listen to the passage
        items.push({
          id: q.id,
          type: 'listening_passage',
          instruction: stripHtml(c.direction || 'Listen to the audio.'),
          passage: passageScript,
          audio_url: ttsUrl,
          group_name: stripHtml(c.group_name || ''),
        });

        // Then each question
        for (const sq of c.questions) {
          const opts = (sq.options || []).map((o: any) => `${o.key}. ${stripHtml(o.text || '')}`);
          let qAudioUrl = null;
          const qScript = stripHtml(sq.script || '');
          if (qScript.length > 10) {
            qAudioUrl = `${API_URL}/tts/speak?multi=true&text=${encodeURIComponent(qScript.substring(0, 2000))}`;
          }

          items.push({
            id: q.id,
            type: 'listening',
            instruction: '',
            question: stripHtml(sq.question_text || ''),
            options: opts.length >= 2 ? opts : getOptions(sq),
            correct: (sq.answers?.[0] || '').toUpperCase(),
            explanation: stripHtml(sq.explanation || ''),
            audio_url: qAudioUrl,
          });
        }

        return { _grouped: true, items };
      }

      // Fallback: old single-question format
      const audioText = c.passage_text || c.passage_script || '';
      const ttsUrl = audioText.length > 10
        ? `${API_URL}/tts/speak?multi=true&text=${encodeURIComponent(audioText.substring(0, 2000))}`
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

        for (const sq of c.questions) {
          const script = stripHtml(sq.script || '');
          const ttsUrl = script.length > 3
            ? `${API_URL}/tts/speak?multi=true&text=${encodeURIComponent(script.substring(0, 2000))}`
            : null;

          if (type === 'listen_and_repeat') {
            items.push({
              id: q.id,
              type: 'listen_and_repeat',
              instruction: stripHtml(c.direction || 'Listen and repeat the sentence.'),
              prompt: script,
              audio_url: ttsUrl,
              group_name: stripHtml(c.group_name || ''),
            });
          } else {
            items.push({
              id: q.id,
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
          ? `${API_URL}/tts/speak?multi=true&text=${encodeURIComponent(prompt.substring(0, 2000))}`
          : null,
      };
    }

    if (type === 'build_sentence' || type === 'write_email' || type === 'write_academic_discussion' || type === 'integrated_writing') {
      // Grouped writing
      if (c.type === 'grouped_writing' && c.questions?.length > 0) {
        const items: any[] = [];
        for (const sq of c.questions) {
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
              ? `${API_URL}/tts/speak?voice=alloy&text=${encodeURIComponent(prompt.substring(0, 2000))}`
              : null;
            items.push({
              id: q.id,
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
              ? `${API_URL}/tts/speak?multi=true&text=${encodeURIComponent(contexts[0].text.substring(0, 2000))}`
              : null;
            items.push({
              id: q.id,
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
      const contexts = (c.illustrated_passages || []).map((ip: any) => ({
        text: stripHtml(ip.text || ''),
        label: stripHtml(ip.label || ''),
        image_url: ip.image_url || null,
      }));
      return {
        id: q.id,
        type: 'write_email',
        instruction: stripHtml(c.direction || 'Describe the chart in at least 150 words.'),
        passage: c.passage_text || '',
        contexts,
        prompt: c.question_text || 'Describe the chart below.',
        time_limit: 600,
        model_answer: stripHtml(c.model_answer || ''),
        premium_only: true,
      };
    }

    // IELTS Writing Task 2 (essay)
    if (type === 'task2') {
      return {
        id: q.id,
        type: 'write_academic_discussion',
        instruction: stripHtml(c.direction || 'Write an essay of at least 250 words addressing the topic below.'),
        passage: c.passage_text || '',
        prompt: c.question_text || '',
        contexts: [],
        time_limit: 1200,
        model_answer: stripHtml(c.model_answer || ''),
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
          ? `${API_URL}/tts/speak?text=${encodeURIComponent(script.substring(0, 2000))}`
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

  function getFallbackQuestions() {
    return [{
      type: 'multiple_choice',
      passage: 'The development of writing systems represents one of humanity\'s greatest achievements.',
      question: 'What does the passage discuss?',
      options: ['A. Writing systems', 'B. Mathematics', 'C. Agriculture', 'D. Art'],
      correct: 'A',
    }];
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
    questionStartTimeRef.current = Date.now();
  }, [currentQuestionIndex, currentSection]);

  // Start session on mount
  useEffect(() => {
    let activeSessionId: number | null = null;
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
        }
      } catch {}
    })();
    return () => {
      if (activeSessionId) {
        authedFetch('/api/analytics/session/end', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ session_id: activeSessionId, questions_answered: currentQuestionIndex }),
        }).catch(() => {});
      }
    };
  }, []);

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

    let answerData: any = {};

    const advanceWithTransition = (fn: () => void) => {
      setTransitioning(true);
      setTimeout(() => { fn(); setTransitioning(false); }, 150);
    };

    // Listening passage — just advance, no answer to save
    if (currentQuestion.type === 'listening_passage') {
      if (currentQuestionIndex + 1 < questions.length) {
        advanceWithTransition(() => setQuestionIndex(currentQuestionIndex + 1));
      }
      setSubmitting(false);
      return;
    }

    if (currentQuestion.type === 'multiple_choice' || currentQuestion.type === 'listening' || currentQuestion.type === 'error_identification' || currentQuestion.type === 'true_false_not_given' || currentQuestion.type === 'matching') {
      answerData = { selected: selectedAnswer, correct_answer: currentQuestion.correct };
    } else if (currentQuestion.type === 'write_email' || currentQuestion.type === 'write_academic_discussion') {
      answerData = { text: writingText };
    } else if (currentQuestion.type === 'build_sentence') {
      answerData = { text: sentenceOrder.join(' ') };
    } else if (currentQuestion.type === 'complete_the_words') {
      answerData = { blanks: blankInputs, correct: currentQuestion.answers };
    } else if (currentQuestion.type === 'fill_blank') {
      answerData = { text: writingText };
    }

    saveAnswer(currentSection, currentQuestionIndex, answerData);

    const timeSpentSeconds = Math.round((Date.now() - questionStartTimeRef.current) / 1000);

    try {
      const response = await authedFetch(`/api/tests/attempt/${attemptId}/answer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          section: currentSection,
          question_index: currentQuestionIndex,
          content_id: currentQuestion?.id || null,
          answer_data: answerData,
          time_spent_seconds: timeSpentSeconds,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        if (data.code === 'LIMIT_REACHED') {
          navigate('/test?limit_reached=1');
          return;
        }
        console.error('Answer submission failed:', response.status);
      }
    } catch (err) {
      console.error('Answer submission error:', err);
    }

    // Types that have a definite correct answer and should show explanation
    const hasExplanation = currentQuestion.explanation &&
      !['listening_passage', 'write_email', 'write_academic_discussion', 'listen_and_repeat', 'take_interview'].includes(currentQuestion.type);

    if (hasExplanation) {
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
        if (currentIdx + 1 < sections.length) {
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
    // Retry up to 3 times to ensure the backend marks the test as completed
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const res = await authedFetch(`/api/tests/attempt/${attemptId}/finish`, { method: 'POST' });
        if (res.ok) break;
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
    if (currentIdx + 1 < sections.length) {
      setCurrentSection(sections[currentIdx + 1].id);
    } else {
      handleFinish();
    }
  }

  async function handleRecordingComplete(blob: Blob) {
    if (!currentSection || !currentQuestion) return;

    setSpeakingResult(null);
    setSpeakingLoading(true);

    try {
      // Upload audio + evaluate in one call
      const formData = new FormData();
      formData.append('audio', blob, 'recording.webm');
      formData.append('prompt', currentQuestion.prompt || '');
      formData.append('question_type', currentQuestion.type || 'interview');

      const response = await authedFetch('/api/speaking/evaluate', {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        const result = await response.json();
        setSpeakingResult(result);

        // Save answer with score
        saveAnswer(currentSection, currentQuestionIndex, {
          audio: true,
          transcription: result.transcription,
          score: result.score,
        });

        // Submit to backend
        try {
          const response = await authedFetch(`/api/tests/attempt/${attemptId}/answer`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              section: currentSection,
              question_index: currentQuestionIndex,
              content_id: currentQuestion?.id || null,
              answer_data: { audio: true, transcription: result.transcription, score: result.score },
            }),
          });

          if (!response.ok) {
            const data = await response.json();
            if (data.code === 'LIMIT_REACHED') {
              navigate('/test?limit_reached=1');
              return;
            }
            console.error('Speaking answer submission failed:', response.status);
          }
        } catch {}
      } else {
        setSpeakingResult({ error: 'Evaluasi gagal. Coba lagi.' });
      }
    } catch (e: any) {
      setSpeakingResult({ error: e.message || 'Network error' });
    } finally {
      setSpeakingLoading(false);
    }
  }

  function advanceAfterSpeaking() {
    setSpeakingResult(null);
    if (currentQuestionIndex + 1 < questions.length) {
      setQuestionIndex(currentQuestionIndex + 1);
    } else {
      const currentIdx = sections.findIndex((s) => s.id === currentSection);
      if (currentIdx + 1 < sections.length) {
        setCurrentSection(sections[currentIdx + 1].id);
      } else {
        handleFinish();
      }
    }
  }

  if (!currentSection || !currentQuestion || questionsLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen p-4">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-tg-button mx-auto mb-4"></div>
          <p className="text-tg-hint">Memuat soal...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <div className="sticky top-0 bg-tg-bg border-b border-tg-secondary z-10 px-4 py-3">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-sm font-medium text-tg-button capitalize">{currentSection}</span>
            <span className="text-sm text-tg-hint ml-2">
              Q{currentQuestionIndex + 1}/{questions.length}
            </span>
          </div>
          <Timer initialSeconds={sectionTimeSeconds} onExpire={handleSectionExpire} />
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
                <AudioWithError src={currentQuestion.audio_url} className="w-full" />
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
            {currentQuestion.audio_url && (
              <div className="bg-tg-secondary rounded-xl p-4 mb-4">
                <p className="text-sm font-medium mb-2">🎧 Dengarkan:</p>
                <AudioWithError src={currentQuestion.audio_url} className="w-full" />
              </div>
            )}
            {currentQuestion.question && (
              <p className="font-medium mb-4">{currentQuestion.question}</p>
            )}
          </>
        )}

        {/* Non-listening, non-writing types — show passage, instruction, audio, prompt, question */}
        {currentQuestion.type !== 'listening' && currentQuestion.type !== 'listening_passage' && currentQuestion.type !== 'write_email' && currentQuestion.type !== 'write_academic_discussion' && currentQuestion.type !== 'fill_blank' && (
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
                      onClick={() => setSelectedAnswer(letter)}
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
                {currentQuestion.options.map((option: any, i: number) => {
                  const key = typeof option === 'string' ? option.charAt(0) : option.key;
                  const text = typeof option === 'string' ? option : option.text;
                  return (
                    <button
                      key={key || i}
                      onClick={() => setSelectedAnswer(String(key))}
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
            {currentQuestion.instruction && (
              <p className="text-sm text-tg-hint mb-3">{currentQuestion.instruction}</p>
            )}
            {/* Full sentence */}
            <div className="bg-tg-secondary rounded-lg p-4 mb-4">
              <p className="text-sm leading-relaxed">{currentQuestion.sentence}</p>
            </div>
            {/* Tappable portion labels */}
            <div className="grid grid-cols-2 gap-2">
              {currentQuestion.portions.map((portion: { key: string; text: string }) => (
                <button
                  key={portion.key}
                  onClick={() => setSelectedAnswer(portion.key)}
                  className={`text-left p-3 rounded-lg border-2 transition-colors ${
                    selectedAnswer === portion.key
                      ? 'border-tg-button bg-tg-button/10'
                      : 'border-tg-secondary bg-tg-secondary'
                  }`}
                >
                  <span className="text-xs font-bold text-tg-button mr-1">({portion.key})</span>
                  <span className="text-sm">{portion.text}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Multiple choice (including listening) */}
        {currentQuestion.options && (currentQuestion.type === 'multiple_choice' || currentQuestion.type === 'listening') && (
          <div className="space-y-2 mb-4">
            {currentQuestion.options.map((option: string, i: number) => {
              const letter = option.charAt(0);
              return (
                <button
                  key={i}
                  onClick={() => setSelectedAnswer(letter)}
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
        {(currentQuestion.type === 'write_email' || currentQuestion.type === 'write_academic_discussion') && (
          <div className="mb-4">

            {/* Task type badge + timer header */}
            <div className="flex items-center justify-between mb-3">
              <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${
                currentQuestion.type === 'write_email'
                  ? 'bg-green-100 text-green-700'
                  : currentQuestion.type === 'write_academic_discussion'
                  ? 'bg-purple-100 text-purple-700'
                  : 'bg-orange-100 text-orange-700'
              }`}>
                {currentQuestion.type === 'write_email' ? '✉️ Email Writing' :
                 currentQuestion.type === 'write_academic_discussion' ? '💬 Academic Discussion' :
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
                    : "Type your answer here..."
                }
                className="w-full h-52 p-4 rounded-xl border-2 border-tg-secondary bg-white resize-none focus:outline-none focus:border-tg-button transition-colors text-sm leading-relaxed" />
              {/* Word counter bar */}
              <div className="flex items-center justify-between mt-2 px-1">
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                    writingText.split(/\s+/).filter(Boolean).length >= 100
                      ? 'bg-green-100 text-green-700'
                      : writingText.split(/\s+/).filter(Boolean).length >= 50
                      ? 'bg-yellow-100 text-yellow-700'
                      : 'bg-gray-100 text-gray-500'
                  }`}>
                    {writingText.split(/\s+/).filter(Boolean).length} words
                  </span>
                  {writingText.split(/\s+/).filter(Boolean).length >= 100 && (
                    <span className="text-xs text-green-600">✓ Minimum reached</span>
                  )}
                </div>
                <span className="text-xs text-tg-hint">
                  {currentQuestion.type === 'write_email' ? 'Target: 150-200 words' :
                   currentQuestion.type === 'write_academic_discussion' ? 'Min: 100 words' : ''}
                </span>
              </div>
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

            {/* Audio prompt */}
            {currentQuestion.audio_url && !speakingResult && (
              <div className="bg-tg-secondary rounded-xl p-4 mb-4 text-center">
                <p className="text-3xl mb-2">{currentQuestion.type === 'listen_and_repeat' ? '🔊' : '🎙️'}</p>
                <p className="text-sm font-medium mb-3">
                  {currentQuestion.type === 'listen_and_repeat' ? 'Dengarkan kalimat ini:' : 'Dengarkan pertanyaan:'}
                </p>
                <AudioWithError src={currentQuestion.audio_url} className="w-full mb-3" />
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
                  <div className="bg-blue-50 border border-blue-200 rounded-xl p-3">
                    <p className="text-sm">{speakingResult.feedback}</p>
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
                {speakingResult.error}
                <button onClick={() => setSpeakingResult(null)} className="block mt-2 text-tg-button">Coba lagi</button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      {!['listen_and_repeat', 'take_interview'].includes(currentQuestion.type) && (
        <div className="sticky bottom-0 bg-tg-bg border-t border-tg-secondary p-4">
          {showExplanation && currentExplanation && currentExplanation.trim().length > 5 && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 mb-3 text-sm">
              <p className="font-medium text-blue-700 mb-1">💡 Penjelasan:</p>
              <p className="text-blue-800 leading-relaxed">{currentExplanation}</p>
            </div>
          )}
          <button onClick={handleSubmitAnswer} disabled={submitting || showExplanation}
            className="w-full bg-tg-button text-tg-button-text py-3 rounded-xl font-medium disabled:opacity-50 active:scale-95 transition-transform">
            {currentQuestion.type === 'listening_passage'
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
