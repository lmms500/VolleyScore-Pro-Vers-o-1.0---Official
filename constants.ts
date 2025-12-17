
import { GameConfig, GameMode } from './types';

export const DEFAULT_CONFIG: GameConfig = {
  mode: 'indoor',
  maxSets: 5, // Official FIVB: Best of 5
  pointsPerSet: 25, // Sets 1-4 are 25 points
  hasTieBreak: true,
  tieBreakPoints: 15, // 5th set is 15 points
  deuceType: 'standard',
  rotationMode: 'standard',
  enablePlayerStats: false,
  enableSound: true,
  voiceControlEnabled: false,
  announceScore: false,
  voiceGender: 'female',
  voiceRate: 1.0,
  voicePitch: 1.0,
  announcementFreq: 'all',
  lowGraphics: false,
  reducedMotion: false,
  // Default Security & Access State
  adsRemoved: false,
  developerMode: false
};

export const MIN_LEAD_TO_WIN = 2;

export const SETS_TO_WIN_MATCH = (maxSets: number) => Math.ceil(maxSets / 2);

// Dynamic Court Limits
export const INDOOR_COURT_LIMIT = 6;
export const BEACH_COURT_LIMIT = 4;

// Dynamic Bench Limits
export const INDOOR_BENCH_LIMIT = 6;
export const BEACH_BENCH_LIMIT = 3;

// Helper to get court limit based on mode
export const getPlayersOnCourt = (mode: GameMode) => mode === 'beach' ? BEACH_COURT_LIMIT : INDOOR_COURT_LIMIT;

// Helper to get bench limit based on mode
export const getBenchLimit = (mode: GameMode) => mode === 'beach' ? BEACH_BENCH_LIMIT : INDOOR_BENCH_LIMIT;

// Legacy constant for backwards compatibility where mode isn't available (defaulting to max)
export const PLAYER_LIMIT_ON_COURT = 6;
export const PLAYERS_PER_TEAM = 6; // Max roster size logic (can be overridden by dynamic logic)
