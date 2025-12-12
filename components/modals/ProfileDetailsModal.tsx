
import React from 'react';
import { createPortal } from 'react-dom';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { PlayerProfile } from '../../types';
import { Trophy, Swords, Shield, Target, Edit2, Zap, Hand } from 'lucide-react';
import { useTranslation } from '../../contexts/LanguageContext';
import { motion } from 'framer-motion';

interface ProfileDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: PlayerProfile;
  onEdit: () => void; // Parent handles switching to Edit Modal
}

// Stats Card Helper
const StatTile = ({ label, value, icon: Icon, color }: any) => (
    <div className={`
        flex flex-col items-center justify-center p-3 rounded-2xl 
        bg-white/5 border border-white/10 relative overflow-hidden group
    `}>
        <div className={`absolute -right-2 -bottom-2 opacity-10 group-hover:opacity-20 transition-opacity ${color}`}>
            <Icon size={48} />
        </div>
        <div className={`mb-1 ${color.replace('bg-', 'text-')}`}>
            <Icon size={18} />
        </div>
        <span className="text-xl font-black text-white">{value}</span>
        <span className="text-[9px] font-bold uppercase tracking-widest text-slate-400">{label}</span>
    </div>
);

export const ProfileDetailsModal: React.FC<ProfileDetailsModalProps> = ({ 
    isOpen, onClose, profile, onEdit 
}) => {
    const { t } = useTranslation();

    if (!isOpen) return null;

    const stats = profile.stats || {
        matchesPlayed: 0, matchesWon: 0, totalPoints: 0,
        attacks: 0, blocks: 0, aces: 0, mvpCount: 0
    };

    const winRate = stats.matchesPlayed > 0 
        ? Math.round((stats.matchesWon / stats.matchesPlayed) * 100) 
        : 0;

    // Resolve Role Theme
    const getRoleTheme = (role: string = 'none') => {
        switch(role) {
            case 'setter': return { color: 'text-amber-500', bg: 'bg-amber-500', icon: Hand, label: 'Setter' };
            case 'hitter': return { color: 'text-rose-500', bg: 'bg-rose-500', icon: Zap, label: 'Hitter' };
            case 'middle': return { color: 'text-indigo-500', bg: 'bg-indigo-500', icon: Target, label: 'Middle' };
            case 'libero': return { color: 'text-emerald-500', bg: 'bg-emerald-500', icon: Shield, label: 'Libero' };
            default: return { color: 'text-slate-400', bg: 'bg-slate-500', icon: Trophy, label: 'All Rounder' };
        }
    };

    const roleTheme = getRoleTheme(profile.role);
    const RoleIcon = roleTheme.icon;

    return createPortal(
        <Modal 
            isOpen={isOpen} 
            onClose={onClose} 
            title="" 
            maxWidth="max-w-sm"
            backdropClassName="bg-black/60 backdrop-blur-md"
        >
            <div className="flex flex-col gap-6 pb-2">
                
                {/* HERO SECTION */}
                <div className="relative flex flex-col items-center pt-4">
                    {/* Role Badge */}
                    <div className={`
                        absolute top-0 right-0 px-2 py-1 rounded-full border border-white/10
                        flex items-center gap-1 bg-black/20 backdrop-blur-md
                    `}>
                        <RoleIcon size={12} className={roleTheme.color} />
                        <span className={`text-[9px] font-bold uppercase tracking-wider ${roleTheme.color}`}>
                            {roleTheme.label}
                        </span>
                    </div>

                    {/* Avatar */}
                    <div className="relative mb-3">
                        <div className="w-24 h-24 rounded-[2rem] bg-gradient-to-br from-slate-100 to-slate-200 dark:from-white/10 dark:to-white/5 flex items-center justify-center text-5xl shadow-2xl border border-white/20">
                            {profile.avatar || '👤'}
                        </div>
                        {profile.number && (
                            <div className={`
                                absolute -bottom-2 -right-2 w-8 h-8 flex items-center justify-center 
                                ${roleTheme.bg} text-white font-black text-sm rounded-xl 
                                shadow-lg border-2 border-[#0f172a]
                            `}>
                                {profile.number}
                            </div>
                        )}
                    </div>

                    <h2 className="text-2xl font-black text-white tracking-tight">{profile.name}</h2>
                    
                    {/* Skill Level Bar */}
                    <div className="flex items-center gap-2 mt-2 opacity-80">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Skill Level</span>
                        <div className="flex gap-0.5">
                            {[...Array(10)].map((_, i) => (
                                <div 
                                    key={i} 
                                    className={`w-1 h-3 rounded-full ${i < profile.skillLevel ? roleTheme.bg : 'bg-slate-700'}`} 
                                />
                            ))}
                        </div>
                    </div>
                </div>

                {/* STATS GRID */}
                <div className="grid grid-cols-3 gap-2">
                    <div className="col-span-3 bg-white/5 rounded-2xl p-3 flex items-center justify-between border border-white/10 mb-2">
                        <div className="flex flex-col">
                            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Career Matches</span>
                            <div className="flex items-baseline gap-1">
                                <span className="text-2xl font-black text-white">{stats.matchesPlayed}</span>
                                <span className="text-xs font-bold text-emerald-500">{winRate}% Win</span>
                            </div>
                        </div>
                        <Trophy size={28} className="text-amber-500 drop-shadow-[0_0_10px_rgba(245,158,11,0.5)]" />
                    </div>

                    <StatTile label="Points" value={stats.totalPoints} icon={Target} color="text-emerald-500 bg-emerald-500" />
                    <StatTile label="Attacks" value={stats.attacks} icon={Swords} color="text-rose-500 bg-rose-500" />
                    <StatTile label="Blocks" value={stats.blocks} icon={Shield} color="text-indigo-500 bg-indigo-500" />
                </div>

                {/* ACTIONS */}
                <div className="grid grid-cols-1 pt-2">
                    <Button 
                        onClick={() => { onClose(); onEdit(); }} 
                        className="bg-white/10 hover:bg-white/20 text-white border border-white/10"
                    >
                        <Edit2 size={16} /> Edit Profile
                    </Button>
                </div>

            </div>
        </Modal>,
        document.body
    );
};