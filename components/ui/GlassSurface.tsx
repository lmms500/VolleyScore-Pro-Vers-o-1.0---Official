
import React from 'react';
import { motion, HTMLMotionProps, Transition } from 'framer-motion';

interface GlassSurfaceProps extends HTMLMotionProps<"div"> {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  intensity?: 'low' | 'medium' | 'high' | 'transparent';
  lowGraphics?: boolean;
  layout?: boolean | "position" | "size" | "preserve-aspect";
  layoutId?: string;
  transition?: Transition;
}

export const GlassSurface: React.FC<GlassSurfaceProps> = ({ 
  children, 
  className = '', 
  intensity = 'medium',
  lowGraphics = false,
  ...props 
}) => {
  
  const allowOverflow = className.includes('overflow-visible');
  const overflowClass = allowOverflow ? '' : 'overflow-hidden';

  // PREMIUM GLASS 2.0: Cleaner, sharper, less "milky"
  const intensityMap = {
    // Low: Subtle tint, minimal blur. Good for overlays on busy backgrounds.
    low: `${overflowClass} bg-white/40 dark:bg-[#0f172a]/40 backdrop-blur-xl border border-white/20 dark:border-white/5 shadow-lg shadow-black/5 ring-1 ring-white/20 dark:ring-white/5`,
    
    // Medium: Standard card. Good balance of opacity and blur.
    medium: `${overflowClass} bg-white/60 dark:bg-[#0f172a]/60 backdrop-blur-2xl border border-white/40 dark:border-white/10 shadow-xl shadow-black/5 ring-1 ring-white/30 dark:ring-white/5`,
    
    // High: Strong separation. Used for modals or active elements.
    high: `${overflowClass} bg-white/80 dark:bg-[#0f172a]/80 backdrop-blur-3xl border border-white/50 dark:border-white/10 shadow-2xl shadow-black/10 ring-1 ring-white/40 dark:ring-white/10`,
    
    transparent: 'bg-transparent border-none shadow-none ring-0 backdrop-blur-none'
  };

  // Low Graphics: Solid backgrounds for performance
  const lowGraphicsMap = {
    low: `${overflowClass} bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-white/10 shadow-sm`,
    medium: `${overflowClass} bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 shadow-md`,
    high: `${overflowClass} bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 shadow-lg`,
    transparent: 'bg-transparent border-none shadow-none'
  };

  const styleClass = lowGraphics ? lowGraphicsMap[intensity] : intensityMap[intensity];

  return (
    <motion.div
      className={`
        relative
        ${styleClass}
        ${className}
      `}
      {...props}
    >
      {/* Noise Texture - Extremely subtle grain for organic feel */}
      {!lowGraphics && intensity !== 'transparent' && (
        <div className="absolute inset-0 opacity-[0.02] dark:opacity-[0.01] pointer-events-none mix-blend-overlay" 
             style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")` }} 
        />
      )}
      
      {/* Content */}
      <div className="relative z-10 h-full w-full">
        {children}
      </div>
    </motion.div>
  );
};
