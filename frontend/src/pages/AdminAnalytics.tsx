import { useEffect, useState } from 'react';

const WORKER_BASE = 'https://edubot-api.edubot-leonardus.workers.dev';
const ADMIN_SECRET = 'bayuganteng';

async function adminFetch(url: string): Promise<Response> {
  const fullUrl = url.startsWith('/api') ? `${WORKER_BASE}${url}` : url;
  return fetch(fullUrl, {
    headers: {
      'x-admin-secret': ADMIN_SECRET,
    },
  });
}

interface ClassInfo {
  id: number;
  name: string;
  invite_code: string;
  student_count: number;
}

interface StudentSummary {
  id: number;
  name: string;
  username: string | null;
  target_test: string | null;
  current_streak: number;
  longest_streak: number;
  last_study_date: string | null;
  xp: number;
  level: number;
  total_questions: number;
  is_premium: boolean;
  estimated_band: number | null;
  week_stats: {
    questions: number;
    accuracy: number;
    minutes: number;
    active_days: number;
  };
}

interface StudentAnalytics {
  total_questions: number;
  total_correct: number;
  total_time_minutes: number;
  total_messages: number;
  total_sessions: number;
  tests_completed: number;
  current_streak: number;
  longest_streak: number;
  overall_accuracy: number;
  section_accuracy: Record<string, number>;
  weakest_section: string | null;
  weakest_accuracy: number;
  study_tendency: {
    preferred_time: string;
    avg_session_minutes: number;
    avg_questions_per_session: number;
    most_active_day: string | null;
    weekly_frequency: number;
    last_7_days_minutes: number;
    last_7_days_questions: number;
  };
  skills: Array<{
    skill: string;
    accuracy: number;
    attempts: number;
    time_minutes: number;
    trend: 'up' | 'down' | 'stable';
    trend_delta: number;
  }>;
  diagnostic: {
    grammar: { score: number; total: number };
    vocab: { score: number; total: number };
    reading: { score: number; total: number };
    listening: { score: number; total: number };
    writing_band: number;
    estimated_band: number;
    completed_at: string;
  } | null;
  daily_logs: Array<{
    date: string;
    questions: number;
    time_minutes: number;
    accuracy: number;
    messages: number;
    sessions: number;
    tests: number;
  }>;
  percentile: number;
}

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return 'Never';
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHrs = Math.floor(diffMins / 60);
  if (diffHrs < 24) return `${diffHrs}h ago`;
  const diffDays = Math.floor(diffHrs / 24);
  if (diffDays < 30) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

function TrendArrow({ delta }: { delta: number }) {
  if (delta > 0) return <span className="text-green-400">▲</span>;
  if (delta < 0) return <span className="text-red-400">▼</span>;
  return <span className="text-gray-400">─</span>;
}

interface WeaknessProfile {
  user_id: number;
  user_name: string;
  diagnostic: {
    has_diagnostic: boolean;
    grammar_score: number | null;
    grammar_total: number;
    vocab_score: number | null;
    vocab_total: number;
    reading_score: number | null;
    reading_total: number;
    listening_score: number | null;
    listening_total: number;
    writing_band: number | null;
    estimated_band: number | null;
  };
  practice: {
    total_questions: number;
    listening: { attempted: number; correct: number; accuracy: number } | null;
    reading: { attempted: number; correct: number; accuracy: number } | null;
    speaking: { attempted: number; correct: number; accuracy: number } | null;
    writing: { attempted: number; correct: number; accuracy: number } | null;
  };
  chat: {
    total_messages: number;
    top_topics: Array<{ topic: string; count: number }>;
    confused_topics: Array<{ topic: string; count: number }>;
  };
  weaknesses: {
    from_diagnostic: string[];
    from_practice: string[];
    from_chat: string[];
    combined: Array<{ skill: string; priority: 'high' | 'medium' | 'low'; evidence: string[] }>;
  };
  recommendation: {
    priority: 'critical' | 'high' | 'medium' | 'low';
    focus_areas: string[];
    action: string;
  };
}

export default function AdminAnalytics() {
  const [classes, setClasses] = useState<ClassInfo[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<number | 'all' | null>(null);
  const [students, setStudents] = useState<StudentSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [expandedStudent, setExpandedStudent] = useState<number | null>(null);
  const [studentAnalytics, setStudentAnalytics] = useState<Record<number, StudentAnalytics>>({});
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'overview' | 'weakness'>('overview');
  const [weaknessProfiles, setWeaknessProfiles] = useState<WeaknessProfile[]>([]);
  const [loadingWeakness, setLoadingWeakness] = useState(false);

  useEffect(() => {
    loadClasses();
  }, []);

  useEffect(() => {
    if (selectedClassId) {
      setError(null);
      loadStudents(selectedClassId);
    } else {
      setStudents([]);
    }
  }, [selectedClassId]);

  useEffect(() => {
    if (viewMode === 'weakness' && selectedClassId) {
      loadWeaknessProfiles();
    }
  }, [viewMode, selectedClassId]);

  async function loadWeaknessProfiles() {
    setLoadingWeakness(true);
    try {
      const res = await adminFetch('/api/weakness/all-students');
      if (res.ok) {
        const data = await res.json();
        setWeaknessProfiles(data.profiles || []);
      } else {
        console.error('loadWeaknessProfiles error:', res.status);
      }
    } catch (e) {
      console.error('loadWeaknessProfiles exception:', e);
    } finally {
      setLoadingWeakness(false);
    }
  }

  async function loadClasses() {
    try {
      const res = await adminFetch('/api/classes');
      if (res.ok) setClasses(await res.json());
      else console.error('loadClasses error:', res.status, await res.text());
    } finally {
      setLoading(false);
    }
  }

  async function loadStudents(classId: number | 'all') {
    setLoadingStudents(true);
    setExpandedStudent(null);
    setStudentAnalytics({});
    try {
      const endpoint = classId === 'all'
        ? '/api/classes/all/students'
        : `/api/analytics/class/${classId}/students`;
      const res = await adminFetch(endpoint);
      const text = await res.text();
      console.log('loadStudents response status:', res.status, 'body preview:', text.substring(0, 200));
      if (!res.ok) {
        setError(`Error ${res.status}: ${text}`);
        return;
      }
      const body = JSON.parse(text);
      setStudents(Array.isArray(body) ? body : (body.students || []));
    } catch (e: any) {
      console.error('loadStudents exception:', e);
      setError(`Exception: ${e.message}`);
    } finally {
      setLoadingStudents(false);
    }
  }

  async function loadStudentAnalytics(userId: number) {
    if (studentAnalytics[userId]) return;
    setLoadingAnalytics(true);
    try {
      const res = await adminFetch(`/api/analytics/student/${userId}`);
      if (res.ok) {
        const data = await res.json();
        setStudentAnalytics(prev => ({ ...prev, [userId]: data }));
      }
    } finally {
      setLoadingAnalytics(false);
    }
  }

  function toggleStudent(id: number) {
    if (expandedStudent === id) {
      setExpandedStudent(null);
    } else {
      setExpandedStudent(id);
      loadStudentAnalytics(id);
    }
  }

  function ChartBar({ value, max, color }: { value: number; max: number; color: string }) {
    const height = max > 0 ? Math.max((value / max) * 100, 4) : 4;
    return (
      <div className="flex flex-col items-center gap-1">
        <div className="w-4 rounded-sm" style={{ height: `${height}%`, backgroundColor: color, minHeight: '4px' }} />
      </div>
    );
  }

  function MiniChart({ logs }: { logs: StudentAnalytics['daily_logs'] }) {
    if (!logs || logs.length === 0) {
      return <p className="text-xs text-tg-hint py-2">No activity data yet</p>;
    }
    const maxQ = Math.max(...logs.map(l => l.questions), 1);
    const maxM = Math.max(...logs.map(l => l.time_minutes), 1);
    return (
      <div className="flex gap-1 items-end h-12">
        {logs.slice(-14).map((l, i) => (
          <div key={i} className="flex flex-col items-center gap-0.5 flex-1">
            <div className="flex gap-px items-end h-8 w-full">
              <div
                className="flex-1 rounded-sm"
                style={{
                  height: `${maxQ > 0 ? (l.questions / maxQ) * 100 : 4}%`,
                  backgroundColor: '#3b82f6',
                  minHeight: '2px',
                }}
                title={`${l.questions} questions`}
              />
              <div
                className="flex-1 rounded-sm"
                style={{
                  height: `${maxM > 0 ? (l.time_minutes / maxM) * 100 : 4}%`,
                  backgroundColor: '#f59e0b',
                  minHeight: '2px',
                }}
                title={`${l.time_minutes}m`}
              />
            </div>
            <span className="text-[8px] text-tg-hint">
              {new Date(l.date).toLocaleDateString('en', { month: 'short', day: 'numeric' })}
            </span>
          </div>
        ))}
      </div>
    );
  }

  function FullChart({ logs }: { logs: StudentAnalytics['daily_logs'] }) {
    if (!logs || logs.length === 0) {
      return <p className="text-xs text-tg-hint py-4 text-center">No activity data yet</p>;
    }
    const maxQ = Math.max(...logs.map(l => l.questions), 1);
    const maxA = 100;
    return (
      <div>
        <div className="flex gap-1 items-end" style={{ height: '80px' }}>
          {logs.map((l, i) => (
            <div key={i} className="flex flex-col items-center gap-0.5 flex-1">
              <div className="flex gap-px items-end w-full h-full">
                <div
                  className="flex-1 rounded-t-sm"
                  style={{
                    height: `${maxQ > 0 ? (l.questions / maxQ) * 100 : 0}%`,
                    backgroundColor: '#3b82f6',
                    minHeight: l.questions > 0 ? '2px' : '0',
                  }}
                  title={`${l.questions} questions`}
                />
                <div
                  className="flex-1 rounded-t-sm"
                  style={{
                    height: `${l.accuracy}%`,
                    backgroundColor: '#22c55e',
                    minHeight: l.accuracy > 0 ? '2px' : '0',
                  }}
                  title={`${l.accuracy}% accuracy`}
                />
              </div>
            </div>
          ))}
        </div>
        <div className="flex justify-between mt-1">
          {logs.length > 0 && (
            <>
              <span className="text-[8px] text-tg-hint">
                {new Date(logs[0].date).toLocaleDateString('en', { month: 'short', day: 'numeric' })}
              </span>
              <span className="text-[8px] text-tg-hint">
                {new Date(logs[logs.length - 1].date).toLocaleDateString('en', { month: 'short', day: 'numeric' })}
              </span>
            </>
          )}
        </div>
        <div className="flex gap-3 mt-2 text-[10px] text-tg-hint">
          <span>■ Questions</span>
          <span>■ Accuracy%</span>
        </div>
      </div>
    );
  }

  function SectionBars({ sections }: { sections: Record<string, number> }) {
    const entries = Object.entries(sections).sort(([, a], [, b]) => a - b);
    if (entries.length === 0) return <p className="text-xs text-tg-hint">No section data</p>;
    const max = 100;
    return (
      <div className="space-y-2">
        {entries.map(([section, accuracy]) => {
          const color = accuracy >= 70 ? '#22c55e' : accuracy >= 50 ? '#f59e0b' : '#ef4444';
          return (
            <div key={section} className="flex items-center gap-2">
              <span className="text-xs capitalize w-20 truncate">{section}</span>
              <div className="flex-1 bg-tg-bg rounded-full h-2">
                <div
                  className="h-2 rounded-full"
                  style={{ width: `${accuracy}%`, backgroundColor: color }}
                />
              </div>
              <span className="text-xs font-bold w-8 text-right" style={{ color }}>{accuracy}%</span>
            </div>
          );
        })}
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-tg-button"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 max-w-2xl mx-auto">
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4">
          <p className="text-red-700 font-medium mb-1">Error:</p>
          <pre className="text-red-600 text-xs whitespace-pre-wrap">{error}</pre>
        </div>
        <button onClick={() => { setError(null); setLoading(true); loadClasses(); }} className="bg-tg-button text-tg-button-text px-4 py-2 rounded-lg text-sm">
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="p-4 max-w-2xl mx-auto pb-8">
      <h1 className="text-2xl font-bold mb-1">Class Analytics</h1>
      <p className="text-tg-hint text-sm mb-6">Detailed student performance & study patterns</p>

      {!selectedClassId ? (
        <>
          <button
            onClick={() => setSelectedClassId('all')}
            className="w-full bg-tg-button text-tg-button-text rounded-xl p-4 flex items-center justify-between text-left shadow-sm mb-4"
          >
            <div>
              <h3 className="font-bold text-lg">System-wide</h3>
              <p className="text-xs mt-1 text-white/80">All registered students</p>
            </div>
            <div className="text-xl font-bold">&rarr;</div>
          </button>

          <h2 className="text-lg font-semibold mb-3">Your Classes</h2>
          {classes.length === 0 ? (
            <div className="bg-tg-secondary rounded-xl p-4 text-center">
              <p className="text-tg-hint text-sm">No classes yet.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {classes.map((cls) => (
                <button
                  key={cls.id}
                  onClick={() => setSelectedClassId(cls.id)}
                  className="w-full bg-tg-secondary rounded-xl p-4 flex items-center justify-between text-left"
                >
                  <div>
                    <h3 className="font-bold text-lg">{cls.name}</h3>
                    <p className="text-xs text-tg-hint font-mono mt-1">Code: {cls.invite_code}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xl font-bold text-tg-button">{cls.student_count}</p>
                    <p className="text-xs text-tg-hint">Students</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </>
      ) : (
        <>
          <button
            onClick={() => setSelectedClassId(null)}
            className="text-tg-button text-sm mb-4 font-medium"
          >
            &larr; Back
          </button>

          <div className="bg-tg-secondary rounded-xl p-4 mb-4 flex justify-between items-center">
            <span className="font-semibold text-sm">
              {selectedClassId === 'all' ? 'All Registered Students' : classes.find(c => c.id === selectedClassId)?.name}
            </span>
            <span className="text-tg-hint text-xs">{students.length} students</span>
          </div>

          {/* View Mode Toggle */}
          <div className="flex gap-2 mb-4">
            <button
              onClick={() => setViewMode('overview')}
              className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors ${
                viewMode === 'overview'
                  ? 'bg-tg-button text-tg-button-text'
                  : 'bg-tg-secondary text-tg-hint hover:bg-tg-button/20'
              }`}
            >
              📊 Overview
            </button>
            <button
              onClick={() => setViewMode('weakness')}
              className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors ${
                viewMode === 'weakness'
                  ? 'bg-tg-button text-tg-button-text'
                  : 'bg-tg-secondary text-tg-hint hover:bg-tg-button/20'
              }`}
            >
              🎯 Weakness Analysis
            </button>
          </div>

          {viewMode === 'overview' ? (
            loadingStudents ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-tg-button"></div>
              </div>
            ) : students.length === 0 ? (
              <div className="bg-tg-secondary rounded-xl p-4 text-center">
                <p className="text-tg-hint text-sm">No students found.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {students.map((student) => {
                  const isExpanded = expandedStudent === student.id;
                  const analytics = studentAnalytics[student.id];
                  return (
                    <div key={student.id} className="bg-tg-secondary rounded-xl overflow-hidden">
                      <button
                        onClick={() => toggleStudent(student.id)}
                        className="w-full p-4 flex items-center justify-between text-left"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-tg-button/20 flex items-center justify-center text-lg font-bold text-tg-button">
                            {student.name?.charAt(0)?.toUpperCase() || '?'}
                          </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="font-bold text-sm">{student.name}</h4>
                            {student.is_premium && <span className="text-yellow-400 text-xs">⭐</span>}
                            {student.current_streak > 0 && (
                              <span className="text-orange-400 text-xs">🔥{student.current_streak}d</span>
                            )}
                          </div>
                          <p className="text-xs text-tg-hint">
                            {student.target_test || 'No target'} · Level {student.level}
                            {student.estimated_band ? ` · Band ${student.estimated_band}` : ''}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {analytics && (
                          <div className="text-right hidden sm:block">
                            <p className="text-sm font-bold text-tg-button">{analytics.overall_accuracy}%</p>
                            <p className="text-[10px] text-tg-hint">accuracy</p>
                          </div>
                        )}
                        <span className="text-tg-hint">{isExpanded ? '▲' : '▼'}</span>
                      </div>
                    </button>

                    {isExpanded && (
                      <div className="border-t border-tg-hint/20 px-4 py-4 space-y-4">
                        {loadingAnalytics && !analytics ? (
                          <div className="flex justify-center py-4">
                            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-tg-button"></div>
                          </div>
                        ) : !analytics ? (
                          <div className="text-center py-4 text-tg-hint text-sm">
                            Failed to load analytics
                          </div>
                        ) : (
                          <>
                            {/* Overview Stats */}
                            <div className="grid grid-cols-4 gap-2 text-center">
                              <div className="bg-tg-bg/50 rounded-lg p-2">
                                <p className="text-sm font-bold">{analytics.total_questions}</p>
                                <p className="text-[10px] text-tg-hint">Questions</p>
                              </div>
                              <div className="bg-tg-bg/50 rounded-lg p-2">
                                <p className="text-sm font-bold text-tg-button">{analytics.overall_accuracy}%</p>
                                <p className="text-[10px] text-tg-hint">Accuracy</p>
                              </div>
                              <div className="bg-tg-bg/50 rounded-lg p-2">
                                <p className="text-sm font-bold">{analytics.current_streak}d</p>
                                <p className="text-[10px] text-tg-hint">Streak</p>
                              </div>
                              <div className="bg-tg-bg/50 rounded-lg p-2">
                                <p className="text-sm font-bold">{analytics.total_sessions}</p>
                                <p className="text-[10px] text-tg-hint">Sessions</p>
                              </div>
                            </div>

                            {/* 30-Day Activity Chart */}
                            <div className="bg-tg-bg/50 rounded-xl p-3">
                              <p className="text-xs font-semibold mb-2">📊 30-Day Activity</p>
                              <FullChart logs={analytics.daily_logs} />
                            </div>

                            {/* Two-column: Section Accuracy + Study Patterns */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              <div className="bg-tg-bg/50 rounded-xl p-3">
                                <p className="text-xs font-semibold mb-2">📐 Section Accuracy</p>
                                <SectionBars sections={analytics.section_accuracy} />
                              </div>
                              <div className="bg-tg-bg/50 rounded-xl p-3">
                                <p className="text-xs font-semibold mb-2">🕐 Study Patterns</p>
                                <div className="space-y-1 text-xs">
                                  <div className="flex justify-between">
                                    <span className="text-tg-hint">Preferred time</span>
                                    <span className="capitalize">{analytics.study_tendency.preferred_time}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-tg-hint">Most active day</span>
                                    <span>{analytics.study_tendency.most_active_day || 'N/A'}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-tg-hint">Avg session</span>
                                    <span>{analytics.study_tendency.avg_session_minutes}m</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-tg-hint">Questions/session</span>
                                    <span>{analytics.study_tendency.avg_questions_per_session}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-tg-hint">Weekly frequency</span>
                                    <span>{analytics.study_tendency.weekly_frequency}x/week</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-tg-hint">Last 7 days</span>
                                    <span>{analytics.study_tendency.last_7_days_questions}q · {analytics.study_tendency.last_7_days_minutes}m</span>
                                  </div>
                                </div>
                              </div>
                            </div>

                            {/* Skills Breakdown */}
                            {analytics.skills.length > 0 && (
                              <div className="bg-tg-bg/50 rounded-xl p-3">
                                <p className="text-xs font-semibold mb-2">🧠 Skills</p>
                                <div className="space-y-2">
                                  {analytics.skills.map((skill) => (
                                    <div key={skill.skill} className="flex items-center gap-2">
                                      <span className="text-xs w-24 truncate capitalize">{skill.skill}</span>
                                      <div className="flex-1 bg-tg-bg rounded-full h-2">
                                        <div
                                          className="h-2 rounded-full"
                                          style={{
                                            width: `${skill.accuracy}%`,
                                            backgroundColor: skill.accuracy >= 70 ? '#22c55e' : skill.accuracy >= 50 ? '#f59e0b' : '#ef4444',
                                          }}
                                        />
                                      </div>
                                      <span className="text-[10px] text-tg-hint w-10 text-right">{skill.accuracy}%</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
              </div>
            )
          ) : (
            /* Weakness Analysis View */
            loadingStudents ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-tg-button"></div>
              </div>
            ) : students.length === 0 ? (
              <div className="bg-tg-secondary rounded-xl p-4 text-center">
                <p className="text-tg-hint text-sm">No students found.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {students.map((student) => {
                  const analytics = studentAnalytics[student.id];
                  return (
                    <div key={student.id} className="bg-tg-secondary rounded-xl p-4">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-bold text-sm">{student.name}</h4>
                        {analytics?.weakest_section && (
                          <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full">
                            Weakest: {analytics.weakest_section} ({analytics.weakest_accuracy}%)
                          </span>
                        )}
                      </div>
                      {analytics ? (
                        <div className="grid grid-cols-2 gap-2">
                          {Object.entries(analytics.section_accuracy).map(([section, accuracy]) => (
                            <div key={section} className="flex items-center gap-2">
                              <span className="text-xs capitalize w-20 truncate">{section}</span>
                              <div className="flex-1 bg-tg-bg rounded-full h-2">
                                <div
                                  className="h-2 rounded-full"
                                  style={{
                                    width: `${accuracy}%`,
                                    backgroundColor: accuracy >= 70 ? '#22c55e' : accuracy >= 50 ? '#f59e0b' : '#ef4444',
                                  }}
                                />
                              </div>
                              <span className="text-[10px] text-tg-hint">{accuracy}%</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-tg-hint">Tap student in Overview to load data</p>
                      )}
                    </div>
                  );
                })}
              </div>
            )
          )}
        </>
      )}
    </div>
  );
}

// AdminAnalytics is default-exported at declaration
                     