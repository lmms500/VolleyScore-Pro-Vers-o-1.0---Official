
import React, { useState, memo, useMemo } from 'react';
import { Modal } from '../ui/Modal';
import { Team, TeamId, SkillType, Player, ActionLog, GameConfig } from '../../types';
import { VolleyballCourt } from '../Court/VolleyballCourt';
import { RotateCw, RotateCcw, Plus, Minus, X, Crown, Zap, TrendingUp, Skull, Timer, ArrowRightLeft, Users, History, Settings } from 'lucide-react';
import { useTranslation } from '../../contexts/LanguageContext';
import { useHaptics } from '../../hooks/useHaptics';
import { DndContext, DragEndEvent, DragOverlay, useSensor, useSensors, PointerSensor, closestCenter, DragStartEvent } from '@dnd-kit/core';
import { createPortal } from 'react-dom';
import { resolveTheme } from '../../utils/colors';
import { motion, LayoutGroup } from 'framer-motion';
import { useTimer } from '../../contexts/TimerContext';
import { SubstitutionModal } from './SubstitutionModal';
import { ScoutModal } from './ScoutModal';

interface CourtModalProps {
  isOpen: boolean;
  onClose: () => void;
  teamA: Team;
  teamB: Team;
  scoreA: number;
  scoreB: number;
  servingTeam: TeamId | null;
  onManualRotate: (teamId: string, direction: 'clockwise' | 'counter') => void;
  onAddPoint: (teamId: TeamId, playerId?: string, skill?: SkillType) => void;
  onSubtractPoint: (teamId: TeamId) => void;
  onMovePlayer: (teamId: string, indexA: number, indexB: number) => void;
  onSubstitute?: (teamId: string, pIn: string, pOut: string) => void;
  
  currentSet: number;
  setsA: number;
  setsB: number;
  isMatchPointA: boolean;
  isMatchPointB: boolean;
  isSetPointA: boolean;
  isSetPointB: boolean;
  isDeuce: boolean;
  inSuddenDeath: boolean;
  
  matchLog?: ActionLog[];
  config?: GameConfig;

  onOpenManager?: () => void;
  onOpenHistory?: () => void;
  onOpenSettings?: () => void;
}

const MiniBadge = memo(({ icon: Icon, colorClass, text }: any) => (
    <div className={`flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[8px] font-black uppercase tracking-wider ${colorClass} shadow-sm border border-white/10`}>
        <Icon size={8} fill="currentColor" />
        <span>{text}</span>
    </div>
));

const RotationControls = memo(({ 
    teamName, 
    theme, 
    onRotateClockwise, 
    onRotateCounter, 
    onSubstitute,
    align 
}: { 
    teamName: string, 
    theme: any, 
    onRotateClockwise: () => void, 
    onRotateCounter: () => void,
    onSubstitute: () => void,
    align: 'left' | 'right'
}) => {
    return (
        <div className={`flex flex-col gap-1 pointer-events-auto ${align === 'left' ? 'items-start' : 'items-end'}`}>
            <span className={`text-[8px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 bg-white/80 dark:bg-black/40 px-2 py-0.5 rounded-lg backdrop-blur-sm mb-1 shadow-sm`}>
                {teamName}
            </span>
            <div className="flex gap-1.5">
                <button onClick={onRotateCounter} className="w-10 h-10 rounded-xl bg-white/50 dark:bg-white/5 hover:bg-white/80 dark:hover:bg-white/10 border border-slate-200 dark:border-white/10 flex items-center justify-center backdrop-blur-md active:scale-95 transition-all text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white shadow-sm hover:shadow-md">
                    <RotateCcw size={16} strokeWidth={2.5} />
                </button>
                <button onClick={onRotateClockwise} className={`w-10 h-10 rounded-xl ${theme.bg} hover:${theme.bg.replace('/20', '/30')} border ${theme.border} flex items-center justify-center backdrop-blur-md active:scale-95 transition-all ${theme.text} dark:${theme.textDark} shadow-sm hover:shadow-md`}>
                    <RotateCw size={16} strokeWidth={2.5} />
                </button>
                <button onClick={onSubstitute} className="w-10 h-10 rounded-xl bg-white/50 dark:bg-white/5 hover:bg-white/80 dark:hover:bg-white/10 border border-slate-200 dark:border-white/10 flex items-center justify-center backdrop-blur-md active:scale-95 transition-all text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white shadow-sm hover:shadow-md">
                    <ArrowRightLeft size={16} strokeWidth={2.5} />
                </button>
            </div>
        </div>
    );
});

// --- UTILITY: Calculate Visual Players based on Offset ---
const getVisualPlayers = (players: Player[], offset: number = 0): Player[] => {
    if (players.length < 2 || offset === 0) return players;
    const safeOffset = offset % players.length;
    if (safeOffset === 0) return players;
    
    // Rotate players array for visual representation based on offset
    const splitIndex = players.length - safeOffset;
    return [...players.slice(splitIndex), ...players.slice(0, splitIndex)];
};

export const CourtModal: React.FC<CourtModalProps> = ({
  isOpen, onClose, teamA, teamB, scoreA, scoreB, servingTeam, onManualRotate, onAddPoint, onSubtractPoint, onMovePlayer, onSubstitute,
  currentSet, setsA, setsB, isMatchPointA, isMatchPointB, isSetPointA, isSetPointB, isDeuce, inSuddenDeath,
  matchLog, config, onOpenManager, onOpenHistory, onOpenSettings
}) => {
  const { t } = useTranslation();
  const haptics = useHaptics();
  const { seconds } = useTimer();
  
  const [activeDragPlayer, setActiveDragPlayer] = useState<any>(null);
  const [activeDragTeamColor, setActiveDragTeamColor] = useState<string>('slate');
  const [isDragging, setIsDragging] = useState(false);
  
  const [subModalTeamId, setSubModalTeamId] = useState<string | null>(null);
  
  const [scoutModalState, setScoutModalState] = useState<{ isOpen: boolean, teamId: TeamId, preSelectedPlayerId: string | null }>({
      isOpen: false, teamId: 'A', preSelectedPlayerId: null
  });

  // Optimized sensors for instant drag on touch/mouse
  const sensors = useSensors(
    useSensor(PointerSensor, { 
        activationConstraint: { distance: 5 } 
    })
  );

  const currentMVPId = useMemo(() => {
      if (!matchLog) return null;
      const points: Record<string, number> = {};
      let maxPoints = 0;
      let mvp = null;

      matchLog.forEach(log => {
          if (log.type === 'POINT' && log.playerId && log.playerId !== 'unknown') {
              points[log.playerId] = (points[log.playerId] || 0) + 1;
              if (log.skill === 'block' || log.skill === 'ace') points[log.playerId] += 0.5;
          }
      });

      for (const [pid, pts] of Object.entries(points)) {
          if (pts > maxPoints) {
              maxPoints = pts;
              mvp = pid;
          }
      }
      return mvp;
  }, [matchLog]);

  const handleDragStart = (event: DragStartEvent) => {
      haptics.impact('medium');
      const player = event.active.data.current?.player;
      const teamId = event.active.data.current?.teamId;
      setActiveDragPlayer(player);
      setIsDragging(true);
      if (teamId === 'A') setActiveDragTeamColor(teamA.color || 'indigo');
      else if (teamId === 'B') setActiveDragTeamColor(teamB.color || 'rose');
  };

  const handleDragEnd = (event: DragEndEvent) => {
      const { active, over } = event;
      setActiveDragPlayer(null);
      setIsDragging(false);
      if (!over) return;

      const sourceData = active.data.current;
      const targetData = over.data.current;

      if (!sourceData || !targetData) return;
      if (sourceData.teamId !== targetData.teamId) {
          haptics.notification('error');
          return;
      }

      // Check if valid indices exist on both source and target
      if (typeof sourceData.index === 'number' && typeof targetData.index === 'number' && sourceData.index !== targetData.index) {
          haptics.impact('heavy');
          
          const realSourceIndex = sourceData.index;
          const realTargetIndex = targetData.index;

          onMovePlayer(sourceData.teamId, realSourceIndex, realTargetIndex);
      }
  };

  const handleScore = (teamId: TeamId, delta: number) => {
      haptics.impact('light');
      if (delta > 0) {
          if (config?.enablePlayerStats) {
              setScoutModalState({ isOpen: true, teamId, preSelectedPlayerId: null });
          } else {
              onAddPoint(teamId);
          }
      } else {
          onSubtractPoint(teamId);
      }
  };

  const handlePlayerClick = (player: Player, teamId: TeamId) => {
      haptics.impact('light');
      setScoutModalState({ isOpen: true, teamId, preSelectedPlayerId: player.id });
  };

  const handleScoutConfirm = (playerId: string, skill: SkillType) => {
      onAddPoint(scoutModalState.teamId, playerId, skill);
      setScoutModalState({ ...scoutModalState, isOpen: false });
  };

  const handleRotate = (teamId: TeamId, direction: 'clockwise' | 'counter') => {
      haptics.impact('medium');
      onManualRotate(teamId, direction);
  };
  
  const handleSubstituteRequest = (teamId: string) => {
      haptics.impact('light');
      setSubModalTeamId(teamId);
  };
  
  const handleSubstitutionConfirm = (pIn: string, pOut: string) => {
      if (subModalTeamId && onSubstitute) {
          onSubstitute(subModalTeamId, pIn, pOut);
      }
  };

  const formatTime = (s: number) => {
      const m = Math.floor(s / 60);
      const sec = s % 60;
      return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  const themeA = resolveTheme(teamA.color);
  const themeB = resolveTheme(teamB.color);
  const dragTheme = resolveTheme(activeDragTeamColor);

  const visualPlayersA = useMemo(() => getVisualPlayers(teamA.players, teamA.tacticalOffset), [teamA.players, teamA.tacticalOffset]);
  const visualPlayersB = useMemo(() => getVisualPlayers(teamB.players, teamB.tacticalOffset), [teamB.players, teamB.tacticalOffset]);

  const ShortcutButton = ({ icon: Icon, onClick }: any) => (
      <button 
          onClick={onClick}
          className="w-10 h-10 flex items-center justify-center text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-all active:scale-90"
      >
          <Icon size={18} strokeWidth={2} />
      </button>
  );

  const isBeach = config?.mode === 'beach';
  
  // Dynamic styling for the main container - Orange for indoor
  let courtBgClass = "";
  
  if (isBeach) {
      courtBgClass = "bg-[#e3cba5]";
  } else {
      courtBgClass = "bg-orange-500";
  }

  return (
    <Modal 
        isOpen={isOpen} 
        onClose={onClose} 
        title="" 
        variant="immersive" 
        zIndex="z-[100]"
    >
        {subModalTeamId && (
            <SubstitutionModal 
                isOpen={!!subModalTeamId} 
                onClose={() => setSubModalTeamId(null)}
                team={subModalTeamId === 'A' ? teamA : teamB}
                onConfirm={handleSubstitutionConfirm}
                zIndex="z-[110]"
            />
        )}

        <ScoutModal 
            isOpen={scoutModalState.isOpen}
            onClose={() => setScoutModalState({ ...scoutModalState, isOpen: false })}
            team={scoutModalState.teamId === 'A' ? teamA : teamB}
            colorTheme={scoutModalState.teamId === 'A' ? teamA.color : teamB.color}
            onConfirm={handleScoutConfirm}
            initialPlayerId={scoutModalState.preSelectedPlayerId}
        />

        <DndContext 
            sensors={sensors} 
            onDragStart={handleDragStart} 
            onDragEnd={handleDragEnd}
            collisionDetection={closestCenter}
        >
            
            <div className="relative w-full h-full text-slate-900 dark:text-white flex flex-col overflow-hidden select-none z-10">
                
                <div className="relative z-50 pt-safe-top px-4 pb-1 flex flex-col gap-1 shrink-0 bg-transparent pointer-events-none">
                    
                    <div className="flex items-center justify-center gap-3 text-[10px] font-mono font-bold text-slate-500 dark:text-slate-400 opacity-80 pointer-events-auto">
                        <div className="flex items-center gap-1"><Timer size={10} /> {formatTime(seconds)}</div>
                        <div className="w-px h-3 bg-slate-300 dark:bg-white/20" />
                        <div className="uppercase tracking-widest text-slate-400 dark:text-slate-300">Set {currentSet}</div>
                    </div>

                    <div className="flex items-center justify-between max-w-md mx-auto w-full pointer-events-auto">
                        
                        <div className="flex items-center gap-3">
                            <div className="flex flex-col items-end">
                                <div className="flex items-center gap-1.5 mb-0.5">
                                    {isMatchPointA && <Crown size={10} className="text-amber-500 dark:text-amber-400" fill="currentColor" />}
                                    {isSetPointA && <Zap size={10} className={`${themeA.text} ${themeA.textDark}`} fill="currentColor" />}
                                    <span className={`text-[10px] font-black uppercase tracking-wider ${themeA.text} ${themeA.textDark} truncate max-w-[80px]`}>{teamA.name}</span>
                                    {servingTeam === 'A' && <div className={`w-1.5 h-1.5 rounded-full ${themeA.bg.replace('/20', '')} shadow-[0_0_8px_currentColor]`} />}
                                </div>
                                <div className="flex items-center gap-2 bg-white/60 dark:bg-slate-800/50 rounded-xl p-1 border border-slate-200 dark:border-white/5 backdrop-blur-sm shadow-sm">
                                    <button onClick={() => handleScore('A', -1)} className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 flex items-center justify-center text-slate-400 dark:text-slate-400 transition-colors"><Minus size={12} strokeWidth={3} /></button>
                                    <span className="text-3xl font-black tabular-nums leading-none min-w-[32px] text-center text-slate-800 dark:text-white">{scoreA}</span>
                                    <button onClick={() => handleScore('A', 1)} className={`w-8 h-8 rounded-lg ${themeA.bg} hover:${themeA.bg.replace('/20', '/30')} flex items-center justify-center ${themeA.text} ${themeA.textDark}`}><Plus size={12} strokeWidth={3} /></button>
                                </div>
                            </div>
                        </div>

                        <div className="flex flex-col items-center justify-center px-3">
                            <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">Sets</span>
                            <div className="flex items-center gap-2 text-lg font-black text-slate-400 dark:text-slate-300">
                                <span className={setsA > setsB ? `${themeA.text} ${themeA.textDark}` : ''}>{setsA}</span>
                                <span className="opacity-30 text-sm">:</span>
                                <span className={setsB > setsA ? `${themeB.text} ${themeB.textDark}` : ''}>{setsB}</span>
                            </div>
                        </div>

                        <div className="flex items-center gap-3 flex-row-reverse">
                            <div className="flex flex-col items-start">
                                <div className="flex items-center gap-1.5 mb-0.5 flex-row-reverse">
                                    {isMatchPointB && <Crown size={10} className="text-amber-500 dark:text-amber-400" fill="currentColor" />}
                                    {isSetPointB && <Zap size={10} className={`${themeB.text} ${themeB.textDark}`} fill="currentColor" />}
                                    <span className={`text-[10px] font-black uppercase tracking-wider ${themeB.text} ${themeB.textDark} truncate max-w-[80px]`}>{teamB.name}</span>
                                    {servingTeam === 'B' && <div className={`w-1.5 h-1.5 rounded-full ${themeB.bg.replace('/20', '')} shadow-[0_0_8px_currentColor]`} />}
                                </div>
                                <div className="flex items-center gap-2 bg-white/60 dark:bg-slate-800/50 rounded-xl p-1 border border-slate-200 dark:border-white/5 flex-row-reverse backdrop-blur-sm shadow-sm">
                                    <button onClick={() => handleScore('B', -1)} className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 flex items-center justify-center text-slate-400 dark:text-slate-400 transition-colors"><Minus size={12} strokeWidth={3} /></button>
                                    <span className="text-3xl font-black tabular-nums leading-none min-w-[32px] text-center text-slate-800 dark:text-white">{scoreB}</span>
                                    <button onClick={() => handleScore('B', 1)} className={`w-8 h-8 rounded-lg ${themeB.bg} hover:${themeB.bg.replace('/20', '/30')} flex items-center justify-center ${themeB.text} ${themeB.textDark}`}><Plus size={12} strokeWidth={3} /></button>
                                </div>
                            </div>
                        </div>

                    </div>

                    {(inSuddenDeath || isDeuce || isMatchPointA || isMatchPointB) && (
                        <div className="flex justify-center gap-2 mt-1 pointer-events-auto">
                            {inSuddenDeath && <MiniBadge icon={Skull} text={t('status.sudden_death')} colorClass="bg-red-500 text-white" />}
                            {isDeuce && <MiniBadge icon={TrendingUp} text="DEUCE" colorClass="bg-indigo-500 text-white" />}
                            {(isMatchPointA || isMatchPointB) && <MiniBadge icon={Crown} text="MATCH POINT" colorClass="bg-amber-500 text-black" />}
                        </div>
                    )}
                </div>

                <button onClick={onClose} className="absolute top-safe-top right-4 z-[60] p-2 mt-2 rounded-full bg-white/50 dark:bg-white/10 hover:bg-white/80 dark:hover:bg-white/20 text-slate-500 dark:text-white transition-all backdrop-blur-md border border-slate-200 dark:border-white/5 active:scale-95 pointer-events-auto shadow-sm">
                    <X size={18} />
                </button>

                <LayoutGroup id="court-modal-layout">
                    <div className="flex-1 flex items-center justify-center relative w-full min-h-0 py-2 overflow-visible">
                        <div className={`
                            relative w-full max-w-4xl max-h-[58vh] aspect-[1.8/1] flex 
                            shadow-[0_20px_50px_-10px_rgba(0,0,0,0.1)] dark:shadow-[0_20px_50px_-10px_rgba(0,0,0,0.7)]
                            rounded-3xl
                            ${courtBgClass} dark:bg-slate-900/40 backdrop-blur-md 
                            border border-white/40 dark:border-white/10 
                            p-0 mx-2
                            overflow-hidden
                        `}>
                            
                            <div className="absolute inset-0 z-0 rounded-3xl overflow-hidden">
                                {isBeach ? (
                                    <div className="absolute inset-0 bg-[#e3cba5] mix-blend-normal">
                                        <div className="absolute inset-0 opacity-20 bg-[url('https://www.transparenttextures.com/patterns/sand.png')] mix-blend-multiply" />
                                    </div>
                                ) : (
                                    <>
                                        <div className="absolute inset-0 bg-gradient-to-br from-orange-400 via-orange-500 to-orange-600 dark:from-orange-500/20 dark:via-orange-600/10 dark:to-slate-900/60 mix-blend-normal dark:mix-blend-overlay" />
                                        <div className="absolute inset-0 opacity-10 bg-[url('https://www.transparenttextures.com/patterns/wood-pattern.png')] mix-blend-multiply" />
                                    </>
                                )}
                                <div className="absolute -top-1/2 left-0 w-[200%] h-full bg-gradient-to-b from-white/20 to-transparent -rotate-12 transform origin-bottom-left" />
                            </div>

                            <div className="absolute top-0 bottom-0 left-1/2 w-1 -ml-0.5 z-30 shadow-[0_0_15px_rgba(0,0,0,0.1)] dark:shadow-[0_0_15px_rgba(255,255,255,0.15)] pointer-events-none">
                                <div className="w-full h-full bg-white/60 dark:bg-white/20 backdrop-blur-sm border-l border-white/50 dark:border-white/30" />
                                <div className="absolute top-0 w-2 -left-0.5 h-full bg-slate-400/20 dark:bg-white/10" />
                            </div>

                            <div className="flex-1 h-full relative z-10">
                                <VolleyballCourt 
                                    players={visualPlayersA} color={teamA.color} isServing={servingTeam === 'A'} side="left" teamId="A"
                                    variant="minimal"
                                    onPlayerClick={(p) => handlePlayerClick(p, 'A')}
                                    mvpId={currentMVPId}
                                    mode={config?.mode}
                                    isDragActive={isDragging}
                                />
                            </div>

                            <div className="flex-1 h-full relative z-10">
                                <VolleyballCourt 
                                    players={visualPlayersB} color={teamB.color} isServing={servingTeam === 'B'} side="right" teamId="B"
                                    variant="minimal"
                                    onPlayerClick={(p) => handlePlayerClick(p, 'B')}
                                    mvpId={currentMVPId}
                                    mode={config?.mode}
                                    isDragActive={isDragging}
                                />
                            </div>
                        </div>
                    </div>
                </LayoutGroup>

                <div className="w-full px-4 pb-safe-bottom pt-1 mb-2 shrink-0 flex justify-between items-end relative z-40 pointer-events-auto">
                    
                    <RotationControls 
                        teamName={teamA.name} 
                        theme={themeA} 
                        align="left"
                        onRotateClockwise={() => handleRotate('A', 'clockwise')}
                        onRotateCounter={() => handleRotate('A', 'counter')}
                        onSubstitute={() => handleSubstituteRequest('A')}
                    />

                    <div className="absolute left-1/2 -translate-x-1/2 bottom-0 flex gap-2 p-1 bg-white/80 dark:bg-black/40 backdrop-blur-md rounded-2xl border border-black/5 dark:border-white/10 shadow-lg mb-0.5">
                        <ShortcutButton icon={Users} onClick={onOpenManager} />
                        <ShortcutButton icon={History} onClick={onOpenHistory} />
                        <ShortcutButton icon={Settings} onClick={onOpenSettings} />
                    </div>

                    <RotationControls 
                        teamName={teamB.name} 
                        theme={themeB} 
                        align="right"
                        onRotateClockwise={() => handleRotate('B', 'clockwise')}
                        onRotateCounter={() => handleRotate('B', 'counter')}
                        onSubstitute={() => handleSubstituteRequest('B')}
                    />

                </div>

            </div>

            {createPortal(
                <DragOverlay dropAnimation={{ duration: 250, easing: 'cubic-bezier(0.18, 0.67, 0.6, 1.22)' }} zIndex={1000}>
                    {activeDragPlayer ? (
                        <div className="w-20 h-20 flex flex-col items-center justify-center pointer-events-none">
                            <div className={`w-16 h-16 rounded-full shadow-2xl flex items-center justify-center bg-gradient-to-br ${dragTheme.gradient.replace('/15', '').replace('to-transparent', 'to-black/20')} border-2 border-white/40 ring-4 ring-white/20 backdrop-blur-xl`}>
                                <span className="text-2xl font-black text-white drop-shadow-md font-mono tracking-tighter">{activeDragPlayer.number || '#'}</span>
                            </div>
                        </div>
                    ) : null}
                </DragOverlay>,
                document.body
            )}
        </DndContext>
    </Modal>
  );
};
