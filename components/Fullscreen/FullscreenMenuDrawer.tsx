
import React from 'react';
import { X, Users, Settings, LogOut, Sun, Moon, History, ChevronRight } from 'lucide-react';
import { useTranslation } from '../../contexts/LanguageContext';
import { useTheme } from '../../contexts/ThemeContext';
import { motion, AnimatePresence } from 'framer-motion';

interface FullscreenMenuDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenSettings: () => void;
  onOpenRoster: () => void;
  onOpenHistory: () => void;
  onExitFullscreen: () => void;
}

const MenuButton = ({ 
  icon: Icon, 
  label, 
  subLabel, 
  onClick, 
  themeColor,
  delay = 0
}: { 
  icon: any, 
  label: string, 
  subLabel: string, 
  onClick: () => void,
  themeColor: 'indigo' | 'cyan' | 'amber',
  delay?: number
}) => {
  
  const colors = {
    indigo: {
      bg: 'bg-indigo-500/10',
      text: 'text-indigo-600 dark:text-indigo-400',
      border: 'hover:border-indigo-500/30',
      iconBg: 'bg-indigo-500 text-white shadow-indigo-500/20'
    },
    cyan: {
      bg: 'bg-cyan-500/10',
      text: 'text-cyan-600 dark:text-cyan-400',
      border: 'hover:border-cyan-500/30',
      iconBg: 'bg-cyan-500 text-white shadow-cyan-500/20'
    },
    amber: {
      bg: 'bg-amber-500/10',
      text: 'text-amber-600 dark:text-amber-400',
      border: 'hover:border-amber-500/30',
      iconBg: 'bg-amber-500 text-white shadow-amber-500/20'
    }
  };

  const theme = colors[themeColor];

  return (
    <motion.button 
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: delay * 0.05, type: "spring", stiffness: 300, damping: 25 }}
      onClick={onClick} 
      className={`
        group w-full flex items-center gap-5 p-5 rounded-[1.5rem] relative overflow-hidden
        bg-white/60 dark:bg-white/[0.03]
        border border-white/40 dark:border-white/5
        ${theme.border}
        backdrop-blur-xl shadow-sm hover:shadow-lg
        active:scale-[0.98]
        transition-all duration-300
        text-left
      `}
    >
      <div className={`
          relative z-10 w-14 h-14 flex items-center justify-center rounded-2xl 
          ${theme.iconBg}
          shadow-lg transition-transform duration-500 group-hover:scale-110 group-hover:rotate-3
      `}>
          <Icon size={26} strokeWidth={2} />
      </div>

      <div className="flex-1 relative z-10 min-w-0">
          <span className="block text-base font-black text-slate-800 dark:text-slate-100 uppercase tracking-wide mb-1 group-hover:text-slate-900 dark:group-hover:text-white transition-colors truncate">
            {label}
          </span>
          <span className={`block text-[10px] font-bold uppercase tracking-wider ${theme.text} transition-colors truncate opacity-80 group-hover:opacity-100`}>
            {subLabel}
          </span>
      </div>

      <div className="relative z-10 text-slate-300 dark:text-slate-600 group-hover:text-slate-400 dark:group-hover:text-slate-400 transition-colors duration-300 group-hover:translate-x-1">
          <ChevronRight size={20} />
      </div>
    </motion.button>
  );
};

export const FullscreenMenuDrawer: React.FC<FullscreenMenuDrawerProps> = ({
  isOpen, onClose, onOpenSettings, onOpenRoster, onOpenHistory, onExitFullscreen
}) => {
  const { t } = useTranslation();
  const { theme, setTheme } = useTheme();

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-xl z-[60]" 
            onClick={onClose}
          />

          <motion.div 
            initial={{ x: "100%" }}
            animate={{ x: "0%" }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 300, damping: 30, mass: 1 }}
            className={`
              fixed top-0 right-0 h-full z-[70]
              w-full sm:w-[24rem] landscape:w-[32rem] max-w-[100vw]
              bg-slate-50/95 dark:bg-[#020617]/95
              backdrop-blur-3xl 
              border-l border-white/20 dark:border-white/10 
              shadow-2xl shadow-black/50
              flex flex-col
            `}
          >
            <div className="px-8 pt-safe-top pb-6 flex justify-between items-center bg-transparent shrink-0 mt-6">
              <h2 className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.25em] flex items-center gap-3">
                <div className="w-1.5 h-5 bg-indigo-500 rounded-full shadow-[0_0_10px_currentColor]" />
                {t('game.menu')}
              </h2>
              <button 
                onClick={onClose} 
                className="p-3 rounded-full bg-white/50 dark:bg-white/5 hover:bg-white dark:hover:bg-white/10 text-slate-400 hover:text-slate-800 dark:hover:text-white transition-all active:scale-95 border border-transparent hover:border-slate-200 dark:hover:border-white/10"
              >
                <X size={22} strokeWidth={2.5} />
              </button>
            </div>

            <div className="flex-1 px-6 py-2 overflow-y-auto custom-scrollbar space-y-4 landscape:space-y-0 landscape:grid landscape:grid-cols-2 landscape:gap-4">
              
              <MenuButton 
                onClick={() => { onClose(); onOpenRoster(); }}
                icon={Users}
                label={t('controls.teams')}
                subLabel={t('teamManager.title')}
                themeColor="cyan"
                delay={1}
              />

              <MenuButton 
                onClick={() => { onClose(); onOpenHistory(); }}
                icon={History}
                label={t('controls.history')}
                subLabel={t('historyList.title')}
                themeColor="amber"
                delay={2}
              />

              <div className="landscape:col-span-2">
                <MenuButton 
                    onClick={() => { onClose(); onOpenSettings(); }}
                    icon={Settings}
                    label={t('controls.settings')}
                    subLabel={t('settings.title')}
                    themeColor="indigo"
                    delay={3}
                />
              </div>

            </div>

            <div className="p-8 landscape:p-6 space-y-6 landscape:space-y-4 shrink-0 bg-gradient-to-t from-white/50 via-white/20 to-transparent dark:from-black/40 dark:via-black/10 pb-safe-bottom">
                 
                 <div className="h-px bg-black/5 dark:bg-white/5 w-full" />

                 <div className="flex flex-col gap-3">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Appearance</span>
                    <div className="flex bg-white/50 dark:bg-white/5 p-1.5 rounded-3xl border border-black/5 dark:border-white/5">
                        <button 
                            onClick={() => setTheme('light')}
                            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl text-xs font-bold uppercase tracking-wider transition-all ${theme === 'light' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300'}`}
                        >
                            <Sun size={16} strokeWidth={2.5} /> Light
                        </button>
                        <button 
                            onClick={() => setTheme('dark')}
                            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl text-xs font-bold uppercase tracking-wider transition-all ${theme === 'dark' ? 'bg-slate-700 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300'}`}
                        >
                            <Moon size={16} strokeWidth={2.5} /> Dark
                        </button>
                    </div>
                 </div>

                 <button 
                    onClick={() => { onClose(); onExitFullscreen(); }} 
                    className="
                      w-full flex items-center justify-center gap-3 p-5 rounded-[1.5rem] 
                      bg-rose-500/10 hover:bg-rose-500/20
                      text-rose-600 dark:text-rose-400 
                      border border-rose-500/20
                      transition-all font-bold uppercase tracking-widest text-xs shadow-sm active:scale-[0.98]
                    "
                 >
                    <LogOut size={18} strokeWidth={2.5} />
                    {t('controls.exitFullscreen')}
                 </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
