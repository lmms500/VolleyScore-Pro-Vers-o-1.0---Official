
import React, { useMemo, useState } from 'react';
import { Modal } from '../ui/Modal';
import { useHistoryStore } from '../../stores/historyStore';
import { Trophy, Activity, Target, TrendingUp, Search } from 'lucide-react';
import { useTranslation } from '../../contexts/LanguageContext';
import { Team } from '../../types';

interface TeamStatsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface TeamAggregate {
    id: string; // Normalized Name Key
    name: string; // Display Name
    matches: number;
    wins: number;
    losses: number;
    winRate: number;
    setsWon: number;
    setsLost: number;
    pointsScored: number;
    pointsConceded: number;
}

const StatCard = ({ title, value, sub, icon: Icon, colorClass }: any) => (
    <div className="bg-slate-50 dark:bg-white/5 rounded-2xl p-3 flex flex-col items-center justify-center text-center border border-black/5 dark:border-white/5 h-full">
        <div className={`p-2 rounded-full mb-1 bg-opacity-10 ${colorClass}`}>
            <Icon size={16} className={colorClass.replace('bg-', 'text-').replace('/10', '')} />
        </div>
        <span className="text-lg font-black text-slate-800 dark:text-white leading-none tabular-nums">{value}</span>
        <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 mt-1">{title}</span>
        {sub && <span className="text-[9px] font-medium text-slate-400 opacity-70 mt-0.5">{sub}</span>}
    </div>
);

export const TeamStatsModal: React.FC<TeamStatsModalProps> = ({ isOpen, onClose }) => {
    const { matches } = useHistoryStore();
    const [searchTerm, setSearchTerm] = useState('');
    const { t } = useTranslation();

    const stats = useMemo(() => {
        const teamMap = new Map<string, TeamAggregate>();

        // Aggregation Strategy: Normalize by Name to merge sessions
        const resolveKey = (name: string) => {
            return name.trim().toLowerCase();
        };

        const initTeam = (key: string, displayName: string) => {
            if (!teamMap.has(key)) {
                teamMap.set(key, {
                    id: key,
                    name: displayName.trim(), 
                    matches: 0, wins: 0, losses: 0, winRate: 0,
                    setsWon: 0, setsLost: 0, pointsScored: 0, pointsConceded: 0
                });
            }
            return teamMap.get(key)!;
        };

        matches.forEach(match => {
            const keyA = resolveKey(match.teamAName);
            const keyB = resolveKey(match.teamBName);

            // Init using the current match's display name
            const teamA = initTeam(keyA, match.teamAName);
            const teamB = initTeam(keyB, match.teamBName);

            teamA.matches++;
            teamB.matches++;

            // Sets
            teamA.setsWon += match.setsA;
            teamA.setsLost += match.setsB;
            teamB.setsWon += match.setsB;
            teamB.setsLost += match.setsA;

            // Points
            match.sets.forEach(s => {
                teamA.pointsScored += s.scoreA;
                teamA.pointsConceded += s.scoreB;
                teamB.pointsScored += s.scoreB;
                teamB.pointsConceded += s.scoreA;
            });

            // Winner
            if (match.winner === 'A') {
                teamA.wins++;
                teamB.losses++;
            } else if (match.winner === 'B') {
                teamB.wins++;
                teamA.losses++;
            }
        });

        // Calculate Win Rates and sort
        return Array.from(teamMap.values()).map(t => ({
            ...t,
            winRate: t.matches > 0 ? Math.round((t.wins / t.matches) * 100) : 0
        })).sort((a, b) => b.matches - a.matches || b.winRate - a.winRate);

    }, [matches]);

    const filteredStats = useMemo(() => {
        return stats.filter(s => s.name.toLowerCase().includes(searchTerm.toLowerCase()));
    }, [stats, searchTerm]);

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={t('stats.teamStats')} maxWidth="max-w-2xl">
            <div className="flex flex-col h-[70vh]">
                {/* Search Bar with invisible container background */}
                <div className="mb-4 sticky top-0 z-10 py-1">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                        <input 
                            type="text" 
                            placeholder={t('historyList.searchPlaceholder')}
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full bg-slate-100 dark:bg-white/5 border border-transparent focus:border-indigo-500 rounded-xl pl-10 pr-4 py-3 text-sm font-bold text-slate-800 dark:text-white outline-none transition-all placeholder:text-slate-400"
                        />
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar space-y-3 pb-4 px-1">
                    {filteredStats.length === 0 ? (
                        <div className="text-center py-12 text-slate-400 italic text-sm flex flex-col items-center gap-2">
                            <Trophy size={32} className="opacity-20" />
                            {stats.length === 0 ? t('historyList.empty') : t('teamManager.profiles.noMatch', {term: searchTerm})}
                        </div>
                    ) : (
                        filteredStats.map((team) => (
                            <div key={team.id} className="bg-white dark:bg-white/5 rounded-2xl p-4 border border-black/5 dark:border-white/5 shadow-sm">
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="text-base sm:text-lg font-black text-slate-800 dark:text-white uppercase tracking-tight truncate max-w-[70%]">{team.name}</h3>
                                    <div className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${team.winRate >= 50 ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-rose-500/10 text-rose-600 dark:text-rose-400'}`}>
                                        {team.winRate}% Win Rate
                                    </div>
                                </div>
                                
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                    <StatCard 
                                        title={t('stats.matches')}
                                        value={team.matches} 
                                        sub={`${team.wins}W - ${team.losses}L`}
                                        icon={Trophy} 
                                        colorClass="bg-amber-500 text-amber-500" 
                                    />
                                    <StatCard 
                                        title={t('stats.sets')}
                                        value={team.setsWon + team.setsLost} 
                                        sub={`${team.setsWon}W - ${team.setsLost}L`}
                                        icon={Activity} 
                                        colorClass="bg-indigo-500 text-indigo-500" 
                                    />
                                    <StatCard 
                                        title={t('stats.points')} 
                                        value={team.pointsScored} 
                                        sub={`Avg ${Math.round(team.pointsScored / (team.matches || 1))}`}
                                        icon={Target} 
                                        colorClass="bg-emerald-500 text-emerald-500" 
                                    />
                                    <StatCard 
                                        title={t('stats.conceded')}
                                        value={team.pointsConceded} 
                                        sub={`Diff ${team.pointsScored - team.pointsConceded > 0 ? '+' : ''}${team.pointsScored - team.pointsConceded}`}
                                        icon={TrendingUp} 
                                        colorClass="bg-rose-500 text-rose-500" 
                                    />
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </Modal>
    );
};
