

import React, { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { TeamColor, SkillType } from '../../types';
import { resolveTheme } from '../../utils/colors';
import { Swords, Shield, Target, AlertTriangle, CheckCircle2, Mic, AlertCircle, HelpCircle, X, Sparkles, ArrowRightLeft, Save, Ban } from 'lucide-react';
import { springSnappy } from '../../utils/animations';

interface VoiceToastProps {
  visible: boolean;
  type: 'success' | 'error' | 'info';
  mainText: string;
  subText?: string;
  teamColor?: TeamColor;
  skill?: SkillType;
  onClose: () => void;
  duration?: number;
  isFullscreen?: boolean;
  systemIcon?: 'transfer' | 'save' | 'mic' | 'alert' | 'block';
}

const skillIcons: Record<SkillType | 'generic', any> = {
    attack: Swords,
    block: Shield,
    ace: Target,
    opponent_error: AlertTriangle,
    generic: CheckCircle2
};

const skillLabels: Record<SkillType | 'generic', string> = {
    attack: 'Attack Point',
    block: 'Kill Block',
    ace: 'Service Ace',
    opponent_error: 'Opponent Error',
    generic: 'Point Added'
};

const systemIconsMap: Record<string, any> = {
    transfer: ArrowRightLeft,
    save: Save,
    mic: Mic,
    alert: AlertCircle,
    block: Ban
};

export const VoiceToast: React.FC<VoiceToastProps> = ({ 
  visible, type, mainText, subText, teamColor, skill, onClose, duration = 3000, isFullscreen, systemIcon
}) => {
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (visible) {
        // Se for erro ou IA pensando, deixa mais tempo ou infinito até mudar
        const isThinking = mainText === "Thinking...";
        if (isThinking) return; 

        const finalDuration = type === 'error' ? 4000 : duration;
        const timer = setTimeout(() => {
            onCloseRef.current();
        }, finalDuration);

        return () => clearTimeout(timer);
    }
  }, [visible, duration, type, mainText]);

  let theme = {
      iconBg: 'bg-slate-100 dark:bg-white/10',
      iconColor: 'text-slate-600 dark:text-slate-300',
      textColor: 'text-slate-800 dark:text-white',
      borderColor: 'border-slate-200 dark:border-white/10',
      halo: 'bg-slate-500',
      Icon: HelpCircle
  };

  if (type === 'success' && teamColor) {
      const resolved = resolveTheme(teamColor);
      theme = {
          iconBg: resolved.bg,
          iconColor: resolved.textDark,
          textColor: resolved.textDark,
          borderColor: resolved.border,
          halo: resolved.halo,
          Icon: skillIcons[skill || 'generic']
      };
  } else if (type === 'error') {
      theme = {
          iconBg: 'bg-rose-500/10',
          iconColor: 'text-rose-600 dark:text-rose-400',
          textColor: 'text-rose-700 dark:text-rose-200',
          borderColor: 'border-rose-500/20',
          halo: 'bg-rose-500',
          Icon: AlertCircle
      };
  } else if (type === 'info') {
      theme = {
          iconBg: 'bg-sky-500/10',
          iconColor: 'text-sky-600 dark:text-sky-400',
          textColor: 'text-sky-700 dark:text-sky-200',
          borderColor: 'border-sky-500/20',
          halo: 'bg-sky-500',
          Icon: Mic
      };
  }

  // Handle "Thinking" state
  if (mainText === "Thinking...") {
      theme.Icon = Sparkles;
      theme.iconBg = 'bg-violet-500/10';
      theme.iconColor = 'text-violet-500';
      theme.borderColor = 'border-violet-500/20';
      theme.textColor = 'text-violet-600 dark:text-violet-300';
  }

  // Apply System Icon Override if provided
  if (systemIcon && systemIconsMap[systemIcon]) {
      theme.Icon = systemIconsMap[systemIcon];
      // Optional: Tweaks for specific system actions
      if (systemIcon === 'transfer') {
          theme.iconBg = 'bg-amber-500/10';
          theme.iconColor = 'text-amber-500';
          theme.borderColor = 'border-amber-500/20';
          theme.textColor = 'text-amber-700 dark:text-amber-300';
      }
      if (systemIcon === 'save') {
          theme.iconBg = 'bg-emerald-500/10';
          theme.iconColor = 'text-emerald-500';
          theme.borderColor = 'border-emerald-500/20';
          theme.textColor = 'text-emerald-700 dark:text-emerald-300';
      }
      if (systemIcon === 'block') {
          theme.iconBg = 'bg-rose-500/10';
          theme.iconColor = 'text-rose-500';
          theme.borderColor = 'border-rose-500/20';
          theme.textColor = 'text-rose-700 dark:text-rose-300';
      }
  }

  let topLabel = '';
  let bottomLabel = mainText;

  if (type === 'success') {
      topLabel = subText || skillLabels[skill || 'generic'];
  } else if (type === 'error') {
      topLabel = subText || 'Error';
      bottomLabel = mainText ? mainText : "Something went wrong";
  } else {
      topLabel = subText || 'Info';
      bottomLabel = mainText;
  }

  const positionClass = isFullscreen ? 'top-28' : 'top-6';

  const containerClass = `
      pointer-events-auto
      flex items-center gap-3 pl-2 pr-4 py-1.5
      rounded-full
      bg-white/95 dark:bg-[#020617]/95 backdrop-blur-md
      border border-black/5 dark:border-white/10
      shadow-lg shadow-black/10 dark:shadow-black/40
      ring-1 ring-black/5 dark:ring-white/5
      min-w-[160px] max-w-sm
      cursor-pointer active:scale-95 transition-transform
  `;

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
            key="voice-toast"
            initial={{ opacity: 0, y: -20, x: "-50%", scale: 0.9, filter: 'blur(8px)' }}
            animate={{ opacity: 1, y: 0, x: "-50%", scale: 1, filter: 'blur(0px)' }}
            exit={{ opacity: 0, y: -10, x: "-50%", scale: 0.95, filter: 'blur(4px)', transition: { duration: 0.2 } }}
            transition={springSnappy}
            className={`fixed left-1/2 z-[100] flex justify-center ${positionClass}`}
            onClick={onClose}
        >
            <div className={containerClass}>
                
                <div className={`
                    relative w-8 h-8 rounded-full flex items-center justify-center shrink-0
                    ${theme.iconBg} ${theme.borderColor} border
                `}>
                    <theme.Icon size={16} className={theme.iconColor} strokeWidth={2.5} />
                    {type === 'success' && (
                        <motion.div 
                           className={`absolute inset-0 rounded-full ${theme.iconBg}`}
                           animate={{ scale: [1, 1.4], opacity: [0.5, 0] }}
                           transition={{ duration: 1.5, repeat: Infinity }}
                        />
                    )}
                    {mainText === "Thinking..." && (
                        <motion.div 
                           className={`absolute inset-0 rounded-full border-2 border-violet-500 border-t-transparent`}
                           animate={{ rotate: 360 }}
                           transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                        />
                    )}
                </div>

                <div className="flex flex-col justify-center mr-2 max-w-[200px]">
                    <span className="text-[9px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 leading-none mb-0.5 truncate">
                        {topLabel}
                    </span>
                    <span className={`text-xs font-black leading-none tracking-tight ${theme.textColor} truncate`}>
                        {bottomLabel}
                    </span>
                </div>

                {type === 'success' ? (
                     <div className="shrink-0 pl-2 border-l border-black/5 dark:border-white/5 opacity-50">
                        <span className={`text-[10px] font-black ${theme.iconColor}`}>+1</span>
                     </div>
                ) : (
                    <div className="shrink-0 pl-2 border-l border-black/5 dark:border-white/5 opacity-30 hover:opacity-100 transition-opacity">
                        <X size={12} className="text-slate-400" />
                    </div>
                )}

            </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};