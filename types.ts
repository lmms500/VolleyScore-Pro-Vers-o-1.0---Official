

export type TeamId = 'A' | 'B';

export type DeuceType = 'standard' | 'sudden_death_3pt';

export type RotationMode = 'standard' | 'balanced';

export type GameMode = 'indoor' | 'beach';

export type SkillType = 'attack' | 'block' | 'ace' | 'opponent_error';

export type PlayerId = string; // UUID v4

export type SyncStatus = 'synced' | 'desynced' | 'unlinked';

export type PlayerRole = 'setter' | 'hitter' | 'middle' | 'libero' | 'none';

// Supported Theme Colors (Presets + Hex Strings)
export type TeamColor = string; 

// --- STATS ENGINE TYPES ---
export interface ProfileStats {
  matchesPlayed: number;
  matchesWon: number;
  totalPoints: number; // Total points contributed (kills + blocks + aces)
  attacks: number;
  blocks: number;
  aces: number;
  mvpCount: number;
}

// 1. O PERFIL MESTRE (Persistente / Banco de Dados Local)
export interface PlayerProfile {
  id: PlayerId;
  name: string;       // Normalizado (trim)
  skillLevel: number; // 1 a 10 (Slider)
  number?: string;    // Jersey Number Preferido
  avatar?: string;    // Emoji ou Cor string
  role?: PlayerRole;  // Player Role (Setter, etc)
  stats?: ProfileStats; // Long-term statistics
  createdAt: number;
  lastUpdated: number;
}

export interface GameConfig {
  mode: GameMode; // 'indoor' | 'beach'
  maxSets: 1 | 3 | 5;
  pointsPerSet: 15 | 21 | 25;
  hasTieBreak: boolean;
  tieBreakPoints: 15 | 25; // Limitado a valores comuns
  deuceType: DeuceType;
  rotationMode: RotationMode;
  enablePlayerStats: boolean; // Toggle Scout Mode
  enableSound: boolean; // Global Audio Toggle
  voiceControlEnabled: boolean; // Voice Control Feature Toggle
  announceScore: boolean; // New: TTS Score Announcement
  voiceGender: 'male' | 'female'; // New: TTS Voice Preference
  voiceRate: number; // New: TTS Speed (0.5 - 2.0)
  voicePitch: number; // New: TTS Pitch (0.5 - 2.0)
  announcementFreq: 'all' | 'critical_only'; // New: TTS Verbosity
  lowGraphics: boolean; // Optimization for low-end devices
  reducedMotion: boolean; // Disable non-essential animations
  userApiKey?: string; // BYOK: User Provided Gemini Key
  
  // Monetization & Access Control
  adsRemoved: boolean;     // Freemium Unlock
  developerMode: boolean;  // Backdoor Access
}

// 2. A INSTÂNCIA DE JOGO (Volátil / Em Quadra)
export interface Player {
  id: string; // ID único da instância na lista/quadra
  profileId?: PlayerId; // Link para o Perfil Mestre (Undefined = Jogador Anônimo/Temporário)
  name: string;
  number?: string; // Jersey Number
  skillLevel: number; // 1 to 10
  role?: PlayerRole; // New: Player Role in current game
  isFixed: boolean; // Se true, o jogador não é movido durante o balanceamento automático
  fixedSide?: 'A' | 'B' | null; // Se fixo, lembra de onde veio (opcional)
  originalIndex: number; // CRÍTICO: Para permitir o "Reset" da ordem exata de entrada
  displayOrder?: number; // VISUAL ORDER: Determines list position in Manager, decoupled from rotation logic
}

export interface Team {
  id: string; 
  name: string;
  color: TeamColor; // New visual property
  logo?: string; // Base64 Image String
  players: Player[];
  reserves: Player[]; // Bench players
  hasActiveBench?: boolean; // Controls if knockout sends to reserves or global queue
  tacticalOffset?: number; // Visual rotation offset (0-5) for tactical view
}

export interface SetHistory {
  setNumber: number;
  scoreA: number;
  scoreB: number;
  winner: TeamId;
}

export interface RotationReport {
  outgoingTeam: Team;
  incomingTeam: Team;
  retainedPlayers: Player[]; 
  stolenPlayers: Player[]; 
  queueAfterRotation: Team[]; 
  logs?: string[]; // Debug logs for rotation logic
}

export interface DeletedPlayerRecord {
  player: Player;
  originId: string;
  timestamp: number;
}

// SNAPSHOT FOR ROSTER RESTORATION
export interface RosterSnapshot {
    teamARoster: Team;
    teamBRoster: Team;
    queue: Team[];
    rotationReport: RotationReport | null;
}

export type ActionLog = 
  | { 
      type: 'POINT'; 
      team: TeamId;
      prevScoreA: number;
      prevScoreB: number;
      prevServingTeam: TeamId | null;
      prevInSuddenDeath: boolean; // Required for undo consistency
      timestamp?: number;
      // Scout Metadata (Explicitly typed)
      playerId?: string | null; // UUID or null (Team Stat fallback)
      skill?: SkillType;
      autoRotated?: boolean; // Tracks if this point caused an auto-rotation
    }
  | { 
      type: 'TIMEOUT'; 
      team: TeamId;
      prevTimeoutsA: number;
      prevTimeoutsB: number;
      timestamp?: number;
    }
  | {
      type: 'ROTATION';
      snapshot: RosterSnapshot;
      timestamp?: number;
  }
  | {
      type: 'MANUAL_ROTATION';
      teamId: string;
      direction: 'clockwise' | 'counter';
      timestamp?: number;
  };

export interface GameState {
  // Names
  teamAName: string;
  teamBName: string;
  
  // Scores & Sets
  scoreA: number;
  scoreB: number;
  setsA: number;
  setsB: number;
  currentSet: number;
  
  // History & Logic
  history: SetHistory[];
  actionLog: ActionLog[]; // Current Set Undo Stack (Clears every set)
  matchLog: ActionLog[];  // Full Match History (PERSISTENT - Do not clear between sets)
  lastSnapshot?: GameState; // For critical undo (Match/Set transitions)
  isMatchOver: boolean;
  matchWinner: TeamId | null;
  
  // Game Status
  servingTeam: TeamId | null;
  swappedSides: boolean;
  config: GameConfig;
  
  // Timeouts
  timeoutsA: number;
  timeoutsB: number;
  
  // Advanced State
  inSuddenDeath: boolean;
  pendingSideSwitch: boolean; // Controls the "Switch Sides" overlay
  matchDurationSeconds: number; // Persisted only, not updated via reducer tick
  isTimerRunning: boolean; // Controls the separate TimerContext
  
  // Roster Management (Unified)
  teamARoster: Team;
  teamBRoster: Team;
  queue: Team[]; 
  rotationReport: RotationReport | null;
  deletedPlayerHistory: DeletedPlayerRecord[];
  rotationMode: RotationMode;
}

// Reducer Actions
export type GameAction =
  | { type: 'LOAD_STATE'; payload: GameState }
  | { type: 'POINT'; team: TeamId; metadata?: { playerId: string, skill: SkillType } }
  | { type: 'SUBTRACT_POINT'; team: TeamId }
  | { type: 'TIMEOUT'; team: TeamId }
  | { type: 'UNDO' }
  | { type: 'RESET_MATCH' }
  | { type: 'TOGGLE_SIDES' }
  | { type: 'SET_SERVER'; team: TeamId }
  | { type: 'APPLY_SETTINGS'; config: GameConfig; shouldReset: boolean }
  | { type: 'ROTATE_TEAMS' } // Logic moved to reducer
  // TICK_TIMER removed - handled by TimerContext
  | { type: 'RESET_TIMER' }
  | { type: 'TOGGLE_TIMER' }
  // ROSTER ACTIONS
  | { type: 'ROSTER_UPDATE_TEAM_NAME'; teamId: string; name: string }
  | { type: 'ROSTER_UPDATE_TEAM_COLOR'; teamId: string; color: TeamColor }
  | { type: 'ROSTER_UPDATE_TEAM_LOGO'; teamId: string; logo: string } // NEW
  | { type: 'ROSTER_UPDATE_PLAYER'; playerId: string; updates: Partial<Player> }
  | { type: 'ROSTER_ADD_PLAYER'; player: Player; targetId: string }
  | { type: 'ROSTER_RESTORE_PLAYER'; player: Player; targetId: string; index?: number }
  | { type: 'ROSTER_REMOVE_PLAYER'; playerId: string } // Knockout
  | { type: 'ROSTER_DELETE_PLAYER'; playerId: string } // Permanent Delete
  | { type: 'ROSTER_MOVE_PLAYER'; playerId: string; fromId: string; toId: string; newIndex?: number }
  | { type: 'ROSTER_SUBSTITUTE'; teamId: string; playerInId: string; playerOutId: string }
  | { type: 'ROSTER_SWAP_POSITIONS'; teamId: string; indexA: number; indexB: number } // NEW: Direct Swap
  | { type: 'ROSTER_UNDO_REMOVE' }
  | { type: 'ROSTER_COMMIT_DELETIONS' }
  | { type: 'ROSTER_TOGGLE_FIXED'; playerId: string }
  | { type: 'ROSTER_TOGGLE_BENCH'; teamId: string }
  | { type: 'ROSTER_SET_MODE'; mode: RotationMode }
  | { type: 'ROSTER_BALANCE' }
  | { type: 'ROSTER_SORT'; teamId: string; criteria: 'name' | 'number' | 'skill' }
  | { type: 'ROSTER_GENERATE'; players: Player[] }
  | { type: 'ROSTER_SYNC_PROFILES'; profiles: Map<string, PlayerProfile> }
  | { type: 'ROSTER_UNLINK_PROFILE'; profileId: string } // NEW: Cleans up deleted profiles from roster
  | { type: 'ROSTER_ENSURE_TEAM_IDS' }
  | { type: 'ROSTER_RESET_ALL' } // Nuclear Reset
  // NEW QUEUE ACTIONS
  | { type: 'ROSTER_QUEUE_REORDER'; fromIndex: number; toIndex: number }
  | { type: 'ROSTER_DISBAND_TEAM'; teamId: string }
  | { type: 'ROSTER_RESTORE_TEAM'; team: Team; index: number }
  // TACTICAL ACTIONS
  | { type: 'MANUAL_ROTATION'; teamId: string; direction: 'clockwise' | 'counter' }; // Undo Disband