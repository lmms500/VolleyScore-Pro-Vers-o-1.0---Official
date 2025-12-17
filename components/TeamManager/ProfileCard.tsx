
import React, { memo, useRef, useState, useEffect } from 'react';
import { MoreVertical, User, Edit2, Plus, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from '../../contexts/LanguageContext';
import { PlayerProfile, TeamColor } from '../../types';

interface ProfileCardProps {
    profile: PlayerProfile;
    onDelete: () => void;
    onAddToGame: (targetId: string, profile: PlayerProfile) => void;
    status: string | null;
    onEdit: () => void;
    placementOptions: { label: string; targetId: string; type: 'main' | 'bench' | 'queue'; teamColor?: string }[];
    onView: () => void;
    teamColor?: TeamColor;
    onShowToast: (msg: string, type: 'success' | 'info' | 'error', subText?: string, icon?: any, onUndo?: () => void) => void;
}

export const ProfileCard = memo(({ profile, onDelete, onAddToGame, status, onEdit, placementOptions, onView, teamColor, onShowToast }: ProfileCardProps) => {
    const { t } = useTranslation();
    const [showMenu, setShowMenu] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => { 
        const handleClickOutside = (event: MouseEvent) => { 
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) { 
                setShowMenu(false); 
            } 
        }; 
        if (showMenu) document.addEventListener('mousedown', handleClickOutside); 
        return () => document.removeEventListener('mousedown', handleClickOutside); 
    }, [showMenu]);

    const statusLabel = status ? (status.includes('Queue') ? t('teamManager.queue') : (status.includes('A') ? t('teamManager.location.courtA') : t('teamManager.location.courtB'))) : null;
    const statusColor = status ? (status.includes('A') ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300' : (status.includes('B') ? 'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300' : 'bg-slate-100 text-slate-600')) : '';

    return (
        <div className={`relative flex flex-col p-3 rounded-2xl border transition-all ${status ? 'bg-slate-50 dark:bg-white/5 border-slate-200 dark:border-white/5 opacity-70' : 'bg-white dark:bg-white/10 border-black/5 dark:border-white/10 shadow-sm hover:shadow-md hover:border-indigo-500/30'}`}>
            <div className="flex items-center gap-3">
                <div className="relative">
                    <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-white/10 flex items-center justify-center text-lg shadow-inner border border-black/5 dark:border-white/5">
                        {profile.avatar || '👤'}
                    </div>
                    {status && (<div className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-500 rounded-full border-2 border-white dark:border-slate-800" />)}
                </div>
                <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                        <span className="text-sm font-bold text-slate-800 dark:text-white truncate">{profile.name}</span>
                        {profile.number && <span className="text-[10px] font-black bg-slate-100 dark:bg-white/10 px-1.5 py-0.5 rounded text-slate-500 dark:text-slate-400">{profile.number}</span>}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] font-medium text-slate-400">Lvl {profile.skillLevel}</span>
                        {status && <span className={`text-[9px] font-bold uppercase px-1.5 rounded ${statusColor}`}>{statusLabel}</span>}
                    </div>
                </div>
                <div className="relative" ref={menuRef}>
                    <button onClick={() => setShowMenu(!showMenu)} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-white/10 text-slate-400 hover:text-slate-600 transition-colors">
                        <MoreVertical size={16} />
                    </button>
                    <AnimatePresence>
                        {showMenu && (
                            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="absolute right-0 top-full mt-1 z-50 min-w-[160px] bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-black/5 dark:border-white/10 overflow-hidden p-1">
                                <button onClick={() => { onView(); setShowMenu(false); }} className="w-full text-left px-3 py-2 text-[10px] font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5 rounded-lg flex items-center gap-2">
                                    <User size={14} /> {t('common.view')}
                                </button>
                                <button onClick={() => { onEdit(); setShowMenu(false); }} className="w-full text-left px-3 py-2 text-[10px] font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5 rounded-lg flex items-center gap-2">
                                    <Edit2 size={14} /> {t('common.edit')}
                                </button>
                                {!status && placementOptions.length > 0 && (
                                    <>
                                        <div className="h-px bg-slate-100 dark:bg-white/5 my-1" />
                                        {placementOptions.map((opt, idx) => (
                                            <button key={idx} onClick={() => { onAddToGame(opt.targetId, profile); setShowMenu(false); }} className="w-full text-left px-3 py-2 text-[10px] font-bold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 rounded-lg flex items-center gap-2">
                                                <Plus size={14} /> {opt.label}
                                            </button>
                                        ))}
                                    </>
                                )}
                                <div className="h-px bg-slate-100 dark:bg-white/5 my-1" />
                                <button onClick={() => { onDelete(); setShowMenu(false); }} className="w-full text-left px-3 py-2 text-[10px] font-bold text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-lg flex items-center gap-2">
                                    <Trash2 size={14} /> {t('common.delete')}
                                </button>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </div>
        </div>
    );
});
