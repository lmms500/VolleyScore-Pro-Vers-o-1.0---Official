
import { Preferences } from '@capacitor/preferences';
import { Capacitor } from '@capacitor/core';
import { get, set, del } from 'idb-keyval';

/**
 * SecureStorage Service v3.0 (Encryption Enabled)
 * 
 * Architecture:
 * - Uses Web Crypto API (AES-GCM 256-bit) to encrypt all data before storage.
 * - Stores unique encryption key in IndexedDB (idb-keyval) which is separate from LocalStorage.
 * - Fallback to plain JSON parsing if decryption fails (Migration Strategy).
 * - Universal adapter for Web/PWA and Native environments.
 */

const APP_PREFIX = 'vs_pro_v3_';
const MASTER_KEY_ID = 'master_enc_key_v1';

// Wrapper for stored data containing IV and Ciphertext
interface EncryptedEnvelope {
  iv: number[]; // Array.from(Uint8Array) for JSON serialization
  data: number[]; // Array.from(Uint8Array)
  version: string;
  timestamp: number;
}

const isCryptoAvailable = (): boolean => {
  return typeof window !== 'undefined' && !!window.crypto && !!window.crypto.subtle;
};

// --- KEY MANAGEMENT ---

const getOrGenerateKey = async (): Promise<CryptoKey> => {
  try {
    // 1. Try to fetch existing key from IDB
    const exportedKey = await get<JsonWebKey>(MASTER_KEY_ID);
    
    if (exportedKey) {
      return await window.crypto.subtle.importKey(
        'jwk',
        exportedKey,
        { name: 'AES-GCM' },
        true,
        ['encrypt', 'decrypt']
      );
    }

    // 2. Generate new key if none exists
    const key = await window.crypto.subtle.generateKey(
      { name: 'AES-GCM', length: 256 },
      true,
      ['encrypt', 'decrypt']
    );

    // 3. Export and save key securely
    const exportRaw = await window.crypto.subtle.exportKey('jwk', key);
    await set(MASTER_KEY_ID, exportRaw);
    
    return key;
  } catch (e) {
    console.error("Crypto Key Error:", e);
    throw new Error("Failed to initialize secure storage key.");
  }
};

export const SecureStorage = {
  /**
   * Saves data encrypted with AES-GCM.
   */
  async save<T>(key: string, data: T): Promise<void> {
    try {
      if (!isCryptoAvailable()) {
        console.warn("WebCrypto unavailable. Falling back to plain storage.");
        await set(APP_PREFIX + key, JSON.stringify(data));
        return;
      }

      const encryptionKey = await getOrGenerateKey();
      const jsonContent = JSON.stringify(data);
      const encoder = new TextEncoder();
      const encodedData = encoder.encode(jsonContent);

      // Generate random IV (Initialization Vector) - 12 bytes for GCM
      const iv = window.crypto.getRandomValues(new Uint8Array(12));

      const encryptedBuffer = await window.crypto.subtle.encrypt(
        { name: 'AES-GCM', iv: iv },
        encryptionKey,
        encodedData
      );

      const envelope: EncryptedEnvelope = {
        iv: Array.from(iv),
        data: Array.from(new Uint8Array(encryptedBuffer)),
        version: '3.0.0',
        timestamp: Date.now()
      };

      await set(APP_PREFIX + key, JSON.stringify(envelope));

    } catch (error) {
      console.error('SecureStorage Save Error:', error);
    }
  },

  /**
   * Loads data, attempting decryption.
   * Handles migration from unencrypted data automatically.
   */
  async load<T>(key: string): Promise<T | null> {
    const fullKey = APP_PREFIX + key;
    let raw: string | undefined | null = null;

    try {
      // 1. Load Raw Data
      raw = await get<string>(fullKey);

      // Legacy Migration: Check Native Prefs / LocalStorage if IDB is empty
      if (!raw) {
         if (Capacitor.isNativePlatform()) {
             const { value } = await Preferences.get({ key: fullKey });
             if (value) {
                 await set(fullKey, value); // Move to IDB
                 await Preferences.remove({ key: fullKey });
                 raw = value;
             }
         } else {
             const local = localStorage.getItem(fullKey);
             if (local) {
                 await set(fullKey, local);
                 localStorage.removeItem(fullKey);
                 raw = local;
             }
         }
      }

      if (!raw) return null;

      // 2. Parse Envelope
      let envelope: any;
      try {
        envelope = JSON.parse(raw);
      } catch {
        // If JSON parse fails, it might be raw string data or corrupted
        return null; 
      }

      // 3. Attempt Decryption
      if (envelope && envelope.iv && envelope.data && envelope.version === '3.0.0' && isCryptoAvailable()) {
        try {
          const encryptionKey = await getOrGenerateKey();
          const iv = new Uint8Array(envelope.iv);
          const data = new Uint8Array(envelope.data);

          const decryptedBuffer = await window.crypto.subtle.decrypt(
            { name: 'AES-GCM', iv: iv },
            encryptionKey,
            data
          );

          const decoder = new TextDecoder();
          const jsonString = decoder.decode(decryptedBuffer);
          return JSON.parse(jsonString);

        } catch (decryptError) {
          console.error("Decryption failed. Data might be corrupted or key lost.", decryptError);
          return null;
        }
      }

      // 4. Fallback: Plain JSON (Migration Path for v2 data)
      // If structure doesn't match EncryptedEnvelope, assume it's legacy plain JSON
      return envelope as T;

    } catch (error) {
      console.error('SecureStorage Load Error:', error);
      return null;
    }
  },

  async remove(key: string) {
    const fullKey = APP_PREFIX + key;
    await del(fullKey);
    
    if (Capacitor.isNativePlatform()) {
        await Preferences.remove({ key: fullKey }).catch(() => {});
    }
    localStorage.removeItem(fullKey);
  }
};
