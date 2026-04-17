import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTestStore } from '../stores/test';
import { authedFetch } from '../api/authedFetch';

interface SkillIRT {
  theta: number;
  se: number;
  ibt_estimate?: number;
  cefr?: string;
}

interface SkillLearningCurve {
  current_accuracy: number;
  projected_accuracy: number;
  sessions: number;
}

interface SkillRecent {
  questions_done: number;
  correct: number;
  accuracy: number;
  last_practiced: string | null;
}

interface SkillCard {
  id: string;
  name: string;
  icon: string;
  description: string;
  question_count: number;
  duration_minutes: number;
  available_questions: number;
  irt: SkillIRT | null;
  learning_curve: SkillLearningCurve | null;
  recent: SkillRecent | null;
  is_recommended: boolean;
}

interface SkillPracticeConfig {
  test_type: string;
  skills: SkillCard[];
  recommended: { skill: string; reason: string } | null;
  quota: {
    allowed: boolean;
    is_premium: boolean;
    remaining: number;
    daily_limit: number;
    used_today: number;
  } | null;
}

interface PracticeSession {
  attempt_id: number;
  skill: string;
  started_at: string;
  finished_at: string;
  total_questions: number;
  correct: number;
  wrong: number;
  accuracy: number;
  avg_time_seconds: number | null;
}

const SKILL_COLORS: Record<string, string> = {
  reading: 'from-blue-500 to-blue-600',
  listening: 'from-green-500 to-green-600',
  speaking: 'from-orange-500 to-orange-600',
  writing: 'from-purple-500 to-purple-600',
  structure: 'from-yellow-500 to-yellow-600',
};

const SKILL_BG: Record<string, string> = {
  reading: 'bg-blue-500/10 border-blue-500/20',
  listening: 'bg-green-500/10 border-green-500/20',
  speaking: 'bg-orange-500/10 border-orange-500/20',
  writing: 'bg-purple-500/10 border-purple-500/20',
  structure: 'bg-yellow-500/10 border-yellow-500/20',
};

function ThetaBar({ theta, label }: { theta: number; label?: string }) {
  // theta ranges from -3 to +3, map to 0-100%
  const pct = Math.max(0, Math.min(100, ((theta + 3) / 6) * 100));
  const color = theta >= 1 ? 'bg-green-500' : theta >= 0 ? 'bg-blue-500' : theta >= -1 ? 'bg-yellow-500' : 'bg-red-500';
  return (
    <div className="w-full">
      {label && <div className="text-xs text-tg-hint mb-1">{label}</div>}
      <div className="h-2 bg-tg-secondary rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function formatTimeAgo(isoString: string | null): string {
  if (!isoString) return 'Belum pernah';
  const diff = Date.now() - new Date(isoString).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins} menit lalu`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} jam lalu`;
  const days = Math.floor(hours / 24);
  return `${days} hari lalu`;
}

export default function SkillPractice() {
  const [config, setConfig] = useState<SkillPracticeConfig | null>(null);
  const [history, setHistory] = useState<PracticeSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [testType, setTestType] = useState('TOEFL_IBT');
  const [showHistory, setShowHistory] = useState(false);
  const navigate = useNavigate();
  const { startTest } = useTestStore();

  useEffect(() => {
    loadConfig();
  }, [testType]);

  async function loadConfig() {
    setLoading(true);
    setError(null);
    try {
      const [configRes, historyRes] = await Promise.all([
        authedFetch(`/api/tests/skill-practice/config?test_type=${testType}`),
        authedFetch(`/api/tests/skill-practice/history?test_type=${testType}&limit=10`),
      ]);

      if (configRes.ok) {
        setConfig(await configRes.json());
      } else {
        setError('Gagal memuat konfigurasi');
      }

      if (historyRes.ok) {
        const data = await historyRes.json();
        setHistory(data.sessions || []);
      }
    } catch {
      setError('Kesalahan jaringan');
    }
    setLoading(false);
  }

  async function handleStartPractice(skill: string) {
    setStarting(skill);
    setError(null);
    try {
      const response = await authedFetch('/api/tests/skill-practice/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ test_type: testType, skill }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (data.code === 'LIMIT_REACHED') {
          setError('Batas harian tercapai! Upgrade ke premium untuk akses unlimited.');
        } else {
          setError(data.error || 'Gagal memulai latihan');
        }
        return;
      }

      startTest(data.attempt_id, data.test_type, data.sections, data.current_section);
      navigate(`/test/${data.attempt_id}`);
    } catch {
      setError('Kesalahan jaringan');
    } finally {
      setStarting(null);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-tg-button mx-auto mb-3"></div>
          <p className="text-tg-hint text-sm">Memuat skill practice...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 max-w-lg mx-auto pb-20">
      {/* Header */}
      <div className="flex items-center gap-2 mb-1">
        <button onClick={() => navigate('/')} className="text-tg-button text-sm">← Kembali</button>
      </div>
      <h1 className="text-2xl font-bold mb-1">Skill Practice</h1>
      <p className="text-tg-hint text-sm mb-4">Latihan fokus per skill — 15-20 menit per sesi</p>

      {/* Test Type Selector */}
      <div className="flex gap-2 mb-4 overflow-x-auto">
        {['TOEFL_IBT', 'IELTS', 'TOEIC', 'TOEFL_ITP'].map((tt) => (
          <button
            key={tt}
            onClick={() => setTestType(tt)}
            className={`whitespace-nowrap px-3 py-1.5 rounded-lg text-sm font-medium ${
              testType === tt ? 'bg-tg-button text-tg-button-text' : 'bg-tg-secondary text-tg-text'
            }`}
          >
            {tt === 'TOEFL_IBT' ? '🇺🇸 iBT' : tt === 'IELTS' ? '🇬🇧 IELTS' : tt === 'TOEIC' ? '🏢 TOEIC' : '📋 ITP'}
          </button>
        ))}
      </div>

      {/* Quota */}
      {config?.quota && !config.quota.is_premium && (
        <div className="bg-tg-secondary rounded-xl p-3 mb-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-tg-hint">Sisa harian</span>
            <span className="font-semibold text-tg-button">{config.quota.remaining}/{config.quota.daily_limit}</span>
          </div>
          <div className="mt-2 bg-tg-bg rounded-full h-1.5">
            <div
              className="bg-tg-button rounded-full h-1.5 transition-all"
              style={{ width: `${Math.min(100, config.quota.daily_limit > 0 ? (config.quota.used_today / config.quota.daily_limit) * 100 : 0)}%` }}
            />
          </div>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4 text-sm text-red-700">{error}</div>
      )}

      {/* Recommendation Banner */}
      {config?.recommended && (
        <div className="bg-gradient-to-r from-tg-button/15 to-yellow-500/10 border border-tg-button/25 rounded-xl p-4 mb-4">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-lg">🎯</span>
            <span className="font-semibold text-sm">Rekomendasi AI</span>
          </div>
          <p className="text-sm text-tg-hint mb-2">{config.recommended.reason}</p>
          <button
            onClick={() => handleStartPractice(config.recommended!.skill)}
            disabled={!!starting}
            className="w-full bg-tg-button text-tg-button-text py-2.5 rounded-xl font-medium text-sm disabled:opacity-50"
          >
            {starting === config.recommended.skill
              ? 'Memulai...'
              : `Latihan ${config.skills.find(s => s.id === config.recommended!.skill)?.name || config.recommended.skill}`
            }
          </button>
        </div>
      )}

      {/* Skill Cards */}
      <div className="space-y-3 mb-6">
        {(config?.skills || []).map((skill) => (
          <div
            key={skill.id}
            className={`border rounded-xl p-4 ${SKILL_BG[skill.id] || 'bg-tg-secondary border-tg-secondary'} ${
              skill.is_recommended ? 'ring-2 ring-tg-button/30' : ''
            }`}
          >
            {/* Skill Header */}
            <div className="flex items-center gap-3 mb-3">
              <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${SKILL_COLORS[skill.id] || 'from-gray-400 to-gray-500'} flex items-center justify-center text-2xl text-white shadow-sm`}>
                {skill.icon}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-bold">{skill.name}</h3>
                  {skill.is_recommended && (
                    <span className="text-xs bg-tg-button/20 text-tg-button px-2 py-0.5 rounded-full font-medium">
                      Disarankan
                    </span>
                  )}
                </div>
                <p className="text-xs text-tg-hint">{skill.description}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-tg-hint">{skill.available_questions} soal</p>
                <p className="text-xs text-tg-hint">{skill.duration_minutes} min</p>
              </div>
            </div>

            {/* IRT Score */}
            {skill.irt && (
              <div className="mb-3 bg-tg-bg/50 rounded-lg p-2.5">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-medium text-tg-hint">IRT Score</span>
                  <div className="flex items-center gap-2">
                    {skill.irt.cefr && (
                      <span className="text-xs bg-tg-button/15 text-tg-button px-1.5 py-0.5 rounded font-medium">
                        {skill.irt.cefr}
                      </span>
                    )}
                    <span className="text-xs font-mono font-semibold">
                      θ {skill.irt.theta.toFixed(2)} ± {skill.irt.se.toFixed(2)}
                    </span>
                  </div>
                </div>
                <ThetaBar theta={skill.irt.theta} />
                {skill.irt.ibt_estimate !== undefined && (
                  <div className="mt-1.5 text-xs text-tg-hint">
                    Estimasi iBT section: <span className="font-semibold text-tg-text">{skill.irt.ibt_estimate}/30</span>
                  </div>
                )}
              </div>
            )}

            {/* Learning Curve */}
            {skill.learning_curve && (
              <div className="flex items-center gap-4 mb-3 text-xs">
                <div>
                  <span className="text-tg-hint">Akurasi: </span>
                  <span className="font-semibold">{skill.learning_curve.current_accuracy}%</span>
                </div>
                <div>
                  <span className="text-tg-hint">Proyeksi: </span>
                  <span className="font-semibold text-green-600">{skill.learning_curve.projected_accuracy}%</span>
                </div>
                <div>
                  <span className="text-tg-hint">Sesi: </span>
                  <span className="font-semibold">{skill.learning_curve.sessions}</span>
                </div>
              </div>
            )}

            {/* Recent Practice */}
            {skill.recent && (
              <div className="flex items-center gap-4 mb-3 text-xs text-tg-hint">
                <span>7 hari: {skill.recent.questions_done} soal ({skill.recent.accuracy}%)</span>
                <span>{formatTimeAgo(skill.recent.last_practiced)}</span>
              </div>
            )}

            {/* No data yet */}
            {!skill.irt && !skill.learning_curve && !skill.recent && (
              <div className="text-xs text-tg-hint mb-3 italic">
                Belum ada data — mulai latihan untuk tracking IRT & learning curve
              </div>
            )}

            {/* Start Button */}
            <button
              onClick={() => handleStartPractice(skill.id)}
              disabled={!!starting || skill.available_questions === 0}
              className={`w-full py-2.5 rounded-xl font-medium text-sm disabled:opacity-50 transition-all ${
                skill.is_recommended
                  ? 'bg-tg-button text-tg-button-text'
                  : 'bg-tg-bg text-tg-text border border-tg-button/20 hover:bg-tg-button/10'
              }`}
            >
              {starting === skill.id
                ? 'Memulai...'
                : skill.available_questions === 0
                ? 'Belum ada soal'
                : `Mulai Latihan ${skill.name} (${skill.question_count} soal)`
              }
            </button>
          </div>
        ))}
      </div>

      {/* History Toggle */}
      {history.length > 0 && (
        <div className="mb-6">
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="w-full flex items-center justify-between py-2 text-sm font-semibold"
          >
            <span>Riwayat Latihan</span>
            <span className="text-tg-hint">{showHistory ? '▲' : '▼'} {history.length} sesi</span>
          </button>

          {showHistory && (
            <div className="space-y-2 mt-2">
              {history.map((session) => {
                const skillConfig = config?.skills.find(s => s.id === session.skill);
                return (
                  <div key={session.attempt_id} className="bg-tg-secondary rounded-lg p-3 flex items-center gap-3">
                    <span className="text-xl">{skillConfig?.icon || '📋'}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">{skillConfig?.name || session.skill}</span>
                        <span className={`text-xs font-semibold ${
                          session.accuracy >= 80 ? 'text-green-600' :
                          session.accuracy >= 60 ? 'text-yellow-600' : 'text-red-600'
                        }`}>{session.accuracy}%</span>
                      </div>
                      <div className="text-xs text-tg-hint">
                        {session.correct}/{session.total_questions} benar
                        {session.avg_time_seconds ? ` — ${session.avg_time_seconds}s/soal` : ''}
                      </div>
                    </div>
                    <div className="text-xs text-tg-hint text-right">
                      {formatTimeAgo(session.started_at)}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Bottom Navigation */}
      <div className="fixed bottom-0 left-0 right-0 bg-tg-bg border-t border-tg-secondary p-3 flex gap-2 max-w-lg mx-auto">
        <button
          onClick={() => navigate('/')}
          className="flex-1 py-2 rounded-lg text-sm bg-tg-secondary text-tg-text font-medium"
        >
          Tes Lengkap
        </button>
        <button
          className="flex-1 py-2 rounded-lg text-sm bg-tg-button text-tg-button-text font-medium"
        >
          Skill Practice
        </button>
        <button
          onClick={() => navigate('/progress')}
          className="flex-1 py-2 rounded-lg text-sm bg-tg-secondary text-tg-text font-medium"
        >
          Progress
        </button>
      </div>
    </div>
  );
}
