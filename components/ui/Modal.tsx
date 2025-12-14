
import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { modalVariants, overlayVariants } from '../../utils/animations';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  maxWidth?: string;
  showCloseButton?: boolean;
  persistent?: boolean;
  backdropClassName?: string;
  zIndex?: string;
}

export const Modal: React.FC<ModalProps> = ({ 
  isOpen, 
  onClose, 
  title, 
  children, 
  maxWidth = 'max-w-md',
  showCloseButton = true,
  persistent = false,
  // Premium Backdrop: Darker, heavy blur for focus
  backdropClassName = "bg-slate-950/60 dark:bg-[#000]/80 backdrop-blur-xl",
  zIndex = "z-[60]"
}) => {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  const handleBackdropClick = () => {
    if (!persistent) {
      onClose();
    }
  };

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <motion.div 
          key="modal-container"
          className={`fixed inset-0 ${zIndex} flex items-center justify-center p-4 isolate`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1, pointerEvents: 'auto' }}
          exit={{ opacity: 0, pointerEvents: 'none' }}
          transition={{ duration: 0.3 }}
        >
          {/* Backdrop */}
          <motion.div 
            className={`absolute inset-0 ${backdropClassName}`}
            initial="hidden"
            animate="visible"
            exit="exit"
            variants={overlayVariants}
            onClick={handleBackdropClick}
            style={{ willChange: 'opacity' }}
          />
          
          {/* Container - Ultra Premium Specs */}
          <motion.div 
            className={`
              relative w-full ${maxWidth} 
              bg-[#ffffff]/95 dark:bg-[#0f172a]/95 
              backdrop-blur-3xl 
              border border-white/50 dark:border-white/10 
              rounded-[2.5rem] shadow-2xl shadow-black/30
              overflow-hidden flex flex-col max-h-[85vh]
              ring-1 ring-white/50 dark:ring-white/5
              z-10
            `}
            initial="hidden"
            animate="visible"
            exit="exit"
            variants={modalVariants}
            style={{ willChange: 'transform, opacity, filter' }}
          >
            {/* Header - More breathing room */}
            <div className="px-8 pt-8 pb-4 flex justify-between items-center bg-transparent z-10 shrink-0">
              <h2 className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-[0.2em] opacity-90 pl-1 drop-shadow-sm">
                {title}
              </h2>
              {showCloseButton && (
                <button 
                  onClick={onClose} 
                  className="
                    p-3 rounded-full 
                    bg-slate-100/80 dark:bg-white/5 
                    hover:bg-slate-200 dark:hover:bg-white/10 
                    text-slate-400 hover:text-slate-900 dark:hover:text-white 
                    transition-all active:scale-95 border border-transparent hover:border-slate-200 dark:hover:border-white/10
                  "
                >
                  <X size={20} strokeWidth={2.5} />
                </button>
              )}
            </div>
            
            {/* Content Area - Spacious Padding */}
            <div className="px-8 pb-8 pt-2 overflow-y-auto custom-scrollbar text-slate-600 dark:text-slate-300 leading-relaxed">
              {children}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
};
