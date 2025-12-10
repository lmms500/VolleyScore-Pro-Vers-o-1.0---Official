
import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Save, Star } from 'lucide-react';

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
  '🐶', '🐱', '🦊', '🦁', '🐯', '🦄', '🐲', '🏐', '🔥', '⚡', '💎', '🚀', '⭐', '🧢', '🕶️', '🎧'
];

export const ProfileCreationModal: React.FC<ProfileCreationModalProps> = ({
  isOpen, onClose, onSave, initialName, initialNumber, initialSkill = 3, title = "Create Profile"
}) => {
  const [name, setName] = useState(initialName);
  const [number, setNumber] = useState(initialNumber);
  const [avatar, setAvatar] = useState('🏐');
  const [skill, setSkill] = useState(initialSkill);

  // Reset state when modal opens/closes or props change
  useEffect(() => {
      if (isOpen) {
          setName(initialName);
          setNumber(initialNumber);
          setSkill(initialSkill);
      }
  }, [isOpen, initialName, initialNumber, initialSkill]);

  const handleSave = () => {
    onSave(name, number, avatar, skill);
    onClose();
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
      <div className="flex flex-col gap-4 pb-2">
        <div className="flex flex-col items-center justify-center my-2 gap-3">
          <div className="w-20 h-20 rounded-full bg-slate-100 dark:bg-white/10 flex items-center justify-center text-4xl shadow-inner border border-slate-200 dark:border-white/10">
            {avatar}
          </div>
          
          {/* Skill Selector */}
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-white/5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-white/10">
              {[1, 2, 3, 4, 5].map(i => (
                  <button 
                      key={i}
                      onClick={() => setSkill(i)}
                      className="p-1 focus:outline-none hover:scale-110 active:scale-95 transition-transform"
                  >
                      <Star 
                          size={20} 
                          className={`${i <= skill ? 'text-amber-400 fill-amber-400' : 'text-slate-300 dark:text-slate-600'}`}
                      />
                  </button>
              ))}
          </div>
        </div>

        {/* Avatar Selector */}
        <div className="overflow-x-auto no-scrollbar pb-2">
          <div className="flex gap-2 px-1">
            {AVATARS.map((emoji) => (
              <button
                key={emoji}
                onClick={() => setAvatar(emoji)}
                className={`w-10 h-10 rounded-full flex items-center justify-center text-xl transition-transform ${avatar === emoji ? 'bg-indigo-500 scale-110 shadow-md' : 'bg-slate-50 dark:bg-white/5 hover:bg-slate-200'}`}
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>

        {/* Inputs */}
        <div className="space-y-3">
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-1">Player Name</label>
            <input 
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full mt-1 bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3 font-bold text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
              placeholder="Name"
            />
          </div>
          
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-1">Jersey Number</label>
            <input 
              value={number}
              onChange={(e) => setNumber(e.target.value)}
              className="w-full mt-1 bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3 font-bold text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
              placeholder="#"
              type="tel"
              maxLength={3}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 mt-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave}>
            <Save size={16} /> Save Profile
          </Button>
        </div>
      </div>
    </Modal>,
    document.body
  );
};
