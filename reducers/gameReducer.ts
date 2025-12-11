

import { GameState, TeamId, SetHistory, ActionLog, Team, Player, SkillType, GameAction } from '../types';
import { SETS_TO_WIN_MATCH, MIN_LEAD_TO_WIN } from '../constants';
import { isValidTimeoutRequest, sanitizeInput } from '../utils/security';
import { handleAddPlayer, handleRemovePlayer, handleDeletePlayer, handleMovePlayer, handleRotate, createPlayer } from '../utils/rosterLogic';
import { balanceTeamsSnake, distributeStandard } from '../utils/balanceUtils';

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

// --- REDUCER ---
export const gameReducer = (state: GameState, action: GameAction): GameState => {
  switch (action.type) {
    case 'LOAD_STATE':
      return { ...action.payload };

    // --- GAMEPLAY ACTIONS ---
    case 'POINT': {
      if (state.isMatchOver) return state;
      if (state.scoreA >= 999 || state.scoreB >= 999) return state;

      const team = action.team;
      let newScoreA = team === 'A' ? state.scoreA + 1 : state.scoreA;
      let newScoreB = team === 'B' ? state.scoreB + 1 : state.scoreB;
      
      let triggerSideSwitch = false;
      const totalPoints = newScoreA + newScoreB;
      
      if (state.config.mode === 'beach') {
         const isFinalSet = state.config.hasTieBreak && state.currentSet === state.config.maxSets;
         const switchInterval = isFinalSet ? 5 : 7;
         if (totalPoints > 0 && totalPoints % switchInterval === 0) {
             triggerSideSwitch = true;
         }
      }

      const isTieBreak = state.config.hasTieBreak && state.currentSet === state.config.maxSets;
      const target = isTieBreak ? state.config.tieBreakPoints : state.config.pointsPerSet;
      
      let enteringSuddenDeath = false;
      // Deuce Logic Check
      if (state.config.deuceType === 'sudden_death_3pt' && !state.inSuddenDeath) {
         if (newScoreA === target - 1 && newScoreB === target - 1) {
             newScoreA = 0;
             newScoreB = 0;
             enteringSuddenDeath = true;
         }
      }

      const setWinner = calculateWinner(newScoreA, newScoreB, target, state.inSuddenDeath || enteringSuddenDeath);

      const newAction: ActionLog = { 
        type: 'POINT', 
        team,
        prevScoreA: state.scoreA,
        prevScoreB: state.scoreB,
        prevServingTeam: state.servingTeam,
        prevInSuddenDeath: state.inSuddenDeath,
        timestamp: Date.now(),
        ...(action.metadata || {})   
      };

      if (setWinner) {
          const newSetsA = setWinner === 'A' ? state.setsA + 1 : state.setsA;
          const newSetsB = setWinner === 'B' ? state.setsB + 1 : state.setsB;
          const historyEntry: SetHistory = { setNumber: state.currentSet, scoreA: newScoreA, scoreB: newScoreB, winner: setWinner };
          
          const setsNeeded = SETS_TO_WIN_MATCH(state.config.maxSets);
          const matchWinner = newSetsA === setsNeeded ? 'A' : (newSetsB === setsNeeded ? 'B' : null);
          
          const snapshotState = { ...state };

          // Generate Rotation Preview if match NOT over (or even if it is, to show next game)
          const rotRes = handleRotate(state.teamARoster, state.teamBRoster, state.queue, setWinner, state.rotationMode);

          return {
              ...state, 
              scoreA: matchWinner ? newScoreA : 0, 
              scoreB: matchWinner ? newScoreB : 0, 
              setsA: newSetsA, 
              setsB: newSetsB,
              history: [...state.history, historyEntry], 
              currentSet: matchWinner ? state.currentSet : state.currentSet + 1, 
              matchWinner: matchWinner, 
              isMatchOver: !!matchWinner, 
              servingTeam: null, 
              isTimerRunning: matchWinner ? false : true, 
              timeoutsA: 0, 
              timeoutsB: 0, 
              inSuddenDeath: false,
              pendingSideSwitch: false, 
              actionLog: [], 
              matchLog: [...state.matchLog, newAction], 
              lastSnapshot: snapshotState,
              // We store the rotation report so MatchOverModal can show it, but we DO NOT apply it yet.
              rotationReport: rotRes.report
          };
      }

      return {
          ...state,
          scoreA: newScoreA,
          scoreB: newScoreB,
          servingTeam: team,
          isTimerRunning: true,
          inSuddenDeath: state.inSuddenDeath || enteringSuddenDeath,
          pendingSideSwitch: triggerSideSwitch,
          actionLog: [...state.actionLog, newAction],
          matchLog: [...state.matchLog, newAction],
          lastSnapshot: undefined
      };
    }

    case 'SUBTRACT_POINT': {
        if (state.isMatchOver) return state;
        const team = action.team;
        const currentScore = team === 'A' ? state.scoreA : state.scoreB;
        if (currentScore <= 0) return state;
        
        return { 
            ...state, 
            scoreA: team === 'A' ? Math.max(0, state.scoreA - 1) : state.scoreA, 
            scoreB: team === 'B' ? Math.max(0, state.scoreB - 1) : state.scoreB,
            pendingSideSwitch: false 
        };
    }

    case 'TIMEOUT': {
        const team = action.team;
        if (team === 'A' && !isValidTimeoutRequest(state.timeoutsA)) return state;
        if (team === 'B' && !isValidTimeoutRequest(state.timeoutsB)) return state;

        const newAction: ActionLog = { 
            type: 'TIMEOUT', 
            team,
            prevTimeoutsA: state.timeoutsA,
            prevTimeoutsB: state.timeoutsB,
            timestamp: Date.now()
        };

        return {
            ...state,
            timeoutsA: team === 'A' ? state.timeoutsA + 1 : state.timeoutsA,
            timeoutsB: team === 'B' ? state.timeoutsB + 1 : state.timeoutsB,
            actionLog: [...state.actionLog, newAction],
            matchLog: [...state.matchLog, newAction],
            lastSnapshot: undefined
        };
    }

    case 'UNDO': {
        if (state.lastSnapshot) {
            return { ...state.lastSnapshot };
        }
        if (state.isMatchOver) return state;
        if (state.actionLog.length === 0) return state;

        const newLog = [...state.actionLog];
        const lastAction = newLog.pop()!;
        
        const newMatchLog = [...state.matchLog];
        if (newMatchLog.length > 0 && newMatchLog[newMatchLog.length - 1].type === lastAction.type) {
            newMatchLog.pop();
        }

        if (lastAction.type === 'TIMEOUT') {
            return {
                ...state,
                actionLog: newLog,
                matchLog: newMatchLog,
                timeoutsA: lastAction.prevTimeoutsA,
                timeoutsB: lastAction.prevTimeoutsB,
                lastSnapshot: undefined
            };
        }

        if (lastAction.type === 'POINT') {
            return {
                ...state,
                actionLog: newLog,
                matchLog: newMatchLog,
                scoreA: lastAction.prevScoreA,
                scoreB: lastAction.prevScoreB,
                servingTeam: lastAction.prevServingTeam,
                inSuddenDeath: lastAction.prevInSuddenDeath ?? false,
                pendingSideSwitch: false,
                lastSnapshot: undefined
            };
        }
        return state;
    }

    case 'RESET_MATCH':
        return {
            ...state,
            scoreA: 0, scoreB: 0, setsA: 0, setsB: 0, currentSet: 1, history: [],
            actionLog: [], matchLog: [], isMatchOver: false, matchWinner: null,
            servingTeam: null, swappedSides: false, timeoutsA: 0, timeoutsB: 0,
            inSuddenDeath: false, pendingSideSwitch: false, matchDurationSeconds: 0,
            isTimerRunning: false, lastSnapshot: undefined
        };

    case 'TOGGLE_SIDES':
        return { ...state, swappedSides: !state.swappedSides, pendingSideSwitch: false };

    case 'SET_SERVER':
        return { ...state, servingTeam: action.team };

    case 'APPLY_SETTINGS':
        if (action.shouldReset) {
            return {
                ...state,
                scoreA: 0, scoreB: 0, setsA: 0, setsB: 0, currentSet: 1, history: [],
                actionLog: [], matchLog: [], isMatchOver: false, matchWinner: null,
                servingTeam: null, timeoutsA: 0, timeoutsB: 0, inSuddenDeath: false,
                pendingSideSwitch: false, lastSnapshot: undefined,
                config: action.config
            };
        }
        return { ...state, config: action.config };

    case 'ROTATE_TEAMS': {
        if (!state.matchWinner) return state;
        
        const res = handleRotate(state.teamARoster, state.teamBRoster, state.queue, state.matchWinner, state.rotationMode);
        
        return {
            ...state,
            scoreA: 0, scoreB: 0, setsA: 0, setsB: 0, currentSet: 1, history: [],
            actionLog: [], matchLog: [], 
            isMatchOver: false, matchWinner: null, servingTeam: null, 
            timeoutsA: 0, timeoutsB: 0, inSuddenDeath: false, 
            matchDurationSeconds: 0, isTimerRunning: false,
            rotationReport: null,
            teamARoster: res.courtA,
            teamBRoster: res.courtB,
            queue: res.queue,
            teamAName: res.courtA.name,
            teamBName: res.courtB.name
        };
    }
    
    case 'RESET_TIMER':
        return { ...state, matchDurationSeconds: 0, isTimerRunning: false };
    
    case 'TOGGLE_TIMER':
        return { ...state, isTimerRunning: !state.isTimerRunning };

    // --- ROSTER ACTIONS ---
    
    case 'ROSTER_ADD_PLAYER': {
        const { courtA, courtB, queue } = handleAddPlayer(state.teamARoster, state.teamBRoster, state.queue, action.player, action.targetId);
        return { ...state, teamARoster: courtA, teamBRoster: courtB, queue };
    }

    case 'ROSTER_REMOVE_PLAYER': {
        const { courtA, courtB, queue } = handleRemovePlayer(state.teamARoster, state.teamBRoster, state.queue, action.playerId);
        return { ...state, teamARoster: courtA, teamBRoster: courtB, queue };
    }

    case 'ROSTER_DELETE_PLAYER': {
        const { courtA, courtB, queue, record } = handleDeletePlayer(state.teamARoster, state.teamBRoster, state.queue, action.playerId);
        const newHistory = record ? [...state.deletedPlayerHistory, record] : state.deletedPlayerHistory;
        return { ...state, teamARoster: courtA, teamBRoster: courtB, queue, deletedPlayerHistory: newHistory };
    }

    case 'ROSTER_MOVE_PLAYER': {
        const { courtA, courtB, queue } = handleMovePlayer(state.teamARoster, state.teamBRoster, state.queue, action.playerId, action.fromId, action.toId, action.newIndex);
        return { ...state, teamARoster: courtA, teamBRoster: courtB, queue };
    }

    case 'ROSTER_UPDATE_PLAYER': {
        const updateList = (list: Player[]) => list.map(p => p.id === action.playerId ? { ...p, ...action.updates } : p);
        const updateTeam = (t: Team) => ({ ...t, players: updateList(t.players), reserves: updateList(t.reserves || []) });
        return {
            ...state,
            teamARoster: updateTeam(state.teamARoster),
            teamBRoster: updateTeam(state.teamBRoster),
            queue: state.queue.map(updateTeam)
        };
    }

    case 'ROSTER_UPDATE_TEAM_NAME': {
        const { teamId, name } = action;
        const safeName = sanitizeInput(name);
        let newA = state.teamARoster, newB = state.teamBRoster, newQ = state.queue;
        
        if (teamId === 'A' || teamId === state.teamARoster.id) newA = { ...state.teamARoster, name: safeName };
        else if (teamId === 'B' || teamId === state.teamBRoster.id) newB = { ...state.teamBRoster, name: safeName };
        else newQ = state.queue.map(t => t.id === teamId ? { ...t, name: safeName } : t);

        return { ...state, teamARoster: newA, teamBRoster: newB, queue: newQ, teamAName: newA.name, teamBName: newB.name };
    }

    case 'ROSTER_UPDATE_TEAM_COLOR': {
        const { teamId, color } = action;
        let newA = state.teamARoster, newB = state.teamBRoster, newQ = state.queue;
        
        if (teamId === 'A' || teamId === state.teamARoster.id) newA = { ...state.teamARoster, color };
        else if (teamId === 'B' || teamId === state.teamBRoster.id) newB = { ...state.teamBRoster, color };
        else {
            newQ = state.queue.map(t => t.id === teamId ? { ...t, color } : t);
        }
        return { ...state, teamARoster: newA, teamBRoster: newB, queue: newQ };
    }

    case 'ROSTER_TOGGLE_FIXED': {
        const toggle = (list: Player[]) => list.map(p => p.id === action.playerId ? { ...p, isFixed: !p.isFixed } : p);
        const toggleTeam = (t: Team) => ({ ...t, players: toggle(t.players), reserves: toggle(t.reserves || []) });
        return {
            ...state,
            teamARoster: toggleTeam(state.teamARoster),
            teamBRoster: toggleTeam(state.teamBRoster),
            queue: state.queue.map(toggleTeam)
        };
    }

    case 'ROSTER_TOGGLE_BENCH': {
        const { teamId } = action;
        let newA = state.teamARoster, newB = state.teamBRoster, newQ = state.queue;

        if (teamId === 'A' || teamId === state.teamARoster.id) {
            newA = { ...state.teamARoster, hasActiveBench: !state.teamARoster.hasActiveBench };
        } else if (teamId === 'B' || teamId === state.teamBRoster.id) {
            newB = { ...state.teamBRoster, hasActiveBench: !state.teamBRoster.hasActiveBench };
        } else {
            newQ = state.queue.map(t => t.id === teamId ? { ...t, hasActiveBench: !t.hasActiveBench } : t);
        }
        
        return { ...state, teamARoster: newA, teamBRoster: newB, queue: newQ };
    }

    case 'ROSTER_GENERATE': {
        const validNames = action.names.filter(n => n.trim().length > 0);
        
        const allNewPlayers = validNames.map((raw, idx) => {
            const trimmed = raw.trim();
            const match = trimmed.match(/^(.+)\s+(10|[1-9])$/);
            
            let name = trimmed;
            let skill = 5;
            
            if (match) {
                name = match[1].trim();
                skill = parseInt(match[2], 10);
            }
            
            return createPlayer(name, idx, undefined, skill); 
        });
        
        const cleanA = { ...state.teamARoster, players: [] };
        const cleanB = { ...state.teamBRoster, players: [] };
        const result = distributeStandard(allNewPlayers, cleanA, cleanB, []);
        
        return { 
            ...state, 
            teamARoster: { ...result.courtA, reserves: state.teamARoster.reserves, hasActiveBench: state.teamARoster.hasActiveBench },
            teamBRoster: { ...result.courtB, reserves: state.teamBRoster.reserves, hasActiveBench: state.teamBRoster.hasActiveBench },
            queue: result.queue,
            teamAName: result.courtA.name,
            teamBName: result.courtB.name
        };
    }

    case 'ROSTER_SET_MODE':
        return { ...state, rotationMode: action.mode };

    case 'ROSTER_BALANCE': {
        const allPlayers = [
            ...state.teamARoster.players,
            ...state.teamBRoster.players,
            ...state.queue.flatMap(t => t.players)
        ];
        let result;
        if (state.rotationMode === 'balanced') {
            result = balanceTeamsSnake(allPlayers, state.teamARoster, state.teamBRoster, state.queue);
        } else {
            result = distributeStandard(allPlayers, state.teamARoster, state.teamBRoster, state.queue);
        }
        return {
            ...state,
            teamARoster: { ...result.courtA, reserves: state.teamARoster.reserves, hasActiveBench: state.teamARoster.hasActiveBench },
            teamBRoster: { ...result.courtB, reserves: state.teamBRoster.reserves, hasActiveBench: state.teamBRoster.hasActiveBench },
            queue: result.queue.map((t, i) => {
                const oldTeam = state.queue.find(old => old.id === t.id); 
                return { ...t, hasActiveBench: oldTeam ? oldTeam.hasActiveBench : false };
            }),
        };
    }

    case 'ROSTER_SUBSTITUTE': {
        const { teamId, playerOutId, playerInId } = action;

        // Helper to perform substitution on a specific team object
        const doSubstitute = (team: Team): Team => {
            // Only proceed if this is the target team
            // Match against explicit ID OR logical alias (A/B)
            const isTarget = team.id === teamId || 
                             (teamId === 'A' && team.id === state.teamARoster.id) || 
                             (teamId === 'B' && team.id === state.teamBRoster.id);

            if (!isTarget) return team;

            const players = [...team.players];
            const reserves = [...(team.reserves || [])];

            const outIndex = players.findIndex(p => p.id === playerOutId);
            const inIndex = reserves.findIndex(p => p.id === playerInId);

            if (outIndex !== -1 && inIndex !== -1) {
                const outPlayer = players[outIndex];
                const inPlayer = reserves[inIndex];

                players[outIndex] = inPlayer;
                reserves[inIndex] = outPlayer;

                return { ...team, players, reserves };
            }
            
            return team;
        };

        return {
            ...state,
            teamARoster: doSubstitute(state.teamARoster),
            teamBRoster: doSubstitute(state.teamBRoster),
            queue: state.queue.map(doSubstitute)
        };
    }

    case 'ROSTER_UNDO_REMOVE': {
        if (state.deletedPlayerHistory.length === 0) return state;
        const history = [...state.deletedPlayerHistory];
        const record = history.pop()!;
        const { player, originId } = record;
        
        const addTo = (list: Player[]) => [...list, player];
        
        let newA = state.teamARoster, newB = state.teamBRoster;
        let newQ = state.queue;

        if (originId === 'A') newA = { ...newA, players: addTo(newA.players) };
        else if (originId === 'A_Reserves') newA = { ...newA, reserves: addTo(newA.reserves || []) };
        else if (originId === 'B') newB = { ...newB, players: addTo(newB.players) };
        else if (originId === 'B_Reserves') newB = { ...newB, reserves: addTo(newB.reserves || []) };
        else {
             let found = false;
             newQ = newQ.map(t => {
                 if (t.id === originId) { found = true; return { ...t, players: addTo(t.players) }; }
                 if (`${t.id}_Reserves` === originId) { found = true; return { ...t, reserves: addTo(t.reserves || []) }; }
                 return t;
             });
             if (!found) {
                 if (newQ.length > 0) {
                     newQ[newQ.length - 1] = { ...newQ[newQ.length - 1], players: [...newQ[newQ.length - 1].players, player] };
                 } 
             }
        }

        return { ...state, teamARoster: newA, teamBRoster: newB, queue: newQ, deletedPlayerHistory: history };
    }

    case 'ROSTER_COMMIT_DELETIONS':
        return { ...state, deletedPlayerHistory: [] };

    case 'ROSTER_SYNC_PROFILES': {
        const profiles = action.profiles;
        let hasChanges = false;
        
        const syncList = (list: Player[]): Player[] => {
            return list.map(p => {
                if (!p.profileId) return p;
                const master = profiles.get(p.profileId);
                
                if (!master) { hasChanges = true; return { ...p, profileId: undefined }; }
                
                let changed = false;
                if (master.name !== p.name) changed = true;
                if (master.skillLevel !== p.skillLevel) changed = true;
                if (master.number && master.number !== p.number) changed = true;

                if (changed) {
                    hasChanges = true;
                    return { ...p, name: master.name, skillLevel: master.skillLevel };
                }
                return p;
            });
        };

        const newCourtA = { ...state.teamARoster, players: syncList(state.teamARoster.players), reserves: syncList(state.teamARoster.reserves || []) };
        const newCourtB = { ...state.teamBRoster, players: syncList(state.teamBRoster.players), reserves: syncList(state.teamBRoster.reserves || []) };
        const newQueue = state.queue.map(t => ({ ...t, players: syncList(t.players), reserves: syncList(t.reserves || []) }));

        if (!hasChanges) return state;
        return { ...state, teamARoster: newCourtA, teamBRoster: newCourtB, queue: newQueue };
    }

    case 'ROSTER_QUEUE_REORDER': {
        const { fromIndex, toIndex } = action;
        if (fromIndex < 0 || fromIndex >= state.queue.length || toIndex < 0 || toIndex >= state.queue.length) return state;
        const newQueue = [...state.queue];
        const [moved] = newQueue.splice(fromIndex, 1);
        newQueue.splice(toIndex, 0, moved);
        return { ...state, queue: newQueue };
    }

    case 'ROSTER_DISBAND_TEAM': {
        const newQueue = state.queue.filter(t => t.id !== action.teamId);
        return { ...state, queue: newQueue };
    }

    default:
        return state;
  }
};