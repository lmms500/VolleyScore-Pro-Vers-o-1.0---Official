
import { create } from 'zustand';
import { persist, createJSONStorage, StateStorage } from 'zustand/middleware';
import { GameConfig, SetHistory, TeamId, ActionLog, Team } from '../types';
import { SecureStorage } from '../services/SecureStorage';

// --- TYPES (Derived/Extended from Core Types) ---

/**
 * Represents the configuration used for a specific match.
 * Aliased from core types to maintain consistency.
 */
export type MatchSettings = GameConfig;

/**
 * Represents a single score event or action within a match.
 * Aliased from core types.
 */
export type ScoreEvent = ActionLog;

/**
 * Snapshot of a completed match.
 */
export interface Match {
  id: string;                 // UUID
  date: string;               // ISO Date String
  timestamp: number;          // Unix Timestamp for sorting
  durationSeconds: number;    // Total match time
  
  teamAName: string;
  teamBName: string;
  
  // Roster Snapshots (Optional for backward compatibility)
  teamARoster?: Team;
  teamBRoster?: Team;

  setsA: number;
  setsB: number;
  
  winner: TeamId | null;      // 'A' | 'B'
  
  // Detailed History
  sets: SetHistory[];
  
  // Detailed Actions (New for V2 Stats)
  actionLog?: ActionLog[];

  // Configuration used
  config: MatchSettings;
}

interface HistoryStoreState {
  matches: Match[];
}

interface HistoryStoreActions {
  /**
   * Adds a completed match to the history.
   * Newest matches appear first.
   */
  addMatch: (match: Match) => void;

  /**
   * Deletes a single match by ID.
   */
  deleteMatch: (matchId: string) => void;

  /**
   * Wipes all match history. Irreversible.
   */
  clearHistory: () => void;

  /**
   * Exports the current history as a JSON string.
   */
  exportJSON: () => string;

  /**
   * Imports history from a JSON string.
   * @param jsonStr The raw JSON string.
   * @param options.merge If true, adds unique matches to existing history. If false, overwrites.
   * @returns Object indicating success status and any error messages.
   */
  importJSON: (jsonStr: string, options?: { merge: boolean }) => { success: boolean; errors?: string[] };
}

// --- ADAPTER: SecureStorage (IndexedDB) <-> Zustand ---
const secureStorageAdapter: StateStorage = {
  getItem: async (name: string): Promise<string | null> => {
    // Load returns T, which is the stringified state string from Zustand
    const data = await SecureStorage.load<string>(name);
    return data || null;
  },
  setItem: async (name: string, value: string): Promise<void> => {
    // Save wraps the data in an integrity envelope and puts it in IndexedDB
    await SecureStorage.save(name, value);
  },
  removeItem: async (name: string): Promise<void> => {
    await SecureStorage.remove(name);
  },
};

// --- STORE IMPLEMENTATION ---

export const useHistoryStore = create<HistoryStoreState & HistoryStoreActions>()(
  persist(
    (set, get) => ({
      matches: [],

      addMatch: (match) => {
        set((state) => ({
          matches: [match, ...state.matches] // Unshift (Newest first)
        }));
      },

      deleteMatch: (matchId) => {
        set((state) => ({
          matches: state.matches.filter((m) => m.id !== matchId)
        }));
      },

      clearHistory: () => {
        set({ matches: [] });
      },

      exportJSON: () => {
        const { matches } = get();
        return JSON.stringify(matches, null, 2);
      },

      importJSON: (jsonStr, options = { merge: true }) => {
        try {
          const parsed = JSON.parse(jsonStr);

          if (!Array.isArray(parsed)) {
            return { success: false, errors: ['Invalid format: Root must be an array.'] };
          }

          // Basic Validation of Match Structure
          const validMatches: Match[] = [];
          const errors: string[] = [];

          parsed.forEach((item, index) => {
            if (
              typeof item.id === 'string' &&
              typeof item.timestamp === 'number' &&
              typeof item.teamAName === 'string' &&
              typeof item.teamBName === 'string' &&
              Array.isArray(item.sets)
            ) {
              validMatches.push(item as Match);
            } else {
              errors.push(`Item at index ${index} is missing required Match fields.`);
            }
          });

          if (validMatches.length === 0 && parsed.length > 0) {
            return { success: false, errors: ['No valid match records found in input.', ...errors] };
          }

          set((state) => {
            if (options.merge) {
              // Create Map of existing IDs to avoid duplicates
              const existingIds = new Set(state.matches.map(m => m.id));
              const newUniqueMatches = validMatches.filter(m => !existingIds.has(m.id));
              
              // Merge and sort by timestamp descending
              const merged = [...newUniqueMatches, ...state.matches].sort((a, b) => b.timestamp - a.timestamp);
              return { matches: merged };
            } else {
              // Overwrite mode
              return { matches: validMatches.sort((a, b) => b.timestamp - a.timestamp) };
            }
          });

          return { 
            success: true, 
            errors: errors.length > 0 ? errors : undefined 
          };

        } catch (e) {
          return { success: false, errors: [(e as Error).message] };
        }
      }
    }),
    {
      name: 'vsp_matches_v1',
      storage: createJSONStorage(() => secureStorageAdapter), // Use async secure storage
      version: 1,
    }
  )
);
