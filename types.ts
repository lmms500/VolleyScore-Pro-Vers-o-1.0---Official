
export type TeamId = 'A' | 'B';

export type DeuceType = 'standard' | 'sudden_death_3pt';

export type RotationMode = 'standard' | 'balanced';

export type GameMode = 'indoor' | 'beach';

export type SkillType = 'attack' | 'block' | 'ace' | 'opponent_error';

export type PlayerId = string; // UUID v4

export type SyncStatus = 'synced' | 'desynced' | 'unlinked';

// Supported Theme Colors (Presets + Hex Strings)
export type TeamColor = string; 

// 1. O PERFIL MESTRE (Persistente / Banco de Dados Local)
export interface PlayerProfile {
  id: PlayerId;
  name: string;       // Normalizado (trim)
  skillLevel: number; // 1 a 10 (Slider) - Updated range
  number?: string;    // Jersey Number Preferido
  avatar?: string;    // Emoji ou Cor string
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
  announcementFreq: 'all' | 'critical_only'; // New: TTS Verbosity
  lowGraphics: boolean; // Optimization for low-end devices
  userApiKey?: string; // BYOK: User Provided Gemini Key
}

// 2. A INSTÂNCIA DE JOGO (Volátil / Em Quadra)
export interface Player {
  id: string; // ID único da instância na lista/quadra
  profileId?: PlayerId; // Link para o Perfil Mestre (Undefined = Jogador Anônimo/Temporário)
  name: string;
  number?: string; // Jersey Number
  skillLevel: number; // 1 to 10
  isFixed: boolean; // Se true, o jogador não é movido durante o balanceamento automático
  fixedSide?: 'A' | 'B' | null; // Se fixo, lembra de onde veio (opcional)
  originalIndex: number; // CRÍTICO: Para permitir o "Reset" da ordem exata de entrada
}

export interface Team {
  id: string; 
  name: string;
  color: TeamColor; // New visual property
  players: Player[];
  reserves: Player[]; // Bench players
  hasActiveBench?: boolean; // Controls if knockout sends to reserves or global queue
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
      playerId?: string; 
      skill?: SkillType; 
    }
  | { 
      type: 'TIMEOUT'; 
      team: TeamId;
      prevTimeoutsA: number;
      prevTimeoutsB: number;
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
  | { type: 'ROSTER_UPDATE_PLAYER'; playerId: string; updates: Partial<Player> }
  | { type: 'ROSTER_ADD_PLAYER'; player: Player; targetId: string }
  | { type: 'ROSTER_REMOVE_PLAYER'; playerId: string } // Knockout
  | { type: 'ROSTER_DELETE_PLAYER'; playerId: string } // Permanent Delete
  | { type: 'ROSTER_MOVE_PLAYER'; playerId: string; fromId: string; toId: string; newIndex?: number }
  | { type: 'ROSTER_SUBSTITUTE'; teamId: string; playerInId: string; playerOutId: string }
  | { type: 'ROSTER_UNDO_REMOVE' }
  | { type: 'ROSTER_COMMIT_DELETIONS' }
  | { type: 'ROSTER_TOGGLE_FIXED'; playerId: string }
  | { type: 'ROSTER_TOGGLE_BENCH'; teamId: string }
  | { type: 'ROSTER_SET_MODE'; mode: RotationMode }
  | { type: 'ROSTER_BALANCE' }
  | { type: 'ROSTER_SORT'; teamId: string; criteria: 'name' | 'number' | 'skill' }
  | { type: 'ROSTER_GENERATE'; names: string[] }
  | { type: 'ROSTER_SYNC_PROFILES'; profiles: Map<string, PlayerProfile> }
  // NEW QUEUE ACTIONS
  | { type: 'ROSTER_QUEUE_REORDER'; fromIndex: number; toIndex: number }
  | { type: 'ROSTER_DISBAND_TEAM'; teamId: string };
