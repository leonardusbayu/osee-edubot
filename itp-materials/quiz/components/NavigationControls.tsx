
import React from 'react';

interface NavigationControlsProps {
  onPrevious?: () => void;
  onNext?: () => void;
  previousText?: string;
  nextText?: string;
  canPrevious?: boolean;
  canNext?: boolean;
}

const NavigationControls: React.FC<NavigationControlsProps> = ({
  onPrevious,
  onNext,
  previousText = "Previous",
  nextText = "Next",
  canPrevious = true,
  canNext = true,
}) => {
  return (
    <div className="flex justify-between mt-8">
      {onPrevious && (
        <button
          onClick={onPrevious}
          disabled={!canPrevious}
          className={`py-2 px-6 rounded-lg font-semibold shadow-md transition duration-300 ease-in-out transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-opacity-50
            ${!canPrevious ? 'bg-gray-300 text-gray-500 cursor-not-allowed' : 'bg-gray-500 hover:bg-gray-600 text-white focus:ring-gray-400'}`}
        >
          {previousText}
        </button>
      )}
      <div /> {/* Spacer if only one button */}
      {onNext && (
        <button
          onClick={onNext}
          disabled={!canNext}
          className={`py-2 px-6 rounded-lg font-semibold shadow-md transition duration-300 ease-in-out transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-opacity-50
            ${!canNext ? 'bg-gray-300 text-gray-500 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 text-white focus:ring-blue-500'}`}
        >
          {nextText}
        </button>
      )}
    </div>
  );
};

export default NavigationControls;
