
import React, { useState, useMemo, useEffect, useCallback, memo, useRef } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Team, Player, RotationMode, PlayerProfile, TeamColor, ActionLog } from '../../types';
import { calculateTeamStrength } from '../../utils/balanceUtils';
import { Pin, Trash2, Shuffle, Edit2, GripVertical, Plus, Undo2, Ban, Star, Save, RefreshCw, AlertCircle, User, Upload, List, Hash, Users, Layers, Search, X, ListFilter, ArrowDownAZ, ArrowDown01, ArrowUpWideNarrow, LogOut, ChevronRight, ChevronLeft, Armchair, ArrowRightLeft, ArrowUp, MoreVertical, Unlock, RefreshCcw, PlusCircle, ArrowUpCircle, Activity, ArrowDown } from 'lucide-react';
import {
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragStartEvent,
  DragOverlay,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  KeyboardSensor,
  TouchSensor,
  useDndMonitor
} from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { createPortal } from 'react-dom';
import { useTranslation } from '../../contexts/LanguageContext';
import { TEAM_COLORS, COLOR_KEYS, resolveTheme } from '../../utils/colors';
import { motion, AnimatePresence } from 'framer-motion';
import { SubstitutionModal } from './SubstitutionModal';
import { ProfileCreationModal } from './ProfileCreationModal';
import { useHaptics } from '../../hooks/useHaptics';
import { SkillSlider } from '../ui/SkillSlider'; // IMPORT NEW COMPONENT
import { VoiceToast } from '../ui/VoiceToast'; // Added for Drop Feedback

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
  onRemove: (id: string) => void; // Knockout / Return
  onDeletePlayer?: (id: string) => void; // Permanent Delete
  onMove: (playerId: string, fromId: string, toId: string, newIndex?: number) => void;
  onUpdateTeamName: (teamId: string, name: string) => void;
  onUpdateTeamColor: (teamId: string, color: TeamColor) => void;
  onUpdatePlayerName: (playerId: string, name: string) => void;
  onUpdatePlayerNumber: (playerId: string, number: string) => void;
  onUpdatePlayerSkill: (playerId: string, skill: number) => void;
  onSaveProfile: (playerId: string, overrides?: { name?: string, number?: string, avatar?: string, skill?: number }) => void;
  onRevertProfile: (playerId: string) => void;
  onAddPlayer: (name: string, target: 'A' | 'B' | 'Queue' | 'A_Reserves' | 'B_Reserves' | string, number?: string, skill?: number) => void;
  onUndoRemove: () => void;
  canUndoRemove: boolean;
  onCommitDeletions: () => void;
  deletedCount: number;
  profiles: Map<string, PlayerProfile>;
  deleteProfile?: (id: string) => void;
  upsertProfile?: (name: string, skill: number, id?: string, extras?: { number?: string, avatar?: string }) => PlayerProfile;
  onSortTeam: (teamId: string, criteria: 'name' | 'number' | 'skill') => void; 
  toggleTeamBench: (teamId: string) => void;
  substitutePlayers: (teamId: string, playerInId: string, playerOutId: string) => void;
  matchLog?: ActionLog[];
  enablePlayerStats?: boolean;
  reorderQueue?: (fromIndex: number, toIndex: number) => void;
  disbandTeam?: (teamId: string) => void;
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

// Global event bus for scrolling
const SCROLL_EVENT = 'team-manager-scroll';

// Dispatcher helper
const dispatchScrollEvent = () => {
    if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event(SCROLL_EVENT));
    }
};

const ColorPicker = memo(({ 
    selected, 
    onChange, 
    usedColors 
}: { 
    selected: TeamColor, 
    onChange: (c: TeamColor) => void,
    usedColors: Set<string>
}) => {
    return (
        <div 
            className="w-full relative z-20 overflow-x-auto overflow-y-visible no-scrollbar touch-pan-x flex items-center py-3" 
            onPointerDown={(e) => e.stopPropagation()} 
            style={{ 
                overscrollBehaviorX: 'contain',
                maskImage: 'linear-gradient(to right, black 80%, transparent 100%)',
                WebkitMaskImage: 'linear-gradient(to right, black 80%, transparent 100%)'
            }}
        >
            <div className="flex items-center gap-3 px-4 w-max">
                {COLOR_KEYS.map(color => {
                     const isSelected = selected === color;
                     const isTaken = usedColors.has(color) && !isSelected;
                     const theme = TEAM_COLORS[color];
                     
                     return (
                         <button
                            key={color}
                            onClick={(e) => { e.stopPropagation(); !isTaken && onChange(color); }}
                            onPointerDown={(e) => e.stopPropagation()}
                            disabled={isTaken}
                            className={`
                                relative w-8 h-8 rounded-full transition-all duration-300 flex items-center justify-center shrink-0
                                ${theme.solid}
                                ${isSelected 
                                    ? 'ring-4 ring-offset-2 ring-offset-slate-100 dark:ring-offset-slate-900 ring-slate-400/50 dark:ring-slate-500/50 shadow-lg scale-110 opacity-100 z-10' 
                                    : isTaken
                                        ? 'opacity-20 grayscale cursor-not-allowed scale-90 border border-black/10'
                                        : 'hover:scale-110 opacity-100 cursor-pointer shadow-sm hover:shadow-md'
                                }
                            `}
                            title={isTaken ? 'Color taken' : color.charAt(0).toUpperCase() + color.slice(1)}
                         >
                            {isSelected && (
                                <motion.div 
                                    layoutId="selected-color-check"
                                    className="w-3 h-3 bg-white rounded-full shadow-sm"
                                    transition={{ type: "spring", stiffness: 500, damping: 30 }}
                                />
                            )}
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

  const save = () => {
    setIsEditing(false);
    if(val.trim() && val !== name) onSave(val.trim());
    else setVal(name);
  };

  const cancel = () => {
      setIsEditing(false);
      setVal(name);
  };

  if(isEditing) {
    return (
        <input 
            ref={inputRef} type="text"
            className={`bg-transparent text-slate-900 dark:text-white border-b border-indigo-500 outline-none w-full px-0 py-0 font-bold ${isPlayer ? 'text-base' : 'text-xs uppercase tracking-widest'}`}
            value={val} onChange={e => setVal(e.target.value)} onBlur={save}
            onKeyDown={e => { if(e.key === 'Enter') save(); if(e.key === 'Escape') cancel(); }}
            onPointerDown={e => e.stopPropagation()} 
        />
    );
  }
  return (
      <div className={`flex items-center gap-2 group cursor-pointer min-w-0 ${className}`} onClick={() => setIsEditing(true)}>
          <span className="truncate">{name}</span>
          <Edit2 size={8} className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-400 flex-shrink-0" />
      </div>
  );
});

const EditableNumber = memo(({ number, onSave, validator }: { number?: string; onSave: (val: string) => void; validator?: (n: string) => boolean }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [val, setVal] = useState(number || '');
    const [error, setError] = useState(false);
    const inputRef = React.useRef<HTMLInputElement>(null);

    useEffect(() => { setVal(number || ''); setError(false); }, [number]);
    useEffect(() => { if(isEditing) inputRef.current?.focus(); }, [isEditing]);

    const save = () => {
        const trimmed = val.trim();
        if (validator && trimmed && trimmed !== (number || '') && !validator(trimmed)) {
            setError(true);
            setTimeout(() => setError(false), 500); 
            inputRef.current?.focus();
            return;
        }

        setIsEditing(false);
        if (trimmed !== (number || '')) onSave(trimmed);
    };

    if(isEditing) {
        return (
            <input 
                ref={inputRef} 
                type="tel" 
                maxLength={3}
                className={`w-7 h-7 bg-white dark:bg-black/50 text-center rounded-md border outline-none text-xs font-bold text-slate-800 dark:text-white shadow-sm ${error ? 'border-red-500 bg-red-50 dark:bg-red-900/20' : 'border-indigo-500'}`}
                value={val} 
                onChange={e => { setVal(e.target.value); setError(false); }}
                onBlur={save}
                onKeyDown={e => { if(e.key === 'Enter') save(); if(e.key === 'Escape') setIsEditing(false); }}
                onPointerDown={e => e.stopPropagation()} 
            />
        );
    }

    return (
        <button 
            onClick={() => setIsEditing(true)} 
            onPointerDown={e => e.stopPropagation()}
            className={`
                w-7 h-7 rounded-lg flex items-center justify-center text-[11px] font-black border transition-all
                ${number 
                    ? 'bg-white/80 dark:bg-white/5 text-slate-800 dark:text-white border-transparent shadow-sm' 
                    : 'bg-transparent text-slate-300 dark:text-slate-600 border-transparent hover:border-slate-300 dark:hover:border-slate-700 hover:text-slate-400'}
            `}
        >
            {number || <Hash size={12} />}
        </button>
    );
});

const PlayerCard = memo(({ 
    player, 
    locationId, 
    profiles, 
    onUpdateName, 
    onUpdateNumber,
    onUpdateSkill,
    onSaveProfile,
    isCompact = false,
    forceDragStyle = false,
    onRequestProfileEdit,
    onToggleMenu,
    isMenuActive,
    validateNumber
}: { 
    player: Player; 
    locationId: string; 
    profiles: Map<string, PlayerProfile>;
    onUpdateName: (id: string, name: string) => void; 
    onUpdateNumber: (id: string, number: string) => void;
    onUpdateSkill: (id: string, skill: number) => void;
    onSaveProfile: (id: string, overrides?: { name?: string, number?: string, avatar?: string, skill?: number }) => void;
    isCompact?: boolean;
    forceDragStyle?: boolean;
    onRequestProfileEdit?: (id: string) => void;
    onToggleMenu: (playerId: string, targetElement: HTMLElement) => void;
    isMenuActive: boolean;
    validateNumber?: (n: string) => boolean;
}) => {
  const haptics = useHaptics();

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: player.id,
    data: { fromId: locationId, player },
    disabled: player.isFixed || isMenuActive,
  });

  const style = { 
      transform: CSS.Transform.toString(transform), 
      transition, 
      // Ghosting logic: Keep opacity low but visible when dragging from original spot
      opacity: isDragging ? 0.3 : 1, 
      filter: isDragging ? 'grayscale(100%)' : 'none',
      zIndex: isDragging ? 50 : (isMenuActive ? 40 : 'auto'),
  };
  
  const isFixed = player.isFixed;
  const profile = player.profileId ? profiles.get(player.profileId) : undefined;
  const hasProfile = !!profile;
  const profileMatch = hasProfile && profile!.name === player.name && profile!.skillLevel === player.skillLevel && (profile!.number === player.number || (!profile!.number && !player.number));
  
  const handleSaveName = useCallback((val: string) => onUpdateName(player.id, val), [onUpdateName, player.id]);
  const handleSaveNumber = useCallback((val: string) => onUpdateNumber(player.id, val), [onUpdateNumber, player.id]);
  const handleUpdateSkill = useCallback((l: number) => onUpdateSkill(player.id, l), [onUpdateSkill, player.id]);
  
  const handleSmartSaveProfile = useCallback((e: React.MouseEvent) => {
      e.stopPropagation();
      if (hasProfile) {
          onSaveProfile(player.id, { name: player.name, number: player.number, avatar: profile.avatar, skill: player.skillLevel });
          haptics.notification('success');
      } else {
          if (onRequestProfileEdit) onRequestProfileEdit(player.id);
      }
  }, [hasProfile, player, profile, onSaveProfile, onRequestProfileEdit, haptics]);

  const handleToggleMenu = (e: React.MouseEvent<HTMLButtonElement>) => {
      e.stopPropagation();
      e.preventDefault();
      onToggleMenu(player.id, e.currentTarget);
  };

  // DRAG OVERLAY STYLE (Active Drag) vs STATIC STYLE
  const containerClass = forceDragStyle
    ? `bg-white dark:bg-slate-800 border-2 border-indigo-500 shadow-2xl scale-105 z-50 ring-4 ring-indigo-500/20`
    : `bg-white/60 dark:bg-white/[0.04] hover:bg-white/80 dark:hover:bg-white/[0.08] border-transparent hover:border-black/5 dark:hover:border-white/10 transition-all duration-200`;

  const fixedClass = isFixed 
    ? 'bg-amber-500/5 border-amber-500/20 shadow-sm shadow-amber-500/5' 
    : '';

  const reserveClass = locationId.includes('_Reserves')
    ? 'border-dashed border-slate-300 dark:border-white/10 bg-slate-50/50 dark:bg-black/20'
    : '';

  // Increased Min Height for better Touch Area (54px)
  const minHeightClass = 'min-h-[54px]';
  const paddingClass = 'py-1.5 px-3';
  
  const nameSizeClass = 'text-[15px] font-bold tracking-tight'; 

  const isUnsaved = hasProfile && !profileMatch;

  return (
    <div ref={setNodeRef} style={style} data-player-card="true" className={`
        group relative flex items-center justify-between rounded-2xl border
        ${paddingClass} ${minHeightClass}
        ${forceDragStyle ? containerClass : (locationId.includes('_Reserves') ? reserveClass : (isFixed ? fixedClass : containerClass))}
    `}>
    
    {/* Left: Number */}
    <div className="flex items-center gap-3 flex-shrink-0 self-center pl-0.5">
        <EditableNumber number={player.number} onSave={handleSaveNumber} validator={validateNumber} />
    </div>
    
    {/* Middle: Name & Skill */}
    <div className="flex flex-1 items-center gap-3 min-w-0 px-2 justify-between">
        <div className="flex items-center gap-2 min-w-0 flex-1">
            {profile?.avatar && (
                <span className="text-xs grayscale opacity-80 group-hover:grayscale-0 group-hover:opacity-100 transition-all">{profile.avatar}</span>
            )}
            <EditableTitle 
                name={player.name} 
                onSave={handleSaveName} 
                isPlayer={true} 
                className={`${nameSizeClass} text-slate-800 dark:text-slate-100 truncate leading-tight w-full`} 
            />
            {isFixed && <Pin size={12} className="text-amber-500 flex-shrink-0" fill="currentColor" />}
            {isUnsaved && <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse flex-shrink-0" title="Unsaved changes" />}
        </div>
        
        <div className="flex items-center flex-shrink-0 scale-100 origin-right">
            <SkillSlider level={player.skillLevel} onChange={handleUpdateSkill} />
        </div>
    </div>
    
    {/* Right: Actions */}
    <div className="flex items-center gap-1 flex-shrink-0 relative z-30 self-center pl-1">
        <button 
            onClick={handleSmartSaveProfile} 
            onPointerDown={e => e.stopPropagation()} 
            className={`
                p-2 rounded-lg transition-colors 
                ${isUnsaved 
                    ? 'text-amber-500 hover:bg-amber-500/10' 
                    : (hasProfile ? 'text-emerald-500 opacity-50 hover:opacity-100' : 'text-slate-300 hover:text-indigo-500 hover:bg-indigo-500/10')
                }
            `} 
            title={hasProfile ? (isUnsaved ? "Update Profile" : "Synced") : "Create Profile"}
        >
            <Save size={14} />
        </button>

        <button 
            onClick={handleToggleMenu}
            onPointerDown={e => e.stopPropagation()}
            className={`p-2 rounded-lg transition-colors ${isMenuActive ? 'bg-slate-200 dark:bg-white/10 text-indigo-500' : 'text-slate-300 hover:text-slate-600 dark:hover:text-slate-300'}`}
        >
            <MoreVertical size={14} />
        </button>

        {/* Drag Handle with larger touch area */}
        <div {...attributes} {...listeners} className={`cursor-grab active:cursor-grabbing p-2 touch-none flex-shrink-0 ${isFixed ? 'cursor-not-allowed opacity-30' : 'text-slate-300 dark:text-slate-600 hover:text-slate-500 dark:hover:text-slate-400'}`}>
            <GripVertical size={16} />
        </div>
    </div>
    </div>
  );
}, (prev, next) => {
    return (
        prev.player === next.player && 
        prev.locationId === next.locationId &&
        prev.profiles === next.profiles &&
        prev.isCompact === next.isCompact &&
        prev.forceDragStyle === next.forceDragStyle &&
        prev.isMenuActive === next.isMenuActive
    );
});

const AddPlayerInput = memo(({ onAdd, disabled, customLabel }: { onAdd: (name: string, number?: string, skill?: number) => void; disabled?: boolean; customLabel?: string }) => {
    const { t } = useTranslation();
    const [isOpen, setIsOpen] = useState(false);
    const [name, setName] = useState('');
    const [number, setNumber] = useState('');
    const [skill, setSkill] = useState(5); // Default middle skill
    const inputRef = React.useRef<HTMLInputElement>(null);

    useEffect(() => { if(isOpen) inputRef.current?.focus(); }, [isOpen]);

    const submit = () => {
        if(name.trim()) { 
            onAdd(name.trim(), number.trim() || undefined, skill); 
            setName('');
            setNumber('');
            setSkill(5);
        }
        inputRef.current?.focus();
    };

    if (isOpen && !disabled) {
        return (
            <div className="flex flex-col mt-2 animate-in fade-in slide-in-from-top-1 bg-white/60 dark:bg-white/[0.04] p-2 rounded-2xl border border-black/5 dark:border-white/5 shadow-sm ring-1 ring-black/5">
                <input ref={inputRef}
                    className="w-full bg-transparent border-b border-black/10 dark:border-white/10 px-2 py-2 text-sm text-slate-800 dark:text-white focus:outline-none font-bold placeholder:text-slate-400 mb-2"
                    placeholder={t('teamManager.addPlayerPlaceholder')} value={name} onChange={e => setName(e.target.value)}
                    onKeyDown={e => { if(e.key === 'Enter') submit(); if(e.key === 'Escape') setIsOpen(false); }}
                />
                
                <div className="flex items-center gap-2">
                    <input 
                        className="w-14 text-center bg-white/50 dark:bg-black/20 rounded-xl border border-transparent focus:border-indigo-500 focus:bg-white dark:focus:bg-black/40 px-1 py-1.5 text-xs font-black text-slate-700 dark:text-slate-300 outline-none"
                        placeholder="#"
                        value={number}
                        onChange={e => setNumber(e.target.value)}
                        maxLength={3}
                    />
                    
                    <div className="flex-1 flex items-center justify-center bg-white/30 dark:bg-white/5 rounded-xl px-2 py-1">
                        <SkillSlider level={skill} onChange={setSkill} />
                    </div>

                    <button onClick={submit} className="p-2 bg-indigo-500 rounded-xl hover:bg-indigo-400 text-white shadow-md active:scale-95 transition-transform"><Plus size={18} /></button>
                </div>
            </div>
        );
    }
    
    const labelContent = customLabel || t('common.add');
    const isBenchLabel = customLabel?.toLowerCase().includes('bench') || customLabel?.toLowerCase().includes('reserve');

    return (
        <button onClick={() => !disabled && setIsOpen(true)} disabled={disabled}
            className={`mt-2 w-full py-3 flex items-center justify-center gap-2 text-[10px] font-bold uppercase tracking-widest rounded-2xl border border-dashed transition-all ${disabled ? 'border-slate-200 dark:border-slate-800 text-slate-400 cursor-not-allowed' : 'border-slate-300 dark:border-slate-700 text-slate-400 hover:text-indigo-600 hover:border-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-500/10'}`} >
            {disabled ? (
                <><Ban size={14} /> {t('common.full')}</>
            ) : (
                <>
                    {isBenchLabel ? <Armchair size={14} className="text-emerald-500" /> : <Plus size={14} />} 
                    {labelContent}
                </>
            )}
        </button>
    );
});

type SortCriteria = 'name' | 'number' | 'skill' | 'original';
type SortDirection = 'asc' | 'desc';

const TeamColumn = memo(({ 
    id, 
    team, 
    profiles,
    onUpdateTeamName, 
    onUpdateTeamColor,
    onUpdatePlayerName, 
    onUpdatePlayerNumber,
    onUpdateSkill,
    onSaveProfile,
    onAddPlayer, 
    onKnockoutRequest,
    usedColors,
    isQueue = false,
    onMove,
    toggleTeamBench,
    substitutePlayers,
    statsMap,
    onRequestProfileEdit,
    onTogglePlayerMenu,
    activePlayerMenuId,
    isNext = false,
    validateNumber
}: { 
    id: string; 
    team: Team; 
    profiles: Map<string, PlayerProfile>;
    onUpdateTeamName: (id: string, name: string) => void; 
    onUpdateTeamColor: (id: string, color: TeamColor) => void;
    onUpdatePlayerName: (pid: string, n: string) => void; 
    onUpdatePlayerNumber: (pid: string, n: string) => void;
    onUpdateSkill: (pid: string, s: number) => void;
    onSaveProfile: (pid: string, overrides?: { name?: string, number?: string, avatar?: string, skill?: number }) => void;
    onAddPlayer: (name: string, target: string, number?: string, skill?: number) => void; 
    onKnockoutRequest: (teamId: string, playerId: string) => void;
    usedColors: Set<string>;
    isQueue?: boolean;
    onSortTeam: (teamId: string, criteria: 'name' | 'number' | 'skill') => void;
    onMove: (playerId: string, fromId: string, toId: string, newIndex?: number) => void;
    toggleTeamBench: (teamId: string) => void;
    substitutePlayers: (teamId: string, playerInId: string, playerOutId: string) => void;
    statsMap?: Map<string, PlayerStats>;
    onRequestProfileEdit: (id: string) => void;
    onTogglePlayerMenu: (playerId: string, targetElement: HTMLElement) => void;
    activePlayerMenuId: string | null;
    isNext?: boolean;
    validateNumber: (n: string, teamId: string, playerId: string) => boolean;
}) => {
  const { t } = useTranslation();
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [viewMode, setViewMode] = useState<'main' | 'reserves'>('main'); 
  const [isSubModalOpen, setIsSubModalOpen] = useState(false);
  
  const [sortConfig, setSortConfig] = useState<{ criteria: SortCriteria, direction: SortDirection }>({ 
      criteria: 'original', 
      direction: 'asc' 
  });

  const colorConfig = resolveTheme(team.color);

  // If bench is disabled, force main view
  useEffect(() => {
      if (!team.hasActiveBench && viewMode === 'reserves') {
          setViewMode('main');
      }
  }, [team.hasActiveBench]);

  const rawPlayers = viewMode === 'main' ? team.players : (team.reserves || []);
  
  const displayedPlayers = useMemo(() => {
      let sorted = [...rawPlayers];
      if (sortConfig.criteria === 'original') return sorted;

      sorted.sort((a, b) => {
          let valA: any = a[sortConfig.criteria as keyof Player] || '';
          let valB: any = b[sortConfig.criteria as keyof Player] || '';
          
          if (sortConfig.criteria === 'skill') {
              valA = a.skillLevel;
              valB = b.skillLevel;
          }
          if (sortConfig.criteria === 'number') {
              const numA = parseInt(a.number || '0');
              const numB = parseInt(b.number || '0');
              valA = numA; valB = numB;
          }

          if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
          if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
          return 0;
      });
      return sorted;
  }, [rawPlayers, sortConfig]);

  const listId = viewMode === 'main' ? id : `${id}_Reserves`; 
  
  const mainRosterFull = team.players.length >= 6;
  const reservesFull = (team.reserves || []).length >= 6;

  const isFull = viewMode === 'main' 
      ? (mainRosterFull && reservesFull) 
      : reservesFull; 

  const { setNodeRef, isOver } = useSortable({ 
      id: listId, 
      data: { type: 'container', containerId: listId } 
  });
  
  const handleUpdateName = useCallback((n: string) => onUpdateTeamName(id, n), [onUpdateTeamName, id]);
  const handleUpdateColor = useCallback((c: TeamColor) => onUpdateTeamColor(id, c), [onUpdateTeamColor, id]);

  const toggleView = () => setViewMode(prev => prev === 'main' ? 'reserves' : 'main');

  const handleAdd = useCallback((n: string, num?: string, s?: number) => {
      const target = viewMode === 'main' ? id : `${id}_Reserves`;
      onAddPlayer(n, target, num, s);
  }, [onAddPlayer, id, viewMode]);

  const handleSubstitution = (playerInId: string, playerOutId: string) => {
      substitutePlayers(id, playerInId, playerOutId);
  };

  const applySort = (criteria: SortCriteria) => {
      setSortConfig(prev => ({
          criteria,
          direction: prev.criteria === criteria && prev.direction === 'asc' ? 'desc' : 'asc'
      }));
      setShowSortMenu(false);
  };

  const bgClass = viewMode === 'reserves'
      ? 'bg-slate-200/50 dark:bg-white/[0.05] border-dashed border-slate-300 dark:border-white/10'
      : `bg-white/40 dark:bg-[#0f172a]/60 bg-gradient-to-b ${colorConfig.gradient} ${colorConfig.border} shadow-xl shadow-black/5`;

  let addButtonLabel = t('common.add');
  if (viewMode === 'reserves') {
      addButtonLabel = "Add Reserve";
  } else if (mainRosterFull) {
      addButtonLabel = "Add to Bench";
  }

  const teamStrength = calculateTeamStrength(team.players);

  // --- DROP ZONE VISUAL LOGIC ---
  let ringColor = "";
  let dropBg = "";
  
  if (isOver && !isQueue) {
      // 1. Check Capacity of CURRENT view (Main or Reserves)
      const currentCount = rawPlayers.length;
      const isCapacityReached = currentCount >= 6;

      if (viewMode === 'reserves') {
          // If viewing reserves, simple check
          if (isCapacityReached) {
              ringColor = "ring-rose-500";
              dropBg = "bg-rose-500/10";
          } else {
              ringColor = "ring-emerald-400";
              dropBg = "bg-emerald-400/10";
          }
      } else {
          // Main View Logic
          if (isCapacityReached) {
              if (team.hasActiveBench) {
                  // Redirect to bench? Check bench capacity
                  const benchCount = (team.reserves || []).length;
                  if (benchCount < 6) {
                      // Redirect Available -> YELLOW/AMBER
                      ringColor = "ring-amber-400";
                      dropBg = "bg-amber-400/10";
                  } else {
                      // Both Full -> RED
                      ringColor = "ring-rose-500";
                      dropBg = "bg-rose-500/10";
                  }
              } else {
                  // Main Full, Bench Inactive -> RED (Will trigger confirmation)
                  ringColor = "ring-rose-500";
                  dropBg = "bg-rose-500/10";
              }
          } else {
              // Space Available -> GREEN
              ringColor = "ring-emerald-400";
              dropBg = "bg-emerald-400/10";
          }
      }
  } else if (isOver && isQueue) {
      ringColor = "ring-indigo-400";
      dropBg = "bg-indigo-400/10";
  }

  const finalRing = ringColor || colorConfig.ring;

  const handleScroll = () => {
      dispatchScrollEvent();
  };

  return (
    <div ref={setNodeRef} 
         className={`
            flex flex-col w-full h-full rounded-[2.5rem] border backdrop-blur-2xl transition-all duration-300 relative
            ${isQueue ? 'p-1.5 bg-white/30 dark:bg-white/[0.02] border-slate-200/50 dark:border-white/5' : `p-3 ${bgClass}`}
            ${isOver 
                ? `ring-4 ${finalRing} ring-opacity-50 scale-[1.01] ${dropBg} z-20` 
                : (isQueue ? '' : 'hover:border-black/10 dark:hover:border-white/20')}
            ${isNext ? 'ring-2 ring-amber-500/50 dark:ring-amber-500/40 ring-offset-2 ring-offset-slate-100 dark:ring-offset-slate-900 shadow-2xl shadow-amber-500/10' : ''}
         `}
         // Ensures fixed height on queue cards inside carousel
         style={isQueue ? { minHeight: '60vh' } : {}}
    >
      {isNext && (
          <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-amber-500 text-amber-950 px-3 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest shadow-lg shadow-amber-500/20 z-10 flex items-center gap-1">
              <ArrowUpCircle size={10} strokeWidth={3} /> Next Up
          </div>
      )}

      <SubstitutionModal 
          isOpen={isSubModalOpen}
          onClose={() => setIsSubModalOpen(false)}
          team={team}
          onConfirm={handleSubstitution}
      />

      <div className="flex flex-col mb-1">
        <div className="flex items-center justify-between gap-3 border-b border-black/5 dark:border-white/5 pb-2 mb-1">
            <div className={`w-1.5 self-stretch rounded-full ${colorConfig.halo} shadow-[0_0_10px_currentColor] opacity-90`} />
            
            <div className="flex-1 min-w-0">
                <span className={`text-[10px] font-bold uppercase tracking-widest opacity-70 ${colorConfig.text}`}>
                    {isQueue ? t('teamManager.queue') : (viewMode === 'reserves' ? t('teamManager.benchLabel') : t('teamManager.teamLabel'))}
                </span>
                <EditableTitle name={team.name} onSave={handleUpdateName} className={`text-base font-black uppercase tracking-tight ${colorConfig.text} ${colorConfig.textDark}`} />
            </div>
            
            <div className="flex flex-col items-end gap-1.5">
                <div className="flex items-center gap-1">
                    {/* Enable Bench Toggle for Queue Teams too */}
                    <button 
                        onClick={(e) => { e.stopPropagation(); toggleTeamBench(id); }}
                        onPointerDown={(e) => e.stopPropagation()}
                        className={`
                            p-1.5 rounded-xl border border-transparent transition-all
                            ${team.hasActiveBench 
                                ? 'bg-emerald-500 text-white shadow-sm' 
                                : 'bg-black/5 dark:bg-white/10 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'}
                        `}
                        title={team.hasActiveBench ? "Deactivate Bench" : "Activate Bench (Reserves)"}
                    >
                        <Armchair size={16} fill={team.hasActiveBench ? 'currentColor' : 'none'} />
                    </button>

                    <div className="relative">
                        <button 
                            onClick={() => setShowSortMenu(!showSortMenu)}
                            className={`p-1.5 rounded-xl border border-transparent hover:border-black/5 dark:hover:border-white/5 hover:bg-black/5 dark:hover:bg-white/10 ${showSortMenu ? 'bg-black/5 dark:bg-white/10' : ''}`}
                        >
                            <ListFilter size={16} className={`${colorConfig.text}`} />
                        </button>
                        <AnimatePresence>
                            {showSortMenu && (
                                <motion.div 
                                    initial={{ opacity: 0, y: 5, scale: 0.95 }}
                                    animate={{ opacity: 1, y: 0, scale: 1 }}
                                    exit={{ opacity: 0, y: 5, scale: 0.95 }}
                                    className="absolute right-0 top-full mt-2 z-50 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-black/5 dark:border-white/10 p-1 flex flex-col min-w-[140px]"
                                >
                                    <span className="text-[10px] font-bold text-slate-400 px-3 py-1.5 uppercase tracking-widest">{t('teamManager.sort.label')}</span>
                                    <button onClick={() => applySort('name')} className="flex items-center justify-between px-3 py-2 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 rounded-lg text-left">
                                        <div className="flex items-center gap-2"><ArrowDownAZ size={14} /> {t('teamManager.sort.name')}</div>
                                        {sortConfig.criteria === 'name' && <span className="text-[10px]">{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>}
                                    </button>
                                    <button onClick={() => applySort('number')} className="flex items-center justify-between px-3 py-2 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 rounded-lg text-left">
                                        <div className="flex items-center gap-2"><ArrowDown01 size={14} /> {t('teamManager.sort.number')}</div>
                                        {sortConfig.criteria === 'number' && <span className="text-[10px]">{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>}
                                    </button>
                                    <button onClick={() => applySort('skill')} className="flex items-center justify-between px-3 py-2 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 rounded-lg text-left">
                                        <div className="flex items-center gap-2"><ArrowUpWideNarrow size={14} /> {t('teamManager.sort.skill')}</div>
                                        {sortConfig.criteria === 'skill' && <span className="text-[10px]">{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>}
                                    </button>
                                    <div className="h-px bg-black/5 dark:bg-white/5 my-1" />
                                    <button onClick={() => applySort('original')} className="flex items-center gap-2 px-3 py-2 text-xs font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-white/5 rounded-lg text-left">
                                        <RefreshCcw size={14} /> Reset
                                    </button>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                </div>

                <div className="flex gap-1">
                    <div className={`
                        px-2 py-0.5 rounded-md text-[10px] font-bold border flex items-center gap-1 shadow-sm text-white
                        ${colorConfig.bg} ${colorConfig.border}
                    `}>
                        <Users size={10} strokeWidth={2.5} /> {displayedPlayers.length}
                    </div>
                    <div className={`
                        px-2 py-0.5 rounded-md text-[10px] font-bold border flex items-center gap-1 shadow-sm
                        ${colorConfig.bg.replace('/20', '/40')} ${colorConfig.border}
                        dark:text-white dark:border-white/20 text-slate-700
                    `} title="Avg Team Skill">
                        <Activity size={10} strokeWidth={2.5} /> {teamStrength}
                    </div>
                </div>
            </div>
        </div>
        
        {/* Color Picker for everyone (including Queue) */}
        {viewMode === 'main' && (
            <ColorPicker 
                selected={team.color || 'slate'} 
                onChange={handleUpdateColor} 
                usedColors={usedColors}
            />
        )}
      </div>

      {team.hasActiveBench && (
          <div className="flex justify-end mb-2 gap-2">
              <button
                  onClick={() => setIsSubModalOpen(true)}
                  className={`
                      flex items-center justify-center p-2 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all
                      bg-white/50 dark:bg-white/5 border border-black/5 dark:border-white/5 text-slate-500 hover:text-indigo-500
                  `}
                  title="Substitute Player"
              >
                  <ArrowRightLeft size={18} />
              </button>

              <button 
                  onClick={toggleView}
                  className={`
                      flex items-center gap-1 px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all
                      ${viewMode === 'reserves' 
                          ? 'bg-amber-500 text-white shadow-md' 
                          : 'bg-black/5 dark:bg-white/5 text-slate-500 hover:bg-black/10 dark:hover:bg-white/10'}
                  `}
              >
                  {viewMode === 'reserves' ? <ChevronLeft size={14} /> : null}
                  {viewMode === 'reserves' ? 'Back to Main' : 'Manage Bench'}
                  {viewMode === 'main' ? <ChevronRight size={14} /> : null}
              </button>
          </div>
      )}

      <div 
        className={`flex-1 space-y-1.5 mt-1 overflow-y-auto custom-scrollbar ${isQueue ? 'min-h-[40px]' : 'min-h-[60px]'}`}
        onScroll={handleScroll}
      >
        {displayedPlayers.length === 0 && (
            <span className="text-[10px] text-slate-400 italic py-6 block text-center border-2 border-dashed border-slate-200 dark:border-white/5 rounded-xl bg-slate-50/50 dark:bg-white/[0.01]">
                {viewMode === 'reserves' ? "Bench Empty" : t('teamManager.dragPlayersHere')}
            </span>
        )}
        
        <SortableContextFixed items={displayedPlayers.map(p => p.id)} strategy={verticalListSortingStrategy}>
          {displayedPlayers.map(p => (
            <PlayerCard 
                key={p.id} 
                player={p} 
                locationId={listId} 
                profiles={profiles}
                onUpdateName={onUpdatePlayerName} 
                onUpdateNumber={onUpdatePlayerNumber}
                onUpdateSkill={onUpdateSkill}
                onSaveProfile={onSaveProfile}
                onRequestProfileEdit={onRequestProfileEdit}
                // FIX: Queue players should NOT be compact to maintain font size, but padding is handled by container class
                isCompact={viewMode === 'reserves' || (window.innerWidth < 640 && !isQueue)}
                onToggleMenu={onTogglePlayerMenu}
                isMenuActive={activePlayerMenuId === p.id}
                validateNumber={(n) => validateNumber(n, team.id, p.id)}
            />
          ))}
        </SortableContextFixed>
      </div>
      
      <AddPlayerInput onAdd={handleAdd} disabled={isFull} customLabel={addButtonLabel} />
    </div>
  );
}, (prev, next) => {
    return (
        prev.team === next.team && 
        prev.profiles === next.profiles &&
        prev.usedColors === next.usedColors &&
        prev.isQueue === next.isQueue &&
        prev.activePlayerMenuId === next.activePlayerMenuId &&
        prev.isNext === next.isNext
    );
});

// ... ProfileCard and BatchInputSection remain unchanged ...
// Including them to ensure full file integrity.

const ProfileCard = memo(({ 
    profile, 
    onDelete, 
    onAddToGame,
    status,
    onEdit,
    placementOptions
}: { 
    profile: PlayerProfile; 
    onDelete: () => void; 
    onAddToGame: (target: string) => void;
    status: PlayerLocationStatus;
    onEdit: () => void;
    placementOptions: PlacementOption[];
}) => {
    const [showJoinMenu, setShowJoinMenu] = useState(false);
    const [menuPos, setMenuPos] = useState<{top: number, left: number, width: number} | null>(null);
    const joinButtonRef = useRef<HTMLButtonElement>(null);
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!showJoinMenu) return;
        const handleInteraction = (event: Event) => {
            if (
                (joinButtonRef.current && joinButtonRef.current.contains(event.target as Node)) ||
                (menuRef.current && menuRef.current.contains(event.target as Node))
            ) {
                return;
            }
            setShowJoinMenu(false);
        };
        
        document.addEventListener('mousedown', handleInteraction);
        document.addEventListener(SCROLL_EVENT, handleInteraction);
        window.addEventListener('scroll', handleInteraction, { capture: true });

        return () => {
            document.removeEventListener('mousedown', handleInteraction);
            document.removeEventListener(SCROLL_EVENT, handleInteraction);
            window.removeEventListener('scroll', handleInteraction, { capture: true });
        };
    }, [showJoinMenu]);

    const handleToggleJoinMenu = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (showJoinMenu) {
            setShowJoinMenu(false);
        } else if (joinButtonRef.current) {
            const rect = joinButtonRef.current.getBoundingClientRect();
            
            const optionHeight = 44;
            const estimatedMenuHeight = (placementOptions.length * optionHeight) + 16;
            
            const spaceBelow = window.innerHeight - rect.bottom;
            
            let top = rect.bottom + 4;
            if (spaceBelow < estimatedMenuHeight) {
                top = rect.top - estimatedMenuHeight - 4;
            }
    
            setMenuPos({ 
                top, 
                left: rect.left,
                width: rect.width 
            });
            setShowJoinMenu(true);
        }
    };

    const statusLabels: Record<string, string> = {
        'A': 'Court A',
        'B': 'Court B',
        'Queue': 'In Queue',
        'A_Bench': 'Bench A',
        'B_Bench': 'Bench B',
        'Queue_Bench': 'Q-Bench'
    };

    return (
        <>
            <div className={`
                relative p-3 rounded-2xl border transition-all
                ${status 
                    ? 'bg-indigo-50/50 dark:bg-indigo-500/10 border-indigo-200 dark:border-indigo-500/30' 
                    : 'bg-white dark:bg-white/5 border-slate-200 dark:border-white/10 hover:border-slate-300 dark:hover:border-white/20'}
            `}>
                {status && (
                    <div className="absolute top-2 right-2 px-2 py-0.5 rounded-md bg-indigo-100 dark:bg-indigo-500/20 text-[9px] font-bold text-indigo-600 dark:text-indigo-300 uppercase tracking-wider border border-indigo-200 dark:border-indigo-500/30">
                        {statusLabels[status] || status}
                    </div>
                )}

                <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-black/20 flex items-center justify-center text-xl shadow-inner">
                        {profile.avatar || '👤'}
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                            <h4 className="font-bold text-slate-800 dark:text-slate-200 truncate text-sm">{profile.name}</h4>
                            {profile.number && <span className="text-[10px] font-mono text-slate-400">#{profile.number}</span>}
                        </div>
                        
                        <div className="flex items-center gap-1 mt-1">
                            <Star size={10} className="text-amber-400 fill-amber-400" />
                            <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">Level {profile.skillLevel}</span>
                        </div>
                    </div>
                </div>

                <div className="flex gap-2 mt-3">
                    {!status ? (
                        <button 
                            ref={joinButtonRef}
                            onClick={handleToggleJoinMenu}
                            className="flex-1 flex items-center justify-center gap-2 py-1.5 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-500/10 dark:hover:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 rounded-lg text-[10px] font-bold uppercase tracking-wider border border-indigo-200 dark:border-indigo-500/20 transition-colors"
                        >
                            <PlusCircle size={12} /> Assign to Team
                        </button>
                    ) : (
                        <div className="flex-1 flex items-center justify-center py-1.5 text-[10px] font-bold text-slate-400 italic">
                            In Game
                        </div>
                    )}
                    
                    <button onClick={onEdit} className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors rounded-lg hover:bg-black/5 dark:hover:bg-white/5">
                        <Edit2 size={14} />
                    </button>
                    
                    <button onClick={onDelete} className="p-1.5 text-slate-400 hover:text-rose-500 transition-colors rounded-lg hover:bg-rose-50 dark:hover:bg-rose-500/10">
                        <Trash2 size={14} />
                    </button>
                </div>
            </div>

            {showJoinMenu && menuPos && createPortal(
                <div 
                    className="fixed z-[9999]"
                    style={{ 
                        top: menuPos.top, 
                        left: menuPos.left,
                        width: menuPos.width 
                    }}
                >
                    <motion.div 
                        ref={menuRef}
                        initial={{ opacity: 0, y: 5, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 5, scale: 0.95 }}
                        className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-black/10 dark:border-white/10 overflow-hidden flex flex-col p-1 max-h-48 overflow-y-auto custom-scrollbar"
                    >
                        {placementOptions.map(opt => (
                            <button 
                                key={opt.targetId}
                                onClick={() => { onAddToGame(opt.targetId); setShowJoinMenu(false); }}
                                className="w-full text-left px-3 py-2 text-[10px] font-bold uppercase tracking-wide hover:bg-slate-100 dark:hover:bg-white/5 rounded-lg text-slate-600 dark:text-slate-300 truncate flex items-center gap-2"
                            >
                                {opt.teamColor && <div className={`w-2 h-2 rounded-full ${resolveTheme(opt.teamColor).halo}`} />}
                                {opt.label}
                            </button>
                        ))}
                    </motion.div>
                </div>,
                document.body
            )}
        </>
    );
});

const BatchInputSection = memo(({ onGenerate }: { onGenerate: (names: string[]) => void }) => {
    const { t } = useTranslation();
    const [rawNames, setRawNames] = useState('');

    const handleGenerate = () => {
        const names = rawNames.split('\n').map(n => n.trim()).filter(n => n);
        if (names.length > 0) {
            onGenerate(names);
            setRawNames('');
        }
    };

    return (
        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 px-1 pb-10 pt-4"> 
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 flex items-start gap-2 text-xs text-amber-700 dark:text-amber-400">
                <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
                <div>
                    <p className="font-bold mb-1">Power User Tip:</p>
                    <p>Format: <code>Name Skill</code> (e.g., "John 8")</p>
                    <p className="opacity-80 mt-1">If skill (1-10) is provided, it will be set automatically. Otherwise defaults to 5.</p>
                </div>
            </div>
            
            <textarea className="w-full h-64 bg-white/50 dark:bg-black/40 border border-slate-200 dark:border-white/10 rounded-2xl p-4 text-slate-800 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 font-mono text-sm resize-none custom-scrollbar"
               placeholder={t('teamManager.batchInputPlaceholder')} value={rawNames} onChange={e => setRawNames(e.target.value)} />
            <Button onClick={handleGenerate} className="w-full" size="lg"><Shuffle size={18} /> {t('teamManager.generateTeams')}</Button>
        </div>
    );
});

// --- ROSTER BOARD COMPONENT ---
const RosterBoard = ({ 
    courtA, courtB, queue, 
    wrappedUpdateSkill, wrappedAdd, handleKnockoutRequest, usedColors, 
    wrappedUpdateName, wrappedUpdateNumber, wrappedMove, 
    playerStatsMap, setEditingTarget, handleTogglePlayerMenu, activePlayerMenu,
    toggleTeamBench, wrappedUpdateColor, substitutePlayers, validateNumber
}: any) => {
    const { t } = useTranslation();
    const [queueSearchTerm, setQueueSearchTerm] = useState('');
    const queueScrollRef = useRef<HTMLDivElement>(null);
    const [isAutoScrolling, setIsAutoScrolling] = useState(false);
    const autoScrollDirection = useRef<'left' | 'right' | null>(null);
    
    // NEW: Pagination State
    const [queuePage, setQueuePage] = useState(1);

    // Filtered Queue
    const filteredQueue = useMemo(() => {
        if (!queueSearchTerm.trim()) return queue;
        return queue.filter((t: any) => t.name.toLowerCase().includes(queueSearchTerm.toLowerCase()));
    }, [queue, queueSearchTerm]);

    const handleScrollQueue = (direction: 'left' | 'right') => {
        if (queueScrollRef.current) {
            const cardWidth = queueScrollRef.current.clientWidth;
            const currentScroll = queueScrollRef.current.scrollLeft;
            queueScrollRef.current.scrollTo({
                left: direction === 'left' ? currentScroll - cardWidth : currentScroll + cardWidth,
                behavior: 'smooth'
            });
        }
    };
    
    // NEW: Scroll Listener for Pagination Updates
    const onQueueScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
        // Dispatch event to dismiss floaters
        dispatchScrollEvent();

        if (!e.currentTarget) return;
        const width = e.currentTarget.clientWidth;
        if (width === 0) return;
        const page = Math.round(e.currentTarget.scrollLeft / width) + 1;
        setQueuePage(page);
    }, []);

    useDndMonitor({
        onDragStart: () => setIsAutoScrolling(true),
        onDragEnd: () => {
            setIsAutoScrolling(false);
            autoScrollDirection.current = null;
        },
        onDragCancel: () => {
            setIsAutoScrolling(false);
            autoScrollDirection.current = null;
        }
    });

    useEffect(() => {
        if (!isAutoScrolling) return;

        const handleMouseMove = (e: MouseEvent | TouchEvent) => {
            if (!queueScrollRef.current) return;
            const rect = queueScrollRef.current.getBoundingClientRect();
            const x = (e as MouseEvent).clientX || (e as TouchEvent).touches?.[0]?.clientX || 0;
            
            const EDGE_SIZE = 50;
            const y = (e as MouseEvent).clientY || (e as TouchEvent).touches?.[0]?.clientY || 0;
            if (y < rect.top || y > rect.bottom) {
                autoScrollDirection.current = null;
                return;
            }

            if (x < rect.left + EDGE_SIZE) {
                autoScrollDirection.current = 'left';
            } else if (x > rect.right - EDGE_SIZE) {
                autoScrollDirection.current = 'right';
            } else {
                autoScrollDirection.current = null;
            }
        };

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('touchmove', handleMouseMove);

        const interval = setInterval(() => {
            if (autoScrollDirection.current && queueScrollRef.current) {
                const scrollAmount = 10;
                queueScrollRef.current.scrollBy({ 
                    left: autoScrollDirection.current === 'left' ? -scrollAmount : scrollAmount,
                    behavior: 'auto' 
                });
            }
        }, 16); // ~60fps

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('touchmove', handleMouseMove);
            clearInterval(interval);
        };
    }, [isAutoScrolling]);

    return (
        <div className="flex flex-col [@media(min-width:736px)]:grid [@media(min-width:736px)]:grid-cols-2 [@media(min-width:992px)]:flex [@media(min-width:992px)]:flex-row gap-4 [@media(min-width:992px)]:gap-8 pb-24 px-1 min-h-[60vh] pt-4">
            <div className="w-full [@media(min-width:992px)]:w-[30%] h-full">
                <TeamColumn id="A" team={courtA} 
                    onUpdateSkill={wrappedUpdateSkill} onAddPlayer={wrappedAdd} onKnockoutRequest={handleKnockoutRequest} usedColors={usedColors} onUpdatePlayerName={wrappedUpdateName} onUpdatePlayerNumber={wrappedUpdateNumber} onMove={wrappedMove} statsMap={playerStatsMap} onRequestProfileEdit={(id: string) => setEditingTarget({ type: 'player', id })} onTogglePlayerMenu={handleTogglePlayerMenu} activePlayerMenuId={activePlayerMenu?.playerId || null} 
                    profiles={new Map()} onUpdateTeamName={()=>{}} onUpdateTeamColor={wrappedUpdateColor} onSaveProfile={()=>{}} onSortTeam={()=>{}} toggleTeamBench={toggleTeamBench} substitutePlayers={substitutePlayers} validateNumber={validateNumber}
                    {...({} as any)} 
                />
            </div>

            <div className="w-full [@media(min-width:992px)]:w-[30%] h-full">
                <TeamColumn id="B" team={courtB} 
                    onUpdateSkill={wrappedUpdateSkill} onAddPlayer={wrappedAdd} onKnockoutRequest={handleKnockoutRequest} usedColors={usedColors} onUpdatePlayerName={wrappedUpdateName} onUpdatePlayerNumber={wrappedUpdateNumber} onMove={wrappedMove} statsMap={playerStatsMap} onRequestProfileEdit={(id: string) => setEditingTarget({ type: 'player', id })} onTogglePlayerMenu={handleTogglePlayerMenu} activePlayerMenuId={activePlayerMenu?.playerId || null} 
                    profiles={new Map()} onUpdateTeamName={()=>{}} onUpdateTeamColor={wrappedUpdateColor} onSaveProfile={()=>{}} onSortTeam={()=>{}} toggleTeamBench={toggleTeamBench} substitutePlayers={substitutePlayers} validateNumber={validateNumber}
                    {...({} as any)}
                />
            </div>

            {/* --- QUEUE SECTION (Carousel Style) --- */}
            <div className="w-full [@media(min-width:736px)]:col-span-2 [@media(min-width:992px)]:w-[40%] relative p-1 pt-8 rounded-[2.5rem] bg-slate-100/50 dark:bg-white/[0.02] border border-dashed border-slate-300 dark:border-white/10 flex flex-col h-full overflow-hidden">
                
                {/* Floating Badge Label */}
                <div className="absolute top-4 left-6 px-3 py-1 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-full text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-2 shadow-sm z-30">
                    <Layers size={10} /><span>{t('teamManager.queue')}</span><span className="bg-slate-200 dark:bg-white/10 px-1.5 rounded text-slate-600 dark:text-slate-300">{queue.length}</span>
                </div>
                
                {/* Page Indicator (Top Right) - Updated Logic */}
                {filteredQueue.length > 1 && (
                    <div className="absolute top-4 right-6 px-3 py-1 rounded-full bg-black/5 dark:bg-white/5 text-[9px] font-bold text-slate-400 border border-black/5 dark:border-white/5 z-30">
                        Page {queuePage} / {filteredQueue.length}
                    </div>
                )}
                
                {/* Queue Search & Navigation Header */}
                <div className="flex items-center gap-2 px-4 mb-2 flex-shrink-0 mt-4">
                    <div className="relative flex-1 group">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors" size={14} />
                        <input 
                            value={queueSearchTerm}
                            onChange={(e) => setQueueSearchTerm(e.target.value)}
                            placeholder={t('teamManager.searchProfiles').replace('Profiles', 'Queue')}
                            className="w-full bg-white/60 dark:bg-black/20 border border-black/5 dark:border-white/5 rounded-xl pl-9 pr-8 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all placeholder:font-medium placeholder:text-slate-400"
                        />
                        {queueSearchTerm && (
                            <button 
                                onClick={() => setQueueSearchTerm('')}
                                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                            >
                                <X size={12} />
                            </button>
                        )}
                    </div>
                    
                    {/* Navigation Buttons */}
                    {filteredQueue.length > 1 && (
                        <div className="flex bg-white/60 dark:bg-black/20 rounded-xl p-0.5 border border-black/5 dark:border-white/5 shrink-0">
                            <button onClick={() => handleScrollQueue('left')} className="p-1.5 hover:bg-black/5 dark:hover:bg-white/10 rounded-lg text-slate-500 dark:text-slate-400 transition-colors">
                                <ChevronLeft size={16} />
                            </button>
                            <div className="w-px bg-black/5 dark:bg-white/5 my-1" />
                            <button onClick={() => handleScrollQueue('right')} className="p-1.5 hover:bg-black/5 dark:hover:bg-white/10 rounded-lg text-slate-500 dark:text-slate-400 transition-colors">
                                <ChevronRight size={16} />
                            </button>
                        </div>
                    )}
                </div>

                {/* Queue Carousel Container - Fixed Layout clipping */}
                <div 
                    ref={queueScrollRef}
                    onScroll={onQueueScroll}
                    className="flex-1 min-h-0 overflow-x-auto snap-x snap-mandatory no-scrollbar flex items-stretch pb-2 pt-2 px-1" // Reduced horizontal padding
                >
                    {filteredQueue.length === 0 ? (
                        <div className="flex-1 flex flex-col items-center justify-center h-full text-slate-400 italic gap-2 min-h-[300px] w-full">
                            <Search size={24} className="opacity-20" />
                            <span className="text-[10px]">{queue.length === 0 ? t('teamManager.queueEmpty') : "No teams match filter"}</span>
                        </div>
                    ) : (
                        filteredQueue.map((team: Team, idx: number) => (
                            <div key={team.id} className="snap-center w-full flex-shrink-0 h-full px-2 pt-1 pb-1 flex flex-col"> {/* Tight padding */}
                                <TeamColumn 
                                    id={team.id} 
                                    team={team} 
                                    {...({} as any)} // Props bridging
                                    profiles={new Map()} onUpdateTeamName={()=>{}} onUpdateTeamColor={wrappedUpdateColor} onSaveProfile={()=>{}} onSortTeam={()=>{}} 
                                    toggleTeamBench={toggleTeamBench} 
                                    substitutePlayers={()=>{}}
                                    onUpdateSkill={wrappedUpdateSkill} 
                                    onAddPlayer={wrappedAdd} 
                                    onKnockoutRequest={handleKnockoutRequest} 
                                    usedColors={usedColors} 
                                    isQueue={true} 
                                    onUpdatePlayerName={wrappedUpdateName} 
                                    onUpdatePlayerNumber={wrappedUpdateNumber} 
                                    onMove={wrappedMove} 
                                    statsMap={playerStatsMap} 
                                    onRequestProfileEdit={(id: string) => setEditingTarget({ type: 'player', id })} 
                                    onTogglePlayerMenu={handleTogglePlayerMenu} 
                                    activePlayerMenuId={activePlayerMenu?.playerId || null} 
                                    isNext={idx === 0 && !queueSearchTerm}
                                    validateNumber={validateNumber}
                                />
                            </div>
                        ))
                    )}
                </div>
                
                <div className="p-4 pt-2 border-t border-black/5 dark:border-white/5 bg-slate-50/50 dark:bg-transparent flex-shrink-0">
                     <AddPlayerInput onAdd={(n, num, s) => wrappedAdd(n, 'Queue', num, s)} customLabel="Add New Queue Team" />
                </div>
            </div>
        </div>
    );
};

export const TeamManagerModal: React.FC<TeamManagerModalProps> = (props) => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<'roster' | 'profiles' | 'input'>('roster');
  const [activePlayer, setActivePlayer] = useState<Player | null>(null);
  const [undoVisible, setUndoVisible] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [benchConfirmState, setBenchConfirmState] = useState<{ teamId: string, playerId: string } | null>(null);
  
  // NEW: State for Drop Confirmation Logic
  const [dropConfirmState, setDropConfirmState] = useState<{ 
      playerId: string; 
      sourceId: string; 
      targetTeamId: string; 
      index: number;
  } | null>(null);

  const [toast, setToast] = useState<{ message: string, visible: boolean }>({ message: '', visible: false });

  const [pendingSyncs, setPendingSyncs] = useState<{ player: Player, profile: PlayerProfile }[]>([]);
  const [showSyncConfirm, setShowSyncConfirm] = useState(false);

  const [editingTarget, setEditingTarget] = useState<{ type: 'player' | 'profile', id: string } | null>(null);
  const [activePlayerMenu, setActivePlayerMenu] = useState<{ playerId: string; rect: DOMRect } | null>(null);
  const playerMenuRef = useRef<HTMLDivElement>(null);
  const haptics = useHaptics();
  
  // Throttling Ref for Drag Updates (Prevents Error 185)
  const lastMoveRef = useRef<{ id: string, from: string, to: string, index: number, ts: number } | null>(null);

  const wrappedUpdateName = useCallback((id: string, name: string) => { props.onUpdatePlayerName(id, name); }, [props.onUpdatePlayerName]);
  const wrappedUpdateNumber = useCallback((id: string, number: string) => { props.onUpdatePlayerNumber(id, number); }, [props.onUpdatePlayerNumber]);
  const wrappedUpdateSkill = useCallback((id: string, skill: number) => { props.onUpdatePlayerSkill(id, skill); }, [props.onUpdatePlayerSkill]);
  const wrappedUpdateColor = useCallback((id: string, color: TeamColor) => { props.onUpdateTeamColor(id, color); }, [props.onUpdateTeamColor]);
  
  // Throttled Move Function (Reinforced for Error 185)
  const wrappedMove = useCallback((playerId: string, fromId: string, toId: string, newIndex?: number) => { 
      const now = Date.now();
      const idx = newIndex ?? -1;
      
      // Strict Redundancy Check: If moving to same spot, ignore immediately
      if (lastMoveRef.current && 
          lastMoveRef.current.id === playerId &&
          lastMoveRef.current.from === fromId &&
          lastMoveRef.current.to === toId &&
          lastMoveRef.current.index === idx
      ) {
          return;
      }

      // Throttle: Prevent rapid updates (increased safety margin)
      if (lastMoveRef.current && (now - lastMoveRef.current.ts < 100)) {
          return;
      }
      
      // ANTI-OSCILLATION: If moving between DIFFERENT containers, enforce larger delay
      if (lastMoveRef.current && fromId !== toId && lastMoveRef.current.to === toId && (now - lastMoveRef.current.ts < 300)) {
          return;
      }

      lastMoveRef.current = { id: playerId, from: fromId, to: toId, index: idx, ts: now };
      props.onMove(playerId, fromId, toId, newIndex); 
  }, [props.onMove]);

  const wrappedAdd = useCallback((name: string, target: string, number?: string, skill?: number) => { props.onAddPlayer(name, target, number, skill); }, [props.onAddPlayer]);

  const handleTogglePlayerMenu = (playerId: string, targetElement: HTMLElement) => {
    if (activePlayerMenu?.playerId === playerId) {
        setActivePlayerMenu(null);
    } else {
        setActivePlayerMenu({ playerId, rect: targetElement.getBoundingClientRect() });
    }
  };

  useEffect(() => {
    const handleClose = (event: MouseEvent) => {
        if (playerMenuRef.current && playerMenuRef.current.contains(event.target as Node)) return;
        
        setActivePlayerMenu(null);
    };
    const handleScrollClose = () => { setActivePlayerMenu(null); };

    if (activePlayerMenu) {
        document.addEventListener('mousedown', handleClose);
        document.addEventListener(SCROLL_EVENT, handleScrollClose);
        window.addEventListener('scroll', handleScrollClose, { capture: true });
    }
    
    return () => {
        document.removeEventListener('mousedown', handleClose);
        document.removeEventListener(SCROLL_EVENT, handleScrollClose);
        window.removeEventListener('scroll', handleScrollClose, { capture: true });
    };
  }, [activePlayerMenu]);

  const checkProfileDiffs = useCallback(() => {
      const allPlayers = [
          ...props.courtA.players, ...(props.courtA.reserves || []),
          ...props.courtB.players, ...(props.courtB.reserves || []),
          ...props.queue.flatMap(t => [...t.players, ...(t.reserves || [])])
      ];

      const diffs: { player: Player, profile: PlayerProfile }[] = [];

      allPlayers.forEach(p => {
          if (!p.profileId) return;
          const profile = props.profiles.get(p.profileId);
          if (!profile) return;

          if (
              p.name !== profile.name || 
              p.skillLevel !== profile.skillLevel || 
              (p.number && p.number !== profile.number)
          ) {
              diffs.push({ player: p, profile });
          }
      });

      return diffs;
  }, [props.courtA, props.courtB, props.queue, props.profiles]);

  const handleCloseAttempt = () => {
      const diffs = checkProfileDiffs();
      if (diffs.length > 0) {
          setPendingSyncs(diffs);
          setShowSyncConfirm(true);
      } else {
          props.onClose();
      }
  };

  const confirmSync = () => {
      pendingSyncs.forEach(({ player, profile }) => {
          props.onSaveProfile(player.id, { 
              name: player.name, 
              number: player.number, 
              avatar: profile.avatar,
              skill: player.skillLevel
          });
      });
      setShowSyncConfirm(false);
      setPendingSyncs([]);
      props.onClose();
  };

  const discardSync = () => {
      setShowSyncConfirm(false);
      setPendingSyncs([]);
      props.onClose();
  };

  const handleGenerate = useCallback((names: string[]) => {
      props.onGenerate(names); 
      setActiveTab('roster');
  }, [props.onGenerate]);

  const playerStatsMap = useMemo(() => {
      const stats = new Map<string, PlayerStats>();
      if (!props.matchLog || !props.enablePlayerStats) return stats;
      
      props.matchLog.forEach(log => {
          if (log.type === 'POINT' && log.playerId) {
              const curr = stats.get(log.playerId) || { k: 0, b: 0, a: 0 };
              if (log.skill === 'attack') curr.k++;
              else if (log.skill === 'block') curr.b++;
              else if (log.skill === 'ace') curr.a++;
              stats.set(log.playerId, curr);
          }
      });
      return stats;
  }, [props.matchLog, props.enablePlayerStats]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } })
  );
  
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    if (props.deletedCount > 0) {
      setUndoVisible(true);
      timer = setTimeout(() => {
        setUndoVisible(false);
        setTimeout(() => props.onCommitDeletions(), 200);
      }, 5000);
    } else {
      setUndoVisible(false);
    }
    return () => clearTimeout(timer);
  }, [props.deletedCount, props.onCommitDeletions]);

  const findContainer = useCallback((id: string) => {
    if (id === 'A' || props.courtA.players.some(p => p.id === id)) return 'A';
    if (props.courtA.reserves?.some(p => p.id === id)) return 'A_Reserves';
    
    if (id === 'B' || props.courtB.players.some(p => p.id === id)) return 'B';
    if (props.courtB.reserves?.some(p => p.id === id)) return 'B_Reserves';
    
    if (id === 'A_Reserves') return 'A_Reserves'; 
    if (id === 'B_Reserves') return 'B_Reserves';
    
    // Check Queue
    for (const team of props.queue) {
        if (id === team.id || team.players.some(p => p.id === id)) return team.id;
        // The containerID for bench is teamID_Reserves
        if (id === `${team.id}_Reserves` || (team.reserves && team.reserves.some(p => p.id === id))) return `${team.id}_Reserves`;
    }
    return null;
  }, [props.courtA, props.courtB, props.queue]);

  const getTeamById = (id: string) => {
      if (id === 'A' || id === 'A_Reserves') return props.courtA;
      if (id === 'B' || id === 'B_Reserves') return props.courtB;
      const queueId = id.split('_')[0]; 
      return props.queue.find(t => t.id === queueId || t.id === id);
  };

  const playersById = useMemo(() => {
    const map = new Map<string, Player>();
    [
        ...props.courtA.players, ...(props.courtA.reserves||[]), 
        ...props.courtB.players, ...(props.courtB.reserves||[]), 
        ...props.queue.flatMap(t => [...t.players, ...(t.reserves||[])])
    ].forEach(p => map.set(p.id, p));
    return map;
  }, [props.courtA, props.courtB, props.queue]);

  const usedColors = useMemo(() => {
      const set = new Set<string>();
      if (props.courtA.color) set.add(props.courtA.color);
      if (props.courtB.color) set.add(props.courtB.color);
      props.queue.forEach(t => { if(t.color) set.add(t.color) });
      return set;
  }, [props.courtA.color, props.courtB.color, props.queue]);

  const placementOptions = useMemo<PlacementOption[]>(() => {
      const options: PlacementOption[] = [];
      const allTeams = [props.courtA, props.courtB, ...props.queue];

      allTeams.forEach(team => {
          if (team.players.length < 6) {
              options.push({ 
                  label: `Join ${team.name}`, 
                  targetId: team.id,
                  type: 'main',
                  teamColor: team.color
              });
          }
          if (team.hasActiveBench && (team.reserves || []).length < 6) {
              options.push({ 
                  label: `Join ${team.name} (Bench)`, 
                  targetId: team.id === 'A' ? 'A_Reserves' : (team.id === 'B' ? 'B_Reserves' : `${team.id}_Reserves`),
                  type: 'bench',
                  teamColor: team.color
              });
          }
      });
      options.push({ label: 'Create New Team (Queue)', targetId: 'Queue', type: 'queue' });
      return options;
  }, [props.courtA, props.courtB, props.queue]);

  const filteredProfiles = useMemo(() => {
      return Array.from(props.profiles.values())
          .filter((p: PlayerProfile) => p.name.toLowerCase().includes(searchTerm.toLowerCase()))
          .sort((a: PlayerProfile, b: PlayerProfile) => a.name.localeCompare(b.name));
  }, [props.profiles, searchTerm]);

  const handleDragStart = (event: DragStartEvent) => {
    const player = playersById.get(event.active.id as string);
    if (player) {
        setActivePlayer(player);
        haptics.impact('light');
    }
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;
    const activeId = active.id as string;
    const overId = over.id as string;
    
    // Find containers based on ID (could be item ID or container ID)
    const activeContainer = findContainer(activeId);
    const overContainer = findContainer(overId) || (over.data.current?.containerId as string);
    
    if (!activeContainer || !overContainer) return;
    
    if (activeContainer !== overContainer) {
        const overTeam = getTeamById(overContainer);
        if (!overTeam) return;

        // VISUAL FEEDBACK LOGIC HANDLED INSIDE TeamColumn VIA useSortable isOver
        // Here we just want to ensure we don't crash or do weird jumps
        
        const activeIndex = active.data.current?.sortable.index;
        let targetLen = overTeam.players.length;
        if (overContainer.includes('Reserves')) targetLen = overTeam.reserves?.length || 0;
        
        const overIndex = over.data.current?.sortable.index ?? targetLen + 1;
        
        // Don't commit move yet, just temporary sorting visualization handled by dnd-kit context
        // But wrappedMove updates local state for immediate feedback
        // IMPORTANT: We skip business logic checks here for smoothness, do them on DragEnd
        wrappedMove(activeId, activeContainer, overContainer, overIndex);
    }
  };
  
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActivePlayer(null);
    
    if (!over) return;
    const activeId = active.id as string;
    const overId = over.id as string;
    
    const activeContainer = findContainer(activeId);
    const overContainer = findContainer(overId) || (over.data.current?.containerId as string);
    
    if (activeContainer && overContainer) {
        const overTeam = getTeamById(overContainer);
        if (!overTeam) return;

        const isMainRoster = !overContainer.includes('Reserves');
        const activeIndex = active.data.current?.sortable.index;
        const overIndex = over.data.current?.sortable.index;
        
        // --- SMART DROP LOGIC ---
        if (isMainRoster && activeContainer !== overContainer && overTeam.players.length >= 6) {
            // TARGET MAIN IS FULL
            
            if (overTeam.hasActiveBench) {
                // SCENARIO B: Auto-redirect to Reserves
                const reserveId = overContainer === 'A' ? 'A_Reserves' : (overContainer === 'B' ? 'B_Reserves' : `${overContainer}_Reserves`);
                const reservesLen = overTeam.reserves?.length || 0;
                
                // If Bench also full, reject
                if (reservesLen >= 6) {
                    haptics.notification('error');
                    // Move back to origin
                    wrappedMove(activeId, activeContainer, activeContainer, activeIndex);
                    return;
                }

                haptics.notification('success');
                setToast({ message: "Moved to Reserves (Main Full)", visible: true });
                
                // Execute move to Reserves instead
                wrappedMove(activeId, activeContainer, reserveId, reservesLen);
                return;

            } else {
                // SCENARIO A: Prompt to activate bench
                haptics.notification('warning');
                
                // Temporarily revert visual move so it doesn't look stuck
                wrappedMove(activeId, activeContainer, activeContainer, activeIndex);

                // Open Confirmation
                setDropConfirmState({
                    playerId: activeId,
                    sourceId: activeContainer,
                    targetTeamId: overTeam.id,
                    index: 6 // Append to start of bench roughly
                });
                return;
            }
        }
        
        // Normal Move
        if (activeContainer === overContainer && activeIndex !== overIndex) {
             wrappedMove(activeId, activeContainer, overContainer, overIndex);
        }
        else if (activeContainer !== overContainer) {
             let targetLen = overTeam.players.length;
             if (overContainer.includes('Reserves')) targetLen = overTeam.reserves?.length || 0;
             wrappedMove(activeId, activeContainer, overContainer, overIndex ?? targetLen);
        }
        haptics.impact('light');
    }
  };

  const confirmDropActivation = () => {
      if (dropConfirmState) {
          const { playerId, sourceId, targetTeamId } = dropConfirmState;
          
          // 1. Activate Bench
          props.toggleTeamBench(targetTeamId);
          
          // 2. Determine correct ID for reserves
          let reserveId = '';
          if (targetTeamId === 'A' || targetTeamId === props.courtA.id) reserveId = 'A_Reserves';
          else if (targetTeamId === 'B' || targetTeamId === props.courtB.id) reserveId = 'B_Reserves';
          else reserveId = `${targetTeamId}_Reserves`;

          // 3. Move Player
          setTimeout(() => {
              wrappedMove(playerId, sourceId, reserveId, 0); // Add to start of bench
              haptics.notification('success');
          }, 50);
          
          setDropConfirmState(null);
      }
  };

  // --- UPDATED KNOCKOUT LOGIC ---
  const handleKnockoutRequest = useCallback((teamId: string, playerId: string) => {
      const team = getTeamById(teamId);
      if (!team) return;
      
      // If team is in Queue, we might process regular removal (which puts to end of queue for safety)
      const isQueueTeam = teamId !== 'A' && teamId !== 'B' && !teamId.includes('_Reserves');

      // For Court Teams (A/B), if Bench is ACTIVE, we move to bench.
      // If Bench is NOT ACTIVE, we show prompt to Activate & Move.
      // We STOP sending to end of global queue for A/B removals.
      
      if (!isQueueTeam && !team.hasActiveBench) {
          // PROMPT TO ACTIVATE BENCH
          setBenchConfirmState({ teamId, playerId });
      } else {
          // If bench active OR it's a queue team (where removal implies just deleting/moving out)
          // The updated rosterLogic will handle the "Move to Bench" part if active.
          props.onRemove(playerId);
      }
  }, [props.courtA, props.courtB, props.queue, props.onRemove]);

  const confirmBenchActivation = () => {
      if (benchConfirmState) {
          // First, activate the bench for the specific team
          props.toggleTeamBench(benchConfirmState.teamId);
          
          // Then, execute the move (rosterLogic will detect active bench and move there)
          // Small delay to ensure state update propagates
          setTimeout(() => {
              props.onRemove(benchConfirmState.playerId);
          }, 50);
          setBenchConfirmState(null);
      }
  };

  const getProfileStatus = (profileId: string): PlayerLocationStatus => {
      if (props.courtA.players.some(p => p.profileId === profileId)) return 'A';
      if (props.courtA.reserves?.some(p => p.profileId === profileId)) return 'A_Bench';
      if (props.courtB.players.some(p => p.profileId === profileId)) return 'B';
      if (props.courtB.reserves?.some(p => p.profileId === profileId)) return 'B_Bench';
      for (const t of props.queue) {
          if (t.players.some(p => p.profileId === profileId)) return 'Queue';
          if (t.reserves?.some(p => p.profileId === profileId)) return 'Queue_Bench';
      }
      return null;
  };

  const handleSaveProfileData = (name: string, number: string, avatar: string, skill: number) => {
      if (!editingTarget) return;

      if (editingTarget.type === 'player') {
          const player = playersById.get(editingTarget.id);
          if (player) {
              wrappedUpdateName(editingTarget.id, name);
              wrappedUpdateNumber(editingTarget.id, number);
              props.onUpdatePlayerSkill(editingTarget.id, skill);
              props.onSaveProfile(editingTarget.id, { name, number, avatar, skill });
          }
      } 
      else if (editingTarget.type === 'profile') {
          const profile = props.profiles.get(editingTarget.id);
          if (profile && props.upsertProfile) {
              props.upsertProfile(name, skill, profile.id, { number, avatar });
          }
      }

      setEditingTarget(null);
  };

  const getInitialModalData = () => {
      if (!editingTarget) return { name: '', number: '', skill: 3 };
      
      if (editingTarget.type === 'player') {
          const p = playersById.get(editingTarget.id);
          return { name: p?.name || '', number: p?.number || '', skill: p?.skillLevel || 3 };
      } else {
          const p = props.profiles.get(editingTarget.id);
          return { name: p?.name || '', number: p?.number || '', skill: p?.skillLevel || 3 };
      }
  };

  const getModalTitle = () => {
      if (!editingTarget) return "Create Profile";
      if (editingTarget.type === 'profile') return "Edit Profile";
      const p = playersById.get(editingTarget.id);
      return p?.profileId ? "Edit Profile" : "Create Profile";
  };

  // --- VALIDATION LOGIC ---
  const validateNumber = useCallback((number: string, teamId: string, currentPlayerId: string): boolean => {
      if (!number) return true; // Empty is valid
      const team = getTeamById(teamId);
      if (!team) return true;

      const allTeamPlayers = [...team.players, ...(team.reserves || [])];
      
      // Check if any *other* player has this number
      const conflict = allTeamPlayers.some(p => 
          p.id !== currentPlayerId && 
          p.number === number
      );

      return !conflict;
  }, [props.courtA, props.courtB, props.queue]);

  const TabButton = ({ id, label, icon: Icon }: any) => (
      <button 
        onClick={() => setActiveTab(id)} 
        className={`
            relative px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider flex items-center gap-2 transition-all flex-1 justify-center
            ${activeTab === id 
                ? 'bg-white dark:bg-white/10 text-indigo-600 dark:text-white shadow-sm ring-1 ring-black/5 dark:ring-white/10' 
                : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-black/5 dark:hover:bg-white/5'}
        `}
      >
          <Icon size={14} strokeWidth={2.5} />
          <span className="hidden sm:inline">{label}</span>
      </button>
  );

  const activePlayerForMenu = activePlayerMenu ? playersById.get(activePlayerMenu.playerId) : null;
  const activePlayerContainerId = activePlayerForMenu ? findContainer(activePlayerForMenu.id) : null;
  const isReservesForActivePlayer = activePlayerContainerId?.includes('_Reserves') ?? false;

  let menuTop = 0, menuLeft = 0;
  if (activePlayerMenu) {
      const rect = activePlayerMenu.rect;
      const menuHeight = 130; 
      const menuWidth = 220;
      const vw = window.innerWidth;
      const vh = window.innerHeight;

      if (rect.bottom + menuHeight > vh - 20) {
          menuTop = rect.bottom - menuHeight;
      } else {
          menuTop = rect.top;
      }
      
      menuLeft = rect.right - menuWidth;
      if (rect.right > vw - 10) {
          menuLeft = vw - menuWidth - 10;
      }
      if (menuLeft < 10) {
          menuLeft = 10;
      }
  }

  return (
    <Modal isOpen={props.isOpen} onClose={handleCloseAttempt} title="" maxWidth="max-w-[95vw] md:max-w-7xl" showCloseButton={false} backdropClassName="bg-black/40 dark:bg-black/70 backdrop-blur-md">
      
      {/* Toast Notification */}
      <VoiceToast 
          visible={toast.visible}
          type="info"
          mainText={toast.message}
          onClose={() => setToast({ ...toast, visible: false })}
          duration={2500}
      />

      <Modal 
          isOpen={!!benchConfirmState} 
          onClose={() => setBenchConfirmState(null)} 
          title="Activate Bench?" 
          maxWidth="max-w-sm"
          zIndex="z-[70]"
          backdropClassName="bg-black/50 dark:bg-black/80 backdrop-blur-sm"
      >
          <div className="flex flex-col items-center text-center space-y-4 animate-in fade-in zoom-in-95 duration-200">
              <div className="p-3 bg-emerald-500/10 rounded-full text-emerald-600 border border-emerald-500/20">
                  <Armchair size={32} />
              </div>
              <div>
                  <p className="text-slate-600 dark:text-slate-300 text-sm font-medium">The Reserve Bench is currently disabled.</p>
                  <p className="text-slate-500 dark:text-slate-400 text-xs mt-2">Do you want to <span className="font-bold text-emerald-600 dark:text-emerald-400">Activate the Bench</span> and move this player there?</p>
              </div>
              <div className="grid grid-cols-2 gap-3 w-full pt-2">
                  <Button variant="secondary" onClick={() => setBenchConfirmState(null)}>Cancel</Button>
                  <Button className="bg-emerald-600 hover:bg-emerald-500 text-white" onClick={confirmBenchActivation}>Activate & Move</Button>
              </div>
          </div>
      </Modal>

      {/* --- NEW MODAL FOR DROP CONFIRMATION --- */}
      <Modal 
          isOpen={!!dropConfirmState} 
          onClose={() => setDropConfirmState(null)} 
          title="Team Full" 
          maxWidth="max-w-sm"
          zIndex="z-[70]"
          backdropClassName="bg-black/50 dark:bg-black/80 backdrop-blur-sm"
      >
          <div className="flex flex-col items-center text-center space-y-4 animate-in fade-in zoom-in-95 duration-200">
              <div className="p-3 bg-amber-500/10 rounded-full text-amber-600 border border-amber-500/20">
                  <Users size={32} />
              </div>
              <div>
                  <p className="text-slate-600 dark:text-slate-300 text-sm font-medium">The main roster is full (6 players).</p>
                  <p className="text-slate-500 dark:text-slate-400 text-xs mt-2">Activate the <span className="font-bold text-emerald-600 dark:text-emerald-400">Reserve Bench</span> and add player there?</p>
              </div>
              <div className="grid grid-cols-2 gap-3 w-full pt-2">
                  <Button variant="secondary" onClick={() => setDropConfirmState(null)}>Cancel</Button>
                  <Button className="bg-emerald-600 hover:bg-emerald-500 text-white" onClick={confirmDropActivation}>Yes, Move to Bench</Button>
              </div>
          </div>
      </Modal>

      <Modal
          isOpen={showSyncConfirm}
          onClose={() => setShowSyncConfirm(false)}
          title="Update Profiles?"
          maxWidth="max-w-sm"
          zIndex="z-[70]"
      >
          <div className="flex flex-col items-center text-center space-y-4">
              <div className="p-3 bg-indigo-500/10 rounded-full text-indigo-500 border border-indigo-500/20"><Save size={32} /></div>
              <div>
                  <p className="text-slate-600 dark:text-slate-300 text-sm font-bold">You modified {pendingSyncs.length} players.</p>
                  <p className="text-slate-500 dark:text-slate-400 text-xs mt-1">Do you want to update their saved profiles with these changes?</p>
              </div>
              <div className="flex flex-col gap-2 w-full pt-2">
                  <Button className="bg-indigo-600 hover:bg-indigo-500 text-white w-full" onClick={confirmSync}>
                      Yes, Update Profiles
                  </Button>
                  <Button variant="ghost" onClick={discardSync} className="text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-white/5 w-full">
                      No, Keep Local Only
                  </Button>
              </div>
          </div>
      </Modal>

      {editingTarget && (
          <ProfileCreationModal 
              isOpen={!!editingTarget}
              onClose={() => setEditingTarget(null)}
              onSave={handleSaveProfileData}
              initialName={getInitialModalData().name}
              initialNumber={getInitialModalData().number}
              initialSkill={getInitialModalData().skill}
              title={getModalTitle()}
          />
      )}

      {activePlayerForMenu && createPortal(
            <div className="fixed z-[9999]" style={{ top: menuTop, left: menuLeft }}>
                <motion.div 
                    ref={playerMenuRef}
                    initial={{ opacity: 0, scale: 0.9, y: -8 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    transition={{ duration: 0.15, ease: "easeOut" }}
                    className="w-[220px] bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-black/10 dark:border-white/10 overflow-hidden flex flex-col gap-0.5 p-1"
                >
                    <button onClick={(e) => { 
                        e.stopPropagation();
                        if (isReservesForActivePlayer) {
                            const fromId = activePlayerContainerId!;
                            // Assuming Reserves ID is constructed as TEAMID_Reserves, removing suffix gets TEAMID
                            const toId = fromId.replace('_Reserves', '');
                            props.onMove(activePlayerForMenu!.id, fromId, toId);
                        } else {
                            // INTERCEPT REMOVAL TO CHECK FOR BENCH
                            // The handler wrapper already does this logic, so just call props.onRemove
                            handleKnockoutRequest(activePlayerContainerId || '', activePlayerForMenu!.id);
                        }
                        setActivePlayerMenu(null);
                    }} className="flex items-center gap-2 px-3 py-2 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 rounded-lg w-full text-left">
                        {isReservesForActivePlayer ? <ArrowUp size={14} /> : <LogOut size={14} />} 
                        {isReservesForActivePlayer ? "Return to Court" : "Send to Bench"}
                    </button>

                    <button onClick={(e) => { e.stopPropagation(); props.onToggleFixed(activePlayerForMenu.id); setActivePlayerMenu(null); }} className="flex items-center gap-2 px-3 py-2 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 rounded-lg w-full text-left">
                        {activePlayerForMenu.isFixed ? <Unlock size={14} className="text-amber-500" /> : <Pin size={14} />} 
                        {activePlayerForMenu.isFixed ? t('teamManager.unlockPlayer') : t('teamManager.lockPlayer')}
                    </button>
                    
                    {props.onDeletePlayer && (
                        <>
                            <div className="h-px bg-black/5 dark:bg-white/5 my-0.5 mx-2" />
                            <button onClick={(e) => { e.stopPropagation(); props.onDeletePlayer?.(activePlayerForMenu.id); setActivePlayerMenu(null); }} className="flex items-center gap-2 px-3 py-2 text-xs font-bold text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-lg w-full text-left">
                                <Trash2 size={14} /> Delete
                            </button>
                        </>
                    )}
                </motion.div>
            </div>,
            document.body
      )}

      <div className="sticky top-0 z-[80] -mx-6 -mt-6 mb-4 bg-slate-50/90 dark:bg-[#0f172a]/95 backdrop-blur-xl border-b border-black/5 dark:border-white/5 px-4 pt-4 pb-2 shadow-sm">
          
          <div className="flex items-center justify-between mb-4">
              <h2 className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] flex items-center gap-2">
                  <div className="w-1 h-3 bg-indigo-500 rounded-full" />
                  {t('teamManager.title')}
              </h2>
              <button 
                  onClick={handleCloseAttempt}
                  className="p-2 -mr-2 rounded-full hover:bg-black/5 dark:hover:bg-white/10 text-slate-400 hover:text-slate-800 dark:hover:text-white transition-colors"
              >
                  <X size={20} />
              </button>
          </div>

          <div className="flex flex-col gap-3">
              <div className="flex bg-slate-200/50 dark:bg-black/20 p-1 rounded-xl">
                  <TabButton id="roster" label={t('teamManager.tabs.roster')} icon={List} />
                  <TabButton id="profiles" label={t('teamManager.tabs.profiles')} icon={Users} />
                  <TabButton id="input" label={t('teamManager.tabs.batch')} icon={Upload} />
              </div>

              <AnimatePresence>
                  {activeTab === 'roster' && (
                      <motion.div 
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="flex items-center justify-between overflow-hidden"
                      >
                          <div className="flex items-center bg-white dark:bg-white/5 rounded-lg border border-black/5 dark:border-white/5 p-0.5">
                              <button 
                                  onClick={() => props.onSetRotationMode('standard')} 
                                  className={`px-3 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 transition-all ${props.rotationMode === 'standard' ? 'bg-indigo-50 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-300 shadow-sm' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'}`}
                                  title={t('teamManager.modes.standardTooltip')}
                              >
                                  <Layers size={12} /> Std
                              </button>
                              <div className="w-px h-4 bg-black/5 dark:bg-white/5 mx-0.5" />
                              <button 
                                  onClick={() => props.onSetRotationMode('balanced')} 
                                  className={`px-3 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 transition-all ${props.rotationMode === 'balanced' ? 'bg-emerald-50 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-300 shadow-sm' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'}`}
                                  title={t('teamManager.modes.balancedTooltip')}
                              >
                                  <Shuffle size={12} /> Bal
                              </button>
                          </div>

                          <div className="flex items-center gap-2">
                              <button 
                                  onClick={props.onBalanceTeams} 
                                  className={`
                                      flex items-center gap-2 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider text-white shadow-sm transition-transform active:scale-95
                                      ${props.rotationMode === 'balanced' ? 'bg-emerald-500 hover:bg-emerald-600' : 'bg-indigo-500 hover:bg-indigo-600'}
                                  `}
                              >
                                  {props.rotationMode === 'balanced' ? <Shuffle size={12} /> : <RefreshCw size={12} />}
                                  {props.rotationMode === 'balanced' ? 'Auto Balance' : 'Reset Order'}
                              </button>
                          </div>
                      </motion.div>
                  )}
              </AnimatePresence>
          </div>
      </div>

      {activeTab === 'input' && <BatchInputSection onGenerate={handleGenerate} />}

      {activeTab === 'profiles' && (
          <div className="pb-12 animate-in fade-in slide-in-from-bottom-2 pt-4">
               {props.profiles.size === 0 ? (
                   <div className="text-center py-20 text-slate-400 italic">{t('teamManager.emptyProfiles')}</div>
               ) : filteredProfiles.length === 0 ? (
                   <div className="text-center py-20 text-slate-400 italic flex flex-col items-center gap-2"><Search size={24} className="opacity-50" /><span>No profiles found matching "{searchTerm}"</span></div>
               ) : (
                   <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {filteredProfiles.map(profile => (
                           <ProfileCard 
                              key={profile.id}
                              profile={profile}
                              onDelete={() => props.deleteProfile && props.deleteProfile(profile.id)}
                              onAddToGame={(target) => props.onAddPlayer(profile.name, target, profile.number, profile.skillLevel)}
                              status={getProfileStatus(profile.id)}
                              onEdit={() => setEditingTarget({ type: 'profile', id: profile.id })}
                              placementOptions={placementOptions}
                           />
                      ))}
                   </div>
               )}
          </div>
      )}

      {activeTab === 'roster' && (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragOver={handleDragOver} onDragEnd={handleDragEnd}>
            <div onScroll={dispatchScrollEvent} className="h-full flex flex-col">
              <RosterBoard 
                  courtA={props.courtA} courtB={props.courtB} queue={props.queue}
                  wrappedUpdateSkill={wrappedUpdateSkill} wrappedAdd={wrappedAdd} handleKnockoutRequest={handleKnockoutRequest}
                  usedColors={usedColors} wrappedUpdateName={wrappedUpdateName} wrappedUpdateNumber={wrappedUpdateNumber} wrappedMove={wrappedMove}
                  playerStatsMap={playerStatsMap} setEditingTarget={setEditingTarget} handleTogglePlayerMenu={handleTogglePlayerMenu} activePlayerMenu={activePlayerMenu}
                  reorderQueue={props.reorderQueue} disbandTeam={props.disbandTeam} 
                  toggleTeamBench={props.toggleTeamBench} wrappedUpdateColor={wrappedUpdateColor} substitutePlayers={props.substitutePlayers} validateNumber={validateNumber}
                  {...props}
              />
            </div>
        </DndContext>
      )}

       <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-[70] transition-all duration-300 cubic-bezier(0.175, 0.885, 0.32, 1.275) ${undoVisible && props.canUndoRemove ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-4 scale-90 pointer-events-none'}`}>
         <div className="bg-slate-900/90 backdrop-blur-xl text-white px-6 py-3 rounded-full shadow-2xl border border-white/10 flex items-center gap-4">
            <span className="text-xs font-bold text-slate-300 tracking-wide">{t('teamManager.playerRemoved')}</span>
            <div className="h-4 w-px bg-white/20"></div>
            <button onClick={props.onUndoRemove} className="flex items-center gap-1.5 text-xs font-black text-indigo-400 hover:text-indigo-300 transition-colors uppercase tracking-wider"><Undo2 size={16} /> {t('teamManager.undo')}</button>
         </div>
       </div>
       
       {props.isOpen && createPortal(
            <DragOverlayFixed dropAnimation={{ duration: 150, easing: 'cubic-bezier(0.18, 0.67, 0.6, 1.22)' }}>
              {activePlayer ? (
                <div className="w-[300px]">
                    <PlayerCard player={activePlayer} locationId="" profiles={props.profiles} onUpdateName={() => {}} onUpdateNumber={()=>{}} onUpdateSkill={()=>{}} onSaveProfile={()=>{}} forceDragStyle={true} onToggleMenu={()=>{}} isMenuActive={false} validateNumber={() => true} />
                </div>
              ) : null}
            </DragOverlayFixed>,
            document.body
       )}
    </Modal>
  );
};
