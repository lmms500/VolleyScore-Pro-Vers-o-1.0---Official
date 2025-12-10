import React, { useState, useMemo } from 'react';
import { Match } from '../../stores/historyStore';
import { Player, SkillType, SetHistory, TeamColor } from '../../types';
import { downloadJSON } from '../../services/io';
import { useTranslation } from '../../contexts/LanguageContext';
import { 
  ArrowLeft, Download, Clock, Calendar, 
  Shield, Swords, Target, AlertTriangle, 
  Activity, Crown, BarChart2, Zap, TrendingUp
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { resolveTheme, getHexFromColor } from '../../utils/colors';

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
        <div className="w-full h-32 flex items-center justify-center text-xs text-slate-400 italic bg-slate-50 dark:bg-white/5 rounded-xl border border-dashed border-slate-200 dark:border-white/10 mt-4 mb-2">
            Not enough data for chart
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
            
            {/* Floating Labels - Positioned absolutely but with Neo-Glass backing to sit ON TOP of chart safely */}
            <div className="absolute top-2 left-2 z-10 flex items-center gap-1.5 px-2 py-1 rounded-lg bg-white/90 dark:bg-black/60 backdrop-blur-md border border-black/5 dark:border-white/10 shadow-sm pointer-events-none">
                <div className="w-1.5 h-1.5 rounded-full" style={{ background: hexA }} />
                <span className="text-[9px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 leading-none">Lead</span>
            </div>
            
            <div className="absolute bottom-2 left-2 z-10 flex items-center gap-1.5 px-2 py-1 rounded-lg bg-white/90 dark:bg-black/60 backdrop-blur-md border border-black/5 dark:border-white/10 shadow-sm pointer-events-none">
                <div className="w-1.5 h-1.5 rounded-full" style={{ background: hexB }} />
                <span className="text-[9px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 leading-none">Lead</span>
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
                                width={8} height={4} rx={1} 
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
            flex flex-col sm:flex-row sm:items-center gap-3 p-3 rounded-2xl mb-2 transition-all
            ${isMVP ? 'bg-amber-500/10 border border-amber-500/20' : 'bg-white dark:bg-white/5 border border-black/5 dark:border-white/5'}
        `}>
            {/* Header Section: Rank + Name */}
            <div className="flex items-center gap-3 flex-1 min-w-0 w-full sm:w-auto">
                {/* Rank */}
                <div className={`
                    w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm flex-shrink-0 shadow-sm
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

            {/* Stats Section - Flexible & Wrapping */}
            <div className="flex items-center justify-end gap-2 flex-wrap sm:flex-nowrap pl-12 sm:pl-0 w-full sm:w-auto">
                
                {/* Attack Pill */}
                {stats.attack > 0 && (
                    <div className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg ${theme.bg} ${theme.text} ${theme.textDark} ${theme.border} border`} title="Kills">
                        <Swords size={12} strokeWidth={2.5} />
                        <span className="text-xs font-bold tabular-nums">{stats.attack}</span>
                    </div>
                )}

                {/* Block Pill */}
                {stats.block > 0 && (
                    <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20" title="Blocks">
                        <Shield size={12} strokeWidth={2.5} />
                        <span className="text-xs font-bold tabular-nums">{stats.block}</span>
                    </div>
                )}

                {/* Ace Pill */}
                {stats.ace > 0 && (
                    <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20" title="Aces">
                        <Target size={12} strokeWidth={2.5} />
                        <span className="text-xs font-bold tabular-nums">{stats.ace}</span>
                    </div>
                )}

                {/* Total Points (Always visible) */}
                 <div className={`
                    flex flex-col items-center justify-center w-12 h-10 rounded-xl border ml-1 sm:ml-2 flex-shrink-0
                    ${isMVP ? 'bg-amber-500/20 border-amber-500/30' : 'bg-slate-100 dark:bg-white/10 border-transparent'}
                `}>
                    <span className={`text-lg font-black tabular-nums leading-none ${isMVP ? 'text-amber-700 dark:text-amber-400' : 'text-slate-900 dark:text-white'}`}>{stats.total}</span>
                    <span className="text-[8px] font-bold uppercase opacity-50">PTS</span>
                </div>
            </div>
        </div>
    );
};

// --- MAIN COMPONENT ---

export const MatchDetail: React.FC<MatchDetailProps> = ({ match, onBack }) => {
  const { t } = useTranslation();
  
  // Replay Logic: -1 is Summary, 0 is Set 1, etc.
  const [replayIndex, setReplayIndex] = useState<number>(-1);

  // --- DERIVED STATS ---
  const hasDetailedStats = useMemo(() => {
      return (match as any).actionLog?.some((log: any) => log.type === 'POINT');
  }, [match]);

  // Resolve Colors
  const themeA = resolveTheme(match.teamARoster?.color || 'indigo');
  const themeB = resolveTheme(match.teamBRoster?.color || 'rose');
  const hexA = getHexFromColor(match.teamARoster?.color || 'indigo');
  const hexB = getHexFromColor(match.teamBRoster?.color || 'rose');

  // Aggregate Stats Logic
  const { playerStats, teamStats } = useMemo(() => {
      const pStats: Record<string, CalculatedStat> = {};
      const tStats = {
          A: { attack: 0, block: 0, ace: 0, error_gain: 0 },
          B: { attack: 0, block: 0, ace: 0, error_gain: 0 }
      };
      
      // Initialize known players
      match.teamARoster?.players?.forEach(p => {
          pStats[p.id] = { id: p.id, name: p.name, team: 'A', skillLevel: p.skillLevel, total: 0, attack: 0, block: 0, ace: 0 };
      });
      match.teamBRoster?.players?.forEach(p => {
          pStats[p.id] = { id: p.id, name: p.name, team: 'B', skillLevel: p.skillLevel, total: 0, attack: 0, block: 0, ace: 0 };
      });

      // Process Logs
      const logs = (match as any).actionLog || [];
      
      logs.forEach((log: any) => {
          if (log.type === 'POINT') {
             const team = log.team as 'A' | 'B';
             const skill = log.skill as SkillType | undefined;
             const playerId = log.playerId;
             
             if (skill === 'attack') tStats[team].attack++;
             else if (skill === 'block') tStats[team].block++;
             else if (skill === 'ace') tStats[team].ace++;
             else if (skill === 'opponent_error') tStats[team].error_gain++;
             
             if (playerId) {
                 if (!pStats[playerId]) {
                     const isUnknown = playerId === 'unknown';
                     pStats[playerId] = {
                         id: playerId,
                         name: isUnknown ? 'Unknown Player' : 'Ghost Player',
                         team: isUnknown ? 'Unknown' : team, 
                         skillLevel: 0,
                         total: 0, attack: 0, block: 0, ace: 0
                     };
                 }
                 pStats[playerId].total += 1;
                 if (skill === 'attack') pStats[playerId].attack += 1;
                 if (skill === 'block') pStats[playerId].block += 1;
                 if (skill === 'ace') pStats[playerId].ace += 1;
             }
          }
      });

      return { 
          playerStats: Object.values(pStats).sort((a, b) => b.total - a.total),
          teamStats: tStats 
      };
  }, [match]);

  // Replay Stats Logic
  const currentReplaySet = replayIndex >= 0 ? match.sets[replayIndex] : null;

  // Formatting
  const dateStr = new Date(match.timestamp).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
  const timeStr = new Date(match.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.98 }}
      className="flex flex-col h-full bg-slate-50 dark:bg-[#020617] text-slate-900 dark:text-white overflow-hidden"
    >
      {/* --- HEADER --- */}
      <div className="flex-none flex items-center justify-between p-4 bg-white/50 dark:bg-black/20 backdrop-blur-md border-b border-black/5 dark:border-white/5 z-20 sticky top-0">
        <button onClick={onBack} className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white transition-colors">
            <ArrowLeft size={16} /> Back
        </button>
        
        <div className="flex items-center gap-2 opacity-60">
             <Calendar size={12} />
             <span className="text-[10px] font-bold uppercase tracking-wider">{dateStr} • {timeStr}</span>
        </div>

        <button onClick={() => downloadJSON(`match_${match.id.slice(0, 8)}`, match)} className="text-slate-400 hover:text-indigo-500 transition-colors">
            <Download size={18} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar">
        <div className="p-4 md:p-6 space-y-6 max-w-4xl mx-auto pb-20">
            
            {/* 1. HERO SCOREBOARD */}
            <div className="flex flex-col items-center relative py-6">
                <div className="w-full flex flex-col md:flex-row items-center justify-between gap-6 z-10">
                    <div className="flex-1 w-full"><TeamHero name={match.teamAName} winner={match.winner === 'A'} isRight={false} theme={themeA} /></div>
                    
                    <div className="flex-shrink-0 flex items-center justify-center bg-slate-200 dark:bg-white/5 rounded-2xl px-6 py-2 border border-black/5 dark:border-white/5">
                        <div className="flex items-center gap-4 font-black font-inter tracking-tighter tabular-nums leading-none">
                            <span className={`text-5xl md:text-6xl ${match.winner === 'A' ? `${themeA.text} ${themeA.textDark}` : 'text-slate-400'}`}>{match.setsA}</span>
                            <span className="text-slate-300 dark:text-slate-600 text-3xl">:</span>
                            <span className={`text-5xl md:text-6xl ${match.winner === 'B' ? `${themeB.text} ${themeB.textDark}` : 'text-slate-400'}`}>{match.setsB}</span>
                        </div>
                    </div>

                    <div className="flex-1 w-full"><TeamHero name={match.teamBName} winner={match.winner === 'B'} isRight={true} theme={themeB} /></div>
                </div>
            </div>

            {/* 2. TIMELINE & SUMMARY */}
            <div className="bg-white dark:bg-white/[0.03] rounded-3xl overflow-hidden border border-black/5 dark:border-white/5 shadow-sm">
                
                {/* Tabs - Scrollable with no shrinking */}
                <div className="p-2 border-b border-black/5 dark:border-white/5 flex overflow-x-auto no-scrollbar gap-2 bg-slate-50 dark:bg-black/20">
                     <button 
                        onClick={() => setReplayIndex(-1)}
                        className={`
                            px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider whitespace-nowrap transition-all flex-shrink-0
                            ${replayIndex === -1 ? 'bg-white dark:bg-slate-700 shadow-sm text-indigo-500 dark:text-indigo-300 ring-1 ring-black/5 dark:ring-white/10' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}
                        `}
                     >
                        Summary
                     </button>
                     {match.sets.map((set, idx) => (
                         <button 
                            key={idx}
                            onClick={() => setReplayIndex(idx)}
                            className={`
                                px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider whitespace-nowrap transition-all flex-shrink-0
                                ${replayIndex === idx ? 'bg-white dark:bg-slate-700 shadow-sm text-indigo-500 dark:text-indigo-300 ring-1 ring-black/5 dark:ring-white/10' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}
                            `}
                        >
                            Set {set.setNumber}
                        </button>
                     ))}
                </div>
                
                {/* Content */}
                <div className="p-6 min-h-[140px] flex flex-col items-center justify-center overflow-hidden">
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={replayIndex}
                            initial={{ opacity: 0, y: 5 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -5 }}
                            className="w-full"
                        >
                            {replayIndex === -1 ? (
                                /* Summary View - Momentum Chart + Set Breakdown */
                                <div className="flex flex-col gap-6">
                                    {/* MOMENTUM CHART */}
                                    {hasDetailedStats && (
                                        <div className="w-full bg-slate-50 dark:bg-white/5 rounded-2xl p-4 border border-black/5 dark:border-white/5">
                                            <div className="flex items-center gap-2 mb-2 text-slate-400">
                                                <TrendingUp size={14} />
                                                <span className="text-[10px] font-bold uppercase tracking-widest">Match Flow (Score Gap)</span>
                                            </div>
                                            <MomentumChart 
                                                actionLog={(match as any).actionLog || []} 
                                                sets={match.sets}
                                                hexA={hexA}
                                                hexB={hexB}
                                            />
                                        </div>
                                    )}

                                    {/* Sets Grid - Interactive Navigation */}
                                    <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 w-full">
                                        {match.sets.map((set, idx) => (
                                            <button 
                                                key={idx} 
                                                onClick={() => setReplayIndex(idx)}
                                                className="flex flex-col items-center p-3 rounded-2xl bg-slate-50 dark:bg-white/5 border border-black/5 dark:border-white/5 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 hover:border-indigo-500/30 transition-all group active:scale-95"
                                            >
                                                <span className="text-[10px] font-bold text-slate-400 group-hover:text-indigo-500 mb-1 transition-colors">SET {set.setNumber}</span>
                                                <div className="text-xl sm:text-2xl font-black tabular-nums tracking-tight">
                                                    <span className={set.winner === 'A' ? `${themeA.text} ${themeA.textDark}` : 'text-slate-400 dark:text-slate-500'}>{set.scoreA}</span>
                                                    <span className="mx-0.5 opacity-20 text-slate-400">-</span>
                                                    <span className={set.winner === 'B' ? `${themeB.text} ${themeB.textDark}` : 'text-slate-400 dark:text-slate-500'}>{set.scoreB}</span>
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            ) : (
                                currentReplaySet && (
                                    <div className="flex flex-col items-center w-full">
                                        <div className="flex items-center gap-8 md:gap-16">
                                            <span className={`text-6xl font-black tabular-nums ${currentReplaySet.winner === 'A' ? `${themeA.text} ${themeA.textDark}` : 'text-slate-300 dark:text-slate-700'}`}>
                                                {currentReplaySet.scoreA}
                                            </span>
                                            <div className="flex flex-col items-center">
                                                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">SET</span>
                                                <span className="text-3xl font-black text-slate-800 dark:text-white">{currentReplaySet.setNumber}</span>
                                            </div>
                                            <span className={`text-6xl font-black tabular-nums ${currentReplaySet.winner === 'B' ? `${themeB.text} ${themeB.textDark}` : 'text-slate-300 dark:text-slate-700'}`}>
                                                {currentReplaySet.scoreB}
                                            </span>
                                        </div>
                                    </div>
                                )
                            )}
                        </motion.div>
                    </AnimatePresence>
                </div>
            </div>
            
            {/* 3. MATCH INSIGHTS (Team Stats) */}
            {hasDetailedStats && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Insights Card */}
                    <div className="bg-white dark:bg-white/[0.03] rounded-3xl p-6 border border-black/5 dark:border-white/5 shadow-sm">
                        <div className="flex items-center gap-2 mb-6">
                            <BarChart2 size={18} className="text-emerald-500" />
                            <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500">Match Insights</h3>
                        </div>
                        
                        <div className="space-y-5">
                            <StatBar 
                                label="Total Kills" 
                                valueA={teamStats.A.attack} valueB={teamStats.B.attack} 
                                colorA={themeA} colorB={themeB} 
                                icon={Swords}
                            />
                            <StatBar 
                                label="Blocks" 
                                valueA={teamStats.A.block} valueB={teamStats.B.block} 
                                colorA={themeA} colorB={themeB} 
                                icon={Shield}
                            />
                            <StatBar 
                                label="Service Aces" 
                                valueA={teamStats.A.ace} valueB={teamStats.B.ace} 
                                colorA={themeA} colorB={themeB} 
                                icon={Target}
                            />
                             <StatBar 
                                label="Opponent Errors" 
                                valueA={teamStats.A.error_gain} valueB={teamStats.B.error_gain} 
                                colorA={themeA} colorB={themeB} 
                                icon={AlertTriangle}
                            />
                        </div>
                    </div>

                    {/* 4. PLAYER STATS (Box Score List) */}
                    <div className="bg-white dark:bg-white/[0.03] rounded-3xl p-6 border border-black/5 dark:border-white/5 shadow-sm flex flex-col h-full">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-2">
                                <Activity size={18} className="text-cyan-500" />
                                <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500">Player Stats</h3>
                            </div>
                        </div>
                        
                        <div className="flex-1 overflow-y-auto max-h-[400px] custom-scrollbar pr-1">
                            {playerStats.map((stat, idx) => (
                                <PlayerStatRow 
                                    key={stat.id} 
                                    stats={stat} 
                                    rank={idx + 1}
                                    isMVP={idx === 0 && stat.total > 0} 
                                    themeA={themeA}
                                    themeB={themeB}
                                />
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
      </div>
    </motion.div>
  );
};