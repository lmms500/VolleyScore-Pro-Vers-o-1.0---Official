
import { create } from 'zustand';
import { persist, createJSONStorage, StateStorage } from 'zustand/middleware';
import { GameConfig, SetHistory, TeamId, ActionLog, Team } from '../types';
import { SecureStorage } from '../services/SecureStorage';

export type MatchSettings = GameConfig;
export type ScoreEvent = ActionLog;

export interface Match {
  id: string;                 
  date: string;               
  timestamp: number;          
  durationSeconds: number;    
  teamAName: string;
  teamBName: string;
  teamARoster?: Team;
  teamBRoster?: Team;
  setsA: number;
  setsB: number;
  winner: TeamId | null;      
  sets: SetHistory[];
  actionLog?: ActionLog[];
  config: MatchSettings;
}

interface HistoryStoreState {
  matches: Match[];
}

interface HistoryStoreActions {
  addMatch: (match: Match) => void;
  deleteMatch: (matchId: string) => void;
  clearHistory: () => void;
  exportJSON: () => string;
  importJSON: (jsonStr: string, options?: { merge: boolean }) => { success: boolean; errors?: string[] };
  mergeMatches: (newMatches: Match[]) => void;
}

const secureStorageAdapter: StateStorage = {
  getItem: async (name: string): Promise<string | null> => {
    const data = await SecureStorage.load<string>(name);
    return data || null;
  },
  setItem: async (name: string, value: string): Promise<void> => {
    await SecureStorage.save(name, value);
  },
  removeItem: async (name: string): Promise<void> => {
    await SecureStorage.remove(name);
  },
};

export const useHistoryStore = create<HistoryStoreState & HistoryStoreActions>()(
  persist(
    (set, get) => ({
      matches: [],

      addMatch: (match) => {
        set((state) => ({
          matches: [match, ...state.matches]
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

      mergeMatches: (newMatches) => {
          set((state) => {
              const currentMap = new Map<string, Match>(state.matches.map(m => [m.id, m]));
              let changes = false;

              newMatches.forEach(m => {
                  if (!currentMap.has(m.id)) {
                      currentMap.set(m.id, m);
                      changes = true;
                  }
              });

              if (!changes) return state;

              const merged = Array.from(currentMap.values()).sort((a, b) => b.timestamp - a.timestamp);
              return { matches: merged };
          });
      },

      exportJSON: () => {
        const { matches } = get();
        return JSON.stringify(matches, null, 2);
      },

      importJSON: (jsonStr, options = { merge: true }) => {
        try {
          const parsed = JSON.parse(jsonStr);
          const dataToProcess = Array.isArray(parsed) ? parsed : (parsed.data?.history || []);

          if (!Array.isArray(dataToProcess)) {
            return { success: false, errors: ['Formato inválido: lista de partidas não encontrada.'] };
          }

          const validMatches: Match[] = [];
          dataToProcess.forEach(item => {
            if (item.id && item.timestamp && item.teamAName && item.teamBName) {
              validMatches.push(item as Match);
            }
          });

          if (validMatches.length === 0) return { success: false, errors: ['Nenhuma partida válida encontrada.'] };

          set((state) => {
            if (options.merge) {
              const existingIds = new Set(state.matches.map(m => m.id));
              const newUniqueMatches = validMatches.filter(m => !existingIds.has(m.id));
              return { matches: [...newUniqueMatches, ...state.matches].sort((a, b) => b.timestamp - a.timestamp) };
            } else {
              return { matches: validMatches.sort((a, b) => b.timestamp - a.timestamp) };
            }
          });

          return { success: true };
        } catch (e) {
          return { success: false, errors: [(e as Error).message] };
        }
      }
    }),
    {
      name: 'vsp_matches_v1',
      storage: createJSONStorage(() => secureStorageAdapter),
      version: 1,
    }
  )
);
