
import React from 'react';
import { motion } from 'framer-motion';
import { 
    Hand, Users, Edit3, User, Crown, Swords, Zap, CheckCircle2, 
    Trophy, Mic, ArrowRight, Volume2, ArrowRightLeft, FileSpreadsheet,
    Share2, Image, FileText, RefreshCw, ChevronRight, ArrowUp
} from 'lucide-react';

// Common interface for all visuals
interface VisualProps {
    color: string;
    isPaused: boolean;
}

// --- HELPERS & SVG ---
const AppLogoSVG = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 512 512" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <rect width="512" height="512" rx="128" fill="#0f172a"/>
    <circle cx="256" cy="256" r="160" stroke="url(#paint0_linear_logo_tut)" strokeWidth="32"/>
    <path d="M256 96C256 96 320 180 380 180" stroke="url(#paint1_linear_logo_tut)" strokeWidth="32" strokeLinecap="round"/>
    <path d="M256 416C256 416 192 332 132 332" stroke="url(#paint2_linear_logo_tut)" strokeWidth="32" strokeLinecap="round"/>
    <path d="M116 200C116 200 180 220 256 256" stroke="url(#paint3_linear_logo_tut)" strokeWidth="32" strokeLinecap="round"/>
    <path d="M396 312C396 312 332 292 256 256" stroke="url(#paint4_linear_logo_tut)" strokeWidth="32" strokeLinecap="round"/>
    <defs>
      <linearGradient id="paint0_linear_logo_tut" x1="96" y1="96" x2="416" y2="416" gradientUnits="userSpaceOnUse">
        <stop stopColor="#6366f1"/>
        <stop offset="1" stopColor="#f43f5e"/>
      </linearGradient>
      <linearGradient id="paint1_linear_logo_tut" x1="256" y1="96" x2="380" y2="180" gradientUnits="userSpaceOnUse">
        <stop stopColor="#6366f1"/>
        <stop offset="1" stopColor="#818cf8"/>
      </linearGradient>
      <linearGradient id="paint2_linear_logo_tut" x1="256" y1="416" x2="132" y2="332" gradientUnits="userSpaceOnUse">
        <stop stopColor="#f43f5e"/>
        <stop offset="1" stopColor="#fb7185"/>
      </linearGradient>
      <linearGradient id="paint3_linear_logo_tut" x1="116" y1="200" x2="256" y2="256" gradientUnits="userSpaceOnUse">
        <stop stopColor="#6366f1"/>
        <stop offset="1" stopColor="#f43f5e"/>
      </linearGradient>
      <linearGradient id="paint4_linear_logo_tut" x1="396" y1="312" x2="256" y2="256" gradientUnits="userSpaceOnUse">
        <stop stopColor="#f43f5e"/>
        <stop offset="1" stopColor="#6366f1"/>
      </linearGradient>
    </defs>
  </svg>
);

// --- 1. WELCOME: Floating Logo with Breathing Glow ---
const AppLogoVisual = ({ isPaused }: { isPaused: boolean }) => (
  <div className="w-full h-full flex items-center justify-center bg-slate-50 dark:bg-white/5 relative overflow-hidden">
      <motion.div
        className="absolute rounded-full bg-indigo-500/10 blur-3xl"
        initial={{ width: 150, height: 150, opacity: 0.2 }}
        animate={isPaused ? { width: 150, height: 150, opacity: 0.2 } : { width: [150, 250, 150], height: [150, 250, 150], opacity: [0.2, 0.6, 0.2] }}
        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div 
        className="relative z-10"
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.6, type: "spring", bounce: 0.5 }}
      >
          <motion.div
            className="w-32 h-32 drop-shadow-2xl"
            animate={isPaused ? { y: 0 } : { y: [0, -15, 0] }}
            transition={{ y: { duration: 4, repeat: Infinity, ease: "easeInOut" } }}
          >
              <AppLogoSVG className="w-full h-full" />
          </motion.div>
      </motion.div>
  </div>
);

// --- 2. GESTURES: Perfect Loop Interaction ---
const GesturesVisual = ({ color, isPaused }: VisualProps) => {
    const bgClass = color.replace('text-', 'bg-');
    return (
        <div className="w-full h-full flex items-center justify-center gap-12 bg-slate-50 dark:bg-white/5">
            <div className="flex flex-col items-center gap-3">
                <div className="relative w-20 h-28 bg-white dark:bg-white/10 rounded-2xl shadow-lg border border-black/5 flex items-center justify-center overflow-visible">
                    <motion.div 
                        className={`absolute inset-0 rounded-2xl opacity-20 ${bgClass}`}
                        animate={isPaused ? {} : { scale: [1, 1.15, 1] }}
                        transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
                    />
                    <motion.div
                        className="absolute -top-4 -right-4 bg-emerald-500 text-white text-[10px] font-black px-2 py-1 rounded-lg shadow-sm z-20"
                        initial={{ opacity: 0, scale: 0, y: 0 }}
                        animate={isPaused ? {} : { opacity: [0, 1, 1, 0], scale: [0.5, 1.2, 1, 0.8], y: [0, -15, -20, -25] }}
                        transition={{ duration: 1.5, repeat: Infinity, times: [0, 0.2, 0.5, 1] }}
                    >
                        +1
                    </motion.div>
                    <motion.div
                        animate={isPaused ? {} : { scale: [1, 0.8, 1], rotate: [0, 10, 0] }}
                        transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
                    >
                        <Hand size={24} className="text-slate-400" fill="currentColor" />
                    </motion.div>
                </div>
                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Tap</span>
            </div>

            <div className="flex flex-col items-center gap-3">
                <div className="relative w-20 h-28 bg-white dark:bg-white/10 rounded-2xl shadow-lg border border-black/5 overflow-hidden flex justify-center">
                    <motion.div 
                        className={`absolute w-full h-1 bottom-0 ${bgClass}`} 
                        initial={{ height: 0, opacity: 0 }}
                        animate={isPaused ? {} : { height: [0, 60, 0], opacity: [0, 0.5, 0] }}
                        transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                    />
                    <motion.div
                        className="absolute top-1/3"
                        animate={isPaused ? {} : { y: [0, 30, 0], opacity: [1, 0.5, 1] }}
                        transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                    >
                        <Hand size={24} className="text-slate-400" />
                    </motion.div>
                    <motion.div
                        className="absolute bottom-2 bg-rose-500 text-white text-[10px] font-black px-2 py-1 rounded-lg shadow-sm z-20"
                        initial={{ opacity: 0, y: 0 }}
                        animate={isPaused ? {} : { opacity: [0, 1, 0], y: [0, 10, 0] }}
                        transition={{ duration: 2, repeat: Infinity, times: [0, 0.5, 1] }}
                    >
                        -1
                    </motion.div>
                </div>
                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Swipe</span>
            </div>
        </div>
    );
};

// --- 3. SETTINGS: Menu Simulation ---
const SettingsConfigVisual = ({ color, isPaused }: VisualProps) => {
    const activeColor = color.replace('text-', 'bg-');
    return (
        <div className="w-full h-full flex items-center justify-center bg-slate-50 dark:bg-white/5">
            <div className="w-48 bg-white dark:bg-black/20 rounded-2xl shadow-xl border border-black/5 dark:border-white/5 p-4 flex flex-col gap-4">
                <div className="flex items-center justify-between">
                    <div className="w-16 h-2 bg-slate-200 dark:bg-white/10 rounded-full" />
                    <div className="w-10 h-6 bg-slate-100 dark:bg-white/5 rounded-full p-1 border border-black/5 relative overflow-hidden">
                        <motion.div 
                            className={`w-4 h-4 rounded-full shadow-sm ${activeColor}`}
                            animate={isPaused ? {} : { x: [0, 16, 16, 0], backgroundColor: ["#94a3b8", "currentColor", "currentColor", "#94a3b8"] }}
                            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                        />
                    </div>
                </div>
                <div className="flex flex-col gap-2">
                    <div className="w-10 h-2 bg-slate-200 dark:bg-white/10 rounded-full" />
                    <div className="flex gap-2">
                        {[1, 3, 5].map((val, i) => (
                            <div key={val} className="flex-1 h-8 rounded-lg bg-slate-50 dark:bg-white/5 border border-black/5 flex items-center justify-center relative overflow-hidden">
                                {i === 1 && (
                                    <motion.div 
                                        className={`absolute inset-0 opacity-20 ${activeColor}`}
                                        animate={isPaused ? {} : { opacity: [0, 1, 1, 0] }}
                                        transition={{ duration: 3, repeat: Infinity, times: [0, 0.3, 0.7, 1] }}
                                    />
                                )}
                                <span className="text-[10px] font-bold text-slate-400">{val}</span>
                            </div>
                        ))}
                    </div>
                </div>
                <div className="flex items-center justify-between opacity-50">
                    <div className="w-20 h-2 bg-slate-200 dark:bg-white/10 rounded-full" />
                    <div className="w-4 h-4 rounded-full bg-slate-200 dark:bg-white/10" />
                </div>
            </div>
        </div>
    );
};

// --- 4. AUDIO: Speaker with Waves ---
const AudioNarratorVisual = ({ color, isPaused }: VisualProps) => {
    return (
        <div className="w-full h-full flex items-center justify-center bg-slate-50 dark:bg-white/5 overflow-hidden relative">
            {[1, 2, 3].map((i) => (
                <motion.div
                    key={i}
                    className={`absolute rounded-full border-2 opacity-0 ${color.replace('text-', 'border-')}`}
                    initial={{ width: 40, height: 40, opacity: 0 }}
                    animate={isPaused ? {} : { 
                        width: [40, 200], 
                        height: [40, 200], 
                        opacity: [0.8, 0],
                        borderWidth: [2, 0]
                    }}
                    transition={{ 
                        duration: 2, 
                        repeat: Infinity, 
                        delay: i * 0.4, 
                        ease: "easeOut" 
                    }}
                />
            ))}
            <div className="z-10 bg-white dark:bg-white/10 p-4 rounded-2xl shadow-xl border border-black/5 dark:border-white/5 relative">
                <Volume2 size={32} className={color} strokeWidth={2.5} />
                <motion.div 
                    className="absolute -top-2 -right-2 text-slate-400"
                    animate={isPaused ? {} : { y: [0, -10, 0], opacity: [0, 1, 0], rotate: [0, 15, 0] }}
                    transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                >
                    <Mic size={12} fill="currentColor" />
                </motion.div>
            </div>
        </div>
    );
};

// --- 5. TEAM MANAGEMENT: Cycling Roster Stack ---
const TeamManagementVisual = ({ color, isPaused }: VisualProps) => {
    const bgClass = color.replace('text-', 'bg-');
    return (
        <div className="w-full h-full flex flex-col items-center justify-center bg-slate-50 dark:bg-white/5 relative overflow-hidden">
            <div className={`absolute top-0 right-0 w-32 h-32 ${bgClass} opacity-5 rounded-full blur-3xl`} />
            <div className="flex flex-col gap-2 z-10 w-40 relative h-32 justify-center">
                <div className="flex justify-between items-center mb-1 absolute -top-6 w-full">
                    <div className="h-2 w-12 bg-slate-300 dark:bg-white/20 rounded-full" />
                    <Users size={12} className="text-slate-400" />
                </div>
                {[0, 1, 2].map((i) => (
                    <motion.div
                        key={i}
                        className="absolute h-10 w-full bg-white dark:bg-white/10 rounded-lg shadow-sm border border-black/5 dark:border-white/5 flex items-center px-3 gap-3"
                        style={{ top: i * 45 }}
                        animate={isPaused ? {} : { 
                            y: [0, 45, 45, 0], 
                            zIndex: [i, i, i === 2 ? 0 : i+1, i], 
                            opacity: [1, 1, i === 2 ? 0 : 1, 1],
                            scale: [1, 1, i === 2 ? 0.9 : 1, 1]
                        }}
                        transition={{ y: { duration: 3, repeat: Infinity, ease: "easeInOut" }, opacity: { duration: 3, repeat: Infinity, ease: "linear" } }}
                    >
                        <div className={`w-6 h-6 rounded-full ${i === 0 ? bgClass : 'bg-slate-100 dark:bg-white/10'} flex items-center justify-center text-[8px] font-bold text-white`}>
                            {i + 1}
                        </div>
                        <div className="flex-1 space-y-1">
                            <div className="h-1.5 w-16 bg-slate-200 dark:bg-white/10 rounded-full" />
                            <div className="h-1 w-8 bg-slate-100 dark:bg-white/5 rounded-full" />
                        </div>
                    </motion.div>
                ))}
            </div>
        </div>
    );
};

// --- 6. DRAG & DROP: Circular Physics Loop ---
const DragHandVisual = ({ color, isPaused }: VisualProps) => {
    const bgClass = color.replace('text-', 'bg-');
    return (
        <div className="w-full h-full flex items-center justify-center bg-slate-50 dark:bg-white/5 gap-4">
            <div className="w-24 h-32 border-2 border-dashed border-slate-200 dark:border-white/10 rounded-xl flex flex-col items-center p-2 gap-2">
                <div className="w-full h-6 bg-slate-200 dark:bg-white/10 rounded" />
                <div className="w-full h-6 bg-slate-200 dark:bg-white/10 rounded" />
            </div>
            <motion.div
                className={`absolute w-20 h-8 ${bgClass} rounded-lg shadow-xl z-20 flex items-center justify-center text-white font-bold text-xs`}
                initial={{ x: -60, y: 0 }}
                animate={isPaused ? {} : { x: [-60, 60, 60, -60, -60], y: [0, 0, 40, 40, 0], rotate: [0, 5, 0, -5, 0], scale: [1, 1.1, 1, 1.1, 1] }}
                transition={{ duration: 3, repeat: Infinity, ease: "easeInOut", times: [0, 0.4, 0.5, 0.9, 1] }}
            >
                <div className="w-4 h-4 bg-white/20 rounded-full mr-2" /> Player
                <Hand className="absolute -bottom-4 -right-4 text-slate-800 dark:text-white drop-shadow-md" fill="currentColor" size={24} />
            </motion.div>
            <div className="w-24 h-32 border-2 border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 rounded-xl flex flex-col items-center p-2 gap-2">
                <div className="w-full h-6 bg-slate-100 dark:bg-white/5 rounded" />
                <div className="w-full h-6 border border-dashed border-slate-300 dark:border-white/10 rounded opacity-50" />
            </div>
        </div>
    );
};

// --- 7. SUBSTITUTIONS V2: IN & OUT CARDS ---
const SubstitutionsVisual = ({ color, isPaused }: VisualProps) => {
    // Colors
    const activeColor = color.replace('text-', 'bg-');
    
    // Skeleton Card Component
    const MiniPlayerCard = ({ type, customClass }: { type: 'in' | 'out', customClass?: string }) => (
        <div className={`
            w-24 h-32 rounded-xl border shadow-md flex flex-col items-center justify-center gap-3 relative
            ${type === 'in' 
                ? `bg-white dark:bg-slate-800 border-emerald-500/30` 
                : `bg-white dark:bg-slate-800 border-rose-500/30`
            }
            ${customClass}
        `}>
            {/* Status Badge */}
            <div className={`
                absolute top-2 right-2 text-[8px] font-black px-1.5 py-0.5 rounded
                ${type === 'in' ? 'bg-emerald-500 text-white' : 'bg-rose-500 text-white'}
            `}>
                {type === 'in' ? 'IN' : 'OUT'}
            </div>

            {/* Avatar */}
            <div className={`
                w-10 h-10 rounded-full flex items-center justify-center text-slate-400 dark:text-slate-500
                ${type === 'in' ? 'bg-emerald-500/10' : 'bg-rose-500/10'}
            `}>
                <User size={20} />
            </div>

            {/* Text Lines */}
            <div className="space-y-1.5 w-full px-3 flex flex-col items-center">
                <div className="h-2 w-12 bg-slate-200 dark:bg-white/10 rounded-full" />
                <div className="h-1.5 w-8 bg-slate-100 dark:bg-white/5 rounded-full" />
            </div>
        </div>
    );

    return (
        <div className="w-full h-full flex items-center justify-center bg-slate-50 dark:bg-white/5 relative overflow-hidden">
            
            {/* --- CARD 1 (OUT - LEAVING) --- */}
            <motion.div
                className="absolute z-10"
                animate={isPaused ? {} : { 
                    x: [0, -60, -60, 0], 
                    scale: [1, 0.85, 0.85, 1],
                    opacity: [1, 0.6, 0.6, 1],
                    filter: ["grayscale(0%)", "grayscale(100%)", "grayscale(100%)", "grayscale(0%)"]
                }}
                transition={{ duration: 3, repeat: Infinity, times: [0, 0.3, 0.8, 1], ease: "easeInOut" }}
            >
                <MiniPlayerCard type="out" />
            </motion.div>

            {/* --- CARD 2 (IN - ENTERING) --- */}
            <motion.div
                className="absolute z-20"
                initial={{ x: 60, scale: 0.8, opacity: 0 }}
                animate={isPaused ? {} : { 
                    x: [60, 0, 0, 60], 
                    scale: [0.8, 1.05, 1.05, 0.8],
                    opacity: [0, 1, 1, 0]
                }}
                transition={{ duration: 3, repeat: Infinity, times: [0, 0.3, 0.8, 1], ease: "easeInOut" }}
            >
                <MiniPlayerCard type="in" customClass="ring-4 ring-emerald-500/10 shadow-xl" />
            </motion.div>

            {/* --- CENTRAL SWAP ICON --- */}
            <motion.div 
                className="absolute z-30 bg-white dark:bg-slate-700 rounded-full p-2.5 shadow-lg border border-slate-100 dark:border-white/10 text-slate-800 dark:text-white"
                animate={isPaused ? {} : { rotate: 180, scale: [1, 1.2, 1] }}
                transition={{ duration: 3, repeat: Infinity, times: [0, 0.3, 1], ease: "easeInOut" }}
            >
                <RefreshCw size={20} strokeWidth={2.5} />
            </motion.div>

        </div>
    );
};

// --- 8. PLAYER PROFILE: 360 Spin ---
const PlayerProfileVisual = ({ color, isPaused }: VisualProps) => {
    const bgClass = color.replace('text-', 'bg-');
    return (
        <div className="w-full h-full flex items-center justify-center bg-slate-50 dark:bg-white/5 perspective-[800px]">
            <motion.div 
                className="w-40 h-24 bg-white dark:bg-black/40 rounded-2xl shadow-xl border border-black/5 dark:border-white/10 p-3 relative backface-hidden"
                animate={isPaused ? {} : { rotateY: [0, 360] }}
                transition={{ duration: 6, repeat: Infinity, ease: "linear" }}
                style={{ transformStyle: 'preserve-3d' }}
            >
                <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-white/10 flex items-center justify-center text-lg">⚡</div>
                    <div className="space-y-1.5 flex-1">
                        <div className="h-2.5 w-16 bg-slate-800 dark:bg-slate-200 rounded-full" />
                        <div className={`h-1.5 w-full ${bgClass} rounded-full opacity-50`} />
                    </div>
                </div>
                <div className="flex justify-between items-center mt-2">
                    <div className="flex gap-1">{[1,2,3].map(i => <div key={i} className="w-1.5 h-1.5 rounded-full bg-slate-200 dark:bg-white/10" />)}</div>
                    <User size={12} className={color} />
                </div>
            </motion.div>
        </div>
    );
};

// --- 9. ROTATIONS: Perfect Orbit ---
const CourtRotationVisual = ({ color, isPaused }: VisualProps) => {
    const dotClass = `w-4 h-4 rounded-full ${color.replace('text-', 'bg-')} shadow-sm flex items-center justify-center text-[8px] text-white font-bold`;
    const positions = [{ x: 40, y: 30 }, { x: 40, y: -30 }, { x: 0, y: -30 }, { x: -40, y: -30 }, { x: -40, y: 30 }, { x: 0, y: 30 }];
    return (
        <div className="w-full h-full flex items-center justify-center bg-slate-50 dark:bg-white/5">
            <div className="w-56 h-36 border-2 border-slate-300 dark:border-white/20 bg-white dark:bg-white/5 rounded-lg relative overflow-hidden">
                <div className="absolute top-1/2 w-full h-px bg-slate-300 dark:bg-white/20" />
                <div className="relative w-full h-full">
                    {[0, 1, 2, 3, 4, 5].map((i) => (
                        <motion.div
                            key={i}
                            className={`absolute ${dotClass}`}
                            style={{ marginLeft: -8, marginTop: -8, left: '50%', top: '50%' }}
                            animate={isPaused ? { x: positions[i].x, y: positions[i].y } : { x: [positions[i].x, positions[(i + 5) % 6].x, positions[i].x], y: [positions[i].y, positions[(i + 5) % 6].y, positions[i].y] }}
                            transition={{ duration: 12, repeat: Infinity, ease: "linear" }}
                        >
                            {i + 1}
                        </motion.div>
                    ))}
                </div>
            </div>
        </div>
    );
};

// --- 10. SKILL BALANCE V2: Equalizer Bars ---
const SkillBalanceV2Visual = ({ color, isPaused }: VisualProps) => {
    return (
        <div className="w-full h-full flex items-center justify-center bg-slate-50 dark:bg-white/5 gap-8">
            <div className="flex items-end gap-1 h-32 w-16 relative">
                {/* Team A Bar */}
                <motion.div 
                    className="w-full rounded-t-lg bg-indigo-500 shadow-sm"
                    initial={{ height: "40%" }}
                    animate={isPaused ? {} : { height: ["40%", "70%", "70%", "40%"], backgroundColor: ["#6366f1", "#10b981", "#10b981", "#6366f1"] }}
                    transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                />
            </div>
            <div className="flex items-end gap-1 h-32 w-16 relative">
                {/* Team B Bar */}
                <motion.div 
                    className="w-full rounded-t-lg bg-rose-500 shadow-sm"
                    initial={{ height: "90%" }}
                    animate={isPaused ? {} : { height: ["90%", "70%", "70%", "90%"], backgroundColor: ["#f43f5e", "#10b981", "#10b981", "#f43f5e"] }}
                    transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                />
            </div>
            {/* Equal Sign */}
            <motion.div 
                className="absolute text-emerald-500 text-2xl font-black opacity-0"
                animate={isPaused ? {} : { opacity: [0, 1, 1, 0], scale: [0.8, 1.2, 1.2, 0.8] }}
                transition={{ duration: 4, repeat: Infinity, times: [0.2, 0.4, 0.6, 0.8] }}
            >
                =
            </motion.div>
        </div>
    );
};

// --- 11. BATCH INPUT: Text List to Cards ---
const BatchInputVisual = ({ color, isPaused }: VisualProps) => {
    const bgClass = color.replace('text-', 'bg-');
    return (
        <div className="w-full h-full flex items-center justify-center bg-slate-50 dark:bg-white/5 gap-8">
            <div className="flex flex-col gap-2 opacity-50">
                {[1, 2, 3].map(i => (
                    <motion.div key={i} className="w-16 h-2 bg-slate-300 dark:bg-white/20 rounded-full" animate={isPaused ? {} : { opacity: [1, 0.2, 1] }} transition={{ duration: 2, repeat: Infinity, delay: i * 0.3 }} />
                ))}
            </div>
            <motion.div className="text-slate-300" animate={isPaused ? {} : { x: [0, 5, 0] }} transition={{ duration: 1, repeat: Infinity }}>
                <ArrowRight size={20} />
            </motion.div>
            <div className="flex flex-col gap-2">
                {[1, 2, 3].map(i => (
                    <motion.div key={i} className={`w-24 h-8 rounded-lg border border-black/5 bg-white dark:bg-white/10 flex items-center px-2 gap-2 shadow-sm`} initial={{ opacity: 0, x: 10 }} animate={isPaused ? { opacity: 1, x: 0 } : { opacity: [0, 1, 1, 0], x: [10, 0, 0, -10] }} transition={{ duration: 2, repeat: Infinity, delay: i * 0.3, times: [0, 0.2, 0.8, 1] }}>
                        <div className={`w-4 h-4 rounded-full ${bgClass}`} />
                        <div className="w-10 h-1.5 bg-slate-200 dark:bg-white/10 rounded-full" />
                    </motion.div>
                ))}
            </div>
        </div>
    );
};

// --- 12. HISTORY SUMMARY: Bar Chart ---
const HistorySummaryVisual = ({ color, isPaused }: VisualProps) => {
    const bgClass = color.replace('text-', 'bg-');
    return (
        <div className="w-full h-full flex flex-col items-center justify-end bg-slate-50 dark:bg-white/5 pb-6">
            <div className="flex items-end gap-4 h-32 relative">
                {[ { h: 40 }, { h: 90, w: true }, { h: 60 } ].map((bar, i) => (
                    <div key={i} className="flex flex-col items-center gap-2 relative z-10">
                        {bar.w && (
                            <motion.div initial={{ opacity: 0, y: 10 }} animate={isPaused ? { opacity: 0 } : { opacity: [0, 1, 1, 0], y: [10, 0, 0, 10] }} transition={{ duration: 3, repeat: Infinity, times: [0, 0.3, 0.8, 1], delay: 0.5 }} className="text-amber-500 mb-1">
                                <Crown size={16} fill="currentColor" />
                            </motion.div>
                        )}
                        <motion.div className={`w-8 rounded-t-lg shadow-sm ${bar.w ? bgClass : 'bg-slate-300 dark:bg-white/20'}`} style={{ height: bar.h }} initial={{ height: 0 }} animate={isPaused ? { height: 0 } : { height: [0, bar.h, bar.h, 0] }} transition={{ duration: 3, repeat: Infinity, ease: "circOut" }} />
                    </div>
                ))}
            </div>
        </div>
    );
};

// --- 13. TIMELINE: Waterfall ---
const HistoryTimelineVisual = ({ color, isPaused }: VisualProps) => {
    const events = [{ label: "Start", side: "left", delay: 0.2 }, { label: "Ace", side: "right", delay: 0.8, c: "bg-emerald-500" }, { label: "Block", side: "left", delay: 1.4, c: "bg-indigo-500" }, { label: "Point", side: "right", delay: 2.0, c: "bg-amber-500" }];
    return (
        <div className="w-full h-full flex flex-col items-center justify-center bg-slate-50 dark:bg-white/5 relative overflow-hidden py-4">
            <motion.div className="absolute top-4 bottom-4 w-1 bg-slate-200 dark:bg-white/10 rounded-full" initial={{ height: 0 }} animate={isPaused ? { height: 0 } : { height: "90%" }} transition={{ duration: 3, ease: "linear", repeat: Infinity, repeatDelay: 1 }} />
            <div className="w-full max-w-[200px] h-full flex flex-col justify-between py-2 relative">
                {events.map((evt, i) => (
                    <div key={i} className={`flex w-full items-center ${evt.side === 'left' ? 'justify-start' : 'justify-end'} relative`}>
                        <motion.div className={`absolute left-1/2 -translate-x-1/2 w-3 h-3 rounded-full border-2 border-white dark:border-slate-800 ${evt.c || 'bg-slate-400'} z-10`} initial={{ scale: 0 }} animate={isPaused ? { scale: 0 } : { scale: [0, 1.2, 1, 1, 0] }} transition={{ duration: 3, delay: evt.delay, repeat: Infinity, repeatDelay: 1 }} />
                        <motion.div className={`relative px-3 py-1.5 rounded-lg shadow-sm bg-white dark:bg-white/10 text-[9px] font-bold uppercase ${evt.side === 'left' ? 'mr-auto pr-4' : 'ml-auto pl-4'}`} initial={{ opacity: 0, x: evt.side === 'left' ? -20 : 20 }} animate={isPaused ? { opacity: 0 } : { opacity: [0, 1, 1, 0], x: [evt.side === 'left' ? -20 : 20, 0, 0, evt.side === 'left' ? -10 : 10] }} transition={{ duration: 3, delay: evt.delay, repeat: Infinity, repeatDelay: 1 }}>{evt.label}</motion.div>
                    </div>
                ))}
            </div>
        </div>
    );
};

// --- 14. SCOUT ADVANCED: Random Pips ---
const ScoutAdvancedVisual = ({ color, isPaused }: VisualProps) => {
    return (
        <div className="w-full h-full flex flex-col items-center justify-center bg-slate-50 dark:bg-white/5 relative">
            <div className="relative w-48 h-32 bg-white dark:bg-black/20 border-2 border-slate-300 dark:border-white/20 grid grid-cols-3 grid-rows-3">
                <div className="absolute top-1/3 left-0 w-full h-0.5 bg-slate-300 dark:border-white/20 z-0 pointer-events-none" />
                
                {/* Random Hits */}
                {[
                    { i: 4, c: 'bg-rose-500', d: 0 },
                    { i: 2, c: 'bg-indigo-500', d: 0.8 },
                    { i: 8, c: 'bg-amber-500', d: 1.6 },
                    { i: 3, c: 'bg-emerald-500', d: 2.4 }
                ].map((hit, k) => (
                    <motion.div
                        key={k}
                        className={`absolute w-3 h-3 rounded-full ${hit.c} shadow-sm z-10`}
                        style={{
                            left: `${(hit.i % 3) * 33 + 16}%`,
                            top: `${Math.floor(hit.i / 3) * 33 + 16}%`
                        }}
                        initial={{ scale: 0, opacity: 0 }}
                        animate={isPaused ? {} : { scale: [0, 1.5, 1], opacity: [0, 1, 0] }}
                        transition={{ duration: 3.2, repeat: Infinity, delay: hit.d, times: [0, 0.1, 1] }}
                    />
                ))}
            </div>
            <div className="mt-4 flex gap-3 text-[8px] font-bold uppercase tracking-wider text-slate-400">
                <div className="flex items-center gap-1"><div className="w-2 h-2 bg-rose-500 rounded-full" /> Atk</div>
                <div className="flex items-center gap-1"><div className="w-2 h-2 bg-indigo-500 rounded-full" /> Blk</div>
                <div className="flex items-center gap-1"><div className="w-2 h-2 bg-amber-500 rounded-full" /> Ace</div>
            </div>
        </div>
    );
};

// --- 15. EXPORT: Document Flyout ---
const ExportDataVisual = ({ color, isPaused }: VisualProps) => {
    return (
        <div className="w-full h-full flex flex-col items-center justify-center bg-slate-50 dark:bg-white/5 relative overflow-hidden">
            
            {/* Base Doc */}
            <motion.div 
                className="relative z-10 bg-white dark:bg-white/10 p-4 rounded-2xl shadow-xl border border-black/5"
                animate={isPaused ? {} : { y: [0, 10, 0] }}
                transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
            >
                <FileText size={32} className={color} />
            </motion.div>

            {/* Flying Icons */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                {[
                    { Icon: Share2, x: -60, y: -60, c: "text-indigo-500", d: 0 },
                    { Icon: FileSpreadsheet, x: 0, y: -80, c: "text-emerald-500", d: 0.1 },
                    { Icon: Image, x: 60, y: -60, c: "text-rose-500", d: 0.2 }
                ].map((item, i) => (
                    <motion.div
                        key={i}
                        className={`absolute bg-white dark:bg-slate-800 p-2 rounded-xl shadow-lg border border-black/5 ${item.c}`}
                        initial={{ x: 0, y: 0, scale: 0, opacity: 0 }}
                        animate={isPaused ? {} : { x: [0, item.x], y: [0, item.y], scale: [0, 1, 1, 0], opacity: [0, 1, 1, 0] }}
                        transition={{ duration: 2, repeat: Infinity, delay: item.d, times: [0, 0.4, 0.8, 1], ease: "easeOut" }}
                    >
                        <item.Icon size={16} />
                    </motion.div>
                ))}
            </div>
        </div>
    );
};

// --- 16. VOICE CONTROL: Visualizing Sound Waves ---
const VoiceControlVisual = ({ color, isPaused }: VisualProps) => (
    <div className="w-full h-full flex items-center justify-center bg-slate-50 dark:bg-white/5 relative overflow-hidden">
        {[0, 1, 2].map(i => (
            <motion.div
                key={i}
                className={`absolute rounded-full border-2 ${color.replace('text-', 'border-')} opacity-20`}
                initial={{ width: 40, height: 40, opacity: 0.5 }}
                animate={isPaused ? {} : { width: 200, height: 200, opacity: 0 }}
                transition={{ duration: 2, repeat: Infinity, delay: i * 0.6, ease: "easeOut" }}
            />
        ))}
        <div className={`relative z-10 w-16 h-16 rounded-full bg-white dark:bg-white/10 shadow-xl flex items-center justify-center ${color}`}>
            <Mic size={32} />
        </div>
    </div>
);

// --- 17. SCOREBOARD ---
const ScoreVisual = ({ color, isPaused }: VisualProps) => (
  <div className="w-full h-full flex items-center justify-center bg-slate-50 dark:bg-white/5">
    <div className="flex items-center gap-6 p-6 bg-white dark:bg-black/40 rounded-3xl shadow-xl border border-black/5 dark:border-white/10 relative overflow-hidden">
        <div className="flex flex-col items-center z-10 w-24">
            <div className="text-6xl font-black text-slate-800 dark:text-white leading-none relative h-16 w-full flex justify-center">
                <motion.span className="absolute" initial={{ y: 0, opacity: 1 }} animate={isPaused ? {} : { y: [0, -20, 20, 0], opacity: [1, 0, 0, 1] }} transition={{ duration: 2, repeat: Infinity, times: [0, 0.4, 0.6, 1] }}>24</motion.span>
                <motion.span className={`absolute ${color}`} initial={{ y: 20, opacity: 0 }} animate={isPaused ? {} : { y: [20, 0, 0, -20], opacity: [0, 1, 1, 0] }} transition={{ duration: 2, repeat: Infinity, times: [0, 0.4, 0.6, 1] }}>25</motion.span>
            </div>
            <div className="w-full h-1 bg-slate-200 dark:bg-white/10 mt-2 rounded-full overflow-hidden">
                <motion.div className={`h-full ${color.replace('text-', 'bg-')}`} initial={{ width: "90%" }} animate={isPaused ? {} : { width: ["90%", "100%", "100%", "90%"] }} transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }} />
            </div>
        </div>
        <div className="h-12 w-px bg-slate-200 dark:bg-white/10 z-10" />
        <div className="text-4xl font-bold text-slate-300 dark:text-slate-600 z-10">21</div>
    </div>
  </div>
);

// --- 18. TEAM CUSTOMIZATION ---
const TeamCustomizationVisual = ({ color, isPaused }: VisualProps) => (
    <div className="w-full h-full flex items-center justify-center bg-slate-50 dark:bg-white/5">
        <div className="bg-white dark:bg-black/40 p-4 rounded-3xl shadow-xl border border-black/5 dark:border-white/10 flex flex-col items-center gap-4">
            <div className="relative">
                <Edit3 size={16} className="absolute -right-6 top-0 text-slate-400" />
                <div className="text-xl font-black text-slate-800 dark:text-white uppercase tracking-wider">TEAM A</div>
                <motion.div className={`h-1 w-full mt-1 ${color.replace('text-', 'bg-')}`} animate={isPaused ? {} : { width: ["30%", "100%", "30%"] }} transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }} />
            </div>
            <div className="flex gap-2">
                {['bg-indigo-500', 'bg-rose-500', 'bg-emerald-500', 'bg-amber-500'].map((bg, i) => (
                    <motion.div key={i} className={`w-8 h-8 rounded-full ${bg} cursor-pointer border-2 border-transparent`} animate={isPaused ? {} : (i === 1 ? { scale: [1, 1.2, 1], borderColor: ["transparent", "#fff", "transparent"] } : { scale: [1, 0.9, 1] })} transition={{ duration: 2, repeat: Infinity, ease: "easeInOut", delay: i * 0.2 }} />
                ))}
            </div>
        </div>
    </div>
);

export const TutorialVisual = ({ visualId, colorTheme, isPaused }: { visualId: string, colorTheme: any, isPaused: boolean }) => {
  const color = colorTheme.text || 'text-indigo-500';
  const props = { color, isPaused };

  switch (visualId) {
    case 'app_logo': return <AppLogoVisual isPaused={isPaused} />;
    case 'match_score': return <ScoreVisual {...props} />;
    case 'gestures': return <GesturesVisual {...props} />;
    case 'voice_control': return <VoiceControlVisual {...props} />;
    case 'team_management': return <TeamManagementVisual {...props} />;
    case 'team_customization': return <TeamCustomizationVisual {...props} />;
    case 'drag_and_drop': return <DragHandVisual {...props} />;
    case 'player_profile': return <PlayerProfileVisual {...props} />;
    case 'batch_input': return <BatchInputVisual {...props} />;
    case 'rotations': return <CourtRotationVisual {...props} />;
    case 'skill_balance': return <SkillBalanceV2Visual {...props} />;
    case 'skill_balance_v2': return <SkillBalanceV2Visual {...props} />;
    case 'history_summary': return <HistorySummaryVisual {...props} />;
    case 'history_analytics': return <HistorySummaryVisual {...props} />;
    case 'history_timeline': return <HistoryTimelineVisual {...props} />;
    case 'scout_mode': return <ScoutAdvancedVisual {...props} />;
    case 'scout_mode_advanced': return <ScoutAdvancedVisual {...props} />;
    case 'settings_config': return <SettingsConfigVisual {...props} />;
    case 'audio_narrator': return <AudioNarratorVisual {...props} />;
    case 'substitutions': return <SubstitutionsVisual {...props} />;
    case 'export_data': return <ExportDataVisual {...props} />;
    default: return <AppLogoVisual isPaused={isPaused} />;
  }
};
