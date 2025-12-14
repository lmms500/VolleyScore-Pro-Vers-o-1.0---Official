
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Save, UserCircle2, Shield, Hand, Zap, Target, Smile, Type, Grid } from 'lucide-react';
import { useTranslation } from '../../contexts/LanguageContext';
import { PlayerRole } from '../../types';
import { motion } from 'framer-motion';

interface ProfileCreationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (name: string, number: string, avatar: string, skill: number, role: PlayerRole) => void;
  initialName: string;
  initialNumber: string;
  initialSkill?: number;
  initialRole?: PlayerRole;
  title?: string;
}

// Categorized Avatar Library
const EMOJI_CATEGORIES = {
  sports: ['🏐', '🏆', '🥇', '👟', '🎽', '🔥', '⚡', '💪', '🤕', '📢', '⏱️', '🏋️', '🚴', '🏊', '🧘'],
  faces:  ['😎', '😤', '🤠', '👿', '🤡', '🤖', '👽', '💀', '👻', '🧐', '🤩', '🥶', '🤯', '🤫', '🫡'],
  animals:['🦅', '🦈', '🦁', '🐯', '🦍', '🐐', '🐍', '🐂', '🦊', '🐺', '🐗', '🦖', '🐙', '🦋', '🐝'],
  misc:   ['💎', '🚀', '💣', '🛡️', '⚔️', '🧬', '🧿', '🎲', '👑', '🎩', '🧢', '🕶️', '🎧', '🍔', '🍕']
};

export const ProfileCreationModal: React.FC<ProfileCreationModalProps> = ({
  isOpen, onClose, onSave, initialName, initialNumber, initialSkill = 5, initialRole = 'none', title
}) => {
  const { t } = useTranslation();
  
  // Form State
  const [name, setName] = useState(initialName);
  const [number, setNumber] = useState(initialNumber);
  const [skill, setSkill] = useState(initialSkill);
  const [role, setRole] = useState<PlayerRole>(initialRole);

  // Avatar State
  const [mode, setMode] = useState<'emoji' | 'text'>('emoji');
  const [selectedEmoji, setSelectedEmoji] = useState('🏐');
  const [customText, setCustomText] = useState('');
  const [activeCategory, setActiveCategory] = useState<keyof typeof EMOJI_CATEGORIES>('sports');

  const nameInputRef = useRef<HTMLInputElement>(null);

  // Initialization Logic
  useEffect(() => {
      if (isOpen) {
          setName(initialName);
          setNumber(initialNumber);
          setSkill(initialSkill || 5);
          setRole(initialRole || 'none');
          
          if (initialName && !customText) {
             setCustomText(getInitials(initialName));
          }
          
          // Auto-Focus Name Input on Open
          setTimeout(() => nameInputRef.current?.focus(), 50);
      }
  }, [isOpen, initialName, initialNumber, initialSkill, initialRole]);

  useEffect(() => {
      if (mode === 'text') {
          const initials = getInitials(name);
          if (customText.length <= 2) {
             setCustomText(initials);
          }
      }
  }, [name, mode]);

  const getInitials = (fullName: string) => {
      const parts = fullName.trim().split(' ');
      if (parts.length === 0) return '';
      if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  const handleSave = () => {
    if (!name.trim()) return;
    const finalAvatar = mode === 'emoji' ? selectedEmoji : (customText || getInitials(name)).substring(0, 2);
    onSave(name, number, finalAvatar, skill, role);
    onClose();
  };

  const getSkillColor = (s: number) => {
      if (s <= 3) return 'text-rose-500';
      if (s <= 7) return 'text-amber-500';
      return 'text-emerald-500';
  };
  const getTrackColor = (s: number) => {
      if (s <= 3) return 'bg-rose-500';
      if (s <= 7) return 'bg-amber-500';
      return 'bg-emerald-500';
  };

  const roles: { id: PlayerRole, label: string, icon: any, color: string }[] = [
      { id: 'setter', label: 'Setter', icon: Hand, color: 'text-amber-500 bg-amber-500/10 border-amber-500/20 ring-amber-500' },
      { id: 'hitter', label: 'Hitter', icon: Zap, color: 'text-rose-500 bg-rose-500/10 border-rose-500/20 ring-rose-500' },
      { id: 'middle', label: 'Middle', icon: Target, color: 'text-indigo-500 bg-indigo-500/10 border-indigo-500/20 ring-indigo-500' },
      { id: 'libero', label: 'Libero', icon: Shield, color: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20 ring-emerald-500' },
  ];

  if (!isOpen) return null;

  return createPortal(
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title || t('profile.createTitle')}
      maxWidth="max-w-md"
      zIndex="z-[9999]"
    >
      <div className="flex flex-col gap-6 pb-2 pt-2">
        
        {/* --- 1. AVATAR PREVIEW & TOGGLE --- */}
        <div className="flex flex-col items-center gap-4">
            
            {/* Avatar Display */}
            <div className="relative group">
                <div className="w-24 h-24 rounded-[2rem] bg-slate-50 dark:bg-white/5 flex items-center justify-center shadow-lg border border-slate-200 dark:border-white/10 overflow-hidden transition-all duration-300 ring-4 ring-white dark:ring-[#0f172a] shadow-black/5">
                    {mode === 'emoji' ? (
                        <span className="text-5xl animate-in zoom-in duration-300 drop-shadow-sm">{selectedEmoji}</span>
                    ) : (
                        <input 
                            type="text"
                            value={customText}
                            onChange={(e) => setCustomText(e.target.value.toUpperCase())}
                            maxLength={2}
                            className="w-full h-full bg-transparent text-center text-4xl font-black text-slate-700 dark:text-slate-200 outline-none uppercase placeholder:opacity-20"
                            placeholder="AB"
                        />
                    )}
                </div>
                {/* Number Badge */}
                {number && (
                    <div className="absolute -top-3 -right-3 w-8 h-8 flex items-center justify-center bg-indigo-600 text-white font-black text-sm rounded-xl shadow-xl border-4 border-white dark:border-slate-900 z-10">
                        {number}
                    </div>
                )}
            </div>

            {/* Mode Switcher */}
            <div className="flex p-1 bg-slate-100 dark:bg-white/5 rounded-2xl border border-black/5 dark:border-white/5 w-full max-w-[200px]">
                <button 
                    onClick={() => setMode('emoji')}
                    className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all active:scale-95 ${mode === 'emoji' ? 'bg-white dark:bg-white/10 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                >
                    <Smile size={14} /> Emoji
                </button>
                <button 
                    onClick={() => { setMode('text'); if(!customText) setCustomText(getInitials(name)); }}
                    className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all active:scale-95 ${mode === 'text' ? 'bg-white dark:bg-white/10 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                >
                    <Type size={14} /> Text
                </button>
            </div>

            {/* Emoji Selection */}
            {mode === 'emoji' && (
                <div className="w-full space-y-2 animate-in fade-in slide-in-from-top-2 duration-300">
                    <div className="flex justify-center gap-2">
                        {(Object.keys(EMOJI_CATEGORIES) as Array<keyof typeof EMOJI_CATEGORIES>).map(cat => (
                            <button
                                key={cat}
                                onClick={() => setActiveCategory(cat)}
                                className={`px-2 py-1.5 rounded-lg text-[8px] font-bold uppercase tracking-wide transition-colors border ${activeCategory === cat ? 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20' : 'bg-transparent border-transparent text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5'}`}
                            >
                                {cat}
                            </button>
                        ))}
                    </div>
                    
                    <div className="w-full overflow-x-auto no-scrollbar mask-linear-fade-sides -mx-8 px-8">
                        <div className="flex gap-2 w-max px-2 py-1">
                            {EMOJI_CATEGORIES[activeCategory].map(emoji => (
                                <button
                                    key={emoji}
                                    onClick={() => setSelectedEmoji(emoji)}
                                    className={`
                                        w-10 h-10 rounded-xl flex items-center justify-center text-xl transition-all duration-200 border active:scale-90
                                        ${selectedEmoji === emoji 
                                            ? 'bg-white dark:bg-white/10 border-indigo-500 shadow-lg shadow-indigo-500/20 scale-110' 
                                            : 'bg-slate-50 dark:bg-white/5 border-transparent opacity-60 hover:opacity-100 hover:scale-105'}
                                    `}
                                >
                                    {emoji}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>

        {/* --- 2. INPUT FIELDS (Compact) --- */}
        <div className="space-y-3">
            <div className="relative group">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors">
                    <UserCircle2 size={18} strokeWidth={2} />
                </div>
                <input 
                    ref={nameInputRef}
                    autoFocus
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={t('profile.namePlaceholder')}
                    className="w-full h-11 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl pl-12 pr-4 font-bold text-slate-900 dark:text-white placeholder:text-slate-400 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500/50 outline-none transition-all text-sm"
                />
            </div>
            <div className="relative group">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-black text-xs group-focus-within:text-indigo-500 transition-colors">#</div>
                <input 
                    value={number}
                    onChange={(e) => setNumber(e.target.value)}
                    placeholder={t('profile.numberPlaceholder')}
                    type="tel"
                    maxLength={3}
                    className="w-full h-11 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl pl-12 pr-4 font-bold text-slate-900 dark:text-white placeholder:text-slate-400 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500/50 outline-none transition-all text-sm"
                />
            </div>
        </div>

        {/* --- 3. SKILL SLIDER (Enhanced) --- */}
        <div className="bg-slate-50 dark:bg-black/20 rounded-2xl p-4 border border-slate-200 dark:border-white/5 space-y-3">
            <div className="flex justify-between items-end">
                <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{t('profile.skillLevel')}</label>
                <div className="flex items-baseline gap-1">
                    <span className={`text-2xl font-black tabular-nums transition-colors ${getSkillColor(skill)}`}>{skill}</span>
                    <span className="text-[10px] font-bold text-slate-300 dark:text-slate-600">/ 10</span>
                </div>
            </div>

            <div className="relative w-full h-8 flex items-center touch-none">
                <div className="absolute w-full h-3 bg-slate-200 dark:bg-white/10 rounded-full overflow-hidden">
                    <div 
                        className={`h-full transition-all duration-300 ease-out ${getTrackColor(skill)}`}
                        style={{ width: `${(skill / 10) * 100}%` }}
                    />
                </div>
                <input 
                    type="range" min="1" max="10" step="1"
                    value={skill}
                    onChange={(e) => setSkill(Number(e.target.value))}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20"
                />
                <div 
                    className="absolute h-6 w-6 bg-white dark:bg-slate-200 border-4 border-white dark:border-slate-800 rounded-full shadow-lg pointer-events-none transition-all duration-300 ease-out z-10 flex items-center justify-center"
                    style={{ left: `calc(${(skill / 10) * 100}% - 12px)` }}
                >
                    <div className={`w-2 h-2 rounded-full ${getTrackColor(skill)}`} />
                </div>
            </div>
        </div>

        {/* --- 4. ROLE SELECTION --- */}
        <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2 block px-2">Primary Role</label>
            <div className="grid grid-cols-4 gap-2">
                {roles.map((r) => {
                    const isActive = role === r.id;
                    return (
                        <button
                            key={r.id}
                            onClick={() => setRole(isActive ? 'none' : r.id)}
                            className={`
                                flex flex-col items-center justify-center gap-1.5 p-2 rounded-xl border-2 transition-all duration-200 h-16 active:scale-95
                                ${isActive ? r.color + ' ring-2 ring-offset-2 ring-offset-white dark:ring-offset-slate-900 bg-opacity-20 border-current' : 'bg-slate-50 dark:bg-white/5 border-transparent text-slate-400 hover:bg-slate-100 dark:hover:bg-white/10'}
                            `}
                        >
                            <r.icon size={16} strokeWidth={2.5} />
                            <span className="text-[8px] font-bold uppercase tracking-widest leading-none">{r.label}</span>
                        </button>
                    );
                })}
            </div>
        </div>

        {/* --- 5. ACTIONS --- */}
        <div className="grid grid-cols-2 gap-3 pt-4 border-t border-slate-200 dark:border-white/5">
            <Button variant="secondary" className="bg-slate-100 dark:bg-white/5 border-transparent h-11 active:scale-95" onClick={onClose}>{t('common.cancel')}</Button>
            <Button onClick={handleSave} className="bg-indigo-600 text-white shadow-xl shadow-indigo-500/20 h-11 active:scale-95">
                <Save size={16} /> {t(title === "Create Profile" ? 'profile.create' : 'profile.save')}
            </Button>
        </div>

      </div>
    </Modal>,
    document.body
  );
};
