import React from 'react';
import { Language } from '../types';

interface LanguageToggleProps {
  currentLang: Language;
  onToggle: (lang: Language) => void;
}

const LanguageToggle: React.FC<LanguageToggleProps> = ({ currentLang, onToggle }) => {
  return (
    <div className="flex bg-white rounded-full p-1 shadow-sm border border-gray-200">
      <button
        onClick={() => onToggle(Language.ENGLISH)}
        className={`px-3 py-1 text-xs font-semibold rounded-full transition-colors ${
          currentLang === Language.ENGLISH
            ? 'bg-blue-600 text-white'
            : 'text-gray-500 hover:bg-gray-100'
        }`}
      >
        ENG
      </button>
      <button
        onClick={() => onToggle(Language.BANGLA)}
        className={`px-3 py-1 text-xs font-semibold rounded-full transition-colors ${
          currentLang === Language.BANGLA
            ? 'bg-green-600 text-white'
            : 'text-gray-500 hover:bg-gray-100'
        }`}
      >
        বাংলা
      </button>
    </div>
  );
};

export default LanguageToggle;