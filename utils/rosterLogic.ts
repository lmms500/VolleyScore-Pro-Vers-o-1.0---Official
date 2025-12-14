
import { Team, Player, RotationReport, DeletedPlayerRecord, RotationMode } from '../types';
import { PLAYER_LIMIT_ON_COURT, PLAYERS_PER_TEAM } from '../constants';
import { balanceTeamsSnake, distributeStandard, getStandardRotationResult, getBalancedRotationResult } from './balanceUtils';
import { v4 as uuidv4 } from 'uuid';
import { sanitizeInput } from './security';

const BENCH_LIMIT = 6;

// --- TYPES ---
export interface ValidationResult {
    valid: boolean;
    // New: Translation Key instead of raw message
    messageKey?: string; 
    // New: Parameters for the translation
    messageParams?: Record<string, string>;
    // Legacy support (optional)
    message?: string;
    conflictId?: string;
    conflictName?: string;
}

// Helper to find a player anywhere in the game state structure passed as args
export const findAllPlayers = (courtA: Team, courtB: Team, queue: Team[]) => {
    return [
        ...courtA.players, ...(courtA.reserves || []),
        ...courtB.players, ...(courtB.reserves || []),
        ...queue.flatMap(t => [...t.players, ...(t.reserves || [])])
    ];
};

/**
 * 🧠 BUSINESS CORE: Single Number Constraint
 * Enforces that no two players in the same team roster (players + reserves) share the same number.
 * This is the SINGLE SOURCE OF TRUTH for validity.
 */
export const validateUniqueNumber = (
    roster: Player[], 
    candidateNumber: string | undefined, 
    excludePlayerId?: string
): ValidationResult => {
    // 1. Allow empty numbers (optional numbers)
    if (!candidateNumber || candidateNumber.trim() === '') {
        return { valid: true };
    }

    const normalizedCandidate = candidateNumber.trim();

    // 2. Scan roster for conflicts
    const conflict = roster.find(p => 
        p.number === normalizedCandidate && 
        p.id !== excludePlayerId // Ignore self
    );

    if (conflict) {
        return {
            valid: false,
            messageKey: 'validation.numberConflict',
            messageParams: { number: normalizedCandidate, name: conflict.name },
            // Keeping raw message for dev console logs if needed
            message: `Number ${normalizedCandidate} belongs to ${conflict.name}`,
            conflictId: conflict.id,
            conflictName: conflict.name
        };
    }

    return { valid: true };
};

// Legacy wrapper ensuring compatibility with boolean checks, but redirecting to new logic
// @deprecated Use validateUniqueNumber directly
export const isNumberAvailable = (team: Team, number: string | undefined, excludePlayerId?: string): boolean => {
    const roster = [...team.players, ...(team.reserves || [])];
    return validateUniqueNumber(roster, number, excludePlayerId).valid;
};

// Helper specific for Team objects
export const validateUniqueNumberInTeam = (team: Team, number: string, excludeId?: string): ValidationResult => {
    const roster = [...team.players, ...(team.reserves || [])];
    return validateUniqueNumber(roster, number, excludeId);
}

// Deprecated legacy alias
export const validateUniqueNumberLegacy = isNumberAvailable;

export const createPlayer = (name: string, index: number, profileId?: string, skillLevel: number = 5, number?: string): Player => ({
    id: uuidv4(),
    name: sanitizeInput(name),
    profileId,
    skillLevel,
    number: number ? number.trim() : undefined,
    isFixed: false,
    originalIndex: index
});

export const createTeam = (name: string, players: Player[], color: string = 'slate'): Team => ({
    id: uuidv4(),
    name: sanitizeInput(name),
    color,
    players,
    reserves: [],
    hasActiveBench: false
});

/**
 * 🔢 GLOBAL NAMING LOGIC
 * Scans ALL teams (Court A, Court B, Queue) to find the highest "Team N" number.
 * Ensures that if "Team 4" exists, the next one is "Team 5", regardless of queue length.
 */
const generateNextTeamName = (courtA: Team, courtB: Team, queue: Team[]): string => {
    const allTeams = [courtA, courtB, ...queue];
    let maxNumber = 0;
    
    // Regex to match "Team 1", "Time 2", "Equipo 3" etc. (Case insensitive)
    // Matches common variations to be robust against manual renames or localization
    const regex = /(?:Team|Time|Equipo)\s+(\d+)/i;

    allTeams.forEach(t => {
        const match = t.name.match(regex);
        if (match) {
            const num = parseInt(match[1], 10);
            if (!isNaN(num)) {
                maxNumber = Math.max(maxNumber, num);
            }
        }
    });

    // If maxNumber is 0 (e.g. only "Home" and "Guest" exist), start at 1.
    // Otherwise increment.
    return `Team ${maxNumber + 1}`;
};

// --- PURE LOGIC HANDLERS ---

export const handleAddPlayer = (
    courtA: Team, courtB: Team, queue: Team[], 
    newPlayer: Player, targetId: string
): { courtA: Team, courtB: Team, queue: Team[] } => {
    
    // Duplicate Name Check (Global within active game context to prevent confusion)
    const all = findAllPlayers(courtA, courtB, queue);
    if (all.some(p => p.name.toLowerCase() === newPlayer.name.toLowerCase())) {
        return { courtA, courtB, queue }; 
    }

    const addToTeamSmart = (team: Team): Team => {
        if (team.players.length < PLAYERS_PER_TEAM) {
            return { ...team, players: [...team.players, newPlayer] };
        }
        if ((team.reserves || []).length < BENCH_LIMIT) {
            return { 
                ...team, 
                reserves: [...(team.reserves || []), newPlayer],
                hasActiveBench: true 
            };
        }
        return team;
    };

    const addToReservesDirect = (team: Team): Team => {
        if ((team.reserves || []).length < BENCH_LIMIT) {
            return { ...team, reserves: [...(team.reserves || []), newPlayer] };
        }
        return team;
    };

    // Check against Team ID property
    if (targetId === 'A' || targetId === courtA.id) {
        return { courtA: addToTeamSmart(courtA), courtB, queue };
    }
    if (targetId === 'B' || targetId === courtB.id) {
        return { courtA, courtB: addToTeamSmart(courtB), queue };
    }

    // Explicit Reserves Targeting
    if (targetId === 'A_Reserves' || targetId === `${courtA.id}_Reserves`) {
        return { courtA: addToReservesDirect(courtA), courtB, queue };
    }
    if (targetId === 'B_Reserves' || targetId === `${courtB.id}_Reserves`) {
        return { courtA, courtB: addToReservesDirect(courtB), queue };
    }

    // Queue Logic
    if (targetId.endsWith('_Reserves')) {
        const qId = targetId.split('_Reserves')[0];
        const newQueue = queue.map(t => t.id === qId ? addToReservesDirect(t) : t);
        return { courtA, courtB, queue: newQueue };
    }

    const qIndex = queue.findIndex(t => t.id === targetId);
    if (qIndex >= 0) {
        const newQueue = [...queue];
        newQueue[qIndex] = addToTeamSmart(newQueue[qIndex]);
        return { courtA, courtB, queue: newQueue };
    }

    if (targetId === 'Queue') {
        const newQueue = [...queue];
        
        // Check if the LAST team in queue has space
        if (newQueue.length > 0 && newQueue[newQueue.length - 1].players.length < PLAYERS_PER_TEAM) {
            const last = newQueue[newQueue.length - 1];
            newQueue[newQueue.length - 1] = { ...last, players: [...last.players, newPlayer] };
        } else {
            // Create NEW Team with robust naming
            const nextName = generateNextTeamName(courtA, courtB, newQueue);
            newQueue.push(createTeam(nextName, [newPlayer]));
        }
        return { courtA, courtB, queue: newQueue };
    }

    return { courtA, courtB, queue };
};

export const handleRemovePlayer = (
    courtA: Team, courtB: Team, queue: Team[], playerId: string
): { courtA: Team, courtB: Team, queue: Team[] } => {
    
    let deletedPlayer: Player | undefined;
    let targetTeam: Team | undefined;
    let originType: 'A' | 'B' | 'Queue' | null = null;
    let isFromReserves = false;

    const removeFromList = (list: Player[]) => {
        const p = list.find(x => x.id === playerId);
        if (p) { deletedPlayer = p; return list.filter(x => x.id !== playerId); }
        return list;
    };

    let newA = { ...courtA, players: [...courtA.players], reserves: [...(courtA.reserves || [])] };
    let newB = { ...courtB, players: [...courtB.players], reserves: [...(courtB.reserves || [])] };
    let newQueue = queue.map(t => ({...t, players: [...t.players], reserves: [...(t.reserves || [])]}));

    // Search & Remove Logic
    newA.players = removeFromList(newA.players);
    if (!deletedPlayer) {
        newA.reserves = removeFromList(newA.reserves || []);
        if (deletedPlayer) isFromReserves = true;
    }
    if (deletedPlayer) { targetTeam = newA; originType = 'A'; }

    if (!deletedPlayer) {
        newB.players = removeFromList(newB.players);
        if (!deletedPlayer) {
            newB.reserves = removeFromList(newB.reserves || []);
            if (deletedPlayer) isFromReserves = true;
        }
        if (deletedPlayer) { targetTeam = newB; originType = 'B'; }
    }

    if (!deletedPlayer) {
        newQueue = newQueue.map(t => {
            if (deletedPlayer) return t; 
            const pRes = removeFromList(t.players);
            if (deletedPlayer) { targetTeam = t; originType = 'Queue'; return { ...t, players: pRes }; }
            
            const rRes = removeFromList(t.reserves || []);
            if (deletedPlayer) { isFromReserves = true; targetTeam = t; originType = 'Queue'; return { ...t, reserves: rRes }; }
            
            return t;
        });
    }

    if (!deletedPlayer || !targetTeam || !originType) return { courtA, courtB, queue };

    // 1. If user was ALREADY in reserves, they are being "knocked out" completely (to end of queue)
    if (isFromReserves) {
        const endQueue = [...newQueue];
        if (endQueue.length > 0) {
            const last = endQueue[endQueue.length - 1];
            if (last.players.length < PLAYERS_PER_TEAM) {
                endQueue[endQueue.length - 1] = { ...last, players: [...last.players, deletedPlayer] };
            } else {
                endQueue.push(createTeam("Knocked Out", [deletedPlayer]));
            }
        } else {
            endQueue.push(createTeam("Knocked Out", [deletedPlayer]));
        }
        return { courtA: newA, courtB: newB, queue: endQueue };
    }

    // 2. If user was ON COURT (A/B) - Move to Bench
    if (originType === 'A' || originType === 'B') {
        const updatedTeamWithReserve = { 
            ...targetTeam, 
            players: targetTeam.players.filter(p => p.id !== playerId),
            reserves: [...(targetTeam.reserves || []), deletedPlayer],
            hasActiveBench: true 
        };

        if (originType === 'A') return { courtA: updatedTeamWithReserve, courtB: newB, queue: newQueue };
        if (originType === 'B') return { courtA: newA, courtB: updatedTeamWithReserve, queue: newQueue };
    } 
    
    // 3. If user was in QUEUE (Main squad)
    if (originType === 'Queue') {
        if (targetTeam.hasActiveBench) {
             const updatedTeam = { ...targetTeam, reserves: [...(targetTeam.reserves||[]), deletedPlayer] };
             const qIndex = queue.findIndex(t => t.id === targetTeam!.id);
             newQueue[qIndex] = updatedTeam;
             return { courtA: newA, courtB: newB, queue: newQueue };
        } else {
            const endQueue = [...newQueue];
             if (endQueue.length > 0) {
                const last = endQueue[endQueue.length - 1];
                if (last.players.length < PLAYERS_PER_TEAM) {
                    endQueue[endQueue.length - 1] = { ...last, players: [...last.players, deletedPlayer] };
                } else {
                    endQueue.push(createTeam("Knocked Out", [deletedPlayer]));
                }
            } else {
                endQueue.push(createTeam("Knocked Out", [deletedPlayer]));
            }
            return { courtA: newA, courtB: newB, queue: endQueue };
        }
    }

    return { courtA: newA, courtB: newB, queue: newQueue };
};

export const handleDeletePlayer = (
    courtA: Team, courtB: Team, queue: Team[], playerId: string
): { courtA: Team, courtB: Team, queue: Team[], record?: DeletedPlayerRecord } => {
    let deletedPlayer: Player | undefined;
    let originId = '';

    const checkAndRemove = (list: Player[], teamId: string): Player[] => {
        const found = list.find(p => p.id === playerId);
        if (found) {
            deletedPlayer = found;
            originId = teamId;
            return list.filter(p => p.id !== playerId);
        }
        return list;
    };

    const newA = { ...courtA, players: checkAndRemove(courtA.players, 'A'), reserves: checkAndRemove(courtA.reserves||[], 'A_Reserves') };
    const newB = { ...courtB, players: checkAndRemove(courtB.players, 'B'), reserves: checkAndRemove(courtB.reserves||[], 'B_Reserves') };
    
    const newQueue = queue.map(t => ({
        ...t,
        players: checkAndRemove(t.players, t.id),
        reserves: checkAndRemove(t.reserves||[], `${t.id}_Reserves`)
    }));

    if (deletedPlayer) {
        return { courtA: newA, courtB: newB, queue: newQueue, record: { player: deletedPlayer, originId, timestamp: Date.now() } };
    }
    return { courtA, courtB, queue };
};

export const handleMovePlayer = (
    courtA: Team, courtB: Team, queue: Team[], 
    playerId: string, fromId: string, toId: string, newIndex?: number
): { courtA: Team, courtB: Team, queue: Team[] } => {
    
    const getTargetListSize = (tid: string): number => {
        if (tid === 'A') return courtA.players.length;
        if (tid === 'B') return courtB.players.length;
        if (tid === 'A_Reserves') return (courtA.reserves || []).length;
        if (tid === 'B_Reserves') return (courtB.reserves || []).length;
        
        if (tid.endsWith('_Reserves')) {
            const t = queue.find(x => `${x.id}_Reserves` === tid);
            return t ? (t.reserves || []).length : 99;
        }
        const t = queue.find(x => x.id === tid);
        return t ? t.players.length : 99;
    };

    if (fromId !== toId) {
        const currentSize = getTargetListSize(toId);
        const limit = toId.includes('Reserves') ? BENCH_LIMIT : PLAYERS_PER_TEAM;
        
        if (currentSize >= limit) {
            console.warn(`[MoveBlocked] Target ${toId} is full (${currentSize}/${limit}).`);
            return { courtA, courtB, queue };
        }
    }

    let player: Player | undefined;
         
    const removeFromList = (list: Player[]) => {
        const p = list.find(x => x.id === playerId);
        if (p) { player = p; return list.filter(x => x.id !== playerId); }
        return list;
    };

    let newA = { ...courtA };
    let newB = { ...courtB };
    let newQueue = queue.map(t => ({...t, players: [...t.players], reserves: [...(t.reserves||[])]}));
    
    // Remove Logic
    if (fromId === 'A') newA.players = removeFromList(newA.players);
    else if (fromId === 'A_Reserves') newA.reserves = removeFromList(newA.reserves || []);
    else if (fromId === 'B') newB.players = removeFromList(newB.players);
    else if (fromId === 'B_Reserves') newB.reserves = removeFromList(newB.reserves || []);
    else {
        newQueue = newQueue.map(t => {
            if (fromId === t.id) return { ...t, players: removeFromList(t.players) };
            if (fromId === `${t.id}_Reserves`) return { ...t, reserves: removeFromList(t.reserves || []) };
            return t;
        });
    }
    
    if (!player) return { courtA, courtB, queue };

    // Add Logic
    const addToList = (list: Player[], p: Player, idx?: number) => {
        const copy = [...list];
        const safeIdx = (idx !== undefined && idx >= 0 && idx <= copy.length) ? idx : copy.length;
        copy.splice(safeIdx, 0, p);
        return copy;
    };

    if (toId === 'A') newA.players = addToList(newA.players, player, newIndex);
    else if (toId === 'A_Reserves') newA.reserves = addToList(newA.reserves || [], player, newIndex);
    else if (toId === 'B') newB.players = addToList(newB.players, player, newIndex);
    else if (toId === 'B_Reserves') newB.reserves = addToList(newB.reserves || [], player, newIndex);
    else {
        newQueue = newQueue.map(t => {
            if (toId === t.id) return { ...t, players: addToList(t.players, player, newIndex) };
            if (toId === `${t.id}_Reserves`) return { ...t, reserves: addToList(t.reserves || [], player, newIndex) };
            return t;
        });
    }

    return { courtA: newA, courtB: newB, queue: newQueue };
};

export const handleRotate = (
    courtA: Team, courtB: Team, queue: Team[], winnerId: 'A'|'B', mode: RotationMode
): { courtA: Team, courtB: Team, queue: Team[], report: RotationReport | null } => {
    
    if (queue.length === 0 && courtA.players.length >= 6 && courtB.players.length >= 6) {
        return { courtA, courtB, queue, report: null };
    }

    const winnerTeam = winnerId === 'A' ? courtA : courtB;
    const loserTeam = winnerId === 'A' ? courtB : courtA;

    let result;
    if (mode === 'balanced') {
        result = getBalancedRotationResult(winnerTeam, loserTeam, queue);
    } else {
        result = getStandardRotationResult(winnerTeam, loserTeam, queue);
    }

    const nextCourtA = winnerId === 'A' 
        ? { ...courtA } 
        : { ...result.incomingTeam, reserves: courtA.reserves, hasActiveBench: courtA.hasActiveBench }; 
        
    const nextCourtB = winnerId === 'B' 
        ? { ...courtB } 
        : { ...result.incomingTeam, reserves: courtB.reserves, hasActiveBench: courtB.hasActiveBench };

    const report: RotationReport = {
        outgoingTeam: loserTeam,
        incomingTeam: result.incomingTeam,
        retainedPlayers: result.retainedPlayers,
        stolenPlayers: result.stolenPlayers,
        queueAfterRotation: result.queueAfterRotation,
        logs: result.logs
    };

    return { courtA: nextCourtA, courtB: nextCourtB, queue: result.queueAfterRotation, report };
};
