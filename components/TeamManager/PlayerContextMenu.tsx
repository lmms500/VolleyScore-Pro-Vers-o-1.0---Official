
import React from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { Armchair, ArrowUp, Unlock, Lock, Trash2 } from 'lucide-react';
import { Player, Team } from '../../types';
import { PLAYER_LIMIT_ON_COURT } from '../../constants';

interface PlayerContextMenuProps {
    activePlayerMenu: { playerId: string; rect: DOMRect } | null;
    courtA: Team;
    courtB: Team;
    queue: Team[];
    onToggleFixed: (id: string) => void;
    onRemove: (id: string) => void;
    toggleTeamBench: (id: string) => void;
    onMove: (playerId: string, fromId: string, toId: string) => void;
    handleTogglePlayerMenu: (playerId: string, target: HTMLElement | null) => void;
    t: (key: string) => string;
    setActivateBenchConfirm: (data: { teamId: string; playerId: string; fromId: string }) => void;
}

export const PlayerContextMenu = ({ 
    activePlayerMenu, 
    courtA, courtB, queue, 
    onToggleFixed, onRemove, toggleTeamBench, 
    onMove, handleTogglePlayerMenu, t,
    setActivateBenchConfirm
}: PlayerContextMenuProps) => {
    
    if (!activePlayerMenu) return null;

    // Find the player's current context
    let targetPlayer: Player | undefined;
    let targetTeam: Team | undefined;
    let locationType: 'Main' | 'Reserves' | null = null;

    const findContext = (team: Team, teamType: string) => {
        if (team.players.some(p => p.id === activePlayerMenu.playerId)) {
            targetPlayer = team.players.find(p => p.id === activePlayerMenu.playerId);
            targetTeam = team;
            locationType = 'Main';
            return true;
        }
        if (team.reserves && team.reserves.some(p => p.id === activePlayerMenu.playerId)) {
            targetPlayer = team.reserves.find(p => p.id === activePlayerMenu.playerId);
            targetTeam = team;
            locationType = 'Reserves';
            return true;
        }
        return false;
    };

    if (!findContext(courtA, 'A')) {
        if (!findContext(courtB, 'B')) {
            queue.forEach((t: Team) => findContext(t, 'Queue'));
        }
    }

    if (!targetPlayer || !targetTeam) return null;

    // Calculate position
    const { top, left, height, width } = activePlayerMenu.rect;
    const isRightSide = left > window.innerWidth / 2;
    const isBottomHalf = top > window.innerHeight / 2;

    const style: React.CSSProperties = {
        position: 'fixed',
        zIndex: 9999, // Above everything
        top: isBottomHalf ? 'auto' : top + height + 8,
        bottom: isBottomHalf ? window.innerHeight - top + 8 : 'auto',
        left: isRightSide ? 'auto' : left,
        right: isRightSide ? window.innerWidth - (left + width) : 'auto',
    };

    const handleAction = (action: () => void) => {
        action();
        handleTogglePlayerMenu(activePlayerMenu.playerId, null); // Close menu
    };
    
    const handleMoveToBench = () => {
        if (!targetTeam) return;
        if (targetTeam.hasActiveBench) {
            onMove(targetPlayer!.id, targetTeam!.id, `${targetTeam!.id}_Reserves`);
        } else {
            setActivateBenchConfirm({ 
                teamId: targetTeam.id, 
                playerId: targetPlayer!.id, 
                fromId: targetTeam.id 
            });
        }
    };

    const isCourtFull = targetTeam.players.length >= PLAYER_LIMIT_ON_COURT;

    return createPortal(
        <motion.div 
            initial={{ opacity: 0, scale: 0.9, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 10 }}
            transition={{ type: "spring", stiffness: 400, damping: 25 }}
            style={style}
            className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-black/10 dark:border-white/10 p-1 min-w-[160px] flex flex-col gap-1 origin-top-left"
        >
            {/* Contextual Action: Move to Bench/Court */}
            {locationType === 'Main' && (
                <button 
                    onClick={() => handleAction(handleMoveToBench)}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-[10px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/10 transition-colors text-left"
                >
                    <Armchair size={14} className="text-indigo-500" />
                    {t('teamManager.menu.sendBench')}
                </button>
            )}
            {locationType === 'Reserves' && (
                <button 
                    onClick={() => handleAction(() => {
                        onMove(targetPlayer!.id, `${targetTeam!.id}_Reserves`, targetTeam!.id);
                    })}
                    disabled={isCourtFull}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-[10px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/10 transition-colors text-left disabled:opacity-40 disabled:cursor-not-allowed"
                >
                    <ArrowUp size={14} className="text-emerald-500" />
                    {t('teamManager.menu.returnCourt')}
                </button>
            )}

            <div className="h-px bg-black/5 dark:bg-white/5 my-0.5" />

            {/* Lock/Unlock */}
            <button 
                onClick={() => handleAction(() => onToggleFixed(targetPlayer!.id))}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-[10px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/10 transition-colors text-left"
            >
                {targetPlayer.isFixed ? <Unlock size={14} className="text-slate-400" /> : <Lock size={14} className="text-amber-500" />}
                {targetPlayer.isFixed ? t('teamManager.menu.unlock') : t('teamManager.menu.lock')}
            </button>

            <div className="h-px bg-black/5 dark:bg-white/5 my-0.5" />

            {/* Delete */}
            <button 
                onClick={() => handleAction(() => onRemove(targetPlayer!.id))}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-[10px] font-bold uppercase tracking-wider text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-colors text-left"
            >
                <Trash2 size={14} />
                {t('teamManager.menu.delete')}
            </button>
        </motion.div>,
        document.body
    );
};
