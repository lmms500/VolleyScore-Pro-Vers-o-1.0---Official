
import { GameState, TeamId, SetHistory, ActionLog, Team, Player, SkillType, GameAction, RotationReport } from '../types';
import { SETS_TO_WIN_MATCH, MIN_LEAD_TO_WIN, getPlayersOnCourt } from '../constants';
import { isValidTimeoutRequest, sanitizeInput } from '../utils/security';
import { handleAddPlayer, handleRemovePlayer, handleDeletePlayer, handleRotate, createPlayer } from '../utils/rosterLogic';
import { balanceTeamsSnake, distributeStandard, getStandardRotationResult, getBalancedRotationResult } from '../utils/balanceUtils';
import { v4 as uuidv4 } from 'uuid';

// --- HELPERS ---
const calculateWinner = (scoreA: number, scoreB: number, target: number, inSuddenDeath: boolean): TeamId | null => {
    if (inSuddenDeath) {
        if (scoreA >= 3 && scoreA > scoreB) return 'A';
        if (scoreB >= 3 && scoreB > scoreA) return 'B';
    } else {
        if (scoreA >= target && scoreA >= scoreB + MIN_LEAD_TO_WIN) return 'A';
        if (scoreB >= target && scoreB >= scoreA + MIN_LEAD_TO_WIN) return 'B';
    }
    return null;
};

const rotateClockwise = (players: Player[]): Player[] => {
    if (players.length < 2) return players;
    const copy = [...players];
    const last = copy.pop(); 
    if (last) copy.unshift(last); 
    return copy;
};

const rotateCounterClockwise = (players: Player[]): Player[] => {
    if (players.length < 2) return players;
    const copy = [...players];
    const first = copy.shift();
    if (first) copy.push(first);
    return copy;
};

/**
 * Checks if a team has already served in the current set.
 * A team has served if they have been the 'prevServingTeam' in any point action.
 */
const hasTeamServedInSet = (actionLog: ActionLog[], team: TeamId): boolean => {
    return actionLog.some(log => log.type === 'POINT' && log.prevServingTeam === team);
};

// --- REDUCER ---
export const gameReducer = (state: GameState, action: GameAction): GameState => {
  const courtLimit = getPlayersOnCourt(state.config.mode);

  switch (action.type) {
    case 'LOAD_STATE':
      return { ...action.payload };

    case 'POINT': {
      if (state.isMatchOver) return state;
      const team = action.team;
      let newScoreA = team === 'A' ? state.scoreA + 1 : state.scoreA;
      let newScoreB = team === 'B' ? state.scoreB + 1 : state.scoreB;
      let triggerSideSwitch = false;
      const totalPoints = newScoreA + newScoreB;
      if (state.config.mode === 'beach') {
         const isFinalSet = state.config.hasTieBreak && state.currentSet === state.config.maxSets;
         const switchInterval = isFinalSet ? 5 : 7;
         if (totalPoints > 0 && totalPoints % switchInterval === 0) triggerSideSwitch = true;
      }
      const isTieBreak = state.config.hasTieBreak && state.currentSet === state.config.maxSets;
      const target = isTieBreak ? state.config.tieBreakPoints : state.config.pointsPerSet;
      let enteringSuddenDeath = false;
      if (state.config.deuceType === 'sudden_death_3pt' && !state.inSuddenDeath) {
         if (newScoreA === target - 1 && newScoreB === target - 1) {
             newScoreA = 0; newScoreB = 0; enteringSuddenDeath = true;
         }
      }
      const setWinner = calculateWinner(newScoreA, newScoreB, target, state.inSuddenDeath || enteringSuddenDeath);
      
      let autoRotated = false;
      let nextTeamA = { ...state.teamARoster };
      let nextTeamB = { ...state.teamBRoster };
      const currentServer = state.servingTeam;

      // --- AUTOMATIC ROTATION LOGIC ---
      // Standard Volleyball: When the receiving team wins the rally (Side-out), it gains the right to serve and rotates.
      // USER ADJUSTMENT: Skip rotation if it's the team's very first time serving in the set.
      if (!setWinner && currentServer && currentServer !== team) {
          const alreadyServed = hasTeamServedInSet(state.actionLog, team);
          
          if (alreadyServed) {
              autoRotated = true;
              if (team === 'A') { 
                  nextTeamA.players = rotateClockwise(nextTeamA.players); 
                  nextTeamA.tacticalOffset = 0; 
              } else { 
                  nextTeamB.players = rotateClockwise(nextTeamB.players); 
                  nextTeamB.tacticalOffset = 0; 
              }
          } else {
              // First Side-out of the set for this team. 
              // We skip rotation so they serve with the person initially placed in Position 1.
              autoRotated = false;
              console.debug(`[Rotation] Skipping first side-out rotation for Team ${team}`);
          }
      }

      const newAction: ActionLog = { 
          type: 'POINT', 
          team, 
          prevScoreA: state.scoreA, 
          prevScoreB: state.scoreB, 
          prevServingTeam: state.servingTeam, 
          prevInSuddenDeath: state.inSuddenDeath, 
          timestamp: Date.now(), 
          autoRotated: autoRotated, 
          ...(action.metadata || {}) 
      };

      if (setWinner) {
          const newSetsA = setWinner === 'A' ? state.setsA + 1 : state.setsA;
          const newSetsB = setWinner === 'B' ? state.setsB + 1 : state.setsB;
          const historyEntry: SetHistory = { setNumber: state.currentSet, scoreA: newScoreA, scoreB: newScoreB, winner: setWinner };
          const setsNeeded = SETS_TO_WIN_MATCH(state.config.maxSets);
          const matchWinner = newSetsA === setsNeeded ? 'A' : (newSetsB === setsNeeded ? 'B' : null);
          const snapshotState = { ...state };
          let rotReport: RotationReport | null = null;
          if (state.queue.length > 0) {
              const simResult = handleRotate(state.teamARoster, state.teamBRoster, state.queue, setWinner, state.rotationMode, courtLimit);
              rotReport = simResult.report;
          }
          return { ...state, scoreA: matchWinner ? newScoreA : 0, scoreB: matchWinner ? newScoreB : 0, setsA: newSetsA, setsB: newSetsB, history: [...state.history, historyEntry], currentSet: matchWinner ? state.currentSet : state.currentSet + 1, matchWinner: matchWinner, isMatchOver: !!matchWinner, servingTeam: null, isTimerRunning: !matchWinner, timeoutsA: 0, timeoutsB: 0, inSuddenDeath: false, pendingSideSwitch: false, actionLog: [], matchLog: [...state.matchLog, newAction], lastSnapshot: snapshotState, rotationReport: rotReport };
      }
      return { ...state, scoreA: newScoreA, scoreB: newScoreB, teamARoster: nextTeamA, teamBRoster: nextTeamB, servingTeam: team, isTimerRunning: true, inSuddenDeath: state.inSuddenDeath || enteringSuddenDeath, pendingSideSwitch: triggerSideSwitch, actionLog: [...state.actionLog, newAction], matchLog: [...state.matchLog, newAction], lastSnapshot: undefined };
    }

    case 'ROSTER_SWAP_POSITIONS': {
        const { teamId, indexA, indexB } = action;
        let newA = { ...state.teamARoster };
        let newB = { ...state.teamBRoster };
        let swapped = false;

        const swapInList = (list: Player[]) => {
            const copy = [...list];
            if (indexA >= 0 && indexA < copy.length && indexB >= 0 && indexB < copy.length) {
                const temp = copy[indexA];
                copy[indexA] = copy[indexB];
                copy[indexB] = temp;
                swapped = true;
            }
            return copy;
        };

        if (teamId === 'A' || teamId === state.teamARoster.id) {
            newA.players = swapInList(newA.players);
            newA.tacticalOffset = 0;
        } else if (teamId === 'B' || teamId === state.teamBRoster.id) {
            newB.players = swapInList(newB.players);
            newB.tacticalOffset = 0;
        }

        if (!swapped) return state;
        return { ...state, teamARoster: newA, teamBRoster: newB };
    }

    case 'SUBTRACT_POINT': {
        if (state.isMatchOver) return state;
        const team = action.team;
        if ((team === 'A' ? state.scoreA : state.scoreB) <= 0) return state;
        return { ...state, scoreA: team === 'A' ? Math.max(0, state.scoreA - 1) : state.scoreA, scoreB: team === 'B' ? Math.max(0, state.scoreB - 1) : state.scoreB, pendingSideSwitch: false };
    }

    case 'TIMEOUT': {
        const team = action.team;
        if (!isValidTimeoutRequest(team === 'A' ? state.timeoutsA : state.timeoutsB)) return state;
        const newAction: ActionLog = { type: 'TIMEOUT', team, prevTimeoutsA: state.timeoutsA, prevTimeoutsB: state.timeoutsB, timestamp: Date.now() };
        return { ...state, timeoutsA: team === 'A' ? state.timeoutsA + 1 : state.timeoutsA, timeoutsB: team === 'B' ? state.timeoutsB + 1 : state.timeoutsB, actionLog: [...state.actionLog, newAction], matchLog: [...state.matchLog, newAction], lastSnapshot: undefined };
    }

    case 'UNDO': {
        if (state.lastSnapshot) return { ...state.lastSnapshot };
        if (state.isMatchOver || state.actionLog.length === 0) return state;
        const newLog = [...state.actionLog];
        const lastAction = newLog.pop()!;
        const newMatchLog = [...state.matchLog];
        if (newMatchLog.length > 0 && newMatchLog[newMatchLog.length - 1].type === lastAction.type) newMatchLog.pop();
        if (lastAction.type === 'TIMEOUT') return { ...state, actionLog: newLog, matchLog: newMatchLog, timeoutsA: lastAction.prevTimeoutsA, timeoutsB: lastAction.prevTimeoutsB };
        if (lastAction.type === 'ROTATION') return { ...state, actionLog: newLog, matchLog: newMatchLog, ...lastAction.snapshot };
        if (lastAction.type === 'MANUAL_ROTATION') {
            const { teamId, direction } = lastAction;
            let teamA = { ...state.teamARoster }, teamB = { ...state.teamBRoster };
            if (teamId === 'A') teamA.players = direction === 'clockwise' ? rotateCounterClockwise(teamA.players) : rotateClockwise(teamA.players);
            else if (teamId === 'B') teamB.players = direction === 'clockwise' ? rotateCounterClockwise(teamB.players) : rotateClockwise(teamB.players);
            return { ...state, actionLog: newLog, matchLog: newMatchLog, teamARoster: teamA, teamBRoster: teamB };
        }
        if (lastAction.type === 'POINT') {
            let teamA = { ...state.teamARoster }, teamB = { ...state.teamBRoster };
            if (lastAction.autoRotated) {
                if (lastAction.team === 'A') teamA.players = rotateCounterClockwise(teamA.players);
                else teamB.players = rotateCounterClockwise(teamB.players);
            }
            return { ...state, actionLog: newLog, matchLog: newMatchLog, scoreA: lastAction.prevScoreA, scoreB: lastAction.prevScoreB, servingTeam: lastAction.prevServingTeam, inSuddenDeath: lastAction.prevInSuddenDeath ?? false, pendingSideSwitch: false, teamARoster: teamA, teamBRoster: teamB };
        }
        return state;
    }

    case 'RESET_MATCH':
        return { ...state, scoreA: 0, scoreB: 0, setsA: 0, setsB: 0, currentSet: 1, history: [], actionLog: [], matchLog: [], isMatchOver: false, matchWinner: null, servingTeam: null, swappedSides: false, timeoutsA: 0, timeoutsB: 0, inSuddenDeath: false, pendingSideSwitch: false, matchDurationSeconds: 0, isTimerRunning: false, lastSnapshot: undefined, teamARoster: { ...state.teamARoster, tacticalOffset: 0 }, teamBRoster: { ...state.teamBRoster, tacticalOffset: 0 } };

    case 'TOGGLE_SIDES':
        return { ...state, swappedSides: !state.swappedSides, pendingSideSwitch: false };

    case 'SET_SERVER':
        return { ...state, servingTeam: action.team };

    case 'APPLY_SETTINGS': {
        const modeChanged = action.config.mode !== state.config.mode;
        let newState = { ...state, config: action.config };
        if (action.shouldReset) {
            newState = { ...newState, scoreA: 0, scoreB: 0, setsA: 0, setsB: 0, currentSet: 1, history: [], actionLog: [], matchLog: [], isMatchOver: false, matchWinner: null, servingTeam: null, timeoutsA: 0, timeoutsB: 0, inSuddenDeath: false, pendingSideSwitch: false, lastSnapshot: undefined, teamARoster: { ...state.teamARoster, tacticalOffset: 0 }, teamBRoster: { ...state.teamBRoster, tacticalOffset: 0 } };
        }
        if (modeChanged) {
            const newLimit = getPlayersOnCourt(action.config.mode);
            const allPlayers = [...state.teamARoster.players, ...state.teamBRoster.players, ...state.queue.flatMap(t => t.players)];
            const distResult = distributeStandard(allPlayers, { ...state.teamARoster, players: [] }, { ...state.teamBRoster, players: [] }, [], newLimit);
            newState = { ...newState, teamARoster: { ...distResult.courtA, reserves: state.teamARoster.reserves, hasActiveBench: state.teamARoster.hasActiveBench, tacticalOffset: 0 }, teamBRoster: { ...distResult.courtB, reserves: state.teamBRoster.reserves, hasActiveBench: state.teamBRoster.hasActiveBench, tacticalOffset: 0 }, queue: distResult.queue, teamAName: distResult.courtA.name, teamBName: distResult.courtB.name };
        }
        return newState;
    }

    case 'ROTATE_TEAMS': {
        if (!state.matchWinner) return state;
        if (state.queue.length === 0) return { ...state, scoreA: 0, scoreB: 0, setsA: 0, setsB: 0, currentSet: 1, history: [], actionLog: [], matchLog: [], isMatchOver: false, matchWinner: null, servingTeam: null, timeoutsA: 0, timeoutsB: 0, inSuddenDeath: false, matchDurationSeconds: 0, isTimerRunning: false, rotationReport: null, teamARoster: { ...state.teamARoster, tacticalOffset: 0 }, teamBRoster: { ...state.teamBRoster, tacticalOffset: 0 } };
        const rosterSnapshot = { teamARoster: { ...state.teamARoster, players: [...state.teamARoster.players], reserves: [...(state.teamARoster.reserves||[])] }, teamBRoster: { ...state.teamBRoster, players: [...state.teamBRoster.players], reserves: [...(state.teamBRoster.reserves||[])] }, queue: state.queue.map(t => ({ ...t, players: [...t.players], reserves: [...(t.reserves||[])] })), rotationReport: state.rotationReport };
        const res = handleRotate(state.teamARoster, state.teamBRoster, state.queue, state.matchWinner, state.rotationMode, courtLimit);
        const rotationAction: ActionLog = { type: 'ROTATION', snapshot: rosterSnapshot, timestamp: Date.now() };
        return { ...state, scoreA: 0, scoreB: 0, setsA: 0, setsB: 0, currentSet: 1, history: [], actionLog: [rotationAction], matchLog: [rotationAction], isMatchOver: false, matchWinner: null, servingTeam: null, timeoutsA: 0, timeoutsB: 0, inSuddenDeath: false, matchDurationSeconds: 0, isTimerRunning: false, rotationReport: null, teamARoster: { ...res.courtA, tacticalOffset: 0 }, teamBRoster: { ...res.courtB, tacticalOffset: 0 }, queue: res.queue, teamAName: res.courtA.name, teamBName: res.courtB.name };
    }
    
    case 'RESET_TIMER': return { ...state, matchDurationSeconds: 0, isTimerRunning: false };
    case 'TOGGLE_TIMER': return { ...state, isTimerRunning: !state.isTimerRunning };
    case 'ROSTER_ADD_PLAYER': { const { courtA, courtB, queue } = handleAddPlayer(state.teamARoster, state.teamBRoster, state.queue, action.player, action.targetId, courtLimit); return { ...state, teamARoster: courtA, teamBRoster: courtB, queue }; }
    case 'ROSTER_RESTORE_PLAYER': {
        const { player, targetId, index } = action;
        let newA = { ...state.teamARoster }, newB = { ...state.teamBRoster }, newQ = [...state.queue];
        const insert = (list: Player[]) => {
            const copy = [...list];
            if (index !== undefined && index >= 0 && index <= copy.length) copy.splice(index, 0, player);
            else copy.push(player);
            return copy;
        };
        if (targetId === 'A' || targetId === state.teamARoster.id) newA.players = insert(newA.players);
        else if (targetId === 'A_Reserves') newA.reserves = insert(newA.reserves || []);
        else if (targetId === 'B' || targetId === state.teamBRoster.id) newB.players = insert(newB.players);
        else if (targetId === 'B_Reserves') newB.reserves = insert(newB.reserves || []);
        else {
            const qIdx = newQ.findIndex(t => t.id === (targetId.includes('_Reserves') ? targetId.split('_Reserves')[0] : targetId));
            if (qIdx !== -1) {
                const team = { ...newQ[qIdx] };
                if (targetId.includes('_Reserves')) team.reserves = insert(team.reserves || []);
                else team.players = insert(team.players);
                newQ[qIdx] = team;
            } else if (targetId === 'Queue') { const res = handleAddPlayer(newA, newB, newQ, player, 'Queue', courtLimit); return { ...state, ...res }; }
        }
        return { ...state, teamARoster: newA, teamBRoster: newB, queue: newQ };
    }
    case 'ROSTER_REMOVE_PLAYER': { const { courtA, courtB, queue } = handleRemovePlayer(state.teamARoster, state.teamBRoster, state.queue, action.playerId, courtLimit); return { ...state, teamARoster: courtA, teamBRoster: courtB, queue }; }
    case 'ROSTER_DELETE_PLAYER': { const { courtA, courtB, queue, record } = handleDeletePlayer(state.teamARoster, state.teamBRoster, state.queue, action.playerId); return { ...state, teamARoster: courtA, teamBRoster: courtB, queue, deletedPlayerHistory: record ? [...state.deletedPlayerHistory, record] : state.deletedPlayerHistory }; }
    case 'ROSTER_MOVE_PLAYER': {
        const { playerId, fromId, toId, newIndex } = action;
        let newA = { ...state.teamARoster, players: [...state.teamARoster.players], reserves: [...(state.teamARoster.reserves || [])] };
        let newB = { ...state.teamBRoster, players: [...state.teamBRoster.players, ], reserves: [...(state.teamBRoster.reserves || [])] };
        let newQueue = state.queue.map(t => ({ ...t, players: [...t.players], reserves: [...(t.reserves || [])] }));
        let player: Player | undefined;
        const extract = (team: Team, type: 'players' | 'reserves') => {
            const list = team[type]; if (!list) return false;
            const idx = list.findIndex(p => p.id === playerId);
            if (idx !== -1) { [player] = list.splice(idx, 1); return true; }
            return false;
        };
        if (fromId === 'A' || fromId === newA.id) extract(newA, 'players');
        else if (fromId === 'A_Reserves' || fromId === `${newA.id}_Reserves`) extract(newA, 'reserves');
        else if (fromId === 'B' || fromId === newB.id) extract(newB, 'players');
        else if (fromId === 'B_Reserves' || fromId === `${newB.id}_Reserves`) extract(newB, 'reserves');
        else { for (let t of newQueue) { if (fromId === t.id && extract(t, 'players')) break; if (fromId === `${t.id}_Reserves` && extract(t, 'reserves')) break; } }
        if (!player) return state;
        const add = (list: Player[], p: Player, idx?: number) => { const sIdx = (idx !== undefined && idx >= 0 && idx <= list.length) ? idx : list.length; list.splice(sIdx, 0, p); list.forEach((pl, i) => pl.displayOrder = i); };
        if (toId === 'A' || toId === newA.id) { add(newA.players, player, newIndex); newA.tacticalOffset = 0; }
        else if (toId === 'A_Reserves' || toId === `${newA.id}_Reserves`) { add(newA.reserves, player, newIndex); newA.hasActiveBench = true; }
        else if (toId === 'B' || toId === newB.id) { add(newB.players, player, newIndex); newB.tacticalOffset = 0; }
        else if (toId === 'B_Reserves' || toId === `${newB.id}_Reserves`) { add(newB.reserves, player, newIndex); newB.hasActiveBench = true; }
        else { for (let t of newQueue) { if (toId === t.id) { add(t.players, player, newIndex); break; } if (toId === `${t.id}_Reserves`) { add(t.reserves, player, newIndex); t.hasActiveBench = true; break; } } }
        return { ...state, teamARoster: newA, teamBRoster: newB, queue: newQueue };
    }
    case 'ROSTER_UPDATE_PLAYER': {
        const up = (list: Player[]) => list.map(p => p.id === action.playerId ? { ...p, ...action.updates } : p);
        const ut = (t: Team) => ({ ...t, players: up(t.players), reserves: up(t.reserves || []) });
        return { ...state, teamARoster: ut(state.teamARoster), teamBRoster: ut(state.teamBRoster), queue: state.queue.map(ut) };
    }
    case 'ROSTER_UPDATE_TEAM_NAME': {
        const { teamId, name } = action; const safe = sanitizeInput(name);
        let newA = state.teamARoster, newB = state.teamBRoster, newQ = state.queue;
        if (teamId === 'A' || teamId === state.teamARoster.id) newA = { ...state.teamARoster, name: safe };
        else if (teamId === 'B' || teamId === state.teamBRoster.id) newB = { ...state.teamBRoster, name: safe };
        else newQ = state.queue.map(t => t.id === teamId ? { ...t, name: safe } : t);
        return { ...state, teamARoster: newA, teamBRoster: newB, queue: newQ, teamAName: newA.name, teamBName: newB.name };
    }
    case 'ROSTER_UPDATE_TEAM_COLOR': {
        const { teamId, color } = action;
        let newA = state.teamARoster, newB = state.teamBRoster, newQ = state.queue;
        if (teamId === 'A' || teamId === state.teamARoster.id) newA = { ...state.teamARoster, color };
        else if (teamId === 'B' || teamId === state.teamBRoster.id) newB = { ...state.teamBRoster, color };
        else newQ = state.queue.map(t => t.id === teamId ? { ...t, color } : t);
        return { ...state, teamARoster: newA, teamBRoster: newB, queue: newQ };
    }
    case 'ROSTER_UPDATE_TEAM_LOGO': {
        const { teamId, logo } = action;
        let newA = state.teamARoster, newB = state.teamBRoster, newQ = state.queue;
        if (teamId === 'A' || teamId === state.teamARoster.id) newA = { ...state.teamARoster, logo };
        else if (teamId === 'B' || teamId === state.teamBRoster.id) newB = { ...state.teamBRoster, logo };
        else newQ = state.queue.map(t => t.id === teamId ? { ...t, logo } : t);
        return { ...state, teamARoster: newA, teamBRoster: newB, queue: newQ };
    }
    case 'ROSTER_TOGGLE_FIXED': {
        const tf = (list: Player[]) => list.map(p => p.id === action.playerId ? { ...p, isFixed: !p.isFixed } : p);
        const tt = (t: Team) => ({ ...t, players: tf(t.players), reserves: tf(t.reserves || []) });
        return { ...state, teamARoster: tt(state.teamARoster), teamBRoster: tt(state.teamBRoster), queue: state.queue.map(tt) };
    }
    case 'ROSTER_TOGGLE_BENCH': {
        const { teamId } = action;
        let newA = state.teamARoster, newB = state.teamBRoster, newQ = state.queue;
        if (teamId === 'A' || teamId === state.teamARoster.id) newA = { ...state.teamARoster, hasActiveBench: !state.teamARoster.hasActiveBench };
        else if (teamId === 'B' || teamId === state.teamBRoster.id) newB = { ...state.teamBRoster, hasActiveBench: !state.teamBRoster.hasActiveBench };
        else newQ = state.queue.map(t => t.id === teamId ? { ...t, hasActiveBench: !t.hasActiveBench } : t);
        return { ...state, teamARoster: newA, teamBRoster: newB, queue: newQ };
    }
    case 'ROSTER_GENERATE': {
        const result = distributeStandard(action.players, { ...state.teamARoster, players: [], tacticalOffset: 0 }, { ...state.teamBRoster, players: [], tacticalOffset: 0 }, [], courtLimit);
        return { ...state, teamARoster: { ...result.courtA, reserves: state.teamARoster.reserves, hasActiveBench: state.teamARoster.hasActiveBench }, teamBRoster: { ...result.courtB, reserves: state.teamBRoster.reserves, hasActiveBench: state.teamBRoster.hasActiveBench }, queue: result.queue, teamAName: result.courtA.name, teamBName: result.courtB.name };
    }
    case 'ROSTER_SET_MODE': return { ...state, rotationMode: action.mode };
    case 'ROSTER_BALANCE': {
        const all = [...state.teamARoster.players, ...state.teamBRoster.players, ...state.queue.flatMap(t => t.players)];
        const result = state.rotationMode === 'balanced' ? balanceTeamsSnake(all, state.teamARoster, state.teamBRoster, state.queue, courtLimit) : distributeStandard(all, state.teamARoster, state.teamBRoster, state.queue, courtLimit);
        return { ...state, teamARoster: { ...result.courtA, reserves: state.teamARoster.reserves, hasActiveBench: state.teamARoster.hasActiveBench, tacticalOffset: 0 }, teamBRoster: { ...result.courtB, reserves: state.teamBRoster.reserves, hasActiveBench: state.teamBRoster.hasActiveBench, tacticalOffset: 0 }, queue: result.queue.map(t => ({ ...t, hasActiveBench: state.queue.find(old => old.id === t.id)?.hasActiveBench ?? false })) };
    }
    case 'ROSTER_SUBSTITUTE': {
        const { teamId, playerOutId, playerInId } = action;
        const sub = (t: Team) => {
            if (t.id !== teamId && (teamId !== 'A' || t.id !== state.teamARoster.id) && (teamId !== 'B' || t.id !== state.teamBRoster.id)) return t;
            const p = [...t.players], r = [...(t.reserves || [])];
            const oIdx = p.findIndex(pl => pl.id === playerOutId), iIdx = r.findIndex(pl => pl.id === playerInId);
            if (oIdx !== -1 && iIdx !== -1) { const out = p[oIdx], inn = r[iIdx]; p[oIdx] = inn; r[iIdx] = out; return { ...t, players: p, reserves: r }; }
            return t;
        };
        return { ...state, teamARoster: sub(state.teamARoster), teamBRoster: sub(state.teamBRoster), queue: state.queue.map(sub) };
    }
    case 'ROSTER_SYNC_PROFILES': {
        const profs = action.profiles; 
        let changed = false;
        
        const syncList = (list: Player[]): Player[] => list.map((p): Player => {
            const m = p.profileId ? profs.get(p.profileId) : Array.from(profs.values()).find(pr => pr.name.trim().toLowerCase() === p.name.trim().toLowerCase());
            
            if (!m) { 
                if (p.profileId) changed = true; 
                return { ...p, profileId: undefined }; 
            }
            
            const roleMatch = (m.role || 'none') === (p.role || 'none');
            const needsUpdate = p.profileId !== m.id || m.name !== p.name || m.skillLevel !== m.skillLevel || (m.number && m.number !== p.number) || !roleMatch;
            
            if (needsUpdate) { 
                changed = true; 
                return { ...p, profileId: m.id, name: m.name, skillLevel: m.skillLevel, number: m.number || p.number, role: m.role }; 
            }
            return p;
        });

        if (!changed) return state;
        
        return { 
            ...state, 
            teamARoster: { 
                ...state.teamARoster, 
                players: syncList(state.teamARoster.players), 
                reserves: syncList(state.teamARoster.reserves || []) 
            }, 
            teamBRoster: { 
                ...state.teamBRoster, 
                players: syncList(state.teamBRoster.players), 
                reserves: syncList(state.teamBRoster.reserves || []) 
            }, 
            queue: state.queue.map(t => ({ 
                ...t, 
                players: syncList(t.players), 
                reserves: syncList(t.reserves || []) 
            })) 
        };
    }
    case 'ROSTER_UNLINK_PROFILE': {
        const unlink = (list: Player[]): Player[] => list.map((p): Player => 
            p.profileId === action.profileId ? { ...p, profileId: undefined, role: 'none' } : p
        );
        return { 
            ...state, 
            teamARoster: { 
                ...state.teamARoster, 
                players: unlink(state.teamARoster.players), 
                reserves: unlink(state.teamARoster.reserves || []) 
            }, 
            teamBRoster: { 
                ...state.teamBRoster, 
                players: unlink(state.teamBRoster.players), 
                reserves: unlink(state.teamBRoster.reserves || []) 
            }, 
            queue: state.queue.map(t => ({ 
                ...t, 
                players: unlink(t.players), 
                reserves: unlink(t.reserves || []) 
            })) 
        };
    }
    case 'ROSTER_QUEUE_REORDER': {
        const { fromIndex, toIndex } = action;
        if (fromIndex < 0 || fromIndex >= state.queue.length || toIndex < 0 || toIndex >= state.queue.length) return state;
        const nq = [...state.queue], [mov] = nq.splice(fromIndex, 1); nq.splice(toIndex, 0, mov); return { ...state, queue: nq };
    }
    case 'ROSTER_DISBAND_TEAM': return { ...state, queue: state.queue.filter(t => t.id !== action.teamId) };
    case 'ROSTER_RESTORE_TEAM': { const nq = [...state.queue], si = Math.min(Math.max(0, action.index), nq.length); nq.splice(si, 0, action.team); return { ...state, queue: nq }; }
    case 'ROSTER_RESET_ALL': return { ...state, teamARoster: { ...state.teamARoster, players: [], reserves: [], tacticalOffset: 0 }, teamBRoster: { ...state.teamBRoster, players: [], reserves: [], tacticalOffset: 0 }, queue: [] };
    case 'ROSTER_ENSURE_TEAM_IDS': {
        let c = false, na = state.teamARoster, nb = state.teamBRoster;
        if (state.teamARoster.id === 'A') { na = { ...state.teamARoster, id: uuidv4() }; c = true; }
        if (state.teamBRoster.id === 'B') { nb = { ...state.teamBRoster, id: uuidv4() }; c = true; }
        return c ? { ...state, teamARoster: na, teamBRoster: nb } : state;
    }
    case 'MANUAL_ROTATION': {
        const { teamId, direction } = action;
        let na = { ...state.teamARoster }, nb = { ...state.teamBRoster };
        if (teamId === 'A' || teamId === state.teamARoster.id) { na.players = direction === 'clockwise' ? rotateClockwise(na.players) : rotateCounterClockwise(na.players); na.tacticalOffset = 0; }
        else if (teamId === 'B' || teamId === state.teamBRoster.id) { nb.players = direction === 'clockwise' ? rotateClockwise(nb.players) : rotateCounterClockwise(nb.players); nb.tacticalOffset = 0; }
        const log: ActionLog = { type: 'MANUAL_ROTATION', teamId, direction, timestamp: Date.now() };
        return { ...state, teamARoster: na, teamBRoster: nb, actionLog: [...state.actionLog, log], matchLog: [...state.matchLog, log] };
    }
    default: return state;
  }
};
