import { create } from 'zustand';
import type { SectionInfo } from '../types';

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

  startTest: (attemptId: number, testType: string, sections: SectionInfo[], currentSection: string, questionType?: string | null) => void;
  setCurrentSection: (section: string) => void;
  setQuestionIndex: (index: number) => void;
  setTimeRemaining: (seconds: number) => void;
  saveAnswer: (section: string, questionIndex: number, answer: unknown) => void;
  finishTest: () => void;
  reset: () => void;
}

export const useTestStore = create<TestState>((set) => ({
  attemptId: null,
  testType: null,
  sections: [],
  currentSection: null,
  currentQuestionIndex: 0,
  timeRemaining: null,
  answers: {},
  isFinished: false,
  questionType: null,

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
    }),
}));
