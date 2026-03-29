import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTestStore } from '../stores/test';

interface QuestionCount {
  section: string;
  question_type: string;
  count: number;
}

const SECTION_INFO: Record<string, { icon: string; name: string; color: string; desc: string }> = {
  reading: { icon: '📖', name: 'Reading', color: 'bg-blue-500', desc: 'Passages, vocabulary, comprehension' },
  listening: { icon: '🎧', name: 'Listening', color: 'bg-green-500', desc: 'Conversations, lectures, announcements' },
  speaking: { icon: '🗣', name: 'Speaking', color: 'bg-orange-500', desc: 'Repeat, interview responses' },
  writing: { icon: '✍️', name: 'Writing', color: 'bg-purple-500', desc: 'Emails, academic discussions, sentences' },
};

const QUESTION_TYPE_LABELS: Record<string, string> = {
  complete_the_words: 'Complete the Words',
  read_in_daily_life: 'Read in Daily Life',
  read_academic_passage: 'Academic Passage',
  listen_choose_response: 'Choose Response',
  listen_conversation: 'Conversation',
  listen_announcement: 'Announcement',
  listen_academic_talk: 'Academic Talk',
  listen_and_repeat: 'Listen & Repeat',
  take_interview: 'Take an Interview',
  build_sentence: 'Build a Sentence',
  write_email: 'Write an Email',
  write_academic_discussion: 'Academic Discussion',
};

export default function TestSelection() {
  const [counts, setCounts] = useState<QuestionCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<'menu' | 'full_test' | 'section'>('menu');
  const [selectedSection, setSelectedSection] = useState<string | null>(null);
  const [testType, setTestType] = useState<string>('TOEFL_IBT');
  const navigate = useNavigate();
  const { startTest } = useTestStore();

  useEffect(() => {
    loadCounts();
  }, [testType]);

  async function loadCounts() {
    try {
      const response = await fetch(`/api/tests/question-counts?test_type=${testType}`);
      if (response.ok) {
        setCounts(await response.json());
      }
    } catch {}
    setLoading(false);
  }

  function getSectionCounts(section: string) {
    return counts.filter((c) => c.section === section);
  }

  function getTotalForSection(section: string) {
    return getSectionCounts(section).reduce((sum, c) => sum + c.count, 0);
  }

  async function handleStartFullTest() {
    setStarting('full');
    setError(null);
    try {
      const response = await fetch('/api/tests/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ test_type: testType }),
      });
      if (!response.ok) {
        setError('Gagal memulai tes');
        return;
      }
      const data = await response.json();
      startTest(data.attempt_id, data.test_type, data.sections, data.current_section);
      navigate(`/test/${data.attempt_id}`);
    } catch {
      setError('Network error');
    } finally {
      setStarting(null);
    }
  }

  async function handleStartSection(section: string, questionType?: string) {
    setStarting(section + (questionType || ''));
    setError(null);
    try {
      const response = await fetch('/api/tests/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          test_type: testType,
          section_only: section,
          question_type: questionType || undefined,
        }),
      });
      if (!response.ok) {
        setError('Gagal memulai latihan');
        return;
      }
      const data = await response.json();
      startTest(data.attempt_id, data.test_type, data.sections, data.current_section, data.question_type);
      navigate(`/test/${data.attempt_id}`);
    } catch {
      setError('Network error');
    } finally {
      setStarting(null);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-tg-button"></div>
      </div>
    );
  }

  // Section detail view
  if (selectedSection) {
    const info = SECTION_INFO[selectedSection];
    const sectionCounts = getSectionCounts(selectedSection);

    return (
      <div className="p-4 max-w-lg mx-auto">
        <button onClick={() => setSelectedSection(null)} className="text-tg-button text-sm mb-4">
          &larr; Kembali
        </button>

        <div className="flex items-center gap-3 mb-4">
          <span className="text-3xl">{info.icon}</span>
          <div>
            <h1 className="text-2xl font-bold">{info.name}</h1>
            <p className="text-tg-hint text-sm">{info.desc}</p>
          </div>
        </div>

        <p className="text-sm text-tg-hint mb-4">
          {getTotalForSection(selectedSection)} soal tersedia
        </p>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4 text-sm text-red-700">{error}</div>
        )}

        {/* Practice all in this section */}
        <button
          onClick={() => handleStartSection(selectedSection)}
          disabled={!!starting}
          className="w-full bg-tg-button text-tg-button-text py-3 rounded-xl font-medium mb-4 disabled:opacity-50"
        >
          {starting === selectedSection ? 'Memulai...' : `Latihan Semua ${info.name} (10 soal acak)`}
        </button>

        {/* By question type */}
        <h2 className="font-semibold text-sm text-tg-hint mb-2">Pilih Tipe Soal:</h2>
        <div className="space-y-2">
          {sectionCounts.map((qc) => (
            <button
              key={qc.question_type}
              onClick={() => handleStartSection(selectedSection, qc.question_type)}
              disabled={!!starting}
              className="w-full bg-tg-secondary rounded-xl p-3 flex items-center justify-between disabled:opacity-50"
            >
              <div className="text-left">
                <p className="font-medium text-sm">
                  {QUESTION_TYPE_LABELS[qc.question_type] || qc.question_type}
                </p>
                <p className="text-xs text-tg-hint">{qc.count} soal</p>
              </div>
              <span className="text-tg-button text-sm">
                {starting === selectedSection + qc.question_type ? '...' : 'Mulai'}
              </span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  // Main menu
  return (
    <div className="p-4 max-w-lg mx-auto">
      {/* Test Type Selector */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => { setTestType('TOEFL_IBT'); setSelectedSection(null); }}
          className={`flex-1 py-2 rounded-lg font-medium text-sm ${testType === 'TOEFL_IBT' ? 'bg-tg-button text-tg-button-text' : 'bg-tg-secondary text-tg-text'}`}
        >
          🇺🇸 TOEFL iBT
        </button>
        <button
          onClick={() => { setTestType('IELTS'); setSelectedSection(null); }}
          className={`flex-1 py-2 rounded-lg font-medium text-sm ${testType === 'IELTS' ? 'bg-tg-button text-tg-button-text' : 'bg-tg-secondary text-tg-text'}`}
        >
          🇬🇧 IELTS
        </button>
      </div>

      <h1 className="text-2xl font-bold mb-1">{testType === 'IELTS' ? 'IELTS Academic' : 'TOEFL iBT 2026'}</h1>
      <p className="text-tg-hint text-sm mb-6">Pilih mode latihan</p>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4 text-sm text-red-700">{error}</div>
      )}

      {/* Full test */}
      <div className="bg-gradient-to-r from-tg-button/10 to-tg-button/5 rounded-xl p-4 mb-6">
        <h2 className="text-lg font-semibold mb-1">Simulasi Tes Lengkap</h2>
        <p className="text-tg-hint text-sm mb-3">
          {testType === 'IELTS' ? '4 section, 170 menit' : '4 section, 90 menit'} — simulasi kondisi tes
        </p>
        <div className="flex flex-wrap gap-2 mb-3">
          {(testType === 'IELTS'
            ? ['Listening (30m)', 'Reading (60m)', 'Writing (60m)', 'Speaking (14m)']
            : ['Reading (30m)', 'Listening (29m)', 'Speaking (8m)', 'Writing (23m)']
          ).map((s) => (
            <span key={s} className="text-xs bg-tg-bg px-2 py-1 rounded-full">{s}</span>
          ))}
        </div>
        <button
          onClick={handleStartFullTest}
          disabled={!!starting}
          className="w-full bg-tg-button text-tg-button-text py-3 rounded-xl font-medium disabled:opacity-50"
        >
          {starting === 'full' ? 'Memulai...' : 'Mulai Tes Lengkap'}
        </button>
      </div>

      {/* Section practice */}
      <h2 className="font-semibold mb-3">Latihan Per Section</h2>
      <div className="space-y-3">
        {Object.entries(SECTION_INFO).map(([id, info]) => {
          const total = getTotalForSection(id);
          const typeCount = getSectionCounts(id).length;
          return (
            <button
              key={id}
              onClick={() => setSelectedSection(id)}
              className="w-full bg-tg-secondary rounded-xl p-4 flex items-center gap-3 text-left"
            >
              <span className="text-2xl">{info.icon}</span>
              <div className="flex-1">
                <p className="font-semibold">{info.name}</p>
                <p className="text-xs text-tg-hint">{info.desc}</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-medium text-tg-button">{total}</p>
                <p className="text-xs text-tg-hint">{typeCount} tipe</p>
              </div>
            </button>
          );
        })}
      </div>

      {/* Quick stats */}
      <div className="mt-6 text-center text-sm text-tg-hint">
        Total: {counts.reduce((s, c) => s + c.count, 0)} soal dari database OSEE
      </div>
    </div>
  );
}
