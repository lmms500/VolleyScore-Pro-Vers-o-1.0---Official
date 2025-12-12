
import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Download, X, Smartphone } from 'lucide-react';
import { useTranslation } from '../../contexts/LanguageContext';
import { Capacitor } from '@capacitor/core';

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
  const isNative = Capacitor.isNativePlatform();

  // 🛡️ CRITICAL: Absolute Kill Switch for Native Apps
  // Prevents "Add to Home Screen" banner from appearing inside the App Store version
  if (isNative) return null;

  // Logic: Only show if visible AND (Android Installable OR iOS Instructions needed)
  if (!isVisible) return null;
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
