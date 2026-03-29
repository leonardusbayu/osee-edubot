
import React, { useState, useCallback, useEffect } from 'react';
import { QUIZ_DATA } from './constants/quizData';
import { SectionData, PartData, Question, UserAnswers, QuestionFeedback, AppState } from './types';
import { getFeedbackFromGemini } from './services/geminiService';
import QuizView from './components/QuizView';
import FeedbackView from './components/FeedbackView';
import InstructionView from './components/InstructionView';

const App: React.FC = () => {
  const [appState, setAppState] = useState<AppState>(AppState.Welcome);
  const [currentSectionIndex, setCurrentSectionIndex] = useState<number>(0);
  const [currentPartIndex, setCurrentPartIndex] = useState<number>(0);
  
  const [userAnswers, setUserAnswers] = useState<UserAnswers>({});
  const [feedback, setFeedback] = useState<QuestionFeedback[] | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const currentSection: SectionData | undefined = QUIZ_DATA[currentSectionIndex];
  const currentPart: PartData | undefined = currentSection?.parts[currentPartIndex];

  const resetQuizForPart = useCallback(() => {
    setUserAnswers({});
    setFeedback(null);
    setError(null);
  }, []);
  
  useEffect(() => {
    if (currentPart) {
        resetQuizForPart();
    }
  }, [currentPart, resetQuizForPart]);


  const handleOptionSelect = useCallback((questionId: string, optionId: string) => {
    setUserAnswers(prev => ({ ...prev, [questionId]: optionId }));
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!currentPart || !currentSection) return;

    setIsLoading(true);
    setError(null);
    setFeedback(null);
    try {
      const response = await getFeedbackFromGemini(currentPart.questions, userAnswers, currentSection.title, currentPart.title);
      setFeedback(response.feedback);
      setAppState(AppState.Feedback);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unknown error occurred.");
      // Keep user on quiz page to see error, or could go to a dedicated error view.
    } finally {
      setIsLoading(false);
    }
  }, [currentPart, userAnswers, currentSection]);

  const advanceToNext = () => {
    setError(null); // Clear error on navigation
    if (!currentSection) { // Should not happen if quiz data is present
        setAppState(AppState.Welcome);
        return;
    }

    if (appState === AppState.Welcome) {
        setAppState(AppState.SectionInstructions);
        return;
    }
    if (appState === AppState.SectionInstructions) {
        setAppState(AppState.PartInstructions);
        return;
    }
    if (appState === AppState.PartInstructions) {
        setAppState(AppState.Quiz);
        return;
    }
    if (appState === AppState.Feedback) {
        const isLastPartInSection = currentPartIndex === currentSection.parts.length - 1;
        if (isLastPartInSection) {
            const isLastSection = currentSectionIndex === QUIZ_DATA.length - 1;
            if (isLastSection) {
                // Quiz finished, reset to welcome
                setCurrentSectionIndex(0);
                setCurrentPartIndex(0);
                setAppState(AppState.Welcome);
            } else {
                // Next section
                setCurrentSectionIndex(prev => prev + 1);
                setCurrentPartIndex(0);
                setAppState(AppState.SectionInstructions);
            }
        } else {
            // Next part in current section
            setCurrentPartIndex(prev => prev + 1);
            setAppState(AppState.PartInstructions);
        }
    }
  };
  
  const renderContent = () => {
    if (error && (appState === AppState.Quiz || appState === AppState.Feedback)) { // Show error prominently during quiz/feedback
      return (
        <div className="max-w-xl mx-auto my-10 p-6 bg-red-100 border border-red-400 text-red-700 rounded-lg shadow-md">
          <h3 className="font-bold text-lg mb-2">An Error Occurred</h3>
          <p className="text-sm">{error}</p>
          <button
            onClick={() => {
              setError(null); // Allow user to retry or continue
              if(appState === AppState.Feedback) advanceToNext(); // If error on feedback page, try to move on
            }}
            className="mt-4 bg-red-500 hover:bg-red-600 text-white font-semibold py-2 px-4 rounded"
          >
            {appState === AppState.Feedback ? "Continue" : "Try Again"}
          </button>
        </div>
      );
    }

    switch(appState) {
        case AppState.Welcome:
            return (
                <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-slate-200 to-sky-200 p-4">
                    <div className="bg-white p-8 md:p-12 rounded-xl shadow-2xl text-center max-w-lg animate-fadeIn">
                        <h1 className="text-4xl md:text-5xl font-bold text-blue-700 mb-4">TOEFL ITP Quiz</h1>
                        <p className="text-gray-600 mb-8 text-lg">Practice TOEFL ITP questions and get AI-powered feedback.</p>
                        <button
                        onClick={advanceToNext}
                        className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-10 rounded-lg shadow-lg transition duration-300 ease-in-out transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50"
                        >
                        Start Quiz
                        </button>
                    </div>
                </div>
            );
        case AppState.SectionInstructions:
            if (!currentSection) return <p>Loading section...</p>;
            return <InstructionView title={currentSection.title} instructions={currentSection.instructions || []} onNext={advanceToNext} buttonText="View Part Instructions"/>;
        case AppState.PartInstructions:
            if (!currentPart || !currentSection) return <p>Loading part...</p>;
            return <InstructionView title={`${currentSection.title} - ${currentPart.title}`} instructions={currentPart.instructions || []} onNext={advanceToNext} buttonText={`Start ${currentPart.title}`}/>;
        case AppState.Quiz:
            if (!currentPart) return <p>Loading questions...</p>;
            return (
                <QuizView
                questions={currentPart.questions}
                userAnswers={userAnswers}
                onOptionSelect={handleOptionSelect}
                onSubmit={handleSubmit}
                isLoading={isLoading}
                partTitle={currentPart.title}
                />
            );
        case AppState.Feedback:
            if (!feedback || !currentPart) return <p>Loading feedback...</p>;
             const isLastOverallPart = currentSectionIndex === QUIZ_DATA.length - 1 && currentPartIndex === (currentSection?.parts.length ?? 0) -1;
            return (
                <FeedbackView
                feedback={feedback}
                questions={currentPart.questions}
                onNext={advanceToNext}
                isLastPart={isLastOverallPart}
                />
            );
        default:
            return <p>Unknown application state.</p>;
    }
  }

  return (
    <div className="min-h-screen bg-slate-100 font-sans">
      <header className="bg-blue-700 text-white p-5 shadow-md">
        <h1 className="text-center text-2xl font-bold tracking-wide">TOEFL ITP Interactive Practice</h1>
      </header>
      <main className="container mx-auto px-2 py-2 md:py-5">
        {renderContent()}
      </main>
      <footer className="text-center py-6 text-sm text-gray-500 bg-slate-200">
        <p>&copy; {new Date().getFullYear()} TOEFL ITP Practice App. Powered by Gemini.</p>
      </footer>
    </div>
  );
};

export default App;
