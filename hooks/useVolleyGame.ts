
import { useCallback, useEffect, useReducer, useMemo } from 'react';
import { GameState, TeamId, GameConfig, SkillType, PlayerProfile, TeamColor, RotationMode } from '../types';
import { DEFAULT_CONFIG, SETS_TO_WIN_MATCH } from '../constants';
import { SecureStorage } from '../services/SecureStorage';
import { gameReducer } from '../reducers/gameReducer';
import { usePlayerProfiles } from './usePlayerProfiles';
import { createPlayer } from '../utils/rosterLogic';
import { useTimer } from '../contexts/TimerContext';

const STORAGE_KEY = 'action_log';

const INITIAL_STATE: GameState = {
  teamAName: 'Home',
  teamBName: 'Guest',
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
  teamARoster: { id: 'A', name: 'Home', color: 'indigo', players: [], reserves: [], hasActiveBench: false },
  teamBRoster: { id: 'B', name: 'Guest', color: 'rose', players: [], reserves: [], hasActiveBench: false },
  queue: [], 
  rotationReport: null,
  deletedPlayerHistory: [],
  rotationMode: 'standard'
};

export const useVolleyGame = () => {
  const [state, dispatch] = useReducer(gameReducer, INITIAL_STATE);
  const { profiles, upsertProfile, deleteProfile, isReady: profilesReady } = usePlayerProfiles();
  const { setSeconds, start: startTimer, stop: stopTimer, reset: resetTimer, getTime } = useTimer();

  // --- PERSISTENCE: Load ---
  useEffect(() => {
    const loadGame = async () => {
      try {
        const savedState = await SecureStorage.load<GameState>(STORAGE_KEY);
        
        if (savedState) { 
          // Schema Migration & Defaults
          if(!savedState.config) savedState.config = DEFAULT_CONFIG;
          else {
               if (savedState.config.mode === undefined) savedState.config.mode = 'indoor';
               if (savedState.config.enablePlayerStats === undefined) savedState.config.enablePlayerStats = false;
               if (savedState.config.enableSound === undefined) savedState.config.enableSound = true;
               if (savedState.config.lowGraphics === undefined) savedState.config.lowGraphics = false;
               if (savedState.config.announceScore === undefined) savedState.config.announceScore = false;
          }

          if(!Array.isArray(savedState.queue)) savedState.queue = [];
          if(!savedState.actionLog) savedState.actionLog = [];
          if(!savedState.matchLog) savedState.matchLog = [...savedState.actionLog];
          if(!savedState.deletedPlayerHistory) savedState.deletedPlayerHistory = [];
          if(!savedState.rotationMode) savedState.rotationMode = 'standard';
          
          if (savedState.teamARoster && !savedState.teamARoster.color) savedState.teamARoster.color = 'indigo';
          if (savedState.teamBRoster && !savedState.teamBRoster.color) savedState.teamBRoster.color = 'rose';
          
          if (savedState.teamARoster && savedState.teamARoster.hasActiveBench === undefined) savedState.teamARoster.hasActiveBench = false;
          if (savedState.teamBRoster && savedState.teamBRoster.hasActiveBench === undefined) savedState.teamBRoster.hasActiveBench = false;
          
          // Cleanup legacy actions
          savedState.actionLog = savedState.actionLog.filter((action: any) => action.type !== 'TOGGLE_SERVE');
          savedState.matchLog = savedState.matchLog.filter((action: any) => action.type !== 'TOGGLE_SERVE');
          
          if ((savedState as any).lastSnapshot) delete (savedState as any).lastSnapshot;

          // INIT TIMER
          setSeconds(savedState.matchDurationSeconds || 0);
          if (savedState.isTimerRunning && !savedState.isMatchOver) {
              startTimer();
          }

          dispatch({ type: 'LOAD_STATE', payload: savedState });
        }
      } catch (e) {
        console.error("Failed to load game state.", e);
      }
    };
    loadGame();
  }, [setSeconds, startTimer]);

  // --- PERSISTENCE: Save (Sync Timer) ---
  useEffect(() => {
    const { lastSnapshot, ...stateToSave } = state;
    // INJECT CURRENT TIMER VALUE FOR STORAGE
    stateToSave.matchDurationSeconds = getTime();
    SecureStorage.save(STORAGE_KEY, stateToSave);
  }, [state, getTime]);

  // --- TIMER CONTROL ---
  // Sync Timer Context with Game State Logic
  useEffect(() => {
      if (state.isMatchOver) {
          stopTimer();
      } else if (state.isTimerRunning) {
          startTimer();
      } else {
          stopTimer();
      }
  }, [state.isTimerRunning, state.isMatchOver, startTimer, stopTimer]);

  // --- PROFILE SYNC ---
  useEffect(() => {
      if (profilesReady) {
          dispatch({ type: 'ROSTER_SYNC_PROFILES', profiles });
      }
  }, [profiles, profilesReady]);

  // --- ACTIONS ---
  
  const addPoint = useCallback((team: TeamId, metadata?: { playerId: string, skill: SkillType }) => {
      dispatch({ type: 'POINT', team, metadata });
  }, []);

  const subtractPoint = useCallback((team: TeamId) => {
      dispatch({ type: 'SUBTRACT_POINT', team });
  }, []);
  
  const useTimeout = useCallback((team: TeamId) => {
      dispatch({ type: 'TIMEOUT', team });
  }, []);

  const undo = useCallback(() => { 
      dispatch({ type: 'UNDO' });
  }, []); 

  const resetMatch = useCallback(() => {
      resetTimer(); // Reset timer context immediately
      dispatch({ type: 'RESET_MATCH' });
  }, [resetTimer]);

  const toggleSides = useCallback(() => dispatch({ type: 'TOGGLE_SIDES' }), []);
  const setServer = useCallback((team: TeamId) => dispatch({ type: 'SET_SERVER', team }), []);
  
  const applySettings = useCallback((newConfig: GameConfig, shouldReset: boolean = false) => {
      if(shouldReset) resetTimer();
      dispatch({ type: 'APPLY_SETTINGS', config: newConfig, shouldReset });
  }, [resetTimer]);

  const rotateTeams = useCallback(() => {
    dispatch({ type: 'ROTATE_TEAMS' });
  }, []);

  // --- ROSTER ACTIONS ---
  const updateTeamName = useCallback((teamId: string, name: string) => dispatch({ type: 'ROSTER_UPDATE_TEAM_NAME', teamId, name }), []);
  const updateTeamColor = useCallback((teamId: string, color: TeamColor) => dispatch({ type: 'ROSTER_UPDATE_TEAM_COLOR', teamId, color }), []);
  const updatePlayerName = useCallback((id: string, name: string) => dispatch({ type: 'ROSTER_UPDATE_PLAYER', playerId: id, updates: { name } }), []);
  const updatePlayerNumber = useCallback((id: string, number: string) => dispatch({ type: 'ROSTER_UPDATE_PLAYER', playerId: id, updates: { number } }), []);
  const updatePlayerSkill = useCallback((id: string, skillLevel: number) => dispatch({ type: 'ROSTER_UPDATE_PLAYER', playerId: id, updates: { skillLevel } }), []);
  const togglePlayerFixed = useCallback((id: string) => dispatch({ type: 'ROSTER_TOGGLE_FIXED', playerId: id }), []);
  const toggleTeamBench = useCallback((teamId: string) => dispatch({ type: 'ROSTER_TOGGLE_BENCH', teamId }), []);
  
  const addPlayer = useCallback((name: string, target: string, number?: string, skill?: number) => {
      const p = createPlayer(name, 0, undefined, skill, number);
      // Try to find matching profile
      if (profilesReady) {
          for (const profile of profiles.values()) {
              if (profile.name.toLowerCase() === name.trim().toLowerCase()) {
                  p.profileId = profile.id;
                  p.skillLevel = profile.skillLevel;
                  // FIX: Copy number from profile if not explicitly provided
                  if (profile.number && !number) {
                      p.number = profile.number;
                  }
                  break;
              }
          }
      }
      dispatch({ type: 'ROSTER_ADD_PLAYER', player: p, targetId: target });
  }, [profiles, profilesReady]);

  const removePlayer = useCallback((id: string) => dispatch({ type: 'ROSTER_REMOVE_PLAYER', playerId: id }), []);
  const deletePlayer = useCallback((id: string) => dispatch({ type: 'ROSTER_DELETE_PLAYER', playerId: id }), []);
  const undoRemovePlayer = useCallback(() => dispatch({ type: 'ROSTER_UNDO_REMOVE' }), []);
  const commitDeletions = useCallback(() => dispatch({ type: 'ROSTER_COMMIT_DELETIONS' }), []);
  const movePlayer = useCallback((playerId: string, fromId: string, toId: string, newIndex?: number) => 
      dispatch({ type: 'ROSTER_MOVE_PLAYER', playerId, fromId, toId, newIndex }), []);
  
  const setRotationMode = useCallback((mode: RotationMode) => dispatch({ type: 'ROSTER_SET_MODE', mode }), []);
  const balanceTeams = useCallback(() => dispatch({ type: 'ROSTER_BALANCE' }), []);
  const generateTeams = useCallback((names: string[]) => dispatch({ type: 'ROSTER_GENERATE', names }), []);
  const substitutePlayers = useCallback((teamId: string, pIn: string, pOut: string) => dispatch({ type: 'ROSTER_SUBSTITUTE', teamId, playerInId: pIn, playerOutId: pOut }), []);
  const sortTeam = useCallback((teamId: string, criteria: 'name' | 'number' | 'skill') => dispatch({ type: 'ROSTER_SORT', teamId, criteria }), []); 

  const reorderQueue = useCallback((fromIndex: number, toIndex: number) => {
      dispatch({ type: 'ROSTER_QUEUE_REORDER', fromIndex, toIndex });
  }, []);

  const disbandTeam = useCallback((teamId: string) => {
      dispatch({ type: 'ROSTER_DISBAND_TEAM', teamId });
  }, []);

  // Profile Helpers
  const savePlayerToProfile = useCallback((playerId: string, overrides?: { name?: string, number?: string, avatar?: string, skill?: number }) => {
      let p;
      const all = [...state.teamARoster.players, ...state.teamBRoster.players, ...state.queue.flatMap(t => t.players)];
      p = all.find(x => x.id === playerId);
      
      if(p) {
          const nameToUse = overrides?.name || p.name;
          const numberToUse = overrides?.number !== undefined ? overrides.number : p.number;
          // Allow overriding skill level, otherwise use current player skill
          const skillToUse = overrides?.skill !== undefined ? overrides.skill : p.skillLevel;
          const extras = { number: numberToUse, avatar: overrides?.avatar };
          
          const profile = upsertProfile(nameToUse, skillToUse, p.profileId, extras);
          
          // Ensure the player instance is updated with the profile ID AND the latest data
          dispatch({ 
              type: 'ROSTER_UPDATE_PLAYER', 
              playerId, 
              updates: { 
                  profileId: profile.id,
                  name: profile.name,
                  number: profile.number,
                  skillLevel: profile.skillLevel 
              } 
          });
      }
  }, [state, upsertProfile]);

  const revertPlayerChanges = useCallback((playerId: string) => {
      let p;
      const all = [...state.teamARoster.players, ...state.teamBRoster.players, ...state.queue.flatMap(t => t.players)];
      p = all.find(x => x.id === playerId);
      if(p && p.profileId) {
          const prof = profiles.get(p.profileId);
          if(prof) {
              dispatch({ type: 'ROSTER_UPDATE_PLAYER', playerId, updates: { name: prof.name, skillLevel: prof.skillLevel, number: prof.number } });
          }
      }
  }, [state, profiles]);

  // Derived Values
  const isTieBreak = state.config.hasTieBreak && state.currentSet === state.config.maxSets;
  const pointsToWinCurrentSet = isTieBreak ? state.config.tieBreakPoints : state.config.pointsPerSet;
  const setsNeededToWin = SETS_TO_WIN_MATCH(state.config.maxSets);
  
  const getGameStatus = (scoreMy: number, scoreOpponent: number, setsMy: number) => {
      const isSetPoint = scoreMy >= pointsToWinCurrentSet - 1 && scoreMy > scoreOpponent;
      const isMatchPoint = isSetPoint && (setsMy === setsNeededToWin - 1);
      return { isSetPoint, isMatchPoint };
  };

  const statusA = getGameStatus(state.scoreA, state.scoreB, state.setsA);
  const statusB = getGameStatus(state.scoreB, state.scoreA, state.setsB);
  const isDeuce = state.scoreA === state.scoreB && state.scoreA >= pointsToWinCurrentSet - 1;
  const isMatchActive = state.scoreA > 0 || state.scoreB > 0 || state.setsA > 0 || state.setsB > 0 || state.currentSet > 1;

  const setStateWrapper = useCallback((action: any) => dispatch(action), []);

  return useMemo(() => ({
    state,
    setState: setStateWrapper,
    isLoaded: true,
    addPoint, subtractPoint, undo, resetMatch, toggleSides, setServer, useTimeout, applySettings, 
    canUndo: state.actionLog.length > 0 || !!state.lastSnapshot, 
    isMatchActive,
    
    // Roster API (Mapped to dispatch)
    generateTeams,
    rotateTeams,
    updateTeamName,
    updateTeamColor,
    updatePlayerName,
    updatePlayerNumber,
    updatePlayerSkill,
    movePlayer,
    removePlayer,
    deletePlayer,
    addPlayer,
    undoRemovePlayer,
    hasDeletedPlayers: state.deletedPlayerHistory.length > 0,
    togglePlayerFixed,
    commitDeletions,
    deletedCount: state.deletedPlayerHistory.length,
    setRotationMode,
    balanceTeams,
    sortTeam,
    savePlayerToProfile,
    revertPlayerChanges,
    deleteProfile,
    upsertProfile,
    toggleTeamBench,
    substitutePlayers,
    reorderQueue,
    disbandTeam,
    rotationMode: state.rotationMode,
    profiles,

    isTieBreak,
    isMatchPointA: statusA.isMatchPoint,
    isSetPointA: statusA.isSetPoint,
    isMatchPointB: statusB.isMatchPoint,
    isSetPointB: statusB.isSetPoint,
    pointsToWinCurrentSet,
    setsNeededToWin,
    isDeuce
  }), [
    state, addPoint, subtractPoint, undo, resetMatch, toggleSides, setServer, useTimeout, applySettings, isMatchActive, rotateTeams, 
    isTieBreak, statusA, statusB, pointsToWinCurrentSet, setsNeededToWin, isDeuce,
    generateTeams, updateTeamName, updateTeamColor, updatePlayerName, updatePlayerNumber, updatePlayerSkill, movePlayer, removePlayer,
    deletePlayer, addPlayer, undoRemovePlayer, togglePlayerFixed, commitDeletions, setRotationMode, balanceTeams, sortTeam,
    savePlayerToProfile, revertPlayerChanges, deleteProfile, upsertProfile, toggleTeamBench, substitutePlayers, profiles, reorderQueue, disbandTeam
  ]);
};
