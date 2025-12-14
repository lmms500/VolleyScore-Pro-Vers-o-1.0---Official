
import React, { useMemo, useRef, useState, useEffect } from 'react';
import { Match } from '../../stores/historyStore';
import { ActionLog, TeamId, SkillType } from '../../types';
import { 
  Swords, Shield, Target, AlertTriangle, Timer, 
  Clock, Share2, FileText, Circle, Skull, Crown, Info
} from 'lucide-react';
import { motion, Variants, AnimatePresence } from 'framer-motion';
import { resolveTheme } from '../../utils/colors';
import { Share } from '@capacitor/share';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Capacitor } from '@capacitor/core';
import { useTranslation } from '../../contexts/LanguageContext';
import { toPng } from 'html-to-image';

interface MatchTimelineProps {
  match: Match;
}

interface TimelineNode {
  id: string; // Unique composite ID
  type: 'START' | 'POINT' | 'TIMEOUT' | 'SET_END' | 'SUDDEN_DEATH' | 'END';
  timestamp: number;
  timeLabel: string;
  team: TeamId | null; // Null for system events
  scoreSnapshot: string; // "10-9"
  description: string;
  player?: string;
  skill?: SkillType;
  
  // Visualization Props
  isTop: boolean; // Team A is Top, Team B is Bottom
  staggerLevel: number; // 0 (Base), 1 (Far), 2 (Very Far) - For zig-zag
}

// --- ANIMATION VARIANTS ---
const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.03, delayChildren: 0.1 }
  }
};

const nodeVariants: Variants = {
  hidden: { opacity: 0, scale: 0, y: 0 },
  visible: { 
    opacity: 1, 
    scale: 1, 
    y: 0,
    transition: { type: "spring", stiffness: 400, damping: 25 } 
  }
};

export const MatchTimeline: React.FC<MatchTimelineProps> = ({ match }) => {
  const { t } = useTranslation();
  const [isExporting, setIsExporting] = useState(false);
  const [activeNodeId, setActiveNodeId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const captureRef = useRef<HTMLDivElement>(null);

  const themeA = resolveTheme(match.teamARoster?.color || 'indigo');
  const themeB = resolveTheme(match.teamBRoster?.color || 'rose');

  // Auto-scroll to start on mount
  useEffect(() => {
      if (scrollRef.current) {
          setTimeout(() => {
            if (scrollRef.current) scrollRef.current.scrollLeft = 0;
          }, 100);
      }
  }, [match]);

  const handleBackgroundClick = () => {
      setActiveNodeId(null);
  };

  // --- 1. CORE LOGIC ENGINE ---
  const timelineNodes = useMemo(() => {
    if (!match.actionLog || match.actionLog.length === 0) return [];

    // 1.1. STRICT SORTING: The absolute source of truth is Time.
    const sortedLogs = [...match.actionLog].sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
    
    // Determine accurate Start Time
    // match.timestamp is usually the END time (when saved).
    // Start time is estimated by subtracting duration, or using the first log's time.
    const firstLogTs = sortedLogs.length > 0 ? (sortedLogs[0].timestamp || 0) : 0;
    const estimatedStart = match.timestamp - (match.durationSeconds * 1000);
    // Use first log if valid and earlier than save time, otherwise estimate
    const startTime = (firstLogTs > 0 && firstLogTs < match.timestamp) ? firstLogTs : estimatedStart;

    const nodes: TimelineNode[] = [];

    // Running State
    let scoreA = 0;
    let scoreB = 0;
    let currentSet = 1;
    let wasInSuddenDeath = false;
    
    // Staggering State
    let lastTeam: TeamId | null = null;
    let streakCount = 0;

    // Helper: Player Name Resolution
    const getPlayerName = (id: string | null | undefined): string => {
        if (!id || id === 'unknown') return '';
        const pA = match.teamARoster?.players.find(p => p.id === id) || match.teamARoster?.reserves?.find(p => p.id === id);
        if (pA) return pA.name;
        const pB = match.teamBRoster?.players.find(p => p.id === id) || match.teamBRoster?.reserves?.find(p => p.id === id);
        return pB ? pB.name : '';
    };

    // Helper: Format Time
    const getTimeLabel = (ts: number) => {
        const diff = Math.max(0, Math.floor((ts - startTime) / 60000));
        return `${diff}'`;
    };

    // 1.2. INITIAL NODE
    nodes.push({
        id: 'node-start',
        type: 'START',
        timestamp: startTime,
        timeLabel: '0\'',
        team: null,
        scoreSnapshot: '0-0',
        description: 'START',
        isTop: false,
        staggerLevel: 0
    });

    sortedLogs.forEach((log, idx) => {
        
        // Detect Sudden Death Transition
        // Logic: If the log says we ARE in sudden death (prevInSuddenDeath=true),
        // but our local tracker says we weren't before, then the transition happened just now.
        // The PREVIOUS point caused the tie, so we insert the marker NOW, before processing this new point.
        if (log.type === 'POINT' && log.prevInSuddenDeath === true && !wasInSuddenDeath) {
             nodes.push({
                id: `sd-start-${idx}`,
                type: 'SUDDEN_DEATH',
                timestamp: (log.timestamp || 0) - 1, // Slightly before the point
                timeLabel: getTimeLabel((log.timestamp || 0)),
                team: null,
                scoreSnapshot: `${scoreA}-${scoreB}`, // Snapshot before reset (e.g. 14-14)
                description: t('status.sudden_death'),
                isTop: false,
                staggerLevel: 0
            });
            wasInSuddenDeath = true;
            
            // CRITICAL FIX: Reset scores because game engine resets to 0-0 in 3pt Sudden Death
            // This ensures subsequent points (1-0, 2-0) match the timeline logic and set targets
            scoreA = 0;
            scoreB = 0;
        } 
        // Reset local tracker if we leave SD (e.g. new set started normally)
        else if (log.type === 'POINT' && log.prevInSuddenDeath === false) {
            wasInSuddenDeath = false;
        }

        if (log.type === 'POINT') {
            // Update Score State
            if (log.team === 'A') scoreA++; else scoreB++;

            // Stagger Logic: Zig-Zag for consecutive team points
            if (log.team === lastTeam) {
                streakCount++;
            } else {
                streakCount = 0;
            }
            lastTeam = log.team;
            
            const staggerLevel = streakCount % 2; 

            let desc = t('common.add');
            if (log.skill === 'attack') desc = t('scout.skills.attack');
            if (log.skill === 'block') desc = t('scout.skills.block');
            if (log.skill === 'ace') desc = t('scout.skills.ace');
            if (log.skill === 'opponent_error') desc = t('scout.skills.opponent_error');

            nodes.push({
                id: `node-${idx}`,
                type: 'POINT',
                timestamp: log.timestamp || 0,
                timeLabel: getTimeLabel(log.timestamp || 0),
                team: log.team,
                scoreSnapshot: `${scoreA}-${scoreB}`,
                description: desc,
                player: getPlayerName(log.playerId),
                skill: log.skill,
                isTop: log.team === 'A',
                staggerLevel: staggerLevel
            });

            // Set End Detection: Check against Match History Sets
            // We verify if the current running score matches the stored set result
            const setRecord = match.sets.find(s => s.setNumber === currentSet);
            if (setRecord && scoreA === setRecord.scoreA && scoreB === setRecord.scoreB) {
                nodes.push({
                    id: `set-end-${currentSet}`,
                    type: 'SET_END',
                    timestamp: (log.timestamp || 0) + 1,
                    timeLabel: getTimeLabel((log.timestamp || 0)),
                    team: null,
                    scoreSnapshot: `${scoreA}-${scoreB}`,
                    description: `SET ${currentSet}`,
                    isTop: false,
                    staggerLevel: 0
                });
                
                // Reset for next set logic simulation
                scoreA = 0;
                scoreB = 0;
                currentSet++;
                lastTeam = null;
                streakCount = 0;
                wasInSuddenDeath = false; // Reset SD tracker on set change
            }
        } 
        else if (log.type === 'TIMEOUT') {
            nodes.push({
                id: `to-${idx}`,
                type: 'TIMEOUT',
                timestamp: log.timestamp || 0,
                timeLabel: getTimeLabel(log.timestamp || 0),
                team: log.team,
                scoreSnapshot: `${scoreA}-${scoreB}`,
                description: t('game.timeout'),
                isTop: log.team === 'A', // Timeouts appear on the team's side
                staggerLevel: 2 // Push timeouts further out to distinct them
            });
        }
    });

    // 1.3. END NODE
    // Ensure END timestamp is after the last log
    const lastLogTs = sortedLogs.length > 0 ? (sortedLogs[sortedLogs.length - 1].timestamp || 0) : startTime;
    
    nodes.push({
        id: 'node-end',
        type: 'END',
        timestamp: lastLogTs + 1000,
        timeLabel: '',
        team: null,
        scoreSnapshot: '',
        description: 'END',
        isTop: false,
        staggerLevel: 0
    });

    return nodes;
  }, [match, t]);

  // --- 2. EXPORT HANDLERS ---
  const handleExportText = async () => {
    setIsExporting(true);
    try {
        const lines = [`MATCH TIMELINE: ${match.teamAName} vs ${match.teamBName}`, `Date: ${new Date(match.timestamp).toLocaleDateString()}`, '--------------------------------'];
        timelineNodes.forEach(e => {
            if (e.type === 'START' || e.type === 'END') return;
            if (e.type === 'SET_END') {
                lines.push(`\n[${e.timeLabel}] --- ${e.description} (${e.scoreSnapshot}) ---\n`);
                return;
            }
            if (e.type === 'SUDDEN_DEATH') {
                lines.push(`\n[${e.timeLabel}] !!! ${e.description} !!!\n`);
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

  const getIcon = (e: TimelineNode) => {
      if (e.type === 'TIMEOUT') return <Timer size={10} strokeWidth={2.5} />;
      switch (e.skill) {
          case 'attack': return <Swords size={12} />;
          case 'block': return <Shield size={12} />;
          case 'ace': return <Target size={12} />;
          case 'opponent_error': return <AlertTriangle size={12} />;
          default: return <Circle size={8} fill="currentColor" />;
      }
  };

  // --- RENDER ---
  if (timelineNodes.length === 0) return null;

  // Layout Constants
  const ITEM_WIDTH = 80;
  const CONTAINER_HEIGHT = 280; 
  
  return (
    <div className="bg-white dark:bg-white/5 rounded-3xl border border-black/5 dark:border-white/10 shadow-sm overflow-hidden flex flex-col mt-4">
        
        {/* Header Control Bar */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-black/5 dark:border-white/5 bg-slate-50/50 dark:bg-white/[0.02]">
            <div className="flex items-center gap-2">
                <Clock size={16} className="text-indigo-500" />
                <h3 className="text-xs font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">Timeline</h3>
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

        {/* Horizontal Scroll Container */}
        <div 
            ref={scrollRef} 
            className="overflow-x-auto w-full p-4 no-scrollbar cursor-grab active:cursor-grabbing relative" 
            style={{ scrollBehavior: 'smooth' }}
            onClick={handleBackgroundClick}
        >
            <div ref={captureRef} className="flex items-center relative" style={{ height: `${CONTAINER_HEIGHT}px`, minWidth: 'max-content', paddingLeft: 40, paddingRight: 40 }}>
                
                {/* Central Axis Line */}
                <div className="absolute top-1/2 left-0 w-full h-0.5 bg-slate-200 dark:bg-white/10 -translate-y-1/2 rounded-full z-0" />

                <motion.div 
                    variants={containerVariants}
                    initial="hidden"
                    animate="visible"
                    className="flex items-center relative z-10 gap-0"
                >
                    {timelineNodes.map((node, i) => {
                        
                        // --- SYSTEM NODES (Start/End/Set/SuddenDeath) ---
                        if (node.type === 'START' || node.type === 'END' || node.type === 'SET_END' || node.type === 'SUDDEN_DEATH') {
                            const isSetEnd = node.type === 'SET_END';
                            const isSD = node.type === 'SUDDEN_DEATH';
                            
                            return (
                                <motion.div 
                                    key={node.id}
                                    variants={nodeVariants}
                                    className="flex flex-col items-center justify-center relative z-20 mx-4"
                                >
                                    {/* Vertical Line */}
                                    {(isSetEnd || isSD) && (
                                        <div className={`absolute top-1/2 -translate-y-1/2 h-40 w-px border-l-2 border-dashed ${isSD ? 'border-red-500/50' : 'border-slate-300 dark:border-white/20'}`} />
                                    )}
                                    
                                    <div className={`
                                        relative z-30 px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider shadow-lg flex items-center gap-1.5 border-2 whitespace-nowrap
                                        ${isSD 
                                            ? 'bg-red-500 text-white border-white dark:border-slate-900 animate-pulse' 
                                            : (isSetEnd ? 'bg-slate-800 text-white border-white dark:border-slate-900' : 'bg-slate-200 dark:bg-white/10 text-slate-500 dark:text-slate-400 border-white dark:border-slate-800')}
                                    `}>
                                        {isSD && <Skull size={10} />}
                                        {isSetEnd && <Crown size={10} />}
                                        {node.description}
                                    </div>
                                    
                                    {(isSetEnd || isSD) && (
                                        <span className="text-[9px] font-bold text-slate-500 dark:text-slate-400 mt-2 bg-white/80 dark:bg-black/40 px-1.5 py-0.5 rounded backdrop-blur-sm">
                                            {node.scoreSnapshot}
                                        </span>
                                    )}
                                </motion.div>
                            );
                        }

                        // --- POINT/TIMEOUT NODES ---
                        const isActive = activeNodeId === node.id;
                        const theme = node.team === 'A' ? themeA : themeB;
                        
                        // Staggering Logic (Vertical Offset)
                        const baseOffset = 40;
                        const staggerAmount = 35 * node.staggerLevel;
                        const totalOffset = baseOffset + staggerAmount;
                        const yOffset = node.isTop ? -totalOffset : totalOffset;
                        
                        // Connector Height
                        const connectorHeight = Math.abs(yOffset);

                        return (
                            <motion.div 
                                key={node.id}
                                variants={nodeVariants}
                                className={`relative flex flex-col items-center justify-center group`}
                                style={{ 
                                    width: ITEM_WIDTH, 
                                    zIndex: isActive ? 50 : 10 
                                }}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setActiveNodeId(isActive ? null : node.id);
                                }}
                            >
                                {/* 1. Central Axis Dot */}
                                <div className={`
                                    w-2.5 h-2.5 rounded-full z-10 ring-2 ring-slate-50 dark:ring-[#0f172a] transition-transform duration-200
                                    ${node.type === 'TIMEOUT' ? 'bg-slate-400' : theme.halo.replace('bg-', 'bg-')}
                                    ${isActive ? 'scale-150 ring-4' : 'group-hover:scale-125'}
                                `} />

                                {/* 2. Connector Line */}
                                <div 
                                    className={`absolute left-1/2 -translate-x-1/2 w-0.5 transition-all duration-300 origin-center
                                    ${node.isTop ? 'bottom-1/2' : 'top-1/2'}
                                    ${node.type === 'TIMEOUT' 
                                        ? `bg-transparent border-l border-dashed border-slate-400` 
                                        : `${theme.bg.replace('/20', '')}`}
                                    ${isActive ? 'opacity-100' : 'opacity-30 group-hover:opacity-100'}
                                    `}
                                    style={{ height: `${connectorHeight}px` }}
                                />

                                {/* 3. The Event Bubble (Floating) */}
                                <div 
                                    className={`
                                        absolute left-1/2 -translate-x-1/2 flex flex-col items-center gap-1 transition-all duration-300 w-max z-20
                                        ${isActive ? 'scale-110 z-50' : 'scale-100'}
                                    `}
                                    style={{
                                        transform: `translate(-50%, ${yOffset > 0 ? yOffset + 10 : yOffset - 10}px)`
                                    }}
                                >
                                    {/* Bubble Content */}
                                    <div className={`
                                        flex items-center gap-2 px-2.5 py-1.5 rounded-xl shadow-sm border backdrop-blur-md cursor-pointer transition-all
                                        ${node.type === 'TIMEOUT' 
                                            ? 'bg-slate-100 dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700' 
                                            : `${theme.bg} ${theme.text} ${theme.textDark} ${theme.border}`}
                                        ${isActive ? 'shadow-xl ring-2 ring-white/50 dark:ring-white/10 scale-105' : 'hover:shadow-md'}
                                    `}>
                                        {getIcon(node)}
                                        <div className="flex flex-col leading-none">
                                            {node.player ? (
                                                <span className={`text-[10px] font-black uppercase tracking-wider truncate max-w-[100px]`}>
                                                    {node.player}
                                                </span>
                                            ) : (
                                                <span className="text-[10px] font-black uppercase tracking-wider">
                                                    {node.team === 'A' ? match.teamAName : match.teamBName}
                                                </span>
                                            )}
                                            {/* Skill / Desc */}
                                            {node.description && <span className="text-[8px] opacity-80 uppercase tracking-tight mt-0.5">{node.description}</span>}
                                        </div>
                                    </div>

                                    {/* Context Info (Time/Score) - Always visible but dimmed if inactive */}
                                    <motion.div 
                                        className={`
                                            flex items-center gap-2 bg-slate-800 text-white text-[9px] font-mono px-2 py-1 rounded-md shadow-md
                                            ${node.isTop ? 'order-first mb-1' : 'order-last mt-1'}
                                        `}
                                        animate={{ opacity: isActive ? 1 : 0.6, scale: isActive ? 1 : 0.95 }}
                                    >
                                        <span className="opacity-70">{node.timeLabel}</span>
                                        <span className="w-px h-2 bg-white/20" />
                                        <span className="font-bold text-amber-400">{node.scoreSnapshot}</span>
                                    </motion.div>
                                </div>

                            </motion.div>
                        );
                    })}
                </motion.div>
            </div>
        </div>
    </div>
  );
};
