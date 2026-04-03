import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTestStore } from '../stores/test';
import { authedFetch } from '../api/authedFetch';

interface QuotaInfo {
  allowed: boolean;
  is_premium: boolean;
  daily_limit: number;
  used_today: number;
  bonus_quota: number;
  remaining: number;
  reset_at: string;
}

interface QuestionCount {
  section: string;
  question_type: string;
  count: number;
}

interface TestInfo {
  test_type: string;
  display_name: string;
  description: string;
  total_duration_minutes: number;
  sections: { id: string; name: string; duration_minutes: number }[];
}

interface AvailableResponse {
  tests: TestInfo[];
  quota: QuotaInfo | null;
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
  const [tests, setTests] = useState<TestInfo[]>([]);
  const [counts, setCounts] = useState<QuestionCount[]>([]);
  const [quota, setQuota] = useState<QuotaInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<'menu' | 'full_test' | 'section'>('menu');
  const [selectedSection, setSelectedSection] = useState<string | null>(null);
  const [testType, setTestType] = useState<string>('TOEFL_IBT');
  const navigate = useNavigate();
  const { startTest } = useTestStore();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    loadData();
  }, [testType]);

  useEffect(() => {
    if (searchParams.get('limit_reached') === '1') {
      setError('Batas harian tercapai! Upgrade ke premium untuk akses unlimited.');
    }
  }, [searchParams]);

  async function loadData() {
    setLoading(true);
    try {
      const [testsRes, countsRes] = await Promise.all([
        authedFetch('/api/tests/available'),
        authedFetch(`/api/tests/question-counts?test_type=${testType}`),
      ]);

      if (testsRes.ok) {
        const data: AvailableResponse = await testsRes.json();
        setTests(data.tests || []);
        if (data.quota) {
          setQuota(data.quota);
        }
      }
      if (countsRes.ok) {
        setCounts(await countsRes.json());
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
      const response = await authedFetch('/api/tests/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ test_type: testType }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (data.code === 'LIMIT_REACHED') {
          setError('Batas harian tercapai! Upgrade ke premium untuk akses unlimited.');
          setQuota(data.quota);
        } else {
          setError(data.error || 'Gagal memulai tes');
        }
        return;
      }

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
      const response = await authedFetch('/api/tests/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          test_type: testType,
          section_only: section,
          question_type: questionType || undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (data.code === 'LIMIT_REACHED') {
          setError('Batas harian tercapai! Upgrade ke premium untuk akses unlimited.');
          setQuota(data.quota);
        } else {
          setError(data.error || 'Gagal memulai latihan');
        }
        return;
      }

      startTest(data.attempt_id, data.test_type, data.sections, data.current_section, data.question_type);
      navigate(`/test/${data.attempt_id}`);
    } catch {
      setError('Network error');
    } finally {
      setStarting(null);
    }
  }

  function formatResetTime(isoString: string): string {
    if (!isoString) return '00:00 WIB';
    const d = new Date(isoString);
    const wib = new Date(d.getTime() + 7 * 60 * 60 * 1000);
    return `${wib.getHours().toString().padStart(2, '0')}:${wib.getMinutes().toString().padStart(2, '0')} WIB`;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-tg-button"></div>
      </div>
    );
  }

  // Show locked screen if quota exceeded
  if (quota && !quota.allowed && !quota.is_premium) {
    return (
      <div className="p-4 max-w-lg mx-auto">
        <div className="text-center mb-8 mt-8">
          <div className="text-6xl mb-4">🔒</div>
          <h1 className="text-2xl font-bold mb-2">Mini App Premium</h1>
          <p className="text-tg-hint">Akses unlimited ke semua soal latihan</p>
        </div>

        <div className="bg-tg-secondary rounded-xl p-4 mb-6">
          <h2 className="font-semibold mb-3">📊 Quota Hari Ini</h2>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-tg-hint">Soal digunakan</span>
              <span className="font-medium">{quota.used_today}/{quota.daily_limit}</span>
            </div>
            {quota.bonus_quota > 0 && (
              <div className="flex justify-between">
                <span className="text-tg-hint">Bonus referral</span>
                <span className="font-medium text-green-500">+{quota.bonus_quota}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-tg-hint">Reset</span>
              <span className="font-medium">{formatResetTime(quota.reset_at)}</span>
            </div>
          </div>
          <div className="mt-3 bg-tg-bg rounded-full h-2">
            <div
              className="bg-tg-button rounded-full h-2 transition-all"
              style={{ width: `${Math.min(100, (quota.used_today / quota.daily_limit) * 100)}%` }}
            />
          </div>
        </div>

        <div className="space-y-3 mb-6">
          <a
            href="https://t.me/OSEE_TOEFL_IELTS_TOEIC_study_bot?start=premium"
            className="block w-full bg-gradient-to-r from-yellow-400 to-orange-500 text-black font-bold py-4 rounded-xl text-center"
          >
            ⭐ Upgrade Premium
          </a>
          <button
            onClick={() => navigate('/referral')}
            className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-3 rounded-xl text-center"
          >
            🎁 Undang Teman — Dapat Bonus Soal
          </button>
        </div>

        <div className="text-center text-sm text-tg-hint">
          <p>Premium = Akses unlimited + AI Tutor + Speaking Practice</p>
          <p className="mt-1">Mulai dari Rp 99.000/bulan</p>
        </div>
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
          ← Kembali
        </button>

        <div className="flex items-center gap-3 mb-4">
          <span className="text-3xl">{info.icon}</span>
          <div>
            <h1 className="text-2xl font-bold">{info.name}</h1>
            <p className="text-tg-hint text-sm">{info.desc}</p>
          </div>
        </div>

        {quota && !quota.is_premium && (
          <div className="bg-tg-secondary rounded-lg p-3 mb-4 text-sm">
            <span className="text-tg-hint">Sisa harian: </span>
            <span className="font-semibold text-tg-button">{quota.remaining} soal</span>
            {quota.bonus_quota > 0 && (
              <span className="text-green-500 ml-2">+{quota.bonus_quota} bonus</span>
            )}
          </div>
        )}

        <p className="text-sm text-tg-hint mb-4">
          {getTotalForSection(selectedSection)} soal tersedia
        </p>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4 text-sm text-red-700">{error}</div>
        )}

        <button
          onClick={() => handleStartSection(selectedSection)}
          disabled={!!starting}
          className="w-full bg-tg-button text-tg-button-text py-3 rounded-xl font-medium mb-4 disabled:opacity-50"
        >
          {starting === selectedSection ? 'Memulai...' : `Latihan Semua ${info.name} (10 soal acak)`}
        </button>

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
      {quota && !quota.is_premium && (
        <div className="bg-gradient-to-r from-tg-button/20 to-yellow-500/10 rounded-xl p-3 mb-4 border border-tg-button/20">
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm font-medium">📊 Quota Hari Ini</span>
            <span className="text-sm font-semibold text-tg-button">
              {quota.remaining}/{quota.daily_limit} soal
            </span>
          </div>
          <div className="bg-tg-bg rounded-full h-2">
            <div
              className="bg-tg-button rounded-full h-2 transition-all"
              style={{ width: `${Math.min(100, (quota.used_today / quota.daily_limit) * 100)}%` }}
            />
          </div>
          {quota.bonus_quota > 0 && (
            <p className="text-xs text-green-500 mt-1">🎁 Bonus: +{quota.bonus_quota} soal dari referral</p>
          )}
        </div>
      )}

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
        <button
          onClick={() => { setTestType('TOEIC'); setSelectedSection(null); }}
          className={`flex-1 py-2 rounded-lg font-medium text-sm ${testType === 'TOEFL_ITP' ? 'bg-tg-button text-tg-button-text' : 'bg-tg-secondary text-tg-text'}`}
        >
          🏢 TOEIC
        </button>
      </div>
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => { setTestType('TOEFL_ITP'); setSelectedSection(null); }}
          className={`flex-1 py-2 rounded-lg font-medium text-sm ${testType === 'TOEFL_ITP' ? 'bg-tg-button text-tg-button-text' : 'bg-tg-secondary text-tg-text'}`}
        >
          📋 TOEFL ITP
        </button>
      </div>

      <h1 className="text-2xl font-bold mb-1">{
        testType === 'IELTS' ? 'IELTS Academic' :
        testType === 'TOEIC' ? 'TOEIC L&R' :
        testType === 'TOEFL_ITP' ? 'TOEFL ITP' :
        'TOEFL iBT 2026'
      }</h1>
      <p className="text-tg-hint text-sm mb-6">Pilih mode latihan</p>

      {quota?.is_premium && (
        <div className="bg-gradient-to-r from-yellow-400/20 to-orange-500/20 border border-yellow-500/30 rounded-xl p-3 mb-4 text-sm">
          👑 <span className="font-semibold">Premium Access</span> — Unlimited soal & fitur
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4 text-sm text-red-700">{error}</div>
      )}

      <div className="bg-gradient-to-r from-tg-button/10 to-tg-button/5 rounded-xl p-4 mb-6">
        <h2 className="text-lg font-semibold mb-1">Simulasi Tes Lengkap</h2>
        <p className="text-tg-hint text-sm mb-3">
          {testType === 'IELTS' ? '4 section, 170 menit' :
           testType === 'TOEIC' ? '2 section, 120 menit' :
           testType === 'TOEFL_ITP' ? '3 section, 115 menit' :
           '4 section, 90 menit'} — simulasi kondisi tes
        </p>
        <div className="flex flex-wrap gap-2 mb-3">
          {(testType === 'IELTS'
            ? ['Listening (30m)', 'Reading (60m)', 'Writing (60m)', 'Speaking (14m)']
              : testType === 'TOEIC'
              ? ['Listening (45m)', 'Reading (75m)']
              : testType === 'TOEFL_ITP'
              ? ['Listening (35m)', 'Structure (25m)', 'Reading (55m)']
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

      <div className="mt-6 text-center text-sm text-tg-hint">
        Total: {counts.reduce((s, c) => s + c.count, 0)} soal dari database OSEE
      </div>
    </div>
  );
}