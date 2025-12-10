import { Player, Team, RotationReport, TeamColor } from '../types';
import { PLAYER_LIMIT_ON_COURT } from '../constants';
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

const createTeamContainer = (id: string, name: string, players: Player[], color: TeamColor = 'slate'): Team => ({
  id,
  name,
  players,
  color,
  reserves: []
});

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
 * Used for "Balanced Mode" where individual skill matters more than team cohesion.
 * Here, "Fixed" acts as an Anchor to the Court (King of the Court style).
 */
export const balanceTeamsSnake = (
  allPlayers: Player[], 
  currentCourtA: Team, 
  currentCourtB: Team,
  currentQueue: Team[]
): { courtA: Team, courtB: Team, queue: Team[], logs?: string[] } => {
  
  const logger = new RotationLogger();
  logger.log(`Starting Balance (Snake). Total Players: ${allPlayers.length}`);

  const courtLimit = PLAYER_LIMIT_ON_COURT; 

  // 1. Identify Anchors (Players who cannot move)
  const currentStructure = [currentCourtA, currentCourtB, ...currentQueue];
  const anchors = currentStructure.map((team, idx) => {
      const fixed = team.players.filter(p => p.isFixed);
      if (fixed.length > 0) logger.log(`Team ${idx} (${team.name}) has ${fixed.length} fixed players.`);
      return fixed;
  });

  // 2. Identify Pool (Everyone else)
  const fixedIds = new Set(anchors.flat().map(p => p.id));
  const pool = allPlayers
    .filter(p => !fixedIds.has(p.id))
    .sort((a, b) => b.skillLevel - a.skillLevel); // Sort by Skill High -> Low
  
  logger.log(`Pool size (non-fixed): ${pool.length}`);

  // 3. Determine Buckets Needed
  const totalCount = allPlayers.length;
  const numFullTeams = Math.floor(totalCount / courtLimit); 
  const totalTeamsNeeded = Math.ceil(totalCount / courtLimit);
  
  // Ensure we have at least 2 buckets for A vs B
  const requiredBuckets = Math.max(2, totalTeamsNeeded, currentStructure.length);
  
  // Initialize buckets with just the anchors
  const buckets: Player[][] = Array.from({ length: requiredBuckets }, (_, i) => [...(anchors[i] || [])]);

  // 4. Distribution Logic
  for (const player of pool) {
      let bestBucketIdx = -1;
      let minTotalSkill = Infinity;

      const targetIndices: number[] = [];
      let priorityHasSpace = false;

      // Check if any priority bucket has space
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

      // Find the best bucket among the targets (Lowest Skill -> Snake Draft effect)
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

  // 5. Reconstruct Structure
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
    currentQueue: Team[]
  ): { courtA: Team, courtB: Team, queue: Team[], logs?: string[] } => {
    
    const logger = new RotationLogger();
    logger.log(`Restoring Standard Order. Players: ${allPlayers.length}`);

    // 1. Identify Anchors
    const currentStructure = [currentCourtA, currentCourtB, ...currentQueue];
    const anchors = currentStructure.map(t => t.players.filter(p => p.isFixed));
    
    // 2. Identify Pool (Sorted by Index)
    const fixedIds = new Set(anchors.flat().map(p => p.id));
    const pool = allPlayers
        .filter(p => !fixedIds.has(p.id))
        .sort((a, b) => a.originalIndex - b.originalIndex);
    
    logger.log(`Found ${fixedIds.size} fixed players. ${pool.length} to distribute.`);

    // 3. Setup Buckets
    let maxAnchorIndex = -1;
    anchors.forEach((list, idx) => {
        if (list.length > 0) maxAnchorIndex = idx;
    });
    
    const buckets = Array.from({length: Math.max(2, maxAnchorIndex + 1)}, (_, i) => [...(anchors[i] || [])]);
    
    // 4. Fill Buckets Linearly
    let currentBucketIdx = 0;
    
    while(pool.length > 0) {
        if (!buckets[currentBucketIdx]) buckets[currentBucketIdx] = [];
        
        if (buckets[currentBucketIdx].length >= PLAYER_LIMIT_ON_COURT) {
            currentBucketIdx++;
            continue;
        }
        
        buckets[currentBucketIdx].push(pool.shift()!);
    }

    // 5. Reconstruct
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
            newQueue.push({ id: tId, name: tName, players: buckets[i], color: tColor, reserves: tReserves || [] });
        }
    }
  
    return { courtA: newCourtA, courtB: newCourtB, queue: newQueue, logs: logger.get() };
  };


/**
 * Standard Rotation (Squad Logic):
 */
export const getStandardRotationResult = (
    winnerTeam: Team, // Needed to ensure we don't mess with them
    loserTeam: Team, 
    currentQueue: Team[]
): RotationReport => {
    const logger = new RotationLogger();
    logger.log(`Standard Rotation Initiated.`);
    logger.log(`Winner: ${winnerTeam.name}, Loser: ${loserTeam.name}`);

    // Deep copy queue to avoid mutation
    const queue = currentQueue.map(t => ({...t, players: [...t.players], reserves: [...(t.reserves || [])]}));
    
    // 1. Loser Team goes to END of queue
    queue.push({ 
        ...loserTeam, 
        id: uuidv4(), 
        players: [...loserTeam.players],
        reserves: [...(loserTeam.reserves || [])]
    });
    logger.log(`Moved loser ${loserTeam.name} to end of queue.`);

    // 2. Identify Incoming Team
    if (queue.length === 0) {
        logger.warn(`No teams in queue. Rotation aborted/looped.`);
        return { incomingTeam: loserTeam, queueAfterRotation: [], stolenPlayers: [], outgoingTeam: loserTeam, retainedPlayers: [], logs: logger.get() };
    }

    const incomingTeam = queue.shift()!;
    logger.log(`Incoming Team: ${incomingTeam.name} (${incomingTeam.players.length} players)`);

    const stolenPlayers: Player[] = [];
    const TARGET_SIZE = PLAYER_LIMIT_ON_COURT;

    // 3. Fill Gaps in Incoming Team (STRICT NEXT-IN-LINE LOGIC)
    if (incomingTeam.players.length < TARGET_SIZE) {
        const needed = TARGET_SIZE - incomingTeam.players.length;
        logger.log(`Incoming team needs ${needed} more players.`);
        
        // Strict Rule: We only look at the *immediate* next team in the queue (the new queue[0]).
        // We do NOT loop through the rest of the queue.
        const donorTeam = queue[0];

        if (donorTeam && donorTeam.players.length > 0) {
            
            const neededNow = TARGET_SIZE - incomingTeam.players.length;
            const availableCandidates = donorTeam.players.filter(p => !p.isFixed);
            
            if (availableCandidates.length === 0) {
                logger.log(`Donor ${donorTeam.name} has no non-fixed players. Cannot steal.`);
            } else {
                // --- STEAL FROM BOTTOM TO TOP ---
                // "Steal using the last name from the list of the other team."
                // E.g. If list is 1..6, we take 6, then 5.
                // We reverse the candidates list to access the bottom elements first.
                
                const playersToSteal = availableCandidates.reverse().slice(0, neededNow);
                
                for (const stolenP of playersToSteal) {
                    // Find index in original donor list to splice
                    const idx = donorTeam.players.findIndex(p => p.id === stolenP.id);
                    if (idx !== -1) {
                        donorTeam.players.splice(idx, 1);
                        incomingTeam.players.push(stolenP);
                        stolenPlayers.push(stolenP);
                        logger.log(`Stole ${stolenP.name} (Bottom-to-Top) from strictly next team: ${donorTeam.name}.`);
                    }
                }
            }
        } else {
            logger.log("No team available in queue to steal from.");
        }
    } else {
        logger.log(`Incoming team is full.`);
    }

    const finalQueue = queue.filter(t => t.players.length > 0);

    return {
        outgoingTeam: loserTeam,
        incomingTeam,
        retainedPlayers: [], // In standard mode, we treat whole squads.
        queueAfterRotation: finalQueue,
        stolenPlayers,
        logs: logger.get()
    };
};

/**
 * Balanced Rotation:
 */
export const getBalancedRotationResult = (
    winnerTeam: Team,
    loserTeam: Team,
    currentQueue: Team[]
): RotationReport => {
    const logger = new RotationLogger();
    logger.log("Balanced Rotation Initiated.");

    const queue = currentQueue.map(t => ({...t, players: [...t.players], reserves: [...(t.reserves || [])]}));
    
    // 1. Split Loser (Anchors stay, Leavers go)
    const anchors = loserTeam.players.filter(p => p.isFixed);
    const leavers = loserTeam.players.filter(p => !p.isFixed);
    
    logger.log(`Loser ${loserTeam.name}: ${anchors.length} fixed (stay), ${leavers.length} leaving.`);

    // Loser goes to END of queue immediately
    if (leavers.length > 0) {
        queue.push({ ...loserTeam, players: leavers, id: uuidv4(), reserves: loserTeam.reserves || [] });
    }

    // 2. Merge Incoming
    let incomingBase = queue.shift();
    let incomingPlayers = incomingBase ? [...incomingBase.players] : [];
    
    logger.log(`Base Incoming Team: ${incomingBase?.name || 'None'}`);

    // In Balanced Mode, Anchors STAY on the court side
    incomingPlayers.push(...anchors);
    logger.log(`Added ${anchors.length} anchors from losing team to incoming.`);

    // 3. Overflow
    const overflow: Player[] = [];
    while (incomingPlayers.length > PLAYER_LIMIT_ON_COURT) {
        const ejectIdx = incomingPlayers.findIndex(p => !p.isFixed);
        if (ejectIdx !== -1) {
            const [ejected] = incomingPlayers.splice(ejectIdx, 1);
            overflow.push(ejected);
        } else {
            const [ejected] = incomingPlayers.splice(0, 1);
            overflow.push(ejected);
        }
    }
    if (overflow.length > 0) {
        logger.log(`${overflow.length} players overflowed from incoming team.`);
        // Try to return overflow to the queue start (to compensate the team we just broke) 
        // or add to the end if logic dictates. 
        // For VolleyScore V2 "Standard", overflow usually goes to the team that needs it or end of queue.
        // Let's create a temp overflow team at the end for simplicity in this logic.
        if (queue.length > 0) queue[queue.length - 1].players.push(...overflow);
        else queue.push(createTeamContainer(uuidv4(), "Overflow", overflow));
    }

    const incomingTeam = { 
        ...(incomingBase || loserTeam), 
        id: uuidv4(),
        players: incomingPlayers,
        reserves: incomingBase?.reserves || []
    };

    const targetAvg = getNumericStrength(winnerTeam.players);
    const stolenPlayers: Player[] = [];

    // 4. Fill Gaps (Balanced Draft - STRICT NEIGHBOR ONLY)
    // CRITICAL FIX: Only look at queue[0]. Do not scan the entire queue.
    while (incomingTeam.players.length < PLAYER_LIMIT_ON_COURT) {
        
        // If queue is empty, we can't steal.
        if (queue.length === 0) {
            logger.warn("Queue empty. Cannot fill team.");
            break;
        }

        // --- STRICT RULE: ONLY STEAL FROM THE FIRST TEAM IN QUEUE ---
        const donorTeam = queue[0];
        
        if (donorTeam.players.length === 0) {
            // Should not happen as we filter empty teams, but safety check:
            queue.shift();
            continue;
        }

        let bestCandidate: { playerIndex: number, delta: number } | null = null;
        
        const currentSum = incomingTeam.players.reduce((sum, p) => sum + p.skillLevel, 0);
        const nextCount = incomingTeam.players.length + 1;

        // Scan only the donor team (Queue[0])
        for (let pIdx = 0; pIdx < donorTeam.players.length; pIdx++) {
            const player = donorTeam.players[pIdx];
            if (player.isFixed) continue; // Respect locks inside queue too

            const newAvg = (currentSum + player.skillLevel) / nextCount;
            const delta = Math.abs(newAvg - targetAvg);

            if (!bestCandidate || delta < bestCandidate.delta) {
                bestCandidate = { playerIndex: pIdx, delta };
            }
        }

        if (bestCandidate) {
            const [movedPlayer] = donorTeam.players.splice(bestCandidate.playerIndex, 1);
            incomingTeam.players.push(movedPlayer);
            stolenPlayers.push(movedPlayer);
            logger.log(`Drafted ${movedPlayer.name} (Lvl ${movedPlayer.skillLevel}) from strictly next team: ${donorTeam.name}.`);
            
            // If donor team is now empty, remove it from queue so we can access the next one if still needed
            if (donorTeam.players.length === 0) {
                logger.log(`Donor Team ${donorTeam.name} depleted. Removing from queue.`);
                queue.shift();
            }
        } else {
            logger.warn(`No suitable non-fixed candidates found in ${donorTeam.name}. Checking next team...`);
            // If we can't take anyone from queue[0] (e.g. all fixed), we shift it to find someone else? 
            // Or do we abort? Sticking to "Order matters", we likely skip this team.
            // But usually this means we are stuck. For safety, we shift.
            queue.shift(); 
        }
    }

    const cleanedQueue = queue.filter(t => t.players.length > 0);

    return {
        outgoingTeam: loserTeam,
        incomingTeam,
        retainedPlayers: anchors,
        queueAfterRotation: cleanedQueue,
        stolenPlayers,
        logs: logger.get()
    };
};