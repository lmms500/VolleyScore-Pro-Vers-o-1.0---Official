
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
  const sliderRef = useRef<HTMLDivElement>(null);

  // 1. Semantic Color Logic
  const getSkillColor = (val: number) => {
    if (val <= 3) return COLORS.low;
    if (val <= 7) return COLORS.mid;
    return COLORS.high;
  };

  const currentColor = getSkillColor(level);

  // 2. Dismiss on Interaction (Click Outside or Scroll)
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      if (
          containerRef.current && !containerRef.current.contains(event.target as Node) &&
          sliderRef.current && !sliderRef.current.contains(event.target as Node)
      ) {
        setIsExpanded(false);
      }
    };

    const handleScrollDismiss = () => {
        if (isExpanded) setIsExpanded(false);
    };
    
    if (isExpanded) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
      // Listen for the custom event dispatched by TeamManagerModal lists
      window.addEventListener('team-manager-scroll', handleScrollDismiss);
      window.addEventListener('scroll', handleScrollDismiss, { capture: true }); // Global capture as backup
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
      window.removeEventListener('team-manager-scroll', handleScrollDismiss);
      window.removeEventListener('scroll', handleScrollDismiss, { capture: true });
    };
  }, [isExpanded]);

  const handleToggle = (e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation();
    e.preventDefault(); 
    
    if (disabled) return;

    if (!isExpanded) {
        if (containerRef.current) {
            // Find parent card to center over it
            const card = containerRef.current.closest('[data-player-card]');
            const rect = card ? card.getBoundingClientRect() : containerRef.current.getBoundingClientRect();
            
            // Calculate absolute center of the card
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
    e.stopPropagation();
    onChange(Number(e.target.value));
  };

  return (
    <>
        <div 
            ref={containerRef} 
            className="relative flex items-center justify-center w-12 h-10 p-1 cursor-pointer"
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
        >
            <motion.button
                initial={false}
                whileTap={{ scale: 0.9 }}
                onClick={handleToggle}
                className="absolute inset-0 flex items-center justify-center gap-1.5 px-2 py-1 rounded-lg bg-slate-100 dark:bg-white/10 border border-black/5 dark:border-white/5 transition-transform shadow-sm"
                disabled={disabled}
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
            <div 
                className="fixed z-[9999]"
                style={{ 
                    top: position.top, 
                    left: position.left,
                    transform: 'translate(-50%, -50%)', // Perfect centering
                    width: 'max-content'
                }}
            >
                <AnimatePresence>
                    <motion.div
                        ref={sliderRef}
                        initial={{ opacity: 0, scale: 0.8, y: 10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.8, y: 5 }}
                        transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                        className="flex items-center gap-3 bg-white dark:bg-slate-800 rounded-full px-5 py-3 shadow-2xl border border-black/10 dark:border-white/10 ring-1 ring-black/5"
                        style={{ minWidth: '220px' }}
                        onPointerDown={(e) => e.stopPropagation()}
                    >
                        <span 
                            className="text-lg font-black w-8 text-center" 
                            style={{ color: currentColor }}
                        >
                            {level}
                        </span>
                        
                        {/* Custom Gradient Slider Track */}
                        <div className="relative flex-1 h-6 flex items-center">
                            <input
                                type="range"
                                min="1"
                                max="10"
                                step="1"
                                value={level}
                                onChange={handleSliderChange}
                                className="relative z-10 w-full h-6 opacity-0 cursor-pointer"
                            />
                            
                            {/* Track Background */}
                            <div className="absolute top-1/2 left-0 w-full h-2 -translate-y-1/2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                                {/* Fill Bar */}
                                <div 
                                    className="h-full rounded-full transition-all duration-100"
                                    style={{
                                        width: `${(level / 10) * 100}%`,
                                        backgroundColor: currentColor
                                    }}
                                />
                            </div>

                            {/* Thumb Mockup (Visual only, follows calculation) */}
                            <div 
                                className="absolute top-1/2 h-5 w-5 bg-white border-2 rounded-full shadow-md pointer-events-none transition-all duration-100"
                                style={{
                                    left: `calc(${(level / 10) * 100}% - 10px)`, // Simple offset approximation
                                    borderColor: currentColor,
                                    transform: 'translateY(-50%)'
                                }}
                            />
                        </div>
                    </motion.div>
                </AnimatePresence>
            </div>,
            document.body
        )}
    </>
  );
});
