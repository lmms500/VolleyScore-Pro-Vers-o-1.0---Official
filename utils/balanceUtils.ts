
import { Player, Team, RotationReport, TeamColor } from '../types';
import { v4 as uuidv4 } from 'uuid';

// --- HELPER FUNCTIONS ---

export const calculateTeamStrength = (players: Player[]): string => {
  if (players.length === 0) return "0.0";
  const sum = players.reduce((acc, p) => acc + p.skillLevel, 0);
  return (sum / players.length).toFixed(1);
};

const getNumericStrength = (players: Player[]): number => {
    if (players.length === 0) return 0;
    return players.reduce((acc, p) => acc + p.skillLevel, 0) / players.length;
};

const getTotalSkill = (players: Player[]): number => {
    return players.reduce((acc, p) => acc + p.skillLevel, 0);
};

// Simple internal logger
class RotationLogger {
    logs: string[] = [];
    
    log(msg: string) {
        this.logs.push(`[INFO] ${msg}`);
    }
    
    warn(msg: string) {
        this.logs.push(`[WARN] ${msg}`);
    }

    get() { return this.logs; }
}

// --- ALGORITHMS ---

/**
 * Global Balanced Draft (Weighted Snake Logic)
 * Used when generating teams from scratch or doing a full re-balance.
 */
export const balanceTeamsSnake = (
  allPlayers: Player[], 
  currentCourtA: Team, 
  currentCourtB: Team,
  currentQueue: Team[],
  courtLimit: number
): { courtA: Team, courtB: Team, queue: Team[], logs?: string[] } => {
  
  const logger = new RotationLogger();
  logger.log(`Starting Balance (Snake). Total Players: ${allPlayers.length}. Court Limit: ${courtLimit}`);

  const currentStructure = [currentCourtA, currentCourtB, ...currentQueue];
  const anchors = currentStructure.map((team, idx) => {
      const fixed = team.players.filter(p => p.isFixed);
      if (fixed.length > 0) logger.log(`Team ${idx} (${team.name}) has ${fixed.length} fixed players.`);
      return fixed;
  });

  const fixedIds = new Set(anchors.flat().map(p => p.id));
  const pool = allPlayers
    .filter(p => !fixedIds.has(p.id))
    .sort((a, b) => b.skillLevel - a.skillLevel);
  
  logger.log(`Pool size (non-fixed): ${pool.length}`);

  const totalCount = allPlayers.length;
  const numFullTeams = Math.floor(totalCount / courtLimit); 
  const totalTeamsNeeded = Math.ceil(totalCount / courtLimit);
  
  const requiredBuckets = Math.max(2, totalTeamsNeeded, currentStructure.length);
  const buckets: Player[][] = Array.from({ length: requiredBuckets }, (_, i) => [...(anchors[i] || [])]);

  for (const player of pool) {
      let bestBucketIdx = -1;
      let minTotalSkill = Infinity;

      const targetIndices: number[] = [];
      let priorityHasSpace = false;

      for(let i = 0; i < numFullTeams; i++) {
          if (buckets[i] && buckets[i].length < courtLimit) {
              priorityHasSpace = true;
              break;
          }
      }

      if (priorityHasSpace) {
          for(let i = 0; i < numFullTeams; i++) {
              if (buckets[i] && buckets[i].length < courtLimit) {
                  targetIndices.push(i);
              }
          }
      } else {
          for(let i = numFullTeams; i < buckets.length; i++) {
               targetIndices.push(i);
          }
          if (numFullTeams === 0) {
               for(let i = 0; i < buckets.length; i++) targetIndices.push(i);
          }
      }

      for (const i of targetIndices) {
          if (!buckets[i]) continue;
          const currentSkill = getTotalSkill(buckets[i]);
          if (currentSkill < minTotalSkill) {
              minTotalSkill = currentSkill;
              bestBucketIdx = i;
          }
      }

      if (bestBucketIdx !== -1) {
          buckets[bestBucketIdx].push(player);
      } else {
          buckets[buckets.length - 1].push(player);
      }
  }

  const newCourtA = { ...currentCourtA, players: buckets[0] || [] };
  const newCourtB = { ...currentCourtB, players: buckets[1] || [] };
  
  const newQueue: Team[] = [];
  for (let i = 2; i < buckets.length; i++) {
      if (buckets[i] && buckets[i].length > 0) {
          const existing = currentQueue[i - 2];
          newQueue.push({
              id: existing?.id || uuidv4(),
              name: existing?.name || `Team ${i + 1}`,
              color: existing?.color || 'slate',
              players: buckets[i],
              reserves: existing?.reserves || []
          });
      }
  }

  return { courtA: newCourtA, courtB: newCourtB, queue: newQueue, logs: logger.get() };
};

/**
 * Standard Distribution (Restore Order)
 */
export const distributeStandard = (
    allPlayers: Player[], 
    currentCourtA: Team, 
    currentCourtB: Team,
    currentQueue: Team[],
    courtLimit: number
  ): { courtA: Team, courtB: Team, queue: Team[], logs?: string[] } => {
    
    const logger = new RotationLogger();
    logger.log(`Restoring Standard Order. Players: ${allPlayers.length}. Court Limit: ${courtLimit}`);

    const currentStructure = [currentCourtA, currentCourtB, ...currentQueue];
    
    const totalPlayers = allPlayers.length;
    // Calculate buckets needed based on new dynamic limit
    const teamsNeeded = Math.ceil(totalPlayers / courtLimit);
    const totalBuckets = Math.max(2, teamsNeeded, currentStructure.length);

    const buckets: Player[][] = Array.from({ length: totalBuckets }, () => []);

    const fixedIds = new Set<string>();
    
    allPlayers.forEach(p => {
        if (p.isFixed) {
            fixedIds.add(p.id);
            let placed = false;
            for(let i=0; i<currentStructure.length; i++) {
                if (currentStructure[i].players.some(cp => cp.id === p.id)) {
                    buckets[i].push(p);
                    placed = true;
                    break;
                }
            }
        }
    });
    
    const pool = allPlayers
        .filter(p => !fixedIds.has(p.id))
        .sort((a, b) => {
            if (a.originalIndex !== b.originalIndex) return a.originalIndex - b.originalIndex;
            return a.id.localeCompare(b.id);
        });
    
    let currentBucketIdx = 0;
    
    for (const player of pool) {
        while (currentBucketIdx < buckets.length && buckets[currentBucketIdx].length >= courtLimit) {
            currentBucketIdx++;
        }
        if (currentBucketIdx >= buckets.length) {
            buckets.push([]);
        }
        buckets[currentBucketIdx].push(player);
    }

    const newCourtA = { ...currentCourtA, players: buckets[0] || [] };
    const newCourtB = { ...currentCourtB, players: buckets[1] || [] };
    
    const newQueue: Team[] = [];
    for (let i = 2; i < buckets.length; i++) {
        if (buckets[i] && buckets[i].length > 0) {
            const existingQTeam = currentQueue[i - 2];
            const tId = existingQTeam ? existingQTeam.id : uuidv4();
            const tName = existingQTeam ? existingQTeam.name : `Team ${i + 1}`;
            const tColor = existingQTeam ? existingQTeam.color : 'slate';
            const tReserves = existingQTeam ? existingQTeam.reserves : [];
            const tLogo = existingQTeam ? existingQTeam.logo : undefined;

            newQueue.push({ 
                id: tId, 
                name: tName, 
                players: buckets[i], 
                color: tColor, 
                reserves: tReserves || [],
                logo: tLogo,
                hasActiveBench: existingQTeam ? existingQTeam.hasActiveBench : false
            });
        }
    }
  
    return { courtA: newCourtA, courtB: newCourtB, queue: newQueue, logs: logger.get() };
  };


/**
 * Helper: Finds available players to "steal" from other teams to complete a roster.
 * STRICTLY respects isFixed.
 */
const fillRosterFromQueue = (
    targetTeam: Team, 
    queue: Team[], 
    courtLimit: number,
    logger: RotationLogger
): { updatedTeam: Team, updatedQueue: Team[], stolenPlayers: Player[] } => {
    
    const needed = courtLimit - targetTeam.players.length;
    if (needed <= 0) return { updatedTeam: targetTeam, updatedQueue: queue, stolenPlayers: [] };

    let currentNeeded = needed;
    const stolen: Player[] = [];
    
    // We clone the queue to mutate it
    const newQueue = queue.map(t => ({...t, players: [...t.players], reserves: [...(t.reserves || [])]}));
    const newPlayers = [...targetTeam.players];

    // Iterate through queue from START to END.
    for (let i = 0; i < newQueue.length; i++) {
        if (currentNeeded <= 0) break;

        const donor = newQueue[i];
        // Only steal non-fixed players
        const candidates = donor.players.filter(p => !p.isFixed);

        while (currentNeeded > 0 && candidates.length > 0) {
            const p = candidates.pop()!; 
            
            // Remove from donor in queue
            const idx = donor.players.findIndex(x => x.id === p.id);
            if (idx !== -1) {
                donor.players.splice(idx, 1);
                newPlayers.push(p);
                stolen.push(p);
                currentNeeded--;
                logger.log(`Stole ${p.name} from ${donor.name} (Bottom-Up) to complete team.`);
            }
        }
    }

    // Filter out empty teams from queue ONLY if they have no fixed players either
    const finalQueue = newQueue.filter(t => t.players.length > 0 || (t.reserves && t.reserves.length > 0));

    return {
        updatedTeam: { ...targetTeam, players: newPlayers },
        updatedQueue: finalQueue,
        stolenPlayers: stolen
    };
};


/**
 * Standard Rotation with Dynamic Limit
 */
export const getStandardRotationResult = (
    winnerTeam: Team, 
    loserTeam: Team, 
    currentQueue: Team[],
    courtLimit: number
): RotationReport => {
    const logger = new RotationLogger();
    logger.log(`Standard Rotation. Limit: ${courtLimit}`);

    // 1. Prepare Queue
    const queue = currentQueue.map(t => ({...t, players: [...t.players], reserves: [...(t.reserves || [])]}));
    
    // 2. Move Loser to END of Queue
    const loserCopy = { ...loserTeam, players: [...loserTeam.players], reserves: [...(loserTeam.reserves||[])] };
    queue.push(loserCopy);

    // 3. Identify Incoming Team
    if (queue.length === 0) {
        return { incomingTeam: loserTeam, queueAfterRotation: [], stolenPlayers: [], outgoingTeam: loserTeam, retainedPlayers: [], logs: logger.get() };
    }

    const incomingBase = queue.shift()!; 
    
    // 4. Fill Roster if Incomplete using courtLimit
    const fillResult = fillRosterFromQueue(incomingBase, queue, courtLimit, logger);

    return {
        outgoingTeam: loserTeam,
        incomingTeam: fillResult.updatedTeam,
        retainedPlayers: incomingBase.players.filter(p => p.isFixed), 
        queueAfterRotation: fillResult.updatedQueue,
        stolenPlayers: fillResult.stolenPlayers,
        logs: logger.get()
    };
};

/**
 * Balanced Rotation with Dynamic Limit
 */
export const getBalancedRotationResult = (
    winnerTeam: Team,
    loserTeam: Team,
    currentQueue: Team[],
    courtLimit: number
): RotationReport => {
    const logger = new RotationLogger();
    logger.log(`Balanced Rotation. Limit: ${courtLimit}`);

    const queue = currentQueue.map(t => ({...t, players: [...t.players], reserves: [...(t.reserves || [])]}));
    const loserCopy = { ...loserTeam, players: [...loserTeam.players], reserves: [...(loserTeam.reserves||[])] };
    queue.push(loserCopy);
    
    const incomingBase = queue.shift()!;
    
    const targetSkill = getNumericStrength(winnerTeam.players);
    const needed = courtLimit - incomingBase.players.length;
    const stolenPlayers: Player[] = [];
    let updatedIncoming = { ...incomingBase, players: [...incomingBase.players] };
    let finalQueue = [...queue];

    if (needed > 0) {
        const candidates: { player: Player, teamIndex: number, diff: number }[] = [];
        
        finalQueue.forEach((t, tIdx) => {
            t.players.forEach(p => {
                if (!p.isFixed) {
                    const currentTotal = getTotalSkill(updatedIncoming.players);
                    const projectedAvg = (currentTotal + p.skillLevel) / (updatedIncoming.players.length + 1);
                    const diff = Math.abs(projectedAvg - targetSkill);
                    candidates.push({ player: p, teamIndex: tIdx, diff });
                }
            });
        });

        candidates.sort((a, b) => a.diff - b.diff);
        const toSteal = candidates.slice(0, needed);
        
        toSteal.forEach(c => {
            const donor = finalQueue[c.teamIndex];
            const pIdx = donor.players.findIndex(p => p.id === c.player.id);
            if (pIdx !== -1) {
                donor.players.splice(pIdx, 1);
                updatedIncoming.players.push(c.player);
                stolenPlayers.push(c.player);
                logger.log(`Balanced Steal: ${c.player.name} from ${donor.name}`);
            }
        });
        
        finalQueue = finalQueue.filter(t => t.players.length > 0 || (t.reserves && t.reserves.length > 0));
    }

    return {
        outgoingTeam: loserTeam,
        incomingTeam: updatedIncoming,
        retainedPlayers: incomingBase.players.filter(p => p.isFixed),
        queueAfterRotation: finalQueue,
        stolenPlayers: stolenPlayers,
        logs: logger.get()
    };
};
