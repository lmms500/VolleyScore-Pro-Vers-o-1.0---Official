import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';

type LayoutMode = 'normal' | 'compact' | 'ultra';

interface LayoutState {
  mode: LayoutMode;
  scale: number;
  safeAreaTop: number;
  safeAreaBottom: number;
  isLandscape: boolean;
  scoreCenterOffset: number; // Offset to keep score strictly centered vs visual correction
}

interface LayoutContextType extends LayoutState {
  registerElement: (id: string, width: number, height: number) => void;
}

const LayoutContext = createContext<LayoutContextType | undefined>(undefined);

export const LayoutProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [measurements, setMeasurements] = useState<Record<string, { w: number; h: number }>>({});
  const [windowSize, setWindowSize] = useState({ w: window.innerWidth, h: window.innerHeight });

  // Update window size with debounce/throttle implicit via React state batching
  useEffect(() => {
    const handleResize = () => setWindowSize({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const registerElement = useCallback((id: string, width: number, height: number) => {
    setMeasurements(prev => {
      // Identity check to avoid unnecessary state updates
      if (prev[id]?.w === width && prev[id]?.h === height) return prev;
      return { ...prev, [id]: { w: width, h: height } };
    });
  }, []);

  const layoutState = useMemo((): LayoutState => {
    const { w: winW, h: winH } = windowSize;
    const isLandscape = winW > winH;
    
    // Default safe areas (simulated for PWA/Notch)
    const safeTop = isLandscape ? 20 : 40; 
    const safeBottom = isLandscape ? 20 : 40;

    // Get critical dimensions
    const topBarH = measurements['topbar']?.h || 60;
    const controlsH = measurements['controls']?.h || 80;
    const nameH = Math.max(measurements['nameA']?.h || 0, measurements['nameB']?.h || 0);
    const scoreH = Math.max(measurements['scoreA']?.h || 0, measurements['scoreB']?.h || 0);

    // Calculate Available Vertical Space
    const centerToTop = winH / 2;
    const centerToBottom = winH / 2;

    // Required space ABOVE center (Half Score + Name + Padding + TopBar)
    const requiredTop = (scoreH / 2) + nameH + topBarH + (isLandscape ? 20 : 40); 
    
    // Required space BELOW center (Half Score + Controls + Padding)
    const requiredBottom = (scoreH / 2) + controlsH + (isLandscape ? 20 : 40);

    let mode: LayoutMode = 'normal';
    let scale = 1;

    // Logic: If overlap, reduce mode, then scale.
    if (requiredTop > centerToTop || requiredBottom > centerToBottom) {
        mode = 'compact';
        // Recalculate with assumed compact savings (approx 20% smaller)
        const compactFactor = 0.85;
        if ((requiredTop * compactFactor) > centerToTop || (requiredBottom * compactFactor) > centerToBottom) {
             mode = 'ultra';
             // If still too big, we must scale everything down
             const overflowRatioTop = centerToTop / (requiredTop * 0.75); // 0.75 is ultra factor
             const overflowRatioBottom = centerToBottom / (requiredBottom * 0.75);
             const worstCase = Math.min(overflowRatioTop, overflowRatioBottom);
             if (worstCase < 1) {
                 scale = Math.max(0.6, worstCase - 0.05); // Add 5% breathing room
             }
        }
    }

    return {
        mode,
        scale,
        safeAreaTop: safeTop,
        safeAreaBottom: safeBottom,
        isLandscape,
        scoreCenterOffset: 0
    };

  }, [measurements, windowSize]);

  // OPTIMIZATION: Memoize value to avoid re-renders
  const value = useMemo(() => ({ ...layoutState, registerElement }), [layoutState, registerElement]);

  return (
    <LayoutContext.Provider value={value}>
      {children}
    </LayoutContext.Provider>
  );
};

export const useLayoutManager = () => {
  const context = useContext(LayoutContext);
  if (!context) {
    throw new Error('useLayoutManager must be used within LayoutProvider');
  }
  return context;
};