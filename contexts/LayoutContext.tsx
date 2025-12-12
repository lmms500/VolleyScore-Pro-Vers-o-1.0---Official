import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';

type LayoutMode = 'normal' | 'compact' | 'ultra';

export interface ColliderRect {
  id: string;
  rect: DOMRect;
}

interface LayoutState {
  mode: LayoutMode;
  scale: number;
  safeAreaTop: number;
  safeAreaBottom: number;
  isLandscape: boolean;
  scoreCenterOffset: number;
  colliders: ColliderRect[];
}

interface LayoutContextType extends LayoutState {
  registerElement: (id: string, width: number, height: number) => void;
  registerCollider: (id: string, element: HTMLElement | null) => void;
}

const LayoutContext = createContext<LayoutContextType | undefined>(undefined);

export const LayoutProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [measurements, setMeasurements] = useState<Record<string, { w: number; h: number }>>({});
  const [windowSize, setWindowSize] = useState({ w: window.innerWidth, h: window.innerHeight });
  const [colliders, setColliders] = useState<ColliderRect[]>([]);

  // Update window size & colliders on resize/scroll
  useEffect(() => {
    const handleResize = () => {
        setWindowSize({ w: window.innerWidth, h: window.innerHeight });
        // Trigger a re-measure of colliders (this is a simplified approach, 
        // normally we'd need refs to re-measure but components will re-register on render)
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const registerElement = useCallback((id: string, width: number, height: number) => {
    setMeasurements(prev => {
      if (prev[id]?.w === width && prev[id]?.h === height) return prev;
      return { ...prev, [id]: { w: width, h: height } };
    });
  }, []);

  const registerCollider = useCallback((id: string, element: HTMLElement | null) => {
      if (!element) {
          setColliders(prev => prev.filter(c => c.id !== id));
          return;
      }
      
      // Throttle/Debounce could be added here if needed, but for now we trust effects
      const rect = element.getBoundingClientRect();
      setColliders(prev => {
          const idx = prev.findIndex(c => c.id === id);
          if (idx !== -1) {
              // Update existing
              const copy = [...prev];
              copy[idx] = { id, rect };
              return copy;
          }
          return [...prev, { id, rect }];
      });
  }, []);

  const layoutState = useMemo((): LayoutState => {
    const { w: winW, h: winH } = windowSize;
    const isLandscape = winW > winH;
    
    const safeTop = isLandscape ? 20 : 40; 
    const safeBottom = isLandscape ? 20 : 40;

    const topBarH = measurements['topbar']?.h || 60;
    const controlsH = measurements['controls']?.h || 80;
    const nameH = Math.max(measurements['nameA']?.h || 0, measurements['nameB']?.h || 0);
    const scoreH = Math.max(measurements['scoreA']?.h || 0, measurements['scoreB']?.h || 0);

    const centerToTop = winH / 2;
    const centerToBottom = winH / 2;

    const requiredTop = (scoreH / 2) + nameH + topBarH + (isLandscape ? 20 : 40); 
    const requiredBottom = (scoreH / 2) + controlsH + (isLandscape ? 20 : 40);

    let mode: LayoutMode = 'normal';
    let scale = 1;

    if (requiredTop > centerToTop || requiredBottom > centerToBottom) {
        mode = 'compact';
        const compactFactor = 0.85;
        if ((requiredTop * compactFactor) > centerToTop || (requiredBottom * compactFactor) > centerToBottom) {
             mode = 'ultra';
             const overflowRatioTop = centerToTop / (requiredTop * 0.75); 
             const overflowRatioBottom = centerToBottom / (requiredBottom * 0.75);
             const worstCase = Math.min(overflowRatioTop, overflowRatioBottom);
             if (worstCase < 1) {
                 scale = Math.max(0.6, worstCase - 0.05); 
             }
        }
    }

    return {
        mode,
        scale,
        safeAreaTop: safeTop,
        safeAreaBottom: safeBottom,
        isLandscape,
        scoreCenterOffset: 0,
        colliders
    };

  }, [measurements, windowSize, colliders]);

  const value = useMemo(() => ({ ...layoutState, registerElement, registerCollider }), [layoutState, registerElement, registerCollider]);

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