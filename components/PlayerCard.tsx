
import React, { memo, useMemo, useCallback, useRef, useState, useEffect } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Player, PlayerProfile, PlayerRole } from '../types';
import { Pin, Save, Check, MoreVertical, Hash, Edit2, RefreshCw, Shield, Hand, Zap, Target, Swords, Trophy } from 'lucide-react';
import { SkillSlider } from './ui/SkillSlider';
import { useHaptics } from '../hooks/useHaptics';
import { motion } from 'framer-motion';

interface PlayerCardProps {
    player: Player;
    locationId: string;
    profile?: PlayerProfile;
    
    // Legacy props replaced by onUpdatePlayer
    onUpdateName?: (id: string, name: string) => void;
    onUpdateNumber?: (id: string, number: string) => void;
    onUpdateSkill?: (id: string, skill: number) => void;
    
    // New Unified Handler - Expects optional result return
    onUpdatePlayer: (id: string, updates: Partial<Player>) => void | { success: boolean; error?: string };

    onSaveProfile: (id: string, overrides: { name: string, number?: string, avatar?: string, skill: number, role?: PlayerRole }) => void;
    onRequestProfileEdit: (id: string) => void;
    onViewProfile: (id: string) => void; // New Prop for Read-Only View
    onToggleMenu: (playerId: string, targetElement: HTMLElement) => void;
    isMenuActive: boolean;
    // validateNumber is removed as validation is now handled atomically in the store
    onShowToast?: (msg: string, type: 'success' | 'info' | 'error') => void;
    isCompact?: boolean;
    forceDragStyle?: boolean;
    
    // Controlled Editing Props
    activeNumberId?: string | null;
    onRequestEditNumber?: (id: string) => void;
}

// Map roles to specific color styles (Neo-Glass Tint)
const ROLE_STYLES: Record<string, string> = {
    setter: 'bg-amber-500/10 dark:bg-amber-500/10 border-amber-500/30 hover:bg-amber-500/20 dark:hover:bg-amber-500/20',
    hitter: 'bg-rose-500/10 dark:bg-rose-500/10 border-rose-500/30 hover:bg-rose-500/20 dark:hover:bg-rose-500/20',
    middle: 'bg-indigo-500/10 dark:bg-indigo-500/10 border-indigo-500/30 hover:bg-indigo-500/20 dark:hover:bg-indigo-500/20',
    libero: 'bg-emerald-500/10 dark:bg-emerald-500/10 border-emerald-500/30 hover:bg-emerald-500/20 dark:hover:bg-emerald-500/20',
    none: ''
};

const EditableTitle = memo(({ name, onSave, className }: { name: string; onSave: (val: string) => void; className?: string }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [val, setVal] = useState(name);
    const inputRef = useRef<HTMLInputElement>(null);
  
    useEffect(() => { setVal(name); }, [name]);
    useEffect(() => { if(isEditing) inputRef.current?.focus(); }, [isEditing]);
  
    const save = () => {
      setIsEditing(false);
      if(val.trim() && val !== name) onSave(val.trim());
      else setVal(name);
    };
  
    if(isEditing) {
      return (
          <input 
              ref={inputRef} type="text"
              className={`bg-transparent text-slate-900 dark:text-white border-b-2 border-indigo-500 outline-none w-full min-w-0 px-0 py-0 font-bold text-sm`}
              value={val} onChange={e => setVal(e.target.value)} onBlur={save}
              onKeyDown={e => { if(e.key === 'Enter') save(); if(e.key === 'Escape') setIsEditing(false); }}
              onPointerDown={e => e.stopPropagation()} 
          />
      );
    }
    return (
        <div className={`flex items-center gap-2 group cursor-pointer min-w-0 flex-1 ${className}`} onClick={() => setIsEditing(true)} onPointerDown={e => e.stopPropagation()}>
            <span className="truncate flex-1 min-w-0 block">{name}</span>
            <Edit2 size={10} className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-400 flex-shrink-0" />
        </div>
    );
});

/**
 * EditableNumber v2: Error Focus Trap Edition
 * Implements strict blocking logic for invalid inputs with a visual overlay trap.
 */
const EditableNumber = memo(({ 
    number, 
    onSave, 
    isOpen, 
    onRequestOpen, 
    onRequestClose 
}: { 
    number?: string; 
    onSave: (val: string) => void | { success: boolean; error?: string };
    isOpen?: boolean;
    onRequestOpen?: () => void;
    onRequestClose?: () => void;
}) => {
    // Internal state mainly for the value while typing.
    const [val, setVal] = useState(number || '');
    const [isError, setIsError] = useState(false);
    
    // Legacy local state fallback if props not provided
    const [localIsEditing, setLocalIsEditing] = useState(false);
    
    const isEditing = isOpen !== undefined ? isOpen : localIsEditing;
    const inputRef = useRef<HTMLInputElement>(null);

    // Reset internal state when prop changes (external update).
    useEffect(() => { 
        setVal(number || ''); 
        if (!isOpen) setIsError(false);
    }, [number, isOpen]);

    useEffect(() => { 
        if(isEditing) {
            // Slight delay to ensure layout is ready
            requestAnimationFrame(() => inputRef.current?.focus());
        }
    }, [isEditing]);

    // CORE TRAP LOGIC
    const attemptSaveAndClose = (source?: 'blur' | 'enter' | 'clickOutside') => {
        const trimmed = val.trim();
        
        // 1. If unchanged or cleared, allow exit immediately (Empty is valid)
        if (trimmed === (number || '') || trimmed === '') {
            setVal(trimmed); // Normalize empty string
            setIsError(false);
            if(onRequestClose) onRequestClose();
            else setLocalIsEditing(false);
            return;
        }

        // 2. Attempt Save (Calls parent validation)
        const result = onSave(trimmed);
        
        // 3. Check for Failure
        if (result && result.success === false) {
            // FAILURE: Activate Trap
            setIsError(true);
            
            // Re-Focus Forcefully (keep keyboard up on mobile)
            // Critical for trap: If blur happened, bring focus back.
            requestAnimationFrame(() => {
                inputRef.current?.focus();
            });
            
            // DO NOT CLOSE. State remains 'isEditing'.
        } else {
            // SUCCESS: Close
            setIsError(false);
            if(onRequestClose) onRequestClose();
            else setLocalIsEditing(false);
        }
    };

    const handleStart = (e: React.MouseEvent | React.TouchEvent) => {
        e.stopPropagation();
        if(onRequestOpen) onRequestOpen();
        else setLocalIsEditing(true);
    };

    // This handles the "Trap" - if user clicks the overlay, we try to save/close.
    const handleOverlayClick = (e: React.MouseEvent | React.TouchEvent) => {
        e.preventDefault(); 
        e.stopPropagation();
        attemptSaveAndClose('clickOutside');
    };

    if(isEditing) {
        return (
            <>
                {/* TRAP OVERLAY: Blocks clicks outside when editing to prevent navigation */}
                <div 
                    className="fixed inset-0 z-40 bg-transparent cursor-default"
                    onMouseDown={handleOverlayClick}
                    onTouchStart={handleOverlayClick}
                />
                
                <motion.input 
                    ref={inputRef} 
                    type="tel" 
                    maxLength={3}
                    autoFocus
                    animate={isError ? { 
                        x: [0, -4, 4, -4, 4, 0], 
                        borderColor: '#e11d48', // rose-600
                        color: '#e11d48', 
                        backgroundColor: 'rgba(255, 228, 230, 0.9)', // rose-100 high opacity
                        scale: [1, 1.1, 1],
                    } : { 
                        x: 0, 
                        borderColor: '#6366f1',
                        color: 'inherit',
                        backgroundColor: 'rgba(255, 255, 255, 1)' 
                    }}
                    transition={{ duration: 0.3 }}
                    className={`
                        relative z-50 w-8 h-8 text-center rounded-lg border-2 outline-none text-xs font-black shadow-lg transition-all
                        ${isError ? 'border-rose-600 text-rose-600 shadow-rose-500/30' : 'bg-white dark:bg-black/80 text-slate-900 dark:text-white border-indigo-500'}
                    `}
                    value={val} 
                    onChange={e => { 
                        setVal(e.target.value); 
                        if (isError) setIsError(false); // Clear error visual while typing
                    }}
                    onBlur={(e) => {
                        // Only trigger save on blur if NOT already handled by overlay/enter
                        // But since we have the overlay, blur usually means clicking browser chrome or tabbing.
                        // We still attempt save.
                        attemptSaveAndClose('blur');
                    }}
                    onKeyDown={e => { 
                        if(e.key === 'Enter') {
                            e.preventDefault(); // Stop form submit
                            attemptSaveAndClose('enter');
                        }
                        if(e.key === 'Escape') { 
                            // Escape implies "Cancel/Revert" -> Always allow exit
                            setVal(number || ''); 
                            setIsError(false);
                            if(onRequestClose) onRequestClose(); 
                            else setLocalIsEditing(false); 
                        } 
                    }}
                    onClick={e => e.stopPropagation()}
                    onPointerDown={e => e.stopPropagation()} 
                />
            </>
        );
    }

    return (
        <button 
            onClick={handleStart} onPointerDown={e => e.stopPropagation()}
            className={`w-7 h-7 rounded-lg flex items-center justify-center text-[11px] font-black border transition-all flex-shrink-0 ${number ? 'bg-slate-200 dark:bg-white/5 text-slate-800 dark:text-white border-transparent shadow-sm' : 'bg-transparent text-slate-300 dark:text-slate-600 border-transparent hover:border-slate-300 hover:text-slate-400'}`}
        >
            {number || <Hash size={12} />}
        </button>
    );
});

export const PlayerCard = memo(({ 
    player, locationId, profile, 
    onUpdatePlayer, onSaveProfile, onRequestProfileEdit, onViewProfile,
    onToggleMenu, isMenuActive, onShowToast, forceDragStyle = false,
    activeNumberId, onRequestEditNumber
}: PlayerCardProps) => {
  const haptics = useHaptics();

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: player.id,
    data: { fromId: locationId, player },
    disabled: player.isFixed || isMenuActive || (activeNumberId === player.id), // Disable drag if editing number
  });

  const style = { 
      transform: CSS.Transform.toString(transform), 
      transition, 
      opacity: isDragging ? 0.9 : 1, 
      zIndex: isDragging ? 50 : (isMenuActive || activeNumberId === player.id ? 40 : 'auto'),
      scale: isDragging ? 1.05 : 1, 
      boxShadow: isDragging ? '0 10px 30px -10px rgba(0,0,0,0.3)' : 'none',
  };
  
  // Logic: Only linked if BOTH Player has a profileId AND that profile actually exists
  const isLinked = !!player.profileId && !!profile;
  
  const isDirty = useMemo(() => {
    if (!isLinked || !profile) return false;
    return (
        profile.name !== player.name || 
        profile.skillLevel !== player.skillLevel || 
        (profile.number || '') !== (player.number || '') ||
        (profile.role || 'none') !== (player.role || 'none')
    );
  }, [player, profile, isLinked]);

  const handleEditRequest = useCallback((e: React.MouseEvent) => {
      e.stopPropagation();
      onRequestProfileEdit(player.id); 
  }, [player.id, onRequestProfileEdit]);

  const handleMenu = (e: React.MouseEvent<HTMLButtonElement>) => {
      e.stopPropagation();
      e.preventDefault();
      onToggleMenu(player.id, e.currentTarget);
  };

  const activeRole = profile?.role || player.role || 'none';
  
  // Base style for dragged items
  const dragClass = `bg-white dark:bg-slate-800 border-2 border-indigo-500 shadow-2xl z-50 ring-4 ring-indigo-500/20`;
  
  // Base style for normal items (Glass effect)
  const baseClass = `bg-white/60 dark:bg-white/[0.04] hover:bg-white/80 dark:hover:bg-white/[0.08] border-transparent hover:border-slate-300 dark:hover:border-white/10 transition-all duration-200`;

  // Role Tint: If a role is active, use the role-specific style instead of baseClass
  const roleStyleClass = ROLE_STYLES[activeRole];
  
  // Logic for final container class
  let containerClass = baseClass;
  
  if (forceDragStyle) {
      containerClass = dragClass;
  } else if (locationId.includes('_Reserves')) {
      containerClass = 'border-dashed border-slate-300 dark:border-white/10 bg-slate-50/50 dark:bg-black/20';
  } else if (player.isFixed) {
      containerClass = 'bg-amber-500/5 border-amber-500/20 shadow-sm shadow-amber-500/5';
  } else if (roleStyleClass) {
      // Apply the role tint logic requested by user
      containerClass = roleStyleClass;
  }

  let SyncIcon = Save;
  let syncColor = 'text-slate-300 hover:text-indigo-500 hover:bg-indigo-500/10';
  let syncTitle = "Save Profile";

  if (isLinked) {
      if (isDirty) {
          SyncIcon = RefreshCw; 
          syncColor = 'text-amber-500 hover:bg-amber-500/10 animate-pulse';
          syncTitle = "Unsaved Changes - Edit to Sync";
      } else {
          SyncIcon = Edit2;
          syncColor = 'text-slate-400 hover:text-indigo-500 hover:bg-indigo-500/10';
          syncTitle = "Edit Profile";
      }
  }

  return (
    <div 
        ref={setNodeRef} style={style} {...attributes} {...listeners} data-player-card="true" 
        className={`group relative flex items-center justify-between rounded-2xl border touch-manipulation py-1.5 px-2.5 min-h-[50px] ${containerClass} ${!player.isFixed && !isMenuActive && activeNumberId !== player.id ? 'cursor-grab active:cursor-grabbing' : ''}`}
    >
        <div className="flex items-center gap-2 flex-shrink-0 self-center">
            <EditableNumber 
                number={player.number} 
                onSave={(v) => onUpdatePlayer(player.id, { number: v })} 
                isOpen={activeNumberId === player.id}
                onRequestOpen={() => onRequestEditNumber && onRequestEditNumber(player.id)}
                onRequestClose={() => onRequestEditNumber && onRequestEditNumber('')}
            />
        </div>
        
        {/* NAME ZONE: Maximize Width */}
        <div className="flex flex-1 items-center gap-2 min-w-0 px-2 h-full">
            <div className="flex flex-col min-w-0 flex-1">
                <EditableTitle 
                    name={player.name} 
                    onSave={(v) => onUpdatePlayer(player.id, { name: v })} 
                    className={`text-sm font-bold tracking-tight text-slate-900 dark:text-slate-100 leading-tight`} 
                />
            </div>
            {player.isFixed && <Pin size={12} className="text-amber-500 flex-shrink-0" fill="currentColor" />}
        </div>
        
        <div className="flex items-center gap-1 flex-shrink-0 relative z-30 self-center">
            <div className="flex items-center scale-100 origin-right mr-1">
                <SkillSlider level={player.skillLevel} onChange={(v) => onUpdatePlayer(player.id, { skillLevel: v })} />
            </div>

            {/* Sync/Edit Button */}
            <button 
                onClick={handleEditRequest} onPointerDown={e => e.stopPropagation()} 
                className={`p-1.5 rounded-lg transition-colors ${syncColor}`} title={syncTitle}
            >
                <SyncIcon size={14} strokeWidth={isLinked && !isDirty ? 2 : 2} />
            </button>

            <button 
                onClick={handleMenu} onPointerDown={e => e.stopPropagation()}
                className={`p-1.5 rounded-lg transition-colors ${isMenuActive ? 'bg-slate-200 dark:bg-white/10 text-indigo-500' : 'text-slate-300 hover:text-slate-600 dark:hover:text-slate-300'}`}
            >
                <MoreVertical size={14} />
            </button>
        </div>
    </div>
  );
}, (prev, next) => {
    if (prev.locationId !== next.locationId || prev.isCompact !== next.isCompact || prev.forceDragStyle !== next.forceDragStyle || prev.isMenuActive !== next.isMenuActive || prev.activeNumberId !== next.activeNumberId) return false;
    
    // Check Player changes
    const playerEq = prev.player.id === next.player.id && prev.player.name === next.player.name && prev.player.number === next.player.number && prev.player.skillLevel === next.player.skillLevel && prev.player.isFixed === next.player.isFixed && prev.player.profileId === next.player.profileId && prev.player.role === next.player.role;
    if (!playerEq) return false;

    // Check Profile changes (Stats might update, or Profile might be deleted -> undefined)
    if (prev.profile !== next.profile) {
        // One is undefined and the other is defined -> changed
        if (!prev.profile || !next.profile) return false;
        
        if (
            prev.profile.name !== next.profile.name || 
            prev.profile.skillLevel !== next.profile.skillLevel || 
            prev.profile.number !== next.profile.number || 
            prev.profile.avatar !== next.profile.avatar || 
            prev.profile.role !== next.profile.role ||
            // Important: Check stats for update trigger
            prev.profile.stats?.totalPoints !== next.profile.stats?.totalPoints
        ) return false;
    }
    return true;
});
