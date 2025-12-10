


import React, { useEffect, useState } from 'react';
import { Undo2, ArrowLeftRight, RotateCcw, Menu, ChevronDown, ChevronUp, Mic, MicOff } from 'lucide-react';
import { useTranslation } from '../../contexts/LanguageContext';
import { useLayoutManager } from '../../contexts/LayoutContext';
import { useElementSize } from '../../hooks/useElementSize';
import { motion, AnimatePresence } from 'framer-motion';
import { springSnappy } from '../../utils/animations';

interface FloatingControlBarProps {
  onUndo: () => void;
  canUndo: boolean;
  onSwap: () => void;
  onReset: () => void;
  onMenu: () => void;
  voiceEnabled: boolean;
  isListening: boolean;
  onToggleListening: () => void;
}

export const FloatingControlBar: React.FC<FloatingControlBarProps> = ({ 
  onUndo, canUndo, onSwap, onReset, onMenu, voiceEnabled, isListening, onToggleListening
}) => {
  const { t } = useTranslation();
  const [isMinimized, setIsMinimized] = useState(false);
  const [isHovering, setIsHovering] = useState(false);
  
  const { scale, registerElement } = useLayoutManager();
  const { ref, width, height } = useElementSize<HTMLDivElement>();

  useEffect(() => {
    registerElement('controls', width, height);
  }, [width, height, registerElement]);

  useEffect(() => {
    if (isMinimized || isHovering) return;
    const timer = setTimeout(() => setIsMinimized(true), 4000);
    return () => clearTimeout(timer);
  }, [isMinimized, isHovering]);

  const glassContainer = "bg-white/80 dark:bg-black/80 backdrop-blur-xl border border-white/20 dark:border-white/10 shadow-2xl shadow-black/20 ring-1 ring-black/5 dark:ring-white/5";
  const buttonBase = "rounded-full transition-all duration-300 active:scale-90 flex items-center justify-center text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white bg-transparent hover:bg-black/5 dark:hover:bg-white/10";
  const pClass = 'p-3';
  const iconSize = 20;

  return (
    <div 
      ref={ref}
      style={{ transform: `translateX(-50%) scale(${scale})` }}
      className="fixed bottom-[calc(env(safe-area-inset-bottom)+1.5rem)] left-1/2 z-50 origin-bottom flex flex-col items-center"
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
    >
      <AnimatePresence mode="wait" initial={false}>
        {!isMinimized ? (
          <motion.div
            key="expanded"
            initial={{ y: 40, opacity: 0, scale: 0.9 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 40, opacity: 0, scale: 0.9 }}
            transition={springSnappy}
            className={`flex items-center gap-2 p-1.5 rounded-[2rem] ${glassContainer}`}
          >
            <button 
              onClick={onUndo} 
              disabled={!canUndo}
              className={`${buttonBase} ${pClass} disabled:opacity-30 disabled:cursor-not-allowed`}
              title={t('controls.undo')}
            >
              <Undo2 size={iconSize} strokeWidth={1.5} />
            </button>

            <button onClick={onSwap} className={`${buttonBase} ${pClass}`} title={t('controls.swap')}>
              <ArrowLeftRight size={iconSize} strokeWidth={1.5} />
            </button>

            {voiceEnabled && (
                <button 
                    onClick={onToggleListening} 
                    className={`${buttonBase} ${pClass} ${isListening ? 'bg-rose-500 text-white shadow-lg shadow-rose-500/30 animate-pulse hover:text-white hover:bg-rose-600' : ''}`} 
                    title="Voice Control"
                >
                    {isListening ? <Mic size={iconSize} strokeWidth={1.5} /> : <MicOff size={iconSize} strokeWidth={1.5} />}
                </button>
            )}

            <div className="w-px h-5 bg-black/10 dark:bg-white/10 mx-0.5"></div>

            <button onClick={onReset} className={`${buttonBase} ${pClass} text-rose-500 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10`} title={t('controls.reset')}>
              <RotateCcw size={iconSize} strokeWidth={1.5} />
            </button>

            <button onClick={onMenu} className={`${buttonBase} ${pClass} bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400`} title={t('game.menu')}>
                <Menu size={iconSize} strokeWidth={1.5} />
            </button>

            <div className="w-px h-5 bg-black/10 dark:bg-white/10 mx-0.5"></div>

            <button 
              onClick={() => setIsMinimized(true)}
              className={`${buttonBase} p-2 w-10 h-10`}
              title="Minimize"
            >
              <ChevronDown size={18} />
            </button>

          </motion.div>
        ) : (
          <motion.button
            key="collapsed"
            onClick={() => setIsMinimized(false)}
            initial={{ y: 40, opacity: 0, scale: 0.5 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 40, opacity: 0, scale: 0.5 }}
            transition={springSnappy}
            className={`
               h-10 px-6 rounded-full flex items-center justify-center gap-2
               ${glassContainer} hover:bg-white dark:hover:bg-black transition-colors
               text-slate-400 hover:text-indigo-500 group
            `}
          >
            <div className="w-8 h-1 rounded-full bg-slate-300 dark:bg-white/20 group-hover:bg-indigo-400 transition-colors"></div>
            <ChevronUp size={16} className="absolute -top-6 opacity-0 group-hover:opacity-100 group-hover:-top-3 transition-all duration-300" />
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
};