
import React, { useState, useEffect, useRef } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { GameConfig } from '../../types';
import { Check, Trophy, Sun, Zap, Moon, AlertTriangle, Volume2, Umbrella, Activity, Globe, Scale, ToggleLeft, ToggleRight, RefreshCw, CloudDownload, Smartphone, ArrowRight, Mic, Battery, Megaphone, User, User2, Bell, BellRing, AlignJustify, HelpCircle, LogOut, LogIn, Key, Eye, EyeOff, Layers, Cpu, Server, Target, ZapOff, UploadCloud, DownloadCloud, Loader2, Power, Share2, FileDown, Play, Gauge, AudioWaveform } from 'lucide-react';
import { useTranslation } from '../../contexts/LanguageContext';
import { useTheme } from '../../contexts/ThemeContext';
import { useServiceWorker } from '../../hooks/useServiceWorker';
import { usePlatform } from '../../hooks/usePlatform';
import { useAuth } from '../../contexts/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import { VoiceCommandsModal } from './VoiceCommandsModal';
import { BackupService } from '../../services/BackupService';
import { parseJSONFile, exportActiveMatch } from '../../services/io';
import { useGame } from '../../contexts/GameContext';
import { useTutorial } from '../../hooks/useTutorial';
import { ttsService } from '../../services/TTSService';

const APP_VERSION = '2.0.6';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: GameConfig;
  onSave: (config: GameConfig, reset: boolean) => void;
  isMatchActive: boolean;
  onInstall?: () => void;
  canInstall?: boolean;
  isIOS?: boolean;
  isStandalone?: boolean;
}

type SettingsTab = 'match' | 'app' | 'system';

export const SettingsModal: React.FC<SettingsModalProps> = ({ 
    isOpen, onClose, config, onSave, isMatchActive
}) => {
  const [localConfig, setLocalConfig] = useState<GameConfig>(config);
  const [activeTab, setActiveTab] = useState<SettingsTab>('match');
  const [showVoiceHelp, setShowVoiceHelp] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [backupStatus, setBackupStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [restoreStatus, setRestoreStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [statusMsg, setStatusMsg] = useState('');
  const [pendingRestart, setPendingRestart] = useState(false);
  const [isTestingVoice, setIsTestingVoice] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const gameImportRef = useRef<HTMLInputElement>(null); 

  const { t, language, setLanguage } = useTranslation();
  const { theme, setTheme } = useTheme();
  const { state, loadStateFromFile } = useGame();
  
  const { user, signInWithGoogle, logout } = useAuth();
  const { isNative } = usePlatform();

  const { 
      needRefresh, updateServiceWorker, checkForUpdates: checkSW, isChecking: isSWChecking,
      isInstallable, promptInstall, isStandalone
  } = useServiceWorker();

  const { resetTutorials } = useTutorial(false);

  const [remoteCheckStatus, setRemoteCheckStatus] = useState<'idle' | 'checking' | 'latest' | 'available' | 'error'>('idle');
  const [remoteVersion, setRemoteVersion] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setLocalConfig(config);
      if (!needRefresh) {
          setRemoteCheckStatus('idle');
      }
      setPendingRestart(false);
      setRestoreStatus('idle');
      setStatusMsg('');
    }
  }, [isOpen, config, needRefresh]);

  const handleSmartCheck = async () => {
      if (isNative) return; 
      setRemoteCheckStatus('checking');
      checkSW();
      try {
          const response = await fetch(`/package.json?t=${Date.now()}`);
          if (response.ok) {
              const remotePkg = await response.json();
              setRemoteVersion(remotePkg.version);
              await new Promise(r => setTimeout(r, 800));
              if (remotePkg.version !== APP_VERSION) {
                  setRemoteCheckStatus('available');
              } else {
                  setRemoteCheckStatus('latest');
              }
          } else {
              setRemoteCheckStatus('error');
          }
      } catch (e) {
          console.error("Remote version check failed", e);
          setRemoteCheckStatus('error');
      }
  };

  const isActuallyChecking = isSWChecking || remoteCheckStatus === 'checking';
  const showUpdateAvailable = needRefresh || remoteCheckStatus === 'available';

  const handleGenerateBackup = async () => {
      setBackupStatus('loading');
      try {
          await BackupService.generateBackup();
          setBackupStatus('success');
          setStatusMsg('Backup downloaded!');
          setTimeout(() => {
              if (!pendingRestart) setStatusMsg('');
              setBackupStatus('idle');
          }, 3000);
      } catch (e) {
          setBackupStatus('error');
          setStatusMsg('Failed to create backup.');
      }
  };

  const handleRestoreClick = () => {
      if (fileInputRef.current) {
          fileInputRef.current.value = ''; 
          fileInputRef.current.click();
      }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      setRestoreStatus('loading');
      setStatusMsg('Parsing file...');
      try {
          const json = await parseJSONFile(file);
          const success = await BackupService.restoreBackup(json);
          if (success) {
              setRestoreStatus('success');
              setStatusMsg('Data restored successfully!');
              setPendingRestart(true);
          } else {
              setRestoreStatus('error');
              setStatusMsg('Invalid backup file.');
          }
      } catch (e) {
          setRestoreStatus('error');
          setStatusMsg('Error parsing file.');
      }
      e.target.value = ''; 
  };

  const handleExportGame = async () => {
      try {
          await exportActiveMatch(state);
      } catch (e) {
          console.error("Export game failed", e);
      }
  };

  const handleImportGameClick = () => {
      if (gameImportRef.current) {
          gameImportRef.current.value = '';
          gameImportRef.current.click();
      }
  };

  const handleGameImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      try {
          const json = await parseJSONFile(file);
          if (json.type === 'VS_ACTIVE_MATCH' && json.data) {
              loadStateFromFile(json.data);
              onClose(); 
          } else {
              setStatusMsg('Invalid Game File format.');
          }
      } catch (e) {
          setStatusMsg('Failed to load game file.');
      }
  };

  const handleRestart = () => window.location.reload();

  const handleResetTutorials = () => {
      resetTutorials();
      setStatusMsg('Tutorials Reset!');
      setTimeout(() => setStatusMsg(''), 2000);
  };

  const handleTestVoice = async () => {
      if (isTestingVoice) return;
      setIsTestingVoice(true);
      const langMap: Record<string, string> = { 'pt': 'pt-BR', 'en': 'en-US', 'es': 'es-ES' };
      const targetLang = langMap[language] || 'en-US';
      const phrases = {
          en: "VolleyScore Pro. 1 serving 0.",
          pt: "VolleyScore Pro. 1 servindo 0.",
          es: "VolleyScore Pro. 1 sacando 0."
      };
      const text = phrases[language as keyof typeof phrases] || phrases.en;
      await ttsService.speak(text, targetLang, localConfig.voiceGender || 'female', localConfig.voiceRate || 1.0, localConfig.voicePitch || 1.0);
      setTimeout(() => setIsTestingVoice(false), 2000);
  };

  const structuralKeys: (keyof GameConfig)[] = ['maxSets', 'pointsPerSet', 'hasTieBreak', 'tieBreakPoints', 'deuceType', 'mode'];
  const requiresReset = isMatchActive && structuralKeys.some(key => localConfig[key] !== config[key]);

  const handleSave = () => {
    if (pendingRestart) {
        handleRestart();
        return;
    }
    onSave(localConfig, requiresReset);
    onClose();
  };

  const setPresetFIVB = () => setLocalConfig(prev => ({ ...prev, mode: 'indoor', maxSets: 5, pointsPerSet: 25, hasTieBreak: true, tieBreakPoints: 15, deuceType: 'standard' }));
  const setPresetBeach = () => setLocalConfig(prev => ({ ...prev, mode: 'beach', maxSets: 3, pointsPerSet: 21, hasTieBreak: true, tieBreakPoints: 15, deuceType: 'standard' }));
  const setPresetSegunda = () => setLocalConfig(prev => ({ ...prev, mode: 'indoor', maxSets: 1, pointsPerSet: 15, hasTieBreak: false, tieBreakPoints: 15, deuceType: 'sudden_death_3pt' }));

  const isFIVB = localConfig.mode === 'indoor' && localConfig.maxSets === 5 && localConfig.pointsPerSet === 25;
  const isBeach = localConfig.mode === 'beach' && localConfig.maxSets === 3 && localConfig.pointsPerSet === 21;
  const isSegunda = localConfig.deuceType === 'sudden_death_3pt';

  const SectionTitle = ({ children, icon: Icon }: { children?: React.ReactNode, icon?: any }) => (
      <div className="flex items-center gap-2 px-2 mt-2 mb-3">
          {Icon && <Icon size={12} className="text-slate-400" />}
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{children}</span>
      </div>
  );

  const PresetButton = ({ active, onClick, icon: Icon, label, sub, colorClass, borderClass, bgActive, textActive }: any) => (
    <button 
        onClick={onClick} 
        className={`
            relative py-4 px-3 rounded-[1.25rem] border transition-all flex flex-col items-center gap-2 text-center group flex-1 min-w-0
            ${active 
                ? `${bgActive} ${borderClass} ${textActive} shadow-lg shadow-${colorClass}/20 ring-1 ring-${colorClass}/50 z-10` 
                : `bg-white dark:bg-white/5 border-black/5 dark:border-white/5 text-slate-500 dark:text-slate-400 hover:bg-white/80 dark:hover:bg-white/10 hover:border-black/10 dark:hover:border-white/10`}
        `}
    >
        {active && <div className={`absolute top-2 right-2 p-0.5 rounded-full ${textActive} bg-white/20`}><Check size={10} strokeWidth={3} /></div>}
        <Icon size={24} className={`mb-0.5 transition-colors ${active ? textActive : 'text-slate-400 group-hover:text-slate-600 dark:text-slate-500 dark:group-hover:text-slate-300'}`} strokeWidth={1.5} />
        <div className="flex flex-col gap-0.5 w-full">
            <span className="text-[10px] font-black uppercase tracking-tight leading-none w-full truncate">{label}</span>
            <span className={`text-[8px] font-medium opacity-70 leading-none w-full truncate`}>{sub}</span>
        </div>
    </button>
  );

  const SettingItem = ({ label, icon: Icon, color, children, sub, onClick }: any) => (
      <div 
        onClick={onClick}
        className={`
            flex items-center justify-between p-3.5 rounded-2xl 
            bg-white/60 dark:bg-white/[0.03] 
            border border-white/50 dark:border-white/5 
            shadow-sm hover:bg-white/80 dark:hover:bg-white/[0.06] hover:border-white/60 dark:hover:border-white/10
            transition-all duration-200
            ${onClick ? 'cursor-pointer active:scale-[0.99]' : ''}
        `}
      >
          <div className="flex items-center gap-3 min-w-0 flex-1 mr-4">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${color.bg} ${color.text} flex-shrink-0 ring-1 ring-black/5 dark:ring-white/5`}>
                  <Icon size={18} strokeWidth={2} />
              </div>
              <div className="flex flex-col min-w-0">
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-200 truncate leading-tight">{label}</span>
                  {sub && <span className="text-[10px] text-slate-400 font-medium leading-tight truncate mt-0.5">{sub}</span>}
              </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
              {children}
          </div>
      </div>
  );

  return (
    <>
    <VoiceCommandsModal isOpen={showVoiceHelp} onClose={() => setShowVoiceHelp(false)} />
    <input type="file" ref={fileInputRef} className="hidden" accept=".json" onChange={handleFileChange} />
    <input type="file" ref={gameImportRef} className="hidden" accept=".vsg,.json" onChange={handleGameImport} />
    
    <Modal isOpen={isOpen} onClose={onClose} title={t('settings.title')} maxWidth="max-w-md landscape:max-w-4xl" zIndex="z-[60]">
      <div className="flex flex-col landscape:flex-row h-[75vh] landscape:h-[70vh]">
        
        {/* --- TABS SIDEBAR (Landscape) / TOPBAR (Portrait) --- */}
        <div className="flex landscape:flex-col p-1 bg-slate-100 dark:bg-black/20 rounded-[1.2rem] mb-6 landscape:mb-0 landscape:mr-4 shrink-0 w-full landscape:w-48 border border-black/5 dark:border-white/5 landscape:h-full">
            <div className="flex landscape:flex-col w-full gap-1">
                {(['match', 'app', 'system'] as const).map(tab => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        disabled={pendingRestart && tab !== 'system'}
                        className={`
                            flex-1 min-w-0 landscape:w-full px-2 py-2.5 rounded-xl text-[10px] sm:text-xs font-black uppercase tracking-wider flex items-center justify-center landscape:justify-start gap-2 transition-all relative z-10
                            ${activeTab === tab 
                                ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-md ring-1 ring-black/5 dark:ring-white/10' 
                                : 'text-slate-400 hover:text-slate-700 dark:text-slate-500 dark:hover:text-slate-300 hover:bg-black/5 dark:hover:bg-white/5'}
                            ${pendingRestart && tab !== 'system' ? 'opacity-30 cursor-not-allowed' : ''}
                        `}
                    >
                        {tab === 'match' && <Trophy size={14} className="flex-shrink-0" strokeWidth={2.5} />}
                        {tab === 'app' && <Layers size={14} className="flex-shrink-0" strokeWidth={2.5} />}
                        {tab === 'system' && <Cpu size={14} className="flex-shrink-0" strokeWidth={2.5} />}
                        <span className="truncate">
                            {tab === 'match' && t('settings.rules.title')}
                            {tab === 'app' && t('settings.appearance.title')}
                            {tab === 'system' && t('settings.sections.sync')}
                        </span>
                    </button>
                ))}
            </div>
        </div>

        {/* --- MAIN CONTENT & FOOTER CONTAINER --- */}
        <div className="flex-1 flex flex-col min-h-0 min-w-0">
            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto custom-scrollbar px-1 pb-4">
                <AnimatePresence mode="wait">
                    
                    {/* === TAB: MATCH RULES === */}
                    {activeTab === 'match' && (
                        <motion.div 
                            key="match"
                            initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }}
                            transition={{ duration: 0.2 }}
                            className="space-y-6"
                        >
                            {/* Portability */}
                            <div>
                                <SectionTitle icon={Share2}>Game Portability</SectionTitle>
                                <div className="grid grid-cols-2 gap-3 p-1">
                                    <button onClick={handleExportGame} className="flex items-center justify-center gap-2 px-3 py-4 bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/20 rounded-2xl text-indigo-600 dark:text-indigo-300 font-bold text-xs hover:bg-indigo-100 dark:hover:bg-indigo-500/20 transition-colors shadow-sm">
                                        <Share2 size={16} /> Share Game
                                    </button>
                                    <button onClick={handleImportGameClick} className="flex items-center justify-center gap-2 px-3 py-4 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl text-slate-600 dark:text-slate-300 font-bold text-xs hover:bg-slate-50 dark:hover:bg-white/10 transition-colors shadow-sm">
                                        <FileDown size={16} /> Load File
                                    </button>
                                </div>
                            </div>

                            {/* Presets */}
                            <div>
                                <SectionTitle icon={Trophy}>{t('settings.sections.presets')}</SectionTitle>
                                <div className="flex gap-3 px-1">
                                    <PresetButton active={isFIVB} onClick={setPresetFIVB} icon={Trophy} label={t('presets.fivb.label')} sub={t('presets.fivb.sub')} colorClass="indigo-500" borderClass="border-indigo-500" bgActive="bg-indigo-500/10" textActive="text-indigo-600 dark:text-indigo-300"/>
                                    <PresetButton active={isBeach} onClick={setPresetBeach} icon={Umbrella} label={t('presets.beach.label')} sub={t('presets.beach.sub')} colorClass="orange-500" borderClass="border-orange-500" bgActive="bg-orange-500/10" textActive="text-orange-600 dark:text-orange-300"/>
                                    <PresetButton active={isSegunda} onClick={setPresetSegunda} icon={Zap} label={t('presets.custom.label')} sub={t('presets.custom.sub')} colorClass="emerald-500" borderClass="border-emerald-500" bgActive="bg-emerald-500/10" textActive="text-emerald-600 dark:text-emerald-300"/>
                                </div>
                            </div>

                            {/* Rules */}
                            <div>
                                <SectionTitle icon={Target}>{t('settings.sections.coreRules')}</SectionTitle>
                                
                                <div className="space-y-2.5">
                                    <SettingItem label={t('settings.rules.gameMode')} icon={Trophy} color={{bg:'bg-indigo-500/10', text:'text-indigo-500'}}>
                                        <div className="flex bg-slate-100 dark:bg-black/20 rounded-xl p-1 border border-black/5 dark:border-white/5">
                                            <button onClick={() => setLocalConfig(prev => ({ ...prev, mode: 'indoor' }))} className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase transition-all ${localConfig.mode === 'indoor' ? 'bg-white dark:bg-white/10 shadow-sm text-indigo-600 dark:text-indigo-400' : 'text-slate-400'}`}>{t('settings.rules.modes.indoor')}</button>
                                            <button onClick={() => setLocalConfig(prev => ({ ...prev, mode: 'beach' }))} className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase transition-all ${localConfig.mode === 'beach' ? 'bg-white dark:bg-white/10 shadow-sm text-orange-500' : 'text-slate-400'}`}>{t('settings.rules.modes.beach')}</button>
                                        </div>
                                    </SettingItem>

                                    <SettingItem label={t('settings.rules.setsToPlay')} icon={Layers} color={{bg:'bg-slate-500/10', text:'text-slate-500'}}>
                                        <div className="flex gap-1.5">
                                            {[1, 3, 5].map(val => (
                                                <button key={val} onClick={() => setLocalConfig(prev => ({ ...prev, maxSets: val as any }))}
                                                    className={`w-9 h-9 rounded-xl text-xs font-bold transition-all border flex items-center justify-center ${localConfig.maxSets === val ? 'bg-indigo-500 text-white border-indigo-600 shadow-md scale-105' : 'bg-slate-50 dark:bg-white/5 border-transparent text-slate-500 hover:bg-slate-100 dark:hover:bg-white/10'}`}>
                                                    {val}
                                                </button>
                                            ))}
                                        </div>
                                    </SettingItem>

                                    <SettingItem label={t('settings.rules.pointsPerSet')} icon={Target} color={{bg:'bg-rose-500/10', text:'text-rose-500'}}>
                                        <div className="flex gap-1.5">
                                            {[15, 21, 25].map(val => (
                                                <button key={val} onClick={() => setLocalConfig(prev => ({ ...prev, pointsPerSet: val as any }))}
                                                    className={`w-9 h-9 rounded-xl text-xs font-bold transition-all border flex items-center justify-center ${localConfig.pointsPerSet === val ? 'bg-rose-500 text-white border-rose-600 shadow-md scale-105' : 'bg-slate-50 dark:bg-white/5 border-transparent text-slate-500 hover:bg-slate-100 dark:hover:bg-white/10'}`}>
                                                    {val}
                                                </button>
                                            ))}
                                        </div>
                                    </SettingItem>
                                </div>
                            </div>

                            {/* Advanced Rules */}
                            <div>
                                <SectionTitle icon={Scale}>{t('settings.sections.tieBreakDeuce')}</SectionTitle>
                                
                                <div className="space-y-2.5">
                                    <SettingItem label={t('settings.rules.tieBreak')} icon={Scale} color={{bg:'bg-amber-500/10', text:'text-amber-500'}}>
                                        {localConfig.hasTieBreak && (
                                            <div className="flex bg-slate-100 dark:bg-black/20 rounded-xl p-1 mr-2 border border-black/5 dark:border-white/5">
                                                {[15, 25].map(val => (
                                                    <button key={val} onClick={() => setLocalConfig(prev => ({ ...prev, tieBreakPoints: val as any }))}
                                                        className={`px-3 py-1.5 rounded-lg text-[10px] font-bold ${localConfig.tieBreakPoints === val ? 'bg-white dark:bg-white/10 shadow-sm text-slate-800 dark:text-white' : 'text-slate-400'}`}>
                                                        {val}
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                        <button onClick={() => setLocalConfig(prev => ({ ...prev, hasTieBreak: !prev.hasTieBreak }))} className={`text-2xl transition-colors ${localConfig.hasTieBreak ? 'text-indigo-500' : 'text-slate-300'}`}>
                                            {localConfig.hasTieBreak ? <ToggleRight size={32} fill="currentColor" fillOpacity={0.2} /> : <ToggleLeft size={32} />}
                                        </button>
                                    </SettingItem>

                                    {/* Deuce Logic Grid */}
                                    <div className="grid grid-cols-2 gap-3 mt-1">
                                        <button onClick={() => setLocalConfig(prev => ({ ...prev, deuceType: 'standard' }))}
                                            className={`py-3 px-3 rounded-2xl border text-[10px] font-bold text-center transition-all truncate flex flex-col items-center justify-center gap-1 ${localConfig.deuceType === 'standard' ? 'bg-indigo-500/10 border-indigo-500/50 text-indigo-600 dark:text-indigo-300 ring-1 ring-indigo-500/20' : 'bg-white/40 dark:bg-white/5 border-transparent text-slate-400 hover:bg-white/60'}`}>
                                            <span className="opacity-50 text-[9px] uppercase tracking-wider">Advantage</span>
                                            {t('settings.rules.deuceStandard')}
                                        </button>
                                        <button onClick={() => setLocalConfig(prev => ({ ...prev, deuceType: 'sudden_death_3pt' }))}
                                            className={`py-3 px-3 rounded-2xl border text-[10px] font-bold text-center transition-all truncate flex flex-col items-center justify-center gap-1 ${localConfig.deuceType === 'sudden_death_3pt' ? 'bg-rose-500/10 border-rose-500/50 text-rose-600 dark:text-rose-300 ring-1 ring-rose-500/20' : 'bg-white/40 dark:bg-white/5 border-transparent text-slate-400 hover:bg-white/60'}`}>
                                            <span className="opacity-50 text-[9px] uppercase tracking-wider">Fast End</span>
                                            {t('settings.rules.deuceSuddenDeath')}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    )}

                    {/* === TAB: APP EXPERIENCE === */}
                    {activeTab === 'app' && (
                        <motion.div 
                            key="app"
                            initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }}
                            transition={{ duration: 0.2 }}
                            className="space-y-6"
                        >
                            {/* Appearance */}
                            <div>
                                <SectionTitle icon={Sun}>{t('settings.sections.visuals')}</SectionTitle>
                                
                                <div className="space-y-2.5">
                                    <SettingItem label={t('settings.appearance.theme')} icon={theme === 'light' ? Sun : Moon} color={{bg:'bg-indigo-500/10', text:'text-indigo-500'}}>
                                        <div className="flex bg-slate-100 dark:bg-black/20 rounded-xl p-1 border border-black/5 dark:border-white/5">
                                            <button onClick={() => setTheme('light')} className={`p-2 rounded-lg transition-all ${theme === 'light' ? 'bg-white shadow-sm text-amber-500' : 'text-slate-400'}`}><Sun size={18} /></button>
                                            <button onClick={() => setTheme('dark')} className={`p-2 rounded-lg transition-all ${theme === 'dark' ? 'bg-white/10 shadow-sm text-indigo-400' : 'text-slate-400'}`}><Moon size={18} /></button>
                                        </div>
                                    </SettingItem>

                                    <SettingItem label={t('settings.appearance.language')} icon={Globe} color={{bg:'bg-emerald-500/10', text:'text-emerald-500'}}>
                                        <div className="flex bg-slate-100 dark:bg-black/20 rounded-xl p-1 border border-black/5 dark:border-white/5">
                                            {(['en', 'pt', 'es'] as const).map(lang => (
                                                <button key={lang} onClick={() => setLanguage(lang)}
                                                    className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase transition-colors ${language === lang ? 'bg-white dark:bg-white/10 shadow-sm text-slate-800 dark:text-white' : 'text-slate-400'}`}>
                                                    {lang}
                                                </button>
                                            ))}
                                        </div>
                                    </SettingItem>

                                    <SettingItem label={t('settings.appearance.lowPower')} sub={t('settings.appearance.lowPowerSub')} icon={Battery} color={{bg:'bg-slate-500/10', text:'text-slate-500'}}>
                                        <button onClick={() => setLocalConfig(prev => ({...prev, lowGraphics: !prev.lowGraphics}))} className={`w-12 h-7 rounded-full p-1 transition-colors ${localConfig.lowGraphics ? 'bg-emerald-500' : 'bg-slate-200 dark:bg-white/10'}`}>
                                            <div className={`w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${localConfig.lowGraphics ? 'translate-x-5' : ''}`} />
                                        </button>
                                    </SettingItem>

                                    <SettingItem label={t('settings.appearance.reducedMotion')} sub={t('settings.appearance.reducedMotionSub')} icon={ZapOff} color={{bg:'bg-amber-500/10', text:'text-amber-500'}}>
                                        <button onClick={() => setLocalConfig(prev => ({...prev, reducedMotion: !prev.reducedMotion}))} className={`w-12 h-7 rounded-full p-1 transition-colors ${localConfig.reducedMotion ? 'bg-amber-500' : 'bg-slate-200 dark:bg-white/10'}`}>
                                            <div className={`w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${localConfig.reducedMotion ? 'translate-x-5' : ''}`} />
                                        </button>
                                    </SettingItem>
                                </div>
                            </div>

                            {/* Audio & Voice */}
                            <div>
                                <SectionTitle icon={Volume2}>{t('settings.sections.audio')}</SectionTitle>

                                <div className="space-y-2.5">
                                    <SettingItem label={t('settings.audio.soundEffects')} icon={Volume2} color={{bg:'bg-emerald-500/10', text:'text-emerald-500'}}>
                                        <button onClick={() => setLocalConfig(prev => ({...prev, enableSound: !prev.enableSound}))} className={`w-12 h-7 rounded-full p-1 transition-colors ${localConfig.enableSound ? 'bg-emerald-500' : 'bg-slate-200 dark:bg-white/10'}`}>
                                            <div className={`w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${localConfig.enableSound ? 'translate-x-5' : ''}`} />
                                        </button>
                                    </SettingItem>

                                    <SettingItem label={t('settings.audio.announcer')} sub={t('settings.audio.tts')} icon={Megaphone} color={{bg:'bg-amber-500/10', text:'text-amber-500'}}>
                                        <button onClick={() => setLocalConfig(prev => ({...prev, announceScore: !prev.announceScore}))} className={`w-12 h-7 rounded-full p-1 transition-colors ${localConfig.announceScore ? 'bg-amber-500' : 'bg-slate-200 dark:bg-white/10'}`}>
                                            <div className={`w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${localConfig.announceScore ? 'translate-x-5' : ''}`} />
                                        </button>
                                    </SettingItem>

                                    {/* ADVANCED TTS CONTROLS */}
                                    <AnimatePresence>
                                        {localConfig.announceScore && (
                                            <motion.div 
                                                initial={{ height: 0, opacity: 0 }}
                                                animate={{ height: 'auto', opacity: 1 }}
                                                exit={{ height: 0, opacity: 0 }}
                                                className="overflow-hidden pl-1"
                                            >
                                                <div className="p-3 bg-slate-100/50 dark:bg-white/[0.02] rounded-2xl border border-black/5 dark:border-white/5 space-y-3">
                                                    <div className="grid grid-cols-2 gap-2">
                                                        <div className="flex bg-white dark:bg-white/5 rounded-xl p-1 border border-black/5 dark:border-white/5">
                                                            <button onClick={() => setLocalConfig(prev => ({...prev, voiceGender: 'male'}))} className={`flex-1 py-1.5 rounded-lg text-[10px] font-bold flex items-center justify-center gap-1 transition-all ${localConfig.voiceGender === 'male' ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300 shadow-sm' : 'text-slate-400'}`}>
                                                                <User2 size={10} /> {t('settings.audio.gender.male')}
                                                            </button>
                                                            <button onClick={() => setLocalConfig(prev => ({...prev, voiceGender: 'female'}))} className={`flex-1 py-1.5 rounded-lg text-[10px] font-bold flex items-center justify-center gap-1 transition-all ${localConfig.voiceGender === 'female' ? 'bg-pink-100 text-pink-700 dark:bg-pink-500/20 dark:text-pink-300 shadow-sm' : 'text-slate-400'}`}>
                                                                <User size={10} /> {t('settings.audio.gender.female')}
                                                            </button>
                                                        </div>
                                                        <div className="flex bg-white dark:bg-white/5 rounded-xl p-1 border border-black/5 dark:border-white/5">
                                                            <button onClick={() => setLocalConfig(prev => ({...prev, announcementFreq: 'all'}))} className={`flex-1 py-1.5 rounded-lg text-[10px] font-bold flex items-center justify-center gap-1 transition-all ${localConfig.announcementFreq === 'all' ? 'bg-slate-200 text-slate-800 dark:bg-white/20 dark:text-white shadow-sm' : 'text-slate-400'}`}>
                                                                <AlignJustify size={10} /> All
                                                            </button>
                                                            <button onClick={() => setLocalConfig(prev => ({...prev, announcementFreq: 'critical_only'}))} className={`flex-1 py-1.5 rounded-lg text-[10px] font-bold flex items-center justify-center gap-1 transition-all ${localConfig.announcementFreq === 'critical_only' ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300 shadow-sm' : 'text-slate-400'}`}>
                                                                <BellRing size={10} /> Crit
                                                            </button>
                                                        </div>
                                                    </div>

                                                    <div className="flex items-center gap-3">
                                                        <Gauge size={14} className="text-slate-400" />
                                                        <div className="flex-1 relative h-6 flex items-center">
                                                            <input 
                                                                type="range" min="0.5" max="1.5" step="0.1"
                                                                value={localConfig.voiceRate || 1.0}
                                                                onChange={(e) => setLocalConfig(prev => ({...prev, voiceRate: parseFloat(e.target.value)}))}
                                                                className="w-full h-1.5 bg-slate-200 dark:bg-white/10 rounded-full appearance-none accent-indigo-500 cursor-pointer"
                                                            />
                                                        </div>
                                                        <span className="text-[10px] font-mono font-bold w-8 text-right text-slate-500">{localConfig.voiceRate?.toFixed(1)}x</span>
                                                    </div>

                                                    <div className="flex items-center gap-3">
                                                        <AudioWaveform size={14} className="text-slate-400" />
                                                        <div className="flex-1 relative h-6 flex items-center">
                                                            <input 
                                                                type="range" min="0.5" max="1.5" step="0.1"
                                                                value={localConfig.voicePitch || 1.0}
                                                                onChange={(e) => setLocalConfig(prev => ({...prev, voicePitch: parseFloat(e.target.value)}))}
                                                                className="w-full h-1.5 bg-slate-200 dark:bg-white/10 rounded-full appearance-none accent-indigo-500 cursor-pointer"
                                                            />
                                                        </div>
                                                        <span className="text-[10px] font-mono font-bold w-8 text-right text-slate-500">{localConfig.voicePitch?.toFixed(1)}</span>
                                                    </div>

                                                    <button 
                                                        onClick={handleTestVoice}
                                                        disabled={isTestingVoice}
                                                        className={`
                                                            w-full flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-bold uppercase tracking-wider transition-all
                                                            ${isTestingVoice ? 'bg-emerald-500 text-white animate-pulse' : 'bg-white dark:bg-white/5 border border-black/5 dark:border-white/5 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/10'}
                                                        `}
                                                    >
                                                        {isTestingVoice ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} fill="currentColor" />}
                                                        {isTestingVoice ? "Playing..." : "Test Voice"}
                                                    </button>

                                                </div>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>

                                    <div className="border-t border-black/5 dark:border-white/5 my-1" />

                                    <SettingItem label={t('settings.audio.voiceControl')} sub={t('settings.audio.voiceControlSub')} icon={Mic} color={{bg:'bg-rose-500/10', text:'text-rose-500'}}>
                                        <div className="flex gap-2">
                                            <button onClick={() => setShowVoiceHelp(true)} className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-100 dark:bg-white/10 text-slate-500 hover:text-indigo-500 transition-colors"><HelpCircle size={16} /></button>
                                            <button onClick={() => setLocalConfig(prev => ({...prev, voiceControlEnabled: !prev.voiceControlEnabled}))} className={`w-12 h-7 rounded-full p-1 transition-colors ${localConfig.voiceControlEnabled ? 'bg-rose-500' : 'bg-slate-200 dark:bg-white/10'}`}>
                                                <div className={`w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${localConfig.voiceControlEnabled ? 'translate-x-5' : ''}`} />
                                            </button>
                                        </div>
                                    </SettingItem>

                                    <SettingItem label={t('settings.game.scoutMode')} sub={t('settings.game.scoutModeSub')} icon={Activity} color={{bg:'bg-cyan-500/10', text:'text-cyan-500'}}>
                                        <button onClick={() => setLocalConfig(prev => ({...prev, enablePlayerStats: !prev.enablePlayerStats}))} className={`w-12 h-7 rounded-full p-1 transition-colors ${localConfig.enablePlayerStats ? 'bg-cyan-500' : 'bg-slate-200 dark:bg-white/10'}`}>
                                            <div className={`w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${localConfig.enablePlayerStats ? 'translate-x-5' : ''}`} />
                                        </button>
                                    </SettingItem>
                                </div>
                            </div>
                        </motion.div>
                    )}

                    {/* === TAB: SYSTEM & ACCOUNT === */}
                    {activeTab === 'system' && (
                        <motion.div 
                            key="system"
                            initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }}
                            transition={{ duration: 0.2 }}
                            className="space-y-6"
                        >
                            {/* Account */}
                            <div>
                                <SectionTitle icon={User}>{t('settings.sections.sync')}</SectionTitle>
                                {user ? (
                                    <div className="flex items-center justify-between p-3 rounded-2xl bg-white/60 dark:bg-white/5 border border-black/5 dark:border-white/5">
                                        <div className="flex items-center gap-3 min-w-0">
                                            {user.photoURL ? (
                                                <img src={user.photoURL} alt="User" className="w-12 h-12 rounded-xl flex-shrink-0" />
                                            ) : (
                                                <div className="w-12 h-12 rounded-xl bg-indigo-500 text-white flex items-center justify-center font-bold flex-shrink-0 text-lg">{user.displayName?.charAt(0)}</div>
                                            )}
                                            <div className="min-w-0">
                                                <div className="text-sm font-bold text-slate-800 dark:text-white truncate">{user.displayName}</div>
                                                <div className="text-[10px] text-slate-400 truncate">{user.email}</div>
                                            </div>
                                        </div>
                                        <button onClick={logout} className="p-2.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-xl flex-shrink-0 transition-colors"><LogOut size={20} /></button>
                                    </div>
                                ) : (
                                    <button onClick={signInWithGoogle} className="w-full flex items-center justify-center gap-2 py-4 bg-white dark:bg-white/5 border border-black/5 dark:border-white/10 rounded-2xl text-xs font-bold text-slate-700 dark:text-slate-200 shadow-sm hover:bg-slate-50 dark:hover:bg-white/10 transition-colors">
                                        <LogIn size={16} /> {t('settings.account.signInGoogle')}
                                    </button>
                                )}
                            </div>

                            {/* Data Backup */}
                            <div>
                                <SectionTitle icon={CloudDownload}>{t('settings.backup.title')}</SectionTitle>
                                
                                {pendingRestart ? (
                                    <div className="flex flex-col gap-3">
                                        <div className="flex items-center gap-2 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-600 dark:text-emerald-400 text-xs font-bold">
                                            <Check size={16} /> Data Restored! Restart Required.
                                        </div>
                                        <Button onClick={handleRestart} className="w-full bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg">
                                            <Power size={16} /> Restart App Now
                                        </Button>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-2 gap-3 p-1">
                                        <button 
                                            onClick={handleGenerateBackup}
                                            disabled={backupStatus === 'loading'}
                                            className={`flex flex-col items-center justify-center gap-2 p-4 rounded-2xl border transition-all ${backupStatus === 'loading' ? 'bg-indigo-50 dark:bg-indigo-500/10 border-indigo-200' : 'bg-white dark:bg-white/5 border-black/5 dark:border-white/5 hover:border-indigo-500/30 active:scale-95 text-slate-600 dark:text-slate-300 shadow-sm'}`}
                                        >
                                            {backupStatus === 'loading' ? <Loader2 size={24} className="animate-spin text-indigo-500" /> : <UploadCloud size={24} className="text-indigo-500" />}
                                            <span className="text-[10px] font-bold uppercase tracking-wider">{t('settings.backup.backupBtn')}</span>
                                        </button>
                                        <button 
                                            onClick={handleRestoreClick}
                                            disabled={restoreStatus === 'loading'}
                                            className={`flex flex-col items-center justify-center gap-2 p-4 rounded-2xl border transition-all ${restoreStatus === 'loading' ? 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200' : 'bg-white dark:bg-white/5 border-black/5 dark:border-white/5 hover:border-emerald-500/30 active:scale-95 text-slate-600 dark:text-slate-300 shadow-sm'}`}
                                        >
                                            {restoreStatus === 'loading' ? <Loader2 size={24} className="animate-spin text-emerald-500" /> : <DownloadCloud size={24} className="text-emerald-500" />}
                                            <span className="text-[10px] font-bold uppercase tracking-wider">{t('settings.backup.restoreBtn')}</span>
                                        </button>
                                    </div>
                                )}
                                {(statusMsg && !pendingRestart) && <p className={`text-[9px] mt-2 text-center font-bold ${statusMsg.includes('Error') || statusMsg.includes('Failed') || statusMsg.includes('Invalid') ? 'text-rose-500' : 'text-emerald-500'}`}>{statusMsg}</p>}
                                {!pendingRestart && <p className="text-[9px] text-slate-400 mt-2 text-center">{t('settings.backup.description')}</p>}
                                
                                <div className="mt-4 pt-4 border-t border-black/5 dark:border-white/5">
                                    <button onClick={handleResetTutorials} className="w-full flex items-center justify-center gap-2 py-3 text-[10px] font-bold uppercase tracking-wider text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-xl transition-colors">
                                        <RefreshCw size={14} /> {t('settings.backup.resetTutorials')}
                                    </button>
                                </div>
                            </div>

                            {/* AI Key */}
                            <div className="bg-slate-50 dark:bg-white/5 p-4 rounded-2xl border border-black/5 dark:border-white/5">
                                <div className="flex items-center justify-between mb-3">
                                    <div className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-300">
                                        <Key size={14} className="text-violet-500" /> {t('settings.ai.apiKey')}
                                    </div>
                                    <button onClick={() => setShowKey(!showKey)} className="text-slate-400 hover:text-indigo-500">
                                        {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
                                    </button>
                                </div>
                                <input 
                                    type={showKey ? "text" : "password"}
                                    value={localConfig.userApiKey || ''}
                                    onChange={(e) => setLocalConfig(prev => ({ ...prev, userApiKey: e.target.value }))}
                                    placeholder={t('settings.ai.placeholder')}
                                    className="w-full bg-white dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3 text-xs font-mono focus:outline-none focus:border-violet-500 transition-colors"
                                />
                                <p className="text-[9px] text-slate-400 mt-2">{t('settings.ai.help')} <a href="https://aistudio.google.com/app/apikey" target="_blank" className="text-violet-500 underline hover:text-violet-400">{t('settings.ai.getKey')}</a></p>
                            </div>

                            {/* App Info */}
                            <div>
                                <SectionTitle icon={Smartphone}>{t('settings.sections.install')}</SectionTitle>
                                
                                {!isNative && isInstallable && !isStandalone && (
                                    <Button onClick={promptInstall} size="sm" className="w-full bg-indigo-600 text-white shadow-indigo-500/20 mb-3">
                                        <Smartphone size={16} /> {t('install.installNow')}
                                    </Button>
                                )}

                                <div className="flex items-center justify-between p-3 rounded-2xl bg-white/60 dark:bg-white/5 border border-black/5 dark:border-white/5">
                                    <div className="flex items-center gap-3">
                                        <div className={`p-2.5 rounded-full ${showUpdateAvailable ? 'bg-emerald-500 text-white' : 'bg-slate-100 dark:bg-white/10 text-slate-400'}`}>
                                            {isActuallyChecking ? <RefreshCw size={18} className="animate-spin" /> : (showUpdateAvailable ? <CloudDownload size={18} /> : <Check size={18} />)}
                                        </div>
                                        <div>
                                            <div className="text-xs font-bold text-slate-700 dark:text-slate-200">{t('settings.install.version')} {APP_VERSION}</div>
                                            <div className={`text-[10px] ${showUpdateAvailable ? 'text-emerald-600' : 'text-slate-400'}`}>
                                                {showUpdateAvailable ? `${t('settings.install.updateAvailable')} ${remoteVersion ? `(v${remoteVersion})` : ''}` : t('settings.install.upToDate')}
                                            </div>
                                        </div>
                                    </div>
                                    {!isNative && (
                                        showUpdateAvailable ? (
                                            <button onClick={updateServiceWorker} className="px-4 py-2 bg-emerald-500 text-white text-[10px] font-bold rounded-xl shadow-sm hover:bg-emerald-400 transition-colors">{t('settings.install.update')}</button>
                                        ) : (
                                            <button onClick={handleSmartCheck} className="px-4 py-2 bg-slate-100 dark:bg-white/10 text-slate-500 text-[10px] font-bold rounded-xl hover:bg-slate-200 dark:hover:bg-white/20 transition-colors">{t('settings.install.check')}</button>
                                        )
                                    )}
                                </div>
                                
                                {isNative && <div className="text-center text-[10px] text-slate-400 mt-2 font-mono">{t('settings.install.native')}</div>}
                            </div>
                        </motion.div>
                    )}

                </AnimatePresence>
            </div>

            {/* --- FOOTER (FIXED) --- */}
            <div className="pt-3 shrink-0">
                {requiresReset && !pendingRestart && (
                    <div className="flex items-center gap-2 mb-3 px-1 text-rose-600 dark:text-rose-400 animate-pulse justify-center">
                        <AlertTriangle size={14} />
                        <span className="text-[10px] font-bold uppercase tracking-wide">{t('settings.warningTitle')} - {t('settings.resetWarning')}</span>
                    </div>
                )}
                <Button 
                    onClick={handleSave} 
                    disabled={pendingRestart}
                    className={`w-full py-4 text-sm font-black tracking-wider uppercase ${pendingRestart ? 'opacity-50 cursor-not-allowed bg-slate-300 dark:bg-slate-700 text-slate-500' : (requiresReset ? 'bg-rose-600 hover:bg-rose-500 shadow-rose-500/20' : 'bg-indigo-600 hover:bg-indigo-500 shadow-indigo-500/20')} text-white shadow-xl rounded-2xl`} 
                    size="lg"
                >
                    {pendingRestart ? 'Restart Required' : (requiresReset ? t('settings.applyAndReset') : t('settings.applyChanges'))}
                </Button>
            </div>
        </div>
      </div>
    </Modal>
    </>
  );
};
