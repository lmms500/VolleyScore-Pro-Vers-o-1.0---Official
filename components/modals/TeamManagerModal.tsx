
import React, { useState, useMemo, useEffect, useCallback, memo, useRef, lazy } from 'react';
import { Modal } from '../ui/Modal';
import { Team, Player, RotationMode, PlayerProfile, TeamColor, ActionLog, PlayerRole } from '../../types';
import { Layers, Search, X, List, ChevronLeft, ChevronRight, ListOrdered, Plus } from 'lucide-react';
import { DndContext, DragEndEvent, DragOverEvent, DragStartEvent, DragOverlay, closestCenter, PointerSensor, useSensor, useSensors, KeyboardSensor, TouchSensor, useDndMonitor, MouseSensor } from '@dnd-kit/core';
import { createPortal } from 'react-dom';
import { useTranslation } from '../../contexts/LanguageContext';
import { motion, AnimatePresence } from 'framer-motion';
import { ProfileCreationModal } from './ProfileCreationModal';
import { ProfileDetailsModal } from './ProfileDetailsModal';
import { ConfirmationModal } from './ConfirmationModal';
import { useHaptics } from '../../hooks/useHaptics';
import { useGameAudio } from '../../hooks/useGameAudio';
import { PlayerCard } from '../PlayerCard';
import { staggerContainer, staggerItem } from '../../utils/animations';
import { useTutorial } from '../../hooks/useTutorial';
import { getPlayersOnCourt, getBenchLimit } from '../../constants';
import { useGame } from '../../contexts/GameContext'; 

import { BatchInputSection } from '../TeamManager/TeamManagerUI';
import { PlayerContextMenu } from '../TeamManager/PlayerContextMenu';
import { RosterColumn } from '../TeamManager/RosterColumn';
import { ProfileCard } from '../TeamManager/ProfileCard';

const RichTutorialModal = lazy(() => import('./RichTutorialModal').then(m => ({ default: m.RichTutorialModal })));

const DragOverlayFixed = DragOverlay as any;

interface TeamManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  courtA: Team;
  courtB: Team;
  queue: Team[];
  rotationMode: RotationMode;
  onSetRotationMode: (mode: RotationMode) => void;
  onBalanceTeams: () => void;
  onGenerate: (names: string[]) => void;
  onToggleFixed: (playerId: string) => void;
  onRemove: (id: string) => void; 
  onDeletePlayer?: (id: string) => void;
  onMove: (playerId: string, fromId: string, toId: string, newIndex?: number) => void;
  onUpdateTeamName: (teamId: string, name: string) => void;
  onUpdateTeamColor: (teamId: string, color: TeamColor) => void;
  onUpdateTeamLogo: (teamId: string, logo: string) => void;
  
  onUpdatePlayer: (playerId: string, updates: Partial<Player>) => { success: boolean, error?: string, errorKey?: string, errorParams?: any } | void;

  onSaveProfile: (playerId: string, overrides?: { name?: string, number?: string, avatar?: string, skill?: number, role?: PlayerRole }) => { success: boolean, error?: string, errorKey?: string, errorParams?: any } | void;
  onRevertProfile: (playerId: string) => void;
  onAddPlayer: (name: string, target: 'A' | 'B' | 'Queue' | 'A_Reserves' | 'B_Reserves' | string, number?: string, skill?: number, profileId?: string) => { success: boolean, errorKey?: string, errorParams?: any, error?: string };
  onRestorePlayer?: (player: Player, targetId: string, index?: number) => void;
  onUndoRemove: () => void;
  canUndoRemove: boolean;
  onCommitDeletions: () => void;
  deletedCount: number;
  profiles: Map<string, PlayerProfile>;
  deleteProfile?: (id: string) => PlayerProfile | undefined;
  upsertProfile?: (name: string, skill: number, id?: string, extras?: { number?: string, avatar?: string, role?: PlayerRole }) => PlayerProfile;
  relinkProfile?: (profile: PlayerProfile) => void; 
  onSortTeam: (teamId: string, criteria: 'name' | 'number' | 'skill') => void; 
  toggleTeamBench: (teamId: string) => void;
  substitutePlayers: (teamId: string, playerInId: string, playerOutId: string) => void;
  matchLog?: ActionLog[];
  enablePlayerStats?: boolean;
  reorderQueue?: (fromIndex: number, toIndex: number) => void;
  disbandTeam?: (teamId: string) => void;
  restoreTeam?: (team: Team, index: number) => void;
  resetRosters?: () => void;
  
  onShowToast: (msg: string, type: 'success' | 'info' | 'error', subText?: string, icon?: any, onUndo?: () => void) => void;
  
  developerMode?: boolean;
  zIndex?: string; 
}

type EditingTarget = { type: 'player' | 'profile'; id: string };
const SCROLL_EVENT = 'team-manager-scroll';
const dispatchScrollEvent = () => { if (typeof window !== 'undefined') window.dispatchEvent(new Event(SCROLL_EVENT)); };

const RosterBoard = ({ courtA, courtB, queue, onUpdatePlayer, wrappedAdd, handleKnockoutRequest, usedColors, wrappedMove, playerStatsMap, setEditingTarget, setViewingProfileId, handleTogglePlayerMenu, activePlayerMenu, toggleTeamBench, wrappedUpdateColor, wrappedUpdateLogo, substitutePlayers, reorderQueue, handleDisbandTeam, dragOverContainerId, onShowToast, profiles, wrappedSaveProfile, onRequestProfileEdit, activeNumberId, onRequestEditNumber, onUpdateTeamName, courtLimit, benchLimit }: any) => {
    const { t } = useTranslation();
    const [queueSearchTerm, setQueueSearchTerm] = useState('');
    const queueScrollRef = useRef<HTMLDivElement>(null);
    const [highlightedTeamId, setHighlightedTeamId] = useState<string | null>(null);
    const [isAutoScrolling, setIsAutoScrolling] = useState(false);
    const autoScrollDirection = useRef<'left' | 'right' | null>(null);
    const [queuePage, setQueuePage] = useState(1);
    const [canScrollLeft, setCanScrollLeft] = useState(false);
    const [canScrollRight, setCanScrollRight] = useState(false);
    const lastMovedTeamId = useRef<string | null>(null);
    const prevQueueLen = useRef(queue.length);
    const pendingScrollToIndex = useRef<number | null>(null);

    const handleReorderLocal = useCallback((from: number, to: number) => { if (reorderQueue) { const team = queue[from]; if (team) { lastMovedTeamId.current = team.id; } reorderQueue(from, to); pendingScrollToIndex.current = to; } }, [reorderQueue, queue]);

    useEffect(() => { if (!queueSearchTerm.trim()) { setHighlightedTeamId(null); return; } const searchTerm = queueSearchTerm.toLowerCase(); const matchIndex = queue.findIndex((t: Team) => t.name.toLowerCase().includes(searchTerm)); if (matchIndex !== -1) { const teamId = queue[matchIndex].id; setHighlightedTeamId(teamId); if (queueScrollRef.current) { const cardWidth = queueScrollRef.current.firstElementChild?.clientWidth || 300; const scrollPos = matchIndex * (cardWidth + 16); queueScrollRef.current.scrollTo({ left: scrollPos, behavior: 'smooth' }); } } else { setHighlightedTeamId(null); } }, [queueSearchTerm, queue]);

    const checkScroll = useCallback(() => { if (!queueScrollRef.current) return; const { scrollLeft, scrollWidth, clientWidth } = queueScrollRef.current; setCanScrollLeft(scrollLeft > 20); setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 20); const width = clientWidth; if (width > 0) { const page = Math.round(scrollLeft / width) + 1; setQueuePage(page); } dispatchScrollEvent(); }, []);
    const onQueueScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => { checkScroll(); }, [checkScroll]);

    useEffect(() => { checkScroll(); if (queue.length > 1 && queueScrollRef.current) { setTimeout(() => { if (queueScrollRef.current) { queueScrollRef.current.scrollTo({ left: 60, behavior: 'smooth' }); setTimeout(() => { if (queueScrollRef.current) { queueScrollRef.current.scrollTo({ left: 0, behavior: 'smooth' }); } }, 400); } }, 600); } }, [queue.length, checkScroll]);

    const scrollContainer = (direction: 'left' | 'right') => { if (queueScrollRef.current) { const width = 320; const scrollAmount = direction === 'left' ? -width : width; queueScrollRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' }); } };

    useDndMonitor({ onDragStart: () => setIsAutoScrolling(true), onDragEnd: () => { setIsAutoScrolling(false); autoScrollDirection.current = null; }, onDragCancel: () => { setIsAutoScrolling(false); autoScrollDirection.current = null; } });
    useEffect(() => { if (!isAutoScrolling) return; const handleMouseMove = (e: MouseEvent | TouchEvent) => { if (!queueScrollRef.current) return; const rect = queueScrollRef.current.getBoundingClientRect(); const x = (e as MouseEvent).clientX || (e as TouchEvent).touches?.[0]?.clientX || 0; const EDGE_SIZE = 50; const y = (e as MouseEvent).clientY || (e as TouchEvent).touches?.[0]?.clientY || 0; if (y < rect.top || y > rect.bottom) { autoScrollDirection.current = null; return; } if (x < rect.left + EDGE_SIZE) { autoScrollDirection.current = 'left'; } else if (x > rect.right - EDGE_SIZE) { autoScrollDirection.current = 'right'; } else { autoScrollDirection.current = null; } }; window.addEventListener('mousemove', handleMouseMove); window.addEventListener('touchmove', handleMouseMove); const interval = setInterval(() => { if (autoScrollDirection.current && queueScrollRef.current) { const scrollAmount = 10; queueScrollRef.current.scrollBy({ left: autoScrollDirection.current === 'left' ? -scrollAmount : scrollAmount, behavior: 'auto' }); } }, 16); return () => { window.removeEventListener('mousemove', handleMouseMove); window.removeEventListener('touchmove', handleMouseMove); clearInterval(interval); }; }, [isAutoScrolling]);
    
    useEffect(() => { if (lastMovedTeamId.current) { const el = document.getElementById(`queue-card-${lastMovedTeamId.current}`); if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' }); lastMovedTeamId.current = null; pendingScrollToIndex.current = null; } } if (pendingScrollToIndex.current !== null && queueScrollRef.current && !lastMovedTeamId.current) { const targetIndex = pendingScrollToIndex.current; const width = queueScrollRef.current.clientWidth; if (width > 0) { requestAnimationFrame(() => { queueScrollRef.current?.scrollTo({ left: targetIndex * width, behavior: 'smooth' }); setQueuePage(targetIndex + 1); pendingScrollToIndex.current = null; }); } } else if (queue.length > prevQueueLen.current) { requestAnimationFrame(() => { setTimeout(() => { if (queueScrollRef.current) { const scrollLeft = queueScrollRef.current.scrollWidth - queueScrollRef.current.clientWidth; queueScrollRef.current.scrollTo({ left: scrollLeft > 0 ? scrollLeft : 0, behavior: 'smooth' }); checkScroll(); } }, 150); }); } prevQueueLen.current = queue.length; }, [queue.length, queue, checkScroll]);

    return (
        <motion.div variants={staggerContainer} initial="hidden" animate="visible" className="flex flex-col gap-6 landscape:gap-4 pb-24 landscape:pb-8 px-0 w-full pt-2">
            <div className="flex flex-col gap-6 md:gap-4 w-full landscape:grid landscape:grid-cols-2 landscape:gap-4 landscape:overflow-visible flex-shrink-0">
                <motion.div variants={staggerItem} className="w-full flex-1"><RosterColumn id={courtA.id} team={courtA} onUpdatePlayer={onUpdatePlayer} onAddPlayer={wrappedAdd} onKnockoutRequest={handleKnockoutRequest} usedColors={usedColors} onMove={wrappedMove} statsMap={playerStatsMap} onRequestProfileEdit={(pid: string) => setEditingTarget({ type: 'player', id: pid })} onViewProfile={(pid: string) => setViewingProfileId(pid)} onTogglePlayerMenu={handleTogglePlayerMenu} activePlayerMenuId={activePlayerMenu?.playerId || null} profiles={profiles} onUpdateTeamName={onUpdateTeamName} onUpdateTeamColor={wrappedUpdateColor} onUpdateTeamLogo={wrappedUpdateLogo} onSaveProfile={wrappedSaveProfile} onSortTeam={()=>{}} toggleTeamBench={toggleTeamBench} substitutePlayers={substitutePlayers} isDragOver={dragOverContainerId === courtA.id || dragOverContainerId === `${courtA.id}_Reserves`} onShowToast={onShowToast} activeNumberId={activeNumberId} onRequestEditNumber={onRequestEditNumber} maxPlayers={courtLimit} maxBench={benchLimit} /></motion.div>
                <motion.div variants={staggerItem} className="w-full flex-1"><RosterColumn id={courtB.id} team={courtB} onUpdatePlayer={onUpdatePlayer} onAddPlayer={wrappedAdd} onKnockoutRequest={handleKnockoutRequest} usedColors={usedColors} onMove={wrappedMove} statsMap={playerStatsMap} onRequestProfileEdit={(pid: string) => setEditingTarget({ type: 'player', id: pid })} onViewProfile={(pid: string) => setViewingProfileId(pid)} onTogglePlayerMenu={handleTogglePlayerMenu} activePlayerMenuId={activePlayerMenu?.playerId || null} profiles={profiles} onUpdateTeamName={onUpdateTeamName} onUpdateTeamColor={wrappedUpdateColor} onUpdateTeamLogo={wrappedUpdateLogo} onSaveProfile={wrappedSaveProfile} onSortTeam={()=>{}} toggleTeamBench={toggleTeamBench} substitutePlayers={substitutePlayers} isDragOver={dragOverContainerId === courtB.id || dragOverContainerId === `${courtB.id}_Reserves`} onShowToast={onShowToast} activeNumberId={activeNumberId} onRequestEditNumber={onRequestEditNumber} maxPlayers={courtLimit} maxBench={benchLimit} /></motion.div>
            </div>
            
            <motion.div variants={staggerItem} className={`w-full flex flex-col mt-4 relative ${queue.length === 0 ? 'min-h-[200px]' : ''}`}>
                <div className="flex items-center justify-between px-2 mb-3">
                    <div className="flex items-center gap-2"><div className="px-3 py-1 bg-slate-200 dark:bg-white/10 rounded-full text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 flex items-center gap-2"><Layers size={12} /><span>{t('teamManager.queue')}</span><span className="bg-white dark:bg-black/20 px-1.5 rounded text-slate-600 dark:text-slate-300">{queue.length}</span></div>{queue.length > 1 && (<div className="px-3 py-1 rounded-full bg-transparent text-[9px] font-bold text-slate-400 border border-slate-200 dark:border-white/10">{t('common.step', {number: `${queuePage} / ${queue.length}`})}</div>)}</div>
                    <div className="relative group w-32"><Search className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" size={14} /><input value={queueSearchTerm} onChange={(e) => setQueueSearchTerm(e.target.value)} placeholder={t('teamManager.searchQueue')} className="w-full bg-white dark:bg-white/5 border border-slate-200 dark:border-white/5 rounded-xl pl-8 pr-6 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 focus:outline-none focus:border-indigo-500/50 transition-all placeholder:text-slate-400" />{queueSearchTerm && (<button onClick={() => setQueueSearchTerm('')} className="absolute right-1 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 active:scale-90 transition-transform"><X size={12} strokeWidth={3} /></button>)}</div>
                </div>

                <div className="relative group/queue flex-1 min-h-0">
                    <div ref={queueScrollRef} onScroll={onQueueScroll} className="w-full overflow-x-auto snap-x snap-mandatory no-scrollbar flex items-stretch pb-2 gap-6 p-6 mask-linear-fade-sides" style={{ maskImage: 'linear-gradient(to right, transparent, black 5%, black 95%, transparent)', WebkitMaskImage: 'linear-gradient(to right, transparent, black 5%, black 95%, transparent)' }}>
                        {queue.length === 0 ? (
                            <div className="flex-1 flex flex-col items-center justify-center h-full text-slate-400 italic gap-3 min-h-[160px] w-full border border-dashed border-slate-200 dark:border-white/10 rounded-2xl bg-slate-50/50 dark:bg-white/[0.01]"><div className="p-3 bg-slate-100 dark:bg-white/5 rounded-full"><List size={24} className="opacity-30" /></div><div className="flex flex-col items-center gap-1"><span className="text-xs font-bold uppercase tracking-widest opacity-60">{t('teamManager.queueEmpty')}</span><span className="text-[10px] opacity-40">Add teams to rotation</span></div></div>
                        ) : (
                            <AnimatePresence initial={false} mode="popLayout">
                                {queue.map((team: Team, idx: number) => (
                                    <motion.div id={`queue-card-${team.id}`} key={team.id} layout="position" layoutId={`queue-card-${team.id}`} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }} transition={{ type: "spring", stiffness: 60, damping: 15, mass: 1 }} className="snap-center w-80 sm:w-96 flex-shrink-0 h-full flex flex-col"> 
                                        <RosterColumn id={team.id} team={team} profiles={profiles} onUpdateTeamName={onUpdateTeamName} onUpdateTeamColor={wrappedUpdateColor} onUpdateTeamLogo={wrappedUpdateLogo} onSaveProfile={wrappedSaveProfile} onSortTeam={()=>{}} toggleTeamBench={toggleTeamBench} substitutePlayers={()=>{}} onUpdatePlayer={onUpdatePlayer} onAddPlayer={wrappedAdd} onKnockoutRequest={handleKnockoutRequest} usedColors={usedColors} isQueue={true} onMove={wrappedMove} statsMap={playerStatsMap} onRequestProfileEdit={(pid: string) => setEditingTarget({ type: 'player', id: pid })} onViewProfile={(pid: string) => setViewingProfileId(pid)} onTogglePlayerMenu={handleTogglePlayerMenu} activePlayerMenuId={activePlayerMenu?.playerId || null} isNext={idx === 0} onDisband={handleDisbandTeam} onReorder={handleReorderLocal} queueIndex={idx} queueSize={queue.length} isDragOver={dragOverContainerId === team.id || dragOverContainerId === `${team.id}_Reserves`} onShowToast={onShowToast} activeNumberId={activeNumberId} onRequestEditNumber={onRequestEditNumber} highlighted={highlightedTeamId === team.id} maxPlayers={courtLimit} maxBench={benchLimit} />
                                    </motion.div>
                                ))}
                            </AnimatePresence>
                        )}
                    </div>
                    <AnimatePresence>{canScrollLeft && (<motion.button initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} onClick={() => scrollContainer('left')} className="absolute left-2 top-1/2 -translate-y-1/2 z-40 w-9 h-9 flex items-center justify-center rounded-full bg-black/20 dark:bg-white/10 backdrop-blur-md shadow-lg border border-white/10 text-white hover:bg-black/40 dark:hover:bg-white/20 hover:scale-110 transition-transform active:scale-90"><ChevronLeft size={18} strokeWidth={2.5} /></motion.button>)}{canScrollRight && (<motion.button initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }} onClick={() => scrollContainer('right')} className="absolute right-2 top-1/2 -translate-y-1/2 z-40 w-9 h-9 flex items-center justify-center rounded-full bg-black/20 dark:bg-white/10 backdrop-blur-md shadow-lg border border-white/10 text-white hover:bg-black/40 dark:hover:bg-white/20 hover:scale-110 transition-transform active:scale-90"><ChevronRight size={18} strokeWidth={2.5} /></motion.button>)}</AnimatePresence>
                </div>
            </motion.div>
        </motion.div>
    );
};

export const TeamManagerModal: React.FC<TeamManagerModalProps> = memo((props) => {
  const { t } = useTranslation();
  const { activeTutorial, triggerTutorial, completeTutorial, isLoaded } = useTutorial(false, props.developerMode);
  
  // Use Game Context to determine current config mode
  const { state } = useGame();
  const courtLimit = getPlayersOnCourt(state.config.mode);
  const benchLimit = getBenchLimit(state.config.mode);

  if (!props.isOpen) return null;

  useEffect(() => {
      if (isLoaded) {
          triggerTutorial('manager');
      }
  }, [isLoaded, triggerTutorial]);

  const [activeTab, setActiveTab] = useState<'roster' | 'profiles' | 'input'>('roster');
  
  const [activePlayer, setActivePlayer] = useState<Player | null>(null);
  const [activeNumberId, setActiveNumberId] = useState<string | null>(null);
  const validationLockRef = useRef<string | null>(null);
  const [benchConfirmState, setBenchConfirmState] = useState<{ teamId: string; playerId: string; sourceId: string } | null>(null);
  const [activateBenchConfirm, setActivateBenchConfirm] = useState<{ teamId: string; playerId: string; fromId: string } | null>(null);
  const [resetConfirmState, setResetConfirmState] = useState(false);
  const [profileToDeleteId, setProfileToDeleteId] = useState<string | null>(null);
  const [editingTarget, setEditingTarget] = useState<EditingTarget | null>(null);
  const [viewingProfileId, setViewingProfileId] = useState<string | null>(null);
  const [activePlayerMenu, setActivePlayerMenu] = useState<{ playerId: string; rect: DOMRect } | null>(null);
  const [dragOverContainerId, setDragOverContainerId] = useState<string | null>(null);
  const playerMenuRef = useRef<HTMLDivElement>(null);
  const haptics = useHaptics();
  const audio = useGameAudio({ enableSound: true } as any);
  const lastMoveRef = useRef<{ id: string, from: string, to: string, index: number, ts: number } | null>(null);
  
  const [showHeader, setShowHeader] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const lastScrollY = useRef(0);

  const onScroll = useCallback(() => {
      if (!scrollRef.current) return;
      const currentY = scrollRef.current.scrollTop;
      const diff = currentY - lastScrollY.current;

      if (currentY < 0) return;

      if (diff > 10 && showHeader && currentY > 50) { 
          setShowHeader(false);
      } else if (diff < -5 && !showHeader) { 
          setShowHeader(true);
      }
      lastScrollY.current = currentY;
      
      dispatchScrollEvent();
  }, [showHeader]);

  const { onUpdatePlayer, restoreTeam, onRestorePlayer, upsertProfile, deleteProfile, relinkProfile, onShowToast } = props;
  
  const getTeamById = (id: string) => {
      if (id === props.courtA.id || id === `${props.courtA.id}_Reserves`) return props.courtA;
      if (id === props.courtB.id || id === `${props.courtB.id}_Reserves`) return props.courtB;
      const queueId = id.split('_')[0]; 
      return props.queue.find(t => t.id === queueId || t.id === id);
  };

  const playersById = useMemo(() => {
    const map = new Map<string, Player>();
    [props.courtA, props.courtB, ...props.queue].forEach(team => {
        team.players.forEach(p => map.set(p.id, p));
        team.reserves?.forEach(p => map.set(p.id, p));
    });
    return map;
  }, [props.courtA, props.courtB, props.queue]);

  const handleUpdatePlayerWrapper = useCallback((playerId: string, updates: Partial<Player>) => {
      const result = onUpdatePlayer(playerId, updates);
      if (result && result.success === false) {
          validationLockRef.current = playerId; 
          haptics.notification('error');
          onShowToast(
              result.errorKey ? t(result.errorKey, result.errorParams) : t('notifications.numberUnavailable'),
              'error',
              t('validation.uniqueConstraint'),
              'block'
          );
      } else {
          if (validationLockRef.current === playerId) {
              validationLockRef.current = null;
          }
          if (activeNumberId === playerId) {
              setActiveNumberId(null);
          }
      }
      return result;
  }, [onUpdatePlayer, haptics, onShowToast, activeNumberId, t]);

  const handleRequestEditNumber = useCallback((playerId: string) => {
      if (validationLockRef.current && validationLockRef.current !== playerId) {
          haptics.notification('warning');
          onShowToast(t('notifications.finishEditing'), 'info', t('notifications.finishEditingSub'), 'alert');
          return;
      }
      setActiveNumberId(playerId);
  }, [haptics, onShowToast, t]);

  const wrappedUpdateColor = useCallback((id: string, color: TeamColor) => { props.onUpdateTeamColor(id, color); }, [props.onUpdateTeamColor]);
  const wrappedUpdateLogo = useCallback((id: string, logo: string) => { props.onUpdateTeamLogo(id, logo); }, [props.onUpdateTeamLogo]);
  
  const wrappedMove = useCallback((playerId: string, fromId: string, toId: string, newIndex?: number) => { 
      const now = Date.now();
      const idx = newIndex ?? -1;
      if (lastMoveRef.current && lastMoveRef.current.id === playerId && lastMoveRef.current.from === fromId && lastMoveRef.current.to === toId && lastMoveRef.current.index === idx) return;
      if (lastMoveRef.current && (now - lastMoveRef.current.ts < 100)) return;
      lastMoveRef.current = { id: playerId, from: fromId, to: toId, index: idx, ts: now };
      props.onMove(playerId, fromId, toId, newIndex); 
  }, [props.onMove]);

  const wrappedAdd = useCallback((name: string, target: string, number?: string, skill?: number, profileId?: string) => { 
      const result = props.onAddPlayer(name, target, number, skill, profileId);
      if (!result.success) {
          haptics.notification('error');
          onShowToast(
              result.errorKey ? t(result.errorKey, result.errorParams) : (result.error || t('notifications.cannotAdd')),
              'error',
              t('notifications.uniqueConstraint'),
              'block'
          );
      }
      return result;
  }, [props.onAddPlayer, haptics, onShowToast, t]);
  
  const { disbandTeam, reorderQueue, resetRosters, onDeletePlayer } = props;
  
  const wrappedDisband = disbandTeam ? useCallback((id: string) => { 
      const teamToDisband = props.queue.find(t => t.id === id);
      const teamIndex = props.queue.findIndex(t => t.id === id);
      haptics.impact('medium'); audio.playUndo(); disbandTeam(id);
      if (teamToDisband && restoreTeam) {
          onShowToast(t('teamManager.playerRemoved'), 'info', teamToDisband.name, 'delete', () => restoreTeam(teamToDisband, teamIndex));
      }
  }, [disbandTeam, haptics, audio, props.queue, restoreTeam, t, onShowToast]) : undefined;

  const wrappedReorder = reorderQueue ? useCallback((from: number, to: number) => { haptics.impact('light'); audio.playTap(); reorderQueue(from, to); }, [reorderQueue, haptics, audio]) : undefined;

  const handleDeleteWithUndo = useCallback((playerId: string) => {
      let player: Player | undefined;
      const findIn = (list: Player[]) => list.find(p => p.id === playerId);
      player = findIn(props.courtA.players) || findIn(props.courtA.reserves || []) || findIn(props.courtB.players) || findIn(props.courtB.reserves || []) || props.queue.flatMap(t => [...t.players, ...(t.reserves || [])]).find(p => p.id === playerId);
      if (onDeletePlayer) onDeletePlayer(playerId);
      setActivePlayerMenu(null);
      if (player && props.onUndoRemove) onShowToast(t('teamManager.playerRemoved'), 'info', player.name, 'delete', props.onUndoRemove);
  }, [props.courtA, props.courtB, props.queue, onDeletePlayer, props.onUndoRemove, t, onShowToast]);

  const requestProfileDelete = useCallback((profileId: string) => { setProfileToDeleteId(profileId); }, []);

  const executeProfileDelete = useCallback(() => {
      if (!profileToDeleteId) return;
      const profileId = profileToDeleteId;
      if (!deleteProfile) return;
      const deletedProfile = deleteProfile(profileId);
      
      if (deletedProfile && upsertProfile && relinkProfile) {
          const backup = { ...deletedProfile };
          onShowToast(t('teamManager.playerRemoved'), 'info', backup.name, 'delete', () => { 
              const restored = upsertProfile(backup.name, backup.skillLevel, backup.id, { number: backup.number, avatar: backup.avatar, role: backup.role });
              relinkProfile(restored); 
          });
      }
      setProfileToDeleteId(null);
  }, [deleteProfile, upsertProfile, relinkProfile, t, onShowToast, profileToDeleteId]);

  const playerStatsMap = useMemo(() => {
      const map = new Map<string, any>();
      if (props.matchLog) { props.matchLog.forEach((log: any) => { if (log.type === 'POINT' && log.playerId) { const s = map.get(log.playerId) || { k: 0, b: 0, a: 0 }; if (log.skill === 'attack') s.k++; else if (log.skill === 'block') s.b++; else if (log.skill === 'ace') s.a++; map.set(log.playerId, s); } }); }
      return map;
  }, [props.matchLog]);

  const handleTogglePlayerMenu = (playerId: string, targetElement: HTMLElement) => {
    if (activePlayerMenu?.playerId === playerId) setActivePlayerMenu(null);
    else setActivePlayerMenu({ playerId, rect: targetElement.getBoundingClientRect() });
  };

  useEffect(() => {
    const handleClose = (event: MouseEvent) => { if (playerMenuRef.current && playerMenuRef.current.contains(event.target as Node)) return; setActivePlayerMenu(null); };
    const handleScrollClose = () => { setActivePlayerMenu(null); };
    if (activePlayerMenu) { document.addEventListener('mousedown', handleClose); document.addEventListener(SCROLL_EVENT, handleScrollClose); window.addEventListener('scroll', handleScrollClose, { capture: true }); }
    return () => { document.removeEventListener('mousedown', handleClose); document.removeEventListener(SCROLL_EVENT, handleScrollClose); window.removeEventListener('scroll', handleScrollClose, { capture: true }); };
  }, [activePlayerMenu]);

  const handleCloseAttempt = () => { props.onClose(); }; 

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { activationConstraint: { distance: 5 }, delay: 0, tolerance: 5 } }),
    useSensor(KeyboardSensor)
  );

  const handleDragStart = (event: DragStartEvent) => { haptics.impact('light'); setActivePlayer(playersById.get(event.active.id as string) || null); };
  const handleDragOver = (event: DragOverEvent) => { const { over } = event; setDragOverContainerId(over ? (over.data.current?.containerId || over.id) : null); };
  
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActivePlayer(null);
    setDragOverContainerId(null);
    if (!over) return;
    const activeId = active.id as string;
    const sourceContainerId = active.data.current?.fromId;
    let targetContainerId = over.data.current?.containerId || over.data.current?.fromId || over.id;

    if (!sourceContainerId || !targetContainerId) return;

    if (sourceContainerId === targetContainerId) {
        const oldIndex = active.data.current?.sortable?.index;
        const newIndex = over.data.current?.sortable?.index;
        if (oldIndex !== newIndex && newIndex !== undefined) {
            haptics.impact('light');
            wrappedMove(activeId, sourceContainerId, targetContainerId, newIndex);
        }
        return;
    }

    const targetTeamObj = getTeamById(targetContainerId);
    if (!targetTeamObj) return;

    const isTargetReserves = targetContainerId.endsWith('_Reserves');
    const targetList = isTargetReserves ? (targetTeamObj.reserves || []) : targetTeamObj.players;
    
    // DYNAMIC LIMITS
    const targetLimit = isTargetReserves ? benchLimit : courtLimit;
    
    if (targetList.length >= targetLimit) {
        if (!isTargetReserves && targetTeamObj.hasActiveBench && (targetTeamObj.reserves || []).length < benchLimit) {
            haptics.impact('medium');
            wrappedMove(activeId, sourceContainerId, `${targetTeamObj.id}_Reserves`);
            onShowToast(t('teamManager.movedToBench'), 'info', t('teamManager.teamFullSub'));
        } else if (!isTargetReserves && !targetTeamObj.hasActiveBench) {
            setBenchConfirmState({ teamId: targetTeamObj.id, playerId: activeId, sourceId: sourceContainerId });
        } else {
            haptics.notification('error');
            onShowToast(
                isTargetReserves ? t('teamManager.benchFull') : t('teamManager.rosterFull'), 
                'error', 
                isTargetReserves ? t('teamManager.benchFullSub') : t('teamManager.rosterFullSub')
            );
        }
        return;
    }

    haptics.impact('medium');
    const newIndex = over.data.current?.sortable?.index; 
    wrappedMove(activeId, sourceContainerId, targetContainerId, newIndex);
  };


  const usedColors = useMemo(() => {
      const set = new Set<string>();
      if (props.courtA.color) set.add(props.courtA.color);
      if (props.courtB.color) set.add(props.courtB.color);
      props.queue.forEach(t => { if (t.color) set.add(t.color); });
      return set;
  }, [props.courtA.color, props.courtB.color, props.queue]);

  const handleBatchGenerate = (names: string[]) => { props.onGenerate(names); setActiveTab('roster'); haptics.notification('success'); };
  const handleTabChange = (tab: 'roster' | 'profiles' | 'input') => { if (typeof React.startTransition === 'function') { React.startTransition(() => { setActiveTab(tab); }); } else { setActiveTab(tab); } };

  return (
    createPortal(
    <Modal isOpen={props.isOpen} onClose={handleCloseAttempt} title="" showCloseButton={false} variant="fullscreen" zIndex={props.zIndex}>
        {activeTutorial === 'manager' && (
            <RichTutorialModal isOpen={true} tutorialKey="manager" onClose={completeTutorial} />
        )}

        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragOver={handleDragOver} onDragEnd={handleDragEnd}>
            
            <div ref={scrollRef} onScroll={onScroll} className="h-full overflow-y-auto custom-scrollbar w-full max-w-6xl mx-auto render-crisp relative">
                
                <div className="sticky top-0 z-50 pt-safe-top pb-2 px-1 mb-1 pointer-events-none">
                    <motion.div 
                        initial={{ y: 0 }}
                        animate={{ y: showHeader ? 0 : -100, opacity: showHeader ? 1 : 0 }}
                        transition={{ type: "spring", stiffness: 300, damping: 30 }}
                        className="bg-slate-50/70 dark:bg-[#020617]/70 backdrop-blur-xl border-b border-white/20 dark:border-white/10 shadow-sm rounded-b-2xl pb-2 pt-2 px-2 pointer-events-auto"
                    >
                        <div className="flex gap-2 mb-2">
                            <div className="flex flex-1 bg-slate-100 dark:bg-white/5 rounded-2xl p-1 gap-1">
                                <button onClick={() => handleTabChange('roster')} className={`flex-1 py-2 px-2 rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all active:scale-95 ${activeTab === 'roster' ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'}`}>
                                    <List size={14} /> {t('teamManager.tabs.roster')}
                                </button>
                                <button onClick={() => handleTabChange('profiles')} className={`flex-1 py-2 px-2 rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all active:scale-95 ${activeTab === 'profiles' ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'}`}>
                                    <Search size={14} /> {t('teamManager.tabs.profiles')}
                                </button>
                                <button onClick={() => handleTabChange('input')} className={`flex-1 py-2 px-2 rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all active:scale-95 ${activeTab === 'input' ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'}`}>
                                    <ListOrdered size={14} /> {t('teamManager.tabs.batch')}
                                </button>
                            </div>
                            
                            <button 
                                onClick={handleCloseAttempt}
                                className="w-10 flex items-center justify-center bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 rounded-2xl text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-colors active:scale-90"
                            >
                                <X size={20} strokeWidth={2.5} />
                            </button>
                        </div>

                        {activeTab === 'roster' && (
                            <div className="flex justify-between items-center px-1">
                                <div className="flex gap-2">
                                    <button onClick={() => props.onSetRotationMode('standard')} className={`px-3 py-1.5 rounded-xl text-[9px] font-bold uppercase border transition-all active:scale-95 ${props.rotationMode === 'standard' ? 'bg-indigo-500 text-white border-indigo-600 shadow-lg shadow-indigo-500/20' : 'bg-transparent border-slate-200 dark:border-white/10 text-slate-400'}`} title={t('teamManager.modes.standardTooltip')}>{t('teamManager.modes.standard')}</button>
                                    <button onClick={() => props.onSetRotationMode('balanced')} className={`px-3 py-1.5 rounded-xl text-[9px] font-bold uppercase border transition-all active:scale-95 ${props.rotationMode === 'balanced' ? 'bg-emerald-500 text-white border-emerald-600 shadow-lg shadow-emerald-500/20' : 'bg-transparent border-slate-200 dark:border-white/10 text-slate-400'}`} title={t('teamManager.modes.balancedTooltip')}>{t('teamManager.modes.balanced')}</button>
                                </div>
                                
                                <div className={`flex gap-1`}>
                                    {props.canUndoRemove && (
                                        <button onClick={props.onUndoRemove} className="flex items-center justify-center bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 text-slate-600 dark:text-slate-300 rounded-xl px-3 py-1.5 text-[9px] font-bold uppercase transition-colors active:scale-95">
                                            {t('teamManager.undo')}
                                        </button>
                                    )}
                                    <button onClick={() => { haptics.impact('medium'); props.onBalanceTeams(); }} className="flex items-center justify-center gap-1.5 bg-indigo-50 dark:bg-indigo-500/10 hover:bg-indigo-100 dark:hover:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 rounded-xl px-3 py-1.5 text-[9px] font-bold uppercase transition-colors active:scale-95">
                                        {props.rotationMode === 'balanced' ? t('teamManager.actions.globalBalance') : t('teamManager.actions.restoreOrder')}
                                    </button>
                                    {resetRosters && (
                                        <button onClick={() => setResetConfirmState(true)} className="flex items-center justify-center bg-rose-500/10 text-rose-600 dark:text-rose-400 rounded-xl px-3 py-1.5 text-[9px] font-bold uppercase transition-colors hover:bg-rose-500/20 shadow-sm border border-rose-500/20 active:scale-95">
                                            {t('teamManager.sort.reset')}
                                        </button>
                                    )}
                                </div>
                            </div>
                        )}
                    </motion.div>
                </div>

                <div className="relative flex flex-col min-h-0 pt-2">
                    {activeTab === 'roster' && (
                        <div className="px-1 pb-32">
                            <RosterBoard 
                                courtA={props.courtA} courtB={props.courtB} queue={props.queue} 
                                onUpdatePlayer={handleUpdatePlayerWrapper} 
                                wrappedAdd={wrappedAdd} wrappedMove={wrappedMove} wrappedUpdateColor={wrappedUpdateColor} wrappedUpdateLogo={wrappedUpdateLogo} wrappedSaveProfile={props.onSaveProfile}
                                handleKnockoutRequest={handleDeleteWithUndo} usedColors={usedColors} playerStatsMap={playerStatsMap}
                                setEditingTarget={(target: EditingTarget) => setEditingTarget(target)} 
                                setViewingProfileId={setViewingProfileId}
                                handleTogglePlayerMenu={handleTogglePlayerMenu} activePlayerMenu={activePlayerMenu} toggleTeamBench={props.toggleTeamBench} substitutePlayers={props.substitutePlayers} reorderQueue={wrappedReorder} handleDisbandTeam={wrappedDisband} dragOverContainerId={dragOverContainerId} onShowToast={onShowToast} profiles={props.profiles} onRequestProfileEdit={(id: string) => setEditingTarget({ type: 'player', id })}
                                activeNumberId={activeNumberId} onRequestEditNumber={handleRequestEditNumber}
                                onUpdateTeamName={props.onUpdateTeamName}
                                courtLimit={courtLimit}
                                benchLimit={benchLimit}
                            />
                        </div>
                    )}
                    
                    {activeTab === 'profiles' && (
                        <div className="p-2 pb-24 space-y-4">
                            <button onClick={() => setEditingTarget({ type: 'profile', id: 'new' })} className="w-full py-6 border-2 border-dashed border-slate-300 dark:border-white/10 rounded-2xl flex flex-col items-center justify-center gap-2 text-slate-400 hover:text-indigo-500 hover:border-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 transition-all group bg-slate-50/50 dark:bg-white/[0.01] active:scale-95">
                                <div className="p-3 rounded-full bg-slate-100 dark:bg-white/5 group-hover:bg-indigo-500 group-hover:text-white transition-colors"><Plus size={24} /></div>
                                <span className="text-xs font-bold uppercase tracking-widest">{t('profile.create')}</span>
                            </button>
                            
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                {Array.from(props.profiles.values()).length === 0 ? (
                                    <div className="col-span-full flex flex-col items-center justify-center py-20 text-slate-400 italic gap-3 opacity-60">
                                        <p className="text-sm font-medium">{t('teamManager.profiles.empty')}</p>
                                    </div>
                                ) : (
                                    Array.from(props.profiles.values()).map((profile: PlayerProfile) => {
                                        let status: any = null;
                                        let teamColor: TeamColor | undefined = undefined;
                                        
                                        if (props.courtA.players.some(p => p.profileId === profile.id)) { status = 'A'; teamColor = props.courtA.color; }
                                        else if (props.courtA.reserves?.some(p => p.profileId === profile.id)) { status = 'A_Bench'; teamColor = props.courtA.color; }
                                        else if (props.courtB.players.some(p => p.profileId === profile.id)) { status = 'B'; teamColor = props.courtB.color; }
                                        else if (props.courtB.reserves?.some(p => p.profileId === profile.id)) { status = 'B_Bench'; teamColor = props.courtB.color; }
                                        else {
                                            for (const t of props.queue) {
                                                if (t.players.some(p => p.profileId === profile.id)) { status = 'Queue'; teamColor = t.color; break; }
                                                if (t.reserves?.some(p => p.profileId === profile.id)) { status = 'Queue_Bench'; teamColor = t.color; break; }
                                            }
                                        }

                                        const placementOptions: any[] = [];
                                        if (!status) {
                                            if (props.courtA.players.length < courtLimit) placementOptions.push({ label: t('teamManager.actions.addTo') + ' ' + props.courtA.name, targetId: props.courtA.id, type: 'main', teamColor: props.courtA.color });
                                            else if (props.courtA.hasActiveBench && (props.courtA.reserves || []).length < benchLimit) placementOptions.push({ label: t('teamManager.actions.addTo') + ' ' + props.courtA.name + ' (' + t('teamManager.benchLabel') + ')', targetId: `${props.courtA.id}_Reserves`, type: 'bench', teamColor: props.courtA.color });
                                            
                                            if (props.courtB.players.length < courtLimit) placementOptions.push({ label: t('teamManager.actions.addTo') + ' ' + props.courtB.name, targetId: props.courtB.id, type: 'main', teamColor: props.courtB.color });
                                            else if (props.courtB.hasActiveBench && (props.courtB.reserves || []).length < benchLimit) placementOptions.push({ label: t('teamManager.actions.addTo') + ' ' + props.courtB.name + ' (' + t('teamManager.benchLabel') + ')', targetId: `${props.courtB.id}_Reserves`, type: 'bench', teamColor: props.courtB.color });
                                            
                                            placementOptions.push({ label: t('teamManager.actions.addToQueue'), targetId: 'Queue', type: 'queue' });
                                        }

                                        return (
                                            <ProfileCard 
                                                key={profile.id} 
                                                profile={profile} 
                                                onDelete={() => requestProfileDelete(profile.id)}
                                                onAddToGame={(target: string, prof: PlayerProfile) => wrappedAdd(prof.name, target, prof.number, prof.skillLevel, prof.id)}
                                                status={status}
                                                onEdit={() => setEditingTarget({ type: 'profile', id: profile.id })}
                                                placementOptions={placementOptions}
                                                onView={() => setViewingProfileId(profile.id)}
                                                teamColor={teamColor}
                                                onShowToast={onShowToast}
                                            />
                                        );
                                    })
                                )}
                            </div>
                        </div>
                    )}

                    {activeTab === 'input' && <BatchInputSection onGenerate={handleBatchGenerate} />}
                </div>
            </div>
            
            <DragOverlayFixed dropAnimation={{ duration: 250, easing: 'cubic-bezier(0.18, 0.67, 0.6, 1.22)' }}>
                {activePlayer ? (
                    <PlayerCard 
                        player={activePlayer} 
                        locationId="overlay" 
                        onUpdatePlayer={()=>{}} 
                        onSaveProfile={()=>{}} 
                        onRequestProfileEdit={()=>{}} 
                        onViewProfile={()=>{}}
                        onToggleMenu={()=>{}} 
                        isMenuActive={false} 
                        forceDragStyle={true} 
                    />
                ) : null}
            </DragOverlayFixed>
            
             {editingTarget && (
                <ProfileCreationModal 
                    isOpen={true} 
                    onClose={() => setEditingTarget(null)}
                    title={(editingTarget as EditingTarget).id === 'new' ? t('profile.createTitle') : t('profile.editTitle')}
                    initialName={
                        (editingTarget as EditingTarget).type === 'player' 
                            ? playersById.get((editingTarget as EditingTarget).id)?.name || '' 
                            : props.profiles.get((editingTarget as EditingTarget).id)?.name || ''
                    }
                    initialNumber={
                        (editingTarget as EditingTarget).type === 'player' 
                            ? playersById.get((editingTarget as EditingTarget).id)?.number || '' 
                            : props.profiles.get((editingTarget as EditingTarget).id)?.number || ''
                    }
                    initialSkill={
                        (editingTarget as EditingTarget).type === 'player' 
                            ? playersById.get((editingTarget as EditingTarget).id)?.skillLevel 
                            : props.profiles.get((editingTarget as EditingTarget).id)?.skillLevel
                    }
                    initialRole={
                        (editingTarget as EditingTarget).type === 'player' 
                            ? playersById.get((editingTarget as EditingTarget).id)?.role 
                            : props.profiles.get((editingTarget as EditingTarget).id)?.role
                    }
                    onSave={(name: string, num: string, av: string, sk: number, role: PlayerRole) => {
                        const target = editingTarget as EditingTarget;
                        if (!target) return;

                        if (target.type === 'player') {
                            const result = props.onSaveProfile(target.id, { name, number: num, avatar: av, skill: sk, role });
                            if (result && !result.success) {
                                onShowToast(
                                    result.errorKey ? t(result.errorKey) : t('notifications.saveFailed'), 
                                    'error', 
                                    t('notifications.numberConflict')
                                );
                                return; 
                            }
                        } else {
                            props.upsertProfile?.(name, sk, target.id === 'new' ? undefined : target.id, { number: num, avatar: av, role });
                        }
                        setEditingTarget(null);
                    }}
                />
            )}

            {viewingProfileId && (
                <ProfileDetailsModal 
                    isOpen={!!viewingProfileId} 
                    onClose={() => setViewingProfileId(null)}
                    profileId={viewingProfileId}
                    profiles={props.profiles}
                    onEdit={() => { setViewingProfileId(null); setEditingTarget({ type: 'profile', id: viewingProfileId }); }}
                />
            )}
            
            <ConfirmationModal 
                isOpen={!!activateBenchConfirm} 
                onClose={() => setActivateBenchConfirm(null)} 
                title={t('teamManager.activateBenchTitle')}
                message={t('teamManager.activateBenchMsg')}
                confirmLabel={t('teamManager.btnActivateBench')}
                onConfirm={() => {
                    if (activateBenchConfirm) {
                        props.toggleTeamBench(activateBenchConfirm.teamId);
                        wrappedMove(activateBenchConfirm.playerId, activateBenchConfirm.fromId, `${activateBenchConfirm.teamId}_Reserves`);
                    }
                }}
            />

            <ConfirmationModal 
                isOpen={!!benchConfirmState} 
                onClose={() => setBenchConfirmState(null)} 
                title={t('teamManager.activateBenchTitle')}
                message={t('teamManager.activateBenchMsg')}
                confirmLabel={t('teamManager.btnActivateBench')}
                onConfirm={() => {
                    if (benchConfirmState) {
                        props.toggleTeamBench(benchConfirmState.teamId);
                        wrappedMove(benchConfirmState.playerId, benchConfirmState.sourceId, `${benchConfirmState.teamId}_Reserves`);
                    }
                }}
            />

            <ConfirmationModal 
                isOpen={resetConfirmState}
                onClose={() => setResetConfirmState(false)}
                onConfirm={() => {
                    if (resetRosters) resetRosters();
                }}
                title={t('confirm.reset.title')}
                message={t('confirm.reset.message')}
                confirmLabel={t('confirm.reset.confirmButton')}
                icon={X}
            />

            <ConfirmationModal 
                isOpen={!!profileToDeleteId}
                onClose={() => setProfileToDeleteId(null)}
                onConfirm={executeProfileDelete}
                title={t('confirm.deleteProfile')}
                message={t('confirm.deleteProfileMsg')}
                confirmLabel={t('teamManager.menu.delete')}
                icon={X}
            />

            <AnimatePresence>
                {activePlayerMenu && (
                    <PlayerContextMenu 
                        activePlayerMenu={activePlayerMenu}
                        courtA={props.courtA}
                        courtB={props.courtB}
                        queue={props.queue}
                        onToggleFixed={props.onToggleFixed}
                        onRemove={handleDeleteWithUndo}
                        toggleTeamBench={props.toggleTeamBench}
                        onMove={wrappedMove}
                        handleTogglePlayerMenu={handleTogglePlayerMenu}
                        t={t}
                        setActivateBenchConfirm={setActivateBenchConfirm}
                    />
                )}
            </AnimatePresence>

        </DndContext>
    </Modal>,
    document.body
    );
});
