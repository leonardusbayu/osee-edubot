import { useEffect, useState } from 'react';
import { authedFetch } from '../api/authedFetch';

interface ReportCardData {
  user_name: string;
  week_label: string;
  questions_answered: number;
  correct: number;
  accuracy: number;
  tests_completed: number;
  streak_days: number;
  xp: number;
  level: number;
  badges: string[];
  by_section: Record<string, { total: number; correct: number; accuracy: number }>;
  improvement: string | null;
  rank_percentile: number;
  study_minutes: number;
}

const SECTION_INFO: Record<string, { name: string; icon: string; color: string }> = {
  reading: { name: 'Reading', icon: '📖', color: 'from-blue-400 to-blue-600' },
  listening: { name: 'Listening', icon: '🎧', color: 'from-green-400 to-green-600' },
  speaking: { name: 'Speaking', icon: '🗣️', color: 'from-orange-400 to-orange-600' },
  writing: { name: 'Writing', icon: '✍️', color: 'from-purple-400 to-purple-600' },
};

const BADGE_INFO: Record<string, { name: string; emoji: string }> = {
  first_test: { name: 'Tes Pertama', emoji: '🎯' },
  streak_3: { name: '3 Hari Berturut', emoji: '🔥' },
  streak_7: { name: '7 Hari Berturut', emoji: '💪' },
  streak_30: { name: '30 Hari Berturut', emoji: '🏆' },
  questions_50: { name: '50 Soal', emoji: '📝' },
  questions_100: { name: '100 Soal', emoji: '📚' },
  questions_500: { name: '500 Soal', emoji: '🎓' },
  accuracy_80: { name: 'Akurasi 80%', emoji: '🎯' },
  band_4: { name: 'Band 4+', emoji: '⭐' },
  referrer: { name: 'Influencer', emoji: '🤝' },
  diagnostic: { name: 'Self-Aware', emoji: '🧠' },
};

function AccuracyGauge({ accuracy }: { accuracy: number }) {
  // Create a circular gauge (speedometer style)
  const circumference = 2 * Math.PI * 45;
  const strokeDashoffset = circumference - (accuracy / 100) * circumference;
  const angle = (accuracy / 100) * 180 - 90; // -90 to 90 degrees
  const gaugeColor = accuracy >= 70 ? '#22c55e' : accuracy >= 50 ? '#f59e0b' : '#ef4444';

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', flexDirection: 'column', marginTop: '20px', marginBottom: '20px' }}>
      <svg viewBox="0 0 120 120" style={{ width: '140px', height: '140px' }}>
        {/* Background circle */}
        <circle cx="60" cy="60" r="45" fill="none" stroke="#e5e7eb" strokeWidth="8" />
        {/* Progress circle */}
        <circle
          cx="60"
          cy="60"
          r="45"
          fill="none"
          stroke={gaugeColor}
          strokeWidth="8"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.5s ease' }}
        />
        {/* Center text */}
        <text x="60" y="60" textAnchor="middle" dominantBaseline="middle" fontSize="32" fontWeight="bold" fill={gaugeColor}>
          {accuracy}%
        </text>
        <text x="60" y="75" textAnchor="middle" dominantBaseline="middle" fontSize="10" fill="#6b7280">
          Akurasi
        </text>
      </svg>
      <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '8px' }}>
        {accuracy >= 80 && '🎉 Sempurna!'}
        {accuracy >= 70 && accuracy < 80 && '✨ Sangat Baik!'}
        {accuracy >= 50 && accuracy < 70 && '💪 Berkembang'}
        {accuracy < 50 && '🚀 Mulai Belajar'}
      </div>
    </div>
  );
}

export default function ReportCard() {
  const [data, setData] = useState<ReportCardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadReportCard();
  }, []);

  async function loadReportCard() {
    try {
      const response = await authedFetch('/api/progress/report-card');
      if (response.ok) {
        setData(await response.json());
      } else {
        setError('Gagal memuat laporan mingguan');
      }
    } catch (e: any) {
      setError('Gagal memuat laporan mingguan');
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  async function shareReport() {
    if (!data) return;

    const text = `📊 Laporan Mingguan ${data.user_name}\n\nMinggu: ${data.week_label}\n\n✅ Soal dijawab: ${data.questions_answered}\n🎯 Akurasi: ${data.accuracy}%\n🔥 Streak: ${data.streak_days} hari\n⭐ XP: ${data.xp}`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Laporan Mingguan EduBot',
          text,
        });
      } catch (e) {
        console.error('Share failed:', e);
      }
    } else {
      // Fallback: copy to clipboard
      try {
        await navigator.clipboard.writeText(text);
        alert('Laporan disalin ke clipboard!');
      } catch (e) {
        console.error('Copy failed:', e);
      }
    }
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
        <div style={{ textAlign: 'center' }}>
          <div
            style={{
              width: '32px',
              height: '32px',
              border: '3px solid rgba(0,0,0,0.1)',
              borderTop: '3px solid #3b82f6',
              borderRadius: '50%',
              animation: 'spin 0.8s linear infinite',
              margin: '0 auto 16px',
            }}
          />
          <p style={{ color: '#9ca3af' }}>Memuat laporan...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div style={{ padding: '16px', textAlign: 'center', marginTop: '48px' }}>
        <p style={{ fontSize: '18px', color: '#ef4444' }}>⚠️ {error || 'Data tidak ditemukan'}</p>
        <p style={{ fontSize: '14px', color: '#9ca3af', marginTop: '8px' }}>Coba muat ulang halaman</p>
      </div>
    );
  }

  return (
    <div style={{ padding: '16px', maxWidth: '500px', margin: '0 auto', paddingBottom: '32px' }}>
      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: '24px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 'bold', margin: '0 0 4px 0' }}>📊 Laporan Mingguan</h1>
        <p style={{ color: '#6b7280', margin: '0', fontSize: '14px' }}>{data.user_name}</p>
        <p style={{ color: '#9ca3af', margin: '4px 0 0 0', fontSize: '12px' }}>Minggu {data.week_label}</p>
      </div>

      {/* Main Accuracy Gauge */}
      <div style={{ background: '#f9fafb', borderRadius: '16px', padding: '16px', marginBottom: '16px' }}>
        <AccuracyGauge accuracy={data.accuracy} />
      </div>

      {/* Stats Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
        <div style={{ background: '#f3f4f6', borderRadius: '12px', padding: '16px', textAlign: 'center' }}>
          <p style={{ fontSize: '28px', fontWeight: 'bold', color: '#3b82f6', margin: '0' }}>{data.questions_answered}</p>
          <p style={{ color: '#6b7280', fontSize: '12px', margin: '4px 0 0 0' }}>Soal Dijawab</p>
        </div>
        <div style={{ background: '#f3f4f6', borderRadius: '12px', padding: '16px', textAlign: 'center' }}>
          <p style={{ fontSize: '28px', fontWeight: 'bold', color: '#10b981', margin: '0' }}>{data.tests_completed}</p>
          <p style={{ color: '#6b7280', fontSize: '12px', margin: '4px 0 0 0' }}>Tes Selesai</p>
        </div>
        <div style={{ background: '#f3f4f6', borderRadius: '12px', padding: '16px', textAlign: 'center' }}>
          <p style={{ fontSize: '28px', fontWeight: 'bold', color: '#f59e0b', margin: '0' }}>🔥 {data.streak_days}</p>
          <p style={{ color: '#6b7280', fontSize: '12px', margin: '4px 0 0 0' }}>Hari Berturut</p>
        </div>
        <div style={{ background: '#f3f4f6', borderRadius: '12px', padding: '16px', textAlign: 'center' }}>
          <p style={{ fontSize: '28px', fontWeight: 'bold', color: '#8b5cf6', margin: '0' }}>{data.xp}</p>
          <p style={{ color: '#6b7280', fontSize: '12px', margin: '4px 0 0 0' }}>Level {data.level}</p>
        </div>
      </div>

      {/* Extra Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
        <div style={{ background: '#fef3c7', borderRadius: '12px', padding: '12px', textAlign: 'center' }}>
          <p style={{ fontSize: '14px', fontWeight: 'bold', color: '#92400e', margin: '0' }}>{data.study_minutes}m</p>
          <p style={{ color: '#78350f', fontSize: '11px', margin: '4px 0 0 0' }}>Waktu Belajar</p>
        </div>
        <div style={{ background: '#dbeafe', borderRadius: '12px', padding: '12px', textAlign: 'center' }}>
          <p style={{ fontSize: '14px', fontWeight: 'bold', color: '#0c2340', margin: '0' }}>{data.rank_percentile}%</p>
          <p style={{ color: '#1e40af', fontSize: '11px', margin: '4px 0 0 0' }}>Rank Percentile</p>
        </div>
      </div>

      {/* Improvement */}
      {data.improvement && (
        <div style={{ background: '#dcfce7', border: '1px solid #86efac', borderRadius: '12px', padding: '12px', marginBottom: '16px', textAlign: 'center' }}>
          <p style={{ color: '#166534', fontSize: '14px', margin: '0', fontWeight: 'bold' }}>
            {data.improvement.startsWith('+') ? '📈' : '📉'} Perubahan akurasi minggu lalu: {data.improvement}
          </p>
        </div>
      )}

      {/* Per Section Breakdown */}
      <div style={{ marginBottom: '16px' }}>
        <h2 style={{ fontSize: '16px', fontWeight: 'bold', margin: '0 0 12px 0' }}>Per Section</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {Object.entries(data.by_section).map(([section, stats]) => {
            const info = SECTION_INFO[section] || { name: section, icon: '📝', color: 'from-gray-400 to-gray-600' };
            const accuracy = stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 0;
            const barColor = accuracy >= 70 ? '#22c55e' : accuracy >= 50 ? '#f59e0b' : '#ef4444';

            return (
              <div key={section} style={{ background: '#f3f4f6', borderRadius: '12px', padding: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{ fontSize: '14px', fontWeight: '500' }}>
                    {info.icon} {info.name}
                  </span>
                  <span style={{ fontSize: '16px', fontWeight: 'bold', color: barColor }}>
                    {accuracy}%
                  </span>
                </div>
                <div style={{ background: '#e5e7eb', borderRadius: '8px', height: '8px', overflow: 'hidden', marginBottom: '4px' }}>
                  <div
                    style={{
                      height: '100%',
                      background: barColor,
                      width: `${accuracy}%`,
                      transition: 'width 0.3s ease',
                    }}
                  />
                </div>
                <p style={{ fontSize: '11px', color: '#6b7280', margin: '0' }}>
                  {stats.correct} benar dari {stats.total} soal
                </p>
              </div>
            );
          })}
        </div>

        {Object.keys(data.by_section).length === 0 && (
          <p style={{ color: '#9ca3af', fontSize: '14px' }}>Belum ada data section minggu ini.</p>
        )}
      </div>

      {/* Badges */}
      {data.badges.length > 0 && (
        <div style={{ marginBottom: '16px' }}>
          <h2 style={{ fontSize: '16px', fontWeight: 'bold', margin: '0 0 12px 0' }}>🏅 Badges</h2>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {data.badges.map((badgeId) => {
              const badge = BADGE_INFO[badgeId as keyof typeof BADGE_INFO];
              return (
                <div key={badgeId} style={{ background: '#fef3c7', border: '1px solid #fcd34d', borderRadius: '8px', padding: '8px 12px', textAlign: 'center' }}>
                  <p style={{ fontSize: '20px', margin: '0 0 4px 0' }}>{badge?.emoji || '⭐'}</p>
                  <p style={{ fontSize: '11px', color: '#92400e', margin: '0', fontWeight: '500' }}>
                    {badge?.name || badgeId}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Motivational Message */}
      <div style={{ background: '#f9fafb', borderRadius: '12px', padding: '16px', marginBottom: '16px', textAlign: 'center' }}>
        <p style={{ fontSize: '14px', margin: '0', color: '#1f2937' }}>
          {data.accuracy >= 80 && '🎉 Akurasi kamu sudah sempurna! Terus pertahankan semangat ini!'}
          {data.accuracy >= 70 && data.accuracy < 80 && '✨ Akurasi kamu bagus! Fokus di section yang masih lemah.'}
          {data.accuracy >= 50 && data.accuracy < 70 && '💪 Kamu sedang berkembang. Latihan konsisten adalah kunci!'}
          {data.accuracy < 50 && data.questions_answered > 20 && '🚀 Jangan menyerah! Terus latihan dan review kesalahan kamu.'}
          {data.questions_answered === 0 && '📖 Mulai latihan sekarang untuk melihat progress minggu depan!'}
          {data.questions_answered > 0 && data.questions_answered <= 20 && '🌟 Awal yang bagus! Latihan lebih banyak minggu depan.'}
        </p>
      </div>

      {/* Share Button */}
      <button
        onClick={shareReport}
        style={{
          width: '100%',
          background: '#3b82f6',
          color: 'white',
          border: 'none',
          borderRadius: '12px',
          padding: '12px',
          fontSize: '16px',
          fontWeight: '600',
          cursor: 'pointer',
          marginBottom: '16px',
        }}
      >
        📤 Bagikan Laporan
      </button>

      {/* Footer */}
      <div style={{ textAlign: 'center', fontSize: '12px', color: '#9ca3af' }}>
        <p style={{ margin: '0' }}>OSEE.CO.ID — EduBot Learning Report</p>
        <p style={{ margin: '4px 0 0 0' }}>Laporan ini dibuat otomatis setiap minggu</p>
      </div>
    </div>
  );
}
