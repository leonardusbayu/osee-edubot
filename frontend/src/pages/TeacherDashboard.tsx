import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

const WORKER_BASE = 'https://edubot-api.edubot-leonardus.workers.dev';
const ADMIN_SECRET = (import.meta.env.VITE_ADMIN_SECRET as string) || '';

async function adminFetch(url: string): Promise<Response> {
  const fullUrl = url.startsWith('/api') ? `${WORKER_BASE}${url}` : url;
  return fetch(fullUrl, {
    headers: { 'x-admin-secret': ADMIN_SECRET },
  });
}

// ─── Types ──────────────────────────────────────────────────────
interface AlertStudent {
  id: number;
  name: string;
  username: string | null;
  target_test: string | null;
  proficiency_level?: string | null;
  last_active?: string | null;
  accuracy?: number;
  questions?: number;
  recent_accuracy?: number;
  previous_accuracy?: number;
  recent_questions?: number;
  estimated_band?: number | null;
  total_questions?: number;
}

interface AlertsData {
  churn_risk: AlertStudent[];
  plateauing: AlertStudent[];
  struggling: AlertStudent[];
  close_to_goal: AlertStudent[];
}

interface HeatmapCell {
  section: string;
  question_type: string;
  skill_tags: string | null;
  attempts: number;
  correct: number;
  accuracy: number;
}

interface MissedQuestion {
  id: number;
  section: string;
  question_type: string;
  skill_tags: string | null;
  content_preview: string;
  attempts: number;
  wrong_count: number;
  accuracy: number;
}

interface WeaknessData {
  section_type_heatmap: HeatmapCell[];
  most_missed_questions: MissedQuestion[];
  skill_breakdown: { skill_tags: string; attempts: number; accuracy: number }[];
}

interface WeekPoint {
  week: string;
  week_start: string;
  questions: number;
  accuracy: number;
  active_students?: number;
  avg_accuracy?: number;
  section?: string;
}

interface ProgressionData {
  class_overall: WeekPoint[];
  by_section: WeekPoint[];
  top_improvers: { id: number; name: string; username: string | null; recent_acc: number; past_acc: number; total_questions: number }[];
}

interface ConsistencyStudent {
  id: number;
  name: string;
  username: string | null;
  active_days: number;
  current_streak: number;
  longest_streak: number;
}

interface EngagementData {
  daily_active_users: { date: string; active_users: number }[];
  total_students: number;
  student_consistency: ConsistencyStudent[];
  feature_usage: {
    bot_messages: number;
    test_answers: number;
    study_button_uses: number;
    lessons_generated: number;
    srs_reviews: number;
  };
  hour_distribution: { hour: number; activity_count: number }[];
  weekly_active_rates: { week: string; active_users: number }[];
  avg_study_time_weekly: { week: string; avg_minutes_per_student: number; students: number }[];
}

type Tab = 'alerts' | 'weakness' | 'progression' | 'engagement';

// ─── Helpers ────────────────────────────────────────────────────
function timeAgo(dateStr: string | null): string {
  if (!dateStr) return 'Never';
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffDays < 1) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 30) return `${diffDays}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

function accuracyColor(acc: number): string {
  if (acc >= 75) return 'text-green-400';
  if (acc >= 50) return 'text-yellow-400';
  if (acc >= 30) return 'text-orange-400';
  return 'text-red-400';
}

function accuracyBg(acc: number): string {
  if (acc >= 75) return 'bg-green-500/20';
  if (acc >= 50) return 'bg-yellow-500/20';
  if (acc >= 30) return 'bg-orange-500/20';
  return 'bg-red-500/20';
}

function sectionEmoji(section: string): string {
  const map: Record<string, string> = {
    reading: '📖', listening: '🎧', speaking: '🗣️', writing: '✍️',
  };
  return map[section] || '📝';
}

function sectionLabel(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// ─── Mini Chart Components ──────────────────────────────────────
function BarChart({ data, maxVal, height = 80, color = 'bg-tg-button' }: {
  data: { label: string; value: number }[];
  maxVal?: number;
  height?: number;
  color?: string;
}) {
  const max = maxVal || Math.max(...data.map(d => d.value), 1);
  return (
    <div className="flex items-end gap-1" style={{ height }}>
      {data.map((d, i) => (
        <div key={i} className="flex-1 flex flex-col items-center justify-end h-full">
          <div
            className={`w-full rounded-t ${color} min-h-[2px] transition-all`}
            style={{ height: `${Math.max((d.value / max) * 100, 2)}%` }}
            title={`${d.label}: ${d.value}`}
          />
          <p className="text-[8px] text-tg-hint mt-1 truncate w-full text-center">{d.label}</p>
        </div>
      ))}
    </div>
  );
}

function LineChart({ series, height = 120 }: {
  series: { label: string; color: string; points: { x: string; y: number }[] }[];
  height?: number;
}) {
  if (!series.length || !series[0].points.length) return <p className="text-tg-hint text-xs">No data</p>;

  const allY = series.flatMap(s => s.points.map(p => p.y));
  const maxY = Math.max(...allY, 1);
  const minY = Math.min(...allY, 0);
  const range = maxY - minY || 1;
  const width = 100;

  return (
    <div style={{ height }} className="relative">
      {/* Y-axis labels */}
      <div className="absolute left-0 top-0 bottom-4 w-8 flex flex-col justify-between text-[8px] text-tg-hint">
        <span>{Math.round(maxY)}%</span>
        <span>{Math.round(minY)}%</span>
      </div>
      {/* Chart area */}
      <div className="ml-9 h-full">
        <svg viewBox={`0 0 ${width} ${height - 16}`} className="w-full h-[calc(100%-16px)]" preserveAspectRatio="none">
          {/* Grid lines */}
          {[0, 25, 50, 75, 100].map(v => {
            const y = ((maxY - (minY + (v / 100) * range)) / range) * (height - 16);
            return <line key={v} x1="0" y1={y} x2={width} y2={y} stroke="currentColor" strokeOpacity="0.1" />;
          })}
          {/* Data lines */}
          {series.map((s, si) => {
            const pts = s.points.map((p, i) => {
              const x = s.points.length > 1 ? (i / (s.points.length - 1)) * width : width / 2;
              const y = ((maxY - p.y) / range) * (height - 16);
              return `${x},${y}`;
            }).join(' ');
            return (
              <polyline
                key={si}
                points={pts}
                fill="none"
                stroke={s.color}
                strokeWidth="2"
                vectorEffect="non-scaling-stroke"
              />
            );
          })}
        </svg>
        {/* X-axis labels */}
        <div className="flex justify-between text-[8px] text-tg-hint mt-0.5">
          <span>{series[0].points[0]?.x}</span>
          <span>{series[0].points[series[0].points.length - 1]?.x}</span>
        </div>
      </div>
      {/* Legend */}
      {series.length > 1 && (
        <div className="flex flex-wrap gap-2 mt-1 ml-9">
          {series.map((s, i) => (
            <span key={i} className="flex items-center gap-1 text-[9px] text-tg-hint">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: s.color }} />
              {s.label}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function HeatmapGrid({ data }: { data: HeatmapCell[] }) {
  const sections = [...new Set(data.map(d => d.section))];
  const types = [...new Set(data.map(d => d.question_type))];
  const lookup = new Map(data.map(d => [`${d.section}|${d.question_type}`, d]));

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr>
            <th className="text-left text-tg-hint p-1">Section</th>
            {types.map(t => (
              <th key={t} className="text-center text-tg-hint p-1 text-[9px] max-w-[60px] truncate">{t}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sections.map(sec => (
            <tr key={sec}>
              <td className="p-1 font-medium">{sectionEmoji(sec)} {sectionLabel(sec)}</td>
              {types.map(type => {
                const cell = lookup.get(`${sec}|${type}`);
                if (!cell) return <td key={type} className="p-1 text-center text-tg-hint">-</td>;
                return (
                  <td key={type} className={`p-1 text-center rounded ${accuracyBg(cell.accuracy)}`}>
                    <span className={`font-bold ${accuracyColor(cell.accuracy)}`}>
                      {Math.round(cell.accuracy)}%
                    </span>
                    <br />
                    <span className="text-[8px] text-tg-hint">{cell.attempts}q</span>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Sections ───────────────────────────────────────────────────

function AlertsSection({ data }: { data: AlertsData | null }) {
  if (!data) return <LoadingSpinner />;

  const totalAlerts = data.churn_risk.length + data.plateauing.length + data.struggling.length + data.close_to_goal.length;

  if (totalAlerts === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-2xl mb-2">🎉</p>
        <p className="text-tg-hint">All students are on track! No alerts right now.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary badges */}
      <div className="grid grid-cols-4 gap-2 text-center">
        <div className="bg-red-500/10 rounded-lg p-2">
          <p className="text-lg font-bold text-red-400">{data.churn_risk.length}</p>
          <p className="text-[9px] text-tg-hint">At Risk</p>
        </div>
        <div className="bg-orange-500/10 rounded-lg p-2">
          <p className="text-lg font-bold text-orange-400">{data.struggling.length}</p>
          <p className="text-[9px] text-tg-hint">Struggling</p>
        </div>
        <div className="bg-yellow-500/10 rounded-lg p-2">
          <p className="text-lg font-bold text-yellow-400">{data.plateauing.length}</p>
          <p className="text-[9px] text-tg-hint">Plateauing</p>
        </div>
        <div className="bg-green-500/10 rounded-lg p-2">
          <p className="text-lg font-bold text-green-400">{data.close_to_goal.length}</p>
          <p className="text-[9px] text-tg-hint">Near Goal</p>
        </div>
      </div>

      {/* Churn Risk */}
      {data.churn_risk.length > 0 && (
        <AlertCard
          title="🚨 At Risk of Dropping Out"
          subtitle="Active before but gone silent for 3+ days"
          color="border-red-500/30"
          students={data.churn_risk.map(s => ({
            ...s,
            badge: timeAgo(s.last_active || null),
            badgeColor: 'text-red-400',
          }))}
        />
      )}

      {/* Struggling */}
      {data.struggling.length > 0 && (
        <AlertCard
          title="😰 Struggling (High Effort, Low Results)"
          subtitle="Active this week but accuracy below 40%"
          color="border-orange-500/30"
          students={data.struggling.map(s => ({
            ...s,
            badge: `${s.accuracy}% acc · ${s.questions}q`,
            badgeColor: 'text-orange-400',
          }))}
        />
      )}

      {/* Plateauing */}
      {data.plateauing.length > 0 && (
        <AlertCard
          title="📊 Plateauing (No Improvement)"
          subtitle="Accuracy stuck within ±5% over 2 weeks"
          color="border-yellow-500/30"
          students={data.plateauing.map(s => ({
            ...s,
            badge: `${s.recent_accuracy}% → ${s.previous_accuracy}%`,
            badgeColor: 'text-yellow-400',
          }))}
        />
      )}

      {/* Close to Goal */}
      {data.close_to_goal.length > 0 && (
        <AlertCard
          title="🌟 Close to Goal (Almost There!)"
          subtitle="75%+ accuracy with 10+ questions — ready for a push"
          color="border-green-500/30"
          students={data.close_to_goal.map(s => ({
            ...s,
            badge: `${s.accuracy}% · ${s.total_questions}q`,
            badgeColor: 'text-green-400',
          }))}
        />
      )}
    </div>
  );
}

function AlertCard({ title, subtitle, color, students }: {
  title: string;
  subtitle: string;
  color: string;
  students: (AlertStudent & { badge: string; badgeColor: string })[];
}) {
  return (
    <div className={`border ${color} rounded-xl p-3`}>
      <p className="font-bold text-sm">{title}</p>
      <p className="text-[10px] text-tg-hint mb-2">{subtitle}</p>
      <div className="space-y-1.5">
        {students.map(s => (
          <div key={s.id} className="flex items-center justify-between bg-tg-bg/50 rounded-lg px-2.5 py-1.5">
            <div>
              <p className="text-xs font-medium">{s.name}</p>
              <p className="text-[10px] text-tg-hint">
                {s.username ? `@${s.username}` : ''} {s.target_test ? `· ${s.target_test}` : ''}
              </p>
            </div>
            <span className={`text-[10px] font-bold ${s.badgeColor}`}>{s.badge}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function WeaknessSection({ data }: { data: WeaknessData | null }) {
  if (!data) return <LoadingSpinner />;

  return (
    <div className="space-y-4">
      {/* Heatmap */}
      <div className="bg-tg-secondary-bg rounded-xl p-3">
        <p className="font-bold text-sm mb-1">📊 Section × Question Type</p>
        <p className="text-[10px] text-tg-hint mb-3">Red = class is weakest here. Plan lessons around these.</p>
        {data.section_type_heatmap.length > 0 ? (
          <HeatmapGrid data={data.section_type_heatmap} />
        ) : (
          <p className="text-tg-hint text-xs text-center py-4">No data yet</p>
        )}
      </div>

      {/* Skill Tag Breakdown */}
      {data.skill_breakdown.length > 0 && (
        <div className="bg-tg-secondary-bg rounded-xl p-3">
          <p className="font-bold text-sm mb-1">🏷️ Skill Tag Accuracy</p>
          <p className="text-[10px] text-tg-hint mb-3">Weakest skills first — teach these next</p>
          <div className="space-y-1.5">
            {data.skill_breakdown.slice(0, 15).map((skill, i) => (
              <div key={i} className="flex items-center gap-2">
                <div className="flex-1 bg-tg-bg/50 rounded-full h-5 overflow-hidden relative">
                  <div
                    className={`h-full rounded-full transition-all ${skill.accuracy >= 60 ? 'bg-green-500/40' : skill.accuracy >= 40 ? 'bg-yellow-500/40' : 'bg-red-500/40'}`}
                    style={{ width: `${Math.max(skill.accuracy, 3)}%` }}
                  />
                  <span className="absolute inset-0 flex items-center px-2 text-[10px] font-medium truncate">
                    {skill.skill_tags}
                  </span>
                </div>
                <span className={`text-[10px] font-bold w-10 text-right ${accuracyColor(skill.accuracy)}`}>
                  {Math.round(skill.accuracy)}%
                </span>
                <span className="text-[9px] text-tg-hint w-8 text-right">{skill.attempts}q</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Most Missed Questions */}
      {data.most_missed_questions.length > 0 && (
        <div className="bg-tg-secondary-bg rounded-xl p-3">
          <p className="font-bold text-sm mb-1">❌ Most Missed Questions</p>
          <p className="text-[10px] text-tg-hint mb-3">Questions students get wrong the most</p>
          <div className="space-y-2">
            {data.most_missed_questions.slice(0, 10).map((q, i) => (
              <div key={i} className="bg-tg-bg/50 rounded-lg p-2.5">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs">{sectionEmoji(q.section)}</span>
                  <span className="text-[10px] text-tg-hint">{sectionLabel(q.section)} · {q.question_type}</span>
                  <span className={`text-[10px] font-bold ml-auto ${accuracyColor(q.accuracy)}`}>
                    {Math.round(q.accuracy)}%
                  </span>
                </div>
                <p className="text-[11px] text-tg-text/80 line-clamp-2">{q.content_preview}</p>
                <p className="text-[9px] text-tg-hint mt-1">{q.wrong_count}/{q.attempts} got it wrong</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ProgressionSection({ data }: { data: ProgressionData | null }) {
  if (!data) return <LoadingSpinner />;

  const overallPoints = data.class_overall.map(p => ({
    x: p.week_start?.slice(5) || p.week,
    y: p.avg_accuracy || 0,
  }));

  // Group by_section data into series
  const sectionColors: Record<string, string> = {
    reading: '#60a5fa', listening: '#a78bfa', speaking: '#f97316', writing: '#34d399',
  };
  const sections = [...new Set(data.by_section.map(d => d.section).filter((s): s is string => !!s))];
  const sectionSeries = sections.map(sec => {
    const secData = data.by_section.filter(d => d.section === sec);
    return {
      label: sectionLabel(sec),
      color: sectionColors[sec] || '#888',
      points: secData.map(p => ({ x: p.week_start?.slice(5) || p.week, y: p.accuracy })),
    };
  });

  return (
    <div className="space-y-4">
      {/* Class overall accuracy trend */}
      <div className="bg-tg-secondary-bg rounded-xl p-3">
        <p className="font-bold text-sm mb-1">📈 Class Average Accuracy</p>
        <p className="text-[10px] text-tg-hint mb-3">Weekly trend — is the class improving?</p>
        {overallPoints.length > 1 ? (
          <LineChart
            series={[{ label: 'Overall', color: '#60a5fa', points: overallPoints }]}
            height={140}
          />
        ) : (
          <p className="text-tg-hint text-xs text-center py-4">Need at least 2 weeks of data</p>
        )}
      </div>

      {/* Per-section accuracy trend */}
      {sectionSeries.length > 0 && sectionSeries[0].points.length > 1 && (
        <div className="bg-tg-secondary-bg rounded-xl p-3">
          <p className="font-bold text-sm mb-1">📊 Accuracy by Section</p>
          <p className="text-[10px] text-tg-hint mb-3">Which sections are improving or declining?</p>
          <LineChart series={sectionSeries} height={160} />
        </div>
      )}

      {/* Activity volume */}
      <div className="bg-tg-secondary-bg rounded-xl p-3">
        <p className="font-bold text-sm mb-1">📝 Weekly Questions Answered</p>
        <p className="text-[10px] text-tg-hint mb-3">Study volume over time</p>
        <BarChart
          data={data.class_overall.map(p => ({
            label: p.week_start?.slice(5) || p.week,
            value: p.questions || 0,
          }))}
          height={80}
        />
      </div>

      {/* Top Improvers */}
      {data.top_improvers.length > 0 && (
        <div className="bg-tg-secondary-bg rounded-xl p-3">
          <p className="font-bold text-sm mb-1">🚀 Top Improvers</p>
          <p className="text-[10px] text-tg-hint mb-3">Students with biggest accuracy gains</p>
          <div className="space-y-1.5">
            {data.top_improvers.map((s, i) => {
              const delta = Math.round((s.recent_acc || 0) - (s.past_acc || 0));
              return (
                <div key={i} className="flex items-center justify-between bg-tg-bg/50 rounded-lg px-2.5 py-1.5">
                  <div>
                    <p className="text-xs font-medium">{s.name}</p>
                    <p className="text-[10px] text-tg-hint">{s.username ? `@${s.username}` : ''} · {s.total_questions}q</p>
                  </div>
                  <div className="text-right">
                    <span className="text-green-400 text-xs font-bold">+{delta}%</span>
                    <p className="text-[9px] text-tg-hint">{Math.round(s.past_acc || 0)}% → {Math.round(s.recent_acc || 0)}%</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function EngagementSection({ data }: { data: EngagementData | null }) {
  if (!data) return <LoadingSpinner />;

  const totalStudents = data.total_students || 1;

  // Current week active rate
  const recentActive = data.daily_active_users.slice(-7);
  const weekActiveUsers = new Set(recentActive.map(d => d.active_users)).size > 0
    ? Math.max(...recentActive.map(d => d.active_users)) : 0;

  // Consistency distribution
  const consistency = data.student_consistency || [];
  const maxDays = 30;
  const highConsistency = consistency.filter(s => s.active_days >= maxDays * 0.6).length;
  const medConsistency = consistency.filter(s => s.active_days >= maxDays * 0.3 && s.active_days < maxDays * 0.6).length;
  const lowConsistency = consistency.filter(s => s.active_days > 0 && s.active_days < maxDays * 0.3).length;
  const inactive = consistency.filter(s => s.active_days === 0).length;

  // Feature usage
  const fu = data.feature_usage || {} as any;
  const totalUsage = (fu.bot_messages || 0) + (fu.test_answers || 0) + (fu.study_button_uses || 0) + (fu.lessons_generated || 0) + (fu.srs_reviews || 0);

  // Hour distribution: find peak hour
  const hours = data.hour_distribution || [];
  const peakHour = hours.reduce((max, h) => h.activity_count > max.activity_count ? h : max, { hour: 0, activity_count: 0 });

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="bg-tg-secondary-bg rounded-xl p-2.5">
          <p className="text-xl font-bold text-tg-button">{weekActiveUsers}</p>
          <p className="text-[9px] text-tg-hint">Peak Daily Active (7d)</p>
        </div>
        <div className="bg-tg-secondary-bg rounded-xl p-2.5">
          <p className="text-xl font-bold">
            {Math.round((consistency.filter(s => s.active_days > 0).length / totalStudents) * 100)}%
          </p>
          <p className="text-[9px] text-tg-hint">30d Active Rate</p>
        </div>
        <div className="bg-tg-secondary-bg rounded-xl p-2.5">
          <p className="text-xl font-bold">{peakHour.hour}:00</p>
          <p className="text-[9px] text-tg-hint">Peak Study Hour</p>
        </div>
      </div>

      {/* Daily Active Users Chart */}
      <div className="bg-tg-secondary-bg rounded-xl p-3">
        <p className="font-bold text-sm mb-1">👥 Daily Active Users</p>
        <p className="text-[10px] text-tg-hint mb-3">Out of {totalStudents} enrolled students</p>
        <BarChart
          data={data.daily_active_users.slice(-30).map(d => ({
            label: d.date.slice(8),
            value: d.active_users,
          }))}
          height={80}
        />
      </div>

      {/* Study Consistency Distribution */}
      <div className="bg-tg-secondary-bg rounded-xl p-3">
        <p className="font-bold text-sm mb-1">📅 Study Consistency (Last 30 Days)</p>
        <p className="text-[10px] text-tg-hint mb-3">How regularly are students studying?</p>
        <div className="grid grid-cols-4 gap-2 text-center mb-3">
          <div className="bg-green-500/10 rounded-lg p-2">
            <p className="text-sm font-bold text-green-400">{highConsistency}</p>
            <p className="text-[8px] text-tg-hint">Regular (18+d)</p>
          </div>
          <div className="bg-blue-500/10 rounded-lg p-2">
            <p className="text-sm font-bold text-blue-400">{medConsistency}</p>
            <p className="text-[8px] text-tg-hint">Moderate (9-17d)</p>
          </div>
          <div className="bg-orange-500/10 rounded-lg p-2">
            <p className="text-sm font-bold text-orange-400">{lowConsistency}</p>
            <p className="text-[8px] text-tg-hint">Sporadic (1-8d)</p>
          </div>
          <div className="bg-red-500/10 rounded-lg p-2">
            <p className="text-sm font-bold text-red-400">{inactive}</p>
            <p className="text-[8px] text-tg-hint">Inactive (0d)</p>
          </div>
        </div>

        {/* Top consistent students */}
        <p className="text-[10px] text-tg-hint mb-1.5">Most consistent:</p>
        <div className="space-y-1">
          {consistency.slice(0, 5).map((s, i) => (
            <div key={i} className="flex items-center justify-between bg-tg-bg/50 rounded px-2 py-1">
              <span className="text-[11px] font-medium">{s.name}</span>
              <span className="text-[10px] text-green-400 font-bold">
                {s.active_days}d · 🔥{s.current_streak}d streak
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Feature Usage Breakdown */}
      <div className="bg-tg-secondary-bg rounded-xl p-3">
        <p className="font-bold text-sm mb-1">🛠️ Feature Usage (Last 30 Days)</p>
        <p className="text-[10px] text-tg-hint mb-3">What are students actually using?</p>
        <div className="space-y-2">
          {[
            { label: 'Bot Messages', value: fu.bot_messages || 0, icon: '💬', color: 'bg-blue-500/40' },
            { label: 'Test Answers', value: fu.test_answers || 0, icon: '📝', color: 'bg-green-500/40' },
            { label: '/study Button', value: fu.study_button_uses || 0, icon: '📚', color: 'bg-purple-500/40' },
            { label: 'AI Lessons', value: fu.lessons_generated || 0, icon: '🤖', color: 'bg-yellow-500/40' },
            { label: 'SRS Reviews', value: fu.srs_reviews || 0, icon: '🧠', color: 'bg-pink-500/40' },
          ].map((f, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="text-xs">{f.icon}</span>
              <div className="flex-1 bg-tg-bg/50 rounded-full h-5 overflow-hidden relative">
                <div
                  className={`h-full rounded-full ${f.color}`}
                  style={{ width: `${totalUsage > 0 ? Math.max((f.value / totalUsage) * 100, 2) : 2}%` }}
                />
                <span className="absolute inset-0 flex items-center px-2 text-[10px]">{f.label}</span>
              </div>
              <span className="text-[10px] font-bold w-12 text-right">{f.value.toLocaleString()}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Study Time by Hour */}
      <div className="bg-tg-secondary-bg rounded-xl p-3">
        <p className="font-bold text-sm mb-1">🕐 Activity by Hour of Day</p>
        <p className="text-[10px] text-tg-hint mb-3">When do students study? (UTC time shown)</p>
        <BarChart
          data={Array.from({ length: 24 }, (_, h) => ({
            label: `${h}`,
            value: hours.find(hr => hr.hour === h)?.activity_count || 0,
          }))}
          height={60}
          color="bg-purple-500/60"
        />
      </div>

      {/* Avg Study Time */}
      {data.avg_study_time_weekly.length > 0 && (
        <div className="bg-tg-secondary-bg rounded-xl p-3">
          <p className="font-bold text-sm mb-1">⏱️ Avg Study Minutes / Student / Week</p>
          <BarChart
            data={data.avg_study_time_weekly.map(w => ({
              label: w.week.slice(-3),
              value: w.avg_minutes_per_student || 0,
            }))}
            height={70}
            color="bg-teal-500/60"
          />
        </div>
      )}
    </div>
  );
}

function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center py-12">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-tg-button" />
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────────
export default function TeacherDashboard() {
  const [tab, setTab] = useState<Tab>('alerts');
  const [alerts, setAlerts] = useState<AlertsData | null>(null);
  const [weakness, setWeakness] = useState<WeaknessData | null>(null);
  const [progression, setProgression] = useState<ProgressionData | null>(null);
  const [engagement, setEngagement] = useState<EngagementData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadTabData(tab);
  }, [tab]);

  async function loadTabData(t: Tab) {
    setLoading(true);
    setError(null);
    try {
      switch (t) {
        case 'alerts': {
          if (alerts) { setLoading(false); return; }
          const res = await adminFetch('/api/v1/admin/teacher-dashboard/alerts');
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          setAlerts(await res.json());
          break;
        }
        case 'weakness': {
          if (weakness) { setLoading(false); return; }
          const res = await adminFetch('/api/v1/admin/teacher-dashboard/weakness-heatmap');
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          setWeakness(await res.json());
          break;
        }
        case 'progression': {
          if (progression) { setLoading(false); return; }
          const res = await adminFetch('/api/v1/admin/teacher-dashboard/score-progression');
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          setProgression(await res.json());
          break;
        }
        case 'engagement': {
          if (engagement) { setLoading(false); return; }
          const res = await adminFetch('/api/v1/admin/teacher-dashboard/engagement');
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          setEngagement(await res.json());
          break;
        }
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  function handleRefresh() {
    // Clear cached data for current tab and reload
    switch (tab) {
      case 'alerts': setAlerts(null); break;
      case 'weakness': setWeakness(null); break;
      case 'progression': setProgression(null); break;
      case 'engagement': setEngagement(null); break;
    }
    setTimeout(() => loadTabData(tab), 50);
  }

  const tabs: { key: Tab; label: string; icon: string }[] = [
    { key: 'alerts', label: 'Alerts', icon: '🚨' },
    { key: 'weakness', label: 'Weakness', icon: '🎯' },
    { key: 'progression', label: 'Progress', icon: '📈' },
    { key: 'engagement', label: 'Engage', icon: '💪' },
  ];

  return (
    <div className="min-h-screen bg-tg-bg text-tg-text pb-6">
      {/* Header */}
      <div className="bg-tg-secondary-bg px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Link to="/admin/panel" className="text-tg-button text-lg">←</Link>
          <div>
            <h1 className="text-base font-bold">Teacher Dashboard</h1>
            <p className="text-[10px] text-tg-hint">Actionable insights for your students</p>
          </div>
        </div>
        <button
          onClick={handleRefresh}
          className="text-xs bg-tg-button text-tg-button-text px-3 py-1.5 rounded-lg"
        >
          ↻ Refresh
        </button>
      </div>

      {/* Tab Navigation */}
      <div className="flex border-b border-tg-hint/20 bg-tg-secondary-bg px-1">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 py-2.5 text-center text-xs font-medium transition-colors relative
              ${tab === t.key ? 'text-tg-button' : 'text-tg-hint'}`}
          >
            <span className="text-sm">{t.icon}</span>
            <br />
            {t.label}
            {tab === t.key && (
              <div className="absolute bottom-0 left-2 right-2 h-0.5 bg-tg-button rounded-full" />
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="px-3 py-3">
        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 mb-3">
            <p className="text-xs text-red-400">Error: {error}</p>
            <button onClick={handleRefresh} className="text-[10px] text-tg-button mt-1">Retry</button>
          </div>
        )}

        {tab === 'alerts' && <AlertsSection data={alerts} />}
        {tab === 'weakness' && <WeaknessSection data={weakness} />}
        {tab === 'progression' && <ProgressionSection data={progression} />}
        {tab === 'engagement' && <EngagementSection data={engagement} />}
      </div>
    </div>
  );
}
