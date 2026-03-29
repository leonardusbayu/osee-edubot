
import React from 'react';
import { Question, QuestionOption } from '../types';

interface QuestionCardProps {
  question: Question;
  selectedOption: string | undefined;
  onOptionSelect: (questionId: string, optionId: string) => void;
  questionNumberDisplay: number; // To display 1, 2, 3... for the current part
}

const QuestionCard: React.FC<QuestionCardProps> = ({ question, selectedOption, onOptionSelect, questionNumberDisplay }) => {
  return (
    <div className="bg-white p-6 rounded-lg shadow-lg mb-6 transition-all duration-300 hover:shadow-xl">
      <h3 className="text-lg font-semibold text-gray-800 mb-2">
        Question {questionNumberDisplay}
        {question.questionText && <span className="block text-blue-700 mt-1">{question.questionText}</span>}
        {!question.questionText && question.sectionId === 'listening-comprehension' && (
          <span className="block text-sm text-gray-500 mt-1">(Choose the best option for the implied listening scenario)</span>
        )}
      </h3>
      <div className="space-y-3">
        {question.options.map((option: QuestionOption) => (
          <label
            key={option.id}
            className={`flex items-center p-3 border rounded-md cursor-pointer transition-all duration-200 ease-in-out
                        ${selectedOption === option.id 
                          ? 'bg-blue-100 border-blue-500 ring-2 ring-blue-500' 
                          : 'bg-gray-50 hover:bg-gray-100 border-gray-300 hover:border-gray-400'}`}
          >
            <input
              type="radio"
              name={question.id}
              value={option.id}
              checked={selectedOption === option.id}
              onChange={() => onOptionSelect(question.id, option.id)}
              className="form-radio h-5 w-5 text-blue-600 focus:ring-blue-500 transition duration-150 ease-in-out mr-3"
            />
            <span className="text-gray-700">{option.text}</span>
          </label>
        ))}
      </div>
    </div>
  );
};

export default QuestionCard;
