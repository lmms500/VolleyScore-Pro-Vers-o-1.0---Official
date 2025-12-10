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
  
  // Standard Glass Styles
  const intensityMap = {
    low: 'overflow-hidden bg-white/40 dark:bg-[#0f172a]/40 backdrop-blur-md border border-white/20 dark:border-white/5 shadow-2xl shadow-black/5 dark:shadow-black/20 ring-1 ring-white/20 dark:ring-white/5 inset-ring',
    medium: 'overflow-hidden bg-white/60 dark:bg-[#0f172a]/60 backdrop-blur-xl border border-white/20 dark:border-white/5 shadow-2xl shadow-black/5 dark:shadow-black/20 ring-1 ring-white/20 dark:ring-white/5 inset-ring',
    high: 'overflow-hidden bg-white/80 dark:bg-[#0f172a]/80 backdrop-blur-2xl border border-white/20 dark:border-white/5 shadow-2xl shadow-black/5 dark:shadow-black/20 ring-1 ring-white/20 dark:ring-white/5 inset-ring',
    transparent: 'bg-transparent border-none shadow-none ring-0 backdrop-blur-none'
  };

  // Low Graphics Overrides (No blur, higher opacity)
  const lowGraphicsMap = {
    low: 'overflow-hidden bg-slate-100/90 dark:bg-slate-900/90 border border-white/10 shadow-lg',
    medium: 'overflow-hidden bg-slate-100/95 dark:bg-slate-900/95 border border-white/10 shadow-lg',
    high: 'overflow-hidden bg-slate-100 dark:bg-slate-900 border border-white/10 shadow-lg',
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
      {/* Noise Texture Overlay - Only show if not low graphics and not transparent */}
      {!lowGraphics && intensity !== 'transparent' && (
        <div className="absolute inset-0 opacity-[0.03] pointer-events-none mix-blend-overlay" 
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