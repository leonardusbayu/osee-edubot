import { useEffect, useState } from 'react';
import { authedFetch } from '../api/authedFetch';

interface DashboardData {
  total_students: number;
  active_today: number;
  week_questions: number;
  week_accuracy: number;
  avg_band_score: number | null;
  weak_sections: { section: string; accuracy: number; total: number }[];
  top_students: { name: string; questions: number; accuracy: number }[];
  api_cost: number;
}

interface HeatmapData {
  days: string[];
  hours: string[];
  data: number[][];
}

interface ChurnData {
  at_risk: { id: number; name: string; last_active: string; total_questions: number; risk_level: string }[];
  total_at_risk: number;
}

export default function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [heatmap, setHeatmap] = useState<HeatmapData | null>(null);
  const [churn, setChurn] = useState<ChurnData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      authedFetch('/api/analytics/dashboard').then(r => r.ok ? r.json() : null),
      authedFetch('/api/analytics/heatmap').then(r => r.ok ? r.json() : null),
      authedFetch('/api/analytics/churn-risk').then(r => r.ok ? r.json() : null),
    ]).then(([d, h, c]) => {
      setData(d);
      setHeatmap(h);
      setChurn(c);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex items-center justify-center min-h-screen"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-tg-button"></div></div>;

  if (!data) return <div className="p-4 text-center text-tg-hint">Akses ditolak. Hanya untuk guru/admin.</div>;

  return (
    <div className="p-4 max-w-2xl mx-auto pb-8">
      <h1 className="text-2xl font-bold mb-1">Teacher Dashboard</h1>
      <p className="text-tg-hint text-sm mb-6">Analytics & monitoring</p>

      {/* Key Metrics */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <div className="bg-tg-secondary rounded-xl p-3 text-center">
          <p className="text-2xl font-bold text-tg-button">{data.total_students}</p>
          <p className="text-xs text-tg-hint">Total Siswa</p>
        </div>
        <div className="bg-tg-secondary rounded-xl p-3 text-center">
          <p className="text-2xl font-bold text-green-500">{data.active_today}</p>
          <p className="text-xs text-tg-hint">Aktif Hari Ini</p>
        </div>
        <div className="bg-tg-secondary rounded-xl p-3 text-center">
          <p className="text-2xl font-bold text-tg-button">{data.week_questions}</p>
          <p className="text-xs text-tg-hint">Soal Minggu Ini</p>
        </div>
        <div className="bg-tg-secondary rounded-xl p-3 text-center">
          <p className="text-2xl font-bold" style={{color: data.week_accuracy >= 70 ? '#22c55e' : data.week_accuracy >= 50 ? '#f59e0b' : '#ef4444'}}>
            {data.week_accuracy}%
          </p>
          <p className="text-xs text-tg-hint">Akurasi Minggu Ini</p>
        </div>
      </div>

      {data.avg_band_score && (
        <div className="bg-gradient-to-r from-tg-button/20 to-tg-button/5 rounded-xl p-4 text-center mb-6">
          <p className="text-xs text-tg-hint">Rata-rata Band Score</p>
          <p className="text-3xl font-bold text-tg-button">{data.avg_band_score}</p>
        </div>
      )}

      {/* Weak Sections */}
      {data.weak_sections.length > 0 && (
        <div className="mb-6">
          <h2 className="font-semibold mb-3">Section Terlemah</h2>
          <div className="space-y-2">
            {data.weak_sections.map((s) => (
              <div key={s.section} className="bg-tg-secondary rounded-xl p-3 flex justify-between items-center">
                <span className="text-sm capitalize">{s.section}</span>
                <div className="text-right">
                  <span className="text-sm font-bold" style={{color: s.accuracy >= 70 ? '#22c55e' : s.accuracy >= 50 ? '#f59e0b' : '#ef4444'}}>
                    {s.accuracy}%
                  </span>
                  <span className="text-xs text-tg-hint ml-2">({s.total} soal)</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Top Students */}
      {data.top_students.length > 0 && (
        <div className="mb-6">
          <h2 className="font-semibold mb-3">Top Siswa</h2>
          <div className="space-y-2">
            {data.top_students.map((s, i) => (
              <div key={i} className="bg-tg-secondary rounded-xl p-3 flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{i < 3 ? ['🥇','🥈','🥉'][i] : `${i+1}.`}</span>
                  <span className="text-sm">{s.name}</span>
                </div>
                <div className="text-right">
                  <span className="text-sm font-bold">{s.accuracy}%</span>
                  <span className="text-xs text-tg-hint ml-1">({s.questions})</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Activity Heatmap */}
      {heatmap && (
        <div className="mb-6">
          <h2 className="font-semibold mb-3">Aktivitas (30 hari)</h2>
          <div className="bg-tg-secondary rounded-xl p-3 overflow-x-auto">
            <div className="min-w-[400px]">
              <div className="flex gap-px">
                <div className="w-8"></div>
                {[6,8,10,12,14,16,18,20,22].map(h => (
                  <div key={h} className="flex-1 text-center text-xs text-tg-hint">{h}</div>
                ))}
              </div>
              {heatmap.days.map((day, di) => (
                <div key={day} className="flex gap-px items-center">
                  <div className="w-8 text-xs text-tg-hint">{day}</div>
                  {heatmap.data[di].map((val, hi) => {
                    const max = Math.max(0, ...heatmap.data.flat());
                    const intensity = max > 0 ? val / max : 0;
                    return (
                      <div key={hi} className="flex-1 h-4 rounded-sm" style={{
                        backgroundColor: intensity > 0.7 ? '#22c55e' : intensity > 0.3 ? '#86efac' : intensity > 0 ? '#dcfce7' : '#f3f4f6'
                      }} title={`${day} ${hi}:00 — ${val} activities`} />
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Churn Risk */}
      {churn && churn.total_at_risk > 0 && (
        <div className="mb-6">
          <h2 className="font-semibold mb-3">Risiko Churn ({churn.total_at_risk} siswa)</h2>
          <div className="space-y-2">
            {churn.at_risk.slice(0, 5).map((s) => (
              <div key={s.id} className={`rounded-xl p-3 flex justify-between items-center ${
                s.risk_level === 'high' ? 'bg-red-50 border border-red-200' : 'bg-yellow-50 border border-yellow-200'
              }`}>
                <div>
                  <p className="text-sm font-medium">{s.name}</p>
                  <p className="text-xs text-tg-hint">
                    Terakhir aktif: {s.last_active === 'never' ? 'Belum pernah' : new Date(s.last_active).toLocaleDateString('id-ID')}
                  </p>
                </div>
                <span className={`text-xs px-2 py-1 rounded-full ${
                  s.risk_level === 'high' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'
                }`}>{s.risk_level}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* API Cost */}
      <div className="bg-tg-secondary rounded-xl p-4 text-center text-sm">
        <p className="text-tg-hint">Biaya API total: <b>${(data.api_cost ?? 0).toFixed(4)}</b></p>
      </div>
    </div>
  );
}
