
import React, { useEffect, useRef, useState, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { tickerVariants } from '../../utils/animations';

interface ScoreTickerProps {
  value: number;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * ScoreTicker v3.1 (Polish Edition)
 * 
 * Performance Update:
 * - Added `transform: translateZ(0)` to force hardware acceleration.
 * - Added `tabular-nums` class to ensure monospaced numeric width (prevents wobble).
 */
export const ScoreTicker: React.FC<ScoreTickerProps> = memo(({ value, className, style }) => {
  const prevValue = useRef(value);
  const [direction, setDirection] = useState(0);

  useEffect(() => {
    if (value !== prevValue.current) {
      if (value > prevValue.current) {
        setDirection(1); 
      } else {
        setDirection(-1); 
      }
      prevValue.current = value;
    }
  }, [value]);

  return (
    <div 
        className={`relative inline-flex justify-center items-center tabular-nums ${className}`} 
        style={{ 
            ...style,
            height: '2.5em', 
            minWidth: '1.2em', 
            padding: '0.8em',
            margin: '-0.8em',
            isolation: 'isolate',
            maskImage: 'linear-gradient(to bottom, transparent 0%, black 15%, black 85%, transparent 100%)',
            WebkitMaskImage: 'linear-gradient(to bottom, transparent 0%, black 15%, black 85%, transparent 100%)',
            overflow: 'visible',
            fontVariantNumeric: 'tabular-nums', // Enforce monospace numbers
            // HARDWARE ACCELERATION HINT
            willChange: 'transform'
        }}
    >
      <AnimatePresence mode="popLayout" custom={direction} initial={false}>
        <motion.span
          key={value}
          custom={direction}
          variants={tickerVariants}
          initial="enter"
          animate="center"
          exit="exit"
          className="block text-center leading-none origin-center absolute inset-0 flex items-center justify-center tabular-nums"
          style={{ 
              willChange: "transform, opacity", 
              backfaceVisibility: "hidden",
              WebkitBackfaceVisibility: "hidden",
              // Force GPU layer promotion
              transform: 'translateZ(0)'
          }} 
        >
          {value}
        </motion.span>
      </AnimatePresence>
    </div>
  );
});
