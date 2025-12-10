
import React, { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { GameState, TeamId } from '../../types';
import { Trophy, RefreshCw, ArrowRight, UserPlus, ShieldAlert, Users, RotateCcw, Terminal, ChevronDown, ChevronUp, Undo2, Share2, Loader2, Download } from 'lucide-react';
import { useTranslation } from '../../contexts/LanguageContext';
import { motion, AnimatePresence } from 'framer-motion';
import { ResultCard } from '../Share/ResultCard';
import { useSocialShare } from '../../hooks/useSocialShare';
import { resolveTheme } from '../../utils/colors';
import { Confetti } from '../ui/Confetti';
import { useHaptics } from '../../hooks/useHaptics';

interface MatchOverModalProps {
  isOpen: boolean;
  state: GameState;
  onRotate: () => void;
  onReset: () => void;
  onUndo: () => void;
}

export const MatchOverModal: React.FC<MatchOverModalProps> = ({ isOpen, state, onRotate, onReset, onUndo }) => {
  const { t } = useTranslation();
  const [showLogs, setShowLogs] = useState(false);
  const [renderShareCard, setRenderShareCard] = useState(false);
  const [canInteract, setCanInteract] = useState(false); 
  const { isSharing, shareMatch, downloadMatch } = useSocialShare();
  const haptics = useHaptics();

  const winnerName = state.matchWinner === 'A' ? state.teamAName : state.teamBName;
  const isA = state.matchWinner === 'A';
  const report = state.rotationReport;

  const colorA = state.teamARoster.color || 'indigo';
  const colorB = state.teamBRoster.color || 'rose';
  
  const winnerColorKey = isA ? colorA : colorB;
  const winnerTheme = resolveTheme(winnerColorKey);
  
  const getBgColor = (c: string) => {
      if (c.startsWith('#')) return `bg-[${c}]`;
      const mapping: any = {
        indigo: 'bg-indigo-600', rose: 'bg-rose-600', emerald: 'bg-emerald-600', amber: 'bg-amber-600', 
        sky: 'bg-sky-600', violet: 'bg-violet-600', slate: 'bg-slate-600', fuchsia: 'bg-fuchsia-600'
      };
      return mapping[c] || 'bg-indigo-600';
  };
  const winnerBgColor = getBgColor(winnerColorKey);

  const stolenIds = new Set(report?.stolenPlayers.map(p => p.id) || []);
  const coreSquad = report?.incomingTeam.players.filter(p => !stolenIds.has(p.id)) || [];
  const reinforcements = report?.stolenPlayers || [];
  const logs = report?.logs || [];

  useEffect(() => {
    if (isOpen) {
        setCanInteract(false);
        const timer = setTimeout(() => setCanInteract(true), 1200); 
        return () => clearTimeout(timer);
    }
  }, [isOpen]);

  const mvpData = useMemo(() => {
     if (!state.matchLog || state.matchLog.length === 0) return null;
     
     const pointsMap = new Map<string, { total: number, name: string, team: TeamId }>();
     const playerMap = new Map<string, { name: string, team: TeamId }>();
     state.teamARoster.players.forEach(p => playerMap.set(p.id, { name: p.name, team: 'A' }));
     state.teamBRoster.players.forEach(p => playerMap.set(p.id, { name: p.name, team: 'B' }));

     state.matchLog.forEach(log => {
         if (log.type === 'POINT' && log.playerId && playerMap.has(log.playerId)) {
             const info = playerMap.get(log.playerId)!;
             const current = pointsMap.get(log.playerId) || { total: 0, name: info.name, team: info.team };
             current.total += 1;
             pointsMap.set(log.playerId, current);
         }
     });

     if (pointsMap.size === 0) return null;
     const sorted = Array.from(pointsMap.values()).sort((a, b) => b.total - a.total);
     const top = sorted[0];
     return top.total > 0 ? { name: top.name, totalPoints: top.total, team: top.team } : null;

  }, [state.matchLog, state.teamARoster, state.teamBRoster]);

  const handleShareAction = (action: 'share' | 'download') => {
      setRenderShareCard(true);
      haptics.impact('light');
      
      setTimeout(() => {
          if (action === 'share') shareMatch();
          else downloadMatch();
      }, 500);
  };

  if (!isOpen && renderShareCard) {
      setRenderShareCard(false);
  }

  return (
    <>
      {renderShareCard && createPortal(
          <ResultCard 
             teamAName={state.teamAName}
             teamBName={state.teamBName}
             setsA={state.setsA}
             setsB={state.setsB}
             winner={state.matchWinner}
             setsHistory={state.history}
             durationSeconds={state.matchDurationSeconds}
             date={new Date().toLocaleDateString()}
             mvp={mvpData}
             colorA={colorA}
             colorB={colorB}
          />,
          document.body
      )}

      <Modal 
        isOpen={isOpen} 
        onClose={() => {}} 
        title={t('matchOver.title')}
        showCloseButton={false}
        persistent={true}
      >
        {/* Confetti Background - Lower Z-Index */}
        <div className="absolute inset-0 overflow-hidden rounded-[2rem] pointer-events-none z-0 opacity-40">
            <Confetti color={winnerColorKey} />
        </div>

        {/* Content Container - High Z-Index to stay above confetti */}
        <div className="flex flex-col items-center text-center space-y-6 relative z-20 pt-2">
          
          <div className="relative group">
              <div className={`absolute inset-0 blur-[80px] rounded-full opacity-40 ${winnerBgColor}`}></div>
              <div className="relative flex flex-col items-center z-20">
                  <motion.div
                    initial={{ scale: 0, rotate: -20 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ type: 'spring', stiffness: 200, damping: 15, delay: 0.2 }}
                  >
                    <Trophy size={80} className={`${winnerTheme.text} ${winnerTheme.textDark} drop-shadow-[0_4px_20px_rgba(0,0,0,0.3)]`} strokeWidth={1.5} />
                  </motion.div>
                  
                  <h2 className="text-3xl sm:text-4xl font-black text-slate-900 dark:text-white mt-4 uppercase tracking-tighter drop-shadow-sm leading-none">
                    {winnerName}
                  </h2>
                  
                  <div className="flex items-center gap-3 mt-2 opacity-80">
                      <div className="h-px w-10 bg-slate-400 dark:bg-slate-500"></div>
                      <span className="text-[10px] font-black tracking-[0.2em] text-slate-500 dark:text-slate-400 uppercase">{t('matchOver.wins')}</span>
                      <div className="h-px w-10 bg-slate-400 dark:bg-slate-500"></div>
                  </div>
              </div>
          </div>

          {/* Score Display */}
          <div className="flex items-center gap-8 text-5xl font-black font-inter bg-white/60 dark:bg-black/40 px-10 py-5 rounded-[2rem] border border-white/40 dark:border-white/10 shadow-xl backdrop-blur-xl z-20">
              <span className={isA ? `${winnerTheme.text} ${winnerTheme.textDark} drop-shadow-lg` : 'text-slate-400 dark:text-slate-600 opacity-60'}>{state.setsA}</span>
              <div className="h-10 w-[3px] bg-slate-300 dark:bg-slate-700 rounded-full opacity-30 rotate-12"></div>
              <span className={!isA ? `${winnerTheme.text} ${winnerTheme.textDark} drop-shadow-lg` : 'text-slate-400 dark:text-slate-600 opacity-60'}>{state.setsB}</span>
          </div>

          {report && (
              <div className="w-full bg-slate-50/80 dark:bg-white/[0.03] rounded-2xl p-4 text-left border border-black/5 dark:border-white/5 space-y-3 backdrop-blur-md shadow-sm z-20">
                  <div className="flex items-center justify-between border-b border-black/5 dark:border-white/5 pb-2">
                       <h3 className="font-bold text-slate-500 dark:text-slate-500 uppercase text-[10px] tracking-widest">{t('matchOver.rotationReport.title')}</h3>
                       <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold uppercase tracking-wider">{t('matchOver.rotationReport.entering', { teamName: report.incomingTeam.name })}</span>
                  </div>
                  
                  {/* Simplified Report Summary */}
                  <div className="flex flex-wrap gap-2 pt-1">
                      {coreSquad.map(p => (
                          <span key={p.id} className="text-[10px] font-bold text-slate-600 dark:text-slate-400 bg-white dark:bg-white/10 px-2 py-1 rounded-lg border border-black/5 dark:border-white/5">
                              {p.name}
                          </span>
                      ))}
                      {reinforcements.map(p => (
                          <span key={p.id} className="text-[10px] font-bold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2 py-1 rounded-lg border border-amber-500/20 flex items-center gap-1">
                              <UserPlus size={10} /> {p.name}
                          </span>
                      ))}
                  </div>

                  {logs.length > 0 && (
                      <button 
                          onClick={() => setShowLogs(!showLogs)} 
                          className="w-full flex items-center justify-center gap-2 pt-2 text-[9px] font-bold uppercase tracking-wider text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                      >
                          {t('matchOver.debugLogs')} {showLogs ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
                      </button>
                  )}
                  
                  <AnimatePresence>
                      {showLogs && (
                          <motion.div 
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              className="overflow-hidden"
                          >
                              <div className="mt-2 bg-slate-950 text-slate-300 p-3 rounded-lg font-mono text-[9px] leading-relaxed max-h-32 overflow-y-auto custom-scrollbar">
                                  {logs.map((log, idx) => <div key={idx} className="mb-1 opacity-80">{log}</div>)}
                              </div>
                          </motion.div>
                      )}
                  </AnimatePresence>
              </div>
          )}

          <motion.div 
            initial={{ opacity: 0, y: 20, pointerEvents: 'none' }}
            animate={{ 
                opacity: 1, 
                y: 0, 
                pointerEvents: canInteract ? 'auto' : 'none' 
            }}
            transition={{ delay: 0.8, duration: 0.5 }}
            className={`flex flex-col w-full gap-3 mt-4 relative z-30 ${!canInteract ? 'grayscale opacity-50 cursor-wait' : ''}`}
          >
              <div className="flex gap-2">
                   <Button 
                      onClick={() => handleShareAction('share')} 
                      disabled={isSharing || !canInteract}
                      variant="secondary"
                      className="flex-1 bg-white dark:bg-white/10 text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-white/10"
                  >
                      {isSharing ? <Loader2 size={18} className="animate-spin" /> : <Share2 size={18} />}
                      <span className="ml-2">{t('matchOver.share')}</span>
                  </Button>

                  <Button 
                      onClick={() => handleShareAction('download')} 
                      disabled={isSharing || !canInteract}
                      variant="secondary"
                      className="aspect-square p-0 flex items-center justify-center bg-white dark:bg-white/10 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-white/10"
                      title="Download Image"
                  >
                      {isSharing ? <Loader2 size={18} className="animate-spin" /> : <Download size={18} />}
                  </Button>
              </div>
              
              <Button onClick={onRotate} disabled={!canInteract} size="lg" className="w-full shadow-xl shadow-emerald-500/30 bg-emerald-600 hover:bg-emerald-500 border-t border-white/20 text-white font-black tracking-wide text-sm py-4">
                  <RefreshCw size={18} />
                  {t('matchOver.nextGameButton')}
              </Button>
              
              <div className="grid grid-cols-2 gap-3 pt-2">
                  <Button onClick={onUndo} disabled={!canInteract} size="md" variant="ghost" className="w-full text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white">
                      <Undo2 size={16} /> {t('controls.undo')}
                  </Button>
                  <Button onClick={onReset} disabled={!canInteract} size="md" variant="ghost" className="w-full text-rose-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10">
                      <RotateCcw size={16} /> {t('controls.reset')}
                  </Button>
              </div>
          </motion.div>
        </div>
      </Modal>
    </>
  );
};
