
import React from 'react';
import { motion } from 'framer-motion';
import { buttonTap } from '../../utils/animations';
import { useGameAudio } from '../../hooks/useGameAudio';
import { DEFAULT_CONFIG } from '../../constants';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'icon';
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

export const Button: React.FC<ButtonProps> = ({ variant = 'primary', size = 'md', className = '', children, onClick, ...props }) => {
  const audio = useGameAudio({ ...DEFAULT_CONFIG, enableSound: true }); 

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
      audio.playTap();
      if (onClick) onClick(e);
  };

  // Base: Robust flex centering, radius matching new design system
  const base = "font-inter font-bold rounded-2xl flex items-center justify-center gap-2.5 outline-none focus:none select-none relative overflow-hidden disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 group isolate max-w-full flex-wrap h-auto min-w-[min-content]";
  
  const variants = {
    // Primary: Deeper gradient simulation, sharper shadow
    primary: "bg-indigo-600 text-white shadow-xl shadow-indigo-500/20 border border-indigo-400/20 hover:bg-indigo-500 hover:shadow-indigo-500/30 active:shadow-sm ring-1 ring-inset ring-white/10",
    
    // Secondary: Clean glass
    secondary: "bg-white dark:bg-white/5 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-white/10 shadow-sm hover:shadow-md",
    
    // Danger: Distinct warning
    danger: "bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-500/20 hover:bg-rose-100 dark:hover:bg-rose-500/20 shadow-sm hover:shadow-rose-500/10",
    
    // Ghost: Minimal
    ghost: "bg-transparent text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5",
    
    // Icon: Square-ish but rounded
    icon: "p-3 rounded-2xl text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5 border border-transparent hover:border-slate-200 dark:hover:border-white/10 transition-colors"
  };

  // Sizes: Taller targets for better touch areas
  const sizes = {
    sm: "px-4 py-2 text-[10px] uppercase tracking-widest min-h-[40px]",
    md: "px-6 py-3 text-xs uppercase tracking-wider min-h-[48px]",
    lg: "px-8 py-4 text-xs font-black uppercase tracking-widest min-h-[56px]", // Matched to Input Height (h-14)
    xl: "px-10 py-5 text-sm font-black tracking-widest min-h-[64px]"
  };

  const appliedSize = variant === 'icon' ? '' : sizes[size];

  return (
    <motion.button 
      className={`${base} ${variants[variant]} ${appliedSize} ${className}`}
      variants={buttonTap}
      initial="idle"
      whileTap="tap"
      whileHover="hover"
      onClick={handleClick}
      {...props as any} 
    >
      {/* Glare/Flash Effect Layer */}
      <motion.div 
        className="absolute inset-0 bg-white pointer-events-none z-0 mix-blend-overlay"
        variants={{
            tap: { opacity: 0.1 },
            hover: { opacity: 0.05 },
            idle: { opacity: 0 }
        }}
        transition={{ duration: 0.1 }}
      />
      
      {/* Content Container */}
      <div className="relative z-10 flex items-center justify-center gap-2 max-w-full flex-wrap text-center">
        {React.Children.map(children, (child) => {
            if (typeof child === 'string') {
                return <span className="whitespace-nowrap leading-tight">{child}</span>;
            }
            return child;
        })}
      </div>
    </motion.button>
  );
};
