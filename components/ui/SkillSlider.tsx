
import React, { useState, useRef, useEffect, memo } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Star } from 'lucide-react';

interface SkillSliderProps {
  level: number;
  onChange: (level: number) => void;
  disabled?: boolean;
}

// Semantic Colors matching Tailwind Palette
const COLORS = {
  low: '#f43f5e',    // rose-500 (Level 1-3)
  mid: '#f59e0b',    // amber-500 (Level 4-7)
  high: '#10b981'    // emerald-500 (Level 8-10)
};

export const SkillSlider: React.FC<SkillSliderProps> = memo(({ level, onChange, disabled = false }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [position, setPosition] = useState<{ top: number, left: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // 1. Semantic Color Logic
  const getSkillColor = (val: number) => {
    if (val <= 3) return COLORS.low;
    if (val <= 7) return COLORS.mid;
    return COLORS.high;
  };

  const currentColor = getSkillColor(level);

  // 2. Dismiss on Interaction (Scroll)
  useEffect(() => {
    const handleScrollDismiss = () => {
        if (isExpanded) setIsExpanded(false);
    };
    
    if (isExpanded) {
      window.addEventListener('team-manager-scroll', handleScrollDismiss);
      window.addEventListener('scroll', handleScrollDismiss, { capture: true });
    }

    return () => {
      window.removeEventListener('team-manager-scroll', handleScrollDismiss);
      window.removeEventListener('scroll', handleScrollDismiss, { capture: true });
    };
  }, [isExpanded]);

  const handleToggle = (e: React.MouseEvent | React.TouchEvent) => {
    // CRITICAL: Stop propagation to prevent drag initiation on the parent card
    e.stopPropagation();
    // e.preventDefault(); // Removed to allow click through if needed, but stopPropagation is key
    
    if (disabled) return;

    if (!isExpanded) {
        if (containerRef.current) {
            const card = containerRef.current.closest('[data-player-card]');
            const rect = card ? card.getBoundingClientRect() : containerRef.current.getBoundingClientRect();
            
            setPosition({
                top: rect.top + (rect.height / 2),
                left: rect.left + (rect.width / 2)
            });
        }
        setIsExpanded(true);
    } else {
        setIsExpanded(false);
    }
  };

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Immediate stop to prevent bubbling
    e.stopPropagation();
    onChange(Number(e.target.value));
  };

  const handleBackdropClick = (e: React.MouseEvent | React.TouchEvent) => {
      e.stopPropagation();
      e.preventDefault();
      setIsExpanded(false);
  };

  // Stop drag propagation to parent Sortable item immediately on touch down
  const handlePointerDown = (e: React.PointerEvent) => {
      e.stopPropagation();
  };

  return (
    <>
        <div 
            ref={containerRef} 
            className="relative flex items-center justify-center w-12 h-10 p-1 cursor-pointer touch-none"
            onClick={(e) => e.stopPropagation()} // Extra safety
            onPointerDown={handlePointerDown}
        >
            <motion.button
                initial={false}
                whileTap={{ scale: 0.9 }}
                onClick={handleToggle}
                className="absolute inset-0 flex items-center justify-center gap-1.5 px-2 py-1 rounded-lg bg-slate-100 dark:bg-white/10 border border-black/5 dark:border-white/5 transition-transform shadow-sm"
                disabled={disabled}
                // Native event handling for React Native Web compat
                onPointerDown={handlePointerDown}
            >
                <Star size={14} className="text-slate-400" fill="currentColor" />
                <span 
                    className="text-sm font-black tabular-nums leading-none mt-0.5"
                    style={{ color: currentColor }}
                >
                    {level}
                </span>
            </motion.button>
        </div>

        {isExpanded && position && createPortal(
            <>
                {/* Backdrop */}
                <div 
                    className="fixed inset-0 z-[9998] bg-transparent" 
                    onMouseDown={handleBackdropClick}
                    onTouchStart={handleBackdropClick}
                />
                
                <div 
                    className="fixed z-[9999]"
                    style={{ 
                        top: position.top, 
                        left: position.left,
                        transform: 'translate(-50%, -50%)',
                        width: 'max-content'
                    }}
                >
                    <AnimatePresence>
                        <motion.div
                            initial={{ opacity: 0, scale: 0.8, y: 10 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.8, y: 5 }}
                            transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                            className="flex items-center gap-3 bg-white dark:bg-slate-800 rounded-full px-5 py-3 shadow-2xl border border-black/10 dark:border-white/10 ring-1 ring-black/5"
                            style={{ minWidth: '220px' }}
                            // Capture all pointer events here to prevent leakage
                            onPointerDown={handlePointerDown}
                            onClick={(e) => e.stopPropagation()}
                        >
                            <span 
                                className="text-lg font-black w-8 text-center" 
                                style={{ color: currentColor }}
                            >
                                {level}
                            </span>
                            
                            {/* Slider Track */}
                            <div className="relative flex-1 h-8 flex items-center">
                                <input
                                    type="range"
                                    min="1"
                                    max="10"
                                    step="1"
                                    value={level}
                                    onChange={handleSliderChange}
                                    // Use pointer down to stop drag propagation from the range input itself
                                    onPointerDown={handlePointerDown}
                                    className="relative z-20 w-full h-full opacity-0 cursor-pointer touch-none"
                                />
                                
                                {/* Visual Track Background */}
                                <div className="absolute top-1/2 left-0 w-full h-2 -translate-y-1/2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden pointer-events-none">
                                    <div 
                                        className="h-full rounded-full"
                                        style={{
                                            width: `${(level / 10) * 100}%`,
                                            backgroundColor: currentColor
                                        }}
                                    />
                                </div>

                                {/* Visual Thumb - Centered Logic */}
                                <div 
                                    className="absolute top-1/2 h-6 w-6 bg-white border-2 rounded-full shadow-md pointer-events-none flex items-center justify-center z-10"
                                    style={{
                                        // Calculate percentage position
                                        left: `${((level - 1) / 9) * 100}%`, // Normalize 1-10 to 0-100%
                                        transform: 'translate(-50%, -50%)', // Center align the thumb
                                        borderColor: currentColor
                                    }}
                                >
                                    <div className={`w-2 h-2 rounded-full`} style={{ backgroundColor: currentColor }} />
                                </div>
                            </div>
                        </motion.div>
                    </AnimatePresence>
                </div>
            </>,
            document.body
        )}
    </>
  );
});
