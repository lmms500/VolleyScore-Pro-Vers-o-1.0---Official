
import { ActionLog, ProfileStats, TeamId } from '../types';

export interface StatsDelta {
  matchesPlayed: number;
  matchesWon: number;
  totalPoints: number;
  attacks: number;
  blocks: number;
  aces: number;
  mvpScore: number; 
}

/**
 * Calculates statistical deltas for a completed match.
 * 
 * @param matchLog Full history of actions
 * @param winnerTeamId ID of the winning team ('A' | 'B')
 * @param playerTeamMap Map of ProfileID -> TeamID. Used to attribute wins correctly.
 * @returns Map<ProfileID, StatsDelta>
 */
export const calculateMatchDeltas = (
  matchLog: ActionLog[],
  winnerTeamId: TeamId | null,
  playerTeamMap: Map<string, TeamId>
): Map<string, StatsDelta> => {
  
  const deltas = new Map<string, StatsDelta>();

  // Helper to init delta
  const getDelta = (id: string) => {
    if (!deltas.has(id)) {
      deltas.set(id, {
        matchesPlayed: 1, 
        matchesWon: 0,
        totalPoints: 0,
        attacks: 0,
        blocks: 0,
        aces: 0,
        mvpScore: 0
      });
    }
    return deltas.get(id)!;
  };

  // 1. Process Win/Loss (Base Stats for ALL participants with profiles)
  playerTeamMap.forEach((teamId, profileId) => {
    const d = getDelta(profileId);
    if (winnerTeamId && teamId === winnerTeamId) {
      d.matchesWon = 1;
    }
  });

  // 2. Process Action Log (Points & Skills)
  for (const log of matchLog) {
    if (log.type !== 'POINT') continue;

    // log.playerId comes from the game instance. 
    // The calling function MUST have mapped this to a ProfileID if applicable BEFORE passing matchLog here
    // OR we assume the IDs in matchLog match what's in playerTeamMap keys if pre-processed.
    // In this implementation, we assume the caller (App.tsx) has already mapped the log to use ProfileIDs
    // OR we assume the IDs in the log are ProfileIDs. 
    
    // HOWEVER, `useVolleyGame` stores Roster IDs in logs. 
    // App.tsx handles the mapping logic before calling this function in our current architecture.
    
    if (log.playerId && log.playerId !== 'unknown') {
      const d = getDelta(log.playerId);
      
      d.totalPoints += 1;
      d.mvpScore += 1; 

      switch (log.skill) {
        case 'attack':
          d.attacks += 1;
          d.mvpScore += 0.5; 
          break;
        case 'block':
          d.blocks += 1;
          d.mvpScore += 1.0;
          break;
        case 'ace':
          d.aces += 1;
          d.mvpScore += 1.0;
          break;
      }
    }
  }

  return deltas;
};

export const mergeStats = (current: ProfileStats | undefined, delta: StatsDelta): ProfileStats => {
  const base = current || {
    matchesPlayed: 0,
    matchesWon: 0,
    totalPoints: 0,
    attacks: 0,
    blocks: 0,
    aces: 0,
    mvpCount: 0
  };

  return {
    matchesPlayed: base.matchesPlayed + delta.matchesPlayed,
    matchesWon: base.matchesWon + delta.matchesWon,
    totalPoints: base.totalPoints + delta.totalPoints,
    attacks: base.attacks + delta.attacks,
    blocks: base.blocks + delta.blocks,
    aces: base.aces + delta.aces,
    mvpCount: base.mvpCount 
  };
};
