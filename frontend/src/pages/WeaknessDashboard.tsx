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

function topicLabel(topic: string): string {
  const labels: Record<string, string> = {
    'grammar_tenses': 'Tenses',
    'grammar_sv_agreement': 'S-V Agreement',
    'grammar_prepositions': 'Prepositions',
    'grammar_articles': 'Articles',
    'grammar_conditionals': 'Conditionals',
    'grammar_passive': 'Passive Voice',
    'vocab_word_formation': 'Word Formation',
    'vocab_idioms': 'Idioms',
    'vocab_collocations': 'Collocations',
    'vocab_synonyms': 'Vocabulary',
    'reading_main_idea': 'Reading Main Idea',
    'reading_vocab_context': 'Vocab in Context',
    'reading_inference': 'Reading Inference',
    'listening_comprehension': 'Listening',
    'speaking_pronunciation': 'Pronunciation',
    'writing_essay': 'Essay Writing',
    'other': 'Other',
  };
  return labels[topic] || topic;
}

export default function WeaknessDashboard() {
  const [profiles, setProfiles] = useState<WeaknessProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'critical' | 'high' | 'medium' | 'low' | 'no-diag'>('all');

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    setError(null);
    try {
      const res = await adminFetch('/api/weakness/all-students');
      if (res.ok) {
        const data = await res.json();
        setProfiles(data.profiles || []);
      } else {
        setError(`Error ${res.status}`);
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  const filteredProfiles = profiles.filter(p => {
    if (filter === 'all') return true;
    if (filter === 'critical') return p.recommendation.priority === 'critical';
    if (filter === 'high') return p.recommendation.priority === 'high';
    if (filter === 'medium') return p.recommendation.priority === 'medium';
    if (filter === 'low') return p.recommendation.priority === 'low';
    if (filter === 'no-diag') return !p.diagnostic.has_diagnostic;
    return true;
  });

  const counts = {
    critical: profiles.filter(p => p.recommendation.priority === 'critical').length,
    high: profiles.filter(p => p.recommendation.priority === 'high').length,
    medium: profiles.filter(p => p.recommendation.priority === 'medium').length,
    low: profiles.filter(p => p.recommendation.priority === 'low').length,
    noDiag: profiles.filter(p => !p.diagnostic.has_diagnostic).length,
    total: profiles.length,
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-tg-button"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-500/20 rounded-xl p-4 text-center">
        <p className="text-red-400">Failed to load: {error}</p>
        <button onClick={loadData} className="mt-2 text-sm text-red-400 underline">Retry</button>
      </div>
    );
  }

  return (
    <div className="p-4 max-w-4xl mx-auto pb-8">
      <h1 className="text-2xl font-bold mb-1">🎯 Student Weakness Analysis</h1>
      <p className="text-tg-hint text-sm mb-6">3-source analysis: Diagnostic + Practice + Chat</p>

      {/* Summary Cards */}
      <div className="grid grid-cols-6 gap-2 mb-6">
        <button
          onClick={() => setFilter('all')}
          className={`rounded-xl p-3 text-center transition-colors ${
            filter === 'all' ? 'bg-tg-button text-tg-button-text' : 'bg-tg-secondary hover:bg-tg-button/20'
          }`}
        >
          <p className="text-xl font-bold">{counts.total}</p>
          <p className="text-[10px] opacity-80">Total</p>
        </button>
        <button
          onClick={() => setFilter('critical')}
          className={`rounded-xl p-3 text-center transition-colors ${
            filter === 'critical' ? 'bg-red-500 text-white' : 'bg-red-500/20 hover:bg-red-500/30'
          }`}
        >
          <p className="text-xl font-bold text-red-400">{counts.critical}</p>
          <p className="text-[10px] text-red-300">Critical</p>
        </button>
        <button
          onClick={() => setFilter('high')}
          className={`rounded-xl p-3 text-center transition-colors ${
            filter === 'high' ? 'bg-orange-500 text-white' : 'bg-orange-500/20 hover:bg-orange-500/30'
          }`}
        >
          <p className="text-xl font-bold text-orange-400">{counts.high}</p>
          <p className="text-[10px] text-orange-300">High</p>
        </button>
        <button
          onClick={() => setFilter('medium')}
          className={`rounded-xl p-3 text-center transition-colors ${
            filter === 'medium' ? 'bg-yellow-500 text-white' : 'bg-yellow-500/20 hover:bg-yellow-500/30'
          }`}
        >
          <p className="text-xl font-bold text-yellow-400">{counts.medium}</p>
          <p className="text-[10px] text-yellow-300">Medium</p>
        </button>
        <button
          onClick={() => setFilter('low')}
          className={`rounded-xl p-3 text-center transition-colors ${
            filter === 'low' ? 'bg-green-500 text-white' : 'bg-green-500/20 hover:bg-green-500/30'
          }`}
        >
          <p className="text-xl font-bold text-green-400">{counts.low}</p>
          <p className="text-[10px] text-green-300">Low</p>
        </button>
        <button
          onClick={() => setFilter('no-diag')}
          className={`rounded-xl p-3 text-center transition-colors ${
            filter === 'no-diag' ? 'bg-gray-500 text-white' : 'bg-gray-500/20 hover:bg-gray-500/30'
          }`}
        >
          <p className="text-xl font-bold text-gray-400">{counts.noDiag}</p>
          <p className="text-[10px] text-gray-400">No Diag</p>
        </button>
      </div>

      {/* Legend */}
      <div className="bg-tg-secondary rounded-xl p-3 mb-6">
        <p className="text-xs font-semibold mb-2">📌 How Priority is Calculated</p>
        <div className="text-[10px] text-tg-hint space-y-1">
          <p><span className="text-red-400 font-bold">Critical:</span> 3+ weaknesses from diagnostic + practice (immediate attention)</p>
          <p><span className="text-orange-400 font-bold">High:</span> 2+ weaknesses from diagnostic OR practice (focus needed)</p>
          <p><span className="text-yellow-400 font-bold">Medium:</span> 1 weakness from diagnostic OR confused about topic in chat</p>
          <p><span className="text-green-400 font-bold">Low:</span> Minor or no significant weaknesses detected</p>
        </div>
      </div>

      {/* Student List */}
      <div className="space-y-3">
        {filteredProfiles.map((profile) => (
          <div
            key={profile.user_id}
            className={`bg-tg-secondary rounded-xl overflow-hidden border-l-4 ${
              profile.recommendation.priority === 'critical' ? 'border-l-red-500' :
              profile.recommendation.priority === 'high' ? 'border-l-orange-500' :
              profile.recommendation.priority === 'medium' ? 'border-l-yellow-500' :
              profile.recommendation.priority === 'low' ? 'border-l-green-500' :
              'border-l-gray-500'
            }`}
          >
            <div className="p-4">
              {/* Header */}
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center text-xl font-bold ${
                    profile.recommendation.priority === 'critical' ? 'bg-red-500/30 text-red-400' :
                    profile.recommendation.priority === 'high' ? 'bg-orange-500/30 text-orange-400' :
                    profile.recommendation.priority === 'medium' ? 'bg-yellow-500/30 text-yellow-400' :
                    'bg-green-500/30 text-green-400'
                  }`}>
                    {profile.user_name?.charAt(0)?.toUpperCase() || '?'}
                  </div>
                  <div>
                    <h3 className="font-bold">{profile.user_name}</h3>
                    <p className="text-xs text-tg-hint">
                      {profile.diagnostic.has_diagnostic 
                        ? `Band ${profile.diagnostic.estimated_band}`
                        : '❌ No diagnostic'}{' '}
                      · {profile.practice.total_questions} Q practiced
                      · {profile.chat.total_messages} chat msgs
                    </p>
                  </div>
                </div>
                <span className={`text-xs px-3 py-1 rounded-full font-bold ${
                  profile.recommendation.priority === 'critical' ? 'bg-red-500/30 text-red-400' :
                  profile.recommendation.priority === 'high' ? 'bg-orange-500/30 text-orange-400' :
                  profile.recommendation.priority === 'medium' ? 'bg-yellow-500/30 text-yellow-400' :
                  'bg-green-500/30 text-green-400'
                }`}>
                  {profile.recommendation.priority.toUpperCase()}
                </span>
              </div>

              {/* Diagnostic Scores */}
              <div className="grid grid-cols-5 gap-2 mb-3">
                {[
                  { label: 'Grammar', score: profile.diagnostic.grammar_score, total: profile.diagnostic.grammar_total, weak: (profile.diagnostic.grammar_score ?? 0) <= 4 },
                  { label: 'Vocab', score: profile.diagnostic.vocab_score, total: profile.diagnostic.vocab_total, weak: (profile.diagnostic.vocab_score ?? 0) <= 1 },
                  { label: 'Reading', score: profile.diagnostic.reading_score, total: profile.diagnostic.reading_total, weak: (profile.diagnostic.reading_score ?? 0) <= 1 },
                  { label: 'Listening', score: profile.diagnostic.listening_score, total: profile.diagnostic.listening_total, weak: (profile.diagnostic.listening_score ?? 0) <= 1 },
                  { label: 'Writing', score: profile.diagnostic.writing_band, total: 5, weak: (profile.diagnostic.writing_band ?? 0) <= 2, isBand: true },
                ].map((skill) => (
                  <div key={skill.label} className={`text-center p-2 rounded-lg ${
                    !profile.diagnostic.has_diagnostic ? 'bg-gray-500/10' :
                    skill.weak ? 'bg-red-500/20' : 'bg-green-500/20'
                  }`}>
                    <p className={`text-lg font-bold ${
                      !profile.diagnostic.has_diagnostic ? 'text-gray-400' :
                      skill.weak ? 'text-red-400' : 'text-green-400'
                    }`}>
                      {profile.diagnostic.has_diagnostic 
                        ? skill.isBand ? `B${skill.score}` : `${skill.score}/${skill.total}`
                        : '-'}
                    </p>
                    <p className="text-[10px] text-tg-hint">{skill.label}</p>
                  </div>
                ))}
              </div>

              {/* Practice Accuracy */}
              <div className="grid grid-cols-4 gap-2 mb-3 text-center">
                {[
                  { label: 'Listen Acc', data: profile.practice.listening, key: 'listening' },
                  { label: 'Read Acc', data: profile.practice.reading, key: 'reading' },
                  { label: 'Speak Acc', data: profile.practice.speaking, key: 'speaking' },
                  { label: 'Write Acc', data: profile.practice.writing, key: 'writing' },
                ].map((item) => (
                  <div key={item.key} className="bg-tg-bg/50 rounded-lg p-2">
                    <p className={`text-sm font-bold ${
                      item.data && item.data.accuracy < 40 ? 'text-red-400' :
                      item.data && item.data.accuracy < 60 ? 'text-yellow-400' :
                      item.data ? 'text-green-400' : 'text-gray-400'
                    }`}>
                      {item.data ? `${item.data.accuracy}%` : '-'}
                    </p>
                    <p className="text-[10px] text-tg-hint">{item.label}</p>
                    {item.data && (
                      <p className="text-[9px] text-tg-hint">{item.data.correct}/{item.data.attempted}</p>
                    )}
                  </div>
                ))}
              </div>

              {/* Detected Weaknesses */}
              {profile.weaknesses.combined.length > 0 && (
                <div className="mb-3">
                  <p className="text-[10px] text-tg-hint mb-1 uppercase tracking-wide">Detected Weaknesses:</p>
                  <div className="flex flex-wrap gap-1">
                    {profile.weaknesses.combined.map((w, i) => (
                      <span key={i} className={`text-[10px] px-2 py-1 rounded-full font-medium ${
                        w.priority === 'high' ? 'bg-red-500/30 text-red-300' :
                        w.priority === 'medium' ? 'bg-yellow-500/30 text-yellow-300' :
                        'bg-gray-500/30 text-gray-300'
                      }`}>
                        {w.skill}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Top Chat Topics */}
              {profile.chat.top_topics.length > 0 && (
                <div className="mb-3">
                  <p className="text-[10px] text-tg-hint mb-1">Most Asked About:</p>
                  <div className="flex flex-wrap gap-1">
                    {profile.chat.top_topics.slice(0, 4).map((t, i) => (
                      <span key={i} className="text-[10px] px-2 py-1 rounded-full bg-tg-button/20 text-tg-button">
                        {topicLabel(t.topic)} ({t.count})
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Confused Topics */}
              {profile.chat.confused_topics.length > 0 && (
                <div className="mb-3">
                  <p className="text-[10px] text-red-400 mb-1">❓ Repeatedly Confused About:</p>
                  <div className="flex flex-wrap gap-1">
                    {profile.chat.confused_topics.map((t, i) => (
                      <span key={i} className="text-[10px] px-2 py-1 rounded-full bg-red-500/20 text-red-300">
                        {topicLabel(t.topic)} ({t.count}x)
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Action */}
              <div className="bg-tg-bg/50 rounded-lg p-3">
                <p className="text-[10px] text-tg-hint mb-1 uppercase tracking-wide">Recommended Action:</p>
                <p className="text-sm">{profile.recommendation.action}</p>
                {profile.recommendation.focus_areas.length > 0 && (
                  <p className="text-xs text-tg-button mt-1">
                    Focus: {profile.recommendation.focus_areas.join(', ')}
                  </p>
                )}
              </div>
            </div>
          </div>
        ))}

        {filteredProfiles.length === 0 && (
          <div className="bg-tg-secondary rounded-xl p-8 text-center">
            <p className="text-tg-hint">No students match this filter.</p>
          </div>
        )}
      </div>
    </div>
  );
}
