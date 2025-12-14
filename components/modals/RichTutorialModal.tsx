
import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronRight, Check, ChevronLeft, Pause, Play } from 'lucide-react';
import { useTranslation } from '../../contexts/LanguageContext';
import { TutorialKey } from '../../hooks/useTutorial';
import { TUTORIAL_SCENARIOS } from '../../data/tutorialContent';
import { resolveTheme } from '../../utils/colors';
import { TutorialVisual } from '../tutorial/TutorialVisuals';

interface RichTutorialModalProps {
  isOpen: boolean;
  tutorialKey: TutorialKey;
  onClose: (key: TutorialKey) => void;
}

const overlayVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
  exit: { opacity: 0 }
};

const modalVariants = {
  hidden: { scale: 0.95, opacity: 0, y: 20 },
  visible: { 
    scale: 1, 
    opacity: 1, 
    y: 0,
    transition: { type: "spring", stiffness: 350, damping: 30 }
  },
  exit: { scale: 0.95, opacity: 0, y: 10 }
};

const contentVariants = {
  enter: (direction: number) => ({
    x: direction > 0 ? 50 : -50,
    opacity: 0,
    scale: 0.95
  }),
  center: {
    zIndex: 1,
    x: 0,
    opacity: 1,
    scale: 1,
    transition: { duration: 0.4, type: "spring", bounce: 0, stiffness: 300, damping: 30 }
  },
  exit: (direction: number) => ({
    zIndex: 0,
    x: direction < 0 ? 50 : -50,
    opacity: 0,
    scale: 0.95,
    transition: { duration: 0.2 }
  })
};

export const RichTutorialModal: React.FC<RichTutorialModalProps> = ({ 
  isOpen, tutorialKey, onClose 
}) => {
  const { t } = useTranslation();
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [direction, setDirection] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  
  // FIX: Animation Auto-Start Logic
  const [isReady, setIsReady] = useState(false);

  const steps = useMemo(() => TUTORIAL_SCENARIOS[tutorialKey] || [], [tutorialKey]);
  const currentStep = steps[currentStepIndex];

  // Reset state when opening
  useEffect(() => {
    if (isOpen) {
      setCurrentStepIndex(0);
      setDirection(0);
      setIsPaused(false);
      setIsReady(false);
    }
  }, [isOpen, tutorialKey]);

  // Trigger animation start delay whenever step changes
  useEffect(() => {
      setIsReady(false);
      const timer = setTimeout(() => {
          setIsReady(true);
      }, 500); 
      return () => clearTimeout(timer);
  }, [currentStepIndex]);

  if (!isOpen || !currentStep) return null;

  const handleNext = () => {
    if (currentStepIndex < steps.length - 1) {
      setDirection(1);
      setCurrentStepIndex(prev => prev + 1);
    } else {
      onClose(tutorialKey);
    }
  };

  const handleBack = () => {
    if (currentStepIndex > 0) {
      setDirection(-1);
      setCurrentStepIndex(prev => prev - 1);
    }
  };

  const handleSkip = () => {
    onClose(tutorialKey);
  };

  const togglePause = () => {
    setIsPaused(!isPaused);
  };

  const colorTheme = resolveTheme(currentStep.color);
  
  // Calculate effective pause state
  const effectiveIsPaused = isPaused || !isReady;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 isolate">
          
          {/* Backdrop - Darker for focus */}
          <motion.div
            className="absolute inset-0 bg-slate-900/70 backdrop-blur-md"
            variants={overlayVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            onClick={handleSkip}
          />

          {/* Main Card */}
          <motion.div
            className="
                relative w-full max-w-[360px] 
                bg-white dark:bg-[#0f172a] 
                rounded-[2.5rem] shadow-2xl 
                overflow-hidden flex flex-col 
                ring-1 ring-white/20 dark:ring-white/10
            "
            variants={modalVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            onClick={(e) => e.stopPropagation()}
          >
            
            {/* Controls Layer */}
            <div className="absolute top-4 right-4 z-30 flex items-center gap-2">
               {/* Play/Pause Control */}
               <button 
                onClick={togglePause}
                className="p-2.5 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-white bg-white/20 hover:bg-white/40 backdrop-blur-sm transition-colors"
                title={isPaused ? "Play Animation" : "Pause Animation"}
              >
                {isPaused ? <Play size={18} fill="currentColor" /> : <Pause size={18} fill="currentColor" />}
              </button>

              {/* Close/Skip */}
              <button 
                onClick={handleSkip}
                className="p-2.5 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-white bg-white/20 hover:bg-white/40 backdrop-blur-sm transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Dynamic Content Container */}
            <div className="w-full flex flex-col">
              <AnimatePresence initial={false} custom={direction} mode="wait">
                <motion.div
                  key={currentStep.id} // CRITICAL: Key must be step ID
                  custom={direction}
                  variants={contentVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  className="w-full flex flex-col"
                >
                  
                  {/* 1. HERO VISUAL AREA - Slightly Taller */}
                  <div className="h-64 w-full relative overflow-hidden bg-slate-50 dark:bg-white/5 border-b border-black/5 dark:border-white/5">
                      <TutorialVisual 
                        visualId={currentStep.visualId || 'app_logo'} 
                        colorTheme={colorTheme} 
                        isPaused={effectiveIsPaused} 
                      />
                  </div>

                  {/* 2. Text Content Area */}
                  <div className="px-8 pt-8 pb-4 flex flex-col items-center text-center min-h-[180px]">
                    
                    {/* Progress Dots */}
                    <div className="flex justify-center gap-2 mb-6 opacity-80">
                        {steps.map((_, idx) => (
                        <div 
                            key={idx}
                            className={`
                            h-1.5 rounded-full transition-all duration-300
                            ${idx === currentStepIndex 
                                ? `w-8 ${colorTheme.halo}` 
                                : 'w-1.5 bg-slate-200 dark:bg-white/10'}
                            `}
                        />
                        ))}
                    </div>

                    <h2 className="text-3xl font-black text-slate-800 dark:text-white uppercase tracking-tight mb-4 leading-none">
                      {t(currentStep.titleKey)}
                    </h2>
                    
                    <p className="text-sm font-medium text-slate-500 dark:text-slate-400 leading-relaxed max-w-xs">
                        {t(currentStep.descKey)}
                    </p>
                    
                    {/* Welcome Opt-In */}
                    {currentStep.id === 'welcome' && (
                        <p className="mt-4 text-[10px] text-slate-400 dark:text-slate-600 italic">
                            {t('tutorial.welcome.optIn')}
                        </p>
                    )}
                  </div>

                </motion.div>
              </AnimatePresence>
            </div>

            {/* Footer Navigation */}
            <div className="px-8 pb-8 pt-4 bg-white dark:bg-[#0f172a] z-10 relative flex flex-col gap-3">
              
                <div className="flex gap-4">
                    {/* Back Button */}
                    {currentStepIndex > 0 ? (
                        <button 
                            onClick={handleBack}
                            className="p-4 rounded-2xl font-bold text-slate-400 hover:text-slate-600 dark:hover:text-white bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 transition-colors"
                        >
                            <ChevronLeft size={20} strokeWidth={3} />
                        </button>
                    ) : (
                        <button 
                            onClick={handleSkip}
                            className="p-4 rounded-2xl font-bold text-xs uppercase tracking-wider text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors"
                        >
                            {t('tutorial.skip')}
                        </button>
                    )}

                    {/* Next/Done Button */}
                    <button 
                        onClick={handleNext}
                        className={`
                            flex-1 py-4 rounded-2xl font-black text-xs uppercase tracking-widest text-white shadow-lg flex items-center justify-center gap-2 transition-transform active:scale-95
                            ${colorTheme.halo.replace('bg-', 'bg-')}
                        `}
                    >
                        {currentStepIndex < steps.length - 1 ? (
                            <>{t('tutorial.next')} <ChevronRight size={18} strokeWidth={3} /></>
                        ) : (
                            <>{t('common.done')} <Check size={18} strokeWidth={3} /></>
                        )}
                    </button>
                </div>

            </div>

          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
};
