
import React, { memo, useState, useCallback, useRef } from 'react';
import { Team, TeamId, SkillType, GameConfig, TeamColor } from '../types';
import { Volleyball, Zap, Timer, Skull, TrendingUp, Trophy } from 'lucide-react';
import { useScoreGestures } from '../hooks/useScoreGestures';
import { useTranslation } from '../contexts/LanguageContext';
import { useGameAudio } from '../hooks/useGameAudio';
import { useHaptics } from '../hooks/useHaptics';
import { ScoreTicker } from './ui/ScoreTicker';
import { GlassSurface } from './ui/GlassSurface';
import { GestureHint } from './ui/GestureHint';
import { motion, AnimatePresence } from 'framer-motion';
import { stampVariants, springPremium, pulseHeartbeat } from '../utils/animations';
import { ScoutModal } from './modals/ScoutModal';
import { resolveTheme } from '../utils/colors';

interface ScoreCardNormalProps {
  teamId: TeamId;
  team: Team;
  score: number;
  setsWon: number;
  isServing: boolean;
  onAdd: (teamId: TeamId, playerId?: string, skill?: SkillType) => void;
  onSubtract: () => void;
  onSetServer: () => void;
  timeouts: number;
  onTimeout: () => void;
  isMatchPoint: boolean;
  isSetPoint: boolean;
  isDeuce?: boolean;
  inSuddenDeath?: boolean;
  setsNeededToWin: number;
  colorTheme?: TeamColor; 
  isLocked?: boolean;
  onInteractionStart?: () => void;
  onInteractionEnd?: () => void;
  config: GameConfig;
}

export const ScoreCardNormal: React.FC<ScoreCardNormalProps> = memo(({
  teamId, team, score, setsWon, isServing, onAdd, onSubtract, onSetServer, timeouts, onTimeout, 
  isMatchPoint, isSetPoint, isDeuce, inSuddenDeath, setsNeededToWin, 
  isLocked = false, onInteractionStart, onInteractionEnd, config, colorTheme
}) => {
  const { t } = useTranslation();
  const audio = useGameAudio(config);
  const haptics = useHaptics(true);
  
  const [showScout, setShowScout] = useState(false);
  const [isInteractionLocked, setIsInteractionLocked] = useState(false);
  const [isTouching, setIsTouching] = useState(false);
  const [ripple, setRipple] = useState<{ x: number, y: number, id: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleScoutClose = useCallback(() => {
     setShowScout(false);
     setIsInteractionLocked(true);
     setTimeout(() => setIsInteractionLocked(false), 300);
  }, []);

  const handleAddWrapper = useCallback(() => {
    if (isInteractionLocked) return;
    
    // Tap Feedback (Immediate UI feedback only)
    // The orchestration of game event sounds (Score, Match Point, etc.) is handled by useSensoryFX hook
    audio.playTap();

    if (config.enablePlayerStats) {
        haptics.impact('light');
        setShowScout(true);
    } else {
        onAdd(teamId);
    }
  }, [config.enablePlayerStats, onAdd, teamId, audio, haptics, isInteractionLocked]);

  const handleScoutConfirm = useCallback((pid: string, skill: SkillType) => {
    onAdd(teamId, pid, skill);
    // Audio handled by state change in useSensoryFX
  }, [onAdd, teamId]);

  const handleSubtractWrapper = useCallback(() => {
      onSubtract();
      // Undo audio handled by App.tsx wrapper usually, but redundancy here is fine as it's a specific gesture
  }, [onSubtract]);

  const handleTouchStart = useCallback((e: React.PointerEvent) => {
      setIsTouching(true);
      onInteractionStart?.();

      if (containerRef.current) {
          const rect = containerRef.current.getBoundingClientRect();
          setRipple({
              x: e.clientX - rect.left,
              y: e.clientY - rect.top,
              id: Date.now()
          });
      }
  }, [onInteractionStart]);

  const handleTouchEnd = useCallback(() => {
      setIsTouching(false);
      onInteractionEnd?.();
  }, [onInteractionEnd]);

  const gestureHandlers = useScoreGestures({
    onAdd: handleAddWrapper, 
    onSubtract: handleSubtractWrapper, 
    isLocked: isLocked || isInteractionLocked, 
    onInteractionStart: handleTouchStart, 
    onInteractionEnd: handleTouchEnd
  });

  const resolvedColor = colorTheme || team.color || 'slate';
  const theme = resolveTheme(resolvedColor);
  
  const timeoutsExhausted = timeouts >= 2;
  const isCritical = isMatchPoint || isSetPoint;

  let badgeConfig = null;
  if (inSuddenDeath) {
      badgeConfig = { icon: Skull, text: t('status.sudden_death'), className: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20' };
  } else if (isMatchPoint) {
      badgeConfig = { icon: Trophy, text: t('status.match_point'), className: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20 shadow-amber-500/10 shadow-lg' };
  } else if (isSetPoint) {
      badgeConfig = { icon: Zap, text: t('status.set_point'), className: `${theme.bg} ${theme.text} ${theme.textDark} ${theme.border}` };
  } else if (isDeuce) {
      badgeConfig = { icon: TrendingUp, text: t('status.deuce_advantage'), className: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-300 border-indigo-500/20' };
  }

  const haloColorClass = isMatchPoint ? 'bg-amber-500 saturate-150' : theme.halo;

  return (
    <GlassSurface 
        layout
        layoutId={`score-card-normal-${teamId}`}
        intensity="transparent"
        transition={{ type: "spring", stiffness: 120, damping: 20, mass: 1 }}
        className={`
            flex flex-col flex-1 relative h-full select-none
            rounded-[2.5rem] overflow-visible
            transition-[opacity,filter] duration-300
            ${isLocked ? 'opacity-40 grayscale' : ''} 
        `}
        style={{ overflow: 'visible' }}
        lowGraphics={config.lowGraphics}
    >
      <ScoutModal isOpen={showScout} onClose={handleScoutClose} team={team} onConfirm={handleScoutConfirm} colorTheme={team.color || 'indigo'} />
      
      <div className="flex flex-col h-full w-full relative z-10 py-1 px-2 justify-between items-center overflow-visible">
        
        {/* HEADER: Sets & Name */}
        <div className="flex flex-col items-center justify-center w-full flex-none order-1 mt-3 space-y-1 relative z-30">
            <div className="flex gap-2 mb-1">
                {[...Array(setsNeededToWin)].map((_, i) => (
                    <motion.div 
                        key={i} 
                        initial={false}
                        animate={{ 
                            scale: i < setsWon ? 1.2 : 1,
                            backgroundColor: i < setsWon ? 'var(--theme-color)' : 'transparent',
                            borderColor: i < setsWon ? 'transparent' : 'currentColor'
                        }}
                        className={`
                            w-1.5 h-1.5 rounded-full border transition-all duration-500
                            ${i < setsWon ? `${theme.halo} shadow-[0_0_8px_currentColor]` : 'border-slate-300 dark:border-slate-700 opacity-40'}
                        `} 
                    />
                ))}
            </div>

            <motion.div 
                layout 
                className="w-full flex items-center justify-center gap-2 cursor-pointer group px-4 py-1.5 rounded-2xl hover:bg-black/5 dark:hover:bg-white/5 transition-colors max-w-full overflow-hidden"
                onClick={(e) => { 
                    e.stopPropagation(); 
                    onSetServer(); 
                    haptics.impact('light');
                }}
            >
                <motion.h2 layout className="font-black uppercase text-center text-lg md:text-xl text-slate-800 dark:text-slate-200 tracking-wider truncate min-w-0">
                    {team?.name || ''}
                </motion.h2>
                <AnimatePresence>
                  {isServing && (
                    <motion.div
                      initial={{ scale: 0, opacity: 0, rotate: -90 }}
                      animate={{ scale: 1, opacity: 1, rotate: 0 }}
                      exit={{ scale: 0, opacity: 0, rotate: 90 }}
                      transition={springPremium}
                      className="flex-shrink-0"
                    >
                        <Volleyball size={14} className={`${theme.text} ${theme.textDark}`} strokeWidth={2.5} />
                    </motion.div>
                  )}
                </AnimatePresence>
            </motion.div>
        </div>

        {/* BADGE AREA */}
        <div className="order-2 min-h-[30px] flex items-center justify-center w-full my-1 flex-none">
            <AnimatePresence mode="wait">
                {badgeConfig && (
                    <motion.div 
                        variants={stampVariants}
                        initial="hidden" animate="visible" exit="exit"
                        className={`px-3 py-1.5 rounded-xl border backdrop-blur-md font-bold uppercase tracking-widest text-[9px] flex items-center gap-1.5 shadow-sm ${badgeConfig.className}`}
                    >
                        <badgeConfig.icon size={10} strokeWidth={3} />
                        {badgeConfig.text}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>

        {/* MAIN SCORE INTERACTIVE AREA */}
        <div 
            ref={containerRef}
            className="relative order-3 flex flex-col justify-center items-center w-full flex-1 min-h-0 cursor-pointer overflow-visible isolate"
            style={{ touchAction: 'none' }}
            {...gestureHandlers}
        >
            <GestureHint isVisible={isTouching} />

            {/* Tap Ripple Effect (Behind Number) */}
            <AnimatePresence>
                {ripple && (
                    <motion.div
                        key={ripple.id}
                        initial={{ scale: 0, opacity: 0.3 }}
                        animate={{ scale: 1.5, opacity: 0 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.3, ease: "easeOut" }}
                        className="absolute w-8 h-8 rounded-full bg-white pointer-events-none z-0 mix-blend-overlay"
                        style={{
                            left: ripple.x,
                            top: ripple.y,
                            x: '-50%',
                            y: '-50%'
                        }}
                    />
                )}
            </AnimatePresence>

            <div className="grid place-items-center w-full h-full relative z-10 pointer-events-none">
                {/* HALO */}
                <motion.div 
                    layout 
                    className={`
                        col-start-1 row-start-1
                        rounded-full pointer-events-none z-0 aspect-square
                        will-change-[transform,opacity]
                        ${haloColorClass}
                        ${config.lowGraphics ? 'blur-[40px]' : 'blur-[60px] md:blur-[80px] mix-blend-screen'}
                    `}
                    style={{ 
                        width: 'auto',
                        height: '70%', 
                        minHeight: '100px',
                        maxHeight: '280px'
                    }}
                    initial={false}
                    animate={config.lowGraphics ? {
                        opacity: isCritical ? 0.6 : (isServing ? 0.3 : 0),
                        scale: 1
                    } : { 
                        opacity: isCritical ? [0.4, 0.8, 0.4] : (isServing ? 0.35 : 0),
                        scale: isCritical ? [1, 1.15, 1] : 1,
                    }}
                    transition={config.lowGraphics ? undefined : { 
                        duration: isCritical ? 2 : 0.5, 
                        repeat: isCritical ? Infinity : 0, 
                        ease: "easeInOut" 
                    }}
                />
                
                {/* ANIMATED NUMBER */}
                <div className="col-start-1 row-start-1 relative z-20 w-full flex justify-center items-center h-full">
                    <motion.div
                        layout
                        variants={config.lowGraphics ? undefined : pulseHeartbeat}
                        animate={(!config.lowGraphics && isCritical) ? "pulse" : "idle"}
                        className="flex items-center justify-center w-full"
                    >
                        <ScoreTicker 
                            value={score}
                            className={`
                                font-black tracking-tighter outline-none select-none
                                text-8xl md:text-9xl lg:text-[10rem] leading-none
                                text-slate-900 dark:text-white
                                ${isMatchPoint ? 'drop-shadow-[0_0_30px_rgba(251,191,36,0.5)]' : ''}
                            `}
                        />
                    </motion.div>
                </div>
            </div>
        </div>

        {/* FOOTER: Timeouts */}
        <div className="order-4 w-full flex justify-center pb-4 flex-none">
           <button 
             type="button"
             onClick={(e) => { 
                 e.stopPropagation(); 
                 if(!timeoutsExhausted) {
                     onTimeout();
                     // Standard light tap feedback only. Warning feedback/sound handled by SensoryFX on state change.
                     haptics.impact('light');
                 }
             }}
             disabled={timeoutsExhausted}
             className={`
                flex items-center gap-3 px-4 py-2 rounded-2xl transition-all border border-transparent
                ${timeoutsExhausted ? 'opacity-20 grayscale cursor-not-allowed' : 'hover:bg-white/50 dark:hover:bg-white/10 hover:border-black/5 dark:hover:border-white/5 active:scale-95'}
             `}
           >
              <Timer size={14} className="text-slate-400 dark:text-slate-500" strokeWidth={2} />
              <div className="flex gap-1.5">
                {[1, 2].map(t => (
                    <div key={t} className={`w-1.5 h-1.5 rounded-full transition-all ${t <= timeouts ? 'bg-slate-300 dark:bg-slate-700' : `${theme.halo} shadow-[0_0_5px_currentColor]`}`} />
                ))}
              </div>
           </button>
        </div>

      </div>
    </GlassSurface>
  );
});
