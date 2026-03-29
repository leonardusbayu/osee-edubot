import { useEffect, useState } from 'react';

interface ProgressData {
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

export default function Progress() {
  const [data, setData] = useState<ProgressData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadProgress();
  }, []);

  async function loadProgress() {
    try {
      const response = await fetch('/api/progress/overview');
      if (response.ok) {
        setData(await response.json());
      }
    } catch {}
    setLoading(false);
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
      <p className="text-tg-hint text-sm mb-5">TOEFL iBT 2026</p>

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
          {data.best_score !== null && (
            <div className="bg-gradient-to-r from-tg-button/20 to-tg-button/5 rounded-xl p-4 mb-6 text-center">
              <p className="text-xs text-tg-hint mb-1">Skor Terbaik</p>
              <p className="text-4xl font-bold text-tg-button">{data.best_score}</p>
              <p className="text-xs text-tg-hint mt-1">Band Score (skala 1-6)</p>
              {data.average_score !== null && (
                <p className="text-sm text-tg-hint mt-2">Rata-rata: <b>{data.average_score}</b></p>
              )}
            </div>
          )}

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
                {data.test_results.map((result, i) => (
                  <div key={i} className="bg-tg-secondary rounded-xl p-3">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <p className="font-medium">Band {result.band_score || result.total_score}</p>
                        <p className="text-xs text-tg-hint">
                          {result.date ? new Date(result.date).toLocaleDateString('id-ID', {
                            day: 'numeric', month: 'short', year: 'numeric'
                          }) : ''}
                        </p>
                      </div>
                      <div className={`text-2xl font-bold ${
                        (result.band_score || result.total_score) >= 4 ? 'text-green-500' :
                        (result.band_score || result.total_score) >= 3 ? 'text-yellow-500' : 'text-red-500'
                      }`}>
                        {result.band_score || result.total_score}
                      </div>
                    </div>
                    <div className="flex gap-1 flex-wrap">
                      {Object.entries(result.section_scores).map(([section, score]) => {
                        const info = SECTION_LABELS[section];
                        return (
                          <span key={section} className="text-xs bg-tg-bg px-2 py-1 rounded">
                            {info?.icon || ''} {score}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Score History Chart */}
          {data.test_results.length >= 2 && (
            <div className="mb-6">
              <h2 className="font-semibold mb-3">Grafik Skor</h2>
              <div className="bg-tg-secondary rounded-xl p-4">
                <svg viewBox="0 0 300 120" className="w-full h-32">
                  {/* Grid lines */}
                  {[1,2,3,4,5,6].map(band => (
                    <g key={band}>
                      <line x1="30" y1={100 - (band/6)*90} x2="290" y2={100 - (band/6)*90} stroke="#e5e7eb" strokeWidth="0.5" />
                      <text x="5" y={104 - (band/6)*90} fontSize="8" fill="#9ca3af">{band}</text>
                    </g>
                  ))}
                  {/* Target line */}
                  <line x1="30" y1={100 - (4/6)*90} x2="290" y2={100 - (4/6)*90} stroke="#ef4444" strokeWidth="1" strokeDasharray="4" />
                  <text x="250" y={97 - (4/6)*90} fontSize="7" fill="#ef4444">Target: 4</text>
                  {/* Score line */}
                  <polyline
                    fill="none" stroke="#3b82f6" strokeWidth="2"
                    points={data.test_results.slice(0, 10).reverse().map((r, i, arr) => {
                      const x = 30 + (i / Math.max(arr.length - 1, 1)) * 260;
                      const y = 100 - ((r.band_score || r.total_score) / 6) * 90;
                      return `${x},${y}`;
                    }).join(' ')}
                  />
                  {/* Score dots */}
                  {data.test_results.slice(0, 10).reverse().map((r, i, arr) => {
                    const x = 30 + (i / Math.max(arr.length - 1, 1)) * 260;
                    const y = 100 - ((r.band_score || r.total_score) / 6) * 90;
                    const score = r.band_score || r.total_score;
                    return (
                      <g key={i}>
                        <circle cx={x} cy={y} r="4" fill={score >= 4 ? '#22c55e' : score >= 3 ? '#f59e0b' : '#ef4444'} />
                        <text x={x} y={y - 7} fontSize="7" textAnchor="middle" fill="#374151">{score}</text>
                      </g>
                    );
                  })}
                </svg>
              </div>
            </div>
          )}

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
