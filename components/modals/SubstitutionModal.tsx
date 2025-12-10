
import React, { useState, useEffect, memo } from 'react';
import { createPortal } from 'react-dom';
import { Modal } from '../ui/Modal';
import { Team, Player, TeamColor } from '../../types';
import { Button } from '../ui/Button';
import { RefreshCw, User, Hash, ArrowRight, ArrowLeft } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useHaptics } from '../../hooks/useHaptics';
import { resolveTheme } from '../../utils/colors';

interface SubstitutionModalProps {
  isOpen: boolean;
  onClose: () => void;
  team: Team;
  onConfirm: (playerInId: string, playerOutId: string) => void;
}

type SubPair = { outId: string; inId: string };

// --- SUB-COMPONENT: COMPACT BLOCK PLAYER CARD ---
const PlayerCardBlock = memo(({ 
    player, 
    isSelected, 
    isPending,
    pairIndex,
    type, 
    onSelect,
    teamColor 
}: { 
    player: Player, 
    isSelected: boolean, 
    isPending: boolean,
    pairIndex: number | null,
    type: 'in' | 'out', 
    onSelect: (id: string, type: 'in' | 'out') => void,
    teamColor: TeamColor
}) => {
    const isOut = type === 'out'; 
    const theme = resolveTheme(teamColor);
    
    let activeBorder = '';
    let activeBg = '';
    let activeRing = '';
    
    if (isSelected || isPending) {
        if (isOut) {
            // Leaving: Red/Rose accents
            activeBorder = 'border-rose-500 dark:border-rose-400';
            activeBg = 'bg-rose-500/20 dark:bg-rose-500/30';
            activeRing = 'ring-1 ring-rose-500';
        } else {
            // Entering: Emerald/Green accents
            activeBorder = 'border-emerald-500 dark:border-emerald-400';
            activeBg = 'bg-emerald-500/20 dark:bg-emerald-500/30';
            activeRing = 'ring-1 ring-emerald-500';
        }
    }

    // Passive State
    const passiveClass = `
        bg-white/50 dark:bg-white/[0.03] 
        border-slate-200 dark:border-white/10 
        hover:border-slate-300 dark:hover:border-white/20
    `;
    
    // Team Color Background Tint (Very Subtle)
    const teamTint = theme.bg.replace('/20', '/5'); 

    return (
        <motion.button
            whileTap={{ scale: 0.98 }}
            onClick={() => onSelect(player.id, type)}
            className={`
                relative flex items-center justify-between p-2 rounded-xl border transition-all duration-300 
                w-full h-12 overflow-hidden group isolate
                ${isSelected || isPending
                    ? `${activeBg} ${activeBorder} ${activeRing} z-10` 
                    : `${passiveClass} hover:bg-white/80 dark:hover:bg-white/10`
                }
                ${isPending ? 'animate-pulse' : ''}
            `}
        >
            {/* Subtle Team Color Shine Background */}
            {!isSelected && !isPending && (
                <div className={`absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 ${teamTint}`} />
            )}

            <div className="flex items-center gap-2 min-w-0">
                {/* Number Badge */}
                <div className={`
                    w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-black
                    ${isSelected 
                        ? (isOut ? 'bg-rose-500 text-white' : 'bg-emerald-500 text-white') 
                        : 'bg-slate-200 dark:bg-white/10 text-slate-500 dark:text-slate-400'}
                `}>
                    {player.number || <Hash size={10} />}
                </div>

                {/* Name */}
                <span className={`text-xs font-bold uppercase tracking-tight truncate max-w-[90px] ${isSelected ? 'text-slate-900 dark:text-white' : 'text-slate-600 dark:text-slate-400'}`}>
                    {player.name}
                </span>
            </div>

            <div className="flex items-center gap-1.5">
                {player.isFixed && (
                    <div className="text-amber-500 opacity-60">
                        <User size={10} fill="currentColor" />
                    </div>
                )}

                {/* Pair Indicator Badge */}
                {pairIndex !== null && (
                    <motion.div 
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className={`
                            w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white shadow-sm
                            ${isOut ? 'bg-rose-600' : 'bg-emerald-600'}
                        `}
                    >
                        {pairIndex + 1}
                    </motion.div>
                )}

                {isPending && (
                    <div className="w-5 h-5 rounded-full border-2 border-rose-500 border-t-transparent animate-spin" />
                )}
            </div>
        </motion.button>
    );
});

export const SubstitutionModal: React.FC<SubstitutionModalProps> = ({ 
  isOpen, onClose, team, onConfirm 
}) => {
  // Pairs: List of { outId, inId }
  const [pairs, setPairs] = useState<SubPair[]>([]);
  // Pending Out: A player selected from court, waiting for a bench player
  const [pendingOutId, setPendingOutId] = useState<string | null>(null);
  
  const haptics = useHaptics();

  useEffect(() => {
    if (isOpen) {
        setPairs([]);
        setPendingOutId(null);
    }
  }, [isOpen]);

  const handleConfirm = () => {
      if (pairs.length > 0) {
          haptics.notification('success');
          // Execute all pairs
          pairs.forEach(pair => {
              onConfirm(pair.inId, pair.outId);
          });
          onClose(); 
      }
  };

  const handleSelect = (id: string, type: 'in' | 'out') => {
      haptics.impact('light');

      // Check if already in a pair
      const existingPairIndex = pairs.findIndex(p => p.outId === id || p.inId === id);
      
      if (existingPairIndex !== -1) {
          // If clicking an existing pair member, remove that pair
          const newPairs = [...pairs];
          newPairs.splice(existingPairIndex, 1);
          setPairs(newPairs);
          // If we removed a pair, we don't start a new selection immediately to avoid confusion
          return;
      }

      if (type === 'out') {
          // Selecting Court Player
          if (pendingOutId === id) {
              setPendingOutId(null); // Deselect if clicking same pending
          } else {
              setPendingOutId(id); // Set as pending
          }
      } else {
          // Selecting Bench Player
          if (pendingOutId) {
              // Match made!
              const newPair = { outId: pendingOutId, inId: id };
              setPairs([...pairs, newPair]);
              setPendingOutId(null);
              haptics.notification('success');
          } else {
              // Shake or visual cue: must select OUT first? 
              // Or maybe we allow selecting IN first? 
              // For simplicity, let's enforce: Click Out -> Click In.
              // If user clicks IN without OUT, we do nothing or maybe shake?
              // Alternatively, we could support reverse selection, but let's keep it simple.
          }
      }
  };

  const courtPlayers = team.players || [];
  const benchPlayers = team.reserves || [];
  const theme = resolveTheme(team.color || 'slate');

  const getPairIndex = (id: string) => {
      const idx = pairs.findIndex(p => p.outId === id || p.inId === id);
      return idx === -1 ? null : idx;
  };

  if (!isOpen) return null;

  return createPortal(
    <Modal 
        isOpen={isOpen} 
        onClose={onClose} 
        title="Tactical Changes" 
        maxWidth="max-w-md"
        backdropClassName="bg-black/30 dark:bg-black/60 backdrop-blur-sm"
    >
        <div className="flex flex-col pb-safe-bottom h-full max-h-[80vh]">
            
            {/* --- TEAM HEADER --- */}
            <div className="flex flex-col items-center justify-center pt-2 pb-4 border-b border-dashed border-slate-200 dark:border-white/10 mb-2">
                <h2 className={`text-xl font-black uppercase tracking-tight leading-none ${theme.text} ${theme.textDark} drop-shadow-sm`}>
                    {team.name}
                </h2>
                <div className={`h-1 w-12 rounded-full mt-2 ${theme.halo} opacity-80`} />
                <p className="text-[10px] text-slate-400 mt-2 font-medium">
                    Tap <span className="text-rose-500 font-bold">Court Player</span> then <span className="text-emerald-500 font-bold">Bench Player</span> to link.
                </p>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar px-1 py-2 grid grid-cols-2 gap-4">
                
                {/* COLUMN 1: ON COURT (LEAVING) */}
                <div className="space-y-2">
                    <div className="flex items-center gap-2 px-1 mb-1">
                        <div className="p-1 rounded bg-rose-500/10 text-rose-500"><ArrowRight size={12} strokeWidth={3} /></div>
                        <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-500">Out (Court)</h3>
                    </div>

                    <div className="flex flex-col gap-2">
                        {courtPlayers.map(p => (
                            <PlayerCardBlock 
                                key={p.id} 
                                player={p} 
                                isSelected={getPairIndex(p.id) !== null}
                                isPending={pendingOutId === p.id}
                                pairIndex={getPairIndex(p.id)}
                                type="out"
                                onSelect={handleSelect}
                                teamColor={team.color || 'slate'}
                            />
                        ))}
                        {courtPlayers.length === 0 && (
                            <div className="py-6 text-center text-[10px] text-slate-400 italic bg-slate-50 dark:bg-white/5 rounded-xl border border-dashed border-slate-200 dark:border-white/10">Empty Court</div>
                        )}
                    </div>
                </div>

                {/* COLUMN 2: BENCH (ENTERING) */}
                <div className="space-y-2">
                    <div className="flex items-center gap-2 px-1 mb-1">
                        <div className="p-1 rounded bg-emerald-500/10 text-emerald-500"><ArrowLeft size={12} strokeWidth={3} /></div>
                        <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-500">In (Bench)</h3>
                    </div>

                    <div className="flex flex-col gap-2">
                        {benchPlayers.map(p => (
                            <PlayerCardBlock 
                                key={p.id} 
                                player={p} 
                                isSelected={getPairIndex(p.id) !== null} 
                                isPending={false}
                                pairIndex={getPairIndex(p.id)}
                                type="in"
                                onSelect={handleSelect}
                                teamColor={team.color || 'slate'}
                            />
                        ))}
                        {benchPlayers.length === 0 && (
                            <div className="py-6 flex flex-col items-center justify-center text-slate-400/60 gap-1 border-2 border-dashed border-slate-200 dark:border-white/5 rounded-xl bg-slate-50/50 dark:bg-white/[0.01]">
                                <User size={16} />
                                <span className="text-[10px] font-bold uppercase tracking-wider">Empty</span>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* FOOTER ACTION */}
            <div className="pt-4 mt-2 border-t border-black/5 dark:border-white/5">
                <Button 
                    onClick={handleConfirm} 
                    disabled={pairs.length === 0}
                    className={`
                        w-full py-4 text-xs font-black tracking-[0.2em] uppercase rounded-2xl shadow-xl transition-all duration-300
                        ${pairs.length > 0 
                            ? `${theme.halo.replace('bg-', 'bg-')} text-white shadow-lg scale-[1.02] hover:scale-[1.03]` 
                            : 'bg-slate-100 dark:bg-white/5 text-slate-400 dark:text-slate-600 border border-slate-200 dark:border-white/5 cursor-not-allowed'}
                    `}
                    size="md"
                >
                    <div className="flex items-center justify-center gap-3">
                        <RefreshCw size={16} /> 
                        <span>
                            {pairs.length > 0 ? `Confirm ${pairs.length} Subs` : 'Select Players'}
                        </span>
                    </div>
                </Button>
            </div>
        </div>
    </Modal>,
    document.body
  );
};
