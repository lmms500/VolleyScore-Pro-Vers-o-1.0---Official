
import { useReducer, useEffect, useCallback, useState } from 'react';
import { gameReducer } from '../reducers/gameReducer';
import { GameState, GameConfig, TeamId, Player, PlayerProfile, SkillType, RotationMode, PlayerRole, Team } from '../types';
import { DEFAULT_CONFIG, SETS_TO_WIN_MATCH } from '../constants';
import { SecureStorage } from '../services/SecureStorage';
import { usePlayerProfiles } from './usePlayerProfiles';
import { createPlayer, validateUniqueNumber } from '../utils/rosterLogic';

const STORAGE_KEY = 'action_log';

const INITIAL_STATE: GameState = {
  teamAName: 'Team A',
  teamBName: 'Team B',
  scoreA: 0,
  scoreB: 0,
  setsA: 0,
  setsB: 0,
  currentSet: 1,
  history: [],
  actionLog: [],
  matchLog: [],
  isMatchOver: false,
  matchWinner: null,
  servingTeam: null,
  swappedSides: false,
  config: DEFAULT_CONFIG,
  timeoutsA: 0,
  timeoutsB: 0,
  inSuddenDeath: false,
  pendingSideSwitch: false,
  matchDurationSeconds: 0,
  isTimerRunning: false,
  teamARoster: { id: 'A', name: 'Team A', players: [], reserves: [], color: 'indigo', tacticalOffset: 0 },
  teamBRoster: { id: 'B', name: 'Team B', players: [], reserves: [], color: 'rose', tacticalOffset: 0 },
  queue: [],
  rotationReport: null,
  deletedPlayerHistory: [],
  rotationMode: 'standard'
};

export const useVolleyGame = () => {
  const [state, dispatch] = useReducer(gameReducer, INITIAL_STATE);
  const { profiles, findProfileByName, isReady: profilesReady, upsertProfile, deleteProfile, batchUpdateStats } = usePlayerProfiles();
  const [isLoaded, setIsLoaded] = useState(false);

  // Load state on mount
  useEffect(() => {
    const load = async () => {
      try {
        const saved = await SecureStorage.load<GameState>(STORAGE_KEY);
        if (saved) {
          const mergedConfig = { ...DEFAULT_CONFIG, ...saved.config };
          const validState = { 
              ...INITIAL_STATE, 
              ...saved, 
              config: mergedConfig,
              teamARoster: saved.teamARoster || INITIAL_STATE.teamARoster,
              teamBRoster: saved.teamBRoster || INITIAL_STATE.teamBRoster
          };
          dispatch({ type: 'LOAD_STATE', payload: validState });
        } else {
          dispatch({ type: 'ROSTER_ENSURE_TEAM_IDS' });
        }
      } catch (e) {
        console.error("Failed to load game state", e);
      }
      setIsLoaded(true);
    };
    load();
  }, []);

  // Save state on change
  useEffect(() => {
    if (isLoaded) {
      SecureStorage.save(STORAGE_KEY, state);
    }
  }, [state, isLoaded]);

  // Sync profiles if updated
  useEffect(() => {
      if (profilesReady && isLoaded) {
          dispatch({ type: 'ROSTER_SYNC_PROFILES', profiles });
      }
  }, [profiles, profilesReady, isLoaded]);

  const loadStateFromFile = useCallback((newState: GameState) => {
      dispatch({ type: 'LOAD_STATE', payload: newState });
  }, []);

  const addPoint = useCallback((team: TeamId, metadata?: { playerId: string, skill: SkillType }) => {
      if (state.isMatchOver) return;
      dispatch({ type: 'POINT', team, metadata });
  }, [state.isMatchOver]);

  const subtractPoint = useCallback((team: TeamId) => {
      if (state.isMatchOver) return;
      dispatch({ type: 'SUBTRACT_POINT', team });
  }, [state.isMatchOver]);

  const setServer = useCallback((team: TeamId) => dispatch({ type: 'SET_SERVER', team }), []);
  const useTimeout = useCallback((team: TeamId) => dispatch({ type: 'TIMEOUT', team }), []);
  const undo = useCallback(() => dispatch({ type: 'UNDO' }), []);
  const toggleSides = useCallback(() => dispatch({ type: 'TOGGLE_SIDES' }), []);
  const applySettings = useCallback((config: GameConfig, shouldReset: boolean) => dispatch({ type: 'APPLY_SETTINGS', config, shouldReset }), []);
  const resetMatch = useCallback(() => dispatch({ type: 'RESET_MATCH' }), []);
  
  const togglePlayerFixed = useCallback((id: string) => dispatch({ type: 'ROSTER_TOGGLE_FIXED', playerId: id }), []);
  const removePlayer = useCallback((id: string) => dispatch({ type: 'ROSTER_REMOVE_PLAYER', playerId: id }), []);
  const movePlayer = useCallback((id: string, from: string, to: string, index?: number) => dispatch({ type: 'ROSTER_MOVE_PLAYER', playerId: id, fromId: from, toId: to, newIndex: index }), []);
  
  const swapPositions = useCallback((teamId: string, indexA: number, indexB: number) => {
      dispatch({ type: 'ROSTER_SWAP_POSITIONS', teamId, indexA, indexB });
  }, []);

  const updateTeamName = useCallback((id: string, name: string) => dispatch({ type: 'ROSTER_UPDATE_TEAM_NAME', teamId: id, name }), []);
  const updateTeamColor = useCallback((id: string, color: any) => dispatch({ type: 'ROSTER_UPDATE_TEAM_COLOR', teamId: id, color }), []);
  const updateTeamLogo = useCallback((id: string, logo: string) => dispatch({ type: 'ROSTER_UPDATE_TEAM_LOGO', teamId: id, logo }), []);
  
  const updatePlayer = useCallback((id: string, updates: Partial<Player>) => {
      if (updates.number) {
          const allPlayers = [
              ...state.teamARoster.players, ...(state.teamARoster.reserves || []),
              ...state.teamBRoster.players, ...(state.teamBRoster.reserves || []),
              ...state.queue.flatMap(t => [...t.players, ...(t.reserves || [])])
          ];
          const result = validateUniqueNumber(allPlayers, updates.number, id);
          if (!result.valid) return { success: false, error: result.message, errorKey: result.messageKey, errorParams: result.messageParams };
      }
      dispatch({ type: 'ROSTER_UPDATE_PLAYER', playerId: id, updates });
      return { success: true };
  }, [state.teamARoster, state.teamBRoster, state.queue]);

  const addPlayer = useCallback((name: string, target: string, number?: string, skill?: number, profileId?: string) => {
      if (number) {
          const allPlayers = [
              ...state.teamARoster.players, ...(state.teamARoster.reserves || []),
              ...state.teamBRoster.players, ...(state.teamBRoster.reserves || []),
              ...state.queue.flatMap(t => [...t.players, ...(t.reserves || [])])
          ];
          const result = validateUniqueNumber(allPlayers, number);
          if (!result.valid) return { success: false, error: result.message, errorKey: result.messageKey, errorParams: result.messageParams };
      }

      const p = createPlayer(name, 999, profileId, skill, number);
      dispatch({ type: 'ROSTER_ADD_PLAYER', player: p, targetId: target });
      return { success: true };
  }, [state.teamARoster, state.teamBRoster, state.queue]);

  const undoRemovePlayer = useCallback(() => dispatch({ type: 'ROSTER_UNDO_REMOVE' }), []);
  const commitDeletions = useCallback(() => dispatch({ type: 'ROSTER_COMMIT_DELETIONS' }), []);
  
  const rotateTeams = useCallback(() => dispatch({ type: 'ROTATE_TEAMS' }), []);
  const setRotationMode = useCallback((mode: RotationMode) => dispatch({ type: 'ROSTER_SET_MODE', mode }), []);
  const balanceTeams = useCallback(() => dispatch({ type: 'ROSTER_BALANCE' }), []);
  
  const savePlayerToProfile = useCallback((playerId: string, data: { name: string, number: string, avatar: string, skill: number, role: PlayerRole }) => {
      const { name, number, avatar, skill, role } = data;
      let existingProfileId: string | undefined;
      const findP = (list: Player[]) => list.find(p => p.id === playerId);
      const player = findP(state.teamARoster.players) || findP(state.teamARoster.reserves||[]) || 
                     findP(state.teamBRoster.players) || findP(state.teamBRoster.reserves||[]) ||
                     state.queue.flatMap(t => [...t.players, ...(t.reserves||[])]).find(p => p.id === playerId);
      
      if (player && player.profileId) existingProfileId = player.profileId;

      const p = upsertProfile(name, skill, existingProfileId, { number, avatar, role });
      
      dispatch({ type: 'ROSTER_UPDATE_PLAYER', playerId, updates: { 
          name: p.name, number: p.number, skillLevel: p.skillLevel, 
          profileId: p.id, role: p.role 
      }});
      return { success: true };
  }, [upsertProfile, state.teamARoster, state.teamBRoster, state.queue]);

  const revertPlayerChanges = useCallback((playerId: string) => {
      const findP = (list: Player[]) => list.find(p => p.id === playerId);
      const player = findP(state.teamARoster.players) || findP(state.teamARoster.reserves||[]) || 
                     findP(state.teamBRoster.players) || findP(state.teamBRoster.reserves||[]) ||
                     state.queue.flatMap(t => [...t.players, ...(t.reserves||[])]).find(p => p.id === playerId);
      
      if (player && player.profileId && profiles.has(player.profileId)) {
          const profile = profiles.get(player.profileId)!;
          dispatch({ type: 'ROSTER_UPDATE_PLAYER', playerId, updates: {
              name: profile.name,
              number: profile.number,
              skillLevel: profile.skillLevel,
              role: profile.role
          }});
      }
  }, [state.teamARoster, state.teamBRoster, state.queue, profiles]);

  const sortTeam = useCallback((teamId: string, criteria: any) => dispatch({ type: 'ROSTER_SORT', teamId, criteria }), []);
  const toggleTeamBench = useCallback((teamId: string) => dispatch({ type: 'ROSTER_TOGGLE_BENCH', teamId }), []);
  const substitutePlayers = useCallback((teamId: string, pIn: string, pOut: string) => dispatch({ type: 'ROSTER_SUBSTITUTE', teamId, playerInId: pIn, playerOutId: pOut }), []);
  const deletePlayer = useCallback((id: string) => dispatch({ type: 'ROSTER_DELETE_PLAYER', playerId: id }), []);
  const reorderQueue = useCallback((from: number, to: number) => dispatch({ type: 'ROSTER_QUEUE_REORDER', fromIndex: from, toIndex: to }), []);
  const disbandTeam = useCallback((id: string) => dispatch({ type: 'ROSTER_DISBAND_TEAM', teamId: id }), []);
  const restoreTeam = useCallback((team: Team, index: number) => dispatch({ type: 'ROSTER_RESTORE_TEAM', team, index }), []);
  const onRestorePlayer = useCallback((p: Player, t: string, i?: number) => dispatch({ type: 'ROSTER_RESTORE_PLAYER', player: p, targetId: t, index: i }), []);
  const resetRosters = useCallback(() => dispatch({ type: 'ROSTER_RESET_ALL' }), []);
  const relinkProfile = useCallback((profile: PlayerProfile) => {
      dispatch({ type: 'ROSTER_SYNC_PROFILES', profiles: new Map([[profile.id, profile]]) });
  }, []);

  const manualRotate = useCallback((teamId: string, direction: 'clockwise' | 'counter') => {
      dispatch({ type: 'MANUAL_ROTATION', teamId, direction });
  }, []);

  const setState = useCallback((action: any) => dispatch(action), []);

  const generateTeams = useCallback((names: string[]) => {
      const validNames = names.filter(n => n.trim().length > 0);
      const allNewPlayers = validNames.map((raw, idx) => {
          const trimmed = raw.trim();
          let name = trimmed;
          let skill = 5;
          let number: string | undefined = undefined;
          
          const matchFull = trimmed.match(/^(\d+)\s+(.+)\s+(10|[1-9])$/);
          const matchSkill = trimmed.match(/^(.+)\s+(10|[1-9])$/);
          const matchNumber = trimmed.match(/^(\d+)\s+(.+)$/);

          if (matchFull) { 
              number = matchFull[1]; 
              name = matchFull[2].trim(); 
              skill = parseInt(matchFull[3], 10); 
          } 
          else if (matchSkill) { 
              name = matchSkill[1].trim(); 
              skill = parseInt(matchSkill[2], 10); 
          }
          else if (matchNumber) {
              number = matchNumber[1];
              name = matchNumber[2].trim();
          }
          
          let foundProfile: PlayerProfile | undefined = undefined;
          if (profilesReady) foundProfile = findProfileByName(name);

          let p: Player;
          if (foundProfile) {
              p = createPlayer(foundProfile.name, idx, foundProfile.id, foundProfile.skillLevel, number || foundProfile.number);
              if (foundProfile.role) p.role = foundProfile.role;
          } else {
              p = createPlayer(name, idx, undefined, skill, number); 
          }
          return p;
      });
      dispatch({ type: 'ROSTER_GENERATE', players: allNewPlayers });
  }, [profilesReady, findProfileByName]);

  const isTieBreak = state.config.hasTieBreak && state.currentSet === state.config.maxSets;
  const target = isTieBreak ? state.config.tieBreakPoints : state.config.pointsPerSet;
  const isDeuce = state.scoreA === state.scoreB && state.scoreA >= target - 1;
  const setsNeededToWin = SETS_TO_WIN_MATCH(state.config.maxSets);
  
  const isMatchPoint = (scoreA: number, scoreB: number, setsA: number, setsB: number) => {
      const isSetPoint = (scoreA >= target - 1 || scoreB >= target - 1) && Math.abs(scoreA - scoreB) >= 1;
      const setsToWin = setsNeededToWin;
      const aCanWin = setsA === setsToWin - 1 && scoreA > scoreB;
      const bCanWin = setsB === setsToWin - 1 && scoreB > scoreA;
      return isSetPoint && (aCanWin || bCanWin);
  };

  const isSetPoint = (scoreA: number, scoreB: number) => {
      return (scoreA >= target - 1 || scoreB >= target - 1) && Math.abs(scoreA - scoreB) >= 1 && !isMatchPoint(scoreA, scoreB, state.setsA, state.setsB);
  };

  return {
      state,
      isLoaded: isLoaded && profilesReady,
      profiles,
      addPoint, subtractPoint, setServer, useTimeout, undo, toggleSides, applySettings, resetMatch,
      generateTeams, togglePlayerFixed, removePlayer, movePlayer, swapPositions, updateTeamName, updateTeamColor, updateTeamLogo, updatePlayer, addPlayer,
      undoRemovePlayer, commitDeletions, rotateTeams, setRotationMode, balanceTeams, savePlayerToProfile, revertPlayerChanges,
      upsertProfile, deleteProfile, sortTeam, toggleTeamBench, substitutePlayers, deletePlayer, reorderQueue, disbandTeam,
      batchUpdateStats, restoreTeam, onRestorePlayer, resetRosters, relinkProfile, setState,
      manualRotate, loadStateFromFile,
      canUndo: state.actionLog.length > 0,
      hasDeletedPlayers: state.deletedPlayerHistory.length > 0,
      deletedCount: state.deletedPlayerHistory.length,
      rotationMode: state.rotationMode,
      isMatchActive: state.scoreA > 0 || state.scoreB > 0 || state.setsA > 0 || state.setsB > 0,
      isMatchPointA: isMatchPoint(state.scoreA, state.scoreB, state.setsA, state.setsB) && state.scoreA > state.scoreB,
      isMatchPointB: isMatchPoint(state.scoreA, state.scoreB, state.setsA, state.setsB) && state.scoreB > state.scoreA,
      isSetPointA: isSetPoint(state.scoreA, state.scoreB) && state.scoreA > state.scoreB,
      isSetPointB: isSetPoint(state.scoreA, state.scoreB) && state.scoreB > state.scoreA,
      isDeuce, isTieBreak, setsNeededToWin
  };
};
