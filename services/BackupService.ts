
import { SecureStorage } from './SecureStorage';
import { downloadJSON } from './io';

/**
 * VolleyScore Pro - Absolute Data Backup v2.0
 */

const BACKUP_VERSION = '2.0.0';

const KEY_HISTORY = 'vsp_matches_v1';
const KEY_PROFILES = 'player_profiles_master';
const KEY_GAME_STATE = 'action_log';

export interface BackupSchema {
  meta: {
    version: string;
    appVersion: string;
    timestamp: number;
    platform: string;
  };
  data: {
    history: any;
    profiles: any;
    gameState: any;
  };
}

export const BackupService = {
  
  async generateBackup(): Promise<void> {
    try {
      const history = await SecureStorage.load(KEY_HISTORY);
      const profiles = await SecureStorage.load(KEY_PROFILES);
      const gameState = await SecureStorage.load(KEY_GAME_STATE);

      const backup: BackupSchema = {
        meta: {
          version: BACKUP_VERSION,
          appVersion: '2.0.6',
          timestamp: Date.now(),
          platform: navigator.userAgent
        },
        data: {
          history: history || null,
          profiles: profiles || [],
          gameState: gameState || null
        }
      };

      const filename = `volleyscore_full_backup_${new Date().toISOString().split('T')[0]}`;
      await downloadJSON(filename, backup);

    } catch (e) {
      console.error("[Backup] Generation failed", e);
      throw new Error("Failed to generate backup.");
    }
  },

  async restoreBackup(rawJson: any): Promise<boolean> {
    try {
      if (!rawJson || !rawJson.meta || !rawJson.data) {
        throw new Error("Invalid backup format.");
      }

      const { history, profiles, gameState } = rawJson.data;

      // Persistência Atômica
      const operations = [];
      
      if (history) operations.push(SecureStorage.save(KEY_HISTORY, history));
      if (profiles && Array.isArray(profiles)) operations.push(SecureStorage.save(KEY_PROFILES, profiles));
      if (gameState) operations.push(SecureStorage.save(KEY_GAME_STATE, gameState));

      await Promise.all(operations);
      
      return true;
    } catch (e) {
      console.error("[Backup] Restore failed", e);
      return false;
    }
  }
};
