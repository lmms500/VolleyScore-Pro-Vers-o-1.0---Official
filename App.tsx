
import React, { useState, useEffect, lazy, Suspense, useCallback, useRef } from 'react';
import { GameProvider, useGame } from './contexts/GameContext';
import { usePWAInstallPrompt } from './hooks/usePWAInstallPrompt';
import { useTutorial } from './hooks/useTutorial';
import { useNativeIntegration } from './hooks/useNativeIntegration';
import { usePlatform } from './hooks/usePlatform';
import { useVoiceControl } from './hooks/useVoiceControl';
import { useKeepAwake } from './hooks/useKeepAwake';

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
import { TeamId, SkillType, TeamColor, PlayerProfile } from './types';
import { Minimize2, Loader2, Heart } from 'lucide-react';
import { TimerProvider, useTimer } from './contexts/TimerContext';
import { AuthProvider, useAuth } from './contexts/AuthContext'; 
import { v4 as uuidv4 } from 'uuid';
import { LayoutGroup } from 'framer-motion';
import { GlobalLoader } from './components/ui/GlobalLoader';
import { useSensoryFX } from './hooks/useSensoryFX';
import { setGlobalReducedMotion } from './utils/animations';
import { calculateMatchDeltas } from './utils/statsEngine';

// ADS
import { adService } from './services/AdService';
import { SmartBanner } from './components/Ads/SmartBanner';
import { useAdFlow } from './hooks/useAdFlow';

// SYNC
import { SyncService } from './services/SyncService';

// LAZY LOADED CHUNKS
const SettingsModal = lazy(() => import('./components/modals/SettingsModal').then(m => ({ default: m.SettingsModal })));
const TeamManagerModal = lazy(() => import('./components/modals/TeamManagerModal').then(m => ({ default: m.TeamManagerModal })));
const MatchOverModal = lazy(() => import('./components/modals/MatchOverModal').then(m => ({ default: m.MatchOverModal })));
const ConfirmationModal = lazy(() => import('./components/modals/ConfirmationModal').then(m => ({ default: m.ConfirmationModal })));
const HistoryModal = lazy(() => import('./components/modals/HistoryModal').then(m => ({ default: m.HistoryModal })));
const RichTutorialModal = lazy(() => import('./components/modals/RichTutorialModal').then(m => ({ default: m.RichTutorialModal })));
const CourtModal = lazy(() => import('./components/modals/CourtModal').then(m => ({ default: m.CourtModal })));

const GameContent = () => {
  const game = useGame();
  const { 
    state, addPoint, subtractPoint, setServer, useTimeout, undo, toggleSides, applySettings, 
    resetMatch, generateTeams, togglePlayerFixed, removePlayer, movePlayer, updateTeamName, updateTeamColor, updateTeamLogo,
    updatePlayer, addPlayer, undoRemovePlayer, commitDeletions, 
    rotateTeams, setRotationMode, balanceTeams, savePlayerToProfile, revertPlayerChanges, upsertProfile, 
    deleteProfile, sortTeam, toggleTeamBench, substitutePlayers, deletePlayer, reorderQueue, disbandTeam,
    batchUpdateStats, profiles, restoreTeam, onRestorePlayer, resetRosters, relinkProfile, manualRotate, swapPositions
  } = game;

  const { t, language } = useTranslation();
  const historyStore = useHistoryStore();
  const { isNative } = usePlatform();
  const timer = useTimer();
  const { user } = useAuth();
  
  const pwa = usePWAInstallPrompt();
  const tutorial = useTutorial((pwa.isStandalone || isNative), state.config.developerMode);
  
  const [showSettings, setShowSettings] = useState(false);
  const [showManager, setShowManager] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showCourt, setShowCourt] = useState(false); 
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
      systemIcon?: 'transfer' | 'save' | 'mic' | 'alert' | 'block' | 'undo' | 'delete' | 'add' | 'roster' | 'party';
      onUndo?: () => void;
      timestamp?: number;
  }>({
      visible: false, type: 'success', mainText: '', color: 'slate'
  });

  const handleShowToast = useCallback((mainText: string, type: 'success' | 'error' | 'info', subText?: string, systemIcon?: any, onUndo?: () => void) => {
      setNotificationState({
          visible: true,
          type,
          mainText,
          subText,
          systemIcon,
          onUndo,
          timestamp: Date.now()
      });
  }, []);

  const savedMatchIdRef = useRef<string | null>(null);
  const audio = useGameAudio(state.config);
  const haptics = useHaptics(true);

  // --- NATIVE INTEGRATION HOOK ---
  const anyModalOpen = showSettings || showManager || showHistory || showCourt || showResetConfirm || showFullscreenMenu || !!tutorial.activeTutorial;
  const handleNativeBack = useCallback(() => {
      if (showFullscreenMenu) setShowFullscreenMenu(false);
      else if (showSettings) setShowSettings(false);
      else if (showManager) setShowManager(false);
      else if (showHistory) setShowHistory(false);
      else if (showCourt) setShowCourt(false);
      else if (showResetConfirm) setShowResetConfirm(false);
  }, [showFullscreenMenu, showSettings, showManager, showHistory, showCourt, showResetConfirm]);

  useNativeIntegration(game.isMatchActive, isFullscreen, handleNativeBack, anyModalOpen);

  // --- TIMER SYNC ---
  useEffect(() => {
    if (state.isTimerRunning && !timer.isRunning) {
      timer.start();
    } else if (!state.isTimerRunning && timer.isRunning) {
      timer.stop();
    }
  }, [state.isTimerRunning, timer]);

  useEffect(() => {
    if (state.scoreA === 0 && state.scoreB === 0 && state.setsA === 0 && state.setsB === 0 && state.history.length === 0) {
      timer.reset();
    }
  }, [state.scoreA, state.scoreB, state.setsA, state.setsB, state.history.length, timer]);

  // --- MODAL MANAGEMENT ON GAME OVER ---
  useEffect(() => {
    if (state.isMatchOver) {
      if (showCourt) setShowCourt(false);
      if (showSettings) setShowSettings(false);
      if (showManager) setShowManager(false);
      if (showHistory) setShowHistory(false);
      if (showFullscreenMenu) setShowFullscreenMenu(false);
      setInteractingTeam(null);
    }
  }, [state.isMatchOver, showCourt, showSettings, showManager, showHistory, showFullscreenMenu]);

  useSensoryFX(state);
  useKeepAwake(game.isMatchActive);

  // --- AD LOGIC ---
  const { triggerSupportAd, showAdConfirm, confirmWatchAd, cancelWatchAd, isAdLoading } = useAdFlow();

  useEffect(() => {
    adService.initialize();
  }, []);

  useEffect(() => {
    if (!isFullscreen && !state.config.adsRemoved) {
      adService.showBanner();
    } else {
      adService.hideBanner();
    }
  }, [isFullscreen, state.config.adsRemoved]);

  useEffect(() => {
    setGlobalReducedMotion(state.config.reducedMotion);
  }, [state.config.reducedMotion]);

  // --- GLOBAL SYNC PROTOCOL ---
  useEffect(() => {
    if (user) {
        const unsyncedMatches = historyStore.matches.slice(0, 10);
        unsyncedMatches.forEach(m => SyncService.pushMatch(user.uid, m));
        const currentProfiles = Array.from(profiles.values()) as PlayerProfile[];
        if (currentProfiles.length > 0) {
            SyncService.pushProfiles(user.uid, currentProfiles);
        }
    }
  }, [user]);

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
        historyStore.addMatch(matchData);
        if (user) SyncService.pushMatch(user.uid, matchData);
        if (state.matchLog.length > 0) {
            const rosterToProfileMap = new Map<string, string>();
            const playerTeamMap = new Map<string, TeamId>(); 
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
            const mappedLog = state.matchLog.map(log => {
                if (log.type === 'POINT' && log.playerId) {
                    const profileId = rosterToProfileMap.get(log.playerId);
                    return { ...log, playerId: profileId || log.playerId };
                }
                return log;
            });
            const deltas = calculateMatchDeltas(mappedLog, state.matchWinner, playerTeamMap);
            batchUpdateStats(deltas);
            if (user) {
                setTimeout(() => {
                    const currentProfiles = Array.from(profiles.values()) as PlayerProfile[];
                    SyncService.pushProfiles(user.uid, currentProfiles);
                }, 1000);
            }
            setNotificationState({ visible: true, type: 'success', mainText: t('notifications.matchSaved'), subText: user ? "Saved & Synced" : t('notifications.profileSynced'), systemIcon: 'save' });
        }
    } else if (!state.isMatchOver && savedMatchIdRef.current) {
        savedMatchIdRef.current = null;
    }
  }, [state.isMatchOver, state.matchWinner, historyStore, t, batchUpdateStats, state.matchLog, state.teamARoster, state.teamBRoster, user, profiles]);

  useScoreAnnouncer({ state, enabled: state.config.announceScore });

  const handleAddPointGeneric = useCallback((teamId: TeamId, playerId?: string, skill?: SkillType) => {
      const cleanPlayerId = (playerId && playerId.length > 0) ? playerId : undefined;
      const metadata = cleanPlayerId ? { playerId: cleanPlayerId, skill: skill || 'generic' } : undefined;
      audio.playTap(); 
      addPoint(teamId, metadata);
      const team = teamId === 'A' ? state.teamARoster : state.teamBRoster;
      const color = team.color || (teamId === 'A' ? 'indigo' : 'rose');
      let mainText = team.name;
      let subText = t('notifications.forTeam', { teamName: team.name });
      if (skill === 'opponent_error') {
          mainText = t('scout.skills.opponent_error');
      } else if (cleanPlayerId) {
          if (cleanPlayerId === 'unknown') mainText = t('scout.unknownPlayer');
          else {
              const player = team.players.find(p => p.id === cleanPlayerId) || team.reserves?.find(p => p.id === cleanPlayerId);
              if (player) mainText = player.name;
          }
      }
      setNotificationState({ visible: true, type: 'success', mainText: mainText, subText: subText, skill: skill, color: color, timestamp: Date.now() });
  }, [addPoint, audio, state.teamARoster, state.teamBRoster, t]);

  const handleAddA = useCallback((teamId: TeamId, playerId?: string, skill?: any) => { handleAddPointGeneric('A', playerId, skill); }, [handleAddPointGeneric]);
  const handleAddB = useCallback((teamId: TeamId, playerId?: string, skill?: any) => { handleAddPointGeneric('B', playerId, skill); }, [handleAddPointGeneric]);

  const handleSubA = useCallback(() => {
    audio.playUndo(); haptics.impact('heavy'); subtractPoint('A');
    setNotificationState({ visible: true, type: 'info', mainText: t('notifications.pointRemoved'), subText: t('notifications.pointRemovedSub'), systemIcon: 'undo', timestamp: Date.now() });
  }, [subtractPoint, audio, haptics, t]);
  
  const handleSubB = useCallback(() => {
    audio.playUndo(); haptics.impact('heavy'); subtractPoint('B');
    setNotificationState({ visible: true, type: 'info', mainText: t('notifications.pointRemoved'), subText: t('notifications.pointRemovedSub'), systemIcon: 'undo', timestamp: Date.now() });
  }, [subtractPoint, audio, haptics, t]);

  const handleUndo = useCallback(() => {
    if (state.isMatchOver && savedMatchIdRef.current) {
        historyStore.deleteMatch(savedMatchIdRef.current);
        savedMatchIdRef.current = null;
    }
    undo();
    audio.playUndo(); haptics.impact('medium');
    setNotificationState({ visible: true, type: 'info', mainText: t('notifications.actionUndone'), subText: t('notifications.actionUndoneSub'), systemIcon: 'undo', timestamp: Date.now() });
  }, [state.isMatchOver, undo, historyStore, audio, haptics, t]);

  const handleToggleSides = useCallback(() => {
      toggleSides();
      setNotificationState({ visible: true, type: 'info', mainText: t('notifications.sidesSwapped'), subText: t('notifications.sidesSwappedSub'), systemIcon: 'transfer', timestamp: Date.now() });
  }, [toggleSides, t]);

  const handleNextGame = () => { if (state.config.adsRemoved) { rotateTeams(); } else { triggerSupportAd(() => rotateTeams()); } };
  const handleResetGame = () => { if (state.config.adsRemoved) { resetMatch(); } else { triggerSupportAd(() => resetMatch()); } };

  const { isListening, toggleListening, isProcessingAI } = useVoiceControl({
      enabled: state.config.voiceControlEnabled,
      enablePlayerStats: state.config.enablePlayerStats, 
      onAddPoint: handleAddPointGeneric,
      onSubtractPoint: (team: TeamId) => team === 'A' ? handleSubA() : handleSubB(),
      onUndo: handleUndo,
      onTimeout: (team: TeamId) => { useTimeout(team); },
      onSetServer: (team: TeamId) => { setServer(team); },
      language: language,
      teamAName: state.teamAName,
      teamBName: state.teamBName,
      playersA: state.teamARoster.players,
      playersB: state.teamBRoster.players,
      servingTeam: state.servingTeam
  });

  const hudPlacement = useHudMeasure({ leftScoreEl: scoreElA, rightScoreEl: scoreElB, enabled: isFullscreen && !state.config.voiceControlEnabled, maxSets: state.config.maxSets });
  const handleToggleFullscreen = () => { setIsFullscreen(!isFullscreen); haptics.impact('light'); };

  const cardA = <ScoreCardNormal key="card-A" teamId="A" team={state.teamARoster} score={state.scoreA} setsWon={state.setsA} isServing={state.servingTeam === 'A'} onAdd={handleAddA} onSubtract={handleSubA} onSetServer={() => setServer('A')} timeouts={state.timeoutsA} onTimeout={() => useTimeout('A')} isMatchPoint={game.isMatchPointA} isSetPoint={game.isSetPointA} isDeuce={game.isDeuce} inSuddenDeath={state.inSuddenDeath} setsNeededToWin={game.setsNeededToWin} colorTheme={state.teamARoster.color} config={state.config} />;
  const cardB = <ScoreCardNormal key="card-B" teamId="B" team={state.teamBRoster} score={state.scoreB} setsWon={state.setsB} isServing={state.servingTeam === 'B'} onAdd={handleAddB} onSubtract={handleSubB} onSetServer={() => setServer('B')} timeouts={state.timeoutsB} onTimeout={() => useTimeout('B')} isMatchPoint={game.isMatchPointB} isSetPoint={game.isSetPointB} isDeuce={game.isDeuce} inSuddenDeath={state.inSuddenDeath} setsNeededToWin={game.setsNeededToWin} colorTheme={state.teamBRoster.color} config={state.config} />;
  const normalCards = state.swappedSides ? [cardB, cardA] : [cardA, cardB];

  const overlayZIndex = showCourt ? "z-[110]" : "z-[60]";

  return (
    <div 
        className="relative w-full h-[100dvh] bg-slate-50 dark:bg-[#020617] overflow-hidden select-none touch-none flex flex-col pt-safe-top pb-safe-bottom pl-safe-left pr-safe-right"
        style={{ 
            paddingTop: 'env(safe-area-inset-top)',
            paddingBottom: 'env(safe-area-inset-bottom)',
            paddingLeft: 'env(safe-area-inset-left)',
            paddingRight: 'env(safe-area-inset-right)'
        }}
    >
        <BackgroundGlow isSwapped={state.swappedSides} isFullscreen={isFullscreen} colorA={state.teamARoster.color} colorB={state.teamBRoster.color} lowPowerMode={state.config.lowGraphics} />
        <SuddenDeathOverlay active={state.inSuddenDeath} />
        {isFullscreen && (
            <>
                <MeasuredFullscreenHUD placement={hudPlacement} setsLeft={state.swappedSides ? state.setsB : state.setsA} setsRight={state.swappedSides ? state.setsA : state.setsB} colorLeft={state.swappedSides ? state.teamBRoster.color : state.teamARoster.color || 'indigo'} colorRight={state.swappedSides ? state.teamARoster.color : state.teamBRoster.color || 'rose'} />
                <FloatingTopBar currentSet={state.currentSet} isTieBreak={game.isTieBreak} onToggleTimer={() => game.setState({ type: 'TOGGLE_TIMER' })} onResetTimer={() => game.setState({ type: 'RESET_TIMER' })} isTimerRunning={state.isTimerRunning} teamNameA={state.teamAName} teamNameB={state.teamBName} teamLogoA={state.teamARoster.logo} teamLogoB={state.teamBRoster.logo} colorA={state.teamARoster.color || 'indigo'} colorB={state.teamBRoster.color || 'rose'} isServingLeft={state.servingTeam === (state.swappedSides ? 'B' : 'A')} isServingRight={state.servingTeam === (state.swappedSides ? 'A' : 'B')} onSetServerA={() => setServer('A')} onSetServerB={() => setServer('B')} timeoutsA={state.timeoutsA} timeoutsB={state.timeoutsB} onTimeoutA={() => useTimeout('A')} onTimeoutB={() => useTimeout('B')} isMatchPointA={game.isMatchPointA} isSetPointA={game.isSetPointA} isMatchPointB={game.isMatchPointB} isSetPointB={game.isSetPointB} isDeuce={game.isDeuce} inSuddenDeath={state.inSuddenDeath} reverseLayout={state.swappedSides} />
                <FloatingControlBar onUndo={handleUndo} canUndo={game.canUndo} onSwap={handleToggleSides} onReset={() => setShowResetConfirm(true)} onMenu={() => setShowFullscreenMenu(true)} onCourt={() => setShowCourt(true)} voiceEnabled={state.config.voiceControlEnabled} isListening={isListening} onToggleListening={toggleListening} />
                <button onClick={() => setIsFullscreen(false)} className="absolute top-4 right-4 z-[60] p-2 rounded-full bg-black/20 dark:bg-white/10 hover:bg-black/40 dark:hover:bg-white/20 backdrop-blur-md text-slate-300 dark:text-slate-400 hover:white transition-all active:scale-95 border border-white/5"><Minimize2 size={18} strokeWidth={2} /></button>
            </>
        )}
        <FullscreenMenuDrawer isOpen={showFullscreenMenu} onClose={() => setShowFullscreenMenu(false)} onOpenSettings={() => setShowSettings(true)} onOpenRoster={() => setShowManager(true)} onOpenHistory={() => setShowHistory(true)} onExitFullscreen={() => setIsFullscreen(false)} />
        <div className={`relative w-full flex-1 flex flex-col min-h-0 ${isFullscreen ? 'p-0' : 'p-2 sm:p-4'}`}>
            {!isFullscreen && <HistoryBar history={state.history} setsA={state.setsA} setsB={state.setsB} colorA={state.teamARoster.color || 'indigo'} colorB={state.teamBRoster.color || 'rose'} />}
            <LayoutGroup>
                <div className={`flex-1 flex flex-col landscape:flex-row gap-2 sm:gap-4 min-h-0 my-2 sm:my-4 justify-between`}>
                    {isFullscreen ? (
                        <>
                            <ScoreCardFullscreen teamId="A" team={state.teamARoster} score={state.scoreA} onAdd={handleAddA} onSubtract={handleSubA} isMatchPoint={game.isMatchPointA} isSetPoint={game.isSetPointA} isDeuce={game.isDeuce} inSuddenDeath={state.inSuddenDeath} colorTheme={state.teamARoster.color} isLocked={interactingTeam === 'B'} onInteractionStart={() => setInteractingTeam('A')} onInteractionEnd={() => setInteractingTeam(null)} reverseLayout={state.swappedSides} scoreRefCallback={setScoreElA} isServing={state.servingTeam === 'A'} config={state.config} />
                            <ScoreCardFullscreen teamId="B" team={state.teamBRoster} score={state.scoreB} onAdd={handleAddB} onSubtract={handleSubB} isMatchPoint={game.isMatchPointB} isSetPoint={game.isSetPointB} isDeuce={game.isDeuce} inSuddenDeath={state.inSuddenDeath} colorTheme={state.teamBRoster.color} isLocked={interactingTeam === 'A'} onInteractionStart={() => setInteractingTeam('B')} onInteractionEnd={() => setInteractingTeam(null)} reverseLayout={state.swappedSides} scoreRefCallback={setScoreElB} isServing={state.servingTeam === 'B'} config={state.config} />
                        </>
                    ) : ( normalCards )}
                </div>
            </LayoutGroup>
            {!isFullscreen && <Controls onUndo={handleUndo} canUndo={game.canUndo} onSwap={handleToggleSides} onSettings={() => setShowSettings(true)} onRoster={() => setShowManager(true)} onHistory={() => setShowHistory(true)} onReset={() => setShowResetConfirm(true)} onToggleFullscreen={handleToggleFullscreen} voiceEnabled={state.config.voiceControlEnabled} isListening={isListening} onToggleListening={toggleListening} />}
        </div>
        <SmartBanner isVisible={!isFullscreen && !state.config.adsRemoved} />
        <Suspense fallback={<GlobalLoader />}>
            {showSettings && <SettingsModal isOpen={showSettings} onClose={() => setShowSettings(false)} config={state.config} isMatchActive={game.isMatchActive} onSave={(newConfig, reset) => { applySettings(newConfig, reset); setShowSettings(false); }} zIndex={overlayZIndex} />}
            {showManager && (
                <TeamManagerModal 
                    isOpen={showManager} onClose={() => setShowManager(false)}
                    courtA={state.teamARoster} courtB={state.teamBRoster} queue={state.queue}
                    onGenerate={generateTeams} onUpdateTeamName={updateTeamName} onUpdateTeamColor={updateTeamColor} onUpdateTeamLogo={updateTeamLogo}
                    onUpdatePlayer={updatePlayer}
                    onToggleFixed={togglePlayerFixed} onRemove={removePlayer} onDeletePlayer={deletePlayer} onMove={movePlayer}
                    onAddPlayer={addPlayer} onUndoRemove={undoRemovePlayer} canUndoRemove={game.hasDeletedPlayers} onCommitDeletions={commitDeletions}
                    deletedCount={game.deletedCount} onSetRotationMode={setRotationMode} rotationMode={game.rotationMode}
                    onBalanceTeams={balanceTeams} onSavePlayerToProfile={savePlayerToProfile} onRevertPlayerChanges={revertPlayerChanges}
                    deleteProfile={deleteProfile} upsertProfile={upsertProfile} profiles={profiles} onSortTeam={sortTeam}
                    toggleTeamBench={toggleTeamBench} substitutePlayers={substitutePlayers} matchLog={state.matchLog}
                    enablePlayerStats={state.config.enablePlayerStats} reorderQueue={reorderQueue} disbandTeam={disbandTeam}
                    restoreTeam={restoreTeam} onRestorePlayer={(p, t, i) => onRestorePlayer && onRestorePlayer(p, t, i)} resetRosters={resetRosters} relinkProfile={relinkProfile}
                    onShowToast={handleShowToast}
                    developerMode={state.config.developerMode}
                    zIndex={overlayZIndex}
                />
            )}
            {showCourt && (
                <CourtModal 
                    isOpen={showCourt} onClose={() => setShowCourt(false)} 
                    teamA={state.teamARoster} teamB={state.teamBRoster} 
                    scoreA={state.scoreA} scoreB={state.scoreB} 
                    servingTeam={state.servingTeam} onManualRotate={manualRotate} 
                    onAddPoint={handleAddPointGeneric} onSubtractPoint={(teamId) => teamId === 'A' ? handleSubA() : handleSubB()} 
                    onMovePlayer={swapPositions} onSubstitute={substitutePlayers} 
                    currentSet={state.currentSet} setsA={state.setsA} setsB={state.setsB} 
                    isMatchPointA={game.isMatchPointA} isMatchPointB={game.isMatchPointB} 
                    isSetPointA={game.isSetPointA} isSetPointB={game.isSetPointB} 
                    isDeuce={game.isDeuce} inSuddenDeath={state.inSuddenDeath} 
                    matchLog={state.matchLog}
                    config={state.config}
                    onOpenManager={() => setShowManager(true)}
                    onOpenHistory={() => setShowHistory(true)}
                    onOpenSettings={() => setShowSettings(true)}
                />
            )}
            {state.isMatchOver && <MatchOverModal isOpen={state.isMatchOver} state={state} onRotate={handleNextGame} onReset={handleResetGame} onUndo={handleUndo} />}
            <ConfirmationModal isOpen={showAdConfirm} onClose={cancelWatchAd} onConfirm={confirmWatchAd} title="Support VolleyScore" message="Watch a short ad to support development?" confirmLabel={isAdLoading ? "Loading..." : "Watch Ad"} icon={Heart} />
            {showResetConfirm && <ConfirmationModal isOpen={showResetConfirm} onClose={() => setShowResetConfirm(false)} onConfirm={resetMatch} title={t('confirm.reset.title')} message={t('confirm.reset.message')} confirmLabel={t('confirm.reset.confirmButton')} />}
            {showHistory && <HistoryModal isOpen={showHistory} onClose={() => setShowHistory(false)} developerMode={state.config.developerMode} zIndex={overlayZIndex} />}
            {tutorial.activeTutorial === 'main' && <RichTutorialModal isOpen={true} tutorialKey="main" onClose={tutorial.completeTutorial} canInstall={pwa.isInstallable} onInstall={pwa.promptInstall} isStandalone={pwa.isStandalone} isIOS={pwa.isIOS} />}
        </Suspense>
        <ReloadPrompt />
        <InstallReminder isVisible={tutorial.showReminder} onInstall={pwa.promptInstall} onDismiss={tutorial.dismissReminder} canInstall={pwa.isInstallable} isIOS={pwa.isIOS} />
        <NotificationToast key={notificationState.timestamp} visible={notificationState.visible && !showCourt} type={notificationState.type} mainText={notificationState.mainText} subText={notificationState.subText} teamColor={notificationState.color} skill={notificationState.skill} onClose={() => setNotificationState(prev => ({ ...prev, visible: false }))} isFullscreen={isFullscreen} systemIcon={notificationState.systemIcon} onUndo={notificationState.onUndo} />
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
