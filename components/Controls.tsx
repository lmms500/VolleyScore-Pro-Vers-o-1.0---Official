
import React, { memo } from 'react';
import { RotateCcw, ArrowLeftRight, Settings, Users, Undo2, Maximize2, History, Mic, MicOff } from 'lucide-react';
import { useTranslation } from '../contexts/LanguageContext';
import { motion } from 'framer-motion';

interface ControlsProps {
  onUndo: () => void;
  canUndo: boolean;
  onSwap: () => void;
  onSettings: () => void;
  onRoster: () => void;
  onHistory: () => void;
  onReset: () => void;
  onToggleFullscreen: () => void;
  // Voice Props
  voiceEnabled: boolean;
  isListening: boolean;
  onToggleListening: () => void;
}

const ControlButton = ({ onClick, disabled, icon: Icon, active, className, activeColor }: any) => (
    <motion.button 
        whileTap={{ scale: 0.92 }}
        whileHover={{ scale: 1.05 }}
        onClick={onClick} 
        disabled={disabled}
        className={`
            relative group 
            p-2 sm:p-3 
            rounded-xl sm:rounded-2xl 
            flex items-center justify-center 
            transition-all duration-300 flex-shrink-0
            ${disabled ? 'opacity-30 cursor-not-allowed grayscale' : 'cursor-pointer'}
            ${active 
                ? (activeColor || 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/25 scale-105 ring-2 ring-indigo-500/20') 
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10'}
            ${className}
        `}
    >
        <Icon className="w-5 h-5 sm:w-[22px] sm:h-[22px]" strokeWidth={1.5} />
    </motion.button>
);

const Divider = () => (
    <div className="w-px h-4 sm:h-6 bg-black/5 dark:bg-white/10 mx-0.5 sm:mx-2 flex-shrink-0 rounded-full"></div>
);

export const Controls: React.FC<ControlsProps> = memo(({ 
    onUndo, canUndo, onSwap, onSettings, onRoster, onHistory, onReset, onToggleFullscreen,
    voiceEnabled, isListening, onToggleListening 
}) => {
  const { t } = useTranslation();

  return (
    <div className="w-full flex justify-center px-2 sm:px-4 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-safe">
      <div className="
        relative
        w-auto max-w-full
        bg-white/80 dark:bg-[#0f172a]/80 backdrop-blur-xl 
        border border-white/20 dark:border-white/10 
        rounded-2xl sm:rounded-[2.5rem] shadow-2xl shadow-black/10 dark:shadow-black/40 
        ring-1 ring-black/5 dark:ring-white/5
        overflow-hidden
        py-1 sm:py-1.5 px-1
      ">
        {/* 
            Layout Fix: 
            - justify-start ensures content starts from left (critical for overflow scrolling).
            - md:justify-center centers content on larger screens where it fits.
            - Reduced gaps and padding allow fitting 8+ items on 360px width.
        */}
        <div className="overflow-x-auto no-scrollbar touch-pan-x flex items-center justify-start md:justify-center gap-1 sm:gap-1.5 px-1 sm:px-3 py-1 sm:py-2 mask-linear-fade-sides">
            
            {/* GROUP 1: GAMEPLAY */}
            <ControlButton onClick={onUndo} disabled={!canUndo} icon={Undo2} />
            <ControlButton onClick={onSwap} icon={ArrowLeftRight} />

            <Divider />

            {/* GROUP 2: VOICE (Compact) */}
            {voiceEnabled && (
                <>
                    <ControlButton 
                        onClick={onToggleListening} 
                        icon={isListening ? Mic : MicOff} 
                        active={isListening}
                        activeColor="bg-rose-500 text-white shadow-xl shadow-rose-500/40 animate-pulse-slow mx-0.5"
                        className={!isListening ? "text-slate-400 hover:text-rose-500 mx-0.5" : "mx-0.5"}
                    />
                    <Divider />
                </>
            )}

            {/* GROUP 3: DATA */}
            <ControlButton onClick={onRoster} icon={Users} className="text-cyan-600 dark:text-cyan-400 hover:bg-cyan-50 dark:hover:bg-cyan-500/10" />
            <ControlButton onClick={onHistory} icon={History} className="text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-500/10" />

            <Divider />

            {/* GROUP 4: SYSTEM */}
            <ControlButton onClick={onSettings} icon={Settings} />
            <ControlButton onClick={onToggleFullscreen} icon={Maximize2} />
            <ControlButton onClick={onReset} icon={RotateCcw} className="text-rose-500 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10" />

        </div>
      </div>
    </div>
  );
});
