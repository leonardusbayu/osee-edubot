
import React from 'react';
import { Question, UserAnswers } from '../types';
import QuestionCard from './QuestionCard';
import LoadingSpinner from './LoadingSpinner';

interface QuizViewProps {
  questions: Question[];
  userAnswers: UserAnswers;
  onOptionSelect: (questionId: string, optionId: string) => void;
  onSubmit: () => void;
  isLoading: boolean;
  partTitle: string;
}

const QuizView: React.FC<QuizViewProps> = ({ questions, userAnswers, onOptionSelect, onSubmit, isLoading, partTitle }) => {
  const allAnswered = questions.every(q => userAnswers[q.id]);

  return (
    <div className="max-w-3xl mx-auto py-8 px-4">
      <h2 className="text-3xl font-bold text-center text-blue-700 mb-8">{partTitle}</h2>
      {questions.map((question, index) => (
        <QuestionCard
          key={question.id}
          question={question}
          selectedOption={userAnswers[question.id]}
          onOptionSelect={onOptionSelect}
          questionNumberDisplay={index + 1}
        />
      ))}
      <div className="mt-8 text-center">
        {isLoading ? (
          <LoadingSpinner />
        ) : (
          <button
            onClick={onSubmit}
            disabled={!allAnswered || isLoading}
            className={`font-semibold py-3 px-10 rounded-lg shadow-md transition duration-300 ease-in-out transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-opacity-50
                        ${!allAnswered || isLoading 
                          ? 'bg-gray-400 text-gray-700 cursor-not-allowed' 
                          : 'bg-green-600 hover:bg-green-700 text-white focus:ring-green-500'}`}
          >
            Submit for Feedback
          </button>
        )}
        {!allAnswered && !isLoading && (
            <p className="text-sm text-red-500 mt-2">Please answer all questions before submitting.</p>
        )}
      </div>
    </div>
  );
};

export default QuizView;
