
import { useMemo } from 'react';
import { GameConfig } from '../types';
import { audioService } from '../services/AudioService';

/**
 * Hook for playing game audio.
 * Now acts as a thin wrapper around the robust AudioService singleton.
 */
export const useGameAudio = (config: GameConfig) => {
  
  // Ensure service is initialized (lazy load)
  audioService.init();

  const playTap = () => {
    if (config.enableSound) audioService.playTap();
  };

  const playScore = () => {
    if (config.enableSound) audioService.playScore(config.lowGraphics);
  };

  const playUndo = () => {
    if (config.enableSound) audioService.playUndo();
  };

  const playWhistle = () => {
    if (config.enableSound) audioService.playWhistle(config.lowGraphics);
  };

  const playSetPointAlert = () => {
    if (config.enableSound) audioService.playSetPointAlert(config.lowGraphics);
  };

  const playMatchPointAlert = () => {
    if (config.enableSound) audioService.playMatchPointAlert(config.lowGraphics);
  };

  const playSetWin = () => {
    if (config.enableSound) audioService.playSetWin(config.lowGraphics);
  };

  const playMatchWin = () => {
    if (config.enableSound) audioService.playMatchWin(config.lowGraphics);
  };

  const playSuddenDeath = () => {
    if (config.enableSound) audioService.playSuddenDeath(config.lowGraphics);
  };

  const playSwap = () => {
    if (config.enableSound) audioService.playSwap();
  };

  const playDeuce = () => {
    if (config.enableSound) audioService.playDeuce();
  };

  return useMemo(() => ({
    playTap,
    playScore,
    playUndo,
    playWhistle,
    playSetPointAlert,
    playMatchPointAlert,
    playSetWin,
    playMatchWin,
    playSuddenDeath,
    playSwap,
    playDeuce
  }), [config.enableSound, config.lowGraphics]);
};
