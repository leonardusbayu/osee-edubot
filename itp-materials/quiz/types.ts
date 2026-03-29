
export interface QuestionOption {
  id: string; // 'A', 'B', 'C', 'D'
  text: string;
}

export interface Question {
  id: string; // e.g., "LPA-1"
  sectionId: string;
  partId: string;
  questionNumber: number;
  questionText?: string; // For structure/reading questions
  options: QuestionOption[];
  image?: string; // For questions that might refer to an image (not used in this version)
}

export interface PartData {
  id: string;
  title: string;
  instructions?: string[];
  questions: Question[];
}

export interface SectionData {
  id: string;
  title: string;
  instructions?: string[];
  parts: PartData[];
}

export interface UserAnswers {
  [questionId: string]: string; // e.g., { "LPA-1": "A" }
}

export interface QuestionFeedback {
  questionId: string;
  userAnswer: string;
  correctAnswer: string;
  explanation: string;
  userAnswerFeedback?: string;
}

export interface GeminiFeedbackResponse {
  feedback: QuestionFeedback[];
}

export enum AppState {
  Welcome,
  SectionInstructions,
  PartInstructions,
  Quiz,
  Feedback,
}
