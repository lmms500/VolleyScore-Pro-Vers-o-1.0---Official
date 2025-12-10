import React, { memo, useRef } from 'react';
import { Volleyball, Timer, Skull, TrendingUp, Zap, Crown } from 'lucide-react';
import { motion, AnimatePresence, LayoutGroup } from 'framer-motion';
import { useTranslation } from '../../contexts/LanguageContext';
import { resolveTheme } from '../../utils/colors';
import { TeamColor } from '../../types';
import { useTimer } from '../../contexts/TimerContext';

interface FloatingTopBarProps {
  currentSet: number;
  isTieBreak: boolean;
  onToggleTimer: () => void;
  onResetTimer: () => void;
  isTimerRunning: boolean;
  teamNameA: string;
  teamNameB: string;
  colorA: TeamColor;
  colorB: TeamColor;
  isServingLeft: boolean;
  isServingRight: boolean;
  onSetServerA: () => void;
  onSetServerB: () => void;
  timeoutsA: number;
  timeoutsB: number;
  onTimeoutA: () => void;
  onTimeoutB: () => void;
  isMatchPointA: boolean;
  isSetPointA: boolean;
  isMatchPointB: boolean;
  isSetPointB: boolean;
  isDeuce: boolean;
  inSuddenDeath: boolean;
  reverseLayout: boolean; // New prop to control visual order
}

const formatTime = (seconds: number) => {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
};

// --- SUB-COMPONENTS ---

const TimeoutDots = memo<{ count: number; colorTheme: any }>(({ count, colorTheme }) => (
  <div className="flex gap-1 justify-center">
    {[1, 2].map(i => {
      const isUsed = i <= count;
      return (
        <motion.div
          key={i}
          layout
          className={`
            w-1.5 h-1.5 rounded-full transition-colors
            ${isUsed 
                ? 'bg-slate-300 dark:bg-white/10' 
                : `${colorTheme.bg.replace('/10', '')} ${colorTheme.text} dark:${colorTheme.halo}`}
          `}
        />
      );
    })}
  </div>
));

const TimeoutButton = memo<{
  timeouts: number;
  onTimeout: () => void;
  color: TeamColor;
  id: string;
}>(({ timeouts, onTimeout, color, id }) => {
    const theme = resolveTheme(color);
    return (
      <motion.button
        layout
        layoutId={`timeout-btn-${id}`} 
        transition={{ type: "spring", stiffness: 350, damping: 30 }}
        whileTap={{ scale: 0.92 }}
        onClick={(e) => { e.stopPropagation(); onTimeout(); }}
        className={`
           flex flex-col items-center justify-center p-1.5 rounded-xl
           hover:bg-black/5 dark:hover:bg-white/10 border border-transparent hover:border-black/5 dark:hover:border-white/5
           ${timeouts >= 2 ? 'opacity-30 cursor-not-allowed grayscale' : 'opacity-100 cursor-pointer'}
           w-10 h-full flex-shrink-0 transition-colors gap-1.5
        `}
      >
        <div className={`p-1.5 rounded-lg ${theme.bg} ${theme.text}`}>
          <Timer size={16} />
        </div>
        <TimeoutDots count={timeouts} colorTheme={theme} />
      </motion.button>
    );
});

const TeamInfoSmart = memo<{
  name: string;
  color: TeamColor;
  isServing: boolean;
  onSetServer: () => void;
  align: 'left' | 'right';
  isMatchPoint: boolean;
  isSetPoint: boolean;
  id: string; 
}>(({ name, color, isServing, onSetServer, align, isMatchPoint, isSetPoint, id }) => {
  const { t } = useTranslation();
  const theme = resolveTheme(color);
  
  const isCritical = isMatchPoint || isSetPoint;
  
  const badgeClass = isMatchPoint 
    ? 'bg-amber-500 text-white shadow-amber-500/30' 
    : `${theme.bg.replace('/10', '')} text-white shadow-${color}-500/30`;

  return (
    <motion.div 
      layout
      layoutId={`team-info-${id}`}
      transition={{ type: "spring", stiffness: 350, damping: 30 }}
      className={`flex flex-col items-center justify-center relative min-w-0 flex-1 h-full py-1`}
    >
      <div 
        className={`flex items-center gap-3 cursor-pointer group h-full w-full relative overflow-visible ${align === 'right' ? 'flex-row-reverse' : ''} px-2`}
        onClick={(e) => { e.stopPropagation(); onSetServer(); }}
      >
        
        {/* Name & Badge Container */}
        <div className={`flex flex-col ${align === 'right' ? 'items-start' : 'items-end'} min-w-0 flex-1`}>
            <span className={`text-sm md:text-base font-black uppercase tracking-wider text-slate-800 dark:text-slate-200 transition-colors truncate block leading-tight`}>
                {name}
            </span>
            
            <AnimatePresence>
                {isCritical && (
                    <motion.div
                        initial={{ opacity: 0, height: 0, scale: 0.8 }}
                        animate={{ opacity: 1, height: 'auto', scale: 1 }}
                        exit={{ opacity: 0, height: 0, scale: 0.8 }}
                        className={`flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wider mt-0.5 ${badgeClass}`}
                    >
                        {isMatchPoint ? <Crown size={10} fill="currentColor" /> : <Zap size={10} fill="currentColor" />}
                        <span>{isMatchPoint ? t('status.match_point') : t('status.set_point')}</span>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>

        {/* Serving Indicator */}
        <div className="relative w-6 h-6 flex items-center justify-center flex-shrink-0">
             <div className={`w-1 h-1 rounded-full opacity-20 ${theme.halo}`} />
             
             <AnimatePresence>
                {isServing && (
                    <motion.div
                        key="serve-ball"
                        initial={{ scale: 0, rotate: -180 }}
                        animate={{ scale: 1, rotate: 0 }}
                        exit={{ scale: 0, rotate: 180 }}
                        transition={{ type: "spring", stiffness: 300, damping: 20 }}
                        className={`absolute inset-0 flex items-center justify-center ${theme.text}`}
                    >
                        <Volleyball size={18} className="drop-shadow-sm" fill="currentColor" fillOpacity={0.1} />
                        <motion.div 
                            className={`absolute inset-0 rounded-full border-2 ${theme.border} opacity-50`}
                            animate={{ scale: [1, 1.4], opacity: [0.5, 0] }}
                            transition={{ repeat: Infinity, duration: 1.5 }}
                        />
                    </motion.div>
                )}
             </AnimatePresence>
        </div>

      </div>
    </motion.div>
  );
});

const CenterDisplayStealth = memo<{
  isTimerRunning: boolean;
  onToggleTimer: () => void;
  onResetTimer: () => void;
  currentSet: number;
  isTieBreak: boolean;
  inSuddenDeath: boolean;
  isDeuce: boolean;
}>(({ isTimerRunning, onToggleTimer, onResetTimer, currentSet, isTieBreak, inSuddenDeath, isDeuce }) => {
  const { t } = useTranslation();
  const { seconds } = useTimer();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  let key = 'timer';
  let content = null;

  const StatusPill = ({ icon: Icon, text, colorClass, borderClass, bgClass, animateIcon }: any) => (
      <div className={`flex flex-col items-center justify-center gap-0.5 px-2 py-1 rounded-xl border backdrop-blur-md ${borderClass} ${bgClass} shadow-lg w-full h-full`}>
           <motion.div 
             animate={animateIcon}
             transition={{ duration: 1.5, repeat: Infinity }}
             className="flex-shrink-0"
           >
              <Icon size={14} className={colorClass} strokeWidth={3} />
           </motion.div>
           <span className={`text-[8px] font-black uppercase tracking-tight leading-none ${colorClass} text-center`}>
             {text}
           </span>
      </div>
  );

  const handlePointerDown = (e: React.PointerEvent) => {
      e.preventDefault();
      timerRef.current = setTimeout(() => {
          onResetTimer();
      }, 800);
  };

  const handlePointerUp = (e: React.PointerEvent) => {
      if (timerRef.current) {
          clearTimeout(timerRef.current);
          timerRef.current = null;
          onToggleTimer();
      }
  };

  const handlePointerLeave = () => {
      if (timerRef.current) {
          clearTimeout(timerRef.current);
          timerRef.current = null;
      }
  };

  if (inSuddenDeath) {
    key = 'sudden-death';
    content = <StatusPill icon={Skull} text={t('status.sudden_death')} colorClass="text-red-600 dark:text-red-200" borderClass="border-red-500/30" bgClass="bg-red-100 dark:bg-red-900/60" animateIcon={{ scale: [1, 1.15, 1], rotate: [0, 5, -5, 0] }} />;
  } else if (isDeuce) {
    key = 'deuce';
    content = <StatusPill 
        icon={TrendingUp} 
        text="DEUCE" 
        colorClass="text-cyan-600 dark:text-cyan-200" 
        borderClass="border-cyan-500/30" 
        bgClass="bg-cyan-100 dark:bg-cyan-900/40" 
        animateIcon={{ y: [-2, 2, -2] }} 
    />;
  } else {
    content = (
      <button 
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerLeave}
        className="flex flex-col items-center justify-center group w-full h-full gap-0.5 touch-none active:scale-95 transition-transform"
      >
        <motion.span 
            layout
            className={`font-mono text-lg font-bold tabular-nums leading-none tracking-tight transition-all duration-300 ${isTimerRunning ? 'text-slate-900 dark:text-white' : 'text-slate-400'}`}
        >
            {formatTime(seconds)}
        </motion.span>
        <motion.span 
            layout
            className={`text-[9px] font-bold uppercase tracking-[0.1em] flex items-center gap-1 ${isTieBreak ? 'text-amber-500' : 'text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300'}`}
        >
            {isTieBreak ? 'TIE BREAK' : `SET ${currentSet}`}
        </motion.span>
      </button>
    );
  }

  return (
    <div className="flex items-center justify-center h-full w-full relative">
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={key}
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.8 }}
          transition={{ duration: 0.25, ease: "backOut" }}
          className="w-full flex justify-center h-full"
        >
          {content}
        </motion.div>
      </AnimatePresence>
    </div>
  );
});

// --- MAIN COMPONENT ---

export const FloatingTopBar: React.FC<FloatingTopBarProps> = memo((props) => {
  // Ultra Glassy
  const glassContainer = "bg-white/80 dark:bg-[#020617]/80 backdrop-blur-xl border border-white/20 dark:border-white/10 shadow-[0_4px_30px_rgba(0,0,0,0.1)] ring-1 ring-black/5 dark:ring-white/5";

  return (
    <div className="fixed top-4 left-0 w-full z-[55] flex justify-center pointer-events-none px-4">
        <LayoutGroup>
            <motion.div 
                layout
                transition={{ type: "spring", stiffness: 350, damping: 30 }}
                className={`
                    pointer-events-auto
                    w-full max-w-xl
                    ${glassContainer}
                    rounded-[2rem]
                    px-2 py-2
                    flex items-stretch justify-between gap-1
                    min-h-[64px]
                    relative
                    overflow-visible
                `}
            >
                {/* 
                    SWAP LOGIC:
                    We physically reorder the components in the DOM based on reverseLayout.
                    Framer Motion's LayoutGroup + layoutId on the internal components 
                    will automatically animate them moving to their new positions.
                */}
                
                {/* Left Side (Can be A or B) */}
                <TeamInfoSmart 
                    id={props.reverseLayout ? "B" : "A"} 
                    name={props.reverseLayout ? props.teamNameB : props.teamNameA} 
                    color={props.reverseLayout ? props.colorB : props.colorA} 
                    isServing={props.isServingLeft} 
                    onSetServer={props.reverseLayout ? props.onSetServerB : props.onSetServerA} 
                    align="left"
                    isMatchPoint={props.reverseLayout ? props.isMatchPointB : props.isMatchPointA}
                    isSetPoint={props.reverseLayout ? props.isSetPointB : props.isSetPointA}
                />
                
                {/* Divider & Timeout (Left Side) */}
                <div className="flex items-center gap-1 shrink-0 border-l border-black/5 dark:border-white/10 pl-1">
                    <TimeoutButton 
                        id={props.reverseLayout ? "B" : "A"}
                        timeouts={props.reverseLayout ? props.timeoutsB : props.timeoutsA} 
                        onTimeout={props.reverseLayout ? props.onTimeoutB : props.onTimeoutA} 
                        color={props.reverseLayout ? props.colorB : props.colorA}
                    />
                </div>

                {/* Center Timer (Always centered) */}
                <div className="shrink-0 z-10 mx-1 flex items-center">
                    <div className="bg-slate-100/50 dark:bg-white/5 rounded-2xl border border-black/5 dark:border-white/5 w-[80px] h-full flex justify-center items-center">
                        <CenterDisplayStealth 
                            isTimerRunning={props.isTimerRunning}
                            onToggleTimer={props.onToggleTimer}
                            onResetTimer={props.onResetTimer}
                            currentSet={props.currentSet}
                            isTieBreak={props.isTieBreak}
                            isDeuce={props.isDeuce}
                            inSuddenDeath={props.inSuddenDeath}
                        />
                    </div>
                </div>

                {/* Divider & Timeout (Right Side) */}
                <div className="flex items-center gap-1 shrink-0 border-r border-black/5 dark:border-white/10 pr-1">
                    <TimeoutButton 
                        id={props.reverseLayout ? "A" : "B"}
                        timeouts={props.reverseLayout ? props.timeoutsA : props.timeoutsB} 
                        onTimeout={props.reverseLayout ? props.onTimeoutA : props.onTimeoutB} 
                        color={props.reverseLayout ? props.colorA : props.colorB}
                    />
                </div>

                {/* Right Side (Can be B or A) */}
                <TeamInfoSmart 
                    id={props.reverseLayout ? "A" : "B"} 
                    name={props.reverseLayout ? props.teamNameA : props.teamNameB} 
                    color={props.reverseLayout ? props.colorA : props.colorB} 
                    isServing={props.isServingRight} 
                    onSetServer={props.reverseLayout ? props.onSetServerA : props.onSetServerB} 
                    align="right"
                    isMatchPoint={props.reverseLayout ? props.isMatchPointA : props.isMatchPointB}
                    isSetPoint={props.reverseLayout ? props.isSetPointA : props.isSetPointB}
                />

            </motion.div>
        </LayoutGroup>
    </div>
  );
});