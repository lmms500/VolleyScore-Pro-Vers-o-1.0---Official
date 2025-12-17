
import React, { useState, useRef, useEffect, memo } from 'react';
import { Plus, Ban, Armchair } from 'lucide-react';
import { useTranslation } from '../../contexts/LanguageContext';
import { SkillSlider } from '../ui/SkillSlider';

interface AddPlayerFormProps {
  onAdd: (name: string, number?: string, skill?: number) => void;
  disabled?: boolean;
  customLabel?: string;
}

export const AddPlayerForm = memo(({ onAdd, disabled, customLabel }: AddPlayerFormProps) => {
    const { t } = useTranslation();
    const [isOpen, setIsOpen] = useState(false);
    const [name, setName] = useState('');
    const [number, setNumber] = useState('');
    const [skill, setSkill] = useState(5);
    
    const inputRef = useRef<HTMLInputElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    // Focus management
    useEffect(() => { 
        if(isOpen) { 
            setTimeout(() => inputRef.current?.focus(), 50); 
        } 
    }, [isOpen]);
    
    // Close on interaction outside
    useEffect(() => { 
        if (!isOpen) return; 
        const handleClickOutside = (event: MouseEvent | TouchEvent) => { 
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) { 
                setIsOpen(false); 
            } 
        }; 
        const handleScroll = () => { if (isOpen) setIsOpen(false); }; 
        
        document.addEventListener('mousedown', handleClickOutside); 
        document.addEventListener('touchstart', handleClickOutside); 
        window.addEventListener('team-manager-scroll', handleScroll);
        window.addEventListener('scroll', handleScroll, { capture: true }); 
        
        return () => { 
            document.removeEventListener('mousedown', handleClickOutside); 
            document.removeEventListener('touchstart', handleClickOutside); 
            window.removeEventListener('team-manager-scroll', handleScroll);
            window.removeEventListener('scroll', handleScroll, { capture: true }); 
        }; 
    }, [isOpen]);

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
            <div ref={containerRef} className="flex flex-col mt-4 animate-in fade-in slide-in-from-top-1 bg-white dark:bg-white/[0.08] p-4 rounded-2xl border border-indigo-500/30 shadow-xl ring-1 ring-indigo-500/20 backdrop-blur-md">
                <input 
                    ref={inputRef} 
                    autoFocus 
                    className="w-full bg-transparent border-b border-slate-200 dark:border-white/10 px-2 py-3 text-sm text-slate-900 dark:text-white focus:outline-none font-bold placeholder:text-slate-400 mb-4" 
                    placeholder={t('teamManager.addPlayerPlaceholder')} 
                    value={name} 
                    onChange={e => setName(e.target.value)} 
                    onKeyDown={e => { 
                        if(e.key === 'Enter') submit(); 
                        if(e.key === 'Escape') setIsOpen(false); 
                    }} 
                />
                <div className="flex items-center gap-3">
                    <input 
                        type="tel" 
                        className="w-16 text-center bg-slate-100 dark:bg-black/20 rounded-xl border border-transparent focus:border-indigo-500 focus:bg-white dark:focus:bg-black/40 px-1 py-3 text-xs font-black text-slate-800 dark:text-slate-200 outline-none transition-all placeholder:text-slate-400" 
                        placeholder="#" 
                        value={number} 
                        onChange={e => setNumber(e.target.value)} 
                        maxLength={3} 
                    />
                    <div className="flex-1 flex items-center justify-center bg-slate-100 dark:bg-white/5 rounded-xl px-2 py-2">
                        <SkillSlider level={skill} onChange={setSkill} />
                    </div>
                    <button 
                        onClick={submit} 
                        className="p-3 bg-indigo-500 rounded-xl hover:bg-indigo-400 text-white shadow-lg shadow-indigo-500/30 active:scale-95 transition-all"
                    >
                        <Plus size={20} />
                    </button>
                </div>
            </div>
        ); 
    }
    
    const labelContent = customLabel || t('common.add');
    const isBenchLabel = customLabel?.toLowerCase().includes('bench') || customLabel?.toLowerCase().includes('banco');
    
    return (
        <button 
            onClick={() => !disabled && setIsOpen(true)} 
            disabled={disabled} 
            className={`
                mt-2 w-full py-3 flex items-center justify-center gap-2 text-[10px] font-bold uppercase tracking-widest rounded-2xl border border-dashed transition-all group active:scale-95 
                ${disabled 
                    ? 'border-slate-200 dark:border-slate-800 text-slate-300 dark:text-slate-600 cursor-not-allowed' 
                    : 'border-slate-300 dark:border-white/10 text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:border-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-500/10'
                }
            `} 
        >
            {disabled ? (
                <><Ban size={14} /> {t('common.full')}</>
            ) : (
                <>
                    {isBenchLabel ? (
                        <Armchair size={14} className="text-emerald-500 group-hover:scale-110 transition-transform" />
                    ) : (
                        <Plus size={14} className="group-hover:scale-110 transition-transform" />
                    )} 
                    {labelContent}
                </>
            )}
        </button>
    );
});
