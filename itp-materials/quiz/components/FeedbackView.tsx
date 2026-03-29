
import React from 'react';
import { QuestionFeedback, Question } from '../types';

interface FeedbackViewProps {
  feedback: QuestionFeedback[];
  questions: Question[];
  onNext: () => void;
  isLastPart: boolean;
}

const FeedbackView: React.FC<FeedbackViewProps> = ({ feedback, questions, onNext, isLastPart }) => {
  const getQuestionText = (questionId: string): string | undefined => {
    const question = questions.find(q => q.id === questionId);
    if (question?.sectionId === 'listening-comprehension' && !question?.questionText) {
      return `Listening Question (Choices for implied scenario)`;
    }
    return question?.questionText;
  };
  
  const getQuestionOptions = (questionId: string): {id: string, text: string}[] => {
    return questions.find(q => q.id === questionId)?.options || [];
  };

  return (
    <div className="max-w-3xl mx-auto py-8 px-4 animate-fadeIn">
      <h2 className="text-3xl font-bold text-center text-purple-700 mb-8">Feedback Report</h2>
      {feedback.map((item, index) => (
        <div key={item.questionId} className="bg-white p-6 rounded-lg shadow-lg mb-6">
          <h3 className="text-xl font-semibold text-gray-800 mb-2">
            Question {index + 1}
            {getQuestionText(item.questionId) && <span className="block text-purple-600 mt-1 text-base">{getQuestionText(item.questionId)}</span>}
          </h3>
          
          <div className="mb-3">
            <p className="font-medium text-gray-700">Options:</p>
            <ul className="list-disc list-inside pl-4 text-sm text-gray-600">
              {getQuestionOptions(item.questionId).map(opt => (
                <li key={opt.id} className={`${item.correctAnswer === opt.id ? 'text-green-700 font-semibold' : ''} ${item.userAnswer === opt.id && item.userAnswer !== item.correctAnswer ? 'text-red-700' : ''}`}>
                  ({opt.id}) {opt.text}
                </li>
              ))}
            </ul>
          </div>

          <p className="text-sm text-gray-600 mb-1">
            Your Answer: <span className={`font-semibold ${item.userAnswer === item.correctAnswer ? 'text-green-700' : 'text-red-700'}`}>
              {item.userAnswer}
            </span>
          </p>
          <p className="text-sm text-gray-600 mb-1">
            Correct Answer: <span className="font-semibold text-green-700">{item.correctAnswer}</span>
          </p>
          <div className="mt-2 p-3 bg-purple-50 rounded-md border border-purple-200">
            <p className="text-sm text-purple-800 font-medium mb-1">Explanation:</p>
            <p className="text-sm text-gray-700 whitespace-pre-wrap">{item.explanation}</p>
          </div>
        </div>
      ))}
      <div className="mt-8 text-center">
        <button
          onClick={onNext}
          className="bg-purple-600 hover:bg-purple-700 text-white font-semibold py-3 px-8 rounded-lg shadow-md transition duration-300 ease-in-out transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-opacity-50"
        >
          {isLastPart ? 'Finish Quiz & Restart' : 'Next Part'}
        </button>
      </div>
    </div>
  );
};

export default FeedbackView;
