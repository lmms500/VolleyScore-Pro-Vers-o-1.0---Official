
import React, { useState, useEffect, lazy, Suspense, useCallback, useRef } from 'react';
import { GameProvider, useGame } from './contexts/GameContext';
import { usePWAInstallPrompt } from './hooks/usePWAInstallPrompt';
import { useTutorial } from './hooks/useTutorial';
import { useNativeIntegration } from './hooks/useNativeIntegration';
import { usePlatform } from './hooks/usePlatform';
import { useVoiceControl } from './hooks/useVoiceControl';
// EAGER IMPORTS
import { ScoreCardNormal } from './components/ScoreCardNormal';
import { ScoreCardFullscreen } from './components/ScoreCardFullscreen';
import { HistoryBar } from './components/HistoryBar';
import { Controls } from './components/Controls';
import { MeasuredFullscreenHUD } from './components/MeasuredFullscreenHUD';
import { FloatingControlBar } from './components/Fullscreen/FloatingControlBar';
import { FloatingTopBar } from './components/Fullscreen/FloatingTopBar';
import { FullscreenMenuDrawer } from './components/Fullscreen/FullscreenMenuDrawer';
import { LayoutProvider } from './contexts/LayoutContext';
import { ErrorBoundary } from './components/ui/ErrorBoundary';
import { SuddenDeathOverlay } from './components/ui/CriticalPointAnimation';
import { BackgroundGlow } from './components/ui/BackgroundGlow';
import { ReloadPrompt } from './components/ui/ReloadPrompt';
import { InstallReminder } from './components/ui/InstallReminder';
import { NotificationToast } from './components/ui/NotificationToast';
import { useTranslation } from './contexts/LanguageContext';
import { useHudMeasure } from './hooks/useHudMeasure';
import { useHistoryStore, Match } from './stores/historyStore';
import { useGameAudio } from './hooks/useGameAudio';
import { useHaptics } from './hooks/useHaptics';
import { useScoreAnnouncer } from './hooks/useScoreAnnouncer';
import { TeamId, SkillType, TeamColor } from './types';
import { Minimize2 } from 'lucide-react';
import { TimerProvider } from './contexts/TimerContext';
import { AuthProvider } from './contexts/AuthContext'; 
import { v4 as uuidv4 } from 'uuid';
import { LayoutGroup } from 'framer-motion';
import { GlobalLoader } from './components/ui/GlobalLoader';
import { useSensoryFX } from './hooks/useSensoryFX';
import { setGlobalReducedMotion } from './utils/animations';
import { calculateMatchDeltas } from './utils/statsEngine';

// LAZY LOADED CHUNKS
const SettingsModal = lazy(() => import('./components/modals/SettingsModal').then(module => ({ default: module.SettingsModal })));
const TeamManagerModal = lazy(() => import('./components/modals/TeamManagerModal').then(module => ({ default: module.TeamManagerModal })));
const MatchOverModal = lazy(() => import('./components/modals/MatchOverModal').then(module => ({ default: module.MatchOverModal })));
const ConfirmationModal = lazy(() => import('./components/modals/ConfirmationModal').then(module => ({ default: module.ConfirmationModal })));
const HistoryModal = lazy(() => import('./components/modals/HistoryModal').then(module => ({ default: module.HistoryModal })));
const TutorialModal = lazy(() => import('./components/modals/TutorialModal').then(module => ({ default: module.TutorialModal })));

// Inner component to consume Context
const GameContent = () => {
  const game = useGame();
  const { 
    state, addPoint, subtractPoint, setServer, useTimeout, undo, toggleSides, applySettings, 
    resetMatch, generateTeams, togglePlayerFixed, removePlayer, movePlayer, updateTeamName, updateTeamColor,
    updatePlayerName, updatePlayerNumber, updatePlayerSkill, addPlayer, undoRemovePlayer, commitDeletions, 
    rotateTeams, setRotationMode, balanceTeams, savePlayerToProfile, revertPlayerChanges, upsertProfile, 
    deleteProfile, sortTeam, toggleTeamBench, substitutePlayers, deletePlayer, reorderQueue, disbandTeam,
    batchUpdateStats, profiles
  } = game;

  const { t, language } = useTranslation();
  const historyStore = useHistoryStore();
  const { isNative } = usePlatform();
  
  const pwa = usePWAInstallPrompt();
  const tutorial = useTutorial(pwa.isStandalone || isNative);
  
  const [showSettings, setShowSettings] = useState(false);
  const [showManager, setShowManager] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [showFullscreenMenu, setShowFullscreenMenu] = useState(false);
  
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [interactingTeam, setInteractingTeam] = useState<TeamId | null>(null);

  const [scoreElA, setScoreElA] = useState<HTMLElement | null>(null);
  const [scoreElB, setScoreElB] = useState<HTMLElement | null>(null);

  const [notificationState, setNotificationState] = useState<{ 
      visible: boolean;
      type: 'success' | 'error' | 'info';
      mainText: string;
      subText?: string;
      skill?: SkillType;
      color?: TeamColor;
      systemIcon?: 'transfer' | 'save' | 'mic' | 'alert' | 'block' | 'undo' | 'delete' | 'add' | 'roster';
  }>({
      visible: false, type: 'success', mainText: '', color: 'slate'
  });

  const savedMatchIdRef = useRef<string | null>(null);
  const audio = useGameAudio(state.config);
  const haptics = useHaptics(true);

  // --- SENSORY ORCHESTRATION ---
  useSensoryFX(state);

  // --- SYNC REDUCED MOTION ---
  useEffect(() => {
    setGlobalReducedMotion(state.config.reducedMotion);
  }, [state.config.reducedMotion]);

  // --- MATCH SAVING LOGIC & PROFILE SYNC ---
  useEffect(() => {
    if (state.isMatchOver && state.matchWinner && !savedMatchIdRef.current) {
        if (state.history.length === 0 && state.scoreA === 0 && state.scoreB === 0) return;

        const newMatchId = uuidv4();
        savedMatchIdRef.current = newMatchId;

        const matchData: Match = {
            id: newMatchId,
            date: new Date().toISOString(),
            timestamp: Date.now(),
            durationSeconds: state.matchDurationSeconds,
            teamAName: state.teamAName,
            teamBName: state.teamBName,
            setsA: state.setsA,
            setsB: state.setsB,
            winner: state.matchWinner,
            sets: state.history,
            actionLog: state.matchLog,
            config: state.config,
            teamARoster: state.teamARoster,
            teamBRoster: state.teamBRoster
        };
        
        // 1. Persist to History Store
        historyStore.addMatch(matchData);

        // 2. Sync Profile Stats (Data Integrity)
        if (state.matchLog.length > 0) {
            // Helper to map RosterID -> ProfileID
            // We iterate both rosters to build a map of who played
            const rosterToProfileMap = new Map<string, string>();
            const playerTeamMap = new Map<string, TeamId>(); // Key is PROFILE ID

            const mapPlayer = (p: any, tid: TeamId) => {
                if (p.profileId) {
                    rosterToProfileMap.set(p.id, p.profileId);
                    playerTeamMap.set(p.profileId, tid);
                }
            };

            state.teamARoster.players.forEach(p => mapPlayer(p, 'A'));
            state.teamARoster.reserves?.forEach(p => mapPlayer(p, 'A'));
            state.teamBRoster.players.forEach(p => mapPlayer(p, 'B'));
            state.teamBRoster.reserves?.forEach(p => mapPlayer(p, 'B'));

            // Calculate Deltas based on MATCH LOG (which uses RosterIDs)
            // But we need to attribute them to ProfileIDs
            // The `calculateMatchDeltas` function logic will need a slight adjustment or we pre-process the log.
            // Actually, we can just process the log here locally or map it.
            
            // Let's use the statsEngine but we need to map the log IDs first
            const mappedLog = state.matchLog.map(log => {
                if (log.type === 'POINT' && log.playerId) {
                    return { ...log, playerId: rosterToProfileMap.get(log.playerId) || log.playerId };
                }
                return log;
            });

            const deltas = calculateMatchDeltas(mappedLog, state.matchWinner, playerTeamMap);
            batchUpdateStats(deltas);
            
            setNotificationState({
                visible: true,
                type: 'success',
                mainText: t('notifications.matchSaved'),
                subText: t('notifications.profileSynced'),
                systemIcon: 'save'
            });
        } else {
            setNotificationState({
                visible: true,
                type: 'success',
                mainText: t('notifications.matchSaved'),
                subText: t('notifications.matchSavedSub'),
                systemIcon: 'save'
            });
        }

    } else if (!state.isMatchOver && savedMatchIdRef.current) {
        savedMatchIdRef.current = null;
    }
  }, [state.isMatchOver, state.matchWinner, historyStore, t, batchUpdateStats, state.matchLog, state.teamARoster, state.teamBRoster]);

  // --- SCORE ANNOUNCER ---
  useScoreAnnouncer({ state, enabled: state.config.announceScore });

  const isAnyModalOpen = showSettings || showManager || showHistory || showResetConfirm || showFullscreenMenu || state.isMatchOver || tutorial.showTutorial;
  
  const handleNativeBack = useCallback(() => {
      if (showFullscreenMenu) setShowFullscreenMenu(false);
      else if (showSettings) setShowSettings(false);
      else if (showManager) setShowManager(false);
      else if (showHistory) setShowHistory(false);
      else if (showResetConfirm) setShowResetConfirm(false);
  }, [showFullscreenMenu, showSettings, showManager, showHistory, showResetConfirm]);

  useNativeIntegration(game.isMatchActive, isFullscreen, handleNativeBack, isAnyModalOpen);

  // --- ACTIONS WRAPPERS ---
  
  const handleAddA = useCallback((teamId: TeamId, playerId?: string, skill?: any) => {
    const metadata = playerId ? { playerId, skill: skill as SkillType } : undefined;
    // Note: Point sound is handled by useSensoryFX when state updates
    audio.playTap(); // Immediate feedback
    addPoint('A', metadata);
  }, [addPoint, audio]);

  const handleSubA = useCallback(() => {
    audio.playUndo();
    haptics.impact('heavy');
    subtractPoint('A');
  }, [subtractPoint, audio, haptics]);

  const handleAddB = useCallback((teamId: TeamId, playerId?: string, skill?: any) => {
    const metadata = playerId ? { playerId, skill: skill as SkillType } : undefined;
    audio.playTap();
    addPoint('B', metadata);
  }, [addPoint, audio]);
  
  const handleSubB = useCallback(() => {
    audio.playUndo();
    haptics.impact('heavy');
    subtractPoint('B');
  }, [subtractPoint, audio, haptics]);

  const handleSetServerA = useCallback(() => setServer('A'), [setServer]);
  const handleSetServerB = useCallback(() => setServer('B'), [setServer]);
  const handleTimeoutA = useCallback(() => useTimeout('A'), [useTimeout]);
  const handleTimeoutB = useCallback(() => useTimeout('B'), [useTimeout]);

  const handleUndo = useCallback(() => {
    if (state.isMatchOver && savedMatchIdRef.current) {
        historyStore.deleteMatch(savedMatchIdRef.current);
        savedMatchIdRef.current = null;
    }
    undo();
    audio.playUndo();
    haptics.impact('medium');
    setNotificationState({
        visible: true,
        type: 'info',
        mainText: t('notifications.actionUndone'),
        subText: t('notifications.actionUndoneSub'),
        systemIcon: 'undo'
    });
  }, [state.isMatchOver, undo, historyStore, audio, haptics, t]);

  const handleToggleSides = useCallback(() => {
      toggleSides();
      setNotificationState({
          visible: true,
          type: 'info',
          mainText: t('notifications.sidesSwapped'),
          subText: t('notifications.sidesSwappedSub'),
          systemIcon: 'transfer'
      });
  }, [toggleSides, t]);

  // --- VOICE CONTROL ---
  const handleVoiceAddPoint = useCallback((team: TeamId, playerId?: string, skill?: SkillType) => {
      const metadata = playerId ? { playerId, skill } : undefined;
      
      if (team === 'A') addPoint('A', metadata);
      else addPoint('B', metadata);
      
      audio.playTap();
      
      const players = team === 'A' ? state.teamARoster.players : state.teamBRoster.players;
      let displayName = team === 'A' ? state.teamAName : state.teamBName;
      let subInfo = t('notifications.forTeam', { teamName: team === 'A' ? state.teamAName : state.teamBName });

      if (playerId) {
          if (playerId === 'unknown') {
              displayName = t('scout.unknownPlayer');
          } else {
              const player = players.find(p => p.id === playerId);
              if (player) displayName = player.name;
          }
      }
      
      const color = team === 'A' ? (state.teamARoster.color || 'indigo') : (state.teamBRoster.color || 'rose');
      
      setNotificationState({
          visible: true, 
          type: 'success', 
          mainText: displayName, 
          subText: subInfo, 
          skill, 
          color
      });
  }, [addPoint, state.teamARoster, state.teamBRoster, state.teamAName, state.teamBName, audio, t]);

  const handleVoiceSubtract = useCallback((team: TeamId) => {
      if (team === 'A') handleSubA(); else handleSubB();
      setNotificationState({ visible: true, type: 'info', mainText: t('notifications.pointRemoved'), subText: t('notifications.pointRemovedSub'), systemIcon: 'undo' });
  }, [handleSubA, handleSubB, t]);

  const handleVoiceTimeout = useCallback((team: TeamId) => {
      useTimeout(team);
      const teamName = team === 'A' ? state.teamAName : state.teamBName;
      setNotificationState({ visible: true, type: 'info', mainText: t('notifications.timeoutCalled'), subText: t('notifications.timeoutCalledSub', { teamName }), systemIcon: 'alert' });
  }, [useTimeout, state.teamAName, state.teamBName, t]);

  const handleVoiceSetServer = useCallback((team: TeamId) => {
      setServer(team);
      audio.playTap();
      const teamName = team === 'A' ? state.teamAName : state.teamBName;
      setNotificationState({ visible: true, type: 'info', mainText: t('notifications.serveChange'), subText: t('notifications.serveChangeSub', { teamName }), systemIcon: 'transfer' });
  }, [setServer, state.teamAName, state.teamBName, audio, t]);

  const handleVoiceError = useCallback((errorType: 'permission' | 'network' | 'generic', transcript?: string) => {
      let msg = t('notifications.micError');
      if (errorType === 'permission') msg = t('notifications.accessDenied');
      if (errorType === 'network') msg = t('notifications.networkError');
      haptics.notification('error');
      setNotificationState({ visible: true, type: 'error', mainText: transcript || msg, systemIcon: 'block' });
  }, [haptics, t]);

  const handleVoiceUnknown = useCallback((text: string) => {
      haptics.impact('light'); 
      setNotificationState({ visible: true, type: 'error', mainText: text, subText: t('notifications.notUnderstood'), systemIcon: 'alert' });
  }, [haptics, t]);

  const { isListening, toggleListening, isProcessingAI } = useVoiceControl({
      enabled: state.config.voiceControlEnabled,
      enablePlayerStats: state.config.enablePlayerStats, 
      onAddPoint: handleVoiceAddPoint,
      onSubtractPoint: handleVoiceSubtract,
      onUndo: handleUndo,
      onTimeout: handleVoiceTimeout,
      onSetServer: handleVoiceSetServer,
      onError: handleVoiceError,
      onUnknownCommand: handleVoiceUnknown,
      language: language,
      teamAName: state.teamAName,
      teamBName: state.teamBName,
      playersA: state.teamARoster.players,
      playersB: state.teamBRoster.players,
      servingTeam: state.servingTeam
  });

  useEffect(() => {
      if (isProcessingAI) {
          setNotificationState({ visible: true, type: 'info', mainText: t('notifications.thinking'), subText: t('notifications.aiProcessing'), systemIcon: 'mic' });
      } else {
          setNotificationState(prev => prev.mainText === t('notifications.thinking') ? { ...prev, visible: false } : prev);
      }
  }, [isProcessingAI, t]);

  const hudPlacement = useHudMeasure({
      leftScoreEl: scoreElA,
      rightScoreEl: scoreElB,
      enabled: isFullscreen && !state.config.voiceControlEnabled,
      maxSets: state.config.maxSets
  });

  const handleToggleFullscreen = () => {
      setIsFullscreen(!isFullscreen);
      haptics.impact('light');
  };

  const handleInteractionStart = (team: TeamId) => setInteractingTeam(team);
  const handleInteractionEnd = () => setInteractingTeam(null);

  // Define ScoreCards with Keys to enable physical DOM swapping
  const cardA = (
      <ScoreCardNormal 
          key="card-A"
          teamId="A" team={state.teamARoster} score={state.scoreA} setsWon={state.setsA}
          isServing={state.servingTeam === 'A'}
          onAdd={handleAddA} onSubtract={handleSubA}
          onSetServer={handleSetServerA}
          timeouts={state.timeoutsA} onTimeout={handleTimeoutA}
          isMatchPoint={game.isMatchPointA} isSetPoint={game.isSetPointA}
          isDeuce={game.isDeuce} inSuddenDeath={state.inSuddenDeath}
          setsNeededToWin={game.setsNeededToWin}
          colorTheme={state.teamARoster.color} config={state.config}
      />
  );

  const cardB = (
      <ScoreCardNormal 
          key="card-B"
          teamId="B" team={state.teamBRoster} score={state.scoreB} setsWon={state.setsB}
          isServing={state.servingTeam === 'B'}
          onAdd={handleAddB} onSubtract={handleSubB}
          onSetServer={handleSetServerB}
          timeouts={state.timeoutsB} onTimeout={handleTimeoutB}
          isMatchPoint={game.isMatchPointB} isSetPoint={game.isSetPointB}
          isDeuce={game.isDeuce} inSuddenDeath={state.inSuddenDeath}
          setsNeededToWin={game.setsNeededToWin}
          colorTheme={state.teamBRoster.color} config={state.config}
      />
  );

  const normalCards = state.swappedSides ? [cardB, cardA] : [cardA, cardB];
  const containerLayoutClass = "flex-col landscape:flex-row";

  return (
    <div className="relative w-full h-[100dvh] bg-slate-50 dark:bg-[#020617] overflow-hidden select-none touch-none">
        
        <BackgroundGlow 
            isSwapped={state.swappedSides} 
            isFullscreen={isFullscreen} 
            colorA={state.teamARoster.color} 
            colorB={state.teamBRoster.color}
            lowPowerMode={state.config.lowGraphics}
        />
        
        <SuddenDeathOverlay active={state.inSuddenDeath} />
        
        {isFullscreen && (
            <>
                <MeasuredFullscreenHUD 
                    placement={hudPlacement} 
                    setsLeft={state.swappedSides ? state.setsB : state.setsA} 
                    setsRight={state.swappedSides ? state.setsA : state.setsB} 
                    colorLeft={state.swappedSides ? state.teamBRoster.color : state.teamARoster.color || 'indigo'} 
                    colorRight={state.swappedSides ? state.teamARoster.color : state.teamBRoster.color || 'rose'}
                />

                <FloatingTopBar 
                    currentSet={state.currentSet}
                    isTieBreak={game.isTieBreak}
                    onToggleTimer={() => game.setState({ type: 'TOGGLE_TIMER' })}
                    onResetTimer={() => game.setState({ type: 'RESET_TIMER' })}
                    isTimerRunning={state.isTimerRunning}
                    teamNameA={state.teamAName}
                    teamNameB={state.teamBName}
                    colorA={state.teamARoster.color || 'indigo'}
                    colorB={state.teamBRoster.color || 'rose'}
                    isServingLeft={state.servingTeam === (state.swappedSides ? 'B' : 'A')}
                    isServingRight={state.servingTeam === (state.swappedSides ? 'A' : 'B')}
                    onSetServerA={handleSetServerA}
                    onSetServerB={handleSetServerB}
                    timeoutsA={state.timeoutsA}
                    timeoutsB={state.timeoutsB}
                    onTimeoutA={handleTimeoutA}
                    onTimeoutB={handleTimeoutB}
                    isMatchPointA={game.isMatchPointA}
                    isSetPointA={game.isSetPointA}
                    isMatchPointB={game.isMatchPointB}
                    isSetPointB={game.isSetPointB}
                    isDeuce={game.isDeuce}
                    inSuddenDeath={state.inSuddenDeath}
                    reverseLayout={state.swappedSides}
                />

                <FloatingControlBar 
                    onUndo={handleUndo}
                    canUndo={game.canUndo}
                    onSwap={handleToggleSides}
                    onReset={() => setShowResetConfirm(true)}
                    onMenu={() => setShowFullscreenMenu(true)}
                    voiceEnabled={state.config.voiceControlEnabled}
                    isListening={isListening}
                    onToggleListening={toggleListening}
                />

                <button
                    onClick={() => setIsFullscreen(false)}
                    className="absolute top-4 right-4 z-[60] p-2 rounded-full bg-black/20 dark:bg-white/10 hover:bg-black/40 dark:hover:bg-white/20 backdrop-blur-md text-slate-300 dark:text-slate-400 hover:text-white transition-all active:scale-95 border border-white/5"
                >
                    <Minimize2 size={18} strokeWidth={2} />
                </button>
            </>
        )}

        <FullscreenMenuDrawer 
            isOpen={showFullscreenMenu}
            onClose={() => setShowFullscreenMenu(false)}
            onOpenSettings={() => setShowSettings(true)}
            onOpenRoster={() => setShowManager(true)}
            onOpenHistory={() => setShowHistory(true)}
            onExitFullscreen={() => setIsFullscreen(false)}
        />

        <div className={`relative w-full h-full flex flex-col ${isFullscreen ? 'p-0' : 'p-2 sm:p-4'}`}>
            
            {!isFullscreen && (
                <HistoryBar 
                    history={state.history} 
                    setsA={state.setsA} 
                    setsB={state.setsB} 
                    colorA={state.teamARoster.color || 'indigo'}
                    colorB={state.teamBRoster.color || 'rose'}
                />
            )}
            
            <LayoutGroup>
                <div className={`flex-1 flex ${containerLayoutClass} gap-2 sm:gap-4 min-h-0 my-2 sm:my-4 justify-between`}>
                    
                    {isFullscreen ? (
                        <>
                            <ScoreCardFullscreen 
                                teamId="A" team={state.teamARoster} score={state.scoreA}
                                onAdd={handleAddA} onSubtract={handleSubA}
                                isMatchPoint={game.isMatchPointA} isSetPoint={game.isSetPointA}
                                isDeuce={game.isDeuce} inSuddenDeath={state.inSuddenDeath}
                                colorTheme={state.teamARoster.color}
                                isLocked={interactingTeam === 'B'}
                                onInteractionStart={() => handleInteractionStart('A')}
                                onInteractionEnd={handleInteractionEnd}
                                reverseLayout={state.swappedSides}
                                scoreRefCallback={setScoreElA}
                                isServing={state.servingTeam === 'A'}
                                config={state.config}
                            />
                            <ScoreCardFullscreen 
                                teamId="B" team={state.teamBRoster} score={state.scoreB}
                                onAdd={handleAddB} onSubtract={handleSubB}
                                isMatchPoint={game.isMatchPointB} isSetPoint={game.isSetPointB}
                                isDeuce={game.isDeuce} inSuddenDeath={state.inSuddenDeath}
                                colorTheme={state.teamBRoster.color}
                                isLocked={interactingTeam === 'A'}
                                onInteractionStart={() => handleInteractionStart('B')}
                                onInteractionEnd={handleInteractionEnd}
                                reverseLayout={state.swappedSides}
                                scoreRefCallback={setScoreElB}
                                isServing={state.servingTeam === 'B'}
                                config={state.config}
                            />
                        </>
                    ) : (
                        normalCards
                    )}
                </div>
            </LayoutGroup>
            
            {!isFullscreen && (
                <Controls 
                    onUndo={handleUndo} canUndo={game.canUndo}
                    onSwap={handleToggleSides} onSettings={() => setShowSettings(true)}
                    onRoster={() => setShowManager(true)} onHistory={() => setShowHistory(true)}
                    onReset={() => setShowResetConfirm(true)} onToggleFullscreen={handleToggleFullscreen}
                    voiceEnabled={state.config.voiceControlEnabled} isListening={isListening} onToggleListening={toggleListening}
                />
            )}
        </div>

        <Suspense fallback={<GlobalLoader />}>
            <SettingsModal 
                isOpen={showSettings} onClose={() => setShowSettings(false)} 
                config={state.config} isMatchActive={game.isMatchActive}
                onSave={(newConfig, reset) => { applySettings(newConfig, reset); setShowSettings(false); }}
            />

            <TeamManagerModal 
                isOpen={showManager} onClose={() => setShowManager(false)}
                courtA={state.teamARoster} courtB={state.teamBRoster} queue={state.queue}
                onGenerate={generateTeams}
                onUpdateTeamName={updateTeamName} onUpdateTeamColor={updateTeamColor}
                onUpdatePlayerName={updatePlayerName} onUpdatePlayerNumber={updatePlayerNumber}
                onUpdatePlayerSkill={updatePlayerSkill} onToggleFixed={togglePlayerFixed}
                onRemove={removePlayer} onDeletePlayer={deletePlayer} onMove={movePlayer}
                onAddPlayer={addPlayer} onUndoRemove={undoRemovePlayer} canUndoRemove={game.hasDeletedPlayers}
                onCommitDeletions={commitDeletions} deletedCount={game.deletedCount}
                onSetRotationMode={setRotationMode} rotationMode={game.rotationMode}
                onBalanceTeams={balanceTeams} onSaveProfile={savePlayerToProfile}
                onRevertProfile={revertPlayerChanges} deleteProfile={deleteProfile}
                upsertProfile={upsertProfile} profiles={game.profiles}
                onSortTeam={sortTeam} toggleTeamBench={toggleTeamBench} substitutePlayers={substitutePlayers}
                matchLog={state.matchLog}
                enablePlayerStats={state.config.enablePlayerStats}
                reorderQueue={reorderQueue}
                disbandTeam={disbandTeam}
            />

            <MatchOverModal 
                isOpen={state.isMatchOver} state={state}
                onRotate={rotateTeams} onReset={resetMatch} onUndo={handleUndo}
            />

            <ConfirmationModal 
                isOpen={showResetConfirm} onClose={() => setShowResetConfirm(false)}
                onConfirm={resetMatch} title="Reset Match?" message="Are you sure?"
            />

            <HistoryModal isOpen={showHistory} onClose={() => setShowHistory(false)} />

            <TutorialModal 
                isOpen={tutorial.showTutorial} onClose={tutorial.completeTutorial}
                onInstall={pwa.promptInstall} canInstall={pwa.isInstallable} isIOS={pwa.isIOS} isStandalone={pwa.isStandalone}
            />
        </Suspense>
        
        <ReloadPrompt />
        <InstallReminder 
            isVisible={tutorial.showReminder} onInstall={pwa.promptInstall}
            onDismiss={tutorial.dismissReminder} canInstall={pwa.isInstallable} isIOS={pwa.isIOS}
        />
        <NotificationToast 
            visible={notificationState.visible} type={notificationState.type} mainText={notificationState.mainText}
            subText={notificationState.subText} teamColor={notificationState.color} skill={notificationState.skill}
            onClose={() => setNotificationState(prev => ({ ...prev, visible: false }))} isFullscreen={isFullscreen}
            systemIcon={notificationState.systemIcon}
        />
    </div>
  );
};

function App() {
  return (
    <LayoutProvider>
      <ErrorBoundary>
        <AuthProvider>
          <TimerProvider>
            <GameProvider>
              <GameContent />
            </GameProvider>
          </TimerProvider>
        </AuthProvider>
      </ErrorBoundary>
    </LayoutProvider>
  );
}

export default App;
