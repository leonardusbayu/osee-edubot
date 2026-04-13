import { create } from 'zustand';
import type { SectionInfo } from '../types';

interface PendingAnswer {
  section: string;
  questionIndex: number;
  answerData: any;
  retries: number;
  maxRetries: number;
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

  // Offline-first mode
  prefetchedQuestions: Record<string, any[]>; // questions_by_section cache
  isPrefetchingQuestions: boolean;
  pendingAnswers: PendingAnswer[]; // Queued answers awaiting sync
  networkAvailable: boolean;

  startTest: (attemptId: number, testType: string, sections: SectionInfo[], currentSection: string, questionType?: string | null) => void;
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

  // Offline-first mode
  prefetchedQuestions: {},
  isPrefetchingQuestions: false,
  pendingAnswers: [],
  networkAvailable: typeof navigator !== 'undefined' ? navigator.onLine : true,

  startTest: (attemptId, testType, sections, currentSection, questionType) =>
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
          'Authorization': `Bearer ${(window as any).__AUTH_TOKEN__ || ''}`,
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
    set((state) => ({
      pendingAnswers: [
        ...state.pendingAnswers,
        {
          section,
          questionIndex,
          answerData,
          retries: 0,
          maxRetries: 3,
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
}));
