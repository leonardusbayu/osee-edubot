import { useEffect, useState, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTestStore } from '../stores/test';
import Timer from '../components/Timer';
import AudioRecorder from '../components/AudioRecorder';

function stripHtml(str: string): string {
  if (!str) return '';
  return str.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim();
}

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
    try {
      const qType = useTestStore.getState().questionType;
      const url = `/api/tests/questions/${currentSection}?limit=10${qType ? '&question_type=' + qType : ''}`;
      const response = await fetch(url);
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

    if (type === 'complete_the_words') {
      // Transform {{letters}} into blanks: "dama{{ges}}" → "dama___"
      const rawPassage = c.passage_text || '';
      const blanks: string[] = [];
      const displayPassage = rawPassage.replace(/\{\{([^}]+)\}\}/g, (_: string, letters: string) => {
        blanks.push(letters);
        return '_'.repeat(Math.max(letters.length, 3));
      });
      return {
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
        type: 'error_identification',
        instruction: stripHtml(c.direction || 'Find the error in this sentence.'),
        sentence: stripHtml(c.question_text || ''),
        portions: (c.options || []).map((o: any) => ({ key: o.key, text: stripHtml(o.text || '') })),
        correct: (c.answers?.[0] || '').toUpperCase(),
        explanation: stripHtml(c.explanation || ''),
      };
    }

    if (['read_in_daily_life', 'read_academic_passage'].includes(type)) {
      return {
        type: 'multiple_choice',
        passage: c.passage_text || '',
        question: c.question_text || '',
        options: getOptions(c),
        correct: (c.answers?.[0] || '').toUpperCase(),
        explanation: c.explanation || '',
      };
    }

    if (['listen_choose_response', 'listen_conversation', 'listen_announcement', 'listen_academic_talk'].includes(type)) {
      // NEW: Grouped listening — c has passage_script + questions array
      if (c.type === 'grouped_listening' && c.questions?.length > 0) {
        const passageScript = stripHtml(c.passage_script || '');
        const ttsUrl = passageScript.length > 10
          ? `/api/tts/speak?multi=true&text=${encodeURIComponent(passageScript.substring(0, 4000))}`
          : null;

        const items: any[] = [];

        // First item: listen to the passage
        items.push({
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
            qAudioUrl = `/api/tts/speak?multi=true&text=${encodeURIComponent(qScript.substring(0, 2000))}`;
          }

          items.push({
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
        ? `/api/tts/speak?multi=true&text=${encodeURIComponent(audioText.substring(0, 2000))}`
        : null;

      let options = getOptions(c);
      if (options.length < 2 && c.options?.length > 0 && c.options[0]?.key) {
        options = c.options.map((o: any) => `${o.key}. ${o.text || ''}`);
      }

      return {
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
            ? `/api/tts/speak?multi=true&text=${encodeURIComponent(script.substring(0, 2000))}`
            : null;

          if (type === 'listen_and_repeat') {
            items.push({
              type: 'listen_and_repeat',
              instruction: stripHtml(c.direction || 'Listen and repeat the sentence.'),
              prompt: script,
              audio_url: ttsUrl,
              group_name: stripHtml(c.group_name || ''),
            });
          } else {
            items.push({
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
        type,
        instruction: stripHtml(c.direction || ''),
        prompt,
        audio_url: prompt.length > 0
          ? `/api/tts/speak?multi=true&text=${encodeURIComponent(prompt.substring(0, 2000))}`
          : null,
      };
    }

    if (type === 'build_sentence' || type === 'write_email' || type === 'write_academic_discussion') {
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
              type: 'build_sentence',
              instruction: stripHtml(c.direction || 'Susun kata menjadi kalimat yang tepat.'),
              passage: passage.replace(/\{\{[^}]+\}\}/g, '____'),  // Show blanks
              words: [...words].sort(() => Math.random() - 0.5),
              correct: correctSentence,
            });
          } else if (type === 'write_email') {
            const prompt = stripHtml(sq.passage || sq.question_text || '');
            const contexts = (sq.illustrated_passages || []).map((ip: any) => ({
              text: stripHtml(ip.text || ''),
              label: stripHtml(ip.label || ''),
            }));
            // Generate audio for the scenario
            const scenarioAudio = prompt.length > 10
              ? `/api/tts/speak?voice=alloy&text=${encodeURIComponent(prompt.substring(0, 2000))}`
              : null;
            items.push({
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
              ? `/api/tts/speak?multi=true&text=${encodeURIComponent(contexts[0].text.substring(0, 2000))}`
              : null;
            items.push({
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
          type: 'build_sentence',
          instruction: stripHtml(c.direction || 'Arrange the words correctly.'),
          words: words.length > 1 ? words.sort(() => Math.random() - 0.5) : ['arrange', 'these', 'words'],
          correct: words.join(' '),
        };
      }
      return {
        type,
        instruction: stripHtml(c.direction || ''),
        prompt: stripHtml(c.question_text || c.passage_text || 'Write your response.'),
        time_limit: type === 'write_email' ? 420 : 600,
      };
    }

    // Default: multiple choice
    return {
      type: 'multiple_choice',
      question: c.question_text || 'Question',
      options: c.options?.length > 0 ? c.options : ['A', 'B', 'C', 'D'],
      correct: c.answers?.[0] || '',
      passage: c.passage_text || '',
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
  }, [currentQuestionIndex, currentSection]);

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
      return;
    }

    if (currentQuestion.type === 'multiple_choice' || currentQuestion.type === 'listening' || currentQuestion.type === 'error_identification') {
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

    try {
      const response = await fetch(`/api/tests/attempt/${attemptId}/answer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          section: currentSection,
          question_index: currentQuestionIndex,
          answer_data: answerData,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        if (data.code === 'LIMIT_REACHED') {
          navigate('/test?limit_reached=1');
          return;
        }
      }
    } catch {}

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
          try {
            const response = fetch(`/api/tests/attempt/${attemptId}/section/${nextSection}`, { method: 'POST' });
          } catch {}
        } else {
          handleFinish();
        }
      }
    }
  }, [selectedAnswer, writingText, sentenceOrder, currentSection, currentQuestionIndex, questions, submitting, currentQuestion]);

  async function handleFinish() {
    try { await fetch(`/api/tests/attempt/${attemptId}/finish`, { method: 'POST' }); } catch {}
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

      const response = await fetch('/api/speaking/evaluate', {
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
          const response = await fetch(`/api/tests/attempt/${attemptId}/answer`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              section: currentSection,
              question_index: currentQuestionIndex,
              answer_data: { audio: true, transcription: result.transcription, score: result.score },
            }),
          });

          if (!response.ok) {
            const data = await response.json();
            if (data.code === 'LIMIT_REACHED') {
              navigate('/test?limit_reached=1');
              return;
            }
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

  if (!currentSection || !currentQuestion) {
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
                <audio controls src={currentQuestion.audio_url} className="w-full" />
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
                <audio controls src={currentQuestion.audio_url} className="w-full" />
              </div>
            )}
            {currentQuestion.question && (
              <p className="font-medium mb-4">{currentQuestion.question}</p>
            )}
          </>
        )}

        {/* Non-listening types — show passage, instruction, audio, prompt, question */}
        {currentQuestion.type !== 'listening' && currentQuestion.type !== 'listening_passage' && (
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
              <audio controls src={currentQuestion.audio_url} className="w-full mb-4" />
            )}

            {currentQuestion.prompt && (
              <div className="bg-tg-secondary rounded-lg p-4 mb-4">
                <p className="font-medium">{currentQuestion.prompt}</p>
              </div>
            )}

            {currentQuestion.question && (
              <p className="font-medium mb-4">{currentQuestion.question}</p>
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
                    placeholder={'_'.repeat(answer.length)}
                    className="flex-1 p-2 rounded-lg border border-tg-secondary bg-tg-bg text-sm font-mono focus:outline-none focus:border-tg-button"
                    maxLength={answer.length + 5}
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

        {/* Writing */}
        {(currentQuestion.type === 'write_email' || currentQuestion.type === 'write_academic_discussion' || currentQuestion.type === 'fill_blank') && (
          <div className="mb-4">
            {/* Audio for writing prompt */}
            {currentQuestion.audio_url && (
              <div className="bg-tg-secondary rounded-xl p-3 mb-3">
                <p className="text-xs text-tg-hint mb-2">🔊 Dengarkan instruksi:</p>
                <audio controls src={currentQuestion.audio_url} className="w-full" />
              </div>
            )}
            {/* Context panels — professor's lecture, student opinions, email scenario */}
            {currentQuestion.contexts?.length > 0 && (
              <div className="space-y-3 mb-4">
                {currentQuestion.contexts.map((ctx: any, i: number) => (
                  <div key={i} className={`rounded-lg p-3 text-sm leading-relaxed text-gray-800 ${
                    i === 0 ? 'bg-blue-50 border border-blue-200' :
                    'bg-gray-50 border border-gray-200'
                  }`}>
                    {ctx.label && (
                      <p className="text-xs font-semibold text-tg-hint mb-1">{ctx.label}</p>
                    )}
                    {!ctx.label && i === 0 && currentQuestion.type === 'write_academic_discussion' && (
                      <p className="text-xs font-semibold text-blue-600 mb-1">Professor</p>
                    )}
                    {!ctx.label && i > 0 && currentQuestion.type === 'write_academic_discussion' && (
                      <p className="text-xs font-semibold text-gray-500 mb-1">Student {i}</p>
                    )}
                    {!ctx.label && currentQuestion.type === 'write_email' && (
                      <p className="text-xs font-semibold text-blue-600 mb-1">{i === 0 ? 'Email Template' : 'Context'}</p>
                    )}
                    <p className="whitespace-pre-line">{ctx.text}</p>
                  </div>
                ))}
              </div>
            )}

            <textarea value={writingText} onChange={(e) => setWritingText(e.target.value)}
              placeholder="Tulis jawaban kamu di sini..."
              className="w-full h-48 p-3 rounded-lg border border-tg-secondary bg-tg-bg resize-none focus:outline-none focus:border-tg-button" />
            <div className="flex justify-between text-sm text-tg-hint mt-1">
              <span>{writingText.split(/\s+/).filter(Boolean).length} kata</span>
              {currentQuestion.time_limit && (
                <span>Maks {Math.floor(currentQuestion.time_limit / 60)} menit</span>
              )}
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
                <audio controls src={currentQuestion.audio_url} className="w-full mb-3" />
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
