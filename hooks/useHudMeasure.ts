
import { useState, useLayoutEffect, useCallback } from 'react';

export interface HudPlacement {
  visible: boolean;
  left: number;
  top: number;
  width: number;
  scale: number;
}

interface UseHudMeasureProps {
  leftScoreEl: HTMLElement | null;
  rightScoreEl: HTMLElement | null;
  enabled?: boolean;
  maxSets: number;
  version?: number;
}

const INITIAL_PLACEMENT: HudPlacement = {
  visible: false,
  left: 0, 
  top: 0, 
  width: 0, 
  scale: 1
};

export function useHudMeasure({
  leftScoreEl,
  rightScoreEl,
  enabled = true,
  maxSets,
  version = 0
}: UseHudMeasureProps): HudPlacement {
  
  const [placement, setPlacement] = useState<HudPlacement>(INITIAL_PLACEMENT);

  const calculateLayout = useCallback(() => {
    // 1. Single Set Mode: Disable HUD
    if (maxSets === 1) {
        setPlacement(prev => prev.visible ? { ...prev, visible: false } : prev);
        return;
    }

    if (!enabled) {
        setPlacement(prev => prev.visible ? { ...prev, visible: false } : prev);
        return;
    }

    const windowW = window.innerWidth;
    const windowH = window.innerHeight;

    // Fixed Centralized Positioning
    const centerX = windowW / 2;
    const centerY = windowH / 2;
    
    // Scale Logic: Ensure it fits on smaller screens
    // UPDATED: Reduced scale factors for a more subtle HUD
    const isPortrait = windowH > windowW;
    
    let scale = 1;
    
    if (isPortrait) {
        // In portrait, width is the constraint
        scale = Math.min(0.85, windowW / 320); 
    } else {
        // In landscape
        scale = Math.min(0.85, windowH / 300); 
    }

    setPlacement({
        visible: true,
        left: centerX,
        top: centerY,
        width: 180, // Reduced nominal width slightly
        scale: Math.max(0.5, scale) 
    });

  }, [enabled, maxSets]);

  useLayoutEffect(() => {
    if (!enabled) return;

    const triggerCalc = () => requestAnimationFrame(calculateLayout);
    
    triggerCalc();
    
    window.addEventListener('resize', triggerCalc);
    window.addEventListener('orientationchange', triggerCalc);
    
    return () => {
      window.removeEventListener('resize', triggerCalc);
      window.removeEventListener('orientationchange', triggerCalc);
    };
  }, [calculateLayout, enabled, version]);

  return placement;
}
