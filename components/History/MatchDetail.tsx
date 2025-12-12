
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

interface MatchDetailProps {
  match: Match;
  onBack: () => void;
}

// --- SUB-COMPONENTS ---

const StatBar = ({ label, valueA, valueB, colorA, colorB, icon: Icon }: any) => {
    const total = valueA + valueB || 1;
    const percentA = Math.round((valueA / total) * 100);
    const percentB = Math.round((valueB / total) * 100);

    return (
        <div className="flex flex-col gap-1.5 w-full">
            {/* Header Row - Improved Layout to prevent overlapping */}
            <div className="flex items-center gap-2 px-0.5 w-full">
                <span className={`text-xs font-bold w-10 text-left tabular-nums ${colorA.text} ${colorA.textDark}`}>{valueA}</span>
                
                <div className="flex-1 flex items-center justify-center gap-1.5 min-w-0 overflow-hidden">
                    {Icon && <Icon size={12} className="flex-shrink-0 text-slate-400" />} 
                    <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider truncate">{label}</span>
                </div>
                
                <span className={`text-xs font-bold w-10 text-right tabular-nums ${colorB.text} ${colorB.textDark}`}>{valueB}</span>
            </div>

            {/* Bar */}
            <div className="flex h-1.5 w-full rounded-full overflow-hidden bg-slate-200 dark:bg-slate-800">
                <motion.div 
                    initial={{ width: 0 }} animate={{ width: `${percentA}%` }} 
                    className={`h-full ${colorA.halo}`} // Halo usually contains the solid bg class
                />
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
    
    // 1. Calculate the flow
    const dataPoints = useMemo(() => {
        let scoreA = 0;
        let scoreB = 0;
        const points = [{ x: 0, y: 0 }]; // Start at 0 diff

        // Filter only score events to ensure X-axis is accurate to points played
        const scoreEvents = actionLog.filter(l => l.type === 'POINT');
        
        scoreEvents.forEach((log, index) => {
            if (log.team === 'A') scoreA++;
            else scoreB++;
            
            // Y = Global Score Difference (A - B)
            points.push({ x: index + 1, y: scoreA - scoreB });
        });
        
        return points;
    }, [actionLog]);

    // 2. Calculate Set Markers (Vertical Lines)
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
        <div className="w-full h-32 flex items-center justify-center text-xs text-slate-400 italic bg-slate-50 dark:bg-white/5 rounded-3xl border border-dashed border-slate-200 dark:border-white/10 mt-4 mb-2">
            {t('stats.notEnoughData')}
        </div>
    );

    // Dimensions (Internal SVG Units)
    const SVG_W = 100;
    const SVG_H = 60;
    const PADDING_Y = 12; // Internal padding inside SVG for text clearance
    const GRAPH_H = SVG_H - (PADDING_Y * 2);
    
    // Scale Functions
    const maxVal = Math.max(...dataPoints.map(p => Math.abs(p.y)), 3); // Minimum range of 3
    const maxY = maxVal * 1.1; // Add 10% headroom to prevent clipping
    
    const totalPoints = dataPoints.length - 1;
    // Safety check for empty log but existing sets (legacy data issue prevention)
    const maxX = Math.max(totalPoints, setMarkers[setMarkers.length-1]?.xIndex || 1);

    const getX = (index: number) => (index / maxX) * SVG_W;
    
    // Map Y: +maxY -> PADDING_Y, -maxY -> SVG_H - PADDING_Y
    // 0 -> SVG_H / 2
    const midY = SVG_H / 2;
    const getY = (val: number) => midY - (val / maxY) * (GRAPH_H / 2);

    const pathD = `M ${dataPoints.map((p, i) => `${getX(i).toFixed(2)},${getY(p.y).toFixed(2)}`).join(' L ')}`;
    
    // Area paths
    const areaD = `${pathD} V ${midY} H ${getX(0)} Z`;

    return (
        <div className="w-full h-56 relative mt-4 mb-2 select-none flex flex-col justify-between py-1">
            
            {/* Floating Labels - Neo-Glass Pills */}
            <div className="absolute top-2 left-2 z-10 flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/90 dark:bg-black/60 backdrop-blur-md border border-black/5 dark:border-white/10 shadow-sm pointer-events-none">
                <div className="w-1.5 h-1.5 rounded-full" style={{ background: hexA }} />
                <span className="text-[9px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 leading-none">{t('stats.lead')}</span>
            </div>
            
            <div className="absolute bottom-2 left-2 z-10 flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/90 dark:bg-black/60 backdrop-blur-md border border-black/5 dark:border-white/10 shadow-sm pointer-events-none">
                <div className="w-1.5 h-1.5 rounded-full" style={{ background: hexB }} />
                <span className="text-[9px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 leading-none">{t('stats.lead')}</span>
            </div>
            
            <svg viewBox={`0 0 ${SVG_W} ${SVG_H}`} className="w-full h-full overflow-visible" preserveAspectRatio="none">
                
                {/* Defs for Gradients */}
                <defs>
                    <linearGradient id="gradientA" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={hexA} stopOpacity="0.4" />
                        <stop offset="100%" stopColor={hexA} stopOpacity="0" />
                    </linearGradient>
                    <linearGradient id="gradientB" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={hexB} stopOpacity="0" />
                        <stop offset="100%" stopColor={hexB} stopOpacity="0.4" />
                    </linearGradient>
                    <clipPath id="clipTop">
                        <rect x="0" y={0} width={SVG_W} height={midY} />
                    </clipPath>
                    <clipPath id="clipBottom">
                        <rect x="0" y={midY} width={SVG_W} height={midY} />
                    </clipPath>
                </defs>

                {/* Zero Line (Dotted) */}
                <line x1="0" y1={midY} x2={SVG_W} y2={midY} stroke="currentColor" strokeOpacity="0.1" strokeWidth="0.2" strokeDasharray="1 1" />

                {/* Fill Areas */}
                <g clipPath="url(#clipTop)">
                    <path d={`${areaD}`} fill="url(#gradientA)" />
                </g>
                <g clipPath="url(#clipBottom)">
                    <path d={`${areaD}`} fill="url(#gradientB)" />
                </g>

                {/* The Graph Line */}
                <motion.path 
                    d={pathD} 
                    fill="none" 
                    stroke="currentColor" 
                    strokeWidth="0.4" 
                    className="text-slate-500 dark:text-slate-400"
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{ duration: 1.5, ease: "easeInOut" }}
                />

                {/* Set Dividers & Labels */}
                {setMarkers.map((marker, idx) => {
                    const xPos = getX(marker.xIndex);
                    // Don't draw line for last set if it's at the very end
                    const isLast = idx === setMarkers.length - 1;
                    const prevX = idx === 0 ? 0 : getX(setMarkers[idx-1].xIndex);
                    const labelX = prevX + (xPos - prevX) / 2;

                    return (
                        <g key={`marker-${idx}`}>
                            {/* Vertical Line for End of Set */}
                            {!isLast && (
                                <line 
                                    x1={xPos} y1={PADDING_Y - 5} 
                                    x2={xPos} y2={SVG_H - (PADDING_Y - 5)} 
                                    stroke="currentColor" 
                                    strokeWidth="0.15" 
                                    strokeDasharray="0.5 0.5"
                                    className="text-slate-400 dark:text-slate-600 opacity-40"
                                />
                            )}
                            
                            {/* Set Label Centered in Segment at Top */}
                            {/* Backing pill for contrast */}
                            <rect 
                                x={labelX - 4} y={1} 
                                width={8} height={4} rx={2} 
                                className="text-white dark:text-slate-900 fill-current opacity-80" 
                            />
                            <text 
                                x={labelX} 
                                y={3.2} 
                                textAnchor="middle" 
                                fill={marker.winner === 'A' ? hexA : hexB}
                                className="text-[2.5px] font-black uppercase tracking-widest"
                                style={{ dominantBaseline: 'middle' }}
                            >
                                {marker.setLabel}
                            </text>
                        </g>
                    );
                })}

            </svg>
        </div>
    );
};

const TeamHero = ({ name, winner, isRight = false, theme }: { name: string, winner: boolean, isRight?: boolean, theme: any }) => {
    return (
        <div className={`flex flex-col justify-center ${isRight ? 'items-center md:items-end text-center md:text-right' : 'items-center md:items-start text-center md:text-left'} relative z-10 w-full min-w-0`}>
             <div className="flex items-center gap-2 max-w-full justify-center md:justify-start">
                 {winner && !isRight && <Crown size={18} className={`${theme.crown} drop-shadow-[0_0_10px_currentColor] flex-shrink-0`} />}
                 
                 <h2 className={`
                    text-xl sm:text-2xl md:text-3xl font-black uppercase tracking-tight leading-tight break-words
                    ${winner 
                        ? `${theme.text} ${theme.textDark} drop-shadow-[0_0_15px_currentColor]`
                        : 'text-slate-500 dark:text-slate-400'}
                 `}>
                    {name}
                 </h2>
                 
                 {winner && isRight && <Crown size={18} className={`${theme.crown} drop-shadow-[0_0_10px_currentColor] flex-shrink-0`} />}
             </div>
             {winner && (
                <div className={`h-1 rounded-full mt-2 w-12 ${theme.halo} shadow-[0_0_10px_currentColor]`} />
             )}
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
        <div className={`
            flex flex-col sm:flex-row sm:items-center gap-3 p-3 rounded-2xl mb-2 transition-all border
            ${isMVP ? 'bg-amber-500/10 border-amber-500/20' : 'bg-white dark:bg-white/5 border-black/5 dark:border-white/10'}
        `}>
            {/* Header Section: Rank + Name */}
            <div className="flex items-center gap-3 flex-1 min-w-0 w-full sm:w-auto">
                {/* Rank */}
                <div className={`
                    w-10 h-10 rounded-2xl flex items-center justify-center font-black text-sm flex-shrink-0 shadow-sm
                    ${isMVP ? 'bg-amber-500 text-amber-950 shadow-amber-500/20' : 'bg-slate-100 dark:bg-white/10 text-slate-500 dark:text-slate-400'}
                `}>
                    {isMVP ? <Crown size={16} fill="currentColor" /> : <span>#{rank}</span>}
                </div>

                {/* Name Info */}
                <div className="flex flex-col min-w-0">
                    <div className={`text-sm sm:text-base font-bold truncate leading-tight ${isMVP ? 'text-amber-700 dark:text-amber-300' : 'text-slate-800 dark:text-slate-200'}`}>
                        {stats.name}
                    </div>
                    <div className={`text-[10px] font-bold uppercase tracking-wider opacity-80 truncate ${teamColorClass}`}>
                        {stats.team === 'Unknown' ? 'Guest' : `Team ${stats.team}`}
                    </div>
                </div>
            </div>

            {/* Stats Section - Pills rounded-full */}
            <div className="flex items-center justify-end gap-2 flex-wrap sm:flex-nowrap pl-12 sm:pl-0 w-full sm:w-auto">
                
                {/* Attack Pill */}
                {stats.attack > 0 && (
                    <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full ${theme.bg} ${theme.text} ${theme.textDark} ${theme.border} border`} title="Kills">
                        <Swords size={12} strokeWidth={2.5} />
                        <span className="text-xs font-black">{stats.attack}</span>
                    </div>
                )}
                {/* Block Pill */}
                {stats.block > 0 && (
                    <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full ${theme.bg} ${theme.text} ${theme.textDark} ${theme.border} border`} title="Blocks">
                        <Shield size={12} strokeWidth={2.5} />
                        <span className="text-xs font-black">{stats.block}</span>
                    </div>
                )}
                {/* Ace Pill */}
                {stats.ace > 0 && (
                    <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full ${theme.bg} ${theme.text} ${theme.textDark} ${theme.border} border`} title="Aces">
                        <Target size={12} strokeWidth={2.5} />
                        <span className="text-xs font-black">{stats.ace}</span>
                    </div>
                )}
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

    // Parse Stats
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
                    
                    // Name Resolution
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
            .slice(0, 5);
    }, [stats]);

    return (
        <div className="flex flex-col h-full bg-slate-50 dark:bg-[#020617] overflow-hidden rounded-2xl border border-black/5 dark:border-white/5">
            
            {/* Header with Rounded Top */}
            <div className="px-4 py-3 flex items-center justify-between border-b border-black/5 dark:border-white/10 bg-white/50 dark:bg-[#020617]/50 backdrop-blur-xl z-20 rounded-t-2xl">
                <button 
                    onClick={onBack} 
                    className="flex items-center gap-2 text-slate-600 dark:text-slate-300 hover:text-indigo-500 font-bold text-sm transition-colors px-4 py-2 rounded-full hover:bg-black/5 dark:hover:bg-white/5"
                >
                    <ArrowLeft size={18} /> {t('common.back')}
                </button>
                <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                    <Activity size={14} /> {t('stats.matchAnalysis')}
                </div>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar p-4 pb-20 space-y-6">
                
                {/* 1. Scoreboard Card */}
                <div className="bg-white dark:bg-white/5 rounded-3xl p-6 border border-black/5 dark:border-white/10 shadow-sm relative overflow-hidden">
                    <div className="absolute inset-0 opacity-[0.03] bg-grid-slate-900/[0.1] dark:bg-grid-white/[0.05]" />
                    
                    {/* Teams & Score */}
                    <div className="flex flex-col md:flex-row items-center justify-between gap-6 relative z-10">
                        <TeamHero name={match.teamAName} winner={isWinnerA} theme={themeA} />
                        
                        <div className="flex flex-col items-center gap-2 min-w-[120px]">
                            <div className="text-5xl font-black tabular-nums tracking-tighter flex items-center gap-1 leading-none text-slate-800 dark:text-white">
                                <span className={isWinnerA ? 'opacity-100' : 'opacity-60'}>{match.setsA}</span>
                                <span className="text-slate-300 dark:text-slate-700 text-3xl">:</span>
                                <span className={isWinnerB ? 'opacity-100' : 'opacity-60'}>{match.setsB}</span>
                            </div>
                            <div className="px-4 py-1.5 bg-slate-100 dark:bg-white/10 rounded-full text-[10px] font-bold uppercase tracking-widest text-slate-500 border border-black/5 dark:border-white/5">
                                {t('stats.finalScore')}
                            </div>
                        </div>

                        <TeamHero name={match.teamBName} winner={isWinnerB} isRight theme={themeB} />
                    </div>
                </div>

                {/* 2. Detailed Timeline (Horizontal) */}
                {match.actionLog && match.actionLog.length > 0 && (
                    <MatchTimeline match={match} />
                )}

                {/* 3. Momentum Graph */}
                {match.actionLog && match.actionLog.length > 0 && (
                    <div className="bg-white dark:bg-white/5 rounded-3xl p-5 border border-black/5 dark:border-white/10 shadow-sm">
                        <div className="flex items-center gap-2 mb-2">
                            <TrendingUp size={16} className="text-indigo-500" />
                            <h3 className="text-xs font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">{t('stats.momentum')}</h3>
                        </div>
                        <MomentumChart actionLog={match.actionLog} sets={match.sets} hexA={hexA} hexB={hexB} />
                    </div>
                )}

                {/* 4. Team Comparison Stats */}
                {match.actionLog && (
                    <div className="bg-white dark:bg-white/5 rounded-3xl p-5 border border-black/5 dark:border-white/10 shadow-sm">
                        <div className="flex items-center gap-2 mb-6">
                            <BarChart2 size={16} className="text-indigo-500" />
                            <h3 className="text-xs font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">{t('stats.teamStats')}</h3>
                        </div>
                        
                        <div className="space-y-5">
                            <StatBar label={t('stats.attackPoints')} valueA={stats.a.attack} valueB={stats.b.attack} colorA={themeA} colorB={themeB} icon={Swords} />
                            <StatBar label={t('stats.killBlocks')} valueA={stats.a.block} valueB={stats.b.block} colorA={themeA} colorB={themeB} icon={Shield} />
                            <StatBar label={t('stats.serviceAces')} valueA={stats.a.ace} valueB={stats.b.ace} colorA={themeA} colorB={themeB} icon={Target} />
                            <StatBar label={t('stats.oppErrors')} valueA={stats.a.err} valueB={stats.b.err} colorA={themeA} colorB={themeB} icon={AlertTriangle} />
                        </div>
                    </div>
                )}

                {/* 5. Player Leaderboard */}
                {topPlayers.length > 0 && (
                    <div className="bg-white dark:bg-white/5 rounded-3xl p-5 border border-black/5 dark:border-white/10 shadow-sm">
                        <div className="flex items-center gap-2 mb-4">
                            <Crown size={16} className="text-amber-500" />
                            <h3 className="text-xs font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">{t('stats.topScorers')}</h3>
                        </div>
                        
                        <div className="flex flex-col">
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
                    </div>
                )}

            </div>
        </div>
    );
};
