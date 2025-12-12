import React, { useMemo, useRef, useState, useEffect } from 'react';
import { Match } from '../../stores/historyStore';
import { ActionLog, TeamId, SkillType } from '../../types';
import { 
  Swords, Shield, Target, AlertTriangle, Timer, 
  Clock, Share2, FileText, CheckCircle2, Crown, Circle, Skull
} from 'lucide-react';
import { motion, Variants } from 'framer-motion';
import { resolveTheme } from '../../utils/colors';
import { Share } from '@capacitor/share';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Capacitor } from '@capacitor/core';
import { useTranslation } from '../../contexts/LanguageContext';
import { toPng } from 'html-to-image';

interface MatchTimelineProps {
  match: Match;
}

interface TimelineEvent {
  id: number;
  type: 'POINT' | 'TIMEOUT' | 'SET_END' | 'SUDDEN_DEATH';
  timeLabel: string;
  timestamp: number;
  team: TeamId | null;
  scoreSnapshot: string;
  description: string;
  player?: string;
  skill?: SkillType;
}

// --- ANIMATION VARIANTS ---
const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08, delayChildren: 0.1 }
  }
};

const nodeVariants: Variants = {
  hidden: { opacity: 0, x: 20, scale: 0.8 },
  visible: { 
    opacity: 1, 
    x: 0, 
    scale: 1,
    transition: { type: "spring", stiffness: 350, damping: 25 } 
  }
};

export const MatchTimeline: React.FC<MatchTimelineProps> = ({ match }) => {
  const { t } = useTranslation();
  const [isExporting, setIsExporting] = useState(false);
  const [activeEventId, setActiveEventId] = useState<number | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const captureRef = useRef<HTMLDivElement>(null);

  const themeA = resolveTheme(match.teamARoster?.color || 'indigo');
  const themeB = resolveTheme(match.teamBRoster?.color || 'rose');

  // Auto-scroll to end on mount
  useEffect(() => {
      if (scrollRef.current) {
          scrollRef.current.scrollLeft = scrollRef.current.scrollWidth;
      }
  }, [match]);

  const handleBackgroundClick = () => {
      setActiveEventId(null);
  };

  // --- DATA TRANSFORMATION ---
  const events = useMemo(() => {
    const list: TimelineEvent[] = [];
    if (!match.actionLog || match.actionLog.length === 0) return list;

    const startTime = match.actionLog[0].timestamp || match.timestamp;
    let scoreA = 0;
    let scoreB = 0;
    let currentSet = 1;

    // Helper to resolve player name safely
    const getPlayerName = (id: string | null | undefined): string => {
        if (!id || id === 'unknown') return t('scout.unknownPlayer');
        const pA = match.teamARoster?.players.find(p => p.id === id) || match.teamARoster?.reserves?.find(p => p.id === id);
        if (pA) return pA.name;
        const pB = match.teamBRoster?.players.find(p => p.id === id) || match.teamBRoster?.reserves?.find(p => p.id === id);
        return pB ? pB.name : t('scout.unknownPlayer');
    };

    match.actionLog.forEach((log: any, idx) => {
        if (!log.timestamp) return;
        
        const diffMinutes = Math.floor((log.timestamp - startTime) / 60000);
        const timeLabel = `${diffMinutes}'`;

        if (log.type === 'POINT') {
            
            // Check for Sudden Death Transition
            // If current point was NOT in SD, but next point IS in SD, this point triggered the reset.
            const nextLog = match.actionLog![idx + 1];
            const isTransition = 
                (log.prevInSuddenDeath === false || log.prevInSuddenDeath === undefined) &&
                (nextLog && nextLog.type === 'POINT' && nextLog.prevInSuddenDeath === true);

            if (log.team === 'A') scoreA++; else scoreB++;
            
            let desc = t('common.add');
            // Specific Skill Descriptions
            if (log.skill === 'attack') desc = t('scout.skills.attack');
            if (log.skill === 'block') desc = t('scout.skills.block');
            if (log.skill === 'ace') desc = t('scout.skills.ace');
            if (log.skill === 'opponent_error') desc = t('scout.skills.opponent_error');

            list.push({
                id: idx,
                type: 'POINT',
                timeLabel,
                timestamp: log.timestamp,
                team: log.team,
                scoreSnapshot: `${scoreA}-${scoreB}`,
                player: getPlayerName(log.playerId),
                skill: log.skill,
                description: desc
            });

            if (isTransition) {
                // Insert Sudden Death Marker and Reset Scores
                list.push({
                    id: idx + 5000,
                    type: 'SUDDEN_DEATH',
                    timeLabel,
                    timestamp: log.timestamp + 1,
                    team: null,
                    scoreSnapshot: "0-0",
                    description: t('game.suddenDeath'),
                    player: ''
                });
                scoreA = 0;
                scoreB = 0;
            }

            // Detect Set End Heuristic
            // Matches against match.sets history to determine where sets ended
            const setRecord = match.sets.find(s => s.setNumber === currentSet);
            if (setRecord && scoreA === setRecord.scoreA && scoreB === setRecord.scoreB) {
                list.push({
                    id: idx + 9000,
                    type: 'SET_END',
                    timeLabel,
                    timestamp: log.timestamp + 2, // ensure it comes after SD marker if same tick
                    team: null,
                    scoreSnapshot: `${scoreA}-${scoreB}`,
                    description: `Set ${currentSet}`,
                    player: ''
                });
                scoreA = 0; 
                scoreB = 0;
                currentSet++;
            }

        } else if (log.type === 'TIMEOUT') {
            list.push({
                id: idx,
                type: 'TIMEOUT',
                timeLabel,
                timestamp: log.timestamp,
                team: log.team,
                scoreSnapshot: `${scoreA}-${scoreB}`,
                description: t('game.timeout'),
                player: ''
            });
        }
    });

    return list;
  }, [match, t]);

  // --- EXPORT LOGIC ---
  const handleExportText = async () => {
    setIsExporting(true);
    try {
        const lines = [`MATCH TIMELINE: ${match.teamAName} vs ${match.teamBName}`, `Date: ${new Date(match.timestamp).toLocaleDateString()}`, '--------------------------------'];
        
        events.forEach(e => {
            if (e.type === 'SET_END') {
                lines.push(`\n[${e.timeLabel}] --- SET FINISHED (${e.scoreSnapshot}) ---\n`);
                return;
            }
            if (e.type === 'SUDDEN_DEATH') {
                lines.push(`\n[${e.timeLabel}] !!! SUDDEN DEATH STARTED !!!\n`);
                return;
            }
            const teamName = e.team === 'A' ? match.teamAName : (e.team === 'B' ? match.teamBName : 'System');
            lines.push(`[${e.timeLabel}] ${teamName}: ${e.description} ${e.player ? `(${e.player})` : ''} - Score: ${e.scoreSnapshot}`);
        });

        const content = lines.join('\n');
        const filename = `timeline_${match.id.substring(0,8)}.txt`;

        if (Capacitor.isNativePlatform()) {
            const file = await Filesystem.writeFile({
                path: filename,
                data: content,
                directory: Directory.Cache,
                encoding: Encoding.UTF8
            });
            await Share.share({ title: 'Match Timeline', url: file.uri });
        } else {
            const blob = new Blob([content], { type: 'text/plain' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = filename;
            link.click();
        }
    } catch (e) {
        console.error("Export failed", e);
    } finally {
        setIsExporting(false);
    }
  };

  const handleExportImage = async () => {
      if (!captureRef.current) return;
      setIsExporting(true);
      try {
          const dataUrl = await toPng(captureRef.current, { cacheBust: true, pixelRatio: 2, backgroundColor: '#0f172a' });
          const filename = `visual_timeline_${match.id.substring(0,8)}.png`;
          if (Capacitor.isNativePlatform()) {
              const file = await Filesystem.writeFile({
                  path: filename,
                  data: dataUrl.split(',')[1],
                  directory: Directory.Cache
              });
              await Share.share({ title: 'Visual Timeline', url: file.uri });
          } else {
              const link = document.createElement('a');
              link.href = dataUrl;
              link.download = filename;
              link.click();
          }
      } catch(e) { console.error(e); } finally { setIsExporting(false); }
  };

  const getIcon = (e: TimelineEvent) => {
      if (e.type === 'TIMEOUT') return <Timer size={10} strokeWidth={3} />;
      if (e.type === 'SET_END') return <Crown size={12} strokeWidth={3} />;
      if (e.type === 'SUDDEN_DEATH') return <Skull size={12} strokeWidth={3} />;
      switch (e.skill) {
          case 'attack': return <Swords size={12} />;
          case 'block': return <Shield size={12} />;
          case 'ace': return <Target size={12} />;
          case 'opponent_error': return <AlertTriangle size={12} />;
          default: return <Circle size={10} fill="currentColor" />; // Ball representation
      }
  };

  if (events.length === 0) return null;

  return (
    <div className="bg-white dark:bg-white/5 rounded-3xl border border-black/5 dark:border-white/10 shadow-sm overflow-hidden flex flex-col mt-4">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-black/5 dark:border-white/5 bg-slate-50/50 dark:bg-white/[0.02]">
            <div className="flex items-center gap-2">
                <Clock size={16} className="text-indigo-500" />
                <h3 className="text-xs font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">Match Timeline</h3>
            </div>
            <div className="flex gap-2">
                <button onClick={handleExportText} disabled={isExporting} className="p-2 rounded-xl bg-white dark:bg-white/10 border border-black/5 dark:border-white/10 text-slate-400 hover:text-indigo-500 dark:hover:text-white transition-colors" title="Export Text">
                    <FileText size={16} />
                </button>
                <button onClick={handleExportImage} disabled={isExporting} className="p-2 rounded-xl bg-white dark:bg-white/10 border border-black/5 dark:border-white/10 text-slate-400 hover:text-indigo-500 dark:hover:text-white transition-colors" title="Export Image">
                    <Share2 size={16} />
                </button>
            </div>
        </div>

        {/* Scrollable Area - Fixed Height for 100% visibility without vertical scroll on page */}
        <div 
            ref={scrollRef} 
            className="overflow-x-auto w-full p-6 pb-2 no-scrollbar cursor-grab active:cursor-grabbing" 
            style={{ scrollBehavior: 'smooth' }}
            onClick={handleBackgroundClick}
        >
            <div ref={captureRef} className="min-w-max relative pb-8 pt-8 px-4 h-[240px] flex items-center">
                
                {/* Central Axis */}
                <div className="absolute top-1/2 left-0 w-full h-0.5 bg-slate-200 dark:bg-white/10 -translate-y-1/2 rounded-full" />

                <motion.div 
                    variants={containerVariants}
                    initial="hidden"
                    animate="visible"
                    className="flex items-center gap-16 relative z-10" // Generous gap for readability
                >
                    {/* Start Node */}
                    <div className="flex flex-col items-center gap-2 relative">
                        <div className="w-3 h-3 rounded-full bg-slate-400 ring-4 ring-slate-100 dark:ring-slate-800 z-20" />
                        <span className="text-[10px] font-mono text-slate-400 absolute top-6">START</span>
                    </div>

                    {events.map((evt) => {
                        const isTop = evt.team === 'A'; // Team A goes UP (Visually 'left' in some contexts, but Top here)
                        const isSystem = evt.type === 'SET_END' || evt.type === 'SUDDEN_DEATH';
                        const theme = isTop ? themeA : themeB;
                        
                        const isActive = activeEventId === evt.id;

                        if (isSystem) {
                            const isSD = evt.type === 'SUDDEN_DEATH';
                            return (
                                <motion.div 
                                    key={evt.id} 
                                    variants={nodeVariants} 
                                    className="flex flex-col items-center justify-center relative group"
                                >
                                    <div className={`h-32 w-px border-l-2 border-dashed ${isSD ? 'border-red-500/50 dark:border-red-500/30' : 'border-slate-300 dark:border-white/20'} absolute top-1/2 -translate-y-1/2`} />
                                    <div className={`z-20 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-wider shadow-lg flex items-center gap-1 ${isSD ? 'bg-red-500 text-white animate-pulse' : 'bg-slate-800 text-white'}`}>
                                        {isSD && <Skull size={10} />}
                                        {evt.description}
                                    </div>
                                    <span className="text-[9px] font-bold text-slate-400 mt-2 bg-slate-100 dark:bg-slate-800 px-1 rounded">{evt.scoreSnapshot}</span>
                                </motion.div>
                            );
                        }

                        // Compact Node Layout with Interaction
                        return (
                            <motion.div 
                                key={evt.id} 
                                variants={nodeVariants}
                                // CRITICAL: Higher Z-Index when active allows overlapping adjacent nodes without being hidden
                                className={`
                                    relative flex flex-col items-center justify-center group min-w-[20px] transition-all
                                    ${isActive ? 'z-50' : 'z-10'}
                                `}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setActiveEventId(isActive ? null : evt.id);
                                }}
                            >
                                {/* Vertical Connector - Lengthened to support higher placement */}
                                <div 
                                    className={`absolute left-1/2 -translate-x-1/2 w-0.5 transition-all duration-300
                                    ${isTop ? 'bottom-1/2 origin-bottom' : 'top-1/2 origin-top'}
                                    ${evt.type === 'TIMEOUT' 
                                        ? 'bg-slate-300 dark:bg-white/20 h-10 border-l border-dashed border-slate-400 bg-transparent w-0' 
                                        : `${theme.bg.replace('/20', '')} ${isActive ? 'h-20 opacity-100' : 'h-10 opacity-40 group-hover:h-14 group-hover:opacity-100'}`}
                                    `}
                                />

                                {/* Central Axis Dot */}
                                <div className={`w-2.5 h-2.5 rounded-full z-10 ring-4 ring-slate-50 dark:ring-[#0f172a] ${evt.type === 'TIMEOUT' ? 'bg-slate-400' : theme.halo.replace('bg-', 'bg-')} transition-transform ${isActive ? 'scale-125' : ''}`} />

                                {/* Time/Score Indicator - Positioned BETWEEN Dot and Bubble */}
                                {/* Top (Team A): Bottom aligned (above axis). Bottom (Team B): Top aligned (below axis) */}
                                <div className={`
                                    absolute flex flex-col items-center transition-all duration-300 z-10
                                    ${isTop 
                                        ? 'bottom-3' 
                                        : 'top-3'
                                    }
                                `}>
                                    <span className={`
                                        text-[8px] font-mono font-bold px-1 rounded backdrop-blur-sm whitespace-nowrap transition-colors
                                        ${isActive ? 'text-slate-600 dark:text-white bg-white dark:bg-black/60 shadow-sm scale-110' : 'text-slate-400 bg-white/80 dark:bg-black/40'}
                                    `}>
                                        {evt.timeLabel} • {evt.scoreSnapshot}
                                    </span>
                                </div>

                                {/* Event Bubble Container - Positioned FURTHER OUT */}
                                <div className={`
                                    absolute left-1/2 -translate-x-1/2 flex flex-col items-center gap-1 transition-all duration-300 w-max z-20
                                    ${isTop 
                                        ? (isActive ? 'bottom-14' : 'bottom-9 group-hover:bottom-11') 
                                        : (isActive ? 'top-14' : 'top-9 group-hover:top-11')
                                    }
                                    ${isActive ? 'scale-110' : 'scale-100'}
                                `}>
                                    {/* Main Bubble */}
                                    <div className={`
                                        flex items-center gap-2 px-2.5 py-1.5 rounded-xl shadow-sm border backdrop-blur-sm cursor-pointer
                                        ${evt.type === 'TIMEOUT' ? 'bg-slate-100 dark:bg-slate-800 text-slate-500 border-slate-200' : `${theme.bg} ${theme.text} ${theme.textDark} ${theme.border}`}
                                        ${isActive ? 'shadow-lg ring-2 ring-white/50 dark:ring-white/10' : ''}
                                    `}>
                                        {getIcon(evt)}
                                        <div className="flex flex-col leading-none">
                                            {evt.player ? (
                                                <span className={`text-[10px] font-black uppercase tracking-wider truncate transition-all duration-300 ${isActive ? 'max-w-[140px]' : 'max-w-[70px]'}`}>{evt.player}</span>
                                            ) : (
                                                <span className="text-[10px] font-black uppercase tracking-wider">{evt.team === 'A' ? match.teamAName : match.teamBName}</span>
                                            )}
                                            {evt.skill && <span className="text-[8px] opacity-80 uppercase tracking-tight">{evt.description}</span>}
                                        </div>
                                    </div>
                                </div>
                            </motion.div>
                        );
                    })}

                    {/* End Node */}
                    <div className="flex flex-col items-center gap-2 relative">
                        <div className="w-3 h-3 rounded-full bg-slate-800 dark:bg-white ring-4 ring-slate-100 dark:ring-slate-800 z-20" />
                        <span className="text-[10px] font-mono text-slate-400 absolute top-6">END</span>
                    </div>
                </motion.div>
            </div>
        </div>
    </div>
  );
};