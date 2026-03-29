
import React from 'react';

interface InstructionViewProps {
  title: string;
  instructions: string[];
  onNext: () => void;
  buttonText?: string;
}

const InstructionView: React.FC<InstructionViewProps> = ({ title, instructions, onNext, buttonText = "Continue" }) => {
  return (
    <div className="bg-white p-6 md:p-8 rounded-xl shadow-2xl max-w-2xl mx-auto my-8 animate-fadeIn">
      <h2 className="text-3xl font-bold text-blue-700 mb-6 text-center">{title}</h2>
      <div className="space-y-4 text-gray-700 leading-relaxed">
        {instructions.map((instruction, index) => (
          <p key={index} className="text-md">{instruction}</p>
        ))}
      </div>
      <div className="mt-8 text-center">
        <button
          onClick={onNext}
          className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-8 rounded-lg shadow-md transition duration-300 ease-in-out transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50"
        >
          {buttonText}
        </button>
      </div>
    </div>
  );
};

export default InstructionView;
