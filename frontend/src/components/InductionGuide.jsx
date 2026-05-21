import { useState } from 'react';
import { Sparkles, ArrowRight, ArrowLeft, Bookmark, HelpCircle } from 'lucide-react';

export const InductionGuide = ({ t, language, onTriggerQuery }) => {
  const [currentStep, setCurrentStep] = useState(0);

  const steps = [
    {
      title: t.inductSlide1Title,
      text: t.inductSlide1Text,
      prompt: t.inductSlide1Prompt,
      icon: <Bookmark className="w-8 h-8 text-blue-400" />
    },
    {
      title: t.inductSlide2Title,
      text: t.inductSlide2Text,
      prompt: t.inductSlide2Prompt,
      icon: <Sparkles className="w-8 h-8 text-purple-400" />
    },
    {
      title: t.inductSlide3Title,
      text: t.inductSlide3Text,
      prompt: t.inductSlide3Prompt,
      icon: <HelpCircle className="w-8 h-8 text-emerald-400" />
    }
  ];

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(prev => prev + 1);
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const currentStepData = steps[currentStep];

  return (
    <div className="w-full max-w-4xl mx-auto p-4 md:p-8 animate-fade-in">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-extrabold text-white tracking-wide drop-shadow-md">
          {t.inductTitle}
        </h1>
        <p className="text-gray-300 text-sm mt-2 max-w-2xl mx-auto">
          {t.inductSubtitle}
        </p>
      </div>

      <div className="bg-white/10 backdrop-blur-xl border border-white/10 rounded-3xl p-6 md:p-10 shadow-2xl relative overflow-hidden transition-all duration-300">
        {/* Decorative ambient background glows */}
        <div className="absolute -top-24 -left-24 w-48 h-48 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Step progress bar */}
        <div className="w-full bg-white/5 h-2 rounded-full mb-8 flex overflow-hidden">
          {steps.map((_, index) => (
            <div
              key={index}
              className={`h-full flex-1 transition-all duration-500 ${
                index <= currentStep ? 'bg-gradient-to-r from-blue-500 to-indigo-500' : 'bg-transparent'
              } ${index > 0 ? 'border-l border-black/25' : ''}`}
            />
          ))}
        </div>

        {/* Card Header & Content */}
        <div className="flex flex-col md:flex-row items-start gap-6 md:gap-8 min-h-[220px]">
          <div className="bg-white/5 p-4 rounded-2xl border border-white/10 flex items-center justify-center shrink-0">
            {currentStepData.icon}
          </div>
          <div className="flex-1 space-y-4">
            <h2 className="text-2xl font-bold text-white tracking-wide">
              {currentStepData.title}
            </h2>
            <p className="text-gray-200 text-base leading-relaxed">
              {currentStepData.text}
            </p>

            <div className="bg-blue-500/10 border border-blue-500/20 rounded-2xl p-4 mt-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <p className="text-xs text-blue-300 font-semibold tracking-wider uppercase mb-1">
                  {language === 'es' ? 'PREGUNTA RECOMENDADA' : 'RECOMMENDED QUESTION'}
                </p>
                <p className="text-white text-sm italic font-medium">
                  "{currentStepData.prompt}"
                </p>
              </div>
              <button
                onClick={() => onTriggerQuery(currentStepData.prompt)}
                className="bg-indigo-500 hover:bg-indigo-600 active:scale-95 transition-all text-white px-5 py-2.5 rounded-xl font-bold text-sm shrink-0 flex items-center gap-2 shadow-lg shadow-indigo-500/20"
              >
                <Sparkles className="w-4 h-4" />
                {t.inductQuickBtn}
              </button>
            </div>
          </div>
        </div>

        {/* Card Footer Actions */}
        <div className="flex items-center justify-between border-t border-white/5 pt-6 mt-8">
          <button
            onClick={handlePrev}
            disabled={currentStep === 0}
            className={`flex items-center gap-2 text-sm font-bold transition-all px-4 py-2 rounded-xl ${
              currentStep === 0
                ? 'text-gray-500 cursor-not-allowed'
                : 'text-white bg-white/5 hover:bg-white/10'
            }`}
          >
            <ArrowLeft className="w-4 h-4" />
            {language === 'es' ? 'Anterior' : 'Previous'}
          </button>

          <span className="text-gray-400 text-xs font-semibold">
            {t.inductProgress
              .replace('{step}', currentStep + 1)
              .replace('{total}', steps.length)}
          </span>

          <button
            onClick={handleNext}
            disabled={currentStep === steps.length - 1}
            className={`flex items-center gap-2 text-sm font-bold transition-all px-4 py-2 rounded-xl ${
              currentStep === steps.length - 1
                ? 'text-gray-500 cursor-not-allowed'
                : 'text-white bg-white/5 hover:bg-white/10'
            }`}
          >
            {language === 'es' ? 'Siguiente' : 'Next'}
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
