import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Download, X, Smartphone } from 'lucide-react';
import { useTranslation } from '../../contexts/LanguageContext';

interface InstallReminderProps {
  isVisible: boolean;
  onInstall: () => void;
  onDismiss: () => void;
  canInstall: boolean;
  isIOS: boolean;
}

export const InstallReminder: React.FC<InstallReminderProps> = ({ 
  isVisible, onInstall, onDismiss, canInstall, isIOS 
}) => {
  const { t } = useTranslation();

  // On iOS, we don't show the reminder if we can't programmatically install, 
  // unless we want to show instructions again (which might be annoying as a toast).
  // Strategy: Only show if `canInstall` (Android/Desktop) OR show a generic "Add to Home" message for iOS.
  
  if (!isVisible) return null;
  // If we can't install and it's not iOS (e.g. standard desktop browser without support), hide.
  if (!canInstall && !isIOS) return null;

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 50, scale: 0.95 }}
            className="fixed bottom-20 left-4 right-4 md:left-auto md:right-6 md:w-96 z-[90] flex items-center justify-between p-4 bg-slate-900/95 dark:bg-white/10 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-2xl shadow-black/50"
        >
            <div className="flex items-center gap-3">
                <div className="p-2.5 bg-indigo-500 rounded-xl text-white shadow-lg shadow-indigo-500/20">
                    <Smartphone size={20} />
                </div>
                <div className="flex flex-col">
                    <span className="text-sm font-bold text-white leading-tight">
                        {isIOS ? t('install.title') : t('tutorial.install.title')}
                    </span>
                    <span className="text-[10px] text-slate-400 font-medium">
                        {isIOS ? t('tutorial.install.descIOSShort') : t('tutorial.install.descAndroidShort')}
                    </span>
                </div>
            </div>

            <div className="flex items-center gap-2">
                {!isIOS && canInstall && (
                    <button 
                        onClick={onInstall}
                        className="px-3 py-2 bg-white text-slate-900 rounded-lg text-xs font-bold uppercase tracking-wider hover:bg-slate-200 transition-colors"
                    >
                        {t('common.add')}
                    </button>
                )}
                <button 
                    onClick={onDismiss}
                    className="p-2 text-slate-400 hover:text-white transition-colors"
                >
                    <X size={18} />
                </button>
            </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};