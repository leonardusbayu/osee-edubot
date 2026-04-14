import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { authedFetch } from '../api/authedFetch';
import { useTestStore } from '../stores/test';
import type { TestResult } from '../types';

interface ReviewItem {
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

  useEffect(() => {
    loadResults();
  }, []);

  async function loadResults() {
    try {
      const data = await api.getResults(Number(attemptId));
      setResult(data);
      // Load review data
      try {
        const reviewRes = await authedFetch(`/api/tests/attempt/${attemptId}/review`);
        if (reviewRes.ok) {
          const reviewData = await reviewRes.json();
          setReview(reviewData.review || []);
        }
      } catch {}
    } catch {
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

  function handleAskWhy(item: ReviewItem) {
    const qText = (item.question_text || '').substring(0, 300);
    const userAns = item.answer_data?.selected || item.answer_data?.text || '(kosong)';
    const correct = item.correct_answer || '(n/a)';
    const question = `Aku salah di soal ini, tolong jelasin kenapa:\n\nSoal: "${qText}"\nJawaban aku: ${userAns}\nJawaban benar: ${correct}`;
    try {
      const tg: any = (window as any).Telegram?.WebApp;
      if (tg?.openTelegramLink) {
        const encoded = encodeURIComponent(question);
        tg.openTelegramLink(`https://t.me/OSEE_TOEFL_IELTS_TOEIC_study_bot?start=ask&text=${encoded}`);
        tg.close?.();
        return;
      }
    } catch {}
    // Fallback: copy to clipboard and show instruction
    try {
      navigator.clipboard.writeText(question);
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
          <p className="text-tg-hint">Scoring your test...</p>
        </div>
      </div>
    );
  }

  if (!result) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-tg-hint">No results found</p>
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
        <h1 className="text-2xl font-bold mb-1">Test Results</h1>
        <p className="text-tg-hint text-sm">
          {result.test_type.replace('_', ' ')} Practice Test
        </p>
      </div>

      {/* Overall Score */}
      <div className="bg-tg-secondary rounded-2xl p-6 text-center mb-6">
        <p className="text-tg-hint text-sm mb-1">Overall Band Score</p>
        <p className="text-5xl font-bold text-tg-button mb-2">
          {result.band_score || result.total_score}
        </p>
        <p className="text-tg-hint text-xs">out of 6.0</p>
      </div>

      {/* Section Scores */}
      <div className="mb-6">
        <h2 className="font-semibold mb-3">Section Breakdown</h2>
        <div className="space-y-3">
          {Object.entries(result.section_scores || {}).map(([section, score]) => (
            <div key={section} className="bg-tg-secondary rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium">{sectionNames[section] || section}</span>
                <span className="font-bold text-lg">{score}</span>
              </div>
              <div className="w-full bg-tg-bg rounded-full h-2">
                <div
                  className={`h-2 rounded-full ${sectionColors[section] || 'bg-tg-button'}`}
                  style={{ width: `${(score / 6) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* AI Feedback */}
      {result.ai_summary && (
        <div className="mb-6">
          <h2 className="font-semibold mb-3">AI Feedback</h2>
          <div className="bg-tg-secondary rounded-xl p-4">
            <p className="text-sm leading-relaxed">{result.ai_summary}</p>
          </div>
        </div>
      )}

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
                  <div className="flex items-start justify-between mb-2">
                    <span className="text-xs text-tg-hint capitalize">{item.section} · Q{item.question_index + 1}</span>
                    {item.is_correct === true && (
                      <span className="text-xs font-bold text-green-500">✅ Benar</span>
                    )}
                    {item.is_correct === false && (
                      <span className="text-xs font-bold text-red-500">❌ Salah</span>
                    )}
                    {item.is_correct === null && (
                      <span className="text-xs font-bold text-yellow-500">📋 Ditinjau</span>
                    )}
                  </div>

                  {item.question_text && (
                    <p className="text-sm font-medium mb-2">{item.question_text}</p>
                  )}

                  {item.passage && (
                    <p className="text-xs text-tg-hint mb-2 line-clamp-2">{item.passage.substring(0, 200)}...</p>
                  )}

                  {(item.options || []).length > 0 && (
                    <div className="space-y-1 mb-2">
                      {item.options.map((opt: any, i: number) => {
                        const letter = typeof opt === 'string' ? opt.charAt(0) : opt.key;
                        const text = typeof opt === 'string' ? opt : opt.text;
                        const isSelected = item.answer_data?.selected === letter;
                        const isCorrectOpt = item.correct_answer?.toUpperCase() === letter;
                        return (
                          <div key={i} className={`text-sm p-2 rounded-lg ${
                            isCorrectOpt ? 'bg-green-100 text-green-800 font-medium' :
                            isSelected ? 'bg-red-100 text-red-800' :
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
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mt-2">
                      <p className="text-xs font-medium text-blue-700 mb-1">💡 Penjelasan:</p>
                      <p className="text-xs text-blue-800 leading-relaxed">{item.explanation}</p>
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
            Back to Tests
          </button>
          <button
            onClick={() => navigate('/progress')}
            className="flex-1 bg-tg-button text-tg-button-text py-3 rounded-xl font-medium"
          >
            View Progress
          </button>
        </div>
      </div>
    </div>
  );
}
