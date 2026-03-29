import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { useTestStore } from '../stores/test';
import type { TestResult } from '../types';

export default function TestResults() {
  const { attemptId } = useParams<{ attemptId: string }>();
  const navigate = useNavigate();
  const { reset } = useTestStore();
  const [result, setResult] = useState<TestResult | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadResults();
  }, []);

  async function loadResults() {
    try {
      const data = await api.getResults(Number(attemptId));
      setResult(data);
    } catch {
      // No fake data — show null state
      setResult(null);
    } finally {
      setLoading(false);
    }
  }

  function handleClose() {
    reset();
    navigate('/test');
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
          {Object.entries(result.section_scores).map(([section, score]) => (
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
