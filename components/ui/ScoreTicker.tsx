
import React, { useEffect, useRef, useState, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { tickerVariants } from '../../utils/animations';

interface ScoreTickerProps {
  value: number;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * ScoreTicker (3D Animated Tumbler)
 * Uses transform perspective to create a mechanical tumbling number effect.
 */
export const ScoreTicker: React.FC<ScoreTickerProps> = memo(({ value, className, style }) => {
  const prevValue = useRef(value);
  const [direction, setDirection] = useState(0);

  useEffect(() => {
    if (value !== prevValue.current) {
      if (value > prevValue.current) {
        setDirection(1); // Moving UP (Next number comes from below)
      } else {
        setDirection(-1); // Moving DOWN (Next number comes from above)
      }
      prevValue.current = value;
    }
  }, [value]);

  return (
    <div 
        className={`relative inline-grid place-items-center ${className}`} 
        style={{ 
            ...style,
            perspective: '600px', // Adds depth for the rotation
            transformStyle: 'preserve-3d',
            isolation: 'isolate' 
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
          className="block w-full text-center leading-none backface-hidden"
          style={{ 
              willChange: "transform, opacity, filter", 
              backfaceVisibility: "hidden", // Clean rotation
              WebkitBackfaceVisibility: "hidden",
              transformOrigin: "50% 50% -0.5em" // Pivot inside the element for volume
          }} 
        >
          {value}
        </motion.span>
      </AnimatePresence>
    </div>
  );
});
