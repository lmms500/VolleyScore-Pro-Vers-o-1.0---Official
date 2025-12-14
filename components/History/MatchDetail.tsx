
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

// --- SUB-COMPONENTS ---

const StatBar = ({ label, valueA, valueB, colorA, colorB, icon: Icon }: any) => {
    const total = valueA + valueB || 1;
    const percentA = Math.round((valueA / total) * 100);
    const percentB = Math.round((valueB / total) * 100);

    return (
        <div className="flex flex-col gap-2 w-full mb-2">
            {/* Header Row - Improved Layout to prevent overlapping */}
            <div className="flex items-center gap-4 px-1 w-full">
                <span className={`text-sm font-black w-12 text-left tabular-nums ${colorA.text} ${colorA.textDark}`}>{valueA}</span>
                
                <div className="flex-1 flex items-center justify-center gap-2 min-w-0 overflow-hidden">
                    {Icon && <Icon size={14} className="flex-shrink-0 text-slate-400" />} 
                    <span className="text-[10px] uppercase font-bold text-slate-500 tracking-widest truncate">{label}</span>
                </div>
                
                <span className={`text-sm font-black w-12 text-right tabular-nums ${colorB.text} ${colorB.textDark}`}>{valueB}</span>
            </div>

            {/* Bar - Taller */}
            <div className="flex h-2 w-full rounded-full overflow-hidden bg-slate-100 dark:bg-slate-800">
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
        <div className="w-full h-40 flex items-center justify-center text-xs text-slate-400 italic bg-slate-50 dark:bg-white/5 rounded-[2rem] border border-dashed border-slate-200 dark:border-white/10 mt-6 mb-4">
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
        <div className="w-full h-64 relative mt-6 mb-4 select-none flex flex-col justify-between py-1">
            
            {/* Floating Labels - Neo-Glass Pills */}
            <div className="absolute top-2 left-2 z-10 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/90 dark:bg-black/60 backdrop-blur-md border border-black/5 dark:border-white/10 shadow-sm pointer-events-none">
                <div className="w-2 h-2 rounded-full" style={{ background: hexA }} />
                <span className="text-[9px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 leading-none">{t('stats.lead')}</span>
            </div>
            
            <div className="absolute bottom-2 left-2 z-10 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/90 dark:bg-black/60 backdrop-blur-md border border-black/5 dark:border-white/10 shadow-sm pointer-events-none">
                <div className="w-2 h-2 rounded-full" style={{ background: hexB }} />
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
             <div className="flex items-center gap-3 max-w-full justify-center md:justify-start">
                 {winner && !isRight && <Crown size={24} className={`${theme.crown} drop-shadow-[0_0_10px_currentColor] flex-shrink-0`} />}
                 
                 <h2 className={`
                    text-xl sm:text-2xl md:text-4xl font-black uppercase tracking-tight leading-tight break-words
                    ${winner 
                        ? `${theme.text} ${theme.textDark} drop-shadow-[0_0_15px_currentColor]`
                        : 'text-slate-500 dark:text-slate-400'}
                 `}>
                    {name}
                 </h2>
                 
                 {winner && isRight && <Crown size={24} className={`${theme.crown} drop-shadow-[0_0_10px_currentColor] flex-shrink-0`} />}
             </div>
             {winner && (
                <div className={`h-1.5 rounded-full mt-3 w-16 ${theme.halo} shadow-[0_0_10px_currentColor]`} />
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
            flex flex-col sm:flex-row sm:items-center gap-4 p-4 rounded-3xl mb-3 transition-all border
            ${isMVP ? 'bg-amber-500/10 border-amber-500/20' : 'bg-white dark:bg-white/5 border-black/5 dark:border-white/10'}
        `}>
            {/* Header Section: Rank + Name */}
            <div className="flex items-center gap-4 flex-1 min-w-0 w-full sm:w-auto">
                {/* Rank */}
                <div className={`
                    w-12 h-12 rounded-2xl flex items-center justify-center font-black text-lg flex-shrink-0 shadow-sm
                    ${isMVP ? 'bg-amber-500 text-amber-950 shadow-amber-500/20' : 'bg-slate-100 dark:bg-white/10 text-slate-500 dark:text-slate-400'}
                `}>
                    {isMVP ? <Crown size={20} fill="currentColor" /> : <span>#{rank}</span>}
                </div>

                {/* Name Info */}
                <div className="flex flex-col min-w-0">
                    <div className={`text-base sm:text-lg font-bold truncate leading-tight ${isMVP ? 'text-amber-700 dark:text-amber-300' : 'text-slate-800 dark:text-slate-200'}`}>
                        {stats.name}
                    </div>
                    <div className={`text-[10px] font-bold uppercase tracking-wider opacity-80 truncate ${teamColorClass} mt-0.5`}>
                        {stats.team === 'Unknown' ? 'Guest' : `Team ${stats.team}`}
                    </div>
                </div>
            </div>

            {/* Stats Section - Pills rounded-full */}
            <div className="flex items-center justify-end gap-2 flex-wrap sm:flex-nowrap pl-16 sm:pl-0 w-full sm:w-auto">
                
                {/* Attack Pill */}
                {stats.attack > 0 && (
                    <div className={`flex items-center gap-2 px-4 py-2 rounded-xl ${theme.bg} ${theme.text} ${theme.textDark} ${theme.border} border`} title="Kills">
                        <Swords size={14} strokeWidth={2.5} />
                        <span className="text-sm font-black">{stats.attack}</span>
                    </div>
                )}
                {/* Block Pill */}
                {stats.block > 0 && (
                    <div className={`flex items-center gap-2 px-4 py-2 rounded-xl ${theme.bg} ${theme.text} ${theme.textDark} ${theme.border} border`} title="Blocks">
                        <Shield size={14} strokeWidth={2.5} />
                        <span className="text-sm font-black">{stats.block}</span>
                    </div>
                )}
                {/* Ace Pill */}
                {stats.ace > 0 && (
                    <div className={`flex items-center gap-2 px-4 py-2 rounded-xl ${theme.bg} ${theme.text} ${theme.textDark} ${theme.border} border`} title="Aces">
                        <Target size={14} strokeWidth={2.5} />
                        <span className="text-sm font-black">{stats.ace}</span>
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

    // Neo-Glass Card Style
    const cardClass = "bg-white/60 dark:bg-white/[0.03] rounded-[2.5rem] p-8 border border-white/40 dark:border-white/5 shadow-xl backdrop-blur-2xl relative overflow-hidden";

    return (
        <div className="flex flex-col h-full bg-slate-50 dark:bg-[#020617] overflow-hidden rounded-[2.5rem] border border-black/5 dark:border-white/5 relative">
            
            {/* Background Texture */}
            <div className="absolute inset-0 opacity-[0.015] pointer-events-none mix-blend-overlay" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")` }} />

            {/* Header */}
            <div className="px-8 pt-8 pb-4 flex items-center justify-between z-20">
                <button 
                    onClick={onBack} 
                    className="flex items-center gap-2 text-slate-600 dark:text-slate-300 hover:text-indigo-500 font-bold text-xs uppercase tracking-wider transition-colors px-5 py-3 rounded-full bg-white/50 dark:bg-white/5 border border-black/5 dark:border-white/10 backdrop-blur-md"
                >
                    <ArrowLeft size={18} /> {t('common.back')}
                </button>
                <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                    <Activity size={14} /> {t('stats.matchAnalysis')}
                </div>
            </div>

            <motion.div 
                className="flex-1 overflow-y-auto custom-scrollbar p-6 pb-24 space-y-8"
                variants={staggerContainer}
                initial="hidden"
                animate="visible"
            >
                
                {/* 1. Scoreboard Card */}
                <motion.div variants={staggerItem} className={cardClass}>
                    <div className="absolute inset-0 opacity-[0.03] bg-grid-slate-900/[0.1] dark:bg-grid-white/[0.05]" />
                    
                    {/* Teams & Score */}
                    <div className="flex flex-col md:flex-row items-center justify-between gap-8 relative z-10">
                        <TeamHero name={match.teamAName} winner={isWinnerA} theme={themeA} />
                        
                        <div className="flex flex-col items-center gap-3 min-w-[140px]">
                            <div className="text-6xl font-black tabular-nums tracking-tighter flex items-center gap-2 leading-none text-slate-800 dark:text-white drop-shadow-sm">
                                <span className={isWinnerA ? 'opacity-100' : 'opacity-60'}>{match.setsA}</span>
                                <span className="text-slate-300 dark:text-slate-700 text-4xl">:</span>
                                <span className={isWinnerB ? 'opacity-100' : 'opacity-60'}>{match.setsB}</span>
                            </div>
                            <div className="px-5 py-2 bg-slate-100/50 dark:bg-white/5 rounded-full text-[10px] font-black uppercase tracking-widest text-slate-500 border border-black/5 dark:border-white/5 backdrop-blur-sm">
                                {t('stats.finalScore')}
                            </div>
                        </div>

                        <TeamHero name={match.teamBName} winner={isWinnerB} isRight theme={themeB} />
                    </div>
                </motion.div>

                {/* 2. Detailed Timeline (Horizontal) */}
                {match.actionLog && match.actionLog.length > 0 && (
                    <motion.div variants={staggerItem}>
                        <MatchTimeline match={match} />
                    </motion.div>
                )}

                {/* 3. Momentum Graph */}
                {match.actionLog && match.actionLog.length > 0 && (
                    <motion.div variants={staggerItem} className={cardClass}>
                        <div className="flex items-center gap-3 mb-4">
                            <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-500">
                                <TrendingUp size={20} />
                            </div>
                            <h3 className="text-sm font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">{t('stats.momentum')}</h3>
                        </div>
                        <MomentumChart actionLog={match.actionLog} sets={match.sets} hexA={hexA} hexB={hexB} />
                    </motion.div>
                )}

                {/* 4. Team Comparison Stats */}
                {match.actionLog && (
                    <motion.div variants={staggerItem} className={cardClass}>
                        <div className="flex items-center gap-3 mb-8">
                            <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-500">
                                <BarChart2 size={20} />
                            </div>
                            <h3 className="text-sm font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">{t('stats.teamStats')}</h3>
                        </div>
                        
                        <div className="space-y-6">
                            <StatBar label={t('stats.attackPoints')} valueA={stats.a.attack} valueB={stats.b.attack} colorA={themeA} colorB={themeB} icon={Swords} />
                            <StatBar label={t('stats.killBlocks')} valueA={stats.a.block} valueB={stats.b.block} colorA={themeA} colorB={themeB} icon={Shield} />
                            <StatBar label={t('stats.serviceAces')} valueA={stats.a.ace} valueB={stats.b.ace} colorA={themeA} colorB={themeB} icon={Target} />
                            <StatBar label={t('stats.oppErrors')} valueA={stats.a.err} valueB={stats.b.err} colorA={themeA} colorB={themeB} icon={AlertTriangle} />
                        </div>
                    </motion.div>
                )}

                {/* 5. Player Leaderboard */}
                {topPlayers.length > 0 && (
                    <motion.div variants={staggerItem} className={cardClass}>
                        <div className="flex items-center gap-3 mb-6">
                            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-500">
                                <Crown size={20} />
                            </div>
                            <h3 className="text-sm font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">{t('stats.topScorers')}</h3>
                        </div>
                        
                        <div className="flex flex-col gap-2">
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

            </motion.div>
        </div>
    );
};
