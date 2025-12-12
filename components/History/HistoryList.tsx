
import React, { useState, useMemo, useRef, useEffect, lazy, Suspense } from 'react';
import { useHistoryStore, Match } from '../../stores/historyStore';
import { useTranslation } from '../../contexts/LanguageContext';
import { downloadJSON, exportMatchesToCSV, parseJSONFile } from '../../services/io';
import { 
  Search, Clock, Trash2, ChevronDown, ChevronUp, 
  Download, Upload, Filter, AlertCircle, BarChart2, Crown, Calendar, SortDesc, Check, FileSpreadsheet, FileJson, PieChart
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '../ui/Button';
import { MatchDetail } from './MatchDetail';
import { resolveTheme, getHexFromColor } from '../../utils/colors';
import { Virtuoso } from 'react-virtuoso'; 

// Lazy load the new stats modal
const TeamStatsModal = lazy(() => import('../modals/TeamStatsModal').then(module => ({ default: module.TeamStatsModal })));

// --- SUB-COMPONENTS ---

interface CustomSelectProps {
    value: string;
    onChange: (value: string) => void;
    options: { value: string; label: string }[];
    icon?: React.ReactNode;
    align?: 'left' | 'right';
}

const CustomSelect: React.FC<CustomSelectProps> = ({ value, onChange, options, icon, align = 'left' }) => {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    const selectedLabel = options.find(o => o.value === value)?.label || value;

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        if(isOpen) document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen]);

    return (
        <div className="relative w-full group" ref={containerRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={`
                    w-full flex items-center justify-between
                    bg-white dark:bg-white/5 border border-black/5 dark:border-white/10 
                    rounded-2xl pl-4 pr-3 py-2.5 
                    text-xs font-bold uppercase tracking-wider 
                    text-slate-600 dark:text-slate-300 
                    hover:bg-slate-50 dark:hover:bg-white/10 hover:border-black/10 dark:hover:border-white/20
                    transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500/30
                    ${isOpen ? 'ring-2 ring-indigo-500/30 bg-slate-50 dark:bg-white/10' : ''}
                `}
            >
                <span className="truncate mr-2 min-w-0">{selectedLabel}</span>
                <div className="text-slate-400 flex-shrink-0">
                    {icon || (isOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />)}
                </div>
            </button>

            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: 8, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 8, scale: 0.95 }}
                        transition={{ duration: 0.2, ease: "easeOut" }}
                        className={`
                            absolute top-full ${align === 'right' ? 'right-0' : 'left-0'} mt-2 z-50 
                            min-w-full w-max max-w-[280px]
                            bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl 
                            border border-black/5 dark:border-white/10 
                            rounded-2xl shadow-2xl shadow-black/20 
                            overflow-hidden max-h-60 overflow-y-auto custom-scrollbar
                        `}
                    >
                        {options.map((opt) => (
                            <button
                                key={opt.value}
                                onClick={() => { onChange(opt.value); setIsOpen(false); }}
                                className={`
                                    w-full flex items-center justify-between px-4 py-3 text-left
                                    text-xs font-bold uppercase tracking-wide transition-colors
                                    hover:bg-black/5 dark:hover:bg-white/10
                                    ${value === opt.value ? 'text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-500/10' : 'text-slate-600 dark:text-slate-300'}
                                `}
                            >
                                <span className="mr-2 whitespace-nowrap">{opt.label}</span>
                                {value === opt.value && <Check size={14} className="text-indigo-500 flex-shrink-0" />}
                            </button>
                        ))}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

// Export Menu Component
const ExportMenu = ({ onExportJSON, onExportCSV }: { onExportJSON: () => void, onExportCSV: () => void }) => {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        if(isOpen) document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen]);

    return (
        <div className="relative" ref={containerRef}>
            <button 
                onClick={() => setIsOpen(!isOpen)} 
                className={`p-2.5 rounded-2xl border border-black/5 dark:border-white/10 text-slate-500 dark:text-slate-400 hover:text-indigo-500 dark:hover:text-white hover:bg-indigo-50 dark:hover:bg-white/10 transition-colors ${isOpen ? 'bg-indigo-50 dark:bg-white/10 text-indigo-500' : 'bg-white dark:bg-white/5'}`} 
            >
                <Upload size={18} /> 
            </button>
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 10, scale: 0.95 }}
                        className="absolute top-full right-0 mt-2 z-50 min-w-[160px] bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border border-black/5 dark:border-white/10 rounded-2xl shadow-xl overflow-hidden p-1.5"
                    >
                        <button onClick={() => { onExportJSON(); setIsOpen(false); }} className="w-full flex items-center gap-3 px-3 py-2.5 text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 hover:bg-black/5 dark:hover:bg-white/10 rounded-xl transition-colors">
                            <FileJson size={16} className="text-amber-500" /> JSON (Backup)
                        </button>
                        <button onClick={() => { onExportCSV(); setIsOpen(false); }} className="w-full flex items-center gap-3 px-3 py-2.5 text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 hover:bg-black/5 dark:hover:bg-white/10 rounded-xl transition-colors">
                            <FileSpreadsheet size={16} className="text-emerald-500" /> CSV (Excel)
                        </button>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

// Memoized History Card
const HistoryCard: React.FC<{ 
    match: Match; 
    onDelete: (id: string) => void;
    isExpanded: boolean;
    onToggle: () => void;
    onAnalyze: () => void;
}> = React.memo(({ match, onDelete, isExpanded, onToggle, onAnalyze }) => {
    const { t } = useTranslation();
    const date = new Date(match.timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    const time = new Date(match.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    const h = Math.floor(match.durationSeconds / 3600);
    const m = Math.floor((match.durationSeconds % 3600) / 60);
    const durationStr = h > 0 ? `${h}h ${m}m` : `${m}m`;

    const isWinnerA = match.winner === 'A';
    const isWinnerB = match.winner === 'B';

    const themeA = resolveTheme(match.teamARoster?.color || 'indigo');
    const themeB = resolveTheme(match.teamBRoster?.color || 'rose');
    
    const hexA = getHexFromColor(match.teamARoster?.color || 'indigo');
    const hexB = getHexFromColor(match.teamBRoster?.color || 'rose');

    return (
        <div className="pb-3 px-1"> 
            <motion.div 
                layout
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="group relative rounded-2xl bg-white dark:bg-white/[0.03] backdrop-blur-md border border-black/5 dark:border-white/5 overflow-hidden shadow-sm hover:shadow-md transition-all"
            >
                {isWinnerA && (
                    <div 
                        className="absolute inset-0 opacity-[0.03] pointer-events-none transition-colors duration-500"
                        style={{ background: `linear-gradient(90deg, ${hexA}, transparent)` }}
                    />
                )}
                {isWinnerB && (
                    <div 
                        className="absolute inset-0 opacity-[0.03] pointer-events-none transition-colors duration-500"
                        style={{ background: `linear-gradient(-90deg, ${hexB}, transparent)` }}
                    />
                )}

                <div 
                    className="relative z-10 p-4 sm:p-5 cursor-pointer flex flex-col gap-4"
                    onClick={onToggle}
                >
                    <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-widest text-slate-400">
                        <div className="flex items-center gap-2">
                            <span className="flex items-center gap-1"><Calendar size={12} /> {date}</span>
                            <span className="w-1 h-1 rounded-full bg-slate-300 dark:bg-slate-700"></span>
                            <span>{time}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <Clock size={12} /> {durationStr}
                        </div>
                    </div>

                    <div className="flex items-center justify-between gap-2 sm:gap-4 w-full">
                        
                        <div className={`flex-1 min-w-0 flex items-center justify-end gap-2 text-right ${isWinnerA ? 'opacity-100' : 'opacity-60 grayscale-[0.5]'}`}>
                            <span className={`text-sm sm:text-base leading-tight break-words line-clamp-2 ${isWinnerA ? `font-black ${themeA.text} ${themeA.textDark}` : 'font-medium text-slate-600 dark:text-slate-400'}`}>
                                {match.teamAName}
                            </span>
                            {isWinnerA && <Crown size={14} className={`${themeA.crown} flex-shrink-0`} fill="currentColor" />}
                        </div>

                        <div className="flex-shrink-0 flex flex-col items-center justify-center px-3 py-1 bg-slate-100/50 dark:bg-black/20 rounded-xl border border-black/5 dark:border-white/5 min-w-[60px] sm:min-w-[80px]">
                            <div className="flex items-center gap-1 font-inter text-lg sm:text-xl font-black tabular-nums leading-none">
                                <span className={isWinnerA ? `${themeA.text} ${themeA.textDark}` : 'text-slate-400'}>{match.setsA}</span>
                                <span className="text-slate-300 dark:text-slate-600 text-sm">:</span>
                                <span className={isWinnerB ? `${themeB.text} ${themeB.textDark}` : 'text-slate-400'}>{match.setsB}</span>
                            </div>
                        </div>

                        <div className={`flex-1 min-w-0 flex items-center justify-start gap-2 text-left ${isWinnerB ? 'opacity-100' : 'opacity-60 grayscale-[0.5]'}`}>
                            {isWinnerB && <Crown size={14} className={`${themeB.crown} flex-shrink-0`} fill="currentColor" />}
                            <span className={`text-sm sm:text-base leading-tight break-words line-clamp-2 ${isWinnerB ? `font-black ${themeB.text} ${themeB.textDark}` : 'font-medium text-slate-600 dark:text-slate-400'}`}>
                                {match.teamBName}
                            </span>
                        </div>

                    </div>

                    <div className="flex justify-center text-slate-300 dark:text-slate-700 -mt-2">
                        {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </div>
                </div>

                <AnimatePresence>
                    {isExpanded && (
                        <motion.div 
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="relative z-10 border-t border-black/5 dark:border-white/5 bg-slate-50/50 dark:bg-black/10"
                        >
                            <div className="p-4 sm:p-5 flex flex-col items-center space-y-5">
                                
                                <div className="w-full overflow-x-auto pb-1 no-scrollbar flex justify-center">
                                    <div className="flex gap-2">
                                        {match.sets.map((set, idx) => {
                                            const isSetWinnerA = set.winner === 'A';
                                            const setTheme = isSetWinnerA ? themeA : themeB;
                                            return (
                                                <div key={idx} className="flex flex-col items-center flex-shrink-0">
                                                    <span className="text-[9px] font-bold text-slate-300 uppercase mb-1">{t('history.setLabel', {setNumber: set.setNumber})}</span>
                                                    <div className={`
                                                        min-w-[3rem] text-center px-2 py-1.5 rounded-lg text-xs font-bold border backdrop-blur-sm
                                                        ${setTheme.bg} ${setTheme.text} ${setTheme.textDark} ${setTheme.border}
                                                    `}>
                                                        {set.scoreA}-{set.scoreB}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>

                                <div className="flex items-center gap-3 w-full sm:w-auto">
                                    <Button 
                                        onClick={(e) => { e.stopPropagation(); onAnalyze(); }}
                                        className="flex-1 sm:flex-none bg-slate-800 text-white hover:bg-slate-700 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
                                        size="sm"
                                    >
                                        <BarChart2 size={14} /> Analysis
                                    </Button>
                                    <button 
                                        onClick={(e) => { e.stopPropagation(); onDelete(match.id); }}
                                        className="p-2.5 rounded-xl bg-rose-500/10 text-rose-500 hover:bg-rose-500 hover:text-white transition-all border border-rose-500/20"
                                        title={t('historyList.delete')}
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </motion.div>
        </div>
    );
});

// --- MAIN COMPONENT ---

type FilterType = 'all' | 'A' | 'B' | 'scouted';
type SortType = 'newest' | 'oldest' | 'longest' | 'shortest';

export const HistoryList: React.FC = () => {
    const { matches, deleteMatch, importJSON, exportJSON } = useHistoryStore();
    const { t } = useTranslation();
    
    const [searchTerm, setSearchTerm] = useState('');
    const [filterType, setFilterType] = useState<FilterType>('all');
    const [sortOrder, setSortOrder] = useState<SortType>('newest');
    
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);
    const [showStats, setShowStats] = useState(false);
    const [importMsg, setImportMsg] = useState<{ type: 'success' | 'error', text: string } | null>(null);
    
    const fileInputRef = useRef<HTMLInputElement>(null);

    const filteredMatches = useMemo(() => {
        let filtered = matches.filter(m => {
            const matchesSearch = 
                m.teamAName.toLowerCase().includes(searchTerm.toLowerCase()) || 
                m.teamBName.toLowerCase().includes(searchTerm.toLowerCase());
            
            let matchesFilter = true;
            if (filterType === 'A') matchesFilter = m.winner === 'A';
            if (filterType === 'B') matchesFilter = m.winner === 'B';
            if (filterType === 'scouted') {
                matchesFilter = (m.actionLog || []).some((log: any) => log.type === 'POINT' && log.playerId);
            }

            return matchesSearch && matchesFilter;
        });

        return filtered.sort((a, b) => {
            if (sortOrder === 'newest') return b.timestamp - a.timestamp;
            if (sortOrder === 'oldest') return a.timestamp - b.timestamp;
            if (sortOrder === 'longest') return b.durationSeconds - a.durationSeconds;
            if (sortOrder === 'shortest') return a.durationSeconds - b.durationSeconds;
            return 0;
        });

    }, [matches, searchTerm, filterType, sortOrder]);

    const handleExportJSON = () => {
        const json = JSON.parse(exportJSON());
        const dateStr = new Date().toISOString().split('T')[0];
        downloadJSON(`volleyscore_backup_${dateStr}`, json);
    };

    const handleExportCSV = () => {
        exportMatchesToCSV(filteredMatches);
    };

    const handleImportClick = () => {
        if (fileInputRef.current) fileInputRef.current.click();
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        try {
            const content = await parseJSONFile(file);
            const result = importJSON(JSON.stringify(content), { merge: true });
            
            if (result.success) {
                setImportMsg({ type: 'success', text: t('historyList.importSuccess') });
            } else {
                setImportMsg({ type: 'error', text: result.errors?.[0] || t('historyList.importError') });
            }
        } catch (err) {
            setImportMsg({ type: 'error', text: t('historyList.importError') });
        }
        
        if (fileInputRef.current) fileInputRef.current.value = '';
        setTimeout(() => setImportMsg(null), 3000);
    };

    if (selectedMatch) {
        return <MatchDetail match={selectedMatch} onBack={() => setSelectedMatch(null)} />;
    }

    const filterOptions = [
        { value: 'all', label: t('historyList.filters.all') },
        { value: 'A', label: t('historyList.filters.winnerA') },
        { value: 'B', label: t('historyList.filters.winnerB') },
        { value: 'scouted', label: t('historyList.filters.scouted') },
    ];

    const sortOptions = [
        { value: 'newest', label: t('historyList.sort.newest') },
        { value: 'oldest', label: t('historyList.sort.oldest') },
        { value: 'longest', label: t('historyList.sort.longest') },
        { value: 'shortest', label: t('historyList.sort.shortest') },
    ];

    return (
        <div className="flex flex-col h-full min-h-[50vh]">
            <input 
                type="file" 
                ref={fileInputRef} 
                className="hidden" 
                accept=".json" 
                onChange={handleFileChange}
            />
            
            <Suspense fallback={null}>
                <TeamStatsModal isOpen={showStats} onClose={() => setShowStats(false)} />
            </Suspense>

            <div className="sticky top-0 z-30 mb-6 -mx-1 px-1">
                <div className="bg-slate-100/90 dark:bg-slate-900/90 backdrop-blur-xl border border-white/20 dark:border-white/5 rounded-2xl p-3 shadow-lg shadow-black/5 dark:shadow-black/20">
                    <div className="flex gap-2 mb-2">
                        <div className="relative flex-1 group">
                            <div className="absolute inset-0 bg-white dark:bg-white/5 rounded-xl transition-all group-focus-within:ring-2 group-focus-within:ring-indigo-500/30"></div>
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                            <input 
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                placeholder={t('historyList.searchPlaceholder')}
                                className="relative w-full bg-transparent border border-black/5 dark:border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-sm text-slate-800 dark:text-white focus:outline-none placeholder:text-slate-400"
                            />
                        </div>
                        
                        <div className="flex gap-1">
                            <button onClick={() => setShowStats(true)} className="p-2.5 rounded-2xl bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/30 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-500/20 transition-colors" title="Aggregated Stats">
                                <PieChart size={18} />
                            </button>
                            
                            <ExportMenu onExportJSON={handleExportJSON} onExportCSV={handleExportCSV} />
                            
                            <button onClick={handleImportClick} className="p-2.5 rounded-2xl bg-white dark:bg-white/5 border border-black/5 dark:border-white/10 text-slate-500 dark:text-slate-400 hover:text-indigo-500 dark:hover:text-white hover:bg-indigo-50 dark:hover:bg-white/10 transition-colors" title={t('historyList.import')}>
                                <Download size={18} />
                            </button>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 relative z-20">
                        <CustomSelect 
                            value={filterType}
                            onChange={(val) => setFilterType(val as FilterType)}
                            options={filterOptions}
                            icon={<Filter size={14} />}
                            align="left"
                        />
                        <CustomSelect 
                            value={sortOrder}
                            onChange={(val) => setSortOrder(val as SortType)}
                            options={sortOptions}
                            icon={<SortDesc size={14} />}
                            align="right"
                        />
                    </div>

                    <AnimatePresence>
                        {importMsg && (
                            <motion.div 
                                initial={{ opacity: 0, height: 0, marginTop: 0 }} 
                                animate={{ opacity: 1, height: 'auto', marginTop: 8 }}
                                exit={{ opacity: 0, height: 0, marginTop: 0 }}
                                className={`text-xs px-3 py-2 rounded-xl font-bold flex items-center gap-2 ${importMsg.type === 'success' ? 'bg-emerald-500/20 text-emerald-600' : 'bg-rose-500/20 text-rose-600'}`}
                            >
                                <AlertCircle size={14} /> {importMsg.text}
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </div>

            <div className="flex-1 min-h-0">
                {filteredMatches.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-slate-400 opacity-60">
                        <div className="p-4 bg-slate-200 dark:bg-white/5 rounded-full mb-3">
                            <Clock size={32} strokeWidth={1.5} className="opacity-50" />
                        </div>
                        <p className="text-sm font-medium">{t('historyList.empty')}</p>
                    </div>
                ) : (
                    <Virtuoso 
                        data={filteredMatches}
                        totalCount={filteredMatches.length}
                        className="custom-scrollbar"
                        style={{ height: '100%' }}
                        itemContent={(index, match) => (
                            <HistoryCard 
                                key={match.id} 
                                match={match} 
                                onDelete={deleteMatch}
                                isExpanded={expandedId === match.id}
                                onToggle={() => setExpandedId(expandedId === match.id ? null : match.id)}
                                onAnalyze={() => setSelectedMatch(match)}
                            />
                        )}
                    />
                )}
            </div>
        </div>
    );
};
