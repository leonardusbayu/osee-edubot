import { useEffect, useState } from 'react';
import { useAuthStore } from '../stores/auth';

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

interface StudentInfo {
  id: number;
  name: string;
  username: string | null;
  role: string;
  proficiency_level: string | null;
  target_test: string | null;
  tests_taken: number;
  questions_answered: number;
  correct_answers: number;
  accuracy: number;
  study_type: 'test' | 'bot_only' | 'inactive';
  bot_questions: number;
  latest_score: number | null;
  diagnostic_band: number | null;
  last_active: string | null;
  messages_sent: number;
  last_message: string | null;
  xp: number;
  level: number;
  active_days: number;
  avg_time_per_question: number | null;
  weakest_section: string | null;
  today_usage: number;
  created_at: string;
  current_streak: number;
  longest_streak: number;
  last_study_date: string | null;
  is_premium: boolean;
  estimated_band: number | null;
  week_stats: {
    questions: number;
    accuracy: number;
    minutes: number;
    active_days: number;
    messages?: number;
  };
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

function formatDate(dateStr: string | null): string {
  if (!dateStr) return 'Never';
  return new Date(dateStr).toLocaleDateString();
}

export default function AdminStudents() {
  const { user } = useAuthStore();
  const [classes, setClasses] = useState<ClassInfo[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<number | 'all' | null>(null);
  const [students, setStudents] = useState<StudentInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedStudent, setExpandedStudent] = useState<number | null>(null);
  const [sortBy, setSortBy] = useState<'name' | 'last_active' | 'questions' | 'accuracy' | 'xp'>('last_active');
  const [targetTestFilter, setTargetTestFilter] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    loadClasses();
  }, []);

  useEffect(() => {
    if (selectedClassId) {
      loadStudents(selectedClassId);
    } else {
      setStudents([]);
    }
  }, [selectedClassId]);

  async function loadClasses() {
    try {
      const res = await adminFetch('/api/classes');
      if (res.ok) {
        setClasses(await res.json());
      }
    } catch {
      setClasses([
        { id: 1, name: 'Demo Class', invite_code: 'DEMO12', student_count: 5 },
      ]);
    } finally {
      setLoading(false);
    }
  }

  async function loadStudents(classId: number | 'all') {
    setLoadingStudents(true);
    setError(null);
    try {
      const endpoint = classId === 'all'
        ? '/api/classes/all/students'
        : `/api/analytics/class/${classId}/students`;
      const res = await adminFetch(endpoint);
      const body = await res.json();
      if (res.ok) {
        // Analytics endpoint returns { class_id, students[] }
        // Old endpoint returns array directly
        setStudents(Array.isArray(body) ? body : (body.students || []));
      } else {
        setError(`Error ${res.status}: ${body?.error || 'Unknown error'}`);
      }
    } catch (e: any) {
      setError(`Network error: ${e?.message || String(e)}`);
    } finally {
      setLoadingStudents(false);
    }
  }

  async function exportCSV() {
    setExporting(true);
    try {
      const testType = targetTestFilter || undefined;
      const url = testType ? `/api/classes/export?test_type=${testType}` : '/api/classes/export';
      const res = await adminFetch(url);
      if (res.ok) {
        const blob = await res.blob();
        const downloadUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = downloadUrl;
        a.download = `students_export_${testType || 'all'}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(downloadUrl);
      } else {
        setError('Export failed');
      }
    } catch (e: any) {
      setError(`Export error: ${e?.message || String(e)}`);
    } finally {
      setExporting(false);
    }
  }

  function getFilteredStudents(): StudentInfo[] {
    if (!targetTestFilter) return students;
    return students.filter(s => s.target_test === targetTestFilter);
  }

  function getSortedStudents(): StudentInfo[] {
    const filtered = getFilteredStudents();
    const sorted = [...filtered];
    switch (sortBy) {
      case 'last_active':
        sorted.sort((a, b) => {
          if (!a.last_active && !b.last_active) return 0;
          if (!a.last_active) return 1;
          if (!b.last_active) return -1;
          return new Date(b.last_active).getTime() - new Date(a.last_active).getTime();
        });
        break;
      case 'questions':
        sorted.sort((a, b) => b.questions_answered - a.questions_answered);
        break;
      case 'accuracy':
        sorted.sort((a, b) => b.accuracy - a.accuracy);
        break;
      case 'xp':
        sorted.sort((a, b) => b.xp - a.xp);
        break;
      default:
        sorted.sort((a, b) => a.name.localeCompare(b.name));
    }
    return sorted;
  }

  function getDiligenceLabel(s: StudentInfo): string {
    if (s.questions_answered >= 100 && s.messages_sent >= 20) return 'Highly Active';
    if (s.questions_answered >= 50 || s.messages_sent >= 10) return 'Active';
    if (s.questions_answered >= 10 || s.messages_sent >= 3) return 'Moderate';
    if (s.questions_answered > 0 || s.messages_sent > 0) return 'Low';
    return 'Inactive';
  }

  function getDiligenceColor(label: string): string {
    switch (label) {
      case 'Highly Active': return 'bg-green-500/20 text-green-400';
      case 'Active': return 'bg-blue-500/20 text-blue-400';
      case 'Moderate': return 'bg-yellow-500/20 text-yellow-400';
      case 'Low': return 'bg-orange-500/20 text-orange-400';
      default: return 'bg-gray-500/20 text-gray-400';
    }
  }

  if (user?.role === 'student') {
    return (
      <div className="flex items-center justify-center min-h-screen p-4">
        <p className="text-tg-hint">This area is for teachers and admins only.</p>
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

  return (
    <div className="p-4 max-w-lg mx-auto pb-8">
      <h1 className="text-2xl font-bold mb-6">Student Management</h1>

      {!selectedClassId ? (
        <>
          <h2 className="text-lg font-semibold mb-3">System Overview</h2>
          <button
            onClick={() => setSelectedClassId('all')}
            className="w-full bg-tg-button text-tg-button-text rounded-xl p-4 flex items-center justify-between text-left shadow-sm mb-6"
          >
            <div>
              <h3 className="font-bold text-lg">System-wide Users</h3>
              <p className="text-xs mt-1 text-white/80">View all registered students</p>
            </div>
            <div className="text-right">
              <p className="text-xl font-bold">&rarr;</p>
            </div>
          </button>

          <h2 className="text-lg font-semibold mb-3">Your Classes</h2>
          {classes.length === 0 ? (
            <div className="bg-tg-secondary rounded-xl p-4 text-center">
              <p className="text-tg-hint text-sm">You don't have any classes yet.</p>
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
            &larr; Back to Classes
          </button>
          
          <div className="bg-tg-secondary rounded-xl p-4 mb-4 flex justify-between items-center text-sm">
            <span className="font-semibold">
              {selectedClassId === 'all' ? 'All Registered Users' : classes.find(c => c.id === selectedClassId)?.name}
            </span>
            <div className="flex items-center gap-2">
              <span className="text-tg-hint">{getFilteredStudents().length} students</span>
              <button
                onClick={exportCSV}
                disabled={exporting}
                className="px-2 py-1 bg-tg-button text-tg-button-text rounded-lg text-xs font-medium"
              >
                {exporting ? 'Exporting...' : 'Export CSV'}
              </button>
            </div>
          </div>

          {selectedClassId === 'all' && (
            <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
              {[null, 'TOEFL_IBT', 'IELTS', 'TOEFL_ITP', 'TOEIC'].map((test) => (
                <button
                  key={test || 'all'}
                  onClick={() => setTargetTestFilter(test)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap ${
                    targetTestFilter === test
                      ? 'bg-tg-button text-tg-button-text'
                      : 'bg-tg-secondary text-tg-hint'
                  }`}
                >
                  {test === 'TOEFL_IBT' ? '📝 TOEFL IBT' :
                   test === 'IELTS' ? '🎓 IELTS' :
                   test === 'TOEFL_ITP' ? '📋 TOEFL ITP' :
                   test === 'TOEIC' ? '💼 TOEIC' : '🌐 All'}
                </button>
              ))}
            </div>
          )}

          {selectedClassId === 'all' && students.length > 0 && (
            <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
              {(['last_active', 'questions', 'accuracy', 'xp', 'name'] as const).map((key) => (
                <button
                  key={key}
                  onClick={() => setSortBy(key)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap ${
                    sortBy === key
                      ? 'bg-tg-button text-tg-button-text'
                      : 'bg-tg-secondary text-tg-hint'
                  }`}
                >
                  {key === 'last_active' ? 'Last Active' :
                   key === 'questions' ? 'Questions' :
                   key === 'accuracy' ? 'Accuracy' :
                   key === 'xp' ? 'XP' : 'Name'}
                </button>
              ))}
            </div>
          )}

          {loadingStudents ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-tg-button"></div>
            </div>
          ) : error ? (
            <div className="bg-red-500/10 text-red-500 rounded-xl p-4 text-center text-sm font-medium">
              <p className="font-mono text-xs text-left mb-1">token: {useAuthStore.getState().accessToken ? 'Yes' : 'No'}</p>
              <p className="font-mono text-xs text-left mb-1">url_tg_id: {new URLSearchParams(window.location.search).get('tg_id') || 'None'}</p>
              <p className="font-mono text-xs text-left mb-1">location: {window.location.href}</p>
              <hr className="my-2 border-red-500/20" />
              {error}
            </div>
          ) : students.length === 0 ? (
            <div className="bg-tg-secondary rounded-xl p-4 text-center">
              <p className="text-tg-hint text-sm">No students in this class yet.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {getSortedStudents().map((student) => {
                const diligence = getDiligenceLabel(student);
                const isExpanded = expandedStudent === student.id;
                return (
                  <div
                    key={student.id}
                    className="bg-tg-secondary rounded-xl overflow-hidden"
                  >
                    <button
                      onClick={() => setExpandedStudent(isExpanded ? null : student.id)}
                      className="w-full p-4 flex flex-col gap-3 text-left"
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h4 className="font-bold">{student.name}</h4>
                            <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-medium ${getDiligenceColor(diligence)}`}>
                              {diligence}
                            </span>
                            {student.is_premium && <span className="text-[10px] px-1.5 py-0.5 rounded-md font-medium bg-yellow-500/20 text-yellow-400">⭐ Premium</span>}
                            {student.current_streak > 0 && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded-md font-medium bg-orange-500/20 text-orange-400">
                                🔥 {student.current_streak}d streak
                              </span>
                            )}
                          </div>
                          {student.username && <p className="text-xs text-tg-hint">@{student.username}</p>}
                          {student.target_test && (
                            <p className="text-[10px] text-tg-hint mt-0.5">{student.target_test} &middot; {student.proficiency_level || 'N/A'}</p>
                          )}
                        </div>
                        <div className="text-right flex flex-col items-end gap-1">
                          {(student.estimated_band || student.diagnostic_band) && (
                            <div className="bg-tg-button text-tg-button-text text-[10px] px-1.5 py-0.5 rounded-md font-bold">
                              Band {student.estimated_band || student.diagnostic_band}
                            </div>
                          )}
                          <p className="text-[10px] text-tg-hint">{timeAgo(student.last_active || student.last_study_date)}</p>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-4 gap-2 text-center border-t border-tg-hint/20 pt-3">
                        {student.study_type === 'bot_only' ? (
                          <>
                            <div>
                              <p className="text-sm font-bold">{student.messages_sent}</p>
                              <p className="text-[10px] text-tg-hint uppercase tracking-wider">Messages</p>
                            </div>
                            <div>
                              <p className="text-sm font-bold">{student.bot_questions || 0}</p>
                              <p className="text-[10px] text-tg-hint uppercase tracking-wider">Bot Q's</p>
                            </div>
                            <div>
                              <p className="text-sm font-bold text-blue-400">{student.active_days}d</p>
                              <p className="text-[10px] text-tg-hint uppercase tracking-wider">Active</p>
                            </div>
                            <div>
                              <p className="text-[10px] font-bold text-yellow-400">Bot Only</p>
                              <p className="text-[10px] text-tg-hint uppercase tracking-wider">Mode</p>
                            </div>
                          </>
                        ) : (
                          <>
                            <div>
                              <p className="text-sm font-bold">{student.tests_taken}</p>
                              <p className="text-[10px] text-tg-hint uppercase tracking-wider">Tests</p>
                            </div>
                            <div>
                              <p className="text-sm font-bold">{student.questions_answered}</p>
                              <p className="text-[10px] text-tg-hint uppercase tracking-wider">Questions</p>
                            </div>
                            <div>
                              <p className="text-sm font-bold text-tg-button">{student.accuracy}%</p>
                              <p className="text-[10px] text-tg-hint uppercase tracking-wider">Accuracy</p>
                            </div>
                            <div>
                              <p className="text-sm font-bold">{student.latest_score != null ? student.latest_score : '-'}</p>
                              <p className="text-[10px] text-tg-hint uppercase tracking-wider">Score</p>
                            </div>
                          </>
                        )}
                      </div>
                    </button>

                    {isExpanded && (
                      <div className="border-t border-tg-hint/20 px-4 py-3 space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                          {student.study_type === 'bot_only' ? (
                            <>
                              <div className="bg-tg-bg/50 rounded-lg p-3">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="text-lg">💬</span>
                                  <p className="text-xs text-tg-hint">Chat Activity</p>
                                </div>
                                <p className="text-sm font-bold">{student.messages_sent} messages</p>
                                <p className="text-xs text-tg-hint">{student.bot_questions || 0} study questions via bot</p>
                                <p className="text-xs text-tg-hint mt-1">
                                  🔥 {student.current_streak || 0}d current streak
                                  {student.longest_streak > 0 && ` · ${student.longest_streak}d best`}
                                </p>
                                <p className="text-xs text-tg-hint">Joined {formatDate(student.created_at)}</p>
                              </div>
                              <div className="bg-tg-bg/50 rounded-lg p-3">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="text-lg">📅</span>
                                  <p className="text-xs text-tg-hint">This Week</p>
                                </div>
                                <p className="text-sm font-bold">
                                  {student.week_stats?.messages || student.week_stats?.questions || 0} messages
                                </p>
                                <p className="text-xs text-tg-hint">
                                  {student.week_stats?.active_days || 0}d active this week
                                </p>
                                <p className="text-xs text-tg-hint">Last: {timeAgo(student.last_message)}</p>
                              </div>
                              <div className="bg-tg-bg/50 rounded-lg p-3">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="text-lg">📊</span>
                                  <p className="text-xs text-tg-hint">Engagement</p>
                                </div>
                                <p className="text-sm font-bold">{student.active_days}d active</p>
                                <p className="text-xs text-tg-hint">/today used: {student.today_usage}x</p>
                                <p className="text-xs text-tg-hint mt-1 text-yellow-400">
                                  No mini app tests yet
                                </p>
                              </div>
                              <div className="bg-tg-bg/50 rounded-lg p-3">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="text-lg">⭐</span>
                                  <p className="text-xs text-tg-hint">Gamification</p>
                                </div>
                                <p className="text-sm font-bold">Level {student.level}</p>
                                <p className="text-xs text-tg-hint">{student.xp} XP</p>
                                {student.estimated_band && (
                                  <p className="text-xs text-tg-hint mt-1">Est. Band: {student.estimated_band}</p>
                                )}
                              </div>
                            </>
                          ) : (
                            <>
                              <div className="bg-tg-bg/50 rounded-lg p-3">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="text-lg">📝</span>
                                  <p className="text-xs text-tg-hint">Study Progress</p>
                                </div>
                                <p className="text-sm font-bold">{student.questions_answered} questions</p>
                                <p className="text-xs text-tg-hint">{student.correct_answers} correct / {student.questions_answered} total</p>
                                <p className="text-xs text-tg-hint mt-1">
                                  🔥 {student.current_streak || 0}d current streak
                                  {student.longest_streak > 0 && ` · ${student.longest_streak}d best`}
                                </p>
                                <p className="text-xs text-tg-hint">Joined {formatDate(student.created_at)}</p>
                              </div>
                              <div className="bg-tg-bg/50 rounded-lg p-3">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="text-lg">📅</span>
                                  <p className="text-xs text-tg-hint">This Week</p>
                                </div>
                                <p className="text-sm font-bold">
                                  {student.week_stats?.questions || 0} questions
                                  {student.week_stats?.minutes > 0 && ` · ${student.week_stats?.minutes}m`}
                                </p>
                                <p className="text-xs text-tg-hint">
                                  {student.week_stats?.accuracy || 0}% accuracy
                                  {student.week_stats?.active_days > 0 && ` · ${student.week_stats?.active_days}d active`}
                                </p>
                              </div>
                              <div className="bg-tg-bg/50 rounded-lg p-3">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="text-lg">💬</span>
                                  <p className="text-xs text-tg-hint">Bot Interaction</p>
                                </div>
                                <p className="text-sm font-bold">{student.messages_sent} messages</p>
                                <p className="text-xs text-tg-hint">Last: {timeAgo(student.last_message)}</p>
                                <p className="text-xs text-tg-hint mt-1">/today used: {student.today_usage}x</p>
                              </div>
                              <div className="bg-tg-bg/50 rounded-lg p-3">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="text-lg">⭐</span>
                                  <p className="text-xs text-tg-hint">Gamification</p>
                                </div>
                                <p className="text-sm font-bold">Level {student.level}</p>
                                <p className="text-xs text-tg-hint">{student.xp} XP</p>
                                {student.estimated_band && (
                                  <p className="text-xs text-tg-hint mt-1">Est. Band: {student.estimated_band}</p>
                                )}
                              </div>
                              <div className="bg-tg-bg/50 rounded-lg p-3">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="text-lg">⏱️</span>
                                  <p className="text-xs text-tg-hint">Time Analysis</p>
                                </div>
                                <p className="text-sm font-bold">
                                  {student.avg_time_per_question != null ? `${student.avg_time_per_question}s` : 'N/A'}
                                </p>
                                <p className="text-xs text-tg-hint">avg per question</p>
                              </div>
                              <div className="bg-tg-bg/50 rounded-lg p-3">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="text-lg">⚠️</span>
                                  <p className="text-xs text-tg-hint">Weakest Section</p>
                                </div>
                                <p className="text-sm font-bold">
                                  {student.weakest_section || 'N/A'}
                                </p>
                                <p className="text-xs text-tg-hint">most wrong answers</p>
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
