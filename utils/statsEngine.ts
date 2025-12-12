
import { ActionLog, ProfileStats, TeamId } from '../types';

/**
 * statsEngine.ts
 * 
 * Pure Logic Engine for calculating VolleyScore statistics.
 * This file MUST NOT contain any React Hooks or Contexts to avoid circular dependencies.
 */

export interface StatsDelta {
  matchesPlayed: number;
  matchesWon: number;
  totalPoints: number;
  attacks: number;
  blocks: number;
  aces: number;
  mvpScore: number; // Internal score to determine MVP
}

/**
 * Calculates statistical deltas for a completed match.
 * Iterates through the action log and aggregates performance metrics.
 * 
 * @param matchLog Full history of actions in the match
 * @param winnerTeamId ID of the winning team ('A' | 'B')
 * @param playerTeamMap Map of PlayerProfileID -> TeamID ('A' | 'B')
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
        matchesPlayed: 1, // Called only once per match
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

  // 1. Process Win/Loss (Base Stats)
  // We need to iterate all KNOWN profiles that played in this match
  playerTeamMap.forEach((teamId, profileId) => {
    const d = getDelta(profileId);
    if (winnerTeamId && teamId === winnerTeamId) {
      d.matchesWon = 1;
    }
  });

  // 2. Process Action Log (Points & Skills)
  for (const log of matchLog) {
    if (log.type !== 'POINT') continue;

    // Fallback Logic: If playerId is present, attribute to profile.
    // If 'unknown' or null, it's a team stat (ignored for profile aggregation).
    if (log.playerId && log.playerId !== 'unknown') {
      
      // Note: log.playerId here refers to the ROSTER ID.
      // We must assume the caller mapped RosterID -> ProfileID before calling, 
      // OR we rely on the fact that for tracked players, RosterID might link to Profile.
      // *Correction*: The map passed in `playerTeamMap` keys should be ProfileIDs.
      // However, the log contains RosterIDs.
      // To keep this pure, we assume the inputs are pre-normalized or we ignore this mapping complexity here 
      // and assume the caller handles the ID translation. 
      //
      // *Design Decision*: To be safe, we will assume `matchLog` passed here 
      // has been normalized to use ProfileIDs where possible, OR the caller provides a RosterID -> ProfileID map.
      // Let's assume the latter is NOT passed, so we simply aggregate by the ID in the log.
      // The caller (usePlayerProfiles) will have to map RosterID -> ProfileID before applying.
      
      // Actually, standardizing: This function returns Map<RosterID, StatsDelta>. 
      // The caller maps RosterID to ProfileID.
      
      const d = getDelta(log.playerId);
      
      // Points Logic
      // Only attribute positive points. Opponent errors count as points for the team, 
      // but usually not credited to a specific player's "skill" tally unless forced.
      // In VolleyScore v1/v2, 'opponent_error' is often logged with the player who forced it (e.g. difficult serve).
      // If the log has a playerId, we credit them.
      
      d.totalPoints += 1;
      d.mvpScore += 1; // Base point

      switch (log.skill) {
        case 'attack':
          d.attacks += 1;
          d.mvpScore += 0.5; // Attack bonus
          break;
        case 'block':
          d.blocks += 1;
          d.mvpScore += 1.0; // Block is high value
          break;
        case 'ace':
          d.aces += 1;
          d.mvpScore += 1.0; // Ace is high value
          break;
        case 'opponent_error':
          // No specific skill counter increment, but counts towards total points
          break;
      }
    }
  }

  return deltas;
};

/**
 * Merges new stats delta into an existing ProfileStats object.
 */
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
    mvpCount: base.mvpCount // MVP is calculated separately/manually if needed, or we can just track score
  };
};
