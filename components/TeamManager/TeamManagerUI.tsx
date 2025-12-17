
import React, { useState, useMemo, useRef, useEffect, memo } from 'react';
import { Check, Lock, Edit2, ImageIcon, Info, ListOrdered } from 'lucide-react';
import { motion } from 'framer-motion';
import { TeamColor } from '../../types';
import { COLOR_KEYS, getHexFromColor } from '../../utils/colors';
import { useTranslation } from '../../contexts/LanguageContext';
import { Button } from '../ui/Button';

// --- COLOR PICKER ---
export const ColorPicker = memo(({ selected, onChange, usedColors }: { selected: TeamColor, onChange: (c: TeamColor) => void, usedColors: Set<string> }) => {
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
                className="w-full overflow-x-auto overflow-y-hidden no-scrollbar touch-pan-x flex items-center px-1" 
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

// --- EDITABLE TITLE ---
export const EditableTitle = memo(({ name, onSave, className, isPlayer }: { name: string; onSave: (val: string) => void; className?: string; isPlayer?: boolean }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [val, setVal] = useState(name);
  const inputRef = React.useRef<HTMLInputElement>(null);
  useEffect(() => { setVal(name); }, [name]);
  useEffect(() => { if(isEditing) inputRef.current?.focus(); }, [isEditing]);
  const save = () => { setIsEditing(false); if(val.trim() && val !== name) onSave(val.trim()); else setVal(name); };
  if(isEditing) return <input ref={inputRef} type="text" className={`bg-transparent text-slate-900 dark:text-white border-b-2 border-indigo-500 outline-none w-full px-0 py-1 font-bold placeholder-slate-400 ${isPlayer ? 'text-sm' : 'text-xl uppercase tracking-tight'}`} value={val} onChange={e => setVal(e.target.value)} onBlur={save} onKeyDown={e => { if(e.key === 'Enter') save(); if(e.key === 'Escape') setIsEditing(false); }} onPointerDown={e => e.stopPropagation()} />;
  return <div className={`flex items-center gap-2 group cursor-pointer min-w-0 ${className}`} onClick={() => setIsEditing(true)}><span className="truncate text-slate-900 dark:text-white">{name}</span><Edit2 size={12} className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-400 flex-shrink-0" /></div>;
});

// --- TEAM LOGO UPLOADER ---
export const TeamLogoUploader = memo(({ currentLogo, onUpdate, teamName }: { currentLogo?: string, onUpdate: (logo: string) => void, teamName: string }) => {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => { const file = e.target.files?.[0]; if (file) { const reader = new FileReader(); reader.onloadend = () => { if (typeof reader.result === 'string') { onUpdate(reader.result); } }; reader.readAsDataURL(file); } };
    const triggerUpload = () => fileInputRef.current?.click();
    return <div className="relative group flex-shrink-0"><button onClick={triggerUpload} className="w-10 h-10 landscape:w-8 landscape:h-8 rounded-full border-2 border-white dark:border-white/10 bg-slate-100 dark:bg-white/5 flex items-center justify-center overflow-hidden hover:opacity-90 transition-opacity shadow-sm" title={`Change ${teamName} Logo`}>{currentLogo ? <img src={currentLogo} alt={teamName} className="w-full h-full object-cover" /> : <ImageIcon size={16} className="text-slate-400 dark:text-slate-500" />}<div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-[2px]"><Edit2 size={12} className="text-white" /></div></button><input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileChange} /></div>;
});

// --- BATCH INPUT SECTION ---
export const BatchInputSection = ({ onGenerate }: { onGenerate: (names: string[]) => void }) => {
    const { t } = useTranslation();
    const [input, setInput] = useState('');
    const handleGenerate = () => { if (!input.trim()) return; const rawLines = input.split(/\r?\n|,\s*/); const names = rawLines.map(n => n.trim()).filter(n => n.length > 0); onGenerate(names); setInput(''); };
    return (
        <div className="flex flex-col h-full w-full"><div className="flex-1 overflow-y-auto custom-scrollbar p-4 pb-0"><div className="bg-slate-100 dark:bg-white/5 p-4 rounded-2xl mb-4 border border-black/5 dark:border-white/5"><div className="flex items-start gap-3 mb-3"><div className="p-2 bg-indigo-500/10 rounded-full text-indigo-500 shrink-0"><Info size={18} /></div><div><h4 className="text-sm font-bold text-slate-800 dark:text-white mb-1">{t('teamManager.batch.title')}</h4><p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">{t('teamManager.batch.desc')}</p></div></div><div className="space-y-2 pl-2"><div className="flex items-center gap-2 text-[10px] text-slate-600 dark:text-slate-300"><span className="font-mono bg-white dark:bg-black/20 px-2 py-1 rounded border border-black/5 dark:border-white/10">Lucas</span><span className="opacity-50 text-[9px] uppercase tracking-wide">Nome</span></div><div className="flex items-center gap-2 text-[10px] text-slate-600 dark:text-slate-300"><span className="font-mono bg-white dark:bg-black/20 px-2 py-1 rounded border border-black/5 dark:border-white/10">10 Pedro</span><span className="opacity-50 text-[9px] uppercase tracking-wide"># + Nome</span></div></div></div><textarea className="w-full bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl p-4 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500/50 resize-none custom-scrollbar shadow-inner font-mono leading-relaxed placeholder:text-slate-400/50 flex-1 min-h-[200px]" placeholder={t('teamManager.batch.placeholder')} value={input} onChange={e => setInput(e.target.value)} /></div><div className="flex-shrink-0 p-10 pt-4 bg-transparent z-10 relative"><Button onClick={handleGenerate} disabled={!input.trim()} className="w-full bg-indigo-600 text-white shadow-xl shadow-indigo-500/30 py-4 rounded-2xl h-14 ring-1 ring-white/20 active:scale-[0.98] transition-all"><ListOrdered size={18} className="mr-2" strokeWidth={2.5} /> {t('teamManager.batch.generate')}</Button></div></div>
    );
};
