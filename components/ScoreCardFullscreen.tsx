
import React, { useState, memo, useMemo, useRef, useCallback } from 'react';
import { TeamId, Team, SkillType, GameConfig, TeamColor } from '../types';
import { useScoreGestures } from '../hooks/useScoreGestures';
import { ScoreTicker } from './ui/ScoreTicker';
import { motion, AnimatePresence } from 'framer-motion';
import { pulseHeartbeat } from '../utils/animations';
import { useGameAudio } from '../hooks/useGameAudio';
import { useHaptics } from '../hooks/useHaptics';
import { ScoutModal } from './modals/ScoutModal';
import { resolveTheme } from '../utils/colors';
import { useCollider } from '../hooks/useCollider';

interface ScoreCardFullscreenProps {
  teamId: TeamId;
  team: Team; 
  score: number;
  onAdd: (teamId: TeamId, playerId?: string, skill?: SkillType) => void;
  onSubtract: () => void;
  isMatchPoint: boolean;
  isSetPoint: boolean;
  isDeuce?: boolean;
  inSuddenDeath?: boolean;
  colorTheme?: TeamColor; 
  isLocked?: boolean;
  onInteractionStart?: () => void;
  onInteractionEnd?: () => void;
  reverseLayout?: boolean;
  scoreRefCallback?: (node: HTMLElement | null) => void;
  isServing?: boolean;
  config: GameConfig; 
}

const ScoreNumberDisplay = memo(({ 
    score, 
    theme, 
    textEffectClass, 
    isPressed, 
    scoreRefCallback, 
    numberRef, 
    isCritical,
    isMatchPoint,
    isServing,
    colliderRef 
}: any) => {

    const haloColorClass = isMatchPoint ? 'bg-amber-500 saturate-150' : theme.halo;

    return (
        <div 
            className="relative grid place-items-center w-full pointer-events-none overflow-visible" 
            style={{ 
                lineHeight: 1,
            }}
        >
            {/* Background Halo - Behind the number */}
            <motion.div
                className={`
                    col-start-1 row-start-1
                    rounded-full aspect-square pointer-events-none z-0
                    ${haloColorClass}
                    justify-self-center self-center
                    mix-blend-multiply dark:mix-blend-screen
                    blur-[100px] will-change-[transform,opacity]
                `}
                style={{ 
                    width: '1.2em', 
                    height: '1.2em',
                    transform: 'translate3d(0,0,0)'
                }}
                animate={
                    isPressed 
                    ? { scale: 1.1, opacity: 0.6 } 
                    : isCritical 
                        ? { 
                            scale: [1, 1.2, 1],
                            opacity: isMatchPoint ? [0.6, 0.9, 0.6] : [0.4, 0.7, 0.4],
                        }
                        : { 
                            scale: 1, 
                            opacity: isServing ? 0.5 : 0
                        }
                }
                transition={
                    isCritical 
                    ? { duration: 2, repeat: Infinity, ease: "easeInOut" }
                    : { duration: 0.4, ease: "easeOut" }
                }
            />

            {/* The Number - In front of Halo + Collision Target */}
            <motion.div 
                ref={numberRef} 
                className="col-start-1 row-start-1 relative z-10 flex flex-col items-center justify-center will-change-transform overflow-visible"
                variants={pulseHeartbeat}
                animate={isCritical ? "pulse" : "idle"}
            >
                <div ref={scoreRefCallback} className="overflow-visible p-4">
                    {/* COLLIDER IS HERE: Wraps the actual number text */}
                    <div ref={colliderRef}>
                        <ScoreTicker 
                            value={score}
                            className={`
                                font-black leading-none tracking-tighter transition-all duration-300
                                text-slate-900 dark:text-white
                                ${textEffectClass}
                                ${isPressed ? 'scale-95 opacity-90' : ''}
                            `}
                        />
                    </div>
                </div>
            </motion.div>
        </div>
    );
});

export const ScoreCardFullscreen: React.FC<ScoreCardFullscreenProps> = memo(({
  teamId, team, score, onAdd, onSubtract,
  isMatchPoint, isSetPoint, isDeuce, inSuddenDeath, 
  isLocked = false, onInteractionStart, onInteractionEnd, reverseLayout,
  scoreRefCallback, isServing, config, colorTheme
}) => {
  const [isPressed, setIsPressed] = useState(false);
  const [showScout, setShowScout] = useState(false);
  const [isInteractionLocked, setIsInteractionLocked] = useState(false);
  const [ripple, setRipple] = useState<{ x: number, y: number, id: number } | null>(null);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const numberRef = useRef<HTMLDivElement>(null);
  
  // Physics Collider specifically for the fullscreen number
  const colliderRef = useCollider(`sc-fs-${teamId}`);

  const audio = useGameAudio(config);
  const haptics = useHaptics(true);

  const handleStart = useCallback((e: React.PointerEvent) => {
    setIsPressed(true);
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

  const handleEnd = useCallback(() => {
    setIsPressed(false);
    onInteractionEnd?.();
  }, [onInteractionEnd]);

  const handleScoutClose = useCallback(() => {
    setShowScout(false);
    setIsInteractionLocked(true);
    const t = setTimeout(() => setIsInteractionLocked(false), 300);
    return () => clearTimeout(t);
  }, []);

  const handleAddWrapper = useCallback(() => {
      if (isInteractionLocked) return;
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
  }, [onAdd, teamId]);

  const handleSubtractWrapper = useCallback(() => {
      onSubtract();
  }, [onSubtract]);
  
  const gestureHandlers = useScoreGestures({
    onAdd: handleAddWrapper, 
    onSubtract: handleSubtractWrapper, 
    isLocked: isLocked || isInteractionLocked, 
    onInteractionStart: handleStart, 
    onInteractionEnd: handleEnd
  });

  const resolvedColor = colorTheme || team.color || 'slate';
  const theme = resolveTheme(resolvedColor);

  const isCritical = isMatchPoint || isSetPoint;
  
  const textEffectClass = useMemo(() => {
    // Stronger Drop Shadow for better contrast against glow
    if (isMatchPoint) return 'drop-shadow-[0_0_40px_rgba(251,191,36,0.8)]'; 
    return ''; 
  }, [isMatchPoint]);

  const isLeftSide = reverseLayout ? teamId === 'B' : teamId === 'A';

  const containerClasses = isLeftSide
    ? 'left-0 top-0 w-full h-[50dvh] landscape:w-[50vw] landscape:h-[100dvh]' 
    : 'left-0 top-[50dvh] w-full h-[50dvh] landscape:left-[50vw] landscape:top-0 landscape:w-[50vw] landscape:h-[100dvh]';

  const offsetClass = isLeftSide
      ? 'landscape:-translate-x-[6vw]' 
      : 'landscape:translate-x-[6vw]';

  return (
    <>
        <ScoutModal 
            isOpen={showScout}
            onClose={handleScoutClose}
            team={team}
            onConfirm={handleScoutConfirm}
            colorTheme={team.color || 'indigo'}
        />

        <motion.div 
            ref={containerRef}
            layout
            layoutId={`score-card-fs-${teamId}`}
            transition={{ type: "spring", stiffness: 280, damping: 28, mass: 1.2 }}
            className={`
                fixed z-10 flex flex-col justify-center items-center select-none overflow-visible isolate
                ${containerClasses}
            `}
            style={{ 
                touchAction: 'none',
                WebkitUserSelect: 'none',
                userSelect: 'none'
            }}
            {...gestureHandlers}
        >
            <AnimatePresence>
                {ripple && (
                    <motion.div
                        key={ripple.id}
                        initial={{ scale: 0, opacity: 0.3 }}
                        animate={{ scale: 1.5, opacity: 0 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.4, ease: "easeOut" }}
                        className="absolute w-12 h-12 rounded-full bg-white pointer-events-none z-0 mix-blend-overlay"
                        style={{
                            left: ripple.x,
                            top: ripple.y,
                            x: '-50%',
                            y: '-50%'
                        }}
                    />
                )}
            </AnimatePresence>

            <div 
                className={`
                    flex items-center justify-center w-full h-full
                    transition-transform duration-150
                    ${isPressed ? 'scale-95' : 'scale-100'}
                    will-change-transform overflow-visible
                `}
                style={{ 
                    // Reduced min size from 8rem to 5rem to accommodate small landscape screens better without clipping
                    fontSize: 'clamp(5rem, 28vmax, 22rem)',
                    lineHeight: 1
                }}
            >
                <div className={`transform transition-transform duration-500 w-full flex justify-center ${offsetClass}`}>
                    <ScoreNumberDisplay 
                        score={score} 
                        theme={theme} 
                        textEffectClass={textEffectClass} 
                        isPressed={isPressed} 
                        scoreRefCallback={scoreRefCallback} 
                        numberRef={numberRef}
                        isCritical={isCritical}
                        isMatchPoint={isMatchPoint}
                        isServing={isServing}
                        colliderRef={colliderRef}
                    />
                </div>
            </div>
        </motion.div>
    </>
  );
});
