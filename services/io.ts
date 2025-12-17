
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { Match } from '../stores/historyStore';
import { GameState } from '../types';
import { sanitizeInput } from '../utils/security';

/**
 * I/O Service v2.1
 */

const shareOrDownload = async (filename: string, jsonString: string, title: string) => {
    try {
        if (Capacitor.isNativePlatform()) {
            const savedFile = await Filesystem.writeFile({
                path: filename,
                data: jsonString,
                directory: Directory.Cache,
                encoding: Encoding.UTF8
            });

            await Share.share({
                title: title,
                url: savedFile.uri,
                dialogTitle: title
            }).catch(e => {
                if (e.message !== 'Share canceled') {
                    console.error("Native Share failed:", e);
                }
            });
        } else {
            const blob = new Blob([jsonString], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = filename;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
        }
    } catch (error) {
        console.error(`Failed to export ${filename}:`, error);
        throw error;
    }
};

export const downloadJSON = async (filename: string, data: any): Promise<void> => {
    const safeFilename = filename.endsWith('.json') ? filename : `${filename}.json`;
    await shareOrDownload(safeFilename, JSON.stringify(data, null, 2), 'VolleyScore Backup');
};

export const exportActiveMatch = async (gameState: GameState): Promise<void> => {
    const payload = {
        type: 'VS_ACTIVE_MATCH',
        version: '2.0.6',
        timestamp: Date.now(),
        data: gameState
    };
    
    const dateStr = new Date().toISOString().split('T')[0];
    const filename = `vs_match_live_${dateStr}.vsg`;
    
    await shareOrDownload(filename, JSON.stringify(payload, null, 2), 'Share Active Match');
};

const deepSanitize = (obj: any): any => {
    if (typeof obj === 'string') {
        return sanitizeInput(obj);
    }
    if (Array.isArray(obj)) {
        return obj.map(deepSanitize);
    }
    if (typeof obj === 'object' && obj !== null) {
        const result: any = {};
        for (const key in obj) {
            if (Object.prototype.hasOwnProperty.call(obj, key)) {
                result[key] = deepSanitize(obj[key]);
            }
        }
        return result;
    }
    return obj;
};

export const parseJSONFile = (file: File): Promise<any> => {
  return new Promise((resolve, reject) => {
    if (!file) {
      reject(new Error('No file provided'));
      return;
    }

    const reader = new FileReader();

    reader.onload = (event) => {
      try {
        const result = event.target?.result;
        if (typeof result !== 'string') {
          throw new Error('File content is empty or invalid.');
        }
        const parsed = JSON.parse(result);
        const cleanData = deepSanitize(parsed);
        resolve(cleanData);
      } catch (error) {
        reject(new Error('Invalid JSON format.'));
      }
    };

    reader.onerror = () => {
      reject(new Error('Failed to read file.'));
    };

    reader.readAsText(file);
  });
};

export const exportMatchesToCSV = async (matches: Match[]): Promise<void> => {
    try {
        const header = [
            "Date", "Duration (min)", "Winner", 
            "Team A", "Team B", 
            "Sets A", "Sets B", 
            "Scores (Sets)",
            "Total Points A", "Total Points B",
            "Kills A", "Kills B", "Blocks A", "Blocks B", "Aces A", "Aces B"
        ].join(",");

        const rows = matches.map(m => {
            const date = new Date(m.timestamp).toLocaleDateString();
            const duration = Math.round(m.durationSeconds / 60);
            const winner = m.winner === 'A' ? m.teamAName : (m.winner === 'B' ? m.teamBName : 'Draw');
            const setScores = m.sets.map(s => `${s.scoreA}-${s.scoreB}`).join(" / ");
            
            let totalA = 0, totalB = 0;
            let killsA = 0, killsB = 0;
            let blocksA = 0, blocksB = 0;
            let acesA = 0, acesB = 0;

            if (m.actionLog) {
                m.actionLog.forEach((log: any) => {
                    if (log.type === 'POINT') {
                        if (log.team === 'A') totalA++; else totalB++;
                        if (log.skill === 'attack') { if(log.team === 'A') killsA++; else killsB++; }
                        else if (log.skill === 'block') { if(log.team === 'A') blocksA++; else blocksB++; }
                        else if (log.skill === 'ace') { if(log.team === 'A') acesA++; else acesB++; }
                    }
                });
            } else {
                m.sets.forEach(s => { totalA += s.scoreA; totalB += s.scoreB; });
            }

            const esc = (s: string) => `"${s.replace(/"/g, '""')}"`;

            return [
                esc(date), duration, esc(winner),
                esc(m.teamAName), esc(m.teamBName),
                m.setsA, m.setsB,
                esc(setScores),
                totalA, totalB,
                killsA, killsB, blocksA, blocksB, acesA, acesB
            ].join(",");
        });

        const csvContent = [header, ...rows].join("\n");
        const filename = `volleyscore_export_${Date.now()}.csv`;

        if (Capacitor.isNativePlatform()) {
            const savedFile = await Filesystem.writeFile({
                path: filename,
                data: csvContent,
                directory: Directory.Cache,
                encoding: Encoding.UTF8
            });
            
            await Share.share({
                title: 'VolleyScore Stats',
                url: savedFile.uri,
                dialogTitle: 'Export CSV'
            }).catch(e => {
                if (e.message !== 'Share canceled') console.error("CSV Share failed:", e);
            });
        } else {
            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement("a");
            const url = URL.createObjectURL(blob);
            link.setAttribute("href", url);
            link.setAttribute("download", filename);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
    } catch (e) {
        console.error("CSV Export Failed", e);
    }
};
