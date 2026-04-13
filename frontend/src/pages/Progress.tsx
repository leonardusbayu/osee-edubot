import { useEffect, useState } from 'react';
import { authedFetch } from '../api/authedFetch';

interface ProgressData {
  target_test: string;
  total_tests: number;
  total_questions_practiced: number;
  correct_answers: number;
  wrong_answers: number;
  overall_accuracy: number;
  best_score: number | null;
  average_score: number | null;
  study_streak: number;
  section_stats: SectionStat[];
  test_results: TestScore[];
  weaknesses: Weakness[];
  spaced_repetition: { total: number; due: number; mastered: number };
  time_per_question: TimePerQuestion[];
}

interface TimePerQuestion {
  section: string;
  avg_seconds: number;
  count: number;
}

interface SectionStat {
  section: string;
  total: number;
  correct: number;
  wrong: number;
  accuracy: number;
}

interface TestScore {
  attempt_id: number;
  total_score: number;
  band_score: number | null;
  section_scores: Record<string, number>;
  test_type: string | null;
  date: string;
}

interface Weakness {
  section: string;
  error_count: number;
  total_practiced: number;
  accuracy: number;
}

const SECTION_LABELS: Record<string, { name: string; icon: string; color: string }> = {
  reading: { name: 'Reading', icon: '📖', color: 'bg-blue-500' },
  listening: { name: 'Listening', icon: '🎧', color: 'bg-green-500' },
  speaking: { name: 'Speaking', icon: '🗣', color: 'bg-orange-500' },
  writing: { name: 'Writing', icon: '✍️', color: 'bg-purple-500' },
};

interface QuotaInfo {
  allowed: boolean;
  is_premium: boolean;
  daily_limit: number;
  used_today: number;
  bonus_quota: number;
  remaining: number;
  reset_at: string;
}

export default function Progress() {
  const [data, setData] = useState<ProgressData | null>(null);
  const [loading, setLoading] = useState(true);
  const [quota, setQuota] = useState<QuotaInfo | null>(null);

  useEffect(() => {
    loadProgress();
    loadQuota();
  }, []);

  async function loadProgress() {
    try {
      const response = await authedFetch('/api/progress/overview');
      if (response.ok) {
        setData(await response.json());
      }
    } catch {}
    setLoading(false);
  }

  async function loadQuota() {
    try {
      const response = await authedFetch('/api/tests/available');
      if (response.ok) {
        const result = await response.json();
        if (result.quota) {
          setQuota(result.quota);
        }
      }
    } catch {}
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-tg-button"></div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-4 text-center mt-12">
        <p className="text-tg-hint">Belum ada data. Mulai latihan untuk melihat progress kamu.</p>
      </div>
    );
  }

  const hasActivity = data.total_questions_practiced > 0;

  return (
    <div className="p-4 max-w-lg mx-auto pb-8">
      <h1 className="text-2xl font-bold mb-1">Progress Kamu</h1>
      <p className="text-tg-hint text-sm mb-5">{data?.target_test?.replace(/_/g, ' ') || 'TOEFL iBT'} {new Date().getFullYear()}</p>

      {/* Quota bar for non-premium users */}
      {quota && !quota.is_premium && (
        <div className="bg-tg-secondary rounded-xl p-3 mb-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Kuota Harian</span>
            <span className="text-xs text-tg-hint">
              {quota.used_today} / {quota.daily_limit} soal
              {quota.bonus_quota > 0 && <span className="text-green-500 ml-1">(+{quota.bonus_quota} bonus)</span>}
            </span>
          </div>
          <div className="w-full bg-tg-bg rounded-full h-2.5 mb-2">
            <div
              className={`h-2.5 rounded-full transition-all ${quota.remaining > 0 ? 'bg-tg-button' : 'bg-red-500'}`}
              style={{ width: `${Math.min(((quota.daily_limit + quota.bonus_quota) > 0 ? (quota.used_today / (quota.daily_limit + quota.bonus_quota)) * 100 : 0), 100)}%` }}
            />
          </div>
          {quota.remaining > 0 ? (
            <p className="text-xs text-tg-hint">
              {quota.remaining} soal tersisa hari ini · Reset {new Date(quota.reset_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} WIB
            </p>
          ) : (
            <p className="text-xs text-red-500 font-medium">
              Kuota habis! Upgrade ke Premium untuk akses unlimited.
            </p>
          )}
        </div>
      )}

      {quota && quota.is_premium && (
        <div className="bg-gradient-to-r from-yellow-500/20 to-yellow-500/5 rounded-xl p-3 mb-5 text-center">
          <span className="text-sm font-medium text-yellow-500">👑 Premium User — Akses Unlimited</span>
        </div>
      )}

      {!hasActivity ? (
        <div className="text-center py-12">
          <p className="text-4xl mb-3">📊</p>
          <p className="text-lg font-medium mb-2">Belum ada aktivitas</p>
          <p className="text-sm text-tg-hint">Mulai latihan atau tes untuk melihat progress kamu di sini.</p>
        </div>
      ) : (
        <>
          {/* Stats Grid */}
          <div className="grid grid-cols-2 gap-3 mb-6">
            <div className="bg-tg-secondary rounded-xl p-3 text-center">
              <p className="text-2xl font-bold text-tg-button">{data.total_questions_practiced}</p>
              <p className="text-xs text-tg-hint">Soal Dijawab</p>
            </div>
            <div className="bg-tg-secondary rounded-xl p-3 text-center">
              <p className="text-2xl font-bold" style={{color: data.overall_accuracy >= 70 ? '#22c55e' : data.overall_accuracy >= 50 ? '#f59e0b' : '#ef4444'}}>
                {data.overall_accuracy}%
              </p>
              <p className="text-xs text-tg-hint">Akurasi</p>
            </div>
            <div className="bg-tg-secondary rounded-xl p-3 text-center">
              <p className="text-2xl font-bold text-tg-button">{data.total_tests}</p>
              <p className="text-xs text-tg-hint">Tes Selesai</p>
            </div>
            <div className="bg-tg-secondary rounded-xl p-3 text-center">
              <p className="text-2xl font-bold text-green-500">{data.study_streak}</p>
              <p className="text-xs text-tg-hint">Hari Berturut</p>
            </div>
          </div>

          {/* Correct vs Wrong */}
          <div className="bg-tg-secondary rounded-xl p-4 mb-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Benar vs Salah</span>
              <span className="text-sm text-tg-hint">{data.correct_answers} / {data.total_questions_practiced}</span>
            </div>
            <div className="w-full bg-red-200 rounded-full h-3 overflow-hidden">
              <div
                className="h-3 bg-green-500 rounded-full transition-all"
                style={{ width: `${data.overall_accuracy}%` }}
              />
            </div>
            <div className="flex justify-between text-xs text-tg-hint mt-1">
              <span>✅ {data.correct_answers} benar</span>
              <span>❌ {data.wrong_answers} salah</span>
            </div>
          </div>

          {/* Best Score */}
          {data.best_score !== null && data.best_score > 0 && (() => {
            const tt = data.target_test || 'TOEFL_IBT';
            const scoreLabel = tt === 'TOEFL_ITP' ? `Skor TOEFL ITP (310-677)`
              : tt === 'IELTS' ? `Band Score (skala 1-9)`
              : tt === 'TOEIC' ? `Skor TOEIC (10-990)`
              : `Skor TOEFL iBT (0-120)`;
            // For ITP/TOEIC show as integer, for band scores show decimal
            const isRawScore = tt === 'TOEFL_ITP' || tt === 'TOEIC';
            const displayScore = isRawScore ? Math.round(data.best_score) : data.best_score;
            const displayAvg = data.average_score !== null
              ? (isRawScore ? Math.round(data.average_score) : data.average_score)
              : null;
            return (
              <div className="bg-gradient-to-r from-tg-button/20 to-tg-button/5 rounded-xl p-4 mb-6 text-center">
                <p className="text-xs text-tg-hint mb-1">Skor Terbaik</p>
                <p className="text-4xl font-bold text-tg-button">{displayScore}</p>
                <p className="text-xs text-tg-hint mt-1">{scoreLabel}</p>
                {displayAvg !== null && (
                  <p className="text-sm text-tg-hint mt-2">Rata-rata: <b>{displayAvg}</b></p>
                )}
              </div>
            );
          })()}

          {/* Section Breakdown */}
          <div className="mb-6">
            <h2 className="font-semibold mb-3">Per Section</h2>
            <div className="space-y-3">
              {data.section_stats.map((stat) => {
                const info = SECTION_LABELS[stat.section] || { name: stat.section, icon: '📝', color: 'bg-gray-500' };
                return (
                  <div key={stat.section} className="bg-tg-secondary rounded-xl p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium">{info.icon} {info.name}</span>
                      <span className="text-sm font-bold" style={{
                        color: stat.accuracy >= 70 ? '#22c55e' : stat.accuracy >= 50 ? '#f59e0b' : '#ef4444'
                      }}>
                        {stat.accuracy}%
                      </span>
                    </div>
                    <div className="w-full bg-tg-bg rounded-full h-2 mb-1">
                      <div className={`h-2 rounded-full ${info.color}`} style={{ width: `${stat.accuracy}%` }} />
                    </div>
                    <div className="flex justify-between text-xs text-tg-hint">
                      <span>{stat.total} soal dijawab</span>
                      <span>✅ {stat.correct} · ❌ {stat.wrong}</span>
                    </div>
                  </div>
                );
              })}
            </div>

            {data.section_stats.length === 0 && (
              <p className="text-sm text-tg-hint">Belum ada data per section.</p>
            )}
          </div>

          {/* Weaknesses */}
          {data.weaknesses.length > 0 && (
            <div className="mb-6">
              <h2 className="font-semibold mb-2">Kelemahan yang Perlu Diperbaiki</h2>
              <p className="text-xs text-tg-hint mb-3">Section dengan kesalahan terbanyak</p>
              <div className="space-y-2">
                {data.weaknesses.map((w) => {
                  const info = SECTION_LABELS[w.section] || { name: w.section, icon: '⚠️', color: '' };
                  return (
                    <div key={w.section} className="bg-red-50 border border-red-200 rounded-xl p-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">{info.icon} {info.name}</span>
                        <span className="text-xs text-red-600 font-medium">{w.error_count} kesalahan</span>
                      </div>
                      <p className="text-xs text-red-500 mt-1">
                        Akurasi: {w.accuracy}% — dari {w.total_practiced} soal yang dijawab
                      </p>
                      {w.accuracy < 50 && (
                        <p className="text-xs text-red-700 mt-1 font-medium">
                          ⚠️ Perlu latihan lebih intensif di bagian ini
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Test Score History */}
          {data.test_results.length > 0 && (
            <div className="mb-6">
              <h2 className="font-semibold mb-3">Riwayat Skor Tes</h2>
              <div className="space-y-2">
                {data.test_results.map((result, i) => {
                  const score = result.band_score || result.total_score;
                  const tt = result.test_type || data.target_test || 'TOEFL_IBT';
                  const isRawScore = tt === 'TOEFL_ITP' || tt === 'TOEIC';
                  const displayScore = isRawScore ? Math.round(score) : score;
                  const testLabel = tt.replace(/_/g, ' ');
                  // Color thresholds based on test type
                  const scoreColor = isRawScore
                    ? (score >= 500 ? 'text-green-500' : score >= 400 ? 'text-yellow-500' : 'text-red-500')
                    : tt === 'IELTS'
                    ? (score >= 6 ? 'text-green-500' : score >= 4.5 ? 'text-yellow-500' : 'text-red-500')
                    : (score >= 4 ? 'text-green-500' : score >= 3 ? 'text-yellow-500' : 'text-red-500');
                  return (
                    <div key={i} className="bg-tg-secondary rounded-xl p-3">
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <p className="font-medium">{testLabel}: {displayScore}</p>
                          <p className="text-xs text-tg-hint">
                            {result.date ? new Date(result.date).toLocaleDateString('id-ID', {
                              day: 'numeric', month: 'short', year: 'numeric'
                            }) : ''}
                          </p>
                        </div>
                        <div className={`text-2xl font-bold ${scoreColor}`}>
                          {displayScore}
                        </div>
                      </div>
                      <div className="flex gap-1 flex-wrap">
                        {Object.entries(result.section_scores || {}).map(([section, sectionScore]) => {
                          const info = SECTION_LABELS[section];
                          const sDisplay = isRawScore ? Math.round(sectionScore) : sectionScore;
                          return (
                            <span key={section} className="text-xs bg-tg-bg px-2 py-1 rounded">
                              {info?.icon || ''} {info?.name || section} {sDisplay}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Score History Chart */}
          {data.test_results.length >= 2 && (() => {
            const tt = data.target_test || 'TOEFL_IBT';
            const isRawScore = tt === 'TOEFL_ITP' || tt === 'TOEIC';
            // Dynamic scale based on test type
            const maxScale = tt === 'TOEFL_ITP' ? 677 : tt === 'TOEIC' ? 990 : tt === 'IELTS' ? 9 : 6;
            const minScale = tt === 'TOEFL_ITP' ? 310 : tt === 'TOEIC' ? 10 : 0;
            const targetScore = tt === 'TOEFL_ITP' ? 500 : tt === 'TOEIC' ? 600 : tt === 'IELTS' ? 6.5 : 4;
            const gridSteps = isRawScore
              ? [minScale, Math.round(minScale + (maxScale-minScale)*0.25), Math.round(minScale + (maxScale-minScale)*0.5), Math.round(minScale + (maxScale-minScale)*0.75), maxScale]
              : Array.from({length: maxScale}, (_, i) => i + 1);
            const scaleRange = maxScale - minScale;
            const goodThreshold = tt === 'TOEFL_ITP' ? 500 : tt === 'TOEIC' ? 600 : tt === 'IELTS' ? 6 : 4;
            const midThreshold = tt === 'TOEFL_ITP' ? 400 : tt === 'TOEIC' ? 450 : tt === 'IELTS' ? 4.5 : 3;

            return (
              <div className="mb-6">
                <h2 className="font-semibold mb-3">Grafik Skor</h2>
                <div className="bg-tg-secondary rounded-xl p-4">
                  <svg viewBox="0 0 300 120" className="w-full h-32">
                    {/* Grid lines */}
                    {gridSteps.map(val => (
                      <g key={val}>
                        <line x1="40" y1={100 - ((val - minScale) / scaleRange) * 90} x2="290" y2={100 - ((val - minScale) / scaleRange) * 90} stroke="#e5e7eb" strokeWidth="0.5" />
                        <text x="2" y={104 - ((val - minScale) / scaleRange) * 90} fontSize="7" fill="#9ca3af">{val}</text>
                      </g>
                    ))}
                    {/* Target line */}
                    <line x1="40" y1={100 - ((targetScore - minScale) / scaleRange) * 90} x2="290" y2={100 - ((targetScore - minScale) / scaleRange) * 90} stroke="#ef4444" strokeWidth="1" strokeDasharray="4" />
                    <text x="245" y={97 - ((targetScore - minScale) / scaleRange) * 90} fontSize="7" fill="#ef4444">Target: {targetScore}</text>
                    {/* Score line */}
                    <polyline
                      fill="none" stroke="#3b82f6" strokeWidth="2"
                      points={data.test_results.slice(0, 10).reverse().map((r, i, arr) => {
                        const x = 40 + (i / Math.max(arr.length - 1, 1)) * 250;
                        const score = r.band_score || r.total_score;
                        const y = 100 - ((Math.max(score, minScale) - minScale) / scaleRange) * 90;
                        return `${x},${y}`;
                      }).join(' ')}
                    />
                    {/* Score dots */}
                    {data.test_results.slice(0, 10).reverse().map((r, i, arr) => {
                      const x = 40 + (i / Math.max(arr.length - 1, 1)) * 250;
                      const score = r.band_score || r.total_score;
                      const y = 100 - ((Math.max(score, minScale) - minScale) / scaleRange) * 90;
                      const displayScore = isRawScore ? Math.round(score) : score;
                      return (
                        <g key={i}>
                          <circle cx={x} cy={y} r="4" fill={score >= goodThreshold ? '#22c55e' : score >= midThreshold ? '#f59e0b' : '#ef4444'} />
                          <text x={x} y={y - 7} fontSize="7" textAnchor="middle" fill="#374151">{displayScore}</text>
                        </g>
                      );
                    })}
                  </svg>
                </div>
              </div>
            );
          })()}

          {/* Time Per Question */}
          {data.time_per_question?.length > 0 && (
            <div className="mb-6">
              <h2 className="font-semibold mb-3">Waktu per Soal</h2>
              <div className="grid grid-cols-2 gap-2">
                {data.time_per_question.map((t) => {
                  const info = SECTION_LABELS[t.section] || { name: t.section, icon: '📝' };
                  return (
                    <div key={t.section} className="bg-tg-secondary rounded-xl p-3 text-center">
                      <p className="text-lg font-bold">{t.avg_seconds}s</p>
                      <p className="text-xs text-tg-hint">{info.icon} {info.name}</p>
                      <p className="text-xs text-tg-hint">{t.count} soal</p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Spaced Repetition Stats */}
          {data.spaced_repetition?.total > 0 && (
            <div className="mb-6">
              <h2 className="font-semibold mb-3">Spaced Repetition</h2>
              <div className="bg-tg-secondary rounded-xl p-4">
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div>
                    <p className="text-lg font-bold text-tg-button">{data.spaced_repetition.total}</p>
                    <p className="text-xs text-tg-hint">Total item</p>
                  </div>
                  <div>
                    <p className="text-lg font-bold text-orange-500">{data.spaced_repetition.due}</p>
                    <p className="text-xs text-tg-hint">Perlu review</p>
                  </div>
                  <div>
                    <p className="text-lg font-bold text-green-500">{data.spaced_repetition.mastered}</p>
                    <p className="text-xs text-tg-hint">Dikuasai</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Motivational message based on data */}
          <div className="bg-tg-secondary rounded-xl p-4 text-center text-sm">
            {data.overall_accuracy >= 70 ? (
              <p>🎉 Akurasi kamu sudah bagus! Terus latihan untuk capai Band 4+</p>
            ) : data.overall_accuracy >= 50 ? (
              <p>💪 Kamu sedang berkembang. Fokus di section yang masih lemah!</p>
            ) : data.total_questions_practiced < 20 ? (
              <p>📖 Kamu baru mulai — latihan konsisten setiap hari akan buat perbedaan besar!</p>
            ) : (
              <p>🔥 Jangan menyerah! Review kesalahan kamu dan latihan drill berulang.</p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
