
import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Team, SkillType, TeamColor } from '../../types';
import { Swords, Shield, Target, AlertTriangle, X, User, ChevronLeft } from 'lucide-react';
import { motion, AnimatePresence, PanInfo, useDragControls, Transition } from 'framer-motion';
import { resolveTheme } from '../../utils/colors';

interface ScoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  team: Team;
  onConfirm: (playerId: string, skill: SkillType) => void;
  colorTheme: TeamColor;
}

// Snappy Sheet
const sheetTransition: Transition = {
    type: "spring",
    damping: 25,
    stiffness: 350,
    mass: 0.8
};

const contentTransition: Transition = {
    type: "spring",
    damping: 30,
    stiffness: 500,
    mass: 1
};

export const ScoutModal: React.FC<ScoutModalProps> = ({ 
    isOpen, 
    onClose, 
    team, 
    onConfirm,
    colorTheme 
}) => {
    const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
    const [isReadyToClose, setIsReadyToClose] = useState(false);
    
    const containerRef = useRef<HTMLDivElement>(null);
    const dragControls = useDragControls();

    useEffect(() => {
        if (isOpen) {
            setSelectedPlayerId(null);
            const timer = setTimeout(() => setIsReadyToClose(true), 300);
            return () => {
                clearTimeout(timer);
                setIsReadyToClose(false);
            };
        }
    }, [isOpen]);

    const handleBackdropClick = () => {
        if (isReadyToClose) onClose();
    };

    const handlePlayerSelect = (pid: string) => setSelectedPlayerId(pid);

    const handleSkillSelect = (skill: SkillType) => {
        if (selectedPlayerId) {
            onConfirm(selectedPlayerId, skill);
            onClose();
        }
    };

    const handleDragEnd = (_: any, info: PanInfo) => {
        if (info.offset.y > 100 || info.velocity.y > 300) onClose();
    };

    const skills: { id: SkillType, label: string, icon: any }[] = [
        { id: 'attack', label: 'Attack', icon: Swords },
        { id: 'block', label: 'Block', icon: Shield },
        { id: 'ace', label: 'Ace', icon: Target },
        { id: 'opponent_error', label: 'Opp. Error', icon: AlertTriangle },
    ];

    const theme = resolveTheme(colorTheme);

    const sortedPlayers = [...team.players].sort((a, b) => {
        if (a.isFixed === b.isFixed) return a.name.localeCompare(b.name);
        return a.isFixed ? -1 : 1;
    });

    return createPortal(
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[9999] flex flex-col justify-end sm:justify-center items-center isolate">
                    <motion.div 
                        className="absolute inset-0 bg-black/40 dark:bg-black/70 backdrop-blur-sm z-0"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        onClick={handleBackdropClick}
                    />
                    
                    <motion.div 
                        ref={containerRef}
                        className="
                            relative z-10 w-full max-w-md 
                            bg-slate-50 dark:bg-[#0f172a]
                            border-t border-white/20 dark:border-white/10
                            rounded-t-[2.5rem] sm:rounded-[2.5rem] 
                            shadow-2xl overflow-hidden
                            flex flex-col
                            pb-safe-bottom ring-1 ring-white/10
                            min-h-[50vh] max-h-[85vh]
                        "
                        style={{
                            boxShadow: `0 -20px 60px -20px ${colorTheme === 'slate' ? 'rgba(0,0,0,0.5)' : theme.text.replace('text-', 'rgba(').replace('-600', ',0.15)')}`
                        }}
                        initial={{ y: "100%" }} 
                        animate={{ y: 0 }}
                        exit={{ y: "100%" }}
                        transition={sheetTransition}
                        drag="y"
                        dragControls={dragControls}
                        dragListener={false} 
                        dragConstraints={{ top: 0, bottom: 0 }}
                        dragElastic={{ top: 0.05, bottom: 0.6 }}
                        dragSnapToOrigin
                        onDragEnd={handleDragEnd}
                    >
                        <div 
                            className="w-full flex justify-center pt-5 pb-3 cursor-grab active:cursor-grabbing touch-none z-20 bg-slate-50 dark:bg-[#0f172a]"
                            onPointerDown={(e) => dragControls.start(e)}
                            style={{ touchAction: 'none' }}
                        >
                            <div className="w-12 h-1 rounded-full bg-slate-300 dark:bg-slate-700" />
                        </div>

                        <div 
                            className="px-8 pb-4 pt-1 flex justify-between items-end z-10 border-b border-black/5 dark:border-white/5 bg-slate-50 dark:bg-[#0f172a]"
                            onPointerDown={(e) => dragControls.start(e)}
                            style={{ touchAction: 'none' }}
                        >
                            <div className="flex flex-col">
                                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-1">
                                    {selectedPlayerId ? 'Step 2' : 'Step 1'}
                                </span>
                                <h3 className="font-black text-slate-800 dark:text-white text-2xl leading-none tracking-tight">
                                    {selectedPlayerId ? 'Select Action' : 'Who Scored?'}
                                </h3>
                            </div>
                            <button 
                                onClick={onClose}
                                onPointerDown={(e) => e.stopPropagation()} 
                                className="p-2 -mr-2 rounded-full hover:bg-black/5 dark:hover:bg-white/10 text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <div className="relative w-full flex-1 bg-white dark:bg-[#020617]/50 overflow-hidden flex flex-col">
                            <AnimatePresence mode="wait" initial={false}>
                                {!selectedPlayerId ? (
                                    <motion.div 
                                        key="step1"
                                        className="flex-1 overflow-y-auto custom-scrollbar p-4 pb-10"
                                        initial={{ x: "-10%", opacity: 0 }}
                                        animate={{ x: 0, opacity: 1 }}
                                        exit={{ x: "-10%", opacity: 0, transition: { duration: 0.1 } }}
                                        transition={contentTransition}
                                    >
                                        <div className="grid grid-cols-2 gap-3">
                                            {sortedPlayers.map(p => (
                                                <button 
                                                    key={p.id}
                                                    onClick={() => handlePlayerSelect(p.id)}
                                                    className={`
                                                        relative group overflow-hidden
                                                        flex flex-col items-center justify-center gap-3 p-4 rounded-3xl
                                                        bg-slate-50 dark:bg-white/5 active:scale-95 transition-all
                                                        border border-slate-200 dark:border-white/5 
                                                        hover:border-indigo-500/30 dark:hover:border-white/20
                                                    `}
                                                >
                                                    <div className={`
                                                        w-14 h-14 rounded-2xl flex items-center justify-center shadow-sm
                                                        bg-white dark:bg-white/10 border border-black/5 dark:border-white/10
                                                        ${theme.text}
                                                    `}>
                                                        <span className="text-xl font-black">{p.number || p.name.substring(0, 1)}</span>
                                                    </div>
                                                    
                                                    <span className="font-bold text-sm text-slate-800 dark:text-white text-center line-clamp-1 w-full tracking-tight">
                                                        {p.name}
                                                    </span>
                                                </button>
                                            ))}
                                            
                                            <button 
                                                onClick={() => handlePlayerSelect('unknown')}
                                                className="col-span-2 flex items-center justify-center gap-3 p-4 rounded-2xl border border-dashed border-slate-300 dark:border-white/10 text-slate-500 hover:text-slate-800 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-white/5 transition-all"
                                            >
                                                <User size={16} />
                                                <span className="font-bold text-xs uppercase tracking-wider">Unknown Player</span>
                                            </button>
                                        </div>
                                    </motion.div>
                                ) : (
                                    <motion.div 
                                        key="step2"
                                        className="flex-1 flex flex-col p-4 h-full"
                                        initial={{ x: "10%", opacity: 0 }}
                                        animate={{ x: 0, opacity: 1 }}
                                        exit={{ x: "10%", opacity: 0, transition: { duration: 0.1 } }}
                                        transition={contentTransition}
                                    >
                                        <div className="grid grid-cols-2 gap-3">
                                            {skills.map(s => (
                                                <button 
                                                    key={s.id}
                                                    onClick={() => handleSkillSelect(s.id)}
                                                    className={`
                                                        relative overflow-hidden group
                                                        aspect-square rounded-3xl flex flex-col items-center justify-center gap-3
                                                        bg-slate-50 dark:bg-white/5 hover:bg-white dark:hover:bg-white/10 
                                                        border border-slate-200 dark:border-white/5 hover:border-indigo-500/30
                                                        active:scale-95 transition-all
                                                    `}
                                                >
                                                    <div className={`
                                                        p-4 rounded-2xl shadow-sm transition-transform group-hover:scale-110 duration-300
                                                        bg-white dark:bg-white/10 border border-black/5 dark:border-white/10 ${theme.text}
                                                    `}>
                                                        <s.icon size={28} strokeWidth={1.5} />
                                                    </div>
                                                    <span className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">{s.label}</span>
                                                </button>
                                            ))}
                                        </div>

                                        <div className="mt-auto pt-6 pb-2">
                                            <button 
                                                onClick={() => setSelectedPlayerId(null)}
                                                className="w-full flex items-center justify-center gap-2 text-xs font-bold text-slate-400 hover:text-slate-700 dark:hover:text-white uppercase tracking-widest py-4 transition-colors"
                                            >
                                                <ChevronLeft size={16} /> Back to Players
                                            </button>
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>,
        document.body
    );
};
