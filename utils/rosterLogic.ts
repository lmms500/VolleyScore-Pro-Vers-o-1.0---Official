
import { Team, Player, RotationReport, DeletedPlayerRecord, RotationMode } from '../types';
import { getPlayersOnCourt, PLAYERS_PER_TEAM } from '../constants';
import { balanceTeamsSnake, distributeStandard, getStandardRotationResult, getBalancedRotationResult } from './balanceUtils';
import { v4 as uuidv4 } from 'uuid';
import { sanitizeInput } from './security';

const BENCH_LIMIT = 6;

// --- TYPES ---
export interface ValidationResult {
    valid: boolean;
    messageKey?: string; 
    messageParams?: Record<string, string>;
    message?: string;
    conflictId?: string;
    conflictName?: string;
}

export const findAllPlayers = (courtA: Team, courtB: Team, queue: Team[]) => {
    return [
        ...courtA.players, ...(courtA.reserves || []),
        ...courtB.players, ...(courtB.reserves || []),
        ...queue.flatMap(t => [...t.players, ...(t.reserves || [])])
    ];
};

export const validateUniqueNumber = (
    roster: Player[], 
    candidateNumber: string | undefined, 
    excludePlayerId?: string
): ValidationResult => {
    if (!candidateNumber || candidateNumber.trim() === '') {
        return { valid: true };
    }
    const normalizedCandidate = candidateNumber.trim();
    const conflict = roster.find(p => p.number === normalizedCandidate && p.id !== excludePlayerId);

    if (conflict) {
        return {
            valid: false,
            messageKey: 'validation.numberConflict',
            messageParams: { number: normalizedCandidate, name: conflict.name },
            message: `Number ${normalizedCandidate} belongs to ${conflict.name}`,
            conflictId: conflict.id,
            conflictName: conflict.name
        };
    }
    return { valid: true };
};

export const isNumberAvailable = (team: Team, number: string | undefined, excludePlayerId?: string): boolean => {
    const roster = [...team.players, ...(team.reserves || [])];
    return validateUniqueNumber(roster, number, excludePlayerId).valid;
};

export const createPlayer = (name: string, index: number, profileId?: string, skillLevel: number = 5, number?: string): Player => ({
    id: uuidv4(),
    name: sanitizeInput(name),
    profileId,
    skillLevel,
    number: number ? number.trim() : undefined,
    isFixed: false,
    originalIndex: index,
    displayOrder: index
});

export const createTeam = (name: string, players: Player[], color: string = 'slate'): Team => ({
    id: uuidv4(),
    name: sanitizeInput(name),
    color,
    players,
    reserves: [],
    hasActiveBench: false
});

const generateNextTeamName = (courtA: Team, courtB: Team, queue: Team[]): string => {
    const allTeams = [courtA, courtB, ...queue];
    let maxNumber = 0;
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
    return `Team ${maxNumber + 1}`;
};

// --- PURE LOGIC HANDLERS ---

// Updated to accept courtLimit
export const handleAddPlayer = (
    courtA: Team, courtB: Team, queue: Team[], 
    newPlayer: Player, targetId: string,
    courtLimit: number
): { courtA: Team, courtB: Team, queue: Team[] } => {
    
    const allPlayersInGame = findAllPlayers(courtA, courtB, queue);

    if (newPlayer.number) {
        const validation = validateUniqueNumber(allPlayersInGame, newPlayer.number);
        if (!validation.valid) {
            console.warn(`Blocked adding player: ${validation.message}`);
            return { courtA, courtB, queue };
        }
    }
    
    const addToTeamSmart = (team: Team): Team => {
        const playerWithOrder = { ...newPlayer, displayOrder: (team.players.length + (team.reserves?.length || 0)) };

        if (team.players.length < courtLimit) {
            return { ...team, players: [...team.players, playerWithOrder] };
        }
        if ((team.reserves || []).length < BENCH_LIMIT) {
            return { 
                ...team, 
                reserves: [...(team.reserves || []), playerWithOrder],
                hasActiveBench: true 
            };
        }
        return team;
    };

    const addToReservesDirect = (team: Team): Team => {
        const playerWithOrder = { ...newPlayer, displayOrder: (team.players.length + (team.reserves?.length || 0)) };
        if ((team.reserves || []).length < BENCH_LIMIT) {
            return { ...team, reserves: [...(team.reserves || []), playerWithOrder], hasActiveBench: true };
        }
        return team;
    };

    if (targetId === 'A' || targetId === courtA.id) {
        return { courtA: addToTeamSmart(courtA), courtB, queue };
    }
    if (targetId === 'B' || targetId === courtB.id) {
        return { courtA, courtB: addToTeamSmart(courtB), queue };
    }

    if (targetId === 'A_Reserves' || targetId === `${courtA.id}_Reserves`) {
        return { courtA: addToReservesDirect(courtA), courtB, queue };
    }
    if (targetId === 'B_Reserves' || targetId === `${courtB.id}_Reserves`) {
        return { courtA, courtB: addToReservesDirect(courtB), queue };
    }

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
        if (newQueue.length > 0 && newQueue[newQueue.length - 1].players.length < courtLimit) {
            const last = newQueue[newQueue.length - 1];
            const playerWithOrder = { ...newPlayer, displayOrder: last.players.length };
            newQueue[newQueue.length - 1] = { ...last, players: [...last.players, playerWithOrder] };
        } else {
            const nextName = generateNextTeamName(courtA, courtB, newQueue);
            const playerWithOrder = { ...newPlayer, displayOrder: 0 };
            newQueue.push(createTeam(nextName, [playerWithOrder]));
        }
        return { courtA, courtB, queue: newQueue };
    }

    return { courtA, courtB, queue };
};

// Updated to accept courtLimit
export const handleRemovePlayer = (
    courtA: Team, courtB: Team, queue: Team[], playerId: string, courtLimit: number
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

    deletedPlayer.displayOrder = 999; 

    if (isFromReserves) {
        const endQueue = [...newQueue];
        if (endQueue.length > 0) {
            const last = endQueue[endQueue.length - 1];
            if (last.players.length < courtLimit) {
                deletedPlayer.displayOrder = last.players.length + (last.reserves?.length || 0);
                endQueue[endQueue.length - 1] = { ...last, players: [...last.players, deletedPlayer] };
            } else {
                deletedPlayer.displayOrder = 0;
                endQueue.push(createTeam("Knocked Out", [deletedPlayer]));
            }
        } else {
            deletedPlayer.displayOrder = 0;
            endQueue.push(createTeam("Knocked Out", [deletedPlayer]));
        }
        return { courtA: newA, courtB: newB, queue: endQueue };
    }

    if (originType === 'A' || originType === 'B' || originType === 'Queue') {
        if (originType === 'A' || originType === 'B' || (originType === 'Queue' && targetTeam.hasActiveBench)) {
             deletedPlayer.displayOrder = targetTeam.players.length + (targetTeam.reserves?.length || 0);
             
             const updatedTeam = { 
                 ...targetTeam, 
                 // targetTeam.players already has player removed at start of function logic,
                 // but we need to ensure we're updating the correct object references if it was queue
                 players: targetTeam.players,
                 reserves: [...(targetTeam.reserves||[]), deletedPlayer],
                 hasActiveBench: true
             };

             if (originType === 'A') return { courtA: updatedTeam, courtB: newB, queue: newQueue };
             if (originType === 'B') return { courtA: newA, courtB: updatedTeam, queue: newQueue };
             
             // For Queue
             const qIndex = queue.findIndex(t => t.id === targetTeam!.id);
             newQueue[qIndex] = updatedTeam;
             return { courtA: newA, courtB: newB, queue: newQueue };
        } else {
            // Queue team without bench -> Knockout to end of queue
            const endQueue = [...newQueue];
             if (endQueue.length > 0) {
                const last = endQueue[endQueue.length - 1];
                if (last.players.length < courtLimit) {
                    deletedPlayer.displayOrder = last.players.length + (last.reserves?.length || 0);
                    endQueue[endQueue.length - 1] = { ...last, players: [...last.players, deletedPlayer] };
                } else {
                    deletedPlayer.displayOrder = 0;
                    endQueue.push(createTeam("Knocked Out", [deletedPlayer]));
                }
            } else {
                deletedPlayer.displayOrder = 0;
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

// Updated to accept courtLimit and pass it down
export const handleRotate = (
    courtA: Team, courtB: Team, queue: Team[], winnerId: 'A'|'B', mode: RotationMode, courtLimit: number
): { courtA: Team, courtB: Team, queue: Team[], report: RotationReport | null } => {
    
    if (queue.length === 0 && courtA.players.length >= courtLimit && courtB.players.length >= courtLimit) {
        return { courtA, courtB, queue, report: null };
    }

    const winnerTeam = winnerId === 'A' ? courtA : courtB;
    const loserTeam = winnerId === 'A' ? courtB : courtA;

    let result;
    if (mode === 'balanced') {
        result = getBalancedRotationResult(winnerTeam, loserTeam, queue, courtLimit);
    } else {
        result = getStandardRotationResult(winnerTeam, loserTeam, queue, courtLimit);
    }

    const nextCourtA = winnerId === 'A' ? { ...courtA } : { ...result.incomingTeam };
    const nextCourtB = winnerId === 'B' ? { ...courtB } : { ...result.incomingTeam };

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
