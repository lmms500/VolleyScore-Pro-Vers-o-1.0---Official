
import { Preferences } from '@capacitor/preferences';
import { Capacitor } from '@capacitor/core';
import { get, set, del } from 'idb-keyval';

/**
 * SecureStorage Service v2.1
 * 
 * Architecture:
 * - Primary: Uses IndexedDB via idb-keyval for ALL platforms (Web & Native).
 *   Reason: Capacitor Preferences has size limits on Android/iOS causing crashes with large game logs.
 *   IndexedDB in WebView handles large JSON blobs efficiently.
 * - Migration: Automatically migrates data from Preferences (Native Legacy) or LocalStorage (Web Legacy) to IDB on load.
 * 
 * Implements integrity hashing to detect tampering.
 */

const APP_PREFIX = 'vs_pro_v2_';
const INTEGRITY_SALT = 'VolleyScore_Sec_Salt_992834'; 

interface StorageEnvelope<T> {
  data: T;
  hash: string;
  timestamp: number;
  version: string;
}

const BYPASS_HASH = "INSECURE_CONTEXT_BYPASS";

const isCryptoAvailable = (): boolean => {
  return typeof window !== 'undefined' && !!window.crypto && !!window.crypto.subtle;
};

const generateHash = async (content: string): Promise<string> => {
  if (!isCryptoAvailable()) {
    return BYPASS_HASH;
  }
  try {
    const encoder = new TextEncoder();
    const data = encoder.encode(content + INTEGRITY_SALT);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  } catch (e) {
    return BYPASS_HASH;
  }
};

export const SecureStorage = {
  /**
   * Saves data with an integrity hash.
   * Uses IndexedDB universally.
   */
  async save<T>(key: string, data: T): Promise<void> {
    try {
      const jsonContent = JSON.stringify(data);
      const hash = await generateHash(jsonContent);
      
      const envelope: StorageEnvelope<T> = {
        data,
        hash,
        timestamp: Date.now(),
        version: '2.1.0'
      };

      const finalString = JSON.stringify(envelope);
      const fullKey = APP_PREFIX + key;

      // Universally use IndexedDB (Async & Non-blocking)
      await set(fullKey, finalString);

    } catch (error) {
      console.error('SecureStorage Save Error:', error);
    }
  },

  /**
   * Loads data, verifies integrity, and handles migration.
   */
  async load<T>(key: string): Promise<T | null> {
    try {
      const fullKey = APP_PREFIX + key;
      let raw: string | undefined | null = null;

      // 1. Try IndexedDB First (Primary Storage)
      raw = await get<string>(fullKey);

      // 2. Migration: Check Native Preferences (Legacy Native Storage)
      if (!raw && Capacitor.isNativePlatform()) {
          try {
              const { value } = await Preferences.get({ key: fullKey });
              if (value) {
                  console.debug(`[SecureStorage] Migrating ${key} from Preferences to IDB`);
                  await set(fullKey, value); // Move to IDB
                  await Preferences.remove({ key: fullKey }); // Cleanup old
                  raw = value;
              }
          } catch (e) {
              console.warn('[SecureStorage] Native migration check failed', e);
          }
      }

      // 3. Migration: Check LocalStorage (Legacy Web Storage)
      if (!raw) {
          try {
              const legacyRaw = localStorage.getItem(fullKey);
              if (legacyRaw) {
                  console.debug(`[SecureStorage] Migrating ${key} from LocalStorage to IDB`);
                  await set(fullKey, legacyRaw); // Move to IDB
                  localStorage.removeItem(fullKey); // Cleanup old
                  raw = legacyRaw;
              }
          } catch (e) {
              // Ignore access errors
          }
      }

      if (!raw) return null;

      let envelope: StorageEnvelope<T>;
      try {
          envelope = JSON.parse(raw);
      } catch (e) {
          console.warn(`SecureStorage: Corrupted JSON for ${key}.`);
          return null;
      }
      
      if (!envelope || typeof envelope !== 'object' || !envelope.data) {
        return null;
      }

      // Integrity Check
      const jsonContent = JSON.stringify(envelope.data);
      const calculatedHash = await generateHash(jsonContent);

      if (calculatedHash !== BYPASS_HASH && envelope.hash !== BYPASS_HASH) {
          if (calculatedHash !== envelope.hash) {
            console.error(`SecureStorage: Integrity Check Failed for ${key}.`);
            return null; 
          }
      }

      return envelope.data;
    } catch (error) {
      console.error('SecureStorage Load Error:', error);
      return null;
    }
  },

  /**
   * Remove key from all storages
   */
  async remove(key: string) {
    const fullKey = APP_PREFIX + key;
    
    // Clean everywhere to be safe
    await del(fullKey); // IDB
    
    if (Capacitor.isNativePlatform()) {
        await Preferences.remove({ key: fullKey }).catch(() => {});
    }
    
    localStorage.removeItem(fullKey);
  }
};
