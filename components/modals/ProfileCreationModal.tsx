
import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Save, User, UserCircle2 } from 'lucide-react';

interface ProfileCreationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (name: string, number: string, avatar: string, skill: number) => void;
  initialName: string;
  initialNumber: string;
  initialSkill?: number;
  title?: string;
}

const AVATARS = [
  '🐶', '🐱', '🦊', '🦁', '🐯', '🦄', '🐲', '🏐', '🔥', '⚡', '💎', '🚀', '⭐', '🧢', '🕶️', '🎧',
  '💀', '👽', '🤖', '🎃', '😺', '🐵', '🦉', '🦋', '🐞', '🍔', '🍕', '⚽', '🏀', '🏈', '🎾'
];

export const ProfileCreationModal: React.FC<ProfileCreationModalProps> = ({
  isOpen, onClose, onSave, initialName, initialNumber, initialSkill = 5, title = "Create Profile"
}) => {
  const [name, setName] = useState(initialName);
  const [number, setNumber] = useState(initialNumber);
  const [avatar, setAvatar] = useState('🏐');
  const [skill, setSkill] = useState(initialSkill);

  // Reset state when modal opens
  useEffect(() => {
      if (isOpen) {
          setName(initialName);
          setNumber(initialNumber);
          setSkill(initialSkill || 5);
      }
  }, [isOpen, initialName, initialNumber, initialSkill]);

  const handleSave = () => {
    if (!name.trim()) return;
    onSave(name, number, avatar, skill);
    onClose();
  };

  // Dynamic Color for Slider
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

  if (!isOpen) return null;

  return createPortal(
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      maxWidth="max-w-sm"
      zIndex="z-[9999]"
    >
      <div className="flex flex-col gap-6 pb-2">
        
        {/* --- 1. AVATAR SECTION --- */}
        <div className="flex flex-col items-center gap-4">
            <div className="relative group">
                <div className="w-24 h-24 rounded-[2rem] bg-slate-100 dark:bg-white/5 flex items-center justify-center text-5xl shadow-inner border border-slate-200 dark:border-white/10">
                    {avatar}
                </div>
                {/* Number Badge */}
                {number && (
                    <div className="absolute -top-2 -right-2 w-8 h-8 flex items-center justify-center bg-indigo-600 text-white font-black text-sm rounded-xl shadow-lg border-2 border-white dark:border-slate-900">
                        {number}
                    </div>
                )}
            </div>

            {/* Avatar Scroll Strip */}
            <div className="w-full overflow-x-auto no-scrollbar mask-linear-fade-sides py-2 -mx-6 px-6">
                <div className="flex gap-2 w-max px-2">
                    {AVATARS.map(emoji => (
                        <button
                            key={emoji}
                            onClick={() => setAvatar(emoji)}
                            className={`
                                w-10 h-10 rounded-xl flex items-center justify-center text-2xl transition-all duration-200
                                ${avatar === emoji 
                                    ? 'bg-indigo-500 scale-110 shadow-lg shadow-indigo-500/30' 
                                    : 'bg-slate-50 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 opacity-70 hover:opacity-100'}
                            `}
                        >
                            {emoji}
                        </button>
                    ))}
                </div>
            </div>
        </div>

        {/* --- 2. SKILL SLIDER (INLINE) --- */}
        <div className="bg-slate-50 dark:bg-black/20 rounded-2xl p-4 border border-black/5 dark:border-white/5 space-y-3">
            <div className="flex justify-between items-end">
                <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Skill Level</label>
                <div className="flex items-baseline gap-1">
                    <span className={`text-2xl font-black tabular-nums transition-colors ${getSkillColor(skill)}`}>{skill}</span>
                    <span className="text-xs font-bold text-slate-300">/ 10</span>
                </div>
            </div>

            <div className="relative w-full h-8 flex items-center touch-none">
                {/* Track Background */}
                <div className="absolute w-full h-3 bg-slate-200 dark:bg-white/10 rounded-full overflow-hidden">
                    <div 
                        className={`h-full transition-all duration-200 ${getTrackColor(skill)}`}
                        style={{ width: `${(skill / 10) * 100}%` }}
                    />
                </div>
                {/* Input (Invisible Overlay) */}
                <input 
                    type="range" min="1" max="10" step="1"
                    value={skill}
                    onChange={(e) => setSkill(Number(e.target.value))}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20"
                />
                {/* Thumb */}
                <div 
                    className="absolute h-6 w-6 bg-white border-2 rounded-full shadow-md pointer-events-none transition-all duration-200 z-10 flex items-center justify-center"
                    style={{ left: `calc(${(skill / 10) * 100}% - 12px)` }}
                >
                    <div className={`w-2 h-2 rounded-full ${getTrackColor(skill)}`} />
                </div>
            </div>
            
            <div className="flex justify-between px-1">
                <span className="text-[9px] font-bold text-slate-300 uppercase tracking-wider">Rookie</span>
                <span className="text-[9px] font-bold text-slate-300 uppercase tracking-wider">Pro</span>
            </div>
        </div>

        {/* --- 3. INPUT FIELDS --- */}
        <div className="space-y-3">
            <div className="relative">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                    <UserCircle2 size={18} />
                </div>
                <input 
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Player Name"
                    className="w-full bg-slate-100 dark:bg-white/5 border-none rounded-xl py-3 pl-10 pr-4 font-bold text-slate-800 dark:text-white placeholder:text-slate-400 focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all"
                />
            </div>
            <div className="relative">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-black text-xs">#</div>
                <input 
                    value={number}
                    onChange={(e) => setNumber(e.target.value)}
                    placeholder="Jersey Number (Optional)"
                    type="tel"
                    maxLength={3}
                    className="w-full bg-slate-100 dark:bg-white/5 border-none rounded-xl py-3 pl-10 pr-4 font-bold text-slate-800 dark:text-white placeholder:text-slate-400 focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all"
                />
            </div>
        </div>

        {/* --- 4. ACTIONS --- */}
        <div className="grid grid-cols-2 gap-3 pt-2">
            <Button variant="secondary" onClick={onClose}>Cancel</Button>
            <Button onClick={handleSave} className="bg-indigo-600 text-white shadow-indigo-500/20">
                <Save size={18} /> {title === "Create Profile" ? "Create" : "Save"}
            </Button>
        </div>

      </div>
    </Modal>,
    document.body
  );
};
