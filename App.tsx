

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
import { VoiceToast } from './components/ui/VoiceToast';
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
    deleteProfile, sortTeam, toggleTeamBench, substitutePlayers, deletePlayer, reorderQueue, disbandTeam
  } = game;

  const { language } = useTranslation();
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

  const [voiceToast, setVoiceToast] = useState<{ 
      visible: boolean;
      type: 'success' | 'error' | 'info';
      mainText: string;
      subText?: string;
      skill?: SkillType;
      color?: TeamColor 
  }>({
      visible: false, type: 'success', mainText: '', color: 'slate'
  });

  const savedMatchIdRef = useRef<string | null>(null);
  const audio = useGameAudio(state.config);
  const haptics = useHaptics(true);

  // --- SENSORY ORCHESTRATION ---
  useSensoryFX(state);

  // --- MATCH SAVING LOGIC ---
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
    } else if (!state.isMatchOver && savedMatchIdRef.current) {
        savedMatchIdRef.current = null;
    }
  }, [state.isMatchOver, state.matchWinner, historyStore]);

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

  const handleUndo = useCallback(() => {
    if (state.isMatchOver && savedMatchIdRef.current) {
        historyStore.deleteMatch(savedMatchIdRef.current);
        savedMatchIdRef.current = null;
    }
    undo();
    audio.playUndo();
    haptics.impact('medium');
  }, [state.isMatchOver, undo, historyStore, audio, haptics]);

  const handleToggleSides = useCallback(() => {
      toggleSides();
  }, [toggleSides]);

  // --- VOICE CONTROL ---
  const handleVoiceAddPoint = useCallback((team: TeamId, playerId?: string, skill?: SkillType) => {
      const metadata = playerId ? { playerId, skill } : undefined;
      
      if (team === 'A') addPoint('A', metadata);
      else addPoint('B', metadata);
      
      audio.playTap();
      
      const players = team === 'A' ? state.teamARoster.players : state.teamBRoster.players;
      let displayName = team === 'A' ? state.teamAName : state.teamBName;
      let subInfo = `For ${team === 'A' ? state.teamAName : state.teamBName}`;

      if (playerId) {
          if (playerId === 'unknown') {
              displayName = "Unknown Player";
          } else {
              const player = players.find(p => p.id === playerId);
              if (player) displayName = player.name;
          }
      }
      
      const color = team === 'A' ? (state.teamARoster.color || 'indigo') : (state.teamBRoster.color || 'rose');
      
      setVoiceToast({
          visible: true, 
          type: 'success', 
          mainText: displayName, 
          subText: subInfo, 
          skill, 
          color
      });
  }, [addPoint, state.teamARoster, state.teamBRoster, state.teamAName, state.teamBName, audio]);

  const handleVoiceSubtract = useCallback((team: TeamId) => {
      if (team === 'A') handleSubA(); else handleSubB();
      setVoiceToast({ visible: true, type: 'info', mainText: 'Point Removed', subText: 'Correction' });
  }, [handleSubA, handleSubB]);

  const handleVoiceTimeout = useCallback((team: TeamId) => {
      useTimeout(team);
      const teamName = team === 'A' ? state.teamAName : state.teamBName;
      setVoiceToast({ visible: true, type: 'info', mainText: 'Timeout Called', subText: `For ${teamName}` });
  }, [useTimeout, state.teamAName, state.teamBName]);

  const handleVoiceSetServer = useCallback((team: TeamId) => {
      setServer(team);
      audio.playTap();
      const teamName = team === 'A' ? state.teamAName : state.teamBName;
      setVoiceToast({ visible: true, type: 'info', mainText: 'Serve Change', subText: `Serving: ${teamName}` });
  }, [setServer, state.teamAName, state.teamBName, audio]);

  const handleVoiceError = useCallback((errorType: 'permission' | 'network' | 'generic', transcript?: string) => {
      let msg = "Microphone Error";
      if (errorType === 'permission') msg = "Access Denied";
      if (errorType === 'network') msg = "Network Error";
      haptics.notification('error');
      setVoiceToast({ visible: true, type: 'error', mainText: transcript || msg });
  }, [haptics]);

  const handleVoiceUnknown = useCallback((text: string) => {
      haptics.impact('light'); 
      setVoiceToast({ visible: true, type: 'error', mainText: text, subText: 'Not Understood' });
  }, [haptics]);

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
          setVoiceToast({ visible: true, type: 'info', mainText: 'Thinking...', subText: 'AI Processing' });
      } else {
          setVoiceToast(prev => prev.mainText === 'Thinking...' ? { ...prev, visible: false } : prev);
      }
  }, [isProcessingAI]);

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
          onSetServer={() => setServer('A')}
          timeouts={state.timeoutsA} onTimeout={() => useTimeout('A')}
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
          onSetServer={() => setServer('B')}
          timeouts={state.timeoutsB} onTimeout={() => useTimeout('B')}
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
                    onSetServerA={() => setServer('A')}
                    onSetServerB={() => setServer('B')}
                    timeoutsA={state.timeoutsA}
                    timeoutsB={state.timeoutsB}
                    onTimeoutA={() => useTimeout('A')}
                    onTimeoutB={() => useTimeout('B')}
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
        <VoiceToast 
            visible={voiceToast.visible} type={voiceToast.type} mainText={voiceToast.mainText}
            subText={voiceToast.subText} teamColor={voiceToast.color} skill={voiceToast.skill}
            onClose={() => setVoiceToast(prev => ({ ...prev, visible: false }))} isFullscreen={isFullscreen}
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