import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { authedFetch } from '../api/authedFetch';
import { useTestStore } from '../stores/test';
import type { TestResult } from '../types';
import ReportIssueButton from '../components/ReportIssueButton';

interface ReviewItem {
  content_id: number | null;
  section: string;
  question_index: number;
  question_type: string;
  answer_data: any;
  is_correct: boolean | null;
  score: number | null;
  explanation: string;
  question_text: string;
  passage: string;
  options: any[];
  correct_answer: string;
}

export default function TestResults() {
  const { attemptId } = useParams<{ attemptId: string }>();
  const navigate = useNavigate();
  const { reset } = useTestStore();
  const [result, setResult] = useState<TestResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [review, setReview] = useState<ReviewItem[]>([]);
  const [showReview, setShowReview] = useState(false);
  const [growthMessage, setGrowthMessage] = useState<string | null>(null);

  useEffect(() => {
    loadResults();
    // Check for growth message stored by TestRunner
    try {
      const msg = sessionStorage.getItem('edubot_growth_msg');
      if (msg) {
        setGrowthMessage(msg);
        sessionStorage.removeItem('edubot_growth_msg');
      }
    } catch {}

    // P1 #7: Re-fetch results after 2.5s. The /finish endpoint kicks off
    // a waitUntil that populates ai_summary + detailed_feedback (concepts
    // missed, priority order, etc.) from post-test-review.ts. The first
    // response returns null for both because the waitUntil is async. This
    // polling picks up the rich data once the worker finishes.
    const retryTimer = setTimeout(() => {
      loadResults();
    }, 2500);
    return () => clearTimeout(retryTimer);
  }, []);

  async function loadResults() {
    try {
      const data = await api.getResults(Number(attemptId));
      setResult(data);
      // Load review data — swallow errors but log so a broken /review endpoint
      // is diagnosable via console instead of producing a silent empty list.
      try {
        const reviewRes = await authedFetch(`/api/tests/attempt/${attemptId}/review`);
        if (reviewRes.ok) {
          const reviewData = await reviewRes.json();
          setReview(reviewData.review || []);
        } else {
          console.warn('[TestResults] /review returned', reviewRes.status);
        }
      } catch (e) {
        console.warn('[TestResults] /review fetch failed:', e);
      }
    } catch (e) {
      console.error('[TestResults] getResults failed:', e);
      setResult(null);
    } finally {
      setLoading(false);
    }
  }

  function handleClose() {
    reset();
    navigate('/test');
  }

  function handleShareScore() {
    if (!result) return;
    const score = result.band_score || result.total_score;
    const testName = (result.test_type || '').replace('_', ' ');
    const shareText = `🎯 Aku baru dapat skor *${score}/6.0* di latihan ${testName}!\n\nCoba juga di EduBot — tutor AI TOEFL/IELTS: https://t.me/OSEE_TOEFL_IELTS_TOEIC_study_bot`;
    try {
      const tg: any = (window as any).Telegram?.WebApp;
      if (tg?.switchInlineQuery) {
        tg.switchInlineQuery(shareText, ['users', 'groups', 'channels']);
        return;
      }
      if (tg?.openTelegramLink) {
        const encoded = encodeURIComponent(shareText);
        tg.openTelegramLink(`https://t.me/share/url?url=https://t.me/OSEE_TOEFL_IELTS_TOEIC_study_bot&text=${encoded}`);
        return;
      }
    } catch {}
    // Fallback: copy to clipboard
    try {
      navigator.clipboard.writeText(shareText);
      alert('Skor disalin! Paste di chat manapun.');
    } catch {
      alert(shareText);
    }
  }

  async function handleAskWhy(item: ReviewItem) {
    const qText = (item.question_text || '').substring(0, 300);
    const userAns = item.answer_data?.selected || item.answer_data?.text || '(kosong)';
    const correct = item.correct_answer || '(n/a)';
    const question = `Aku salah di soal ini, tolong jelasin kenapa:\n\nSoal: "${qText}"\nJawaban aku: ${userAns}\nJawaban benar: ${correct}`;

    // Stash the question server-side — start params are limited to 64 chars, so
    // the bot retrieves it from pending_tutor_questions when /start ask arrives.
    let stashed = false;
    try {
      const res = await authedFetch('/api/tutor/pending-question', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question }),
      });
      stashed = res.ok;
      if (!res.ok) console.warn('[TestResults] pending-question stash failed:', res.status);
    } catch (e) {
      console.warn('[TestResults] pending-question request errored:', e);
    }

    try {
      const tg: any = (window as any).Telegram?.WebApp;
      if (tg?.openTelegramLink && stashed) {
        tg.openTelegramLink('https://t.me/OSEE_TOEFL_IELTS_TOEIC_study_bot?start=ask');
        tg.close?.();
        return;
      }
    } catch {}
    // Fallback: copy to clipboard and show instruction
    try {
      await navigator.clipboard.writeText(question);
      alert('Pertanyaan disalin. Paste ke bot di Telegram untuk minta penjelasan.');
    } catch {
      alert(question);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-tg-button mx-auto mb-4"></div>
          <p className="text-tg-hint">Menghitung skor...</p>
        </div>
      </div>
    );
  }

  if (!result) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-tg-hint">Tidak ada hasil ditemukan</p>
      </div>
    );
  }

  const sectionNames: Record<string, string> = {
    reading: 'Reading',
    listening: 'Listening',
    speaking: 'Speaking',
    writing: 'Writing',
  };

  const sectionColors: Record<string, string> = {
    reading: 'bg-blue-500',
    listening: 'bg-green-500',
    speaking: 'bg-orange-500',
    writing: 'bg-purple-500',
  };

  return (
    <div className="p-4 max-w-lg mx-auto pb-24">
      {/* Header */}
      <div className="text-center mb-6">
        <h1 className="text-2xl font-bold mb-1">Hasil Tes</h1>
        <p className="text-tg-hint text-sm">
          {result.test_type.replace('_', ' ')} Latihan
        </p>
      </div>

      {/* Growth celebration */}
      {growthMessage && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-4 text-sm text-blue-800">
          {growthMessage}
        </div>
      )}

      {/* Overall Score */}
      <div className="bg-tg-secondary rounded-2xl p-6 text-center mb-6">
        <p className="text-tg-hint text-sm mb-1">Skor Band Keseluruhan</p>
        <p className="text-5xl font-bold text-tg-button mb-2">
          {result.band_score || result.total_score}
        </p>
        <p className="text-tg-hint text-xs">dari {(result as any).max_band ?? 6}</p>
      </div>

      {/* Section Scores */}
      <div className="mb-6">
        <h2 className="font-semibold mb-3">Hasil Per Bagian</h2>
        <div className="space-y-3">
          {Object.entries(result.section_scores || {}).map(([section, score]) => {
            // A null score means the section had no scorable answers
            // (e.g. the student skipped Speaking entirely). Show a
            // neutral placeholder instead of "null" text or a broken
            // progress bar, so the student can tell at a glance which
            // sections weren't attempted.
            const hasScore = typeof score === 'number' && !Number.isNaN(score);
            const numericScore = hasScore ? (score as number) : 0;
            // Per-section max from the backend (sent alongside the score).
            // Falls back to 6 for older responses that didn't include
            // section_max_scores — keeps backwards compat.
            const sectionMax = (result as any).section_max_scores?.[section] ?? 6;
            return (
              <div key={section} className="bg-tg-secondary rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium">{sectionNames[section] || section}</span>
                  <span className={`font-bold text-lg ${hasScore ? '' : 'text-tg-hint'}`}>
                    {hasScore ? `${score} / ${sectionMax}` : '—'}
                  </span>
                </div>
                <div className="w-full bg-tg-bg rounded-full h-2">
                  <div
                    className={`h-2 rounded-full ${sectionColors[section] || 'bg-tg-button'}`}
                    style={{ width: `${(numericScore / sectionMax) * 100}%` }}
                  />
                </div>
                {!hasScore && (
                  <p className="text-xs text-tg-hint mt-1">Belum ada jawaban yang terhitung</p>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Score prediction — projects the student's test-day score based
          on current band + learning rate + weeks to exam. Verdict tells
          them if they're on track / behind pace / ready now. */}
      {result.score_prediction && (() => {
        const p = result.score_prediction as any;
        const verdictColor: Record<string, string> = {
          ready_now: 'text-green-500',
          on_track: 'text-green-500',
          behind_pace: 'text-orange-500',
          no_data: 'text-tg-hint',
        };
        const verdictLabel: Record<string, string> = {
          ready_now: '✅ Siap untuk ujian!',
          on_track: '✅ On track',
          behind_pace: '⚠️ Belum tertinggal dari target',
          no_data: '📊 Belum ada data cukup',
        };
        const [ciLow, ciHigh] = p.confidence_interval;
        return (
          <div className="mb-6">
            <h2 className="font-semibold mb-3">Prediksi Skor</h2>
            <div className="bg-tg-secondary rounded-xl p-4 space-y-2">
              <div className="flex justify-between">
                <span className="text-tg-hint">Skor sekarang</span>
                <span className="font-bold">{p.current_band}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-tg-hint">Confidence</span>
                <span className="font-medium">±{(ciHigh - ciLow) / 2}</span>
              </div>
              {p.projected_band !== p.current_band && (
                <div className="flex justify-between">
                  <span className="text-tg-hint">Proyeksi di ujian</span>
                  <span className="font-bold">{p.projected_band}</span>
                </div>
              )}
              {p.weeks_to_exam !== null && (
                <div className="flex justify-between">
                  <span className="text-tg-hint">Minggu ke ujian</span>
                  <span className="font-medium">{p.weeks_to_exam}</span>
                </div>
              )}
              {p.target_score !== null && (
                <div className="flex justify-between">
                  <span className="text-tg-hint">Target</span>
                  <span className="font-medium">{p.target_score}</span>
                </div>
              )}
              <div className={`text-center font-bold pt-2 border-t border-tg-hint/20 ${verdictColor[p.verdict] || ''}`}>
                {verdictLabel[p.verdict] || p.verdict}
              </div>
            </div>
          </div>
        );
      })()}

      {/* AI Feedback */}
      {result.ai_summary && (
        <div className="mb-6">
          <h2 className="font-semibold mb-3">Masukan AI</h2>
          <div className="bg-tg-secondary rounded-xl p-4">
            <p className="text-sm leading-relaxed">{result.ai_summary}</p>
          </div>
        </div>
      )}

      {/* P1 #7: Detailed post-test breakdown — concepts missed, priority order.
          Populated server-side by post-test-review.ts (analyzeAttempt). Without
          this, students saw a number and "Review Jawaban" but never the
          WHY — which concepts they should focus on. Now we render the top
          triaged concepts with miss counts and a link to /weakness for
          full drill recommendation. */}
      {result.detailed_feedback && (() => {
        const df = result.detailed_feedback as {
          wrong_count?: number;
          total_scored?: number;
          concept_clusters?: Array<{
            concept: string;
            miss_count: number;
            priority_score?: number;
            humanize?: string;
          }>;
          triaged_concepts?: string[];
        };
        const clusters = df.concept_clusters || [];
        if (clusters.length === 0) return null;
        return (
          <div className="mb-6">
            <h2 className="font-semibold mb-3">📊 Konsep yang Perlu Dilatih</h2>
            <div className="bg-tg-secondary rounded-xl p-4">
              {df.wrong_count !== undefined && (
                <p className="text-sm text-tg-hint mb-3">
                  {df.wrong_count} dari {df.total_scored || '?'} soal salah. Topik yang paling perlu dilatih:
                </p>
              )}
              <ol className="space-y-2">
                {clusters.map((c, i) => (
                  <li key={i} className="flex items-center justify-between text-sm">
                    <span>
                      <span className="font-medium text-tg-text">{i + 1}. {(c.humanize || c.concept).replace(/_/g, ' ')}</span>
                      {c.miss_count > 0 && (
                        <span className="text-tg-hint text-xs ml-2">({c.miss_count}x salah)</span>
                      )}
                    </span>
                    <span className={`text-xs ${i === 0 ? 'text-red-500' : i === 1 ? 'text-orange-500' : 'text-yellow-500'}`}>
                      {i === 0 ? '🔴 High' : i === 1 ? '🟡 Med' : '🟢 Low'}
                    </span>
                  </li>
                ))}
              </ol>
              <div className="mt-3 pt-3 border-t border-tg-hint/20">
                <p className="text-xs text-tg-hint">
                  💡 Ketik <span className="font-mono">/weakness</span> di bot untuk drill otomatis berdasarkan kelemahan ini.
                </p>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Review Answers */}
      {review.length > 0 && (
        <div className="mb-6">
          <button
            onClick={() => setShowReview(!showReview)}
            className="w-full flex items-center justify-between bg-tg-secondary rounded-xl p-4 mb-3"
          >
            <span className="font-semibold">📝 Review Jawaban</span>
            <span className="text-tg-hint">{showReview ? '▲' : '▼'}</span>
          </button>

          {showReview && (
            <div className="space-y-4">
              {review.map((item, idx) => (
                <div key={idx} className="bg-tg-secondary rounded-xl p-4">
                  <div className="flex items-start justify-between mb-2 gap-2">
                    <span className="text-xs text-tg-hint capitalize">{item.section} · Q{item.question_index + 1}</span>
                    <div className="flex items-center gap-2">
                      {item.is_correct === true && (
                        <span className="text-xs font-bold text-green-500">✅ Benar</span>
                      )}
                      {item.is_correct === false && (
                        <span className="text-xs font-bold text-red-500">❌ Salah</span>
                      )}
                      {item.is_correct === null && (
                        <span className="text-xs font-bold text-yellow-500">📋 Ditinjau</span>
                      )}
                      <ReportIssueButton
                        contentId={item.content_id}
                        attemptId={attemptId ? Number(attemptId) : null}
                        compact
                      />
                    </div>
                  </div>

                  {item.question_text && (
                    <p className="text-sm font-medium mb-2">{item.question_text}</p>
                  )}

                  {item.passage && (
                    <p className="text-xs text-tg-hint mb-2 line-clamp-2">{item.passage.substring(0, 200)}...</p>
                  )}

                  {(item.options || []).length > 0 && (
                    <div className="space-y-1 mb-2">
                      {(item.options || []).map((opt: any, i: number) => {
                        const letter = typeof opt === 'string' ? opt.charAt(0) : (opt?.key || String.fromCharCode(65 + i));
                        const text = typeof opt === 'string' ? opt : (opt?.text || '');
                        const isSelected = item.answer_data?.selected === letter;
                        const isCorrectOpt = item.correct_answer?.toUpperCase() === letter;
                        return (
                          <div key={i} className={`text-sm p-2 rounded-lg ${
                            isCorrectOpt ? 'bg-green-500/20 text-green-600 dark:text-green-400 font-medium' :
                            isSelected ? 'bg-red-500/20 text-red-600 dark:text-red-400' :
                            'bg-tg-bg text-tg-text'
                          }`}>
                            <span className="font-bold mr-2">{letter}.</span>
                            {text}
                            {isSelected && !isCorrectOpt && ' ← jawaban kamu'}
                            {isCorrectOpt && ' ← jawaban benar'}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {item.explanation && (
                    <div className="bg-tg-secondary border border-tg-hint/20 rounded-lg p-3 mt-2">
                      <p className="text-xs font-medium text-tg-link mb-1">💡 Penjelasan:</p>
                      <p className="text-xs text-tg-text leading-relaxed">{item.explanation}</p>
                    </div>
                  )}

                  {item.is_correct === false && (
                    <button
                      onClick={() => handleAskWhy(item)}
                      className="mt-2 w-full text-xs bg-purple-100 text-purple-800 py-2 px-3 rounded-lg font-medium hover:bg-purple-200"
                    >
                      🤖 Tanya AI kenapa salah
                    </button>
                  )}

                  {item.answer_data?.text && (
                    <div className="mt-2">
                      <p className="text-xs text-tg-hint mb-1">Jawaban kamu:</p>
                      <p className="text-sm bg-tg-bg rounded-lg p-2 italic">"{item.answer_data.text}"</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Share score CTA */}
      <div className="mb-20">
        <button
          onClick={handleShareScore}
          className="w-full bg-gradient-to-r from-blue-500 to-purple-500 text-white py-3 rounded-xl font-medium"
        >
          📤 Share skor kamu
        </button>
        <p className="text-xs text-tg-hint text-center mt-2">
          Pamer ke teman + dapat bonus referral 🎁
        </p>
      </div>

      {/* Actions */}
      <div className="fixed bottom-0 left-0 right-0 bg-tg-bg border-t border-tg-secondary p-4">
        <div className="max-w-lg mx-auto flex gap-3">
          <button
            onClick={handleClose}
            className="flex-1 bg-tg-secondary text-tg-text py-3 rounded-xl font-medium"
          >
            Kembali ke Tes
          </button>
          <button
            onClick={() => navigate('/progress')}
            className="flex-1 bg-tg-button text-tg-button-text py-3 rounded-xl font-medium"
          >
            Lihat Progres
          </button>
        </div>
      </div>
    </div>
  );
}
