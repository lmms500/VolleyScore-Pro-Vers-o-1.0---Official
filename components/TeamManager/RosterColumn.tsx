
import React, { useState, useMemo, useCallback, memo, useEffect } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, Activity, ChevronsUp, ChevronUp, ChevronDown, Armchair, ListFilter, Trash2, ArrowDownAZ, ArrowDown01, ArrowUpWideNarrow, RefreshCcw, ArrowRightLeft, ChevronRight, UserPlus, ListOrdered, ArrowUpCircle } from 'lucide-react';
import { Team, Player, PlayerProfile, TeamColor } from '../../types';
import { calculateTeamStrength } from '../../utils/balanceUtils';
import { resolveTheme } from '../../utils/colors';
import { useTranslation } from '../../contexts/LanguageContext';
import { staggerContainer } from '../../utils/animations';
import { ColorPicker, EditableTitle, TeamLogoUploader } from './TeamManagerUI';
import { AddPlayerForm } from './AddPlayerForm';
import { BenchArea } from './BenchArea';
import { PlayerListItem } from './PlayerListItem';
import { SubstitutionModal } from '../modals/SubstitutionModal';

const SCROLL_EVENT = 'team-manager-scroll';
const dispatchScrollEvent = () => { if (typeof window !== 'undefined') window.dispatchEvent(new Event(SCROLL_EVENT)); };

interface RosterColumnProps {
    id: string;
    team: Team;
    profiles: Map<string, PlayerProfile>;
    
    // Actions
    onUpdateTeamName: (teamId: string, name: string) => void;
    onUpdateTeamColor: (teamId: string, color: TeamColor) => void;
    onUpdateTeamLogo: (teamId: string, logo: string) => void;
    onUpdatePlayer: (playerId: string, updates: Partial<Player>) => void | { success: boolean, error?: string };
    onSaveProfile: (playerId: string, overrides: any) => void;
    onAddPlayer: (name: string, target: string, number?: string, skill?: number, profileId?: string) => void;
    onMove: (playerId: string, fromId: string, toId: string, newIndex?: number) => void;
    
    // Bench / Subs
    toggleTeamBench: (teamId: string) => void;
    substitutePlayers: (teamId: string, pIn: string, pOut: string) => void;
    
    // UI State
    usedColors: Set<string>;
    isQueue?: boolean;
    activePlayerMenuId: string | null;
    activeNumberId: string | null;
    isDragOver: boolean;
    highlighted?: boolean;
    
    // Callbacks
    onRequestProfileEdit: (id: string) => void;
    onViewProfile: (id: string) => void;
    onTogglePlayerMenu: (id: string, target: HTMLElement) => void;
    onRequestEditNumber: (id: string) => void;
    onShowToast: (msg: string, type: 'success' | 'info' | 'error', subText?: string) => void;
    
    // Queue Specific
    isNext?: boolean;
    queueIndex?: number;
    queueSize?: number;
    onDisband?: (id: string) => void;
    onReorder?: (from: number, to: number) => void;

    // Config Limits
    maxPlayers?: number;
    maxBench?: number;
}

export const RosterColumn = memo(({ 
    id, team, profiles, 
    onUpdateTeamName, onUpdateTeamColor, onUpdateTeamLogo, onUpdatePlayer, onSaveProfile, onAddPlayer, 
    toggleTeamBench, substitutePlayers, 
    usedColors, isQueue = false, 
    activePlayerMenuId, activeNumberId, onRequestEditNumber, onRequestProfileEdit, onViewProfile, onTogglePlayerMenu, onShowToast,
    isDragOver, highlighted,
    queueIndex, queueSize, onDisband, onReorder,
    maxPlayers = 6, // Default to standard indoor
    maxBench = 6 // Default to standard indoor
}: RosterColumnProps) => {
  const { t } = useTranslation();
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [viewMode, setViewMode] = useState<'main' | 'reserves'>('main'); 
  const [isSubModalOpen, setIsSubModalOpen] = useState(false);
  const [sortConfig, setSortConfig] = useState<{ criteria: 'name' | 'number' | 'skill' | 'original', direction: 'asc' | 'desc' }>({ criteria: 'original', direction: 'asc' });
  
  const colorConfig = resolveTheme(team.color);
  
  // Container Refs
  const { setNodeRef: droppableRef } = useDroppable({ id: id, data: { type: 'container', containerId: id } });
  
  // Auto-switch back to main if bench deactivated
  useEffect(() => { if (!team.hasActiveBench && viewMode === 'reserves') setViewMode('main'); }, [team.hasActiveBench]);
  
  const rawPlayers = team.players;
  
  // Sorting Logic
  const displayedPlayers = useMemo(() => { 
      let sorted = [...rawPlayers]; 
      
      if (sortConfig.criteria === 'original') { 
          return sorted.sort((a, b) => {
              const orderA = a.displayOrder ?? a.originalIndex ?? 0;
              const orderB = b.displayOrder ?? b.originalIndex ?? 0;
              return orderA - orderB;
          }); 
      } 
      
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

  // Use dynamic maxPlayers for main roster check
  const mainRosterFull = team.players.length >= maxPlayers;
  // Use dynamic maxBench for reserve check
  const reservesFull = (team.reserves || []).length >= maxBench;
  
  const handleUpdateName = useCallback((n: string) => onUpdateTeamName(id, n), [onUpdateTeamName, id]);
  const handleUpdateColor = useCallback((c: TeamColor) => onUpdateTeamColor(id, c), [onUpdateTeamColor, id]);
  const handleUpdateLogo = useCallback((l: string) => onUpdateTeamLogo(id, l), [onUpdateTeamLogo, id]);
  
  const toggleView = () => setViewMode(prev => prev === 'main' ? 'reserves' : 'main');
  
  const handleAdd = useCallback((n: string, num?: string, s?: number) => { 
      const targetId = viewMode === 'main' ? id : `${id}_Reserves`;
      onAddPlayer(n, targetId, num, s);
  }, [onAddPlayer, id, viewMode]);
  
  const applySort = (criteria: any) => { 
      setSortConfig(prev => ({ criteria, direction: prev.criteria === criteria && prev.direction === 'asc' ? 'desc' : 'asc' })); 
      setShowSortMenu(false); 
  };
  
  const teamStrength = calculateTeamStrength(team.players);
  
  // Visual Styles
  const bgClass = viewMode === 'reserves' ? 'bg-slate-100/80 dark:bg-white/[0.02] border-dashed border-slate-300 dark:border-white/10' : `bg-white/95 dark:bg-[#0f172a]/90 bg-gradient-to-b ${colorConfig.gradient} ${isQueue ? '' : 'border-slate-200 dark:border-white/5'} shadow-xl shadow-black/5 dark:shadow-black/20`;
  const containerBorder = isQueue ? 'border-transparent' : 'border';
  
  let ringColor = "", dropBg = "";
  if (isDragOver) { 
      if (!isQueue) { 
          const currentCount = rawPlayers.length; 
          // Check limit based on current view mode
          const limit = viewMode === 'main' ? maxPlayers : maxBench;
          
          if (currentCount >= limit) { 
              if (viewMode === 'main' && team.hasActiveBench && (team.reserves || []).length < maxBench) { 
                  ringColor = "ring-amber-400"; dropBg = "bg-amber-400/10"; 
              } else { 
                  ringColor = "ring-rose-500"; dropBg = "bg-rose-500/10"; 
              } 
          } else { 
              ringColor = "ring-emerald-400"; dropBg = "bg-emerald-400/10"; 
          } 
      } else { 
          ringColor = "ring-indigo-400"; dropBg = "bg-indigo-400/10"; 
      } 
  }
  const finalRing = ringColor || colorConfig.ring;

  const containerClass = `flex flex-col w-full h-auto min-h-[300px] rounded-2xl ${containerBorder} relative transition-transform transition-colors duration-300 p-4 sm:p-6 landscape:p-2 ${bgClass} ${isDragOver ? `ring-4 ${finalRing} ring-opacity-50 scale-[1.01] ${dropBg} z-20` : (isQueue ? '' : 'hover:border-slate-300 dark:hover:border-white/20')} ${(isQueue && queueIndex === 0) ? 'ring-2 ring-amber-500/50 dark:ring-amber-500/40 shadow-2xl shadow-amber-500/10' : ''} ${highlighted ? 'ring-4 ring-indigo-500/50 scale-[1.02] shadow-2xl z-30' : ''}`;

  return (
    <div ref={droppableRef} className={containerClass}>
      <SubstitutionModal isOpen={isSubModalOpen} onClose={() => setIsSubModalOpen(false)} team={team} onConfirm={(pIn, pOut) => substitutePlayers(id, pIn, pOut)} />
      
      {/* QUEUE BADGE */}
      {isQueue && queueIndex !== undefined && (
          <div className={`absolute -top-4 right-6 px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest z-10 flex items-center gap-1.5 shadow-md border border-white/50 dark:border-white/20 ${queueIndex === 0 ? 'bg-amber-500 text-amber-950' : 'bg-slate-200 text-slate-600 dark:bg-white/10 dark:text-slate-300'}`}>
              {queueIndex === 0 ? <ArrowUpCircle size={14} strokeWidth={3} /> : <ListOrdered size={12} strokeWidth={3} />}
              {queueIndex === 0 ? "NEXT UP" : `${queueIndex + 1}º`}
          </div>
      )}

      {/* HEADER SECTION */}
      <div className="flex flex-col mb-2 w-full">
          <div className="flex items-center gap-3 mb-2 w-full">
              <TeamLogoUploader currentLogo={team.logo} onUpdate={handleUpdateLogo} teamName={team.name} />
              <div className="flex-1 min-w-0"><EditableTitle name={team.name} onSave={handleUpdateName} className={`text-lg landscape:text-base font-black uppercase tracking-tight ${colorConfig.text} ${colorConfig.textDark} drop-shadow-sm w-full`} /></div>
              <div className="flex gap-1.5 flex-wrap"><div className={`px-2 py-0.5 rounded-md text-[9px] font-bold border flex items-center gap-1 shadow-sm text-white ${colorConfig.bg} ${colorConfig.border}`}><Users size={10} strokeWidth={2.5} /> {displayedPlayers.length} / {maxPlayers}</div><div className={`px-2 py-0.5 rounded-md text-[9px] font-bold border flex items-center gap-1 shadow-sm ${colorConfig.bg.replace('/20', '/40')} ${colorConfig.border} dark:text-white dark:border-white/20 text-slate-700`} title="Avg Team Skill"><Activity size={10} strokeWidth={2.5} /> {teamStrength}</div></div>
          </div>
          
          {/* CONTROLS ROW */}
          <div className="flex items-center justify-between border-t border-slate-200 dark:border-white/5 pt-2 mt-1 mb-2 w-full">
                {isQueue ? (
                    <div className="flex items-center gap-1">
                        {onReorder && queueIndex !== undefined && queueSize !== undefined && (
                            <>
                                {queueIndex > 0 && <button onClick={(e) => { e.stopPropagation(); onReorder(queueIndex, 0); }} className="p-1.5 rounded-lg bg-amber-500/10 text-amber-600 hover:bg-amber-500/20 active:scale-95"><ChevronsUp size={14} strokeWidth={2.5} /></button>}
                                {queueIndex > 1 && <button onClick={(e) => { e.stopPropagation(); onReorder(queueIndex, queueIndex - 1); }} className="p-1.5 rounded-lg bg-slate-100 dark:bg-white/10 text-slate-600 hover:bg-slate-200 active:scale-95"><ChevronUp size={14} /></button>}
                                {queueIndex < queueSize - 1 && <button onClick={(e) => { e.stopPropagation(); onReorder(queueIndex, queueIndex + 1); }} className="p-1.5 rounded-lg bg-slate-100 dark:bg-white/10 text-slate-600 hover:bg-slate-200 active:scale-95"><ChevronDown size={14} /></button>}
                            </>
                        )}
                    </div>
                ) : <div />} {/* Spacer */}

                <div className="flex items-center gap-1">
                    <button onClick={(e) => { e.stopPropagation(); toggleTeamBench(id); }} onPointerDown={(e) => e.stopPropagation()} className={`p-1.5 rounded-lg border border-transparent transition-all active:scale-95 ${team.hasActiveBench ? 'bg-emerald-500 text-white shadow-sm shadow-emerald-500/20' : 'bg-slate-100 dark:bg-white/10 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'}`} title={team.hasActiveBench ? t('teamManager.benchLabel') : t('teamManager.activateBenchTitle')}><Armchair size={14} fill={team.hasActiveBench ? 'currentColor' : 'none'} /></button>
                    
                    <div className="relative">
                        <button onClick={() => setShowSortMenu(!showSortMenu)} className={`p-1.5 rounded-lg border border-transparent hover:bg-slate-100 dark:hover:bg-white/10 transition-colors active:scale-95 ${showSortMenu ? 'bg-slate-100 dark:bg-white/10' : ''}`}><ListFilter size={14} /></button>
                        <AnimatePresence>
                            {showSortMenu && (
                                <motion.div initial={{ opacity: 0, y: 8, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 8, scale: 0.95 }} className="absolute right-0 top-full mt-2 z-50 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl rounded-xl shadow-2xl border border-black/5 dark:border-white/10 p-1 flex flex-col min-w-[140px]">
                                    <button onClick={() => applySort('name')} className="flex items-center gap-2 px-2 py-2 text-[10px] font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/10 rounded-lg text-left w-full"><ArrowDownAZ size={12} /> {t('teamManager.sort.name')}</button>
                                    <button onClick={() => applySort('number')} className="flex items-center gap-2 px-2 py-2 text-[10px] font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/10 rounded-lg text-left w-full"><ArrowDown01 size={12} /> {t('teamManager.sort.number')}</button>
                                    <button onClick={() => applySort('skill')} className="flex items-center gap-2 px-2 py-2 text-[10px] font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/10 rounded-lg text-left w-full"><ArrowUpWideNarrow size={12} /> {t('teamManager.sort.skill')}</button>
                                    <div className="h-px bg-black/5 dark:bg-white/5 my-1" />
                                    <button onClick={() => applySort('original')} className="flex items-center gap-2 px-2 py-2 text-[10px] font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-white/5 rounded-lg text-left w-full"><RefreshCcw size={12} /> {t('teamManager.sort.reset')}</button>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                    {isQueue && onDisband && <button onClick={() => onDisband(id)} className="p-1.5 rounded-lg bg-rose-50 dark:bg-rose-500/10 text-rose-500 hover:bg-rose-100 transition-colors ml-1 active:scale-95"><Trash2 size={14} /></button>}
                </div>
          </div>
          
          {viewMode === 'main' && <ColorPicker selected={team.color || 'slate'} onChange={handleUpdateColor} usedColors={usedColors} />}
      </div>

      {/* BENCH TOGGLE & SUBSTITUTION BAR */}
      {team.hasActiveBench && (
          <div className="flex justify-end mb-2 gap-2 px-1">
              <button onClick={() => setIsSubModalOpen(true)} className={`flex items-center justify-center p-2 rounded-xl text-[9px] font-bold uppercase tracking-wider transition-all bg-white/50 dark:bg-white/5 border border-slate-200 dark:border-white/5 text-slate-500 hover:text-indigo-500 shadow-sm active:scale-95`} title="Substitute Player"><ArrowRightLeft size={16} /></button>
              <button onClick={toggleView} className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-[9px] font-bold uppercase tracking-wider transition-all active:scale-95 ${viewMode === 'reserves' ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/20' : 'bg-slate-100 dark:bg-white/5 text-slate-500 hover:bg-slate-200 dark:hover:bg-white/10'}`}>
                  {viewMode === 'reserves' ? t('common.back') : t('teamManager.benchLabel')}
                  {viewMode === 'main' && <ChevronRight size={14} />}
              </button>
          </div>
      )}

      {/* CONTENT AREA */}
      {viewMode === 'reserves' ? (
          <BenchArea 
              teamId={id} 
              reserves={team.reserves || []} 
              profiles={profiles}
              onClose={() => setViewMode('main')}
              // Props drill
              onUpdatePlayer={onUpdatePlayer}
              onSaveProfile={onSaveProfile}
              onRequestProfileEdit={onRequestProfileEdit}
              onViewProfile={onViewProfile}
              onToggleMenu={onTogglePlayerMenu}
              activePlayerMenuId={activePlayerMenuId}
              onShowToast={onShowToast}
              activeNumberId={activeNumberId}
              onRequestEditNumber={onRequestEditNumber}
              onAddPlayer={handleAdd}
              isFull={reservesFull}
          />
      ) : (
          <>
              <motion.div variants={staggerContainer} initial="hidden" animate="visible" className={`space-y-2 mt-1 px-0`} onScroll={dispatchScrollEvent}>
                {displayedPlayers.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-8 opacity-60 border border-dashed border-slate-200 dark:border-white/5 rounded-xl bg-slate-50/50 dark:bg-white/[0.01]"><div className="p-2 bg-slate-100 dark:bg-white/5 rounded-full mb-2"><UserPlus size={20} className="text-slate-400" /></div><span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{t('teamManager.dragPlayersHere')}</span></div>
                ) : (
                    <SortableContext items={displayedPlayers.map(p => p.id)} strategy={verticalListSortingStrategy}>
                        <AnimatePresence initial={false}>
                            {displayedPlayers.map(p => (
                                <PlayerListItem 
                                    key={p.id}
                                    player={p}
                                    locationId={id}
                                    profile={p.profileId ? profiles.get(p.profileId) : undefined}
                                    onUpdatePlayer={onUpdatePlayer}
                                    onSaveProfile={onSaveProfile}
                                    onRequestProfileEdit={onRequestProfileEdit}
                                    onViewProfile={onViewProfile}
                                    onToggleMenu={onTogglePlayerMenu}
                                    isMenuActive={activePlayerMenuId === p.id}
                                    onShowToast={onShowToast}
                                    isCompact={window.innerWidth < 640 && !isQueue}
                                    activeNumberId={activeNumberId}
                                    onRequestEditNumber={onRequestEditNumber}
                                />
                            ))}
                        </AnimatePresence>
                    </SortableContext>
                )}
              </motion.div>
              <AddPlayerForm onAdd={handleAdd} disabled={mainRosterFull} />
          </>
      )}
    </div>
  );
});
