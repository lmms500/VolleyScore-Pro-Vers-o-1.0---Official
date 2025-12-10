
import React, { useState } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { useTranslation } from '../../contexts/LanguageContext';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Trophy, Hand, RefreshCw, Share, Download, 
  ChevronRight, Check, PlusSquare, Smartphone 
} from 'lucide-react';
import { usePlatform } from '../../hooks/usePlatform';

interface TutorialModalProps {
  isOpen: boolean;
  onClose: () => void;
  onInstall: () => void;
  canInstall: boolean;
  isIOS: boolean;
  isStandalone: boolean;
}

const Slide = ({ title, desc, icon: Icon, color, children }: any) => (
  <div className="flex flex-col items-center text-center space-y-6 py-4">
    <div className={`p-6 rounded-3xl ${color} bg-opacity-10 border border-current border-opacity-20 shadow-[0_0_30px_-10px_currentColor]`}>
      <Icon size={48} className={color.replace('bg-', 'text-')} strokeWidth={1.5} />
    </div>
    <div className="space-y-2 max-w-xs">
      <h3 className="text-xl font-black uppercase tracking-tight text-slate-900 dark:text-white">{title}</h3>
      <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed font-medium">{desc}</p>
    </div>
    {children}
  </div>
);

export const TutorialModal: React.FC<TutorialModalProps> = ({ 
  isOpen, onClose, onInstall, canInstall, isIOS, isStandalone 
}) => {
  const { t } = useTranslation();
  const [step, setStep] = useState(0);
  const { isNative } = usePlatform();

  const slides = [
    // 1. Welcome
    {
      id: 'welcome',
      component: (
        <Slide 
          title={t('tutorial.welcome.title')} 
          desc={t('tutorial.welcome.desc')} 
          icon={Trophy} 
          color="bg-indigo-500" 
        />
      )
    },
    // 2. Gestures
    {
      id: 'gestures',
      component: (
        <Slide 
          title={t('tutorial.gestures.title')} 
          desc={t('tutorial.gestures.desc')} 
          icon={Hand} 
          color="bg-rose-500"
        >
           <div className="flex gap-4 mt-2">
              <div className="flex flex-col items-center gap-1">
                 <div className="w-12 h-16 rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-600 flex items-center justify-center relative">
                    <div className="absolute w-4 h-4 rounded-full bg-slate-400/50 animate-ping" />
                    <div className="w-4 h-4 rounded-full bg-slate-400" />
                 </div>
                 <span className="text-[10px] font-bold uppercase tracking-wider opacity-60">Tap</span>
              </div>
              <div className="flex flex-col items-center gap-1">
                 <div className="w-12 h-16 rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-600 flex items-center justify-center relative overflow-hidden">
                    <div className="w-4 h-4 rounded-full bg-slate-400 absolute top-2 animate-[bounce_1s_infinite]" />
                 </div>
                 <span className="text-[10px] font-bold uppercase tracking-wider opacity-60">Swipe</span>
              </div>
           </div>
        </Slide>
      )
    },
    // 3. Features
    {
      id: 'features',
      component: (
        <Slide 
          title={t('tutorial.features.title')} 
          desc={t('tutorial.features.desc')} 
          icon={RefreshCw} 
          color="bg-emerald-500"
        />
      )
    },
    // 4. Install (ONLY IF NOT NATIVE)
    ...(!isNative ? [{
      id: 'install',
      component: (
        <Slide 
          title={t('tutorial.install.title')} 
          desc={isStandalone ? t('tutorial.install.installed') : (isIOS ? t('tutorial.install.descIOS') : t('tutorial.install.descAndroid'))} 
          icon={isStandalone ? Check : Download} 
          color="bg-sky-500"
        >
           {!isStandalone && isIOS && (
              <div className="bg-slate-100 dark:bg-white/5 p-4 rounded-xl border border-black/5 dark:border-white/5 text-left w-full max-w-xs space-y-3">
                  <div className="flex items-center gap-3 text-sm text-slate-700 dark:text-slate-200">
                      <span className="flex items-center justify-center w-6 h-6 rounded bg-sky-500 text-white font-bold text-xs">1</span>
                      <span>{t('install.ios.tap')} <Share size={14} className="inline mx-1 text-sky-500" /></span>
                  </div>
                  <div className="flex items-center gap-3 text-sm text-slate-700 dark:text-slate-200">
                      <span className="flex items-center justify-center w-6 h-6 rounded bg-sky-500 text-white font-bold text-xs">2</span>
                      <span>{t('install.ios.then')} <span className="font-bold">{t('install.ios.addToHome')}</span></span>
                  </div>
                  <div className="flex items-center gap-3 text-sm text-slate-700 dark:text-slate-200">
                      <span className="flex items-center justify-center w-6 h-6 rounded bg-sky-500 text-white font-bold text-xs">3</span>
                      <span>{t('common.done')} <PlusSquare size={14} className="inline mx-1" /></span>
                  </div>
              </div>
           )}
        </Slide>
      )
    }] : [])
  ];

  const handleNext = () => {
    if (step < slides.length - 1) {
      setStep(step + 1);
    } else {
      onClose();
    }
  };

  // Only show install button logic if we have the install slide (which depends on isNative)
  const isInstallStep = slides[step]?.id === 'install';

  return (
    <Modal 
      isOpen={isOpen} 
      onClose={onClose} 
      title={t('tutorial.header')}
      showCloseButton={false}
      persistent={true}
    >
      <div className="min-h-[350px] flex flex-col justify-between">
        
        {/* Slide Content */}
        <div className="flex-1 flex items-center justify-center">
            <AnimatePresence mode="wait">
                <motion.div
                    key={step}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.2 }}
                    className="w-full"
                >
                    {slides[step].component}
                </motion.div>
            </AnimatePresence>
        </div>

        {/* Footer Actions */}
        <div className="pt-6 border-t border-black/5 dark:border-white/5 flex flex-col gap-3">
             
             {/* Dynamic Primary Action for Install Step */}
             {isInstallStep && !isStandalone && canInstall && !isNative && (
                 <Button onClick={onInstall} size="lg" className="w-full bg-sky-500 hover:bg-sky-400 shadow-sky-500/20">
                     <Download size={18} /> {t('install.installNow')}
                 </Button>
             )}

             <div className="flex items-center justify-between">
                {/* Dots Indicator */}
                <div className="flex gap-1.5">
                    {slides.map((_, idx) => (
                        <div 
                            key={idx} 
                            className={`h-1.5 rounded-full transition-all duration-300 ${idx === step ? 'w-6 bg-indigo-500' : 'w-1.5 bg-slate-300 dark:bg-slate-700'}`} 
                        />
                    ))}
                </div>

                {/* Nav Buttons */}
                <div className="flex gap-3">
                    {step < slides.length - 1 ? (
                        <Button onClick={handleNext} variant="primary" size="md" className="px-6">
                            {t('tutorial.next')} <ChevronRight size={16} />
                        </Button>
                    ) : (
                        <Button onClick={onClose} variant={canInstall && !isStandalone && !isNative ? "ghost" : "primary"} size="md" className="px-6">
                            {t('common.done')} <Check size={16} />
                        </Button>
                    )}
                </div>
             </div>
        </div>

      </div>
    </Modal>
  );
};
