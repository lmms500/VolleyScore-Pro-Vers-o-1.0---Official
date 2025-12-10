
import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronUp, ChevronDown } from 'lucide-react';

interface GestureHintProps {
  isVisible: boolean;
}

export const GestureHint: React.FC<GestureHintProps> = ({ isVisible }) => {
  return (
    <AnimatePresence>
      {isVisible && (
        <div className="absolute inset-0 pointer-events-none flex flex-col justify-between items-center py-8 z-0">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 0.4, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="flex flex-col items-center"
          >
            <ChevronUp size={24} className="text-slate-900 dark:text-white" strokeWidth={3} />
            <span className="text-[9px] font-black uppercase tracking-widest text-slate-900 dark:text-white opacity-60">Add</span>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 0.4, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="flex flex-col items-center"
          >
            <span className="text-[9px] font-black uppercase tracking-widest text-slate-900 dark:text-white opacity-60">Undo</span>
            <ChevronDown size={24} className="text-slate-900 dark:text-white" strokeWidth={3} />
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
