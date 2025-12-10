
import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Download, X, WifiOff, RefreshCw } from 'lucide-react';
import { useServiceWorker } from '../../hooks/useServiceWorker';

export const ReloadPrompt: React.FC = () => {
  const { needRefresh, offlineReady, updateServiceWorker, closePrompt } = useServiceWorker();

  if (!offlineReady && !needRefresh) return null;

  return (
    <div className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-2 pointer-events-none">
      <AnimatePresence>
        {(offlineReady || needRefresh) && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.9 }}
            className="pointer-events-auto bg-slate-900/90 dark:bg-white/10 backdrop-blur-xl border border-white/10 text-white p-4 rounded-2xl shadow-2xl shadow-black/50 max-w-xs flex flex-col gap-3"
          >
            <div className="flex items-start gap-3">
              <div className={`p-2 rounded-full ${needRefresh ? 'bg-indigo-500' : 'bg-emerald-500'}`}>
                 {needRefresh ? <Download size={18} /> : <WifiOff size={18} />}
              </div>
              <div className="flex-1">
                <h4 className="font-bold text-sm uppercase tracking-wide mb-1">
                  {needRefresh ? "Update Available" : "Offline Ready"}
                </h4>
                <p className="text-xs text-slate-300 leading-relaxed">
                  {needRefresh 
                    ? "New version available. Click reload to update."
                    : "App is ready to work offline."}
                </p>
              </div>
              <button onClick={closePrompt} className="text-slate-400 hover:text-white transition-colors">
                <X size={16} />
              </button>
            </div>

            {needRefresh && (
              <button 
                onClick={updateServiceWorker}
                className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-xs font-bold uppercase tracking-widest transition-colors flex items-center justify-center gap-2"
              >
                <RefreshCw size={14} /> Reload
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
