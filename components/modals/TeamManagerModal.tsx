
import React, { useState, useMemo, useEffect, useCallback, memo, useRef, lazy } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Team, Player, RotationMode, PlayerProfile, TeamColor, ActionLog, PlayerRole } from '../../types';
import { calculateTeamStrength } from '../../utils/balanceUtils';
import { Pin, Trash2, Shuffle, Edit2, Plus, Undo2, Ban, Star, Save, RefreshCw, AlertCircle, User, Upload, List, Hash, Users, Layers, Search, X, ListFilter, ArrowDownAZ, ArrowDown01, ArrowUpWideNarrow, LogOut, ChevronRight, ChevronLeft, Armchair, ArrowRightLeft, ArrowUp, MoreVertical, Unlock, RefreshCcw, PlusCircle, ArrowUpCircle, Activity, ArrowDown, Check, ChevronsUp, ChevronUp, ChevronDown, ListOrdered, Hand, Zap, Target, Shield, Info, Image as ImageIcon, Lock, Palette, ChevronsDown, UserPlus } from 'lucide-react';
import { DndContext, DragEndEvent, DragOverEvent, DragStartEvent, DragOverlay, closestCenter, PointerSensor, useSensor, useSensors, KeyboardSensor, TouchSensor, useDndMonitor, useDroppable, MouseSensor } from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { createPortal } from 'react-dom';
import { useTranslation } from '../../contexts/LanguageContext';
import { TEAM_COLORS, COLOR_KEYS, resolveTheme, getHexFromColor } from '../../utils/colors';
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
import { useTutorial } from '../../hooks/useTutorial';

const RichTutorialModal = lazy(() => import('./RichTutorialModal').then(m => ({ default: m.RichTutorialModal })));

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
  onUpdateTeamLogo: (teamId: string, logo: string) => void; 
  
  onUpdatePlayer: (playerId: string, updates: Partial<Player>) => { success: boolean, error?: string, errorKey?: string, errorParams?: any } | void;

  onSaveProfile: (playerId: string, overrides?: { name?: string, number?: string, avatar?: string, skill?: number, role?: PlayerRole }) => { success: boolean, error?: string, errorKey?: string, errorParams?: any } | void;
  onRevertProfile: (playerId: string) => void;
  onAddPlayer: (name: string, target: 'A' | 'B' | 'Queue' | 'A_Reserves' | 'B_Reserves' | string, number?: string, skill?: number, existingPlayer?: Player) => { success: boolean, errorKey?: string, errorParams?: any, error?: string };
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

const ColorPicker = memo(({ selected, onChange, usedColors }: { selected: TeamColor, onChange: (c: TeamColor) => void, usedColors: Set<string> }) => {
    const sortedPalette = useMemo(() => {
        return [...COLOR_KEYS].sort((a, b) => {
            if (a === selected) return -1;
            if (b === selected) return 1;
            const isUsedA = usedColors.has(a);
            const isUsedB = usedColors.has(b);
            if (isUsedA && !isUsedB) return 1;
            if (!isUsedA && isUsedB) return -1;
            return a.localeCompare(b);
        });
    }, [selected, usedColors]);

    return (
        <div className="w-full relative z-20 py-2 min-h-[56px] landscape:min-h-[44px] landscape:py-1">
            <div 
                className="w-full overflow-x-auto overflow-y-visible no-scrollbar touch-pan-x flex items-center px-1" 
                onPointerDown={(e) => e.stopPropagation()} 
                style={{ overscrollBehaviorX: 'contain' }}
            >
                <div className="flex items-center gap-3 w-max pr-6 p-2"> 
                    {sortedPalette.map(color => {
                         const isSelected = selected === color;
                         const isTaken = usedColors.has(color) && !isSelected;
                         const hex = getHexFromColor(color);
                         
                         return (
                             <button
                                key={color} 
                                onClick={(e) => { 
                                    e.stopPropagation(); 
                                    if (!isTaken) onChange(color); 
                                }} 
                                onPointerDown={(e) => e.stopPropagation()} 
                                disabled={isTaken}
                                className={`
                                    relative w-9 h-9 landscape:w-7 landscape:h-7 rounded-full shrink-0
                                    flex items-center justify-center
                                    transition-all duration-300 ease-out
                                    border border-white/30 dark:border-white/10
                                    shadow-inner
                                    bg-gradient-to-br from-white/40 via-transparent to-black/20
                                    ${isSelected 
                                        ? `scale-110 z-10 ring-2 ring-offset-2 ring-offset-slate-100 dark:ring-offset-slate-900 ring-slate-400 dark:ring-white shadow-lg shadow-current/30` 
                                        : (isTaken ? 'opacity-30 grayscale scale-75 cursor-not-allowed' : 'hover:scale-105 hover:brightness-110 shadow-sm')
                                    }
                                `}
                                style={{ 
                                    backgroundColor: hex,
                                    color: hex 
                                }}
                                aria-label={`Select color ${color}`}
                             >
                                {isSelected && (
                                    <motion.div 
                                        layoutId="selected-color-check" 
                                        className="absolute inset-0 flex items-center justify-center"
                                        initial={{ scale: 0, opacity: 0 }}
                                        animate={{ scale: 1, opacity: 1 }}
                                        transition={{ type: "spring", stiffness: 500, damping: 30 }}
                                    >
                                        <Check size={14} className="text-white drop-shadow-md" strokeWidth={3} />
                                    </motion.div>
                                )}
                                {isTaken && (
                                    <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40">
                                        <Lock size={12} className="text-white opacity-90" />
                                    </div>
                                )}
                             </button>
                         );
                    })}
                </div>
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
  
  if(isEditing) return (
    <input 
        ref={inputRef} 
        type="text" 
        className={`bg-transparent text-slate-900 dark:text-white border-b-2 border-indigo-500 outline-none w-full px-0 py-1 font-bold placeholder-slate-400 ${isPlayer ? 'text-sm' : 'text-xl uppercase tracking-tight'}`} 
        value={val} 
        onChange={e => setVal(e.target.value)} 
        onBlur={save} 
        onKeyDown={e => { if(e.key === 'Enter') save(); if(e.key === 'Escape') setIsEditing(false); }} 
        onPointerDown={e => e.stopPropagation()} 
    />
  );
  return (
    <div className={`flex items-center gap-2 group cursor-pointer min-w-0 ${className}`} onClick={() => setIsEditing(true)}>
        <span className="truncate text-slate-900 dark:text-white">{name}</span>
        <Edit2 size={12} className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-400 flex-shrink-0" />
    </div>
  );
});

const TeamLogoUploader = memo(({ currentLogo, onUpdate, teamName }: { currentLogo?: string, onUpdate: (logo: string) => void, teamName: string }) => {
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                if (typeof reader.result === 'string') {
                    onUpdate(reader.result);
                }
            };
            reader.readAsDataURL(file);
        }
    };

    const triggerUpload = () => fileInputRef.current?.click();

    return (
        <div className="relative group flex-shrink-0">
            <button 
                onClick={triggerUpload}
                className="w-10 h-10 landscape:w-8 landscape:h-8 rounded-full border-2 border-white dark:border-white/10 bg-slate-100 dark:bg-white/5 flex items-center justify-center overflow-hidden hover:opacity-90 transition-opacity shadow-sm"
                title={`Change ${teamName} Logo`}
            >
                {currentLogo ? (
                    <img src={currentLogo} alt={teamName} className="w-full h-full object-cover" />
                ) : (
                    <ImageIcon size={16} className="text-slate-400 dark:text-slate-500" />
                )}
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-[2px]">
                    <Edit2 size={12} className="text-white" />
                </div>
            </button>
            <input 
                type="file" 
                ref={fileInputRef} 
                className="hidden" 
                accept="image/*" 
                onChange={handleFileChange} 
            />
        </div>
    );
});

const AddPlayerInput = memo(({ onAdd, disabled, customLabel }: { onAdd: (name: string, number?: string, skill?: number) => void; disabled?: boolean; customLabel?: string }) => {
    const { t } = useTranslation();
    const [isOpen, setIsOpen] = useState(false);
    const [name, setName] = useState('');
    const [number, setNumber] = useState('');
    const [skill, setSkill] = useState(5);
    const inputRef = React.useRef<HTMLInputElement>(null);
    const containerRef = React.useRef<HTMLDivElement>(null);

    // Auto-Focus when opened
    useEffect(() => { 
        if(isOpen) {
            setTimeout(() => inputRef.current?.focus(), 50);
        }
    }, [isOpen]);

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
            <div ref={containerRef} className="flex flex-col mt-4 animate-in fade-in slide-in-from-top-1 bg-white dark:bg-white/[0.08] p-4 rounded-3xl border border-indigo-500/30 shadow-xl ring-1 ring-indigo-500/20 backdrop-blur-md">
                <input ref={inputRef} autoFocus className="w-full bg-transparent border-b border-slate-200 dark:border-white/10 px-2 py-3 text-sm text-slate-900 dark:text-white focus:outline-none font-bold placeholder:text-slate-400 mb-4" placeholder={t('teamManager.addPlayerPlaceholder')} value={name} onChange={e => setName(e.target.value)} onKeyDown={e => { if(e.key === 'Enter') submit(); if(e.key === 'Escape') setIsOpen(false); }} />
                <div className="flex items-center gap-3">
                    <input type="tel" className="w-16 text-center bg-slate-100 dark:bg-black/20 rounded-2xl border border-transparent focus:border-indigo-500 focus:bg-white dark:focus:bg-black/40 px-1 py-3 text-xs font-black text-slate-800 dark:text-slate-200 outline-none transition-all placeholder:text-slate-400" placeholder="#" value={number} onChange={e => setNumber(e.target.value)} maxLength={3} />
                    <div className="flex-1 flex items-center justify-center bg-slate-100 dark:bg-white/5 rounded-2xl px-2 py-2"><SkillSlider level={skill} onChange={setSkill} /></div>
                    <button onClick={submit} className="p-3 bg-indigo-500 rounded-2xl hover:bg-indigo-400 text-white shadow-lg shadow-indigo-500/30 active:scale-95 transition-all"><Plus size={20} /></button>
                </div>
            </div>
        );
    }
    const labelContent = customLabel || t('common.add');
    const isBenchLabel = customLabel?.toLowerCase().includes('bench') || customLabel?.toLowerCase().includes('reserve') || customLabel?.toLowerCase().includes('banco');
    return <button onClick={() => !disabled && setIsOpen(true)} disabled={disabled} className={`mt-2 w-full py-3 flex items-center justify-center gap-2 text-[10px] font-bold uppercase tracking-widest rounded-xl border border-dashed transition-all group active:scale-95 ${disabled ? 'border-slate-200 dark:border-slate-800 text-slate-300 dark:text-slate-600 cursor-not-allowed' : 'border-slate-300 dark:border-white/10 text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:border-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-500/10'}`} >{disabled ? <><Ban size={14} /> {t('common.full')}</> : <>{isBenchLabel ? <Armchair size={14} className="text-emerald-500 group-hover:scale-110 transition-transform" /> : <Plus size={14} className="group-hover:scale-110 transition-transform" />} {labelContent}</>}</button>;
});

const TeamColumn = memo(({ id, team, profiles, onUpdateTeamName, onUpdateTeamColor, onUpdateTeamLogo, onUpdatePlayer, onSaveProfile, onAddPlayer, onKnockoutRequest, usedColors, isQueue = false, onMove, toggleTeamBench, substitutePlayers, statsMap, onRequestProfileEdit, onViewProfile, onTogglePlayerMenu, activePlayerMenuId, isNext = false, onDisband, onReorder, queueIndex, queueSize, isDragOver, onShowToast, activeNumberId, onRequestEditNumber, highlighted }: any) => {
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
  const handleUpdateLogo = useCallback((l: string) => onUpdateTeamLogo(id, l), [onUpdateTeamLogo, id]);
  
  const toggleView = () => setViewMode(prev => prev === 'main' ? 'reserves' : 'main');
  
  const handleAdd = useCallback((n: string, num?: string, s?: number) => { 
      const result = onAddPlayer(n, viewMode === 'main' ? id : `${id}_Reserves`, num, s); 
      if (!result.success) {
          onShowToast(
              result.errorKey ? t(result.errorKey, result.errorParams) : (result.error || t('notifications.cannotAdd')), 
              'error',
              t('notifications.uniqueConstraint')
          );
      }
  }, [onAddPlayer, id, viewMode, onShowToast, t]);

  const handleSubstitution = (pIn: string, pOut: string) => { substitutePlayers(id, pIn, pOut); };
  const applySort = (criteria: any) => { setSortConfig(prev => ({ criteria, direction: prev.criteria === criteria && prev.direction === 'asc' ? 'desc' : 'asc' })); setShowSortMenu(false); };

  const bgClass = viewMode === 'reserves' 
    ? 'bg-slate-100/80 dark:bg-white/[0.02] border-dashed border-slate-300 dark:border-white/10' 
    : `bg-white/70 dark:bg-[#0f172a]/60 bg-gradient-to-b ${colorConfig.gradient} border-slate-200 dark:border-white/5 shadow-xl shadow-black/5 dark:shadow-black/20`;
  
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
      let icon = <ListOrdered size={12} strokeWidth={3} />;
      let text = `${pos}º`;

      if (pos === 1) { badgeColor = 'bg-amber-500 text-amber-950 shadow-lg shadow-amber-500/20'; icon = <ArrowUpCircle size={14} strokeWidth={3} />; text = "NEXT UP"; } 
      else if (pos === 2) { badgeColor = 'bg-slate-400 text-white shadow-sm'; text = "2º"; } 
      else if (pos === 3) { text = "3º"; }

      queueBadge = <div className={`absolute -top-4 right-6 px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest z-10 flex items-center gap-1.5 shadow-md border border-white/50 dark:border-white/20 ${badgeColor}`}>{icon} {text}</div>;
  }

  const containerClass = `
      flex flex-col w-full h-full min-h-[300px]
      rounded-[2rem] border backdrop-blur-2xl relative transition-all duration-300
      p-4 sm:p-6 ${bgClass}
      ${isDragOver ? `ring-4 ${finalRing} ring-opacity-50 scale-[1.01] ${dropBg} z-20` : 'hover:border-slate-300 dark:hover:border-white/20'} 
      ${(isQueue && queueIndex === 0) ? 'ring-2 ring-amber-500/50 dark:ring-amber-500/40 ring-offset-2 ring-offset-slate-100 dark:ring-offset-slate-900 shadow-2xl shadow-amber-500/10' : ''}
      ${highlighted ? 'ring-4 ring-indigo-500/50 scale-[1.02] shadow-2xl z-30' : ''}
  `;

  // --- SORT MENU COMPONENT (Reusable) ---
  const SortMenuDropdown = () => (
      <AnimatePresence>
          {showSortMenu && (
              <motion.div initial={{ opacity: 0, y: 8, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 8, scale: 0.95 }} className="absolute right-0 top-full mt-2 z-50 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl rounded-xl shadow-2xl border border-black/5 dark:border-white/10 p-1 flex flex-col min-w-[140px]">
                  <span className="text-[9px] font-bold text-slate-400 px-3 py-1 uppercase tracking-widest text-left">{t('teamManager.sort.label')}</span>
                  <button onClick={() => applySort('name')} className="flex items-center justify-start px-2 py-2 text-[10px] font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 rounded-lg text-left w-full active:scale-95 transition-transform">
                      <div className="flex items-center gap-2 flex-1"><ArrowDownAZ size={12} className="flex-shrink-0 opacity-60" /> <span>{t('teamManager.sort.name')}</span></div>
                  </button>
                  <button onClick={() => applySort('number')} className="flex items-center justify-start px-2 py-2 text-[10px] font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 rounded-lg text-left w-full active:scale-95 transition-transform">
                      <div className="flex items-center gap-2 flex-1"><ArrowDown01 size={12} className="flex-shrink-0 opacity-60" /> <span>{t('teamManager.sort.number')}</span></div>
                  </button>
                  <button onClick={() => applySort('skill')} className="flex items-center justify-start px-2 py-2 text-[10px] font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 rounded-lg text-left w-full active:scale-95 transition-transform">
                      <div className="flex items-center gap-2 flex-1"><ArrowUpWideNarrow size={12} className="flex-shrink-0 opacity-60" /> <span>{t('teamManager.sort.skill')}</span></div>
                  </button>
                  <div className="h-px bg-black/5 dark:bg-white/5 my-1" />
                  <button onClick={() => applySort('original')} className="flex items-center gap-2 px-2 py-2 text-[10px] font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-white/5 rounded-lg text-left w-full active:scale-95 transition-transform">
                      <RefreshCcw size={12} className="flex-shrink-0 opacity-60" /> {t('teamManager.sort.reset')}
                  </button>
              </motion.div>
          )}
      </AnimatePresence>
  );

  return (
    <div ref={droppableRef} className={containerClass}>
      {queueBadge}
      <SubstitutionModal isOpen={isSubModalOpen} onClose={() => setIsSubModalOpen(false)} team={team} onConfirm={handleSubstitution} />
      
      {isQueue ? (
          <div className="flex flex-col mb-2 w-full">
              <div className="flex items-center gap-3 mb-2 w-full">
                  <TeamLogoUploader currentLogo={team.logo} onUpdate={handleUpdateLogo} teamName={team.name} />
                  <div className="flex-1 min-w-0">
                      <EditableTitle name={team.name} onSave={handleUpdateName} className="text-lg font-black uppercase tracking-tight text-slate-800 dark:text-slate-200 drop-shadow-sm w-full" />
                  </div>
                  <div className="flex gap-1.5 flex-wrap">
                      <div className={`px-2 py-0.5 rounded-md text-[9px] font-bold border flex items-center gap-1 shadow-sm text-white bg-slate-500 border-slate-600`} title="Players">
                          <Users size={10} strokeWidth={2.5} /> {displayedPlayers.length}
                      </div>
                      <div className={`px-2 py-0.5 rounded-md text-[9px] font-bold border flex items-center gap-1 shadow-sm bg-slate-200 dark:bg-white/10 border-slate-300 dark:border-white/5 text-slate-700 dark:text-slate-200`} title="Avg Team Skill">
                          <Activity size={10} strokeWidth={2.5} /> {teamStrength}
                      </div>
                  </div>
              </div>

              <div className="flex items-center justify-between border-t border-slate-200 dark:border-white/5 pt-2 mt-1">
                  <div className="flex items-center gap-1">
                      {onReorder && (
                          <>
                              {queueIndex > 0 && (
                                <button 
                                    onClick={(e) => { e.stopPropagation(); onReorder(queueIndex, 0); }} 
                                    className={`p-1.5 rounded-lg transition-colors bg-amber-500/10 text-amber-600 hover:bg-amber-500/20 dark:text-amber-400 active:scale-95`}
                                    title={t('teamManager.queueActions.moveToTop')}
                                >
                                    <ChevronsUp size={14} strokeWidth={2.5} />
                                </button>
                              )}
                              {queueIndex > 1 && (
                                <button 
                                    onClick={(e) => { e.stopPropagation(); onReorder(queueIndex, queueIndex - 1); }} 
                                    className="p-1.5 rounded-lg bg-slate-100 dark:bg-white/10 text-slate-600 hover:bg-slate-200 transition-colors active:scale-95" 
                                    title={t('teamManager.queueActions.moveUp')}
                                >
                                    <ChevronUp size={14} />
                                </button>
                              )}
                              {queueIndex < queueSize - 1 && (
                                <button 
                                    onClick={(e) => { e.stopPropagation(); onReorder(queueIndex, queueIndex + 1); }} 
                                    className="p-1.5 rounded-lg bg-slate-100 dark:bg-white/10 text-slate-600 hover:bg-slate-200 transition-colors active:scale-95" 
                                    title={t('teamManager.queueActions.moveDown')}
                                >
                                    <ChevronDown size={14} />
                                </button>
                              )}
                          </>
                      )}
                  </div>
                  
                  <div className="flex items-center gap-1">
                      <button 
                          onClick={(e) => { e.stopPropagation(); toggleTeamBench(id); }} 
                          onPointerDown={(e) => e.stopPropagation()} 
                          className={`p-1.5 rounded-lg border border-transparent transition-all active:scale-95 ${team.hasActiveBench ? 'bg-emerald-500 text-white shadow-sm shadow-emerald-500/20' : 'bg-slate-100 dark:bg-white/10 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'}`} 
                          title={team.hasActiveBench ? "Deactivate Bench" : "Activate Bench (Reserves)"}
                      >
                          <Armchair size={14} fill={team.hasActiveBench ? 'currentColor' : 'none'} />
                      </button>

                      <div className="relative">
                          <button 
                              onClick={(e) => { e.stopPropagation(); setShowSortMenu(!showSortMenu); }} 
                              className={`p-1.5 rounded-lg border border-transparent hover:bg-slate-100 dark:hover:bg-white/10 transition-colors active:scale-95 ${showSortMenu ? 'bg-slate-100 dark:bg-white/10' : 'bg-slate-100 dark:bg-white/10 text-slate-500'}`}
                              title="Sort Team"
                          >
                              <ListFilter size={14} />
                          </button>
                          <SortMenuDropdown />
                      </div>

                      {onDisband && (
                          <button onClick={() => onDisband(id)} className="p-1.5 rounded-lg bg-rose-50 dark:bg-rose-500/10 text-rose-500 hover:bg-rose-100 transition-colors ml-1 active:scale-95" title={t('teamManager.queueActions.disband')}>
                              <Trash2 size={14} />
                          </button>
                      )}
                  </div>
              </div>
          </div>
      ) : (
        <div className="flex flex-col mb-2 w-full">
            <div className="flex items-center gap-3 mb-2 w-full">
                <div className={`w-1 h-8 self-center rounded-full ${colorConfig.halo} shadow-[0_0_8px_currentColor] opacity-90 flex-shrink-0 hidden landscape:block`} />
                <TeamLogoUploader currentLogo={team.logo} onUpdate={handleUpdateLogo} teamName={team.name} />
                <div className="flex-1 min-w-0">
                    <EditableTitle name={team.name} onSave={handleUpdateName} className={`text-lg landscape:text-base font-black uppercase tracking-tight ${colorConfig.text} ${colorConfig.textDark} drop-shadow-sm w-full`} />
                </div>
                <div className="flex gap-1.5 flex-wrap">
                    <div className={`px-2 py-0.5 rounded-md text-[9px] font-bold border flex items-center gap-1 shadow-sm text-white ${colorConfig.bg} ${colorConfig.border}`}><Users size={10} strokeWidth={2.5} /> {displayedPlayers.length}</div>
                    <div className={`px-2 py-0.5 rounded-md text-[9px] font-bold border flex items-center gap-1 shadow-sm ${colorConfig.bg.replace('/20', '/40')} ${colorConfig.border} dark:text-white dark:border-white/20 text-slate-700`} title="Avg Team Skill"><Activity size={10} strokeWidth={2.5} /> {teamStrength}</div>
                </div>
            </div>

            <div className="flex items-center justify-end gap-2 border-b border-slate-200 dark:border-white/5 pb-2 mb-2 w-full">
                <button onClick={(e) => { e.stopPropagation(); toggleTeamBench(id); }} onPointerDown={(e) => e.stopPropagation()} className={`p-1.5 rounded-lg border border-transparent transition-all active:scale-95 ${team.hasActiveBench ? 'bg-emerald-500 text-white shadow-sm shadow-emerald-500/20' : 'bg-slate-100 dark:bg-white/10 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'}`} title={team.hasActiveBench ? "Deactivate Bench" : "Activate Bench (Reserves)"}><Armchair size={14} fill={team.hasActiveBench ? 'currentColor' : 'none'} /></button>
                <div className="relative">
                    <button onClick={() => setShowSortMenu(!showSortMenu)} className={`p-1.5 rounded-lg border border-transparent hover:bg-slate-100 dark:hover:bg-white/10 transition-colors active:scale-95 ${showSortMenu ? 'bg-slate-100 dark:bg-white/10' : ''}`}><ListFilter size={14} className={`${colorConfig.text}`} /></button>
                    <SortMenuDropdown />
                </div>
            </div>
            
            {viewMode === 'main' && <ColorPicker selected={team.color || 'slate'} onChange={handleUpdateColor} usedColors={usedColors} />}
        </div>
      )}

      {team.hasActiveBench && (<div className="flex justify-end mb-2 gap-2 px-1"><button onClick={() => setIsSubModalOpen(true)} className={`flex items-center justify-center p-2 rounded-xl text-[9px] font-bold uppercase tracking-wider transition-all bg-white/50 dark:bg-white/5 border border-slate-200 dark:border-white/5 text-slate-500 hover:text-indigo-500 shadow-sm active:scale-95`} title="Substitute Player"><ArrowRightLeft size={16} /></button><button onClick={toggleView} className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-[9px] font-bold uppercase tracking-wider transition-all active:scale-95 ${viewMode === 'reserves' ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/20' : 'bg-slate-100 dark:bg-white/5 text-slate-500 hover:bg-slate-200 dark:hover:bg-white/10'}`}>{viewMode === 'reserves' ? <ChevronLeft size={14} /> : null}{viewMode === 'reserves' ? t('common.back') : t('teamManager.benchLabel')}{viewMode === 'main' ? <ChevronRight size={14} /> : null}</button></div>)}
      
      <motion.div variants={staggerContainer} initial="hidden" animate="visible" className={`flex-1 space-y-2 mt-1 overflow-y-auto custom-scrollbar px-0 ${isQueue ? 'min-h-[40px]' : 'min-h-[60px]'}`} onScroll={dispatchScrollEvent}>
        {displayedPlayers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 opacity-60 border border-dashed border-slate-200 dark:border-white/5 rounded-xl bg-slate-50/50 dark:bg-white/[0.01]">
                <div className="p-2 bg-slate-100 dark:bg-white/5 rounded-full mb-2">
                    <UserPlus size={20} className="text-slate-400" />
                </div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{viewMode === 'reserves' ? t('common.empty') : t('teamManager.dragPlayersHere')}</span>
            </div>
        ) : (
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
        )}
      </motion.div>
      <AddPlayerInput onAdd={handleAdd} disabled={isFull} customLabel={addButtonLabel} />
    </div>
  );
}, (prev, next) => prev.team === next.team && prev.profiles === next.profiles && prev.usedColors === next.usedColors && prev.isQueue === next.isQueue && prev.activePlayerMenuId === next.activePlayerMenuId && prev.isNext === next.isNext && prev.queueIndex === next.queueIndex && prev.queueSize === next.queueSize && prev.isDragOver === next.isDragOver && prev.activeNumberId === next.activeNumberId && prev.onUpdatePlayer === next.onUpdatePlayer && prev.onShowToast === next.onShowToast && prev.onUpdateTeamName === next.onUpdateTeamName && prev.highlighted === next.highlighted);

const ProfileCard = memo(({ profile, onDelete, onAddToGame, status, onEdit, placementOptions, onView, teamColor, onShowToast }: { profile: PlayerProfile; onDelete: () => void; onAddToGame: (target: string) => { success: boolean, errorKey?: string, errorParams?: any, error?: string }; status: PlayerLocationStatus; onEdit: () => void; placementOptions: PlacementOption[]; onView: () => void; teamColor?: TeamColor; onShowToast: (msg: string, type: any, undo?: any) => void }) => {
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
        if(e.nativeEvent) e.nativeEvent.stopImmediatePropagation();
        
        if (showJoinMenu) { 
            setShowJoinMenu(false); 
        } else if (joinButtonRef.current) { 
            const rect = joinButtonRef.current.getBoundingClientRect(); 
            const optionHeight = 44; 
            const estimatedMenuHeight = (placementOptions.length * optionHeight) + 16; 
            const spaceBelow = window.innerHeight - rect.bottom; 
            let top = rect.bottom + 4; 
            if (spaceBelow < estimatedMenuHeight) { top = rect.top - estimatedMenuHeight - 4; } 
            setMenuPos({ top, left: rect.left, width: 200 }); 
            setShowJoinMenu(true); 
        }
    };
    
    const handleAddClick = (targetId: string) => {
        const res = onAddToGame(targetId);
        if (!res.success) {
            onShowToast(res.errorKey ? t(res.errorKey, res.errorParams) : (res.error || t('notifications.cannotAdd')), 'error');
        }
        setShowJoinMenu(false);
    };

    const handleDelete = (e: React.MouseEvent) => {
        e.stopPropagation();
        if(e.nativeEvent) e.nativeEvent.stopImmediatePropagation();
        onDelete();
    };

    const handleEdit = (e: React.MouseEvent) => {
        e.stopPropagation();
        if(e.nativeEvent) e.nativeEvent.stopImmediatePropagation();
        onEdit();
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
    
    const cardBg = teamTheme 
        ? `${teamTheme.bg.replace('/20', '/10')} dark:${teamTheme.bg.replace('/20', '/20')} border-${teamColor}-200 dark:border-${teamColor}-500/30` 
        : 'bg-white/80 dark:bg-white/[0.04] border-slate-200 dark:border-white/10 hover:border-slate-300 dark:hover:border-white/20 hover:bg-white dark:hover:bg-white/[0.08]';
    
    return (
        <motion.div 
            variants={staggerItem} 
            className={`
                group relative flex items-center
                p-3 rounded-2xl border transition-all 
                min-h-[70px] gap-3 backdrop-blur-md shadow-sm
                ${cardBg}
            `}
        >
            <div className="relative cursor-pointer shrink-0" onClick={onView}>
                <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-black/20 flex items-center justify-center text-2xl shadow-inner border border-slate-200 dark:border-white/5">
                    {profile.avatar || '👤'}
                </div>
                {profile.number && (
                    <div className="absolute -top-2 -right-2 bg-slate-900 text-white dark:bg-white dark:text-black text-[9px] font-black w-5 h-5 rounded-full flex items-center justify-center shadow-md border-2 border-white dark:border-slate-900 z-10">
                        {profile.number}
                    </div>
                )}
            </div>

            <div className="flex flex-col flex-1 min-w-0 justify-center h-full gap-1" onClick={onView}>
                <h4 className="font-bold text-slate-900 dark:text-slate-100 truncate text-sm leading-tight pr-1">
                    {profile.name}
                </h4>
                <div className="flex items-center gap-2 min-w-0">
                    <div className="flex items-center gap-1 bg-white/70 dark:bg-white/5 px-1.5 py-0.5 rounded-md text-[9px] font-bold text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-white/5 shrink-0">
                        <Star size={8} className="text-amber-400 fill-amber-400" />
                        <span>Lvl {profile.skillLevel}</span>
                    </div>

                    {RoleIcon && (
                        <div className={`flex items-center justify-center p-0.5 rounded-lg ${roleColor.replace('text-', 'bg-').replace('500', '500/10')} shrink-0`}>
                            <RoleIcon size={10} className={roleColor} strokeWidth={3} />
                        </div>
                    )}
                    
                    {status && (
                        <div className={`px-1.5 py-0.5 rounded-md text-[8px] font-bold uppercase tracking-wider border shadow-sm shrink-0 truncate ${teamTheme ? `${teamTheme.bg} ${teamTheme.textDark} ${teamTheme.border}` : 'bg-slate-100 text-slate-600'}`}>
                            {statusLabels[status] || status}
                        </div>
                    )}
                </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
                {!status ? (
                    <button ref={joinButtonRef} onClick={handleToggleJoinMenu} onPointerDown={(e) => e.stopPropagation()} className="w-9 h-9 flex items-center justify-center bg-indigo-500 hover:bg-indigo-600 text-white rounded-xl shadow-md shadow-indigo-500/20 active:scale-95 transition-all">
                        <PlusCircle size={18} />
                    </button>
                ) : (
                    <div className="w-9 h-9 flex items-center justify-center text-slate-400 cursor-not-allowed bg-slate-100 dark:bg-white/5 rounded-xl border border-transparent">
                        <Check size={18} />
                    </div>
                )}
                
                <div className="flex flex-col gap-1">
                     <button onClick={handleEdit} onPointerDown={(e) => e.stopPropagation()} className="w-6 h-6 flex items-center justify-center text-slate-400 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 rounded-lg transition-all active:scale-90">
                        <Edit2 size={12} />
                    </button>
                    <button onClick={handleDelete} onPointerDown={(e) => e.stopPropagation()} className="w-6 h-6 flex items-center justify-center text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-lg transition-all active:scale-90">
                        <Trash2 size={12} />
                    </button>
                </div>
            </div>

            {showJoinMenu && menuPos && createPortal(<div className="fixed z-[9999]" style={{ top: menuPos.top, left: menuPos.left }}><motion.div ref={menuRef} initial={{ opacity: 0, y: 5, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 5, scale: 0.95 }} className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-black/10 dark:border-white/10 overflow-hidden flex flex-col p-1 w-48 max-h-48 overflow-y-auto custom-scrollbar">{placementOptions.map(opt => (<button key={opt.targetId} onClick={() => handleAddClick(opt.targetId)} className="w-full text-left px-3 py-2 text-[10px] font-bold uppercase tracking-wide hover:bg-slate-100 dark:hover:bg-white/10 rounded-lg text-slate-600 dark:text-slate-300 truncate flex items-center gap-2">{opt.teamColor && <div className={`w-2 h-2 rounded-full ${resolveTheme(opt.teamColor).halo}`} />}{opt.label}</button>))}</motion.div></div>, document.body)}
        </motion.div>
    );
});

const BatchInputSection = memo(({ onGenerate }: { onGenerate: (names: string[]) => void }) => {
    const { t } = useTranslation();
    const [rawNames, setRawNames] = useState('');
    const handleGenerate = () => { const names = rawNames.split('\n').map(n => n.trim()).filter(n => n); if (names.length > 0) { onGenerate(names); setRawNames(''); } };
    return (<div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 px-2 pb-10 pt-2"> 
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4 flex items-start gap-3 text-xs text-amber-700 dark:text-amber-400 shadow-sm">
            <AlertCircle size={18} className="mt-0.5 flex-shrink-0" />
            <div>
                <p className="font-bold mb-1">{t('teamManager.batch.tipTitle')}</p>
                <p className="bg-amber-500/10 inline-block px-1.5 py-0.5 rounded mb-1 font-mono text-[9px]"><code>{t('teamManager.batch.tipFormat')}</code></p>
                <p className="opacity-80 leading-relaxed text-[10px]">{t('teamManager.batch.tipDesc')}</p>
            </div>
        </div>
        <textarea className="w-full h-64 bg-white/50 dark:bg-black/40 border border-slate-200 dark:border-white/10 rounded-2xl p-4 text-slate-800 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 font-mono text-xs resize-none custom-scrollbar shadow-inner" placeholder={t('teamManager.batch.placeholder')} value={rawNames} onChange={e => setRawNames(e.target.value)} />
        <Button onClick={handleGenerate} className="w-full h-10 text-xs uppercase tracking-widest active:scale-95" size="lg"><Shuffle size={16} /> {t('teamManager.generateTeams')}</Button>
    </div>);
});

const RosterBoard = ({ courtA, courtB, queue, onUpdatePlayer, wrappedAdd, handleKnockoutRequest, usedColors, wrappedMove, playerStatsMap, setEditingTarget, setViewingProfileId, handleTogglePlayerMenu, activePlayerMenu, toggleTeamBench, wrappedUpdateColor, wrappedUpdateLogo, substitutePlayers, reorderQueue, handleDisbandTeam, dragOverContainerId, onShowToast, profiles, wrappedSaveProfile, onRequestProfileEdit, activeNumberId, onRequestEditNumber, onUpdateTeamName }: any) => {
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

    const handleReorderLocal = useCallback((from: number, to: number) => {
        if (reorderQueue) {
            const team = queue[from];
            if (team) {
                lastMovedTeamId.current = team.id;
            }
            reorderQueue(from, to);
            pendingScrollToIndex.current = to;
        }
    }, [reorderQueue, queue]);

    useEffect(() => {
        if (!queueSearchTerm.trim()) {
            setHighlightedTeamId(null);
            return;
        }

        const searchTerm = queueSearchTerm.toLowerCase();
        const matchIndex = queue.findIndex((t: Team) => 
            t.name.toLowerCase().includes(searchTerm)
        );

        if (matchIndex !== -1) {
            const teamId = queue[matchIndex].id;
            setHighlightedTeamId(teamId);
            
            if (queueScrollRef.current) {
                const cardWidth = queueScrollRef.current.firstElementChild?.clientWidth || 300; 
                const scrollPos = matchIndex * (cardWidth + 16); 
                
                queueScrollRef.current.scrollTo({
                    left: scrollPos,
                    behavior: 'smooth'
                });
            }
        } else {
            setHighlightedTeamId(null);
        }
    }, [queueSearchTerm, queue]);

    const checkScroll = useCallback(() => {
        if (!queueScrollRef.current) return;
        const { scrollLeft, scrollWidth, clientWidth } = queueScrollRef.current;
        setCanScrollLeft(scrollLeft > 20); 
        setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 20);
        
        const width = clientWidth;
        if (width > 0) {
            const page = Math.round(scrollLeft / width) + 1; 
            setQueuePage(page); 
        }
        dispatchScrollEvent();
    }, []);

    const onQueueScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => { 
        checkScroll();
    }, [checkScroll]);

    useEffect(() => {
        checkScroll();
        if (queue.length > 1 && queueScrollRef.current) {
            setTimeout(() => {
                if (queueScrollRef.current) {
                    queueScrollRef.current.scrollTo({ left: 60, behavior: 'smooth' });
                    setTimeout(() => {
                        if (queueScrollRef.current) {
                            queueScrollRef.current.scrollTo({ left: 0, behavior: 'smooth' });
                        }
                    }, 400);
                }
            }, 600);
        }
    }, [queue.length, checkScroll]);

    const scrollContainer = (direction: 'left' | 'right') => {
        if (queueScrollRef.current) {
            const width = 320; 
            const scrollAmount = direction === 'left' ? -width : width;
            queueScrollRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
        }
    };

    useDndMonitor({ onDragStart: () => setIsAutoScrolling(true), onDragEnd: () => { setIsAutoScrolling(false); autoScrollDirection.current = null; }, onDragCancel: () => { setIsAutoScrolling(false); autoScrollDirection.current = null; } });
    useEffect(() => { if (!isAutoScrolling) return; const handleMouseMove = (e: MouseEvent | TouchEvent) => { if (!queueScrollRef.current) return; const rect = queueScrollRef.current.getBoundingClientRect(); const x = (e as MouseEvent).clientX || (e as TouchEvent).touches?.[0]?.clientX || 0; const EDGE_SIZE = 50; const y = (e as MouseEvent).clientY || (e as TouchEvent).touches?.[0]?.clientY || 0; if (y < rect.top || y > rect.bottom) { autoScrollDirection.current = null; return; } if (x < rect.left + EDGE_SIZE) { autoScrollDirection.current = 'left'; } else if (x > rect.right - EDGE_SIZE) { autoScrollDirection.current = 'right'; } else { autoScrollDirection.current = null; } }; window.addEventListener('mousemove', handleMouseMove); window.addEventListener('touchmove', handleMouseMove); const interval = setInterval(() => { if (autoScrollDirection.current && queueScrollRef.current) { const scrollAmount = 10; queueScrollRef.current.scrollBy({ left: autoScrollDirection.current === 'left' ? -scrollAmount : scrollAmount, behavior: 'auto' }); } }, 16); return () => { window.removeEventListener('mousemove', handleMouseMove); window.removeEventListener('touchmove', handleMouseMove); clearInterval(interval); }; }, [isAutoScrolling]);
    
    useEffect(() => {
        if (lastMovedTeamId.current) {
            const el = document.getElementById(`queue-card-${lastMovedTeamId.current}`);
            if (el) {
                el.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
                lastMovedTeamId.current = null;
                pendingScrollToIndex.current = null;
            }
        }
        
        if (pendingScrollToIndex.current !== null && queueScrollRef.current && !lastMovedTeamId.current) {
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
                        checkScroll();
                    }
                }, 150);
            });
        }
        prevQueueLen.current = queue.length;
    }, [queue.length, queue, checkScroll]);

    return (
        <motion.div variants={staggerContainer} initial="hidden" animate="visible" className="flex flex-col gap-6 landscape:gap-4 pb-24 landscape:pb-8 px-0 min-h-[70vh] pt-2">
            
            {/* MAIN COURTS - Side-by-Side in Landscape */}
            <div className="flex flex-col md:flex-row gap-6 md:gap-4 landscape:flex-row w-full">
                <motion.div variants={staggerItem} className="w-full flex-1">
                    <TeamColumn id="A" team={courtA} onUpdatePlayer={onUpdatePlayer} onAddPlayer={wrappedAdd} onKnockoutRequest={handleKnockoutRequest} usedColors={usedColors} onMove={wrappedMove} statsMap={playerStatsMap} onRequestProfileEdit={(pid: string) => setEditingTarget({ type: 'player', id: pid })} onViewProfile={(pid: string) => setViewingProfileId(pid)} onTogglePlayerMenu={handleTogglePlayerMenu} activePlayerMenuId={activePlayerMenu?.playerId || null} profiles={profiles} onUpdateTeamName={onUpdateTeamName} onUpdateTeamColor={wrappedUpdateColor} onUpdateTeamLogo={wrappedUpdateLogo} onSaveProfile={wrappedSaveProfile} onSortTeam={()=>{}} toggleTeamBench={toggleTeamBench} substitutePlayers={substitutePlayers} isDragOver={dragOverContainerId === 'A' || dragOverContainerId === 'A_Reserves'} onShowToast={onShowToast} activeNumberId={activeNumberId} onRequestEditNumber={onRequestEditNumber} />
                </motion.div>
                
                <motion.div variants={staggerItem} className="w-full flex-1">
                    <TeamColumn id="B" team={courtB} onUpdatePlayer={onUpdatePlayer} onAddPlayer={wrappedAdd} onKnockoutRequest={handleKnockoutRequest} usedColors={usedColors} onMove={wrappedMove} statsMap={playerStatsMap} onRequestProfileEdit={(pid: string) => setEditingTarget({ type: 'player', id: pid })} onViewProfile={(pid: string) => setViewingProfileId(pid)} onTogglePlayerMenu={handleTogglePlayerMenu} activePlayerMenuId={activePlayerMenu?.playerId || null} profiles={profiles} onUpdateTeamName={onUpdateTeamName} onUpdateTeamColor={wrappedUpdateColor} onUpdateTeamLogo={wrappedUpdateLogo} onSaveProfile={wrappedSaveProfile} onSortTeam={()=>{}} toggleTeamBench={toggleTeamBench} substitutePlayers={substitutePlayers} isDragOver={dragOverContainerId === 'B' || dragOverContainerId === 'B_Reserves'} onShowToast={onShowToast} activeNumberId={activeNumberId} onRequestEditNumber={onRequestEditNumber} />
                </motion.div>
            </div>
            
            <motion.div variants={staggerItem} className="w-full flex-1 flex flex-col min-h-[200px] mt-4 relative">
                <div className="flex items-center justify-between px-2 mb-3">
                    <div className="flex items-center gap-2">
                        <div className="px-3 py-1 bg-slate-200 dark:bg-white/10 rounded-full text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 flex items-center gap-2">
                            <Layers size={12} />
                            <span>{t('teamManager.queue')}</span>
                            <span className="bg-white dark:bg-black/20 px-1.5 rounded text-slate-600 dark:text-slate-300">{queue.length}</span>
                        </div>
                        {queue.length > 1 && (<div className="px-3 py-1 rounded-full bg-transparent text-[9px] font-bold text-slate-400 border border-slate-200 dark:border-white/10">{t('common.step', {number: `${queuePage} / ${queue.length}`})}</div>)}
                    </div>
                    
                    <div className="relative group w-32">
                        <Search className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                        <input value={queueSearchTerm} onChange={(e) => setQueueSearchTerm(e.target.value)} placeholder={t('teamManager.searchQueue')} className="w-full bg-white dark:bg-white/5 border border-slate-200 dark:border-white/5 rounded-xl pl-8 pr-6 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 focus:outline-none focus:border-indigo-500/50 transition-all placeholder:text-slate-400" />
                        {queueSearchTerm && (
                            <button onClick={() => setQueueSearchTerm('')} className="absolute right-1 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 active:scale-90 transition-transform">
                                <X size={12} strokeWidth={3} />
                            </button>
                        )}
                    </div>
                </div>

                <div className="relative group/queue">
                    <div ref={queueScrollRef} onScroll={onQueueScroll} className="flex-1 min-h-0 overflow-x-auto snap-x snap-mandatory no-scrollbar flex items-stretch pb-2 gap-6 p-6 mask-linear-fade-sides" style={{ maskImage: 'linear-gradient(to right, transparent, black 5%, black 95%, transparent)', WebkitMaskImage: 'linear-gradient(to right, transparent, black 5%, black 95%, transparent)' }}>
                        {queue.length === 0 ? (
                            <div className="flex-1 flex flex-col items-center justify-center h-full text-slate-400 italic gap-3 min-h-[160px] w-full border border-dashed border-slate-200 dark:border-white/10 rounded-2xl bg-slate-50/50 dark:bg-white/[0.01]">
                                <div className="p-3 bg-slate-100 dark:bg-white/5 rounded-full">
                                    <List size={24} className="opacity-30" />
                                </div>
                                <div className="flex flex-col items-center gap-1">
                                    <span className="text-xs font-bold uppercase tracking-widest opacity-60">{t('teamManager.queueEmpty')}</span>
                                    <span className="text-[10px] opacity-40">Add teams to rotation</span>
                                </div>
                            </div>
                        ) : (
                            <AnimatePresence initial={false} mode="popLayout">
                                {queue.map((team: Team, idx: number) => (
                                    <motion.div 
                                        id={`queue-card-${team.id}`}
                                        key={team.id} 
                                        layout="position" 
                                        layoutId={`queue-card-${team.id}`} 
                                        initial={{ opacity: 0, scale: 0.95 }} 
                                        animate={{ opacity: 1, scale: 1 }} 
                                        exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }} 
                                        transition={{ type: "spring", stiffness: 60, damping: 15, mass: 1 }} 
                                        className="snap-center w-80 flex-shrink-0 h-full flex flex-col"
                                    > 
                                        <TeamColumn 
                                            id={team.id} 
                                            team={team} 
                                            profiles={profiles} 
                                            onUpdateTeamName={onUpdateTeamName} 
                                            onUpdateTeamColor={wrappedUpdateColor} 
                                            onUpdateTeamLogo={wrappedUpdateLogo} 
                                            onSaveProfile={wrappedSaveProfile} 
                                            onSortTeam={()=>{}} 
                                            toggleTeamBench={toggleTeamBench} 
                                            substitutePlayers={()=>{}} 
                                            onUpdatePlayer={onUpdatePlayer} 
                                            onAddPlayer={wrappedAdd} 
                                            onKnockoutRequest={handleKnockoutRequest} 
                                            usedColors={usedColors} 
                                            isQueue={true} 
                                            onMove={wrappedMove} 
                                            statsMap={playerStatsMap} 
                                            onRequestProfileEdit={(pid: string) => setEditingTarget({ type: 'player', id: pid })} 
                                            onViewProfile={(pid: string) => setViewingProfileId(pid)} 
                                            onTogglePlayerMenu={handleTogglePlayerMenu} 
                                            activePlayerMenuId={activePlayerMenu?.playerId || null} 
                                            isNext={idx === 0} 
                                            onDisband={handleDisbandTeam} 
                                            onReorder={handleReorderLocal} 
                                            queueIndex={idx} 
                                            queueSize={queue.length} 
                                            isDragOver={dragOverContainerId === team.id || dragOverContainerId === `${team.id}_Reserves`} 
                                            onShowToast={onShowToast} 
                                            activeNumberId={activeNumberId} 
                                            onRequestEditNumber={onRequestEditNumber}
                                            highlighted={highlightedTeamId === team.id}
                                        />
                                    </motion.div>
                                ))}
                            </AnimatePresence>
                        )}
                    </div>

                    <AnimatePresence>
                        {canScrollLeft && (
                            <motion.button 
                                initial={{ opacity: 0, x: -10 }} 
                                animate={{ opacity: 1, x: 0 }} 
                                exit={{ opacity: 0, x: -10 }}
                                onClick={() => scrollContainer('left')}
                                className="absolute left-2 top-1/2 -translate-y-1/2 z-40 w-9 h-9 flex items-center justify-center rounded-full bg-black/20 dark:bg-white/10 backdrop-blur-md shadow-lg border border-white/10 text-white hover:bg-black/40 dark:hover:bg-white/20 hover:scale-110 transition-transform active:scale-90"
                            >
                                <ChevronLeft size={18} strokeWidth={2.5} />
                            </motion.button>
                        )}
                        {canScrollRight && (
                            <motion.button 
                                initial={{ opacity: 0, x: 10 }} 
                                animate={{ opacity: 1, x: 0 }} 
                                exit={{ opacity: 0, x: 10 }}
                                onClick={() => scrollContainer('right')}
                                className="absolute right-2 top-1/2 -translate-y-1/2 z-40 w-9 h-9 flex items-center justify-center rounded-full bg-black/20 dark:bg-white/10 backdrop-blur-md shadow-lg border border-white/10 text-white hover:bg-black/40 dark:hover:bg-white/20 hover:scale-110 transition-transform active:scale-90"
                            >
                                <ChevronRight size={18} strokeWidth={2.5} />
                            </motion.button>
                        )}
                    </AnimatePresence>
                </div>

                <div className="pt-2 flex-shrink-0"><AddPlayerInput onAdd={(n, num, s) => wrappedAdd(n, 'Queue', num, s)} customLabel={t('teamManager.addPlayerQueue')} /></div>
            </motion.div>
        </motion.div>
    );
};

export const TeamManagerModal: React.FC<TeamManagerModalProps> = (props) => {
  const { t } = useTranslation();
  const { activeTutorial, triggerTutorial, completeTutorial, isLoaded } = useTutorial(false);
  
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
  
  const [benchConfirmState, setBenchConfirmState] = useState<{ teamId: string, playerId: string, sourceId: string } | null>(null);
  const [dropConfirmState, setDropConfirmState] = useState<{ playerId: string; sourceId: string; targetTeamId: string; index: number; } | null>(null);
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
          onShowToast(
              t('notifications.finishEditing'),
              'info', 
              t('notifications.finishEditingSub'),
              'alert'
          );
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

  const wrappedAdd = useCallback((name: string, target: string, number?: string, skill?: number) => { 
      const result = props.onAddPlayer(name, target, number, skill);
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

  const handleDeleteWithUndo = useCallback((playerId: string) => {
      let player: Player | undefined;
      const findIn = (list: Player[]) => list.find(p => p.id === playerId);
      player = findIn(props.courtA.players) || findIn(props.courtA.reserves || []) || findIn(props.courtB.players) || findIn(props.courtB.reserves || []) || props.queue.flatMap(t => [...t.players, ...(t.reserves || [])]).find(p => p.id === playerId);

      if (onDeletePlayer) {
          onDeletePlayer(playerId);
      }
      setActivePlayerMenu(null);
      if (player && props.onUndoRemove) {
          onShowToast(t('teamManager.playerRemoved'), 'info', player.name, 'delete', props.onUndoRemove);
      }
  }, [props.courtA, props.courtB, props.queue, onDeletePlayer, props.onUndoRemove, t, onShowToast]);

  const requestProfileDelete = useCallback((profileId: string) => { setProfileToDeleteId(profileId); }, []);

  const executeProfileDelete = useCallback(() => {
      if (!profileToDeleteId) return;
      const profileId = profileToDeleteId;
      if (!deleteProfile) return;
      const deletedProfile = deleteProfile(profileId);
      
      if (deletedProfile && upsertProfile && relinkProfile) {
          const backup = { ...deletedProfile };
          onShowToast(t('teamManager.playerRemoved'), 'info', backup.name, 'delete', () => { upsertProfile(backup.name, backup.skillLevel, backup.id, { number: backup.number, avatar: backup.avatar, role: backup.role }); relinkProfile(backup); });
      }
      setProfileToDeleteId(null);
  }, [deleteProfile, upsertProfile, relinkProfile, t, onShowToast, profileToDeleteId]);

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
    
    const activeData = active.data.current as { fromId: string, player: Player } | undefined;
    const overData = over.data.current as { containerId?: string, player?: Player, fromId?: string } | undefined;

    const sourceContainerId = activeData?.fromId;
    let targetContainerId = overData?.containerId || overData?.fromId;

    if (!targetContainerId && (over.id === 'A' || over.id === 'B' || over.id === 'A_Reserves' || over.id === 'B_Reserves' || String(over.id).endsWith('_Reserves'))) {
        targetContainerId = String(over.id);
    }
    if (!targetContainerId && (String(over.id).length > 20)) {
         targetContainerId = String(over.id); 
    }

    if (!sourceContainerId || !targetContainerId) return;
    if (sourceContainerId === targetContainerId) return; 

    const targetTeamObj = getTeamById(targetContainerId);
    
    if (targetContainerId.endsWith('_Reserves') && targetTeamObj && !targetTeamObj.hasActiveBench) {
        setBenchConfirmState({ teamId: targetTeamObj.id, playerId: activeId, sourceId: sourceContainerId });
        return;
    }

    if (!targetContainerId.endsWith('_Reserves') && targetTeamObj && targetTeamObj.players.length >= 6) {
        setDropConfirmState({ playerId: activeId, sourceId: sourceContainerId, targetTeamId: targetTeamObj.id, index: 0 });
        return;
    }

    haptics.impact('medium');
    wrappedMove(activeId, sourceContainerId, targetContainerId, undefined);
  };

  const usedColors = new Set([props.courtA.color, props.courtB.color]);

  const handleBatchGenerate = (names: string[]) => {
      props.onGenerate(names);
      setActiveTab('roster');
      haptics.notification('success');
  };

  return (
    createPortal(
    <Modal isOpen={props.isOpen} onClose={handleCloseAttempt} title={t('teamManager.title')} maxWidth="max-w-6xl" zIndex="z-[50]">
        
        {activeTutorial === 'manager' && (
            <RichTutorialModal 
                isOpen={true} 
                tutorialKey="manager" 
                onClose={completeTutorial} 
            />
        )}

        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragOver={handleDragOver} onDragEnd={handleDragEnd}>
            
            <div className="flex flex-col landscape:flex-row h-full">
                
                {/* --- SIDEBAR TABS (Landscape) --- */}
                <div className="flex landscape:flex-col landscape:w-48 landscape:h-full landscape:border-r border-black/5 dark:border-white/5 landscape:mr-4 shrink-0">
                    <div className="flex landscape:flex-col p-1 bg-slate-100 dark:bg-white/5 rounded-2xl landscape:rounded-[1.2rem] w-full gap-1 mb-2 landscape:mb-0">
                        <button onClick={() => setActiveTab('roster')} className={`flex-1 landscape:w-full py-2.5 landscape:py-3 rounded-xl text-[10px] sm:text-xs font-black uppercase tracking-wider flex items-center justify-center landscape:justify-start landscape:pl-4 gap-2 transition-all active:scale-95 ${activeTab === 'roster' ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'}`}>
                            <Users size={14} /> {t('teamManager.tabs.roster')}
                        </button>
                        <button onClick={() => setActiveTab('profiles')} className={`flex-1 landscape:w-full py-2.5 landscape:py-3 rounded-xl text-[10px] sm:text-xs font-black uppercase tracking-wider flex items-center justify-center landscape:justify-start landscape:pl-4 gap-2 transition-all active:scale-95 ${activeTab === 'profiles' ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'}`}>
                            <User size={14} /> {t('teamManager.tabs.profiles')}
                        </button>
                        <button onClick={() => setActiveTab('input')} className={`flex-1 landscape:w-full py-2.5 landscape:py-3 rounded-xl text-[10px] sm:text-xs font-black uppercase tracking-wider flex items-center justify-center landscape:justify-start landscape:pl-4 gap-2 transition-all active:scale-95 ${activeTab === 'input' ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'}`}>
                            <List size={14} /> {t('teamManager.tabs.batch')}
                        </button>
                    </div>
                </div>

                <div className="flex-1 overflow-hidden relative">
                    {activeTab === 'roster' && (
                        <>
                            <div className="flex justify-between items-center px-1 py-1 mb-2 shrink-0 flex-wrap gap-2">
                                <div className="flex gap-2">
                                    <button onClick={() => props.onSetRotationMode('standard')} className={`px-3 py-2 rounded-xl text-[9px] font-bold uppercase border transition-all active:scale-95 ${props.rotationMode === 'standard' ? 'bg-indigo-500 text-white border-indigo-600 shadow-lg shadow-indigo-500/20' : 'bg-transparent border-slate-200 dark:border-white/10 text-slate-400'}`} title={t('teamManager.modes.standardTooltip')}>{t('teamManager.modes.standard')}</button>
                                    <button onClick={() => props.onSetRotationMode('balanced')} className={`px-3 py-2 rounded-xl text-[9px] font-bold uppercase border transition-all active:scale-95 ${props.rotationMode === 'balanced' ? 'bg-emerald-500 text-white border-emerald-600 shadow-lg shadow-emerald-500/20' : 'bg-transparent border-slate-200 dark:border-white/10 text-slate-400'}`} title={t('teamManager.modes.balancedTooltip')}>{t('teamManager.modes.balanced')}</button>
                                </div>
                                
                                <div className={`grid ${props.canUndoRemove ? 'grid-cols-4' : 'grid-cols-3'} gap-1 min-w-[200px]`}>
                                    {props.canUndoRemove && (
                                        <button onClick={props.onUndoRemove} className="flex items-center justify-center bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 text-slate-600 dark:text-slate-300 rounded-xl text-[9px] font-bold uppercase transition-colors h-9 active:scale-95">
                                            <Undo2 size={14} />
                                        </button>
                                    )}
                                    <button onClick={() => { haptics.impact('medium'); props.onBalanceTeams(); }} className="col-span-2 flex items-center justify-center gap-1.5 bg-indigo-50 dark:bg-indigo-500/10 hover:bg-indigo-100 dark:hover:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 rounded-xl text-[9px] font-bold uppercase transition-colors h-9 truncate px-1 active:scale-95">
                                        <Shuffle size={14} /> {props.rotationMode === 'balanced' ? t('teamManager.actions.globalBalance') : t('teamManager.actions.restoreOrder')}
                                    </button>
                                    {resetRosters && (
                                        <button onClick={() => setResetConfirmState(true)} className="flex items-center justify-center bg-rose-500/10 text-rose-600 dark:text-rose-400 rounded-xl text-[9px] font-bold uppercase transition-colors hover:bg-rose-500/20 shadow-sm border border-rose-500/20 h-9 active:scale-95">
                                            <Trash2 size={14} />
                                        </button>
                                    )}
                                </div>
                            </div>
                            
                            <div className="h-full overflow-y-auto custom-scrollbar pb-32 px-0">
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
                                />
                            </div>
                        </>
                    )}

                    {activeTab === 'profiles' && (
                        <div className="h-full overflow-y-auto custom-scrollbar p-2 pb-24 space-y-4">
                            <button onClick={() => setEditingTarget({ type: 'profile', id: 'new' })} className="w-full py-6 border-2 border-dashed border-slate-300 dark:border-white/10 rounded-[2rem] flex flex-col items-center justify-center gap-2 text-slate-400 hover:text-indigo-500 hover:border-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 transition-all group bg-slate-50/50 dark:bg-white/[0.01] active:scale-95">
                                <div className="p-3 rounded-full bg-slate-100 dark:bg-white/5 group-hover:bg-indigo-500 group-hover:text-white transition-colors"><Plus size={24} /></div>
                                <span className="text-xs font-bold uppercase tracking-widest">{t('profile.create')}</span>
                            </button>
                            
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                {Array.from(props.profiles.values()).length === 0 ? (
                                    <div className="col-span-full flex flex-col items-center justify-center py-20 text-slate-400 italic gap-3 opacity-60">
                                        <div className="p-4 bg-slate-100 dark:bg-white/5 rounded-full">
                                            <User size={32} className="opacity-40" />
                                        </div>
                                        <p className="text-sm font-medium">{t('teamManager.profiles.empty')}</p>
                                    </div>
                                ) : (
                                    Array.from(props.profiles.values()).map((profile: PlayerProfile) => {
                                        let status: PlayerLocationStatus = null;
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

                                        const placementOptions: PlacementOption[] = [];
                                        if (!status) {
                                            if (props.courtA.players.length < 6) placementOptions.push({ label: t('teamManager.actions.addTo') + ' ' + props.courtA.name, targetId: 'A', type: 'main', teamColor: props.courtA.color });
                                            else if (props.courtA.hasActiveBench) placementOptions.push({ label: t('teamManager.actions.addTo') + ' ' + props.courtA.name + ' (' + t('teamManager.benchLabel') + ')', targetId: 'A_Reserves', type: 'bench', teamColor: props.courtA.color });
                                            
                                            if (props.courtB.players.length < 6) placementOptions.push({ label: t('teamManager.actions.addTo') + ' ' + props.courtB.name, targetId: 'B', type: 'main', teamColor: props.courtB.color });
                                            else if (props.courtB.hasActiveBench) placementOptions.push({ label: t('teamManager.actions.addTo') + ' ' + props.courtB.name + ' (' + t('teamManager.benchLabel') + ')', targetId: 'B_Reserves', type: 'bench', teamColor: props.courtB.color });
                                            
                                            placementOptions.push({ label: t('teamManager.actions.addToQueue'), targetId: 'Queue', type: 'queue' });
                                        }

                                        return (
                                            <ProfileCard 
                                                key={profile.id} 
                                                profile={profile} 
                                                onDelete={() => requestProfileDelete(profile.id)}
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

            {activePlayerMenu && createPortal(
                <>
                    <div className="fixed inset-0 z-[9998]" onClick={() => setActivePlayerMenu(null)} />
                    <div 
                        ref={playerMenuRef}
                        className="fixed z-[9999] min-w-[220px] bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-black/10 dark:border-white/10 p-2 flex flex-col animate-in fade-in zoom-in-95 duration-200"
                        style={{ 
                            top: Math.min(window.innerHeight - 240, activePlayerMenu.rect.bottom + 8), 
                            left: Math.min(window.innerWidth - 230, Math.max(10, activePlayerMenu.rect.left - 110))
                        }}
                    >
                       {(() => {
                           const p = playersById.get(activePlayerMenu.playerId);
                           if (!p) return null;
                           const containerId = findContainer(p.id);
                           const team = getTeamById(containerId || '');
                           const isOnBench = containerId?.includes('Reserves');
                           
                           let logicalTeamId = team?.id;
                           if (team?.id === props.courtA.id) logicalTeamId = 'A';
                           if (team?.id === props.courtB.id) logicalTeamId = 'B';
                           
                           if (!logicalTeamId) return null;

                           return (
                               <>
                                   {team && team.hasActiveBench && !isOnBench && (
                                       <button onClick={() => { wrappedMove(p.id, logicalTeamId, `${logicalTeamId}_Reserves`); setActivePlayerMenu(null); }} className="w-full text-left px-4 py-3 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/10 rounded-xl flex items-center gap-3 transition-colors"><Armchair size={18} /> {t('teamManager.menu.sendBench')}</button>
                                   )}
                                   {team && !team.hasActiveBench && !isOnBench && (
                                       <button 
                                           onClick={() => { 
                                               setBenchConfirmState({ teamId: logicalTeamId, playerId: p.id, sourceId: containerId || logicalTeamId });
                                               setActivePlayerMenu(null); 
                                           }} 
                                           className="w-full text-left px-4 py-3 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/10 rounded-xl flex items-center gap-3 transition-colors"
                                       >
                                           <Armchair size={18} /> {t('teamManager.menu.sendBench')}
                                       </button>
                                   )}
                                   {team && isOnBench && (
                                       <button onClick={() => { 
                                           if (team.players.length >= 6) {
                                               onShowToast(t('teamManager.teamFullMsg'), 'error', undefined, 'alert');
                                           } else {
                                               wrappedMove(p.id, `${logicalTeamId}_Reserves`, logicalTeamId); 
                                               setActivePlayerMenu(null); 
                                           }
                                       }} className="w-full text-left px-4 py-3 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/10 rounded-xl flex items-center gap-3 transition-colors"><Upload size={18} /> {t('teamManager.menu.returnCourt')}</button>
                                   )}
                                   
                                   <div className="h-px bg-black/5 dark:bg-white/5 my-1" />
                                   
                                   <button onClick={() => { props.onToggleFixed(p.id); setActivePlayerMenu(null); }} className="w-full text-left px-4 py-3 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/10 rounded-xl flex items-center gap-3 transition-colors">
                                       {p.isFixed ? <Unlock size={18} /> : <Pin size={18} />} {p.isFixed ? t('teamManager.menu.unlock') : t('teamManager.menu.lock')}
                                   </button>
                                   
                                   <div className="h-px bg-black/5 dark:bg-white/5 my-1" />
                                   
                                   <button onClick={() => handleDeleteWithUndo(p.id)} className="w-full text-left px-4 py-3 text-xs font-bold text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-xl flex items-center gap-3 transition-colors">
                                       <Trash2 size={18} /> {t('teamManager.menu.delete')}
                                   </button>
                               </>
                           );
                       })()}
                    </div>
                </>,
                document.body
            )}

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
                                    result.errorKey ? t(result.errorKey, result.errorParams) : t('notifications.saveFailed'), 
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
                isOpen={!!benchConfirmState} 
                onClose={() => setBenchConfirmState(null)} 
                title={t('teamManager.activateBenchTitle')}
                message={t('teamManager.activateBenchConfirm')}
                confirmLabel={t('teamManager.btnActivateBench')}
                onConfirm={() => {
                    if (benchConfirmState) {
                        props.toggleTeamBench(benchConfirmState.teamId);
                        wrappedMove(benchConfirmState.playerId, benchConfirmState.sourceId, `${benchConfirmState.teamId}_Reserves`);
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

            <ConfirmationModal 
                isOpen={resetConfirmState}
                onClose={() => setResetConfirmState(false)}
                onConfirm={() => {
                    if (resetRosters) resetRosters();
                }}
                title={t('confirm.reset.title')}
                message={t('confirm.reset.message')}
                confirmLabel={t('confirm.reset.confirmButton')}
                icon={Trash2}
            />

            <ConfirmationModal 
                isOpen={!!profileToDeleteId}
                onClose={() => setProfileToDeleteId(null)}
                onConfirm={executeProfileDelete}
                title={t('confirm.deleteProfile')}
                message={t('confirm.deleteProfileMsg')}
                confirmLabel={t('teamManager.menu.delete')}
                icon={Trash2}
            />

        </DndContext>
    </Modal>,
    document.body
    );
};
