
import React from 'react';
import { Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export const GlobalLoader = () => (
  <AnimatePresence>
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-100/60 dark:bg-[#020617]/60 backdrop-blur-xl transition-colors duration-300 isolate">
      <motion.div
        initial={{ scale: 0.9, opacity: 0, y: 10 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.9, opacity: 0, y: -10 }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        className="
          flex flex-col items-center gap-4 px-8 py-6 
          bg-white/80 dark:bg-black/80 backdrop-blur-2xl 
          rounded-[2rem] shadow-2xl shadow-black/20 
          border border-white/40 dark:border-white/10
          ring-1 ring-black/5 dark:ring-white/5
        "
      >
        <div className="relative">
            <Loader2 className="animate-spin text-indigo-500 dark:text-indigo-400" size={40} strokeWidth={2} />
            <div className="absolute inset-0 bg-indigo-500/30 blur-xl rounded-full animate-pulse" />
        </div>
        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400 animate-pulse">
          Loading
        </span>
      </motion.div>
    </div>
  </AnimatePresence>
);
