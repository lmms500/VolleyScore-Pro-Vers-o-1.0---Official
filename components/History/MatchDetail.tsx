
import React, { useState, useMemo } from 'react';
import { Match } from '../../stores/historyStore';
import { Player, SkillType, SetHistory, TeamColor } from '../../types';
import { useTranslation } from '../../contexts/LanguageContext';
import { 
  ArrowLeft, Activity, Crown, BarChart2, Zap, TrendingUp, Shield, Swords, Target, AlertTriangle
} from 'lucide-react';
import { motion } from 'framer-motion';
import { resolveTheme, getHexFromColor } from '../../utils/colors';
import { MatchTimeline } from './MatchTimeline';
import { staggerContainer, staggerItem } from '../../utils/animations';

interface MatchDetailProps {
  match: Match;
  onBack: () => void;
}

const StatBar = ({ label, valueA, valueB, colorA, colorB, icon: Icon }: any) => {
    const total = valueA + valueB || 1;
    const percentA = Math.round((valueA / total) * 100);
    const percentB = Math.round((valueB / total) * 100);

    return (
        <div className="flex flex-col gap-1 w-full mb-3 last:mb-0">
            <div className="flex items-center justify-between px-0 w-full text-[10px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                <span className={`font-black tabular-nums text-xs ${colorA.text} ${colorA.textDark}`}>{valueA}</span>
                <div className="flex items-center gap-1.5 opacity-80">
                    {Icon && <Icon size={10} />} 
                    <span>{label}</span>
                </div>
                <span className={`font-black tabular-nums text-xs ${colorB.text} ${colorB.textDark}`}>{valueB}</span>
            </div>

            <div className="flex h-1.5 w-full rounded-full overflow-hidden bg-slate-100 dark:bg-white/5">
                <motion.div 
                    initial={{ width: 0 }} animate={{ width: `${percentA}%` }} 
                    className={`h-full ${colorA.halo}`} 
                />
                <div className="w-px bg-transparent" /> 
                <motion.div 
                    initial={{ width: 0 }} animate={{ width: `${percentB}%` }} 
                    className={`h-full ${colorB.halo}`} 
                />
            </div>
        </div>
    );
};

const MomentumChart = ({ actionLog, sets, hexA, hexB }: { actionLog: any[], sets: SetHistory[], hexA: string, hexB: string }) => {
    const { t } = useTranslation();
    
    const dataPoints = useMemo(() => {
        let scoreA = 0;
        let scoreB = 0;
        const points = [{ x: 0, y: 0 }];

        const scoreEvents = actionLog.filter(l => l.type === 'POINT');
        
        scoreEvents.forEach((log, index) => {
            if (log.team === 'A') scoreA++;
            else scoreB++;
            
            points.push({ x: index + 1, y: scoreA - scoreB });
        });
        
        return points;
    }, [actionLog]);

    const setMarkers = useMemo(() => {
        let cumulativePoints = 0;
        return sets.map((set, i) => {
            const pointsInSet = set.scoreA + set.scoreB;
            cumulativePoints += pointsInSet;
            return {
                setLabel: `S${set.setNumber}`,
                xIndex: cumulativePoints,
                winner: set.winner
            };
        });
    }, [sets]);

    if (dataPoints.length < 2) return (
        <div className="w-full h-32 flex items-center justify-center text-[10px] text-slate-400 italic bg-slate-50/50 dark:bg-white/[0.02] rounded-xl border border-dashed border-slate-200 dark:border-white/10 my-2">
            {t('stats.notEnoughData')}
        </div>
    );

    const SVG_W = 100;
    const SVG_H = 50; 
    const PADDING_Y = 8;
    const GRAPH_H = SVG_H - (PADDING_Y * 2);
    
    const maxVal = Math.max(...dataPoints.map(p => Math.abs(p.y)), 3); 
    const maxY = maxVal * 1.1; 
    
    const totalPoints = dataPoints.length - 1;
    const maxX = Math.max(totalPoints, setMarkers[setMarkers.length-1]?.xIndex || 1);

    const getX = (index: number) => (index / maxX) * SVG_W;
    const midY = SVG_H / 2;
    const getY = (val: number) => midY - (val / maxY) * (GRAPH_H / 2);

    const pathD = `M ${dataPoints.map((p, i) => `${getX(i).toFixed(2)},${getY(p.y).toFixed(2)}`).join(' L ')}`;
    const areaD = `${pathD} V ${midY} H ${getX(0)} Z`;

    return (
        <div className="w-full h-40 relative my-2 select-none">
            <svg viewBox={`0 0 ${SVG_W} ${SVG_H}`} className="w-full h-full overflow-visible" preserveAspectRatio="none">
                <defs>
                    <linearGradient id="gradientA" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={hexA} stopOpacity="0.4" />
                        <stop offset="100%" stopColor={hexA} stopOpacity="0" />
                    </linearGradient>
                    <linearGradient id="gradientB" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={hexB} stopOpacity="0" />
                        <stop offset="100%" stopColor={hexB} stopOpacity="0.4" />
                    </linearGradient>
                    <clipPath id="clipTop"><rect x="0" y={0} width={SVG_W} height={midY} /></clipPath>
                    <clipPath id="clipBottom"><rect x="0" y={midY} width={SVG_W} height={midY} /></clipPath>
                </defs>

                <line x1="0" y1={midY} x2={SVG_W} y2={midY} stroke="currentColor" strokeOpacity="0.1" strokeWidth="0.2" strokeDasharray="1 1" />

                <g clipPath="url(#clipTop)"><path d={`${areaD}`} fill="url(#gradientA)" /></g>
                <g clipPath="url(#clipBottom)"><path d={`${areaD}`} fill="url(#gradientB)" /></g>

                <motion.path 
                    d={pathD} fill="none" stroke="currentColor" strokeWidth="0.4" className="text-slate-500 dark:text-slate-400"
                    initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.5, ease: "easeInOut" }}
                />

                {setMarkers.map((marker, idx) => {
                    const xPos = getX(marker.xIndex);
                    const isLast = idx === setMarkers.length - 1;
                    const prevX = idx === 0 ? 0 : getX(setMarkers[idx-1].xIndex);
                    const labelX = prevX + (xPos - prevX) / 2;

                    return (
                        <g key={`marker-${idx}`}>
                            {!isLast && (
                                <line 
                                    x1={xPos} y1={PADDING_Y - 2} x2={xPos} y2={SVG_H - (PADDING_Y - 2)} 
                                    stroke="currentColor" strokeWidth="0.1" strokeDasharray="0.5 0.5" className="text-slate-400 dark:text-slate-600 opacity-40"
                                />
                            )}
                            <text x={labelX} y={4} textAnchor="middle" fill={marker.winner === 'A' ? hexA : hexB} className="text-[2px] font-black uppercase tracking-widest" style={{ dominantBaseline: 'middle' }}>{marker.setLabel}</text>
                        </g>
                    );
                })}
            </svg>
        </div>
    );
};

const TeamHero = ({ name, winner, isRight = false, theme }: { name: string, winner: boolean, isRight?: boolean, theme: any }) => {
    return (
        <div className={`flex flex-col justify-center ${isRight ? 'items-end text-right' : 'items-start text-left'} relative z-10 w-full min-w-0`}>
             <div className={`flex items-center gap-2 max-w-full ${isRight ? 'flex-row-reverse' : 'flex-row'}`}>
                 {winner && <Crown size={14} className={`${theme.crown} drop-shadow-[0_0_5px_currentColor] flex-shrink-0`} />}
                 <h2 className={`text-lg sm:text-xl font-black uppercase tracking-tight leading-tight truncate ${winner ? `${theme.text} ${theme.textDark}` : 'text-slate-500 dark:text-slate-400'}`}>
                    {name}
                 </h2>
             </div>
             {winner && <div className={`h-1 rounded-full mt-1 w-8 ${theme.halo}`} />}
        </div>
    );
};

interface CalculatedStat {
    id: string;
    name: string;
    team: 'A' | 'B' | 'Unknown';
    skillLevel: number;
    total: number;
    attack: number;
    block: number;
    ace: number;
}

const PlayerStatRow: React.FC<{ stats: CalculatedStat, isMVP: boolean, rank: number, themeA: any, themeB: any }> = ({ stats, isMVP, rank, themeA, themeB }) => {
    if (stats.total === 0) return null;

    const theme = stats.team === 'A' ? themeA : (stats.team === 'B' ? themeB : { text: 'text-slate-400', textDark: 'text-slate-400', bg: 'bg-slate-500/10', border: 'border-slate-500/20' });
    const teamColorClass = `${theme.text} ${theme.textDark}`;
    
    return (
        <div className="flex items-center justify-between py-2 border-b border-black/5 dark:border-white/5 last:border-0 w-full">
            <div className="flex items-center gap-3 min-w-0 flex-1">
                <div className={`w-5 text-center font-bold text-xs ${isMVP ? 'text-amber-500' : 'text-slate-400 dark:text-slate-500'}`}>
                    {isMVP ? <Crown size={14} className="mx-auto" /> : rank}
                </div>
                
                <div className="flex flex-col min-w-0">
                    <span className={`text-xs font-bold truncate ${isMVP ? 'text-amber-600 dark:text-amber-400' : 'text-slate-700 dark:text-slate-200'}`}>
                        {stats.name}
                    </span>
                    <span className={`text-[9px] font-bold uppercase tracking-wide opacity-80 ${teamColorClass}`}>
                        {stats.team === 'Unknown' ? 'Guest' : `Team ${stats.team}`}
                    </span>
                </div>
            </div>

            <div className="flex items-center gap-1.5">
                {stats.attack > 0 && (
                    <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-100 dark:bg-white/5 border border-black/5 dark:border-white/5" title="Kills">
                        <Swords size={10} className="text-rose-500" />
                        <span className="text-[10px] font-bold tabular-nums text-slate-600 dark:text-slate-300">{stats.attack}</span>
                    </div>
                )}
                {stats.block > 0 && (
                    <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-100 dark:bg-white/5 border border-black/5 dark:border-white/5" title="Blocks">
                        <Shield size={10} className="text-indigo-500" />
                        <span className="text-[10px] font-bold tabular-nums text-slate-600 dark:text-slate-300">{stats.block}</span>
                    </div>
                )}
                {stats.ace > 0 && (
                    <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-100 dark:bg-white/5 border border-black/5 dark:border-white/5" title="Aces">
                        <Target size={10} className="text-emerald-500" />
                        <span className="text-[10px] font-bold tabular-nums text-slate-600 dark:text-slate-300">{stats.ace}</span>
                    </div>
                )}
                
                <div className="w-8 text-right font-black text-sm tabular-nums text-slate-800 dark:text-white">
                    {stats.total}
                </div>
            </div>
        </div>
    );
};

export const MatchDetail: React.FC<MatchDetailProps> = ({ match, onBack }) => {
    const { t } = useTranslation();
    
    const themeA = resolveTheme(match.teamARoster?.color || 'indigo');
    const themeB = resolveTheme(match.teamBRoster?.color || 'rose');
    
    const hexA = getHexFromColor(match.teamARoster?.color || 'indigo');
    const hexB = getHexFromColor(match.teamBRoster?.color || 'rose');

    const isWinnerA = match.winner === 'A';
    const isWinnerB = match.winner === 'B';

    const stats = useMemo(() => {
        const s = {
            a: { attack: 0, block: 0, ace: 0, err: 0, total: 0 },
            b: { attack: 0, block: 0, ace: 0, err: 0, total: 0 },
            players: new Map<string, CalculatedStat>()
        };

        if (!match.actionLog) return s;

        match.actionLog.forEach((log: any) => {
            if (log.type === 'POINT') {
                const isA = log.team === 'A';
                const teamStats = isA ? s.a : s.b;
                
                teamStats.total++;
                if (log.skill === 'attack') teamStats.attack++;
                else if (log.skill === 'block') teamStats.block++;
                else if (log.skill === 'ace') teamStats.ace++;
                else if (log.skill === 'opponent_error') teamStats.err++;

                if (log.playerId && log.playerId !== 'unknown') {
                    const pStats = s.players.get(log.playerId) || { 
                        id: log.playerId, name: 'Unknown', team: log.team, 
                        skillLevel: 5, total: 0, attack: 0, block: 0, ace: 0 
                    };
                    
                    if (pStats.name === 'Unknown') {
                        const pA = match.teamARoster?.players.find(p => p.id === log.playerId) || match.teamARoster?.reserves?.find(p => p.id === log.playerId);
                        const pB = match.teamBRoster?.players.find(p => p.id === log.playerId) || match.teamBRoster?.reserves?.find(p => p.id === log.playerId);
                        if (pA) { pStats.name = pA.name; pStats.team = 'A'; }
                        else if (pB) { pStats.name = pB.name; pStats.team = 'B'; }
                    }

                    pStats.total++;
                    if (log.skill === 'attack') pStats.attack++;
                    else if (log.skill === 'block') pStats.block++;
                    else if (log.skill === 'ace') pStats.ace++;
                    
                    s.players.set(log.playerId, pStats);
                }
            }
        });
        return s;
    }, [match]);

    const topPlayers = useMemo(() => {
        return (Array.from(stats.players.values()) as CalculatedStat[])
            .sort((a, b) => b.total - a.total)
            .slice(0, 8); 
    }, [stats]);

    return (
        <div className="flex flex-col h-full bg-transparent overflow-hidden relative">
            
            <div className="px-4 py-4 landscape:py-2 flex items-center justify-between shrink-0">
                <button 
                    onClick={onBack} 
                    className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300 hover:text-indigo-500 font-bold text-xs uppercase tracking-wider transition-colors px-3 py-2 rounded-full hover:bg-black/5 dark:hover:bg-white/10"
                >
                    <ArrowLeft size={16} /> {t('common.back')}
                </button>
                <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                    <Activity size={14} /> {t('stats.matchAnalysis')}
                </div>
            </div>

            {/* SPLIT VIEW Container for Landscape */}
            <motion.div 
                className="flex-1 overflow-y-auto custom-scrollbar px-4 pb-safe-bottom space-y-6 landscape:grid landscape:grid-cols-2 landscape:gap-6 landscape:space-y-0"
                variants={staggerContainer}
                initial="hidden"
                animate="visible"
            >
                
                {/* LEFT COLUMN: Hero Scoreboard + Key Stats */}
                <div className="flex flex-col gap-6 landscape:sticky landscape:top-0 landscape:h-fit">
                    <motion.div variants={staggerItem} className="bg-white/60 dark:bg-white/[0.03] rounded-3xl p-5 border border-white/40 dark:border-white/5 shadow-sm backdrop-blur-md relative overflow-hidden">
                        <div className="absolute inset-0 opacity-[0.03] bg-grid-slate-900/[0.1] dark:bg-grid-white/[0.05] pointer-events-none" />
                        
                        <div className="flex items-center justify-between gap-4 relative z-10">
                            <TeamHero name={match.teamAName} winner={isWinnerA} theme={themeA} />
                            
                            <div className="flex flex-col items-center gap-1 min-w-[80px]">
                                <div className="text-4xl sm:text-5xl font-black tabular-nums tracking-tighter flex items-center gap-1 leading-none text-slate-800 dark:text-white drop-shadow-sm">
                                    <span className={isWinnerA ? 'opacity-100' : 'opacity-50'}>{match.setsA}</span>
                                    <span className="text-slate-300 dark:text-slate-600 text-2xl mx-1">:</span>
                                    <span className={isWinnerB ? 'opacity-100' : 'opacity-50'}>{match.setsB}</span>
                                </div>
                                <span className="text-[9px] font-bold uppercase tracking-widest text-slate-400">Final</span>
                            </div>

                            <TeamHero name={match.teamBName} winner={isWinnerB} isRight theme={themeB} />
                        </div>
                    </motion.div>

                    {match.actionLog && (
                        <motion.div variants={staggerItem}>
                            <div className="flex items-center gap-2 mb-3 px-1">
                                <BarChart2 size={14} className="text-indigo-500" />
                                <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">{t('stats.teamStats')}</h3>
                            </div>
                            
                            <div className="flex flex-col gap-1 w-full">
                                <StatBar label={t('stats.attackPoints')} valueA={stats.a.attack} valueB={stats.b.attack} colorA={themeA} colorB={themeB} icon={Swords} />
                                <StatBar label={t('stats.killBlocks')} valueA={stats.a.block} valueB={stats.b.block} colorA={themeA} colorB={themeB} icon={Shield} />
                                <StatBar label={t('stats.serviceAces')} valueA={stats.a.ace} valueB={stats.b.ace} colorA={themeA} colorB={themeB} icon={Target} />
                                <StatBar label={t('stats.oppErrors')} valueA={stats.a.err} valueB={stats.b.err} colorA={themeA} colorB={themeB} icon={AlertTriangle} />
                            </div>
                        </motion.div>
                    )}
                </div>

                {/* RIGHT COLUMN: Timeline & Detailed Logs */}
                <div className="flex flex-col gap-6">
                    {match.actionLog && match.actionLog.length > 0 && (
                        <motion.div variants={staggerItem} className="-mx-2">
                            <MatchTimeline match={match} />
                        </motion.div>
                    )}

                    {match.actionLog && match.actionLog.length > 0 && (
                        <motion.div variants={staggerItem}>
                            <div className="flex items-center gap-2 mb-1 px-1">
                                <TrendingUp size={14} className="text-indigo-500" />
                                <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">{t('stats.momentum')}</h3>
                            </div>
                            <MomentumChart actionLog={match.actionLog} sets={match.sets} hexA={hexA} hexB={hexB} />
                        </motion.div>
                    )}

                    {topPlayers.length > 0 && (
                        <motion.div variants={staggerItem} className="pb-8">
                            <div className="flex items-center gap-2 mb-3 px-1">
                                <Crown size={14} className="text-amber-500" />
                                <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">{t('stats.topScorers')}</h3>
                            </div>
                            
                            <div className="flex flex-col w-full">
                                {topPlayers.map((p, i) => (
                                    <PlayerStatRow 
                                        key={p.id} 
                                        stats={p} 
                                        rank={i + 1} 
                                        isMVP={i === 0} 
                                        themeA={themeA} 
                                        themeB={themeB} 
                                    />
                                ))}
                            </div>
                        </motion.div>
                    )}
                </div>

            </motion.div>
        </div>
    );
};
