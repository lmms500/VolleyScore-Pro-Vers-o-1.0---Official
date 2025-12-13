
import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { TeamColor, SkillType } from '../../types';
import { resolveTheme } from '../../utils/colors';
import { 
  Swords, Shield, Target, AlertTriangle, CheckCircle2, Mic, 
  AlertCircle, HelpCircle, X, Sparkles, ArrowRightLeft, Save, 
  Ban, RotateCcw, Trash2, UserPlus, Users, PartyPopper
} from 'lucide-react';
import { softBounce } from '../../utils/animations';

interface NotificationToastProps {
  visible: boolean;
  type: 'success' | 'error' | 'info';
  mainText: string;
  subText?: string;
  teamColor?: TeamColor;
  skill?: SkillType;
  onClose: () => void;
  duration?: number;
  isFullscreen?: boolean;
  systemIcon?: 'transfer' | 'save' | 'mic' | 'alert' | 'block' | 'undo' | 'delete' | 'add' | 'roster' | 'party';
  onUndo?: () => void;
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
    block: Ban,
    undo: RotateCcw,
    delete: Trash2,
    add: UserPlus,
    roster: Users,
    party: PartyPopper
};

export const NotificationToast: React.FC<NotificationToastProps> = ({ 
  visible, type, mainText, subText, teamColor, skill, onClose, duration = 3000, isFullscreen, systemIcon, onUndo
}) => {
  const onCloseRef = useRef(onClose);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (visible) {
        // Keep "Thinking" state visible until manually cleared or updated
        const isThinking = mainText === "Thinking...";
        if (isThinking) return; 

        // Error toasts persist longer to be read
        const finalDuration = (type === 'error' || onUndo) ? 4000 : duration;
        const timer = setTimeout(() => {
            onCloseRef.current();
        }, finalDuration);

        return () => clearTimeout(timer);
    }
  }, [visible, duration, type, mainText, onUndo]);

  if (!mounted) return null;

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
          Icon: CheckCircle2
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
      
      // Contextual styling for system icons
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
      if (systemIcon === 'block' || systemIcon === 'delete') {
          theme.iconBg = 'bg-rose-500/10';
          theme.iconColor = 'text-rose-500';
          theme.borderColor = 'border-rose-500/20';
          theme.textColor = 'text-rose-700 dark:text-rose-300';
      }
      if (systemIcon === 'mic') {
          theme.iconBg = 'bg-sky-500/10';
          theme.iconColor = 'text-sky-500';
          theme.borderColor = 'border-sky-500/20';
      }
      if (systemIcon === 'undo') {
          theme.iconBg = 'bg-slate-500/10';
          theme.iconColor = 'text-slate-500 dark:text-slate-400';
          theme.borderColor = 'border-slate-500/20';
      }
      if (systemIcon === 'party') {
          theme.iconBg = 'bg-fuchsia-500/10';
          theme.iconColor = 'text-fuchsia-500';
          theme.borderColor = 'border-fuchsia-500/20';
          theme.textColor = 'text-fuchsia-700 dark:text-fuchsia-300';
      }
  }

  let topLabel = '';
  let bottomLabel = mainText;

  if (type === 'success' && !systemIcon) {
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
      flex items-center gap-3 pl-2 pr-4 py-2
      rounded-2xl
      bg-white/95 dark:bg-[#020617]/95 backdrop-blur-md
      border border-black/5 dark:border-white/10
      shadow-2xl shadow-black/30 dark:shadow-black/60
      ring-1 ring-black/5 dark:ring-white/5
      min-w-[160px] w-auto max-w-sm h-auto
      cursor-pointer active:scale-95 transition-transform
  `;

  // Wrapper div ensures this element sits on top of EVERYTHING in the portal
  return createPortal(
    <div className="fixed inset-0 pointer-events-none z-[10000] flex justify-center overflow-visible">
        <AnimatePresence>
        {visible && (
            <motion.div
                key="notification-toast"
                initial={{ opacity: 0, y: -20, scale: 0.9, filter: 'blur(8px)' }}
                animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
                exit={{ opacity: 0, y: -10, scale: 0.95, filter: 'blur(4px)', transition: { duration: 0.2 } }}
                transition={softBounce}
                className={`absolute ${positionClass}`}
                onClick={onClose}
            >
                <div className={containerClass}>
                    
                    <div className={`
                        relative w-8 h-8 rounded-full flex items-center justify-center shrink-0
                        ${theme.iconBg} ${theme.borderColor} border
                    `}>
                        <theme.Icon size={16} className={theme.iconColor} strokeWidth={2.5} />
                        {type === 'success' && !systemIcon && (
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

                    <div className="flex flex-col justify-center mr-2 flex-1 min-w-0">
                        <span className="text-[9px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 leading-none mb-0.5 whitespace-normal">
                            {topLabel}
                        </span>
                        <span className={`text-xs font-black leading-tight tracking-tight ${theme.textColor} whitespace-normal break-words`}>
                            {bottomLabel}
                        </span>
                    </div>

                    {onUndo ? (
                        <button 
                            onClick={(e) => { e.stopPropagation(); onUndo(); onClose(); }}
                            className="shrink-0 pl-3 border-l border-black/10 dark:border-white/10 flex flex-col items-center justify-center hover:opacity-70 active:scale-95 transition-all"
                        >
                            <RotateCcw size={14} className="text-indigo-500 dark:text-indigo-400 mb-0.5" />
                            <span className="text-[9px] font-black uppercase tracking-wider text-indigo-500 dark:text-indigo-400">UNDO</span>
                        </button>
                    ) : (
                        type === 'success' ? (
                            <div className="shrink-0 pl-2 border-l border-black/5 dark:border-white/5 opacity-50">
                                <span className={`text-[10px] font-black ${theme.iconColor}`}>+1</span>
                            </div>
                        ) : (
                            <div className="shrink-0 pl-2 border-l border-black/5 dark:border-white/5 opacity-30 hover:opacity-100 transition-opacity">
                                <X size={12} className="text-slate-400" />
                            </div>
                        )
                    )}

                </div>
            </motion.div>
        )}
        </AnimatePresence>
    </div>,
    document.body
  );
};
