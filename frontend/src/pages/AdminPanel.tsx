import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { authedFetch } from '../api/authedFetch';

// ─── Types ─────────────────────────────────────────────────────

interface Overview {
  total_users: number;
  active_today: number;
  active_this_week: number;
  total_questions_answered: number;
  published_content: number;
  premium_users: number;
  completed_attempts: number;
  weekly_accuracy: number;
  section_breakdown: { section: string; total: number; correct: number }[];
  top_students_this_week: { id: number; name: string; username: string; questions: number; accuracy: number }[];
}

interface Student {
  id: number; telegram_id: number; name: string; username: string | null;
  role: string; target_test: string | null; proficiency_level: string | null;
  is_premium: number; created_at: string;
  questions_answered: number; accuracy: number; due_reviews: number; last_activity: string | null;
  learning_style: string | null; learning_pace: string | null;
}

interface StudentDetail {
  user: any; profile: any; mastery: any[]; mental_model: any[];
  section_breakdown: any[]; recent_attempts: any[]; study_logs: any[];
  spaced_repetition: any; lesson_plans: any[];
}

interface Trends {
  daily_activity: { date: string; active_users: number; questions_answered: number; accuracy: number }[];
  daily_signups: { date: string; count: number }[];
}

interface TableInfo { name: string; rows: number; }

// ─── Tabs ──────────────────────────────────────────────────────

type Tab = 'overview' | 'students' | 'content' | 'system' | 'api';

// ─── Component ─────────────────────────────────────────────────

export default function AdminPanel() {
  const [tab, setTab] = useState<Tab>('overview');
  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    authedFetch('/api/v1/admin/analytics/overview')
      .then(r => r.ok ? r.json() : Promise.reject('Access denied'))
      .then(setOverview)
      .catch(e => setError(String(e)))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Loader />;
  if (error) return <div className="p-4 text-center text-red-400">{error}</div>;

  const tabs: { key: Tab; label: string; icon: string }[] = [
    { key: 'overview', label: 'Overview', icon: '📊' },
    { key: 'students', label: 'Students', icon: '👥' },
    { key: 'content', label: 'Content', icon: '📝' },
    { key: 'system', label: 'System', icon: '⚙️' },
    { key: 'api', label: 'API Docs', icon: '🔗' },
  ];

  return (
    <div className="min-h-screen bg-tg-bg text-tg-text">
      {/* Tab bar */}
      <div className="flex border-b border-tg-hint/20 overflow-x-auto">
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`flex-1 min-w-[80px] py-3 px-2 text-xs font-medium text-center transition-colors
              ${tab === t.key ? 'border-b-2 border-tg-button text-tg-button' : 'text-tg-hint'}`}>
            <span className="block text-base mb-0.5">{t.icon}</span>
            {t.label}
          </button>
        ))}
      </div>

      <div className="p-4 max-w-3xl mx-auto pb-24">
        {tab === 'overview' && <OverviewTab data={overview!} />}
        {tab === 'students' && <StudentsTab />}
        {tab === 'content' && <ContentTab />}
        {tab === 'system' && <SystemTab />}
        {tab === 'api' && <ApiDocsTab />}
      </div>
    </div>
  );
}

// ─── Overview Tab ──────────────────────────────────────────────

function OverviewTab({ data }: { data: Overview }) {
  const [trends, setTrends] = useState<Trends | null>(null);

  useEffect(() => {
    authedFetch('/api/v1/admin/analytics/trends?days=14')
      .then(r => r.ok ? r.json() : null).then(setTrends).catch(() => {});
  }, []);

  return (
    <div>
      <h1 className="text-xl font-bold mb-4">Admin Dashboard</h1>

      {/* Teacher Dashboard Link */}
      <Link to="/admin/teacher"
        className="block bg-gradient-to-r from-tg-button/20 to-tg-button/5 border border-tg-button/30 rounded-xl p-3 mb-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-bold text-sm">📊 Teacher Dashboard</p>
            <p className="text-[10px] text-tg-hint">Alerts, weakness heatmap, score trends, engagement</p>
          </div>
          <span className="text-tg-button text-lg">→</span>
        </div>
      </Link>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <StatCard label="Total Users" value={data.total_users} icon="👥" />
        <StatCard label="Active Today" value={data.active_today} icon="🟢" />
        <StatCard label="Active This Week" value={data.active_this_week} icon="📈" />
        <StatCard label="Premium Users" value={data.premium_users} icon="⭐" />
        <StatCard label="Questions Answered" value={data.total_questions_answered.toLocaleString()} icon="📝" />
        <StatCard label="Weekly Accuracy" value={`${data.weekly_accuracy}%`} icon="🎯" />
        <StatCard label="Content Bank" value={data.published_content.toLocaleString()} icon="📚" />
        <StatCard label="Completed Tests" value={data.completed_attempts.toLocaleString()} icon="✅" />
      </div>

      {/* Section breakdown */}
      <h2 className="font-bold mb-2">Section Performance</h2>
      <div className="bg-tg-section rounded-xl p-3 mb-6">
        {data.section_breakdown.map(s => {
          const acc = s.total > 0 ? Math.round((s.correct / s.total) * 100) : 0;
          return (
            <div key={s.section} className="flex items-center justify-between py-2 border-b border-tg-hint/10 last:border-0">
              <span className="font-medium capitalize">{s.section || 'N/A'}</span>
              <div className="flex items-center gap-3">
                <span className="text-xs text-tg-hint">{s.total} Q</span>
                <div className="w-20 bg-tg-hint/20 rounded-full h-2">
                  <div className="h-2 rounded-full bg-tg-button" style={{ width: `${acc}%` }} />
                </div>
                <span className="text-sm font-medium w-10 text-right">{acc}%</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Top students */}
      <h2 className="font-bold mb-2">Top Students This Week</h2>
      <div className="bg-tg-section rounded-xl p-3 mb-6">
        {data.top_students_this_week.length === 0 ? (
          <p className="text-tg-hint text-sm py-2">No activity this week</p>
        ) : data.top_students_this_week.map((s, i) => (
          <div key={s.id} className="flex items-center justify-between py-2 border-b border-tg-hint/10 last:border-0">
            <div className="flex items-center gap-2">
              <span className="text-lg">{i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i+1}`}</span>
              <span className="font-medium">{s.name}</span>
            </div>
            <div className="text-sm text-tg-hint">{s.questions}Q · {s.accuracy}%</div>
          </div>
        ))}
      </div>

      {/* Activity trend */}
      {trends && trends.daily_activity.length > 0 && (
        <>
          <h2 className="font-bold mb-2">14-Day Activity</h2>
          <div className="bg-tg-section rounded-xl p-3 mb-6 overflow-x-auto">
            <div className="flex items-end gap-1 h-24 min-w-[300px]">
              {trends.daily_activity.map(d => {
                const max = Math.max(...trends.daily_activity.map(x => x.questions_answered), 1);
                const h = Math.max((d.questions_answered / max) * 100, 4);
                return (
                  <div key={d.date} className="flex-1 flex flex-col items-center">
                    <div className="w-full bg-tg-button/80 rounded-t" style={{ height: `${h}%` }}
                      title={`${d.date}: ${d.questions_answered}Q, ${d.active_users} users`} />
                    <span className="text-[9px] text-tg-hint mt-1">{d.date.slice(5)}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Students Tab ──────────────────────────────────────────────

function StudentsTab() {
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [selectedStudent, setSelectedStudent] = useState<StudentDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const fetchStudents = (p: number, q: string) => {
    setLoading(true);
    authedFetch(`/api/v1/admin/students?page=${p}&limit=20&search=${encodeURIComponent(q)}&sort=created_at&order=desc`)
      .then(r => r.json())
      .then(data => {
        setStudents(data.students || []);
        setTotal(data.pagination?.total || 0);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchStudents(page, search); }, [page]);

  const openStudent = (id: number) => {
    setDetailLoading(true);
    authedFetch(`/api/v1/admin/students/${id}`)
      .then(r => r.json())
      .then(setSelectedStudent)
      .catch(() => {})
      .finally(() => setDetailLoading(false));
  };

  if (selectedStudent) return <StudentDetailView data={selectedStudent} onBack={() => setSelectedStudent(null)} />;

  return (
    <div>
      <h1 className="text-xl font-bold mb-4">Students ({total})</h1>

      <div className="flex gap-2 mb-4">
        <input type="text" placeholder="Search by name or username..."
          className="flex-1 bg-tg-section rounded-lg px-3 py-2 text-sm outline-none"
          value={search} onChange={e => setSearch(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { setPage(1); fetchStudents(1, search); } }} />
        <button onClick={() => { setPage(1); fetchStudents(1, search); }}
          className="bg-tg-button text-white px-4 py-2 rounded-lg text-sm font-medium">Search</button>
      </div>

      {loading ? <Loader /> : (
        <div className="space-y-2">
          {students.map(s => (
            <div key={s.id} onClick={() => openStudent(s.id)}
              className="bg-tg-section rounded-xl p-3 cursor-pointer active:opacity-80">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{s.name}</span>
                  {s.is_premium === 1 && <span className="text-xs bg-yellow-500/20 text-yellow-400 px-1.5 py-0.5 rounded">⭐ Premium</span>}
                  <span className={`text-xs px-1.5 py-0.5 rounded ${
                    s.role === 'admin' ? 'bg-red-500/20 text-red-400' :
                    s.role === 'teacher' ? 'bg-blue-500/20 text-blue-400' :
                    'bg-gray-500/20 text-gray-400'}`}>{s.role}</span>
                </div>
                <span className="text-xs text-tg-hint">{s.target_test || '—'}</span>
              </div>
              <div className="flex items-center gap-4 text-xs text-tg-hint">
                <span>📝 {s.questions_answered || 0}Q</span>
                <span>🎯 {s.accuracy != null ? `${s.accuracy}%` : '—'}</span>
                <span>🔄 {s.due_reviews || 0} due</span>
                {s.last_activity && <span>🕐 {new Date(s.last_activity).toLocaleDateString()}</span>}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {total > 20 && (
        <div className="flex items-center justify-center gap-4 mt-4">
          <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}
            className="text-sm text-tg-button disabled:opacity-30">← Prev</button>
          <span className="text-sm text-tg-hint">Page {page} of {Math.ceil(total / 20)}</span>
          <button disabled={page >= Math.ceil(total / 20)} onClick={() => setPage(p => p + 1)}
            className="text-sm text-tg-button disabled:opacity-30">Next →</button>
        </div>
      )}

      {detailLoading && <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"><Loader /></div>}
    </div>
  );
}

// ─── Student Detail View ───────────────────────────────────────

function StudentDetailView({ data, onBack }: { data: StudentDetail; onBack: () => void }) {
  const u = data.user;
  const sr = data.spaced_repetition;

  return (
    <div>
      <button onClick={onBack} className="text-tg-button text-sm mb-3">← Back to list</button>
      <h1 className="text-xl font-bold mb-1">{u.name}</h1>
      <p className="text-sm text-tg-hint mb-4">@{u.username || 'no username'} · {u.role} · {u.target_test || 'No target'} · {u.proficiency_level || 'Unknown level'}</p>

      {/* Section breakdown */}
      {data.section_breakdown.length > 0 && (
        <div className="bg-tg-section rounded-xl p-3 mb-4">
          <h3 className="font-bold text-sm mb-2">Section Accuracy</h3>
          {data.section_breakdown.map((s: any) => {
            const acc = s.total > 0 ? Math.round((s.correct / s.total) * 100) : 0;
            return (
              <div key={s.section} className="flex items-center justify-between py-1.5">
                <span className="text-sm capitalize">{s.section}</span>
                <div className="flex items-center gap-2">
                  <div className="w-16 bg-tg-hint/20 rounded-full h-1.5">
                    <div className="h-1.5 rounded-full bg-tg-button" style={{ width: `${acc}%` }} />
                  </div>
                  <span className="text-xs w-10 text-right">{acc}% ({s.total})</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* SRS stats */}
      {sr && (
        <div className="bg-tg-section rounded-xl p-3 mb-4">
          <h3 className="font-bold text-sm mb-2">Spaced Repetition</h3>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div>Total items: <b>{sr.total || 0}</b></div>
            <div>Overdue: <b className="text-orange-400">{sr.overdue || 0}</b></div>
            <div>Mastered: <b className="text-green-400">{sr.mastered || 0}</b></div>
            <div>Avg level: <b>{sr.avg_level != null ? Number(sr.avg_level).toFixed(1) : '—'}</b></div>
          </div>
        </div>
      )}

      {/* Mental model */}
      {data.mental_model.length > 0 && (
        <div className="bg-tg-section rounded-xl p-3 mb-4">
          <h3 className="font-bold text-sm mb-2">Mental Model ({data.mental_model.length} concepts)</h3>
          <div className="space-y-1 max-h-48 overflow-y-auto">
            {data.mental_model.map((m: any) => (
              <div key={m.concept} className="flex items-center justify-between text-xs py-1">
                <span>{m.concept}</span>
                <span className={`px-1.5 py-0.5 rounded ${
                  m.believed_understanding === 'mastered' ? 'bg-green-500/20 text-green-400' :
                  m.believed_understanding === 'solid' ? 'bg-blue-500/20 text-blue-400' :
                  m.believed_understanding === 'partial' ? 'bg-yellow-500/20 text-yellow-400' :
                  m.believed_understanding === 'misconception' ? 'bg-red-500/20 text-red-400' :
                  'bg-gray-500/20 text-gray-400'}`}>{m.believed_understanding}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Topic mastery */}
      {data.mastery.length > 0 && (
        <div className="bg-tg-section rounded-xl p-3 mb-4">
          <h3 className="font-bold text-sm mb-2">Topic Mastery</h3>
          <div className="space-y-1 max-h-48 overflow-y-auto">
            {data.mastery.map((m: any) => (
              <div key={m.topic} className="flex items-center justify-between text-xs py-1">
                <span>{m.topic}</span>
                <div className="flex items-center gap-2">
                  <div className="w-12 bg-tg-hint/20 rounded-full h-1.5">
                    <div className="h-1.5 rounded-full bg-tg-button" style={{ width: `${m.mastery_level || 0}%` }} />
                  </div>
                  <span className="w-8 text-right">{m.accuracy_percent || 0}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Lesson plans */}
      {data.lesson_plans.length > 0 && (
        <div className="bg-tg-section rounded-xl p-3 mb-4">
          <h3 className="font-bold text-sm mb-2">Lesson Plans</h3>
          {data.lesson_plans.map((lp: any) => (
            <div key={lp.id} className="flex items-center justify-between py-1.5 text-sm border-b border-tg-hint/10 last:border-0">
              <span>{lp.title}</span>
              <div className="flex items-center gap-2 text-xs">
                <span className={lp.status === 'active' ? 'text-green-400' : 'text-tg-hint'}>{lp.status}</span>
                <span>{lp.progress_percent || 0}%</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Recent attempts */}
      {data.recent_attempts.length > 0 && (
        <div className="bg-tg-section rounded-xl p-3 mb-4">
          <h3 className="font-bold text-sm mb-2">Recent Tests</h3>
          {data.recent_attempts.slice(0, 10).map((a: any) => (
            <div key={a.id} className="flex items-center justify-between py-1.5 text-xs border-b border-tg-hint/10 last:border-0">
              <span>{a.section || a.test_type}</span>
              <div className="flex items-center gap-3">
                <span>{a.score}/{a.total_questions}</span>
                <span className="text-tg-hint">{new Date(a.created_at).toLocaleDateString()}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Content Tab ───────────────────────────────────────────────

function ContentTab() {
  const [coverage, setCoverage] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    authedFetch('/api/v1/admin/analytics/content-coverage')
      .then(r => r.json()).then(setCoverage).catch(() => {}).finally(() => setLoading(false));
  }, []);

  if (loading) return <Loader />;

  return (
    <div>
      <h1 className="text-xl font-bold mb-4">Content Bank</h1>

      {coverage?.by_section && (
        <div className="bg-tg-section rounded-xl p-3 mb-4">
          <h3 className="font-bold text-sm mb-2">By Section</h3>
          {coverage.by_section.map((s: any) => (
            <div key={s.section} className="flex items-center justify-between py-2 border-b border-tg-hint/10 last:border-0">
              <span className="font-medium capitalize">{s.section}</span>
              <span className="text-sm">{s.count} questions</span>
            </div>
          ))}
        </div>
      )}

      {coverage?.detailed && (
        <div className="bg-tg-section rounded-xl p-3 mb-4">
          <h3 className="font-bold text-sm mb-2">Detailed Coverage</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-tg-hint border-b border-tg-hint/20">
                  <th className="text-left py-1.5">Section</th>
                  <th className="text-left py-1.5">Type</th>
                  <th className="text-center py-1.5">Diff</th>
                  <th className="text-right py-1.5">Count</th>
                </tr>
              </thead>
              <tbody>
                {coverage.detailed.map((r: any, i: number) => (
                  <tr key={i} className="border-b border-tg-hint/5">
                    <td className="py-1 capitalize">{r.section}</td>
                    <td className="py-1">{r.question_type}</td>
                    <td className="py-1 text-center">{'⭐'.repeat(r.difficulty)}</td>
                    <td className="py-1 text-right font-medium">{r.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="flex gap-2">
        <button onClick={() => window.open('/api/v1/admin/export/content?format=csv', '_blank')}
          className="bg-tg-button text-white px-4 py-2 rounded-lg text-sm">Export CSV</button>
      </div>
    </div>
  );
}

// ─── System Tab ────────────────────────────────────────────────

function SystemTab() {
  const [tables, setTables] = useState<TableInfo[]>([]);
  const [health, setHealth] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [queryResult, setQueryResult] = useState<any>(null);
  const [sql, setSql] = useState('');
  const [queryLoading, setQueryLoading] = useState(false);

  useEffect(() => {
    Promise.all([
      authedFetch('/api/v1/admin/system/tables').then(r => r.json()),
      authedFetch('/api/v1/admin/system/health').then(r => r.json()),
    ]).then(([t, h]) => {
      setTables(t.tables || []);
      setHealth(h);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const runQuery = () => {
    if (!sql.trim()) return;
    setQueryLoading(true);
    authedFetch('/api/v1/admin/system/query', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sql }),
    }).then(r => r.json()).then(setQueryResult).catch(e => setQueryResult({ error: String(e) }))
      .finally(() => setQueryLoading(false));
  };

  if (loading) return <Loader />;

  return (
    <div>
      <h1 className="text-xl font-bold mb-4">System</h1>

      {/* Health */}
      {health && (
        <div className="bg-tg-section rounded-xl p-3 mb-4">
          <div className="flex items-center gap-2 mb-2">
            <span className={`w-3 h-3 rounded-full ${health.status === 'healthy' ? 'bg-green-400' : 'bg-yellow-400'}`} />
            <h3 className="font-bold text-sm">Status: {health.status}</h3>
          </div>
          {Object.entries(health.checks || {}).map(([key, val]: [string, any]) => (
            <div key={key} className="flex items-center justify-between py-1 text-xs">
              <span>{key}</span>
              <span className={val.status === 'ok' || val.status === 'configured' ? 'text-green-400' : 'text-red-400'}>
                {val.status} {val.users ? `(${val.users} users)` : ''} {val.published ? `(${val.published} Q)` : ''}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Tables */}
      <div className="bg-tg-section rounded-xl p-3 mb-4">
        <h3 className="font-bold text-sm mb-2">Database Tables ({tables.length})</h3>
        <div className="max-h-60 overflow-y-auto space-y-0.5">
          {tables.sort((a, b) => b.rows - a.rows).map(t => (
            <div key={t.name} className="flex items-center justify-between text-xs py-1">
              <span className="font-mono">{t.name}</span>
              <span className="text-tg-hint">{t.rows >= 0 ? t.rows.toLocaleString() : 'err'}</span>
            </div>
          ))}
        </div>
      </div>

      {/* SQL Console */}
      <div className="bg-tg-section rounded-xl p-3 mb-4">
        <h3 className="font-bold text-sm mb-2">SQL Console (read-only)</h3>
        <textarea value={sql} onChange={e => setSql(e.target.value)}
          className="w-full bg-black/20 rounded-lg p-2 text-xs font-mono h-20 outline-none resize-none"
          placeholder="SELECT COUNT(*) FROM users WHERE role = 'student'" />
        <button onClick={runQuery} disabled={queryLoading}
          className="bg-tg-button text-white px-4 py-1.5 rounded-lg text-xs mt-2 disabled:opacity-50">
          {queryLoading ? 'Running...' : 'Run Query'}
        </button>
        {queryResult && (
          <div className="mt-2 overflow-x-auto">
            {queryResult.error ? (
              <p className="text-red-400 text-xs">{queryResult.error}</p>
            ) : (
              <table className="w-full text-xs font-mono">
                {queryResult.results?.length > 0 && (
                  <>
                    <thead>
                      <tr className="text-tg-hint border-b border-tg-hint/20">
                        {Object.keys(queryResult.results[0]).map((k: string) => (
                          <th key={k} className="text-left py-1 pr-3">{k}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {queryResult.results.slice(0, 50).map((row: any, i: number) => (
                        <tr key={i} className="border-b border-tg-hint/5">
                          {Object.values(row).map((v: any, j: number) => (
                            <td key={j} className="py-1 pr-3 max-w-[200px] truncate">{String(v ?? '')}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </>
                )}
              </table>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── API Docs Tab ──────────────────────────────────────────────

function ApiDocsTab() {
  const baseUrl = 'https://edubot-api.edubot-leonardus.workers.dev';
  const endpoints = [
    { method: 'GET', path: '/api/v1/admin/students', desc: 'List students (paginated, searchable)' },
    { method: 'GET', path: '/api/v1/admin/students/:id', desc: 'Deep student profile with all data' },
    { method: 'PUT', path: '/api/v1/admin/students/:id/role', desc: 'Update student role' },
    { method: 'PUT', path: '/api/v1/admin/students/:id/profile', desc: 'Update student profile fields' },
    { method: 'DELETE', path: '/api/v1/admin/students/:id', desc: 'Ban a student (soft delete)' },
    { method: 'GET', path: '/api/v1/admin/analytics/overview', desc: 'System-wide dashboard stats' },
    { method: 'GET', path: '/api/v1/admin/analytics/trends', desc: 'Daily activity trends' },
    { method: 'GET', path: '/api/v1/admin/analytics/content-coverage', desc: 'Question bank distribution' },
    { method: 'GET', path: '/api/v1/admin/mental-model/:userId', desc: 'Student mental model' },
    { method: 'PUT', path: '/api/v1/admin/mental-model/:userId/:concept', desc: 'Adjust mental model' },
    { method: 'GET', path: '/api/v1/admin/lessons', desc: 'List lesson plans (filterable)' },
    { method: 'GET', path: '/api/v1/admin/lessons/:id', desc: 'Lesson plan detail' },
    { method: 'DELETE', path: '/api/v1/admin/lessons/:id', desc: 'Archive lesson plan' },
    { method: 'GET', path: '/api/v1/admin/content', desc: 'List content (filtered, paginated)' },
    { method: 'POST', path: '/api/v1/admin/content/bulk-status', desc: 'Bulk update content status' },
    { method: 'POST', path: '/api/v1/admin/content/bulk-insert', desc: 'Bulk insert questions' },
    { method: 'GET', path: '/api/v1/admin/classes', desc: 'List classes with member counts' },
    { method: 'GET', path: '/api/v1/admin/classes/:id/students', desc: 'Students in a class' },
    { method: 'GET', path: '/api/v1/admin/srs/overview', desc: 'SRS system stats' },
    { method: 'GET', path: '/api/v1/admin/premium/overview', desc: 'Premium/revenue stats' },
    { method: 'GET', path: '/api/v1/admin/system/tables', desc: 'Database tables + row counts' },
    { method: 'GET', path: '/api/v1/admin/system/health', desc: 'Deep health check' },
    { method: 'POST', path: '/api/v1/admin/system/query', desc: 'Run read-only SQL' },
    { method: 'GET', path: '/api/v1/admin/export/students', desc: 'Export students (JSON/CSV)' },
    { method: 'GET', path: '/api/v1/admin/export/content', desc: 'Export content (JSON/CSV)' },
  ];

  return (
    <div>
      <h1 className="text-xl font-bold mb-2">API Documentation</h1>
      <p className="text-sm text-tg-hint mb-4">
        Use these endpoints from any external app. Authenticate with the <code className="bg-black/20 px-1 rounded">X-API-Key</code> header.
      </p>

      <div className="bg-tg-section rounded-xl p-3 mb-4">
        <h3 className="font-bold text-sm mb-2">Authentication</h3>
        <div className="text-xs font-mono bg-black/20 rounded-lg p-2">
          <p className="text-tg-hint"># API Key auth (recommended for external apps)</p>
          <p>curl -H "X-API-Key: YOUR_KEY" \</p>
          <p>  {baseUrl}/api/v1/admin/students</p>
          <p className="mt-2 text-tg-hint"># Set your API key as a Worker secret:</p>
          <p>npx wrangler secret put ADMIN_API_KEY</p>
        </div>
      </div>

      <div className="bg-tg-section rounded-xl p-3 mb-4">
        <h3 className="font-bold text-sm mb-2">Endpoints ({endpoints.length})</h3>
        <div className="space-y-1">
          {endpoints.map((ep, i) => (
            <div key={i} className="flex items-start gap-2 py-1.5 border-b border-tg-hint/5 last:border-0">
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0 ${
                ep.method === 'GET' ? 'bg-green-500/20 text-green-400' :
                ep.method === 'POST' ? 'bg-blue-500/20 text-blue-400' :
                ep.method === 'PUT' ? 'bg-yellow-500/20 text-yellow-400' :
                'bg-red-500/20 text-red-400'}`}>{ep.method}</span>
              <div>
                <p className="text-xs font-mono">{ep.path}</p>
                <p className="text-[10px] text-tg-hint">{ep.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-tg-section rounded-xl p-3 mb-4">
        <h3 className="font-bold text-sm mb-2">Example: Bulk Insert Questions</h3>
        <div className="text-xs font-mono bg-black/20 rounded-lg p-2 overflow-x-auto">
          <pre>{`curl -X POST \\
  -H "X-API-Key: YOUR_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "questions": [{
      "section": "reading",
      "question_type": "inference",
      "topic": "reading_strategy",
      "difficulty": 3,
      "content": "Based on the passage...",
      "passage": "The full passage text...",
      "options": ["A) opt1", "B) opt2", "C) opt3", "D) opt4"],
      "correct_answer": "B",
      "explanation": "Because...",
      "skill_tags": "inference,reading"
    }]
  }' \\
  ${baseUrl}/api/v1/admin/content/bulk-insert`}</pre>
        </div>
      </div>
    </div>
  );
}

// ─── Shared Components ─────────────────────────────────────────

function StatCard({ label, value, icon }: { label: string; value: string | number; icon: string }) {
  return (
    <div className="bg-tg-section rounded-xl p-3">
      <div className="flex items-center gap-2 mb-1">
        <span>{icon}</span>
        <span className="text-xs text-tg-hint">{label}</span>
      </div>
      <span className="text-lg font-bold">{value}</span>
    </div>
  );
}

function Loader() {
  return (
    <div className="flex items-center justify-center py-12">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-tg-button" />
    </div>
  );
}
