
import React, { memo, useMemo, useCallback } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Player, PlayerProfile, PlayerRole } from '../types';
import { Pin, Save, Check, MoreVertical, Hash, Edit2, RefreshCw, Shield, Hand, Zap, Target, Swords, Trophy } from 'lucide-react';
import { SkillSlider } from './ui/SkillSlider';
import { useHaptics } from '../hooks/useHaptics';

interface PlayerCardProps {
    player: Player;
    locationId: string;
    profile?: PlayerProfile;
    
    // Legacy props replaced by onUpdatePlayer
    onUpdateName?: (id: string, name: string) => void;
    onUpdateNumber?: (id: string, number: string) => void;
    onUpdateSkill?: (id: string, skill: number) => void;
    
    // New Unified Handler
    onUpdatePlayer: (id: string, updates: Partial<Player>) => void;

    onSaveProfile: (id: string, overrides: { name: string, number?: string, avatar?: string, skill: number, role?: PlayerRole }) => void;
    onRequestProfileEdit: (id: string) => void;
    onViewProfile: (id: string) => void; // New Prop for Read-Only View
    onToggleMenu: (playerId: string, targetElement: HTMLElement) => void;
    isMenuActive: boolean;
    validateNumber?: (n: string) => boolean;
    onShowToast?: (msg: string, type: 'success' | 'info' | 'error') => void;
    isCompact?: boolean;
    forceDragStyle?: boolean;
}

const EditableTitle = memo(({ name, onSave, className }: { name: string; onSave: (val: string) => void; className?: string }) => {
    const [isEditing, setIsEditing] = React.useState(false);
    const [val, setVal] = React.useState(name);
    const inputRef = React.useRef<HTMLInputElement>(null);
  
    React.useEffect(() => { setVal(name); }, [name]);
    React.useEffect(() => { if(isEditing) inputRef.current?.focus(); }, [isEditing]);
  
    const save = () => {
      setIsEditing(false);
      if(val.trim() && val !== name) onSave(val.trim());
      else setVal(name);
    };
  
    if(isEditing) {
      return (
          <input 
              ref={inputRef} type="text"
              className={`bg-transparent text-slate-900 dark:text-white border-b border-indigo-500 outline-none w-full min-w-0 px-0 py-0 font-bold text-sm`}
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

const EditableNumber = memo(({ number, onSave, validator }: { number?: string; onSave: (val: string) => void; validator?: (n: string) => boolean }) => {
    const [isEditing, setIsEditing] = React.useState(false);
    const [val, setVal] = React.useState(number || '');
    const [error, setError] = React.useState(false);
    const inputRef = React.useRef<HTMLInputElement>(null);

    React.useEffect(() => { setVal(number || ''); setError(false); }, [number]);
    React.useEffect(() => { if(isEditing) inputRef.current?.focus(); }, [isEditing]);

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
                ref={inputRef} type="tel" maxLength={3}
                className={`w-7 h-7 bg-white dark:bg-black/50 text-center rounded-md border outline-none text-xs font-bold text-slate-800 dark:text-white shadow-sm ${error ? 'border-red-500 bg-red-50' : 'border-indigo-500'}`}
                value={val} onChange={e => { setVal(e.target.value); setError(false); }}
                onBlur={save} onKeyDown={e => { if(e.key === 'Enter') save(); if(e.key === 'Escape') setIsEditing(false); }}
                onPointerDown={e => e.stopPropagation()} 
            />
        );
    }

    return (
        <button 
            onClick={() => setIsEditing(true)} onPointerDown={e => e.stopPropagation()}
            className={`w-7 h-7 rounded-lg flex items-center justify-center text-[11px] font-black border transition-all flex-shrink-0 ${number ? 'bg-white/80 dark:bg-white/5 text-slate-800 dark:text-white border-transparent shadow-sm' : 'bg-transparent text-slate-300 dark:text-slate-600 border-transparent hover:border-slate-300 hover:text-slate-400'}`}
        >
            {number || <Hash size={12} />}
        </button>
    );
});

export const PlayerCard = memo(({ 
    player, locationId, profile, 
    onUpdatePlayer, onSaveProfile, onRequestProfileEdit, onViewProfile,
    onToggleMenu, isMenuActive, validateNumber, onShowToast, forceDragStyle = false 
}: PlayerCardProps) => {
  const haptics = useHaptics();

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: player.id,
    data: { fromId: locationId, player },
    disabled: player.isFixed || isMenuActive,
  });

  const style = { 
      transform: CSS.Transform.toString(transform), 
      transition, 
      opacity: isDragging ? 0.9 : 1, 
      zIndex: isDragging ? 50 : (isMenuActive ? 40 : 'auto'),
      scale: isDragging ? 1.05 : 1, 
      boxShadow: isDragging ? '0 10px 30px -10px rgba(0,0,0,0.3)' : 'none',
  };
  
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
      // Button always opens EDIT mode
      onRequestProfileEdit(player.id); 
  }, [player.id, onRequestProfileEdit]);

  const handleViewRequest = useCallback((e: React.MouseEvent) => {
      if (isLinked) {
          e.stopPropagation();
          // Body click opens VIEW mode (if linked)
          onViewProfile(profile!.id);
      }
  }, [isLinked, profile, onViewProfile]);

  const handleMenu = (e: React.MouseEvent<HTMLButtonElement>) => {
      e.stopPropagation();
      e.preventDefault();
      onToggleMenu(player.id, e.currentTarget);
  };

  const activeRole = profile?.role || player.role || 'none';
  let RoleIcon = null;
  let roleColor = "";
  if (activeRole === 'setter') { RoleIcon = Hand; roleColor = "text-amber-500"; }
  else if (activeRole === 'hitter') { RoleIcon = Zap; roleColor = "text-rose-500"; }
  else if (activeRole === 'middle') { RoleIcon = Target; roleColor = "text-indigo-500"; }
  else if (activeRole === 'libero') { RoleIcon = Shield; roleColor = "text-emerald-500"; }

  const containerClass = forceDragStyle
    ? `bg-white dark:bg-slate-800 border-2 border-indigo-500 shadow-2xl z-50 ring-4 ring-indigo-500/20`
    : `bg-white/60 dark:bg-white/[0.04] hover:bg-white/80 dark:hover:bg-white/[0.08] border-transparent hover:border-black/5 dark:hover:border-white/10 transition-all duration-200`;

  const specialClass = activeRole === 'libero' && !forceDragStyle ? 'bg-emerald-500/5 dark:bg-emerald-500/5 border-emerald-500/10' : '';
  const fixedClass = player.isFixed ? 'bg-amber-500/5 border-amber-500/20 shadow-sm shadow-amber-500/5' : '';
  const reserveClass = locationId.includes('_Reserves') ? 'border-dashed border-slate-300 dark:border-white/10 bg-slate-50/50 dark:bg-black/20' : '';

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
        className={`group relative flex items-center justify-between rounded-2xl border touch-manipulation py-1.5 px-2.5 min-h-[54px] ${forceDragStyle ? containerClass : (locationId.includes('_Reserves') ? reserveClass : (player.isFixed ? fixedClass : (specialClass || containerClass)))} ${!player.isFixed && !isMenuActive ? 'cursor-grab active:cursor-grabbing' : ''}`}
    >
        <div className="flex items-center gap-2 flex-shrink-0 self-center">
            <EditableNumber number={player.number} onSave={(v) => onUpdatePlayer(player.id, { number: v })} validator={validateNumber} />
        </div>
        
        {/* Main Body - View Trigger */}
        <div className="flex flex-1 items-center gap-2 min-w-0 px-2" onClick={handleViewRequest}>
            {profile?.avatar && (
                <span className="text-sm grayscale opacity-80 group-hover:grayscale-0 group-hover:opacity-100 transition-all flex-shrink-0">{profile.avatar}</span>
            )}
            
            <div className="flex flex-col min-w-0 flex-1">
                <EditableTitle 
                    name={player.name} 
                    onSave={(v) => onUpdatePlayer(player.id, { name: v })} 
                    className={`text-sm font-bold tracking-tight text-slate-800 dark:text-slate-100 leading-tight`} 
                />
                
                {/* CAREER STATS PREVIEW */}
                {profile?.stats && profile.stats.matchesPlayed > 0 && (
                    <div className="flex items-center gap-2 mt-0.5 opacity-60 group-hover:opacity-100 transition-opacity">
                        {profile.stats.totalPoints > 0 && (
                            <div className="flex items-center gap-0.5 text-[8px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-1 rounded">
                                <Trophy size={8} /> {profile.stats.totalPoints}
                            </div>
                        )}
                        {profile.stats.attacks > 0 && (
                            <div className="flex items-center gap-0.5 text-[8px] font-bold text-rose-500 bg-rose-500/10 px-1 rounded">
                                <Swords size={8} /> {profile.stats.attacks}
                            </div>
                        )}
                    </div>
                )}
            </div>
            
            {RoleIcon && (
                <RoleIcon size={12} className={`${roleColor} flex-shrink-0`} strokeWidth={2.5} />
            )}
            
            {player.isFixed && <Pin size={12} className="text-amber-500 flex-shrink-0" fill="currentColor" />}
        </div>
        
        <div className="flex items-center gap-1 flex-shrink-0 relative z-30 self-center">
            <div className="flex items-center scale-100 origin-right mr-1">
                <SkillSlider level={player.skillLevel} onChange={(v) => onUpdatePlayer(player.id, { skillLevel: v })} />
            </div>

            {/* Sync/Edit Button - Explicitly stops propagation to allow isolated click */}
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
    if (prev.locationId !== next.locationId || prev.isCompact !== next.isCompact || prev.forceDragStyle !== next.forceDragStyle || prev.isMenuActive !== next.isMenuActive) return false;
    
    // Check Player changes
    const playerEq = prev.player.id === next.player.id && prev.player.name === next.player.name && prev.player.number === next.player.number && prev.player.skillLevel === next.player.skillLevel && prev.player.isFixed === next.player.isFixed && prev.player.profileId === next.player.profileId;
    if (!playerEq) return false;

    // Check Profile changes (Stats might update)
    if (prev.profile !== next.profile) {
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
