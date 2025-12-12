
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { Match } from '../stores/historyStore';
import { GameState } from '../types';
import { sanitizeInput } from '../utils/security';

/**
 * I/O Service
 * Handles file system interactions for importing and exporting application data.
 */

// --- HELPERS ---

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

/**
 * Triggers a download or Native Share of the provided data as a JSON file.
 * Used for System Backups.
 */
export const downloadJSON = async (filename: string, data: any): Promise<void> => {
    const safeFilename = filename.endsWith('.json') ? filename : `${filename}.json`;
    await shareOrDownload(safeFilename, JSON.stringify(data, null, 2), 'VolleyScore Backup');
};

/**
 * NEW: Exports the current ACTIVE game state to a portable file.
 * This allows moving an unfinished game between devices.
 */
export const exportActiveMatch = async (gameState: GameState): Promise<void> => {
    // We wrap the state to identify it easily during import
    const payload = {
        type: 'VS_ACTIVE_MATCH',
        version: '2.0.0',
        timestamp: Date.now(),
        data: gameState
    };
    
    const dateStr = new Date().toISOString().split('T')[0];
    const filename = `vs_match_inprogress_${dateStr}.vsg`; // .vsg = VolleyScore Game
    
    await shareOrDownload(filename, JSON.stringify(payload, null, 2), 'Share Active Match');
};

/**
 * Recursively sanitizes string values in an object to prevent XSS from imported files.
 */
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

/**
 * Reads a File object and parses its content as JSON.
 * Applies sanitization to all string fields.
 */
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
        
        // Security: Sanitize all imported data
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

/**
 * Converts Match Data to CSV and triggers download/share.
 */
export const exportMatchesToCSV = async (matches: Match[]): Promise<void> => {
    try {
        // 1. Build Header
        const header = [
            "Date", "Duration (min)", "Winner", 
            "Team A", "Team B", 
            "Sets A", "Sets B", 
            "Scores (Sets)",
            "Total Points A", "Total Points B",
            "MVP Name", "MVP Points",
            "Kills A", "Kills B", "Blocks A", "Blocks B", "Aces A", "Aces B", "Errors A", "Errors B"
        ].join(",");

        // 2. Build Rows
        const rows = matches.map(m => {
            const date = new Date(m.timestamp).toLocaleDateString();
            const duration = Math.round(m.durationSeconds / 60);
            const winner = m.winner === 'A' ? m.teamAName : (m.winner === 'B' ? m.teamBName : 'Draw');
            
            const setScores = m.sets.map(s => `${s.scoreA}-${s.scoreB}`).join(" / ");
            
            let totalA = 0, totalB = 0;
            let killsA = 0, killsB = 0;
            let blocksA = 0, blocksB = 0;
            let acesA = 0, acesB = 0;
            let errsA = 0, errsB = 0; // "Errors A" means points B gained from A's error

            const playerPoints: Record<string, {name: string, pts: number}> = {};

            if (m.actionLog) {
                m.actionLog.forEach((log: any) => {
                    if (log.type === 'POINT') {
                        if (log.team === 'A') totalA++; else totalB++;
                        
                        if (log.skill === 'attack') { if(log.team === 'A') killsA++; else killsB++; }
                        else if (log.skill === 'block') { if(log.team === 'A') blocksA++; else blocksB++; }
                        else if (log.skill === 'ace') { if(log.team === 'A') acesA++; else acesB++; }
                        else if (log.skill === 'opponent_error') { if(log.team === 'A') errsB++; else errsA++; } // Inverted logic: A gains from B error

                        if (log.playerId && log.playerId !== 'unknown') {
                            if(!playerPoints[log.playerId]) playerPoints[log.playerId] = { name: "Unknown", pts: 0 };
                            playerPoints[log.playerId].pts++;
                        }
                    }
                });
            } else {
                // Fallback if no detailed log
                m.sets.forEach(s => { totalA += s.scoreA; totalB += s.scoreB; });
            }

            // Find MVP
            let mvpName = "-";
            let mvpPts = 0;
            
            // Re-map IDs to Names from Roster Snapshots
            if (m.teamARoster) m.teamARoster.players.forEach(p => { if(playerPoints[p.id]) playerPoints[p.id].name = p.name; });
            if (m.teamBRoster) m.teamBRoster.players.forEach(p => { if(playerPoints[p.id]) playerPoints[p.id].name = p.name; });

            Object.values(playerPoints).forEach(p => {
                if(p.pts > mvpPts) { mvpPts = p.pts; mvpName = p.name; }
            });

            // Escape strings for CSV
            const esc = (s: string) => `"${s.replace(/"/g, '""')}"`;

            return [
                esc(date), duration, esc(winner),
                esc(m.teamAName), esc(m.teamBName),
                m.setsA, m.setsB,
                esc(setScores),
                totalA, totalB,
                esc(mvpName), mvpPts,
                killsA, killsB, blocksA, blocksB, acesA, acesB, errsA, errsB
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
