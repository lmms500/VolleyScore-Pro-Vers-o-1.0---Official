import React, { useState, useMemo, useEffect, useCallback, memo, useRef } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Team, Player, RotationMode, PlayerProfile, TeamColor, ActionLog, PlayerRole } from '../../types';
import { calculateTeamStrength } from '../../utils/balanceUtils';
import { Pin, Trash2, Shuffle, Edit2, Plus, Undo2, Ban, Star, Save, RefreshCw, AlertCircle, User, Upload, List, Hash, Users, Layers, Search, X, ListFilter, ArrowDownAZ, ArrowDown01, ArrowUpWideNarrow, LogOut, ChevronRight, ChevronLeft, Armchair, ArrowRightLeft, ArrowUp, MoreVertical, Unlock, RefreshCcw, PlusCircle, ArrowUpCircle, Activity, ArrowDown, Check, ChevronsUp, ChevronUp, ChevronDown, ListOrdered, Hand, Zap, Target, Shield, Info } from 'lucide-react';
import { DndContext, DragEndEvent, DragOverEvent, DragStartEvent, DragOverlay, closestCenter, PointerSensor, useSensor, useSensors, KeyboardSensor, TouchSensor, useDndMonitor, useDroppable, MouseSensor } from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { createPortal } from 'react-dom';
import { useTranslation } from '../../contexts/LanguageContext';
import { TEAM_COLORS, COLOR_KEYS, resolveTheme } from '../../utils/colors';
import { motion, AnimatePresence } from 'framer-motion';
import { SubstitutionModal } from './SubstitutionModal';
import { ProfileCreationModal } from './ProfileCreationModal';
import { ProfileDetailsModal } from './ProfileDetailsModal';
import { ConfirmationModal } from './ConfirmationModal';
import { useHaptics } from '../../hooks/useHaptics';
import { SkillSlider } from '../ui/SkillSlider'; 
import { useGameAudio } from '../../hooks/useGameAudio';
import { PlayerCard } from '../PlayerCard';
import { staggerContainer, staggerItem, liquidSpring } from '../../utils/animations';

const SortableContextFixed = SortableContext as any;
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
  
  // Unified Handler replacing individual update functions
  onUpdatePlayer: (playerId: string, updates: Partial<Player>) => { success: boolean, error?: string } | void;

  onSaveProfile: (playerId: string, overrides?: { name?: string, number?: string, avatar?: string, skill?: number, role?: PlayerRole }) => { success: boolean, error?: string } | void;
  onRevertProfile: (playerId: string) => void;
  // UPDATED: addPlayer now returns result object
  onAddPlayer: (name: string, target: 'A' | 'B' | 'Queue' | 'A_Reserves' | 'B_Reserves' | string, number?: string, skill?: number, existingPlayer?: Player) => { success: boolean, error?: string };
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
  
  // NEW: Parent Toast Handler
  onShowToast: (msg: string, type: 'success' | 'info' | 'error', subText?: string, icon?: any, onUndo?: () => void) => void;
}

type PlayerLocationStatus = 'A' | 'B' | 'Queue' | 'A_Bench' | 'B_Bench' | 'Queue_Bench' | null;

interface PlacementOption {
    label: string;
    targetId: string;
    type: 'main' | 'bench' | 'queue';
    teamColor?: string;
}

interface PlayerStats {
    k: number;
    b: number;
    a: number;
}

type EditingTarget = { type: 'player' | 'profile'; id: string };

const SCROLL_EVENT = 'team-manager-scroll';
const dispatchScrollEvent = () => { if (typeof window !== 'undefined') window.dispatchEvent(new Event(SCROLL_EVENT)); };

// ... (ColorPicker, EditableTitle, AddPlayerInput remain same) ...
const ColorPicker = memo(({ selected, onChange, usedColors }: { selected: TeamColor, onChange: (c: TeamColor) => void, usedColors: Set<string> }) => {
    return (
        <div className="w-full relative z-20 overflow-x-auto overflow-y-visible no-scrollbar touch-pan-x flex items-center py-3" onPointerDown={(e) => e.stopPropagation()} style={{ overscrollBehaviorX: 'contain', maskImage: 'linear-gradient(to right, black 80%, transparent 100%)', WebkitMaskImage: 'linear-gradient(to right, black 80%, transparent 100%)' }}>
            <div className="flex items-center gap-3 px-4 w-max">
                {COLOR_KEYS.map(color => {
                     const isSelected = selected === color;
                     const isTaken = usedColors.has(color) && !isSelected;
                     const theme = TEAM_COLORS[color];
                     return (
                         <button
                            key={color} onClick={(e) => { e.stopPropagation(); !isTaken && onChange(color); }} onPointerDown={(e) => e.stopPropagation()} disabled={isTaken}
                            className={`relative w-8 h-8 rounded-full transition-all duration-300 flex items-center justify-center shrink-0 ${theme.solid} ${isSelected ? 'ring-4 ring-offset-2 ring-offset-slate-100 dark:ring-offset-slate-900 ring-slate-400/50 dark:ring-slate-500/50 shadow-lg scale-110 opacity-100 z-10' : isTaken ? 'opacity-20 grayscale cursor-not-allowed scale-90 border border-black/10' : 'hover:scale-110 opacity-100 cursor-pointer shadow-sm hover:shadow-md'}`}
                         >
                            {isSelected && <motion.div layoutId="selected-color-check" className="w-3 h-3 bg-white rounded-full shadow-sm" transition={{ type: "spring", stiffness: 500, damping: 30 }} />}
                         </button>
                     );
                })}
                <div className="w-6 flex-shrink-0" />
            </div>
        </div>
    );
});

const EditableTitle = memo(({ name, onSave, className, isPlayer }: { name: string; onSave: (val: string) => void; className?: string; isPlayer?: boolean }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [val, setVal] = useState(name);
  const inputRef = React.useRef<HTMLInputElement>(null);
  useEffect(() => { setVal(name); }, [name]);
  useEffect(() => { if(isEditing) inputRef.current?.focus(); }, [isEditing]);
  const save = () => { setIsEditing(false); if(val.trim() && val !== name) onSave(val.trim()); else setVal(name); };
  if(isEditing) return <input ref={inputRef} type="text" className={`bg-transparent text-slate-900 dark:text-white border-b border-indigo-500 outline-none w-full px-0 py-0 font-bold ${isPlayer ? 'text-sm' : 'text-xs uppercase tracking-widest'}`} value={val} onChange={e => setVal(e.target.value)} onBlur={save} onKeyDown={e => { if(e.key === 'Enter') save(); if(e.key === 'Escape') setIsEditing(false); }} onPointerDown={e => e.stopPropagation()} />;
  return <div className={`flex items-center gap-2 group cursor-pointer min-w-0 ${className}`} onClick={() => setIsEditing(true)}><span className="truncate">{name}</span><Edit2 size={8} className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-400 flex-shrink-0" /></div>;
});

const AddPlayerInput = memo(({ onAdd, disabled, customLabel }: { onAdd: (name: string, number?: string, skill?: number) => void; disabled?: boolean; customLabel?: string }) => {
    const { t } = useTranslation();
    const [isOpen, setIsOpen] = useState(false);
    const [name, setName] = useState('');
    const [number, setNumber] = useState('');
    const [skill, setSkill] = useState(5);
    const inputRef = React.useRef<HTMLInputElement>(null);
    const containerRef = React.useRef<HTMLDivElement>(null);

    useEffect(() => { if(isOpen) inputRef.current?.focus(); }, [isOpen]);

    useEffect(() => {
        if (!isOpen) return;
        const handleClickOutside = (event: MouseEvent | TouchEvent) => { if (containerRef.current && !containerRef.current.contains(event.target as Node)) { setIsOpen(false); } };
        const handleScroll = () => { if (isOpen) setIsOpen(false); };
        document.addEventListener('mousedown', handleClickOutside); document.addEventListener('touchstart', handleClickOutside); window.addEventListener(SCROLL_EVENT, handleScroll); window.addEventListener('scroll', handleScroll, { capture: true });
        return () => { document.removeEventListener('mousedown', handleClickOutside); document.removeEventListener('touchstart', handleClickOutside); window.removeEventListener(SCROLL_EVENT, handleScroll); window.removeEventListener('scroll', handleScroll, { capture: true }); };
    }, [isOpen]);

    const submit = () => { if(name.trim()) { onAdd(name.trim(), number.trim() || undefined, skill); setName(''); setNumber(''); setSkill(5); } inputRef.current?.focus(); };
    
    if (isOpen && !disabled) {
        return (
            <div ref={containerRef} className="flex flex-col mt-2 animate-in fade-in slide-in-from-top-1 bg-white/60 dark:bg-white/[0.04] p-2 rounded-xl border border-black/5 dark:border-white/5 shadow-sm ring-1 ring-black/5">
                <input ref={inputRef} className="w-full bg-transparent border-b border-black/10 dark:border-white/10 px-2 py-2 text-sm text-slate-800 dark:text-white focus:outline-none font-bold placeholder:text-slate-400 mb-2" placeholder={t('teamManager.addPlayerPlaceholder')} value={name} onChange={e => setName(e.target.value)} onKeyDown={e => { if(e.key === 'Enter') submit(); if(e.key === 'Escape') setIsOpen(false); }} />
                <div className="flex items-center gap-2">
                    <input type="tel" className="w-16 text-center bg-white/50 dark:bg-black/20 rounded-lg border border-transparent focus:border-indigo-500 focus:bg-white dark:focus:bg-black/40 px-1 py-1.5 text-xs font-black text-slate-700 dark:text-slate-300 outline-none" placeholder="#" value={number} onChange={e => setNumber(e.target.value)} maxLength={3} />
                    <div className="flex-1 flex items-center justify-center bg-white/30 dark:bg-white/5 rounded-lg px-2 py-1"><SkillSlider level={skill} onChange={setSkill} /></div>
                    <button onClick={submit} className="p-2 bg-indigo-500 rounded-lg hover:bg-indigo-400 text-white shadow-md active:scale-95 transition-transform"><Plus size={18} /></button>
                </div>
            </div>
        );
    }
    const labelContent = customLabel || t('common.add');
    const isBenchLabel = customLabel?.toLowerCase().includes('bench') || customLabel?.toLowerCase().includes('reserve') || customLabel?.toLowerCase().includes('banco');
    return <button onClick={() => !disabled && setIsOpen(true)} disabled={disabled} className={`mt-2 w-full py-3 flex items-center justify-center gap-2 text-[10px] font-bold uppercase tracking-widest rounded-xl border border-dashed transition-all ${disabled ? 'border-slate-200 dark:border-slate-800 text-slate-400 cursor-not-allowed' : 'border-slate-300 dark:border-slate-700 text-slate-400 hover:text-indigo-600 hover:border-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-500/10'}`} >{disabled ? <><Ban size={14} /> {t('common.full')}</> : <>{isBenchLabel ? <Armchair size={14} className="text-emerald-500" /> : <Plus size={14} />} {labelContent}</>}</button>;
});

const TeamColumn = memo(({ id, team, profiles, onUpdateTeamName, onUpdateTeamColor, onUpdatePlayer, onSaveProfile, onAddPlayer, onKnockoutRequest, usedColors, isQueue = false, onMove, toggleTeamBench, substitutePlayers, statsMap, onRequestProfileEdit, onViewProfile, onTogglePlayerMenu, activePlayerMenuId, isNext = false, onDisband, onReorder, queueIndex, queueSize, isDragOver, onShowToast, activeNumberId, onRequestEditNumber }: any) => {
  const { t } = useTranslation();
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [viewMode, setViewMode] = useState<'main' | 'reserves'>('main'); 
  const [isSubModalOpen, setIsSubModalOpen] = useState(false);
  const [sortConfig, setSortConfig] = useState<{ criteria: 'name' | 'number' | 'skill' | 'original', direction: 'asc' | 'desc' }>({ criteria: 'original', direction: 'asc' });
  const colorConfig = resolveTheme(team.color);

  const listId = viewMode === 'main' ? id : `${id}_Reserves`;

  const { setNodeRef: droppableRef } = useDroppable({ id: listId, data: { type: 'container', containerId: listId } });

  useEffect(() => { if (!team.hasActiveBench && viewMode === 'reserves') setViewMode('main'); }, [team.hasActiveBench]);

  const rawPlayers = viewMode === 'main' ? team.players : (team.reserves || []);
  
  const displayedPlayers = useMemo(() => {
      let sorted = [...rawPlayers];
      if (sortConfig.criteria === 'original') return sorted;
      sorted.sort((a, b) => {
          let valA: any = a[sortConfig.criteria as keyof Player] || '';
          let valB: any = b[sortConfig.criteria as keyof Player] || '';
          if (sortConfig.criteria === 'skill') { valA = a.skillLevel; valB = b.skillLevel; }
          if (sortConfig.criteria === 'number') { valA = parseInt(a.number || '0'); valB = parseInt(b.number || '0'); }
          if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
          if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
          return 0;
      });
      return sorted;
  }, [rawPlayers, sortConfig]);

  const mainRosterFull = team.players.length >= 6;
  const reservesFull = (team.reserves || []).length >= 6;
  const isFull = viewMode === 'main' ? (mainRosterFull && reservesFull) : reservesFull; 
  
  const handleUpdateName = useCallback((n: string) => onUpdateTeamName(id, n), [onUpdateTeamName, id]);
  const handleUpdateColor = useCallback((c: TeamColor) => onUpdateTeamColor(id, c), [onUpdateTeamColor, id]);
  const toggleView = () => setViewMode(prev => prev === 'main' ? 'reserves' : 'main');
  
  const handleAdd = useCallback((n: string, num?: string, s?: number) => { 
      const result = onAddPlayer(n, viewMode === 'main' ? id : `${id}_Reserves`, num, s); 
      if (!result.success) {
          onShowToast(result.error || "Cannot add player.", 'error');
      }
  }, [onAddPlayer, id, viewMode, onShowToast]);

  const handleSubstitution = (pIn: string, pOut: string) => { substitutePlayers(id, pIn, pOut); };
  const applySort = (criteria: any) => { setSortConfig(prev => ({ criteria, direction: prev.criteria === criteria && prev.direction === 'asc' ? 'desc' : 'asc' })); setShowSortMenu(false); };

  const bgClass = viewMode === 'reserves' ? 'bg-slate-200/50 dark:bg-white/[0.05] border-dashed border-slate-300 dark:border-white/10' : `bg-white/40 dark:bg-[#0f172a]/60 bg-gradient-to-b ${colorConfig.gradient} ${colorConfig.border} shadow-xl shadow-black/5`;
  let addButtonLabel = viewMode === 'reserves' ? t('teamManager.benchLabel') : (mainRosterFull ? t('teamManager.benchLabel') : t('common.add'));
  const teamStrength = calculateTeamStrength(team.players);

  let ringColor = "", dropBg = "";
  if (isDragOver) {
      if (!isQueue) {
          const currentCount = rawPlayers.length;
          if (currentCount >= 6) {
              if (viewMode === 'main' && team.hasActiveBench && (team.reserves || []).length < 6) { ringColor = "ring-amber-400"; dropBg = "bg-amber-400/10"; } 
              else { ringColor = "ring-rose-500"; dropBg = "bg-rose-500/10"; }
          } else { ringColor = "ring-emerald-400"; dropBg = "bg-emerald-400/10"; }
      } else { ringColor = "ring-indigo-400"; dropBg = "bg-indigo-400/10"; }
  }
  const finalRing = ringColor || colorConfig.ring;

  let queueBadge = null;
  if (isQueue && typeof queueIndex === 'number') {
      const pos = queueIndex + 1;
      let badgeColor = 'bg-slate-200 text-slate-600 dark:bg-white/10 dark:text-slate-300';
      let icon = <ListOrdered size={10} strokeWidth={3} />;
      let text = `${pos}º`;

      if (pos === 1) { badgeColor = 'bg-amber-500 text-amber-950 shadow-lg shadow-amber-500/20'; icon = <ArrowUpCircle size={10} strokeWidth={3} />; text = "NEXT UP"; } 
      else if (pos === 2) { badgeColor = 'bg-slate-400 text-white shadow-sm'; text = "2º"; } 
      else if (pos === 3) { text = "3º"; }

      queueBadge = <div className={`absolute -top-3 left-1.5 px-3 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest z-10 flex items-center gap-1 ${badgeColor}`}>{icon} {text}</div>;
  }

  return (
    <div ref={droppableRef} className={`flex flex-col w-full h-full rounded-2xl border backdrop-blur-2xl relative transition-all duration-200 ${isQueue ? 'p-1.5 bg-white/30 dark:bg-white/[0.02] border-slate-200/50 dark:border-white/5' : `p-3 ${bgClass}`} ${isDragOver ? `ring-4 ${finalRing} ring-opacity-50 scale-[1.01] ${dropBg} z-20` : (isQueue ? '' : 'hover:border-black/10 dark:hover:border-white/20')} ${(isQueue && queueIndex === 0) ? 'ring-2 ring-amber-500/50 dark:ring-amber-500/40 ring-offset-2 ring-offset-slate-100 dark:ring-offset-slate-900 shadow-2xl shadow-amber-500/10' : ''}`} >
      {queueBadge}
      <SubstitutionModal isOpen={isSubModalOpen} onClose={() => setIsSubModalOpen(false)} team={team} onConfirm={handleSubstitution} />
      <div className="flex flex-col mb-1">
        <div className="flex items-center justify-between gap-3 border-b border-black/5 dark:border-white/5 pb-2 mb-1">
            <div className={`w-1 h-8 self-center rounded-full ${colorConfig.halo} shadow-[0_0_10px_currentColor] opacity-90`} />
            <div className="flex-1 min-w-0">
                <span className={`text-[10px] font-bold uppercase tracking-widest opacity-70 ${colorConfig.text}`}>{isQueue ? t('teamManager.queue') : (viewMode === 'reserves' ? t('teamManager.benchLabel') : t('teamManager.teamLabel'))}</span>
                <EditableTitle name={team.name} onSave={handleUpdateName} className={`text-base font-black uppercase tracking-tight ${colorConfig.text} ${colorConfig.textDark}`} />
            </div>
            <div className="flex flex-col items-end gap-1.5">
                <div className="flex items-center gap-1">
                    <button onClick={(e) => { e.stopPropagation(); toggleTeamBench(id); }} onPointerDown={(e) => e.stopPropagation()} className={`p-1.5 rounded-xl border border-transparent transition-all ${team.hasActiveBench ? 'bg-emerald-500 text-white shadow-sm' : 'bg-black/5 dark:bg-white/10 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'}`} title={team.hasActiveBench ? "Deactivate Bench" : "Activate Bench (Reserves)"}><Armchair size={16} fill={team.hasActiveBench ? 'currentColor' : 'none'} /></button>
                    <div className="relative">
                        <button onClick={() => setShowSortMenu(!showSortMenu)} className={`p-1.5 rounded-xl border border-transparent hover:border-black/5 dark:hover:border-white/5 hover:bg-black/5 dark:hover:bg-white/10 ${showSortMenu ? 'bg-black/5 dark:bg-white/10' : ''}`}>{isQueue ? <MoreVertical size={16} className={`${colorConfig.text}`} /> : <ListFilter size={16} className={`${colorConfig.text}`} />}</button>
                        <AnimatePresence>{showSortMenu && (<motion.div initial={{ opacity: 0, y: 5, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 5, scale: 0.95 }} className="absolute right-0 top-full mt-2 z-50 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-black/5 dark:border-white/10 p-1 flex flex-col min-w-[160px]">{isQueue && onDisband && onReorder && queueIndex !== undefined && queueSize !== undefined ? (<><span className="text-[9px] font-bold text-slate-400 px-3 py-1.5 uppercase tracking-widest">{t('teamManager.queueActions.title')}</span>{queueIndex >= 1 && (<button onClick={(e) => { e.stopPropagation(); onReorder(queueIndex, 0); setShowSortMenu(false); }} className="flex items-center gap-2 px-3 py-2 text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 rounded-lg text-left w-full"><ChevronsUp size={14} /> {t('teamManager.queueActions.moveToTop')}</button>)}{queueIndex >= 1 && queueIndex !== 1 && (<button onClick={(e) => { e.stopPropagation(); onReorder(queueIndex, queueIndex - 1); setShowSortMenu(false); }} className="flex items-center gap-2 px-3 py-2 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 rounded-lg text-left w-full"><ChevronUp size={14} /> {t('teamManager.queueActions.moveUp')}</button>)}{queueIndex < queueSize - 1 && (<button onClick={(e) => { e.stopPropagation(); onReorder(queueIndex, queueIndex + 1); setShowSortMenu(false); }} className="flex items-center gap-2 px-3 py-2 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 rounded-lg text-left w-full"><ChevronDown size={14} /> {t('teamManager.queueActions.moveDown')}</button>)}<div className="h-px bg-black/5 dark:bg-white/5 my-1" /><button onClick={() => { onDisband(id); setShowSortMenu(false); }} className="flex items-center gap-2 px-3 py-2 text-xs font-bold text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-lg text-left w-full"><Trash2 size={14} /> {t('teamManager.queueActions.disband')}</button></>) : (<><span className="text-[10px] font-bold text-slate-400 px-3 py-1.5 uppercase tracking-widest">{t('teamManager.sort.label')}</span><button onClick={() => applySort('name')} className="flex items-center justify-center px-3 py-2 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 rounded-lg text-left"><div className="flex items-center gap-2"><ArrowDownAZ size={14} /> {t('teamManager.sort.name')}</div>{sortConfig.criteria === 'name' && <span className="text-[10px]">{sortConfig.direction === 'asc' ? t('teamManager.sort.asc') : t('teamManager.sort.desc')}</span>}</button><button onClick={() => applySort('number')} className="flex items-center justify-between px-3 py-2 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 rounded-lg text-left"><div className="flex items-center gap-2"><ArrowDown01 size={14} /> {t('teamManager.sort.number')}</div>{sortConfig.criteria === 'number' && <span className="text-[10px]">{sortConfig.direction === 'asc' ? t('teamManager.sort.asc') : t('teamManager.sort.desc')}</span>}</button><button onClick={() => applySort('skill')} className="flex items-center justify-between px-3 py-2 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 rounded-lg text-left"><div className="flex items-center gap-2"><ArrowUpWideNarrow size={14} /> {t('teamManager.sort.skill')}</div>{sortConfig.criteria === 'skill' && <span className="text-[10px]">{sortConfig.direction === 'asc' ? t('teamManager.sort.asc') : t('teamManager.sort.desc')}</span>}</button><div className="h-px bg-black/5 dark:bg-white/5 my-1" /><button onClick={() => applySort('original')} className="flex items-center gap-2 px-3 py-2 text-xs font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-white/5 rounded-lg text-left"><RefreshCcw size={14} /> {t('teamManager.sort.reset')}</button></>)}</motion.div>)}</AnimatePresence>
                    </div>
                </div>
                <div className="flex gap-1">
                    <div className={`px-2 py-0.5 rounded-md text-[10px] font-bold border flex items-center gap-1 shadow-sm text-white ${colorConfig.bg} ${colorConfig.border}`}><Users size={10} strokeWidth={2.5} /> {displayedPlayers.length}</div>
                    <div className={`px-2 py-0.5 rounded-md text-[10px] font-bold border flex items-center gap-1 shadow-sm ${colorConfig.bg.replace('/20', '/40')} ${colorConfig.border} dark:text-white dark:border-white/20 text-slate-700`} title="Avg Team Skill"><Activity size={10} strokeWidth={2.5} /> {teamStrength}</div>
                </div>
            </div>
        </div>
        {viewMode === 'main' && <ColorPicker selected={team.color || 'slate'} onChange={handleUpdateColor} usedColors={usedColors} />}
      </div>
      {team.hasActiveBench && (<div className="flex justify-end mb-2 gap-2"><button onClick={() => setIsSubModalOpen(true)} className={`flex items-center justify-center p-2 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all bg-white/50 dark:bg-white/5 border border-black/5 dark:border-white/5 text-slate-500 hover:text-indigo-500`} title="Substitute Player"><ArrowRightLeft size={18} /></button><button onClick={toggleView} className={`flex items-center gap-1 px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all ${viewMode === 'reserves' ? 'bg-amber-500 text-white shadow-md' : 'bg-black/5 dark:bg-white/5 text-slate-500 hover:bg-black/10 dark:hover:bg-white/10'}`}>{viewMode === 'reserves' ? <ChevronLeft size={14} /> : null}{viewMode === 'reserves' ? t('common.back') : t('teamManager.benchLabel')}{viewMode === 'main' ? <ChevronRight size={14} /> : null}</button></div>)}
      
      <motion.div variants={staggerContainer} initial="hidden" animate="visible" className={`flex-1 space-y-1.5 mt-1 overflow-y-auto custom-scrollbar ${isQueue ? 'min-h-[40px]' : 'min-h-[60px]'}`} onScroll={dispatchScrollEvent}>
        {displayedPlayers.length === 0 && <span className="text-[10px] text-slate-400 italic py-6 block text-center border-2 border-dashed border-slate-200 dark:border-white/5 rounded-xl bg-slate-50/50 dark:bg-white/[0.01]">{viewMode === 'reserves' ? t('common.empty') : t('teamManager.dragPlayersHere')}</span>}
        <SortableContextFixed items={displayedPlayers.map(p => p.id)} strategy={verticalListSortingStrategy}>
          <AnimatePresence initial={false}>
            {displayedPlayers.map(p => (
                <motion.div key={p.id} variants={staggerItem} layout>
                    <PlayerCard 
                        player={p} 
                        locationId={listId} 
                        profile={p.profileId ? profiles.get(p.profileId) : undefined} 
                        onUpdatePlayer={onUpdatePlayer}
                        onSaveProfile={onSaveProfile} 
                        onRequestProfileEdit={(pid) => onRequestProfileEdit(pid)} 
                        onViewProfile={(pid) => onViewProfile(pid)}
                        isCompact={viewMode === 'reserves' || (window.innerWidth < 640 && !isQueue)} 
                        onToggleMenu={onTogglePlayerMenu} 
                        isMenuActive={activePlayerMenuId === p.id} 
                        onShowToast={onShowToast} 
                        activeNumberId={activeNumberId}
                        onRequestEditNumber={onRequestEditNumber}
                    />
                </motion.div>
            ))}
          </AnimatePresence>
        </SortableContextFixed>
      </motion.div>
      <AddPlayerInput onAdd={handleAdd} disabled={isFull} customLabel={addButtonLabel} />
    </div>
  );
}, (prev, next) => prev.team === next.team && prev.profiles === next.profiles && prev.usedColors === next.usedColors && prev.isQueue === next.isQueue && prev.activePlayerMenuId === next.activePlayerMenuId && prev.isNext === next.isNext && prev.queueIndex === next.queueIndex && prev.queueSize === next.queueSize && prev.isDragOver === next.isDragOver && prev.activeNumberId === next.activeNumberId && prev.onUpdatePlayer === next.onUpdatePlayer && prev.onShowToast === next.onShowToast);

// ... (ProfileCard, BatchInputSection remain same) ...
const ProfileCard = memo(({ profile, onDelete, onAddToGame, status, onEdit, placementOptions, onView, teamColor, onShowToast }: { profile: PlayerProfile; onDelete: () => void; onAddToGame: (target: string) => { success: boolean, error?: string }; status: PlayerLocationStatus; onEdit: () => void; placementOptions: PlacementOption[]; onView: () => void; teamColor?: TeamColor; onShowToast: (msg: string, type: any, undo?: any) => void }) => {
    const [showJoinMenu, setShowJoinMenu] = useState(false);
    const [menuPos, setMenuPos] = useState<{top: number, left: number, width: number} | null>(null);
    const joinButtonRef = useRef<HTMLButtonElement>(null);
    const menuRef = useRef<HTMLDivElement>(null);
    const { t } = useTranslation();

    useEffect(() => {
        if (!showJoinMenu) return;
        const handleInteraction = (event: Event) => { if ((joinButtonRef.current && joinButtonRef.current.contains(event.target as Node)) || (menuRef.current && menuRef.current.contains(event.target as Node))) return; setShowJoinMenu(false); };
        document.addEventListener('mousedown', handleInteraction); document.addEventListener(SCROLL_EVENT, handleInteraction); window.addEventListener('scroll', handleInteraction, { capture: true });
        return () => { document.removeEventListener('mousedown', handleInteraction); document.removeEventListener(SCROLL_EVENT, handleInteraction); window.removeEventListener('scroll', handleInteraction, { capture: true }); };
    }, [showJoinMenu]);
    
    const handleToggleJoinMenu = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (showJoinMenu) { setShowJoinMenu(false); } else if (joinButtonRef.current) { const rect = joinButtonRef.current.getBoundingClientRect(); const optionHeight = 44; const estimatedMenuHeight = (placementOptions.length * optionHeight) + 16; const spaceBelow = window.innerHeight - rect.bottom; let top = rect.bottom + 4; if (spaceBelow < estimatedMenuHeight) { top = rect.top - estimatedMenuHeight - 4; } setMenuPos({ top, left: rect.left, width: rect.width }); setShowJoinMenu(true); }
    };
    
    const handleAddClick = (targetId: string) => {
        const res = onAddToGame(targetId);
        if (!res.success) {
            onShowToast(res.error || "Failed to add player", 'error');
        }
        setShowJoinMenu(false);
    };

    const handleDelete = (e: React.MouseEvent) => {
        e.stopPropagation();
        onDelete();
    };

    const activeRole = profile.role || 'none';
    let RoleIcon = null;
    let roleColor = "";
    
    if (activeRole === 'setter') { RoleIcon = Hand; roleColor = "text-amber-500"; }
    else if (activeRole === 'hitter') { RoleIcon = Zap; roleColor = "text-rose-500"; }
    else if (activeRole === 'middle') { RoleIcon = Target; roleColor = "text-indigo-500"; }
    else if (activeRole === 'libero') { RoleIcon = Shield; roleColor = "text-emerald-500"; }

    const statusLabels: Record<string, string> = { 'A': t('teamManager.location.courtA'), 'B': t('teamManager.location.courtB'), 'Queue': t('teamManager.location.queue'), 'A_Bench': t('teamManager.benchLabel'), 'B_Bench': t('teamManager.benchLabel'), 'Queue_Bench': 'Q-Bench' };
    
    const teamTheme = teamColor ? resolveTheme(teamColor) : null;
    const cardBg = teamTheme ? `${teamTheme.bg.replace('/20', '/10')} dark:${teamTheme.bg.replace('/20', '/20')} border-${teamColor}-200 dark:border-${teamColor}-500/30` : 'bg-white dark:bg-white/5 border-slate-200 dark:border-white/10 hover:border-slate-300 dark:hover:border-white/20';
    const highlightRing = teamTheme ? `ring-1 ring-${teamColor}-500/30` : '';

    return (<motion.div variants={staggerItem} className={`relative p-3 rounded-xl border transition-all ${cardBg} ${highlightRing}`}>{status && (<div className={`absolute top-2 right-2 px-2 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wider border shadow-sm ${teamTheme ? `${teamTheme.bg} ${teamTheme.textDark} ${teamTheme.border}` : 'bg-slate-100 text-slate-600'}`}>{statusLabels[status] || status}</div>)}<div className="flex items-center gap-3 mb-2 cursor-pointer group/card" onClick={onView}><div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-black/20 flex items-center justify-center text-xl shadow-inner group-hover/card:scale-105 transition-transform">{profile.avatar || '👤'}</div><div className="flex-1 min-w-0"><div className="flex items-center gap-2"><h4 className="font-bold text-slate-800 dark:text-slate-200 truncate text-sm group-hover/card:text-indigo-600 dark:group-hover/card:text-indigo-400 transition-colors">{profile.name}</h4>{RoleIcon && <RoleIcon size={12} className={roleColor} strokeWidth={2.5} />}{profile.number && <span className="text-[10px] font-mono text-slate-400">#{profile.number}</span>}</div><div className="flex items-center gap-1 mt-1"><Star size={10} className="text-amber-400 fill-amber-400" /><span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">{t('profile.skillLevel')} {profile.skillLevel}</span></div></div></div><div className="flex gap-2 mt-3">{!status ? (<button ref={joinButtonRef} onClick={handleToggleJoinMenu} className="flex-1 flex items-center justify-center gap-2 py-1.5 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-500/10 dark:hover:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 rounded-lg text-[10px] font-bold uppercase tracking-wider border border-indigo-200 dark:border-indigo-500/20 transition-colors"><PlusCircle size={12} /> {t('teamManager.profiles.assign')}</button>) : (<div className="flex-1 flex items-center justify-center py-1.5 text-[10px] font-bold text-slate-400 italic">{t('teamManager.profiles.inGame')}</div>)}<button onClick={onEdit} className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors rounded-lg hover:bg-black/5 dark:hover:bg-white/5"><Edit2 size={14} /></button><button onClick={handleDelete} className="p-1.5 text-slate-400 hover:text-rose-500 transition-colors rounded-lg hover:bg-rose-50 dark:hover:bg-rose-500/10"><Trash2 size={14} /></button></div>{showJoinMenu && menuPos && createPortal(<div className="fixed z-[9999]" style={{ top: menuPos.top, left: menuPos.left, width: menuPos.width }}><motion.div ref={menuRef} initial={{ opacity: 0, y: 5, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 5, scale: 0.95 }} className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-black/10 dark:border-white/10 overflow-hidden flex flex-col p-1 max-h-48 overflow-y-auto custom-scrollbar">{placementOptions.map(opt => (<button key={opt.targetId} onClick={() => handleAddClick(opt.targetId)} className="w-full text-left px-3 py-2 text-[10px] font-bold uppercase tracking-wide hover:bg-slate-100 dark:hover:bg-white/10 rounded-lg text-slate-600 dark:text-slate-300 truncate flex items-center gap-2">{opt.teamColor && <div className={`w-2 h-2 rounded-full ${resolveTheme(opt.teamColor).halo}`} />}{opt.label}</button>))}</motion.div></div>, document.body)}</motion.div>);
});

const BatchInputSection = memo(({ onGenerate }: { onGenerate: (names: string[]) => void }) => {
    const { t } = useTranslation();
    const [rawNames, setRawNames] = useState('');
    const handleGenerate = () => { const names = rawNames.split('\n').map(n => n.trim()).filter(n => n); if (names.length > 0) { onGenerate(names); setRawNames(''); } };
    return (<div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 px-1 pb-10 pt-4"> <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 flex items-start gap-2 text-xs text-amber-700 dark:text-amber-400"><AlertCircle size={16} className="mt-0.5 flex-shrink-0" /><div><p className="font-bold mb-1">{t('teamManager.batch.tipTitle')}</p><p><code>{t('teamManager.batch.tipFormat')}</code></p><p className="opacity-80 mt-1">{t('teamManager.batch.tipDesc')}</p></div></div><textarea className="w-full h-64 bg-white/50 dark:bg-black/40 border border-slate-200 dark:border-white/10 rounded-xl p-4 text-slate-800 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 font-mono text-sm resize-none custom-scrollbar" placeholder={t('teamManager.batch.placeholder')} value={rawNames} onChange={e => setRawNames(e.target.value)} /><Button onClick={handleGenerate} className="w-full" size="lg"><Shuffle size={18} /> {t('teamManager.generateTeams')}</Button></div>);
});

const RosterBoard = ({ courtA, courtB, queue, onUpdatePlayer, wrappedAdd, handleKnockoutRequest, usedColors, wrappedMove, playerStatsMap, setEditingTarget, setViewingProfileId, handleTogglePlayerMenu, activePlayerMenu, toggleTeamBench, wrappedUpdateColor, substitutePlayers, reorderQueue, handleDisbandTeam, dragOverContainerId, onShowToast, profiles, wrappedSaveProfile, onRequestProfileEdit, activeNumberId, onRequestEditNumber }: any) => {
    const { t } = useTranslation();
    const [queueSearchTerm, setQueueSearchTerm] = useState('');
    const queueScrollRef = useRef<HTMLDivElement>(null);
    const [isAutoScrolling, setIsAutoScrolling] = useState(false);
    const autoScrollDirection = useRef<'left' | 'right' | null>(null);
    const [queuePage, setQueuePage] = useState(1);
    
    const prevQueueLen = useRef(queue.length);
    const pendingScrollToIndex = useRef<number | null>(null);

    const handleReorderLocal = useCallback((from: number, to: number) => {
        if (reorderQueue) {
            reorderQueue(from, to);
            pendingScrollToIndex.current = to;
        }
    }, [reorderQueue]);

    const filteredQueue = useMemo(() => { if (!queueSearchTerm.trim()) return queue; return queue.filter((t: any) => t.name.toLowerCase().includes(queueSearchTerm.toLowerCase())); }, [queue, queueSearchTerm]);
    const handleScrollQueue = (direction: 'left' | 'right') => { if (queueScrollRef.current) { const cardWidth = queueScrollRef.current.clientWidth; const currentScroll = queueScrollRef.current.scrollLeft; queueScrollRef.current.scrollTo({ left: direction === 'left' ? currentScroll - cardWidth : currentScroll + cardWidth, behavior: 'smooth' }); } };
    const onQueueScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => { dispatchScrollEvent(); if (!e.currentTarget) return; const width = e.currentTarget.clientWidth; if (width === 0) return; const page = Math.round(e.currentTarget.scrollLeft / width) + 1; setQueuePage(page); }, []);
    useDndMonitor({ onDragStart: () => setIsAutoScrolling(true), onDragEnd: () => { setIsAutoScrolling(false); autoScrollDirection.current = null; }, onDragCancel: () => { setIsAutoScrolling(false); autoScrollDirection.current = null; } });
    useEffect(() => { if (!isAutoScrolling) return; const handleMouseMove = (e: MouseEvent | TouchEvent) => { if (!queueScrollRef.current) return; const rect = queueScrollRef.current.getBoundingClientRect(); const x = (e as MouseEvent).clientX || (e as TouchEvent).touches?.[0]?.clientX || 0; const EDGE_SIZE = 50; const y = (e as MouseEvent).clientY || (e as TouchEvent).touches?.[0]?.clientY || 0; if (y < rect.top || y > rect.bottom) { autoScrollDirection.current = null; return; } if (x < rect.left + EDGE_SIZE) { autoScrollDirection.current = 'left'; } else if (x > rect.right - EDGE_SIZE) { autoScrollDirection.current = 'right'; } else { autoScrollDirection.current = null; } }; window.addEventListener('mousemove', handleMouseMove); window.addEventListener('touchmove', handleMouseMove); const interval = setInterval(() => { if (autoScrollDirection.current && queueScrollRef.current) { const scrollAmount = 10; queueScrollRef.current.scrollBy({ left: autoScrollDirection.current === 'left' ? -scrollAmount : scrollAmount, behavior: 'auto' }); } }, 16); return () => { window.removeEventListener('mousemove', handleMouseMove); window.removeEventListener('touchmove', handleMouseMove); clearInterval(interval); }; }, [isAutoScrolling]);
    
    useEffect(() => {
        if (pendingScrollToIndex.current !== null && queueScrollRef.current) {
             const targetIndex = pendingScrollToIndex.current;
             const width = queueScrollRef.current.clientWidth;
             if (width > 0) {
                 requestAnimationFrame(() => {
                     queueScrollRef.current?.scrollTo({ left: targetIndex * width, behavior: 'smooth' });
                     setQueuePage(targetIndex + 1);
                     pendingScrollToIndex.current = null;
                 });
             }
        } else if (queue.length > prevQueueLen.current) {
            requestAnimationFrame(() => {
                setTimeout(() => {
                    if (queueScrollRef.current) {
                        const scrollLeft = queueScrollRef.current.scrollWidth - queueScrollRef.current.clientWidth;
                        queueScrollRef.current.scrollTo({ left: scrollLeft > 0 ? scrollLeft : 0, behavior: 'smooth' });
                        const width = queueScrollRef.current.clientWidth;
                        if (width > 0) {
                            const newPage = Math.ceil(queueScrollRef.current.scrollWidth / width);
                            setQueuePage(newPage);
                        }
                    }
                }, 150);
            });
        }
        prevQueueLen.current = queue.length;
    }, [queue.length, queue]);

    const isFiltered = !!queueSearchTerm.trim();

    return (
        <motion.div variants={staggerContainer} initial="hidden" animate="visible" className="flex flex-col [@media(min-width:736px)]:grid [@media(min-width:736px)]:grid-cols-2 [@media(min-width:992px)]:flex [@media(min-width:992px)]:flex-row gap-4 [@media(min-width:992px)]:gap-8 pb-24 px-1 min-h-[60vh] pt-4">
            <div className="w-full [@media(min-width:992px)]:w-[30%] h-full">
                <TeamColumn id="A" team={courtA} onUpdatePlayer={onUpdatePlayer} onAddPlayer={wrappedAdd} onKnockoutRequest={handleKnockoutRequest} usedColors={usedColors} onMove={wrappedMove} statsMap={playerStatsMap} onRequestProfileEdit={(pid: string) => setEditingTarget({ type: 'player', id: pid })} onViewProfile={(pid: string) => setViewingProfileId(pid)} onTogglePlayerMenu={handleTogglePlayerMenu} activePlayerMenuId={activePlayerMenu?.playerId || null} profiles={profiles} onUpdateTeamName={()=>{}} onUpdateTeamColor={wrappedUpdateColor} onSaveProfile={wrappedSaveProfile} onSortTeam={()=>{}} toggleTeamBench={toggleTeamBench} substitutePlayers={substitutePlayers} isDragOver={dragOverContainerId === 'A' || dragOverContainerId === 'A_Reserves'} onShowToast={onShowToast} activeNumberId={activeNumberId} onRequestEditNumber={onRequestEditNumber} />
            </div>
            <div className="w-full [@media(min-width:992px)]:w-[30%] h-full">
                <TeamColumn id="B" team={courtB} onUpdatePlayer={onUpdatePlayer} onAddPlayer={wrappedAdd} onKnockoutRequest={handleKnockoutRequest} usedColors={usedColors} onMove={wrappedMove} statsMap={playerStatsMap} onRequestProfileEdit={(pid: string) => setEditingTarget({ type: 'player', id: pid })} onViewProfile={(pid: string) => setViewingProfileId(pid)} onTogglePlayerMenu={handleTogglePlayerMenu} activePlayerMenuId={activePlayerMenu?.playerId || null} profiles={profiles} onUpdateTeamName={()=>{}} onUpdateTeamColor={wrappedUpdateColor} onSaveProfile={wrappedSaveProfile} onSortTeam={()=>{}} toggleTeamBench={toggleTeamBench} substitutePlayers={substitutePlayers} isDragOver={dragOverContainerId === 'B' || dragOverContainerId === 'B_Reserves'} onShowToast={onShowToast} activeNumberId={activeNumberId} onRequestEditNumber={onRequestEditNumber} />
            </div>
            <motion.div variants={staggerItem} className="w-full [@media(min-width:736px)]:col-span-2 [@media(min-width:992px)]:w-[40%] relative p-1 pt-8 rounded-2xl bg-slate-100/50 dark:bg-white/[0.02] border border-dashed border-slate-300 dark:border-white/10 flex flex-col h-full overflow-hidden">
                <div className="absolute top-4 left-6 px-3 py-1 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-full text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-2 shadow-sm z-30"><Layers size={10} /><span>{t('teamManager.queue')}</span><span className="bg-slate-200 dark:bg-white/10 px-1.5 rounded text-slate-600 dark:text-slate-300">{queue.length}</span></div>{filteredQueue.length > 1 && (<div className="absolute top-4 right-6 px-3 py-1 rounded-full bg-black/5 dark:bg-white/5 text-[9px] font-bold text-slate-400 border border-black/5 dark:border-white/5 z-30">{t('common.step', {number: `${queuePage} / ${filteredQueue.length}`})}</div>)}
                <div className="flex items-center gap-2 px-4 mb-2 flex-shrink-0 mt-4"><div className="relative flex-1 group"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors" size={14} /><input value={queueSearchTerm} onChange={(e) => setQueueSearchTerm(e.target.value)} placeholder={t('teamManager.searchQueue')} className="w-full bg-white/60 dark:bg-black/20 border border-black/5 dark:border-white/5 rounded-xl pl-9 pr-8 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all placeholder:font-medium placeholder:text-slate-400" />{queueSearchTerm && (<button onClick={() => setQueueSearchTerm('')} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"><X size={12} /></button>)}</div>{filteredQueue.length > 1 && (<div className="flex bg-white/60 dark:bg-black/20 rounded-xl p-0.5 border border-black/5 dark:border-white/5 shrink-0"><button onClick={() => handleScrollQueue('left')} className="p-1.5 hover:bg-black/5 dark:hover:bg-white/10 rounded-lg text-slate-500 dark:text-slate-400 transition-colors"><ChevronLeft size={16} /></button><div className="w-px bg-black/5 dark:bg-white/5 my-1" /><button onClick={() => handleScrollQueue('right')} className="p-1.5 hover:bg-black/5 dark:hover:bg-white/10 rounded-lg text-slate-500 dark:text-slate-400 transition-colors"><ChevronRight size={16} /></button></div>)}</div>
                <div ref={queueScrollRef} onScroll={onQueueScroll} className="flex-1 min-h-0 overflow-x-auto snap-x snap-mandatory no-scrollbar flex items-stretch pb-2 pt-2 px-1" >
                    {filteredQueue.length === 0 ? (
                        <div className="flex-1 flex flex-col items-center justify-center h-full text-slate-400 italic gap-2 min-h-[300px] w-full"><Search size={24} className="opacity-20" /><span className="text-[10px]">{queue.length === 0 ? t('teamManager.queueEmpty') : "No teams match filter"}</span></div>
                    ) : (
                        <AnimatePresence initial={false} mode="popLayout">
                            {filteredQueue.map((team: Team, idx: number) => (
                                <motion.div key={team.id} layout="position" layoutId={`queue-card-${team.id}`} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }} transition={{ type: "spring", stiffness: 60, damping: 15, mass: 1 }} className="snap-center w-full flex-shrink-0 h-full px-2 pt-1 pb-1 flex flex-col"> 
                                    <TeamColumn id={team.id} team={team} profiles={profiles} onUpdateTeamName={()=>{}} onUpdateTeamColor={wrappedUpdateColor} onSaveProfile={wrappedSaveProfile} onSortTeam={()=>{}} toggleTeamBench={toggleTeamBench} substitutePlayers={()=>{}} onUpdatePlayer={onUpdatePlayer} onAddPlayer={wrappedAdd} onKnockoutRequest={handleKnockoutRequest} usedColors={usedColors} isQueue={true} onMove={wrappedMove} statsMap={playerStatsMap} onRequestProfileEdit={(pid: string) => setEditingTarget({ type: 'player', id: pid })} onViewProfile={(pid: string) => setViewingProfileId(pid)} onTogglePlayerMenu={handleTogglePlayerMenu} activePlayerMenuId={activePlayerMenu?.playerId || null} isNext={idx === 0 && !queueSearchTerm} onDisband={handleDisbandTeam} onReorder={isFiltered ? undefined : handleReorderLocal} queueIndex={idx} queueSize={queue.length} isDragOver={dragOverContainerId === team.id || dragOverContainerId === `${team.id}_Reserves`} onShowToast={onShowToast} activeNumberId={activeNumberId} onRequestEditNumber={onRequestEditNumber} />
                                </motion.div>
                            ))}
                        </AnimatePresence>
                    )}
                </div>
                <div className="p-4 pt-2 border-t border-black/5 dark:border-white/5 bg-slate-50/50 dark:bg-transparent flex-shrink-0"><AddPlayerInput onAdd={(n, num, s) => wrappedAdd(n, 'Queue', num, s)} customLabel={t('teamManager.addPlayerQueue')} /></div>
            </motion.div>
        </motion.div>
    );
};

export const TeamManagerModal: React.FC<TeamManagerModalProps> = (props) => {
  const { t } = useTranslation();
  
  if (!props.isOpen) return null;

  const [activeTab, setActiveTab] = useState<'roster' | 'profiles' | 'input'>('roster');
  const [activePlayer, setActivePlayer] = useState<Player | null>(null);
  const [undoVisible, setUndoVisible] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  // NEW: Lifted state for the currently editing number input
  const [activeNumberId, setActiveNumberId] = useState<string | null>(null);
  const validationLockRef = useRef<string | null>(null);
  
  const [benchConfirmState, setBenchConfirmState] = useState<{ teamId: string, playerId: string } | null>(null);
  const [dropConfirmState, setDropConfirmState] = useState<{ playerId: string; sourceId: string; targetTeamId: string; index: number; } | null>(null);
  const [resetConfirmState, setResetConfirmState] = useState(false);

  const [editingTarget, setEditingTarget] = useState<EditingTarget | null>(null);
  
  // NEW: State for Read-Only Profile View
  const [viewingProfileId, setViewingProfileId] = useState<string | null>(null);

  const [activePlayerMenu, setActivePlayerMenu] = useState<{ playerId: string; rect: DOMRect } | null>(null);
  const [dragOverContainerId, setDragOverContainerId] = useState<string | null>(null);

  const playerMenuRef = useRef<HTMLDivElement>(null);
  const haptics = useHaptics();
  const audio = useGameAudio({ enableSound: true } as any);
  
  const lastMoveRef = useRef<{ id: string, from: string, to: string, index: number, ts: number } | null>(null);

  const { onUpdatePlayer, restoreTeam, onRestorePlayer, upsertProfile, deleteProfile, relinkProfile, onShowToast } = props;
  
  const findContainer = useCallback((id: string) => {
    if (id === 'A' || props.courtA.players.some(p => p.id === id)) return 'A';
    if (props.courtA.reserves?.some(p => p.id === id)) return 'A_Reserves';
    if (id === 'B' || props.courtB.players.some(p => p.id === id)) return 'B';
    if (props.courtB.reserves?.some(p => p.id === id)) return 'B_Reserves';
    if (id === 'A_Reserves') return 'A_Reserves'; 
    if (id === 'B_Reserves') return 'B_Reserves';
    for (const team of props.queue) {
        if (id === team.id || team.players.some(p => p.id === id)) return team.id;
        if (id === `${team.id}_Reserves` || (team.reserves && team.reserves.some(p => p.id === id))) return `${team.id}_Reserves`;
    }
    return null;
  }, [props.courtA, props.courtB, props.queue]);

  // --- UPDATE HANDLER ---
  const handleUpdatePlayerWrapper = useCallback((playerId: string, updates: Partial<Player>) => {
      // Calls the hook logic which validates against store state (referenced inside hook)
      // Now expects the result object to be returned
      const result = onUpdatePlayer(playerId, updates);
      
      // Error handling for immediate feedback (Toast)
      if (result && result.success === false) {
          validationLockRef.current = playerId; // LOCK switching
          haptics.notification('error');
          
          // Enhanced visual feedback for integrity issues
          // Using PARENT onShowToast directly
          onShowToast(
              "Number Unavailable", // Translated or simple English
              'error',
              result.error || "Conflict detected in roster.",
              'block'
          );
      } else {
          // If successful (or no result, meaning no validation check needed), unlock and clear active state
          // Only clear lock if the update was successful for the LOCKED ID
          if (validationLockRef.current === playerId) {
              validationLockRef.current = null;
          }
          if (activeNumberId === playerId) {
              setActiveNumberId(null);
          }
      }
      return result; // Pass result back to child (EditableNumber)
  }, [onUpdatePlayer, haptics, onShowToast, activeNumberId]);

  // NEW: Request handler to prevent switching if locked
  const handleRequestEditNumber = useCallback((playerId: string) => {
      // If locked by another player, do not allow switch
      if (validationLockRef.current && validationLockRef.current !== playerId) {
          // Trigger a reminder shake or toast
          haptics.notification('warning');
          onShowToast(
              "Finish Editing",
              'warning',
              "Please fix the invalid number before editing another.",
              'alert'
          );
          return;
      }
      setActiveNumberId(playerId);
  }, [haptics, onShowToast]);

  const wrappedUpdateColor = useCallback((id: string, color: TeamColor) => { props.onUpdateTeamColor(id, color); }, [props.onUpdateTeamColor]);
  
  const wrappedMove = useCallback((playerId: string, fromId: string, toId: string, newIndex?: number) => { 
      const now = Date.now();
      const idx = newIndex ?? -1;
      if (lastMoveRef.current && lastMoveRef.current.id === playerId && lastMoveRef.current.from === fromId && lastMoveRef.current.to === toId && lastMoveRef.current.index === idx) return;
      if (lastMoveRef.current && (now - lastMoveRef.current.ts < 100)) return;
      lastMoveRef.current = { id: playerId, from: fromId, to: toId, index: idx, ts: now };
      props.onMove(playerId, fromId, toId, newIndex); 
  }, [props.onMove]);

  const wrappedAdd = useCallback((name: string, target: string, number?: string, skill?: number) => { 
      const result = props.onAddPlayer(name, target, number, skill);
      if (!result.success) {
          haptics.notification('error');
          onShowToast(
              "Cannot Add",
              'error',
              result.error || "Duplicate number or limit reached.",
              'block'
          );
      }
      return result;
  }, [props.onAddPlayer, haptics, onShowToast]);
  
  const { disbandTeam, reorderQueue, resetRosters, onDeletePlayer } = props;
  
  const wrappedDisband = disbandTeam ? useCallback((id: string) => { 
      const teamToDisband = props.queue.find(t => t.id === id);
      const teamIndex = props.queue.findIndex(t => t.id === id);
      
      haptics.impact('medium'); 
      audio.playUndo(); 
      disbandTeam(id);
      
      if (teamToDisband && restoreTeam) {
          onShowToast(
              t('teamManager.playerRemoved'), 
              'info', 
              teamToDisband.name,
              'delete',
              () => restoreTeam(teamToDisband, teamIndex)
          );
      }
  }, [disbandTeam, haptics, audio, props.queue, restoreTeam, t, onShowToast]) : undefined;

  const wrappedReorder = reorderQueue ? useCallback((from: number, to: number) => { haptics.impact('light'); audio.playTap(); reorderQueue(from, to); }, [reorderQueue, haptics, audio]) : undefined;

  // REFACTORED: Stack-Based Undo Logic for Players
  const handleDeleteWithUndo = useCallback((playerId: string) => {
      let player: Player | undefined;
      
      // Locate player for toast info
      const findIn = (list: Player[]) => list.find(p => p.id === playerId);
      
      player = findIn(props.courtA.players) || 
               findIn(props.courtA.reserves || []) || 
               findIn(props.courtB.players) || 
               findIn(props.courtB.reserves || []) || 
               props.queue.flatMap(t => [...t.players, ...(t.reserves || [])]).find(p => p.id === playerId);

      if (onDeletePlayer) onDeletePlayer(playerId);
      setActivePlayerMenu(null);
      
      if (player && props.onUndoRemove) {
          onShowToast(
              t('teamManager.playerRemoved'),
              'info',
              player.name,
              'delete',
              props.onUndoRemove
          );
      }
  }, [props.courtA, props.courtB, props.queue, onDeletePlayer, props.onUndoRemove, t, onShowToast]);

  // REFACTORED: Deep Copy Undo for Profiles (Robust Fix)
  const handleProfileDelete = useCallback((profileId: string) => {
      // Validation: Ensure delete service exists
      if (!deleteProfile) return;

      // 1. Delete and get the returned profile object (snapshot)
      const deletedProfile = deleteProfile(profileId);
      
      // 2. Only show Undo Toast if we have the capability to restore (upsert + relink)
      if (deletedProfile && upsertProfile && relinkProfile) {
          const backup = { ...deletedProfile };
          
          onShowToast(
              t('teamManager.playerRemoved'), 
              'info',
              backup.name,
              'delete',
              () => {
                  upsertProfile(
                      backup.name, 
                      backup.skillLevel, 
                      backup.id,
                      {
                          number: backup.number,
                          avatar: backup.avatar,
                          role: backup.role
                      }
                  );
                  relinkProfile(backup);
              }
          );
      }
  }, [deleteProfile, upsertProfile, relinkProfile, t, onShowToast]);

  const playerStatsMap = useMemo(() => {
      const map = new Map<string, PlayerStats>();
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

  const getTeamById = (id: string) => {
      if (id === 'A' || id === 'A_Reserves') return props.courtA;
      if (id === 'B' || id === 'B_Reserves') return props.courtB;
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

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(MouseSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 100, tolerance: 5 } }),
    useSensor(KeyboardSensor)
  );

  const handleDragStart = (event: DragStartEvent) => {
      haptics.impact('light');
      setActivePlayer(playersById.get(event.active.id as string) || null);
  };

  const handleDragOver = (event: DragOverEvent) => {
      const { over } = event;
      setDragOverContainerId(over ? (over.data.current?.containerId || over.id) : null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActivePlayer(null);
    setDragOverContainerId(null);

    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;
    
    // Determine Source & Target Containers
    const activeData = active.data.current as { fromId: string, player: Player } | undefined;
    const overData = over.data.current as { containerId?: string, player?: Player, fromId?: string } | undefined;

    const sourceContainerId = activeData?.fromId;
    let targetContainerId = overData?.containerId || overData?.fromId;

    // Fallback: If dropped directly on container placeholder
    if (!targetContainerId && (over.id === 'A' || over.id === 'B' || over.id === 'A_Reserves' || over.id === 'B_Reserves' || String(over.id).endsWith('_Reserves'))) {
        targetContainerId = String(over.id);
    }
    // Queue Fallback
    if (!targetContainerId && (String(over.id).length > 20)) {
         targetContainerId = String(over.id); 
    }

    if (!sourceContainerId || !targetContainerId) return;

    // Same container reorder vs Cross container move
    if (sourceContainerId === targetContainerId) {
        // Logic for reordering within same list (omitted for brevity as standard array move)
        // Since we don't have exact index from here easily without extra lookup, we skip reorder for now 
        // or implement simple swap if needed. But core requirement is moving between lists.
        return; 
    }

    // --- LOGIC: HANDLE RESTRICTIONS ---
    
    // 1. Check Bench Activation
    const targetTeamObj = getTeamById(targetContainerId);
    
    // Case: Moving from Main to Reserves when Bench is INACTIVE
    if (targetContainerId.endsWith('_Reserves') && targetTeamObj && !targetTeamObj.hasActiveBench) {
        setBenchConfirmState({ teamId: targetTeamObj.id, playerId: activeId });
        return;
    }

    // Case: Moving to Main Team when FULL -> Suggest Bench
    if (!targetContainerId.endsWith('_Reserves') && targetTeamObj && targetTeamObj.players.length >= 6) {
        // Only trigger if Bench is available or can be activated
        setDropConfirmState({ playerId: activeId, sourceId: sourceContainerId, targetTeamId: targetTeamObj.id, index: 0 }); // Index 0 is dummy
        return;
    }

    // Execute Move
    haptics.impact('medium');
    wrappedMove(activeId, sourceContainerId, targetContainerId, undefined);
  };

  const usedColors = new Set([props.courtA.color, props.courtB.color]);

  const usedProfiles = useMemo(() => {
      const set = new Set<string>();
      playersById.forEach(p => { if (p.profileId) set.add(p.profileId); });
      return set;
  }, [playersById]);

  return (
    createPortal(
    <Modal isOpen={props.isOpen} onClose={handleCloseAttempt} title={t('teamManager.title')} maxWidth="max-w-5xl" zIndex="z-[50]">
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragOver={handleDragOver} onDragEnd={handleDragEnd}>
            
            {/* Header Tabs */}
            <div className="flex px-1 mb-2 bg-slate-100 dark:bg-black/20 p-1 rounded-xl shrink-0">
                <button onClick={() => setActiveTab('roster')} className={`flex-1 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${activeTab === 'roster' ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'}`}>{t('teamManager.tabs.roster')}</button>
                <button onClick={() => setActiveTab('profiles')} className={`flex-1 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${activeTab === 'profiles' ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'}`}>{t('teamManager.tabs.profiles')}</button>
                <button onClick={() => setActiveTab('input')} className={`flex-1 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${activeTab === 'input' ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'}`}>{t('teamManager.tabs.batch')}</button>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-hidden relative">
                {activeTab === 'roster' && (
                    <>
                        <div className="flex justify-between items-center px-2 py-2 border-b border-black/5 dark:border-white/5 mb-2 shrink-0">
                            <div className="flex gap-2">
                                <button onClick={() => props.onSetRotationMode('standard')} className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase border transition-all ${props.rotationMode === 'standard' ? 'bg-indigo-500 text-white border-indigo-600 shadow-sm' : 'bg-transparent border-slate-300 dark:border-white/10 text-slate-400'}`} title={t('teamManager.modes.standardTooltip')}>{t('teamManager.modes.standard')}</button>
                                <button onClick={() => props.onSetRotationMode('balanced')} className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase border transition-all ${props.rotationMode === 'balanced' ? 'bg-emerald-500 text-white border-emerald-600 shadow-sm' : 'bg-transparent border-slate-300 dark:border-white/10 text-slate-400'}`} title={t('teamManager.modes.balancedTooltip')}>{t('teamManager.modes.balanced')}</button>
                            </div>
                            <div className="flex gap-2">
                                {props.canUndoRemove && <button onClick={props.onUndoRemove} className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 dark:bg-white/10 hover:bg-slate-200 dark:hover:bg-white/20 text-slate-600 dark:text-slate-300 rounded-lg text-[10px] font-bold uppercase transition-colors"><Undo2 size={12} /> {t('teamManager.undo')}</button>}
                                <button onClick={() => { haptics.impact('medium'); props.onBalanceTeams(); }} className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 dark:bg-indigo-500/10 hover:bg-indigo-100 dark:hover:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 rounded-lg text-[10px] font-bold uppercase transition-colors"><Shuffle size={12} /> {t('teamManager.actions.globalBalance')}</button>
                                {resetRosters && <button onClick={() => { if(confirm("Reset all rosters?")) resetRosters(); }} className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg"><Trash2 size={14}/></button>}
                            </div>
                        </div>
                        
                        <div className="h-full overflow-y-auto custom-scrollbar pb-20">
                            {/* Pass handleUpdatePlayerWrapper instead of props.onUpdatePlayer to enable validation toast */}
                            <RosterBoard 
                                courtA={props.courtA} courtB={props.courtB} queue={props.queue} 
                                onUpdatePlayer={handleUpdatePlayerWrapper} 
                                wrappedAdd={wrappedAdd} wrappedMove={wrappedMove} wrappedUpdateColor={wrappedUpdateColor} wrappedSaveProfile={props.onSaveProfile}
                                handleKnockoutRequest={handleDeleteWithUndo} usedColors={usedColors} playerStatsMap={playerStatsMap}
                                setEditingTarget={(target: EditingTarget) => setEditingTarget(target)} 
                                setViewingProfileId={setViewingProfileId}
                                handleTogglePlayerMenu={handleTogglePlayerMenu} activePlayerMenu={activePlayerMenu} toggleTeamBench={props.toggleTeamBench} substitutePlayers={props.substitutePlayers} reorderQueue={wrappedReorder} handleDisbandTeam={wrappedDisband} dragOverContainerId={dragOverContainerId} onShowToast={onShowToast} profiles={props.profiles} onRequestProfileEdit={(id: string) => setEditingTarget({ type: 'player', id })}
                                activeNumberId={activeNumberId} onRequestEditNumber={handleRequestEditNumber}
                            />
                        </div>
                    </>
                )}

                {activeTab === 'profiles' && (
                    <div className="h-full overflow-y-auto custom-scrollbar p-2 pb-16 space-y-4">
                        <button onClick={() => setEditingTarget({ type: 'profile', id: 'new' })} className="w-full py-4 border-2 border-dashed border-slate-300 dark:border-white/10 rounded-2xl flex flex-col items-center justify-center gap-2 text-slate-400 hover:text-indigo-500 hover:border-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 transition-all group">
                            <div className="p-2 rounded-full bg-slate-100 dark:bg-white/5 group-hover:bg-indigo-500 group-hover:text-white transition-colors"><Plus size={24} /></div>
                            <span className="text-xs font-bold uppercase tracking-widest">{t('profile.create')}</span>
                        </button>
                        
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                            {Array.from(props.profiles.values()).length === 0 ? (
                                <div className="col-span-full text-center py-10 text-slate-400 italic text-xs">{t('teamManager.profiles.empty')}</div>
                            ) : (
                                Array.from(props.profiles.values()).map(profile => {
                                    // Determine Status
                                    let status: PlayerLocationStatus = null;
                                    let teamColor: TeamColor | undefined = undefined;
                                    
                                    // Check Court A
                                    if (props.courtA.players.some(p => p.profileId === profile.id)) { status = 'A'; teamColor = props.courtA.color; }
                                    else if (props.courtA.reserves?.some(p => p.profileId === profile.id)) { status = 'A_Bench'; teamColor = props.courtA.color; }
                                    // Check Court B
                                    else if (props.courtB.players.some(p => p.profileId === profile.id)) { status = 'B'; teamColor = props.courtB.color; }
                                    else if (props.courtB.reserves?.some(p => p.profileId === profile.id)) { status = 'B_Bench'; teamColor = props.courtB.color; }
                                    // Check Queue
                                    else {
                                        for (const t of props.queue) {
                                            if (t.players.some(p => p.profileId === profile.id)) { status = 'Queue'; teamColor = t.color; break; }
                                            if (t.reserves?.some(p => p.profileId === profile.id)) { status = 'Queue_Bench'; teamColor = t.color; break; }
                                        }
                                    }

                                    const placementOptions: PlacementOption[] = [];
                                    if (!status) {
                                        // A
                                        if (props.courtA.players.length < 6) placementOptions.push({ label: t('teamManager.actions.addTo') + ' ' + props.courtA.name, targetId: 'A', type: 'main', teamColor: props.courtA.color });
                                        else if (props.courtA.hasActiveBench) placementOptions.push({ label: t('teamManager.actions.addTo') + ' ' + props.courtA.name + ' (' + t('teamManager.benchLabel') + ')', targetId: 'A_Reserves', type: 'bench', teamColor: props.courtA.color });
                                        
                                        // B
                                        if (props.courtB.players.length < 6) placementOptions.push({ label: t('teamManager.actions.addTo') + ' ' + props.courtB.name, targetId: 'B', type: 'main', teamColor: props.courtB.color });
                                        else if (props.courtB.hasActiveBench) placementOptions.push({ label: t('teamManager.actions.addTo') + ' ' + props.courtB.name + ' (' + t('teamManager.benchLabel') + ')', targetId: 'B_Reserves', type: 'bench', teamColor: props.courtB.color });
                                        
                                        // Queue
                                        placementOptions.push({ label: t('teamManager.actions.addToQueue'), targetId: 'Queue', type: 'queue' });
                                    }

                                    return (
                                        <ProfileCard 
                                            key={profile.id} 
                                            profile={profile} 
                                            onDelete={() => handleProfileDelete(profile.id)}
                                            onAddToGame={(target) => wrappedAdd(profile.name, target, profile.number, profile.skillLevel)}
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

                {activeTab === 'input' && <BatchInputSection onGenerate={props.onGenerate} />}
            </div>

            {/* Drag Overlay */}
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

            {/* --- Modals & Popups --- */}
            
            {/* Player Context Menu (Portal) */}
            {activePlayerMenu && createPortal(
                <>
                    <div className="fixed inset-0 z-[9998]" onClick={() => setActivePlayerMenu(null)} />
                    <div 
                        className="fixed z-[9999] min-w-[180px] bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-black/10 dark:border-white/10 p-1 flex flex-col animate-in fade-in zoom-in-95 duration-200"
                        style={{ 
                            top: Math.min(window.innerHeight - 200, activePlayerMenu.rect.bottom + 8), 
                            left: Math.min(window.innerWidth - 190, Math.max(10, activePlayerMenu.rect.left - 100))
                        }}
                    >
                       {(() => {
                           const p = playersById.get(activePlayerMenu.playerId);
                           if (!p) return null;
                           // Contextual Actions
                           const team = getTeamById(findContainer(p.id) || '');
                           const isOnBench = findContainer(p.id)?.includes('Reserves');
                           
                           return (
                               <>
                                   {team && team.hasActiveBench && !isOnBench && (
                                       <button onClick={() => { wrappedMove(p.id, team.id, `${team.id}_Reserves`); setActivePlayerMenu(null); }} className="w-full text-left px-3 py-2.5 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/10 rounded-lg flex items-center gap-2"><Armchair size={14} /> {t('teamManager.menu.sendBench')}</button>
                                   )}
                                   {team && isOnBench && (
                                       <button onClick={() => { wrappedMove(p.id, `${team.id}_Reserves`, team.id); setActivePlayerMenu(null); }} className="w-full text-left px-3 py-2.5 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/10 rounded-lg flex items-center gap-2"><Upload size={14} /> {t('teamManager.menu.returnCourt')}</button>
                                   )}
                                   
                                   <div className="h-px bg-black/5 dark:bg-white/5 my-1" />
                                   
                                   <button onClick={() => { props.onToggleFixed(p.id); setActivePlayerMenu(null); }} className="w-full text-left px-3 py-2.5 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/10 rounded-lg flex items-center gap-2">
                                       {p.isFixed ? <Unlock size={14} /> : <Pin size={14} />} {p.isFixed ? t('teamManager.menu.unlock') : t('teamManager.menu.lock')}
                                   </button>
                                   
                                   <div className="h-px bg-black/5 dark:bg-white/5 my-1" />
                                   
                                   <button onClick={() => handleDeleteWithUndo(p.id)} className="w-full text-left px-3 py-2.5 text-xs font-bold text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-lg flex items-center gap-2">
                                       <Trash2 size={14} /> {t('teamManager.menu.delete')}
                                   </button>
                               </>
                           );
                       })()}
                    </div>
                </>,
                document.body
            )}

            {/* Profile Editing Modal */}
            {editingTarget && (
                <ProfileCreationModal 
                    isOpen={true} 
                    onClose={() => setEditingTarget(null)}
                    title={editingTarget.id === 'new' ? t('profile.createTitle') : t('profile.editTitle')}
                    initialName={editingTarget.type === 'player' ? playersById.get(editingTarget.id)?.name || '' : props.profiles.get(editingTarget.id)?.name || ''}
                    initialNumber={editingTarget.type === 'player' ? playersById.get(editingTarget.id)?.number || '' : props.profiles.get(editingTarget.id)?.number || ''}
                    initialSkill={editingTarget.type === 'player' ? playersById.get(editingTarget.id)?.skillLevel : props.profiles.get(editingTarget.id)?.skillLevel}
                    initialRole={editingTarget.type === 'player' ? playersById.get(editingTarget.id)?.role : props.profiles.get(editingTarget.id)?.role}
                    onSave={(name: string, num: string, av: string, sk: number, role: PlayerRole) => {
                        const target = editingTarget;
                        if (!target) return; // Guard against null

                        if (target.type === 'player') {
                            props.onSaveProfile(target.id, { name, number: num, avatar: av, skill: sk, role });
                        } else {
                            props.upsertProfile?.(name, sk, target.id === 'new' ? undefined : target.id, { number: num, avatar: av, role });
                        }
                        setEditingTarget(null);
                    }}
                />
            )}

            {/* Read-Only Profile View */}
            {viewingProfileId && (
                <ProfileDetailsModal 
                    isOpen={!!viewingProfileId} 
                    onClose={() => setViewingProfileId(null)}
                    profileId={viewingProfileId}
                    profiles={props.profiles}
                    onEdit={() => { setViewingProfileId(null); setEditingTarget({ type: 'profile', id: viewingProfileId }); }}
                />
            )}

            {/* Confirmation Modals */}
            <ConfirmationModal 
                isOpen={!!benchConfirmState} 
                onClose={() => setBenchConfirmState(null)} 
                title={t('teamManager.activateBenchTitle')}
                message={t('teamManager.activateBenchConfirm')}
                confirmLabel={t('teamManager.btnActivateBench')}
                onConfirm={() => {
                    if (benchConfirmState) {
                        props.toggleTeamBench(benchConfirmState.teamId);
                        wrappedMove(benchConfirmState.playerId, benchConfirmState.teamId, `${benchConfirmState.teamId}_Reserves`);
                    }
                }}
            />

            <ConfirmationModal 
                isOpen={!!dropConfirmState} 
                onClose={() => setDropConfirmState(null)} 
                title={t('teamManager.teamFullTitle')}
                message={t('teamManager.teamFullConfirm')}
                confirmLabel={t('teamManager.btnYesBench')}
                onConfirm={() => {
                    if (dropConfirmState) {
                        const targetT = getTeamById(dropConfirmState.targetTeamId);
                        if (targetT && !targetT.hasActiveBench) {
                            props.toggleTeamBench(targetT.id);
                        }
                        wrappedMove(dropConfirmState.playerId, dropConfirmState.sourceId, `${dropConfirmState.targetTeamId}_Reserves`);
                    }
                }}
            />

        </DndContext>
    </Modal>,
    document.body
    );
};