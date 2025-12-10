

import React, { useLayoutEffect, useRef, memo } from 'react';
import { motion } from 'framer-motion';
import { TeamColor } from '../../types';
import { resolveTheme } from '../../utils/colors';

interface TrackingGlowProps {
  targetRef: React.RefObject<HTMLElement>;
  colorTheme: TeamColor;
  isServing: boolean;
  isCritical: boolean;
  isMatchPoint: boolean;
  isPressed: boolean;
}

export const TrackingGlow: React.FC<TrackingGlowProps> = memo(({
  targetRef,
  colorTheme,
  isServing,
  isCritical,
  isMatchPoint,
  isPressed
}) => {
  const glowRef = useRef<HTMLDivElement>(null);
  // We use a ref to track the last applied size to avoid DOM thrashing if it hasn't changed
  const lastSizeRef = useRef(0);

  // High-performance loop to track the target element
  // Completely detached from React State to prevent re-renders per frame
  useLayoutEffect(() => {
    let rAFId: number;
    let isRunning = true;

    const updatePosition = () => {
      if (!isRunning) return;

      if (targetRef.current && glowRef.current) {
        const targetRect = targetRef.current.getBoundingClientRect();
        
        // Calculate absolute center
        const centerX = targetRect.left + targetRect.width / 2;
        const centerY = targetRect.top + targetRect.height / 2;
        
        // Determine size based on the height of the number (proportional scaling)
        // Using height is more stable for variable width fonts/numbers
        const calculatedSize = targetRect.height * 1.5; 
        
        // Direct DOM manipulation (GPU friendly composite properties)
        glowRef.current.style.transform = `translate3d(${centerX}px, ${centerY}px, 0) translate(-50%, -50%)`;
        
        // Only touch width/height if significantly changed to reduce layout trashing
        if (Math.abs(calculatedSize - lastSizeRef.current) > 2) {
            glowRef.current.style.width = `${calculatedSize}px`;
            glowRef.current.style.height = `${calculatedSize}px`;
            lastSizeRef.current = calculatedSize;
        }
      }
      rAFId = requestAnimationFrame(updatePosition);
    };

    // Start loop
    rAFId = requestAnimationFrame(updatePosition);

    return () => {
      isRunning = false;
      cancelAnimationFrame(rAFId);
    };
  }, [targetRef]); // Dependency on targetRef ensures we re-bind if the target changes

  const theme = resolveTheme(colorTheme);
  const haloColorClass = isMatchPoint ? 'bg-amber-500 saturate-150' : theme.halo;

  return (
    <motion.div
      ref={glowRef}
      className={`
        fixed top-0 left-0 z-[5] rounded-full aspect-square pointer-events-none
        mix-blend-screen blur-[60px] md:blur-[100px] will-change-transform
        ${haloColorClass}
      `}
      // Framer Motion handles the opacity/scale tweening efficiently
      animate={
        isPressed 
          ? { scale: 1.1, opacity: 0.8 } 
          : isCritical 
            ? { 
                scale: [1, 1.35, 1],
                opacity: isMatchPoint ? [0.6, 1, 0.6] : [0.4, 0.8, 0.4],
              }
            : { 
                scale: 1, 
                opacity: isServing ? 0.4 : 0 
              }
      }
      transition={
        isCritical 
          ? { duration: 1.2, repeat: Infinity, ease: "easeInOut" }
          : { duration: 0.3, ease: "easeOut" }
      }
    />
  );
});