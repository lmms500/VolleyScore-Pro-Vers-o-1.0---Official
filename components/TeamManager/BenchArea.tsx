
import React, { memo } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, UserPlus } from 'lucide-react';
import { Player, PlayerProfile } from '../../types';
import { useTranslation } from '../../contexts/LanguageContext';
import { PlayerListItem } from './PlayerListItem';
import { AddPlayerForm } from './AddPlayerForm';
import { staggerContainer } from '../../utils/animations';

interface BenchAreaProps {
    teamId: string;
    reserves: Player[];
    profiles: Map<string, PlayerProfile>;
    onClose: () => void;
    // Pass-through props for PlayerListItem
    onUpdatePlayer: (id: string, updates: Partial<Player>) => void;
    onSaveProfile: (id: string, overrides: any) => void;
    onRequestProfileEdit: (id: string) => void;
    onViewProfile: (id: string) => void;
    onToggleMenu: (id: string, target: HTMLElement) => void;
    activePlayerMenuId: string | null;
    onShowToast: (msg: string, type: 'success' | 'info' | 'error') => void;
    activeNumberId: string | null;
    onRequestEditNumber: (id: string) => void;
    onAddPlayer: (name: string, number?: string, skill?: number) => void;
    isFull: boolean;
}

export const BenchArea = memo((props: BenchAreaProps) => {
    const { t } = useTranslation();
    const benchId = `${props.teamId}_Reserves`;
    
    const { setNodeRef } = useDroppable({ 
        id: benchId, 
        data: { type: 'container', containerId: benchId } 
    });

    return (
        <div ref={setNodeRef} className="flex flex-col h-full w-full">
            {/* Bench Header */}
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-white/5 pb-2 mb-2">
                <h4 className="text-xs font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">
                    {t('teamManager.benchLabel')}
                </h4>
                <button 
                    onClick={props.onClose} 
                    className="flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-100 dark:bg-white/10 text-[9px] font-bold uppercase hover:bg-slate-200 transition-colors"
                >
                    <ChevronLeft size={12} /> {t('common.back')}
                </button>
            </div>

            {/* Bench List */}
            <motion.div 
                variants={staggerContainer} 
                initial="hidden" 
                animate="visible" 
                className="space-y-2 min-h-[100px]"
            >
                {props.reserves.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-8 opacity-60 border border-dashed border-slate-200 dark:border-white/5 rounded-xl bg-slate-50/50 dark:bg-white/[0.01]">
                        <UserPlus size={20} className="text-slate-400 mb-2" />
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                            {t('common.empty')}
                        </span>
                    </div>
                ) : (
                    <SortableContext items={props.reserves.map(p => p.id)} strategy={verticalListSortingStrategy}>
                        <AnimatePresence initial={false}>
                            {props.reserves.map(p => (
                                <PlayerListItem 
                                    key={p.id}
                                    player={p}
                                    locationId={benchId}
                                    profile={p.profileId ? props.profiles.get(p.profileId) : undefined}
                                    onUpdatePlayer={props.onUpdatePlayer}
                                    onSaveProfile={props.onSaveProfile}
                                    onRequestProfileEdit={props.onRequestProfileEdit}
                                    onViewProfile={props.onViewProfile}
                                    onToggleMenu={props.onToggleMenu}
                                    isMenuActive={props.activePlayerMenuId === p.id}
                                    onShowToast={props.onShowToast}
                                    isCompact={true}
                                    activeNumberId={props.activeNumberId}
                                    onRequestEditNumber={props.onRequestEditNumber}
                                />
                            ))}
                        </AnimatePresence>
                    </SortableContext>
                )}
            </motion.div>

            <AddPlayerForm 
                onAdd={props.onAddPlayer} 
                disabled={props.isFull} 
                customLabel={t('teamManager.benchLabel')} 
            />
        </div>
    );
});
