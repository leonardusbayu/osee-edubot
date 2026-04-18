import { create } from 'zustand';
import { useAuthStore } from './auth';
import type { SectionInfo } from '../types';

interface PendingAnswer {
  section: string;
  questionIndex: number;
  answerData: any;
  retries: number;
  maxRetries: number;
  // Idempotency key generated once when the answer is queued. Sent on
  // every retry so the server can dedup a second POST for the same
  // logical submission (see migration 052 + BUGS.md #1).
  clientUuid: string;
}

interface TestState {
  attemptId: number | null;
  testType: string | null;
  sections: SectionInfo[];
  currentSection: string | null;
  currentQuestionIndex: number;
  timeRemaining: number | null;
  answers: Record<string, Record<number, unknown>>;
  isFinished: boolean;
  questionType: string | null; // Filter for section-specific practice
  drillConcept: string | null; // When set, /questions is filtered by skill_tag
  drillCount: number | null;   // Target question count for drill mode

  // Offline-first mode
  prefetchedQuestions: Record<string, any[]>; // questions_by_section cache
  isPrefetchingQuestions: boolean;
  pendingAnswers: PendingAnswer[]; // Queued answers awaiting sync
  networkAvailable: boolean;

  startTest: (attemptId: number, testType: string, sections: SectionInfo[], currentSection: string, questionType?: string | null, drill?: { concept: string; count: number } | null) => void;
  setCurrentSection: (section: string) => void;
  setQuestionIndex: (index: number) => void;
  setTimeRemaining: (seconds: number) => void;
  saveAnswer: (section: string, questionIndex: number, answer: unknown) => void;
  finishTest: () => void;
  reset: () => void;

  // Offline-first methods
  prefetchQuestions: (attemptId: number) => Promise<boolean>;
  getNextQuestion: (section: string, index: number) => any | null;
  queueAnswer: (section: string, questionIndex: number, answerData: any) => void;
  setPrefetchingState: (loading: boolean) => void;
  setNetworkAvailable: (available: boolean) => void;
  getPendingAnswers: () => PendingAnswer[];
  clearPendingAnswer: (section: string, questionIndex: number) => void;
  incrementPendingRetry: (section: string, questionIndex: number) => void;
  dropDeadPendingAnswers: () => number;
}

export const useTestStore = create<TestState>((set, get) => ({
  attemptId: null,
  testType: null,
  sections: [],
  currentSection: null,
  currentQuestionIndex: 0,
  timeRemaining: null,
  answers: {},
  isFinished: false,
  questionType: null,
  drillConcept: null,
  drillCount: null,

  // Offline-first mode
  prefetchedQuestions: {},
  isPrefetchingQuestions: false,
  pendingAnswers: [],
  networkAvailable: typeof navigator !== 'undefined' ? navigator.onLine : true,

  startTest: (attemptId, testType, sections, currentSection, questionType, drill) =>
    set({
      attemptId,
      testType,
      sections,
      currentSection,
      currentQuestionIndex: 0,
      timeRemaining: null,
      answers: {},
      isFinished: false,
      questionType: questionType || null,
      drillConcept: drill?.concept || null,
      drillCount: drill?.count || null,
      prefetchedQuestions: {},
      pendingAnswers: [],
      networkAvailable: typeof navigator !== 'undefined' ? navigator.onLine : true,
    }),

  setCurrentSection: (section) => set({ currentSection: section, currentQuestionIndex: 0 }),
  setQuestionIndex: (index) => set({ currentQuestionIndex: index }),
  setTimeRemaining: (seconds) => set({ timeRemaining: seconds }),

  saveAnswer: (section, questionIndex, answer) =>
    set((state) => ({
      answers: {
        ...state.answers,
        [section]: {
          ...(state.answers[section] || {}),
          [questionIndex]: answer,
        },
      },
    })),

  finishTest: () => set({ isFinished: true }),

  reset: () =>
    set({
      attemptId: null,
      testType: null,
      sections: [],
      currentSection: null,
      currentQuestionIndex: 0,
      timeRemaining: null,
      answers: {},
      isFinished: false,
      questionType: null,
      drillConcept: null,
      drillCount: null,
      prefetchedQuestions: {},
      isPrefetchingQuestions: false,
      pendingAnswers: [],
    }),

  // Offline-first: Prefetch all questions for the test
  prefetchQuestions: async (attemptId: number) => {
    const state = get();
    if (state.isPrefetchingQuestions) return false;

    set({ isPrefetchingQuestions: true });

    try {
      const response = await fetch(`/api/tests/attempt/${attemptId}/questions-batch`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${useAuthStore.getState().accessToken || ''}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        console.error('[TestStore] Prefetch failed:', response.status);
        set({ isPrefetchingQuestions: false });
        return false;
      }

      const data = await response.json();
      set({
        prefetchedQuestions: data.questions_by_section || {},
        isPrefetchingQuestions: false,
      });
      console.log('[TestStore] Prefetched questions:', Object.keys(data.questions_by_section || {}).map(s => `${s}: ${(data.questions_by_section[s] || []).length}`));
      return true;
    } catch (err) {
      console.error('[TestStore] Prefetch error:', err);
      set({ isPrefetchingQuestions: false });
      return false;
    }
  },

  // Get question from prefetched cache
  getNextQuestion: (section: string, index: number) => {
    const state = get();
    const questions = state.prefetchedQuestions[section] || [];
    return questions[index] || null;
  },

  // Queue answer for syncing
  queueAnswer: (section: string, questionIndex: number, answerData: any) => {
    // Generate an idempotency key once per queued submission. The sync
    // loop sends this on every retry so the server dedups if an earlier
    // attempt actually persisted but the HTTP response was lost (common
    // on poor mobile connections). crypto.randomUUID is in all modern
    // browsers and Telegram's in-app webview; fallback covers the rare
    // edge case where it isn't.
    const clientUuid =
      (typeof crypto !== 'undefined' && typeof (crypto as any).randomUUID === 'function')
        ? (crypto as any).randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
    set((state) => ({
      pendingAnswers: [
        ...state.pendingAnswers,
        {
          section,
          questionIndex,
          answerData,
          retries: 0,
          maxRetries: 3,
          clientUuid,
        },
      ],
    }));
  },

  setPrefetchingState: (loading: boolean) => set({ isPrefetchingQuestions: loading }),
  setNetworkAvailable: (available: boolean) => set({ networkAvailable: available }),

  getPendingAnswers: () => get().pendingAnswers,

  clearPendingAnswer: (section: string, questionIndex: number) => {
    set((state) => ({
      pendingAnswers: state.pendingAnswers.filter(
        (a) => !(a.section === section && a.questionIndex === questionIndex)
      ),
    }));
  },

  // Persist retry count to the store (previously was lost because the sync
  // loop mutated a local copy from a spread). Without this, maxRetries never
  // actually bounds the retry loop and failed answers become zombies.
  incrementPendingRetry: (section: string, questionIndex: number) => {
    set((state) => ({
      pendingAnswers: state.pendingAnswers.map((a) =>
        a.section === section && a.questionIndex === questionIndex
          ? { ...a, retries: a.retries + 1 }
          : a
      ),
    }));
  },

  // Remove answers that exhausted maxRetries — returns number dropped so the
  // caller can warn the user that some offline answers were abandoned.
  dropDeadPendingAnswers: () => {
    const before = get().pendingAnswers.length;
    set((state) => ({
      pendingAnswers: state.pendingAnswers.filter((a) => a.retries < a.maxRetries),
    }));
    return before - get().pendingAnswers.length;
  },
}));
