
import { useState, useEffect, useCallback } from 'react';
import { PlayerProfile, PlayerRole, ProfileStats } from '../types';
import { SecureStorage } from '../services/SecureStorage';
import { mergeStats, StatsDelta } from '../utils/statsEngine';
import { v4 as uuidv4 } from 'uuid';

const PROFILES_STORAGE_KEY = 'player_profiles_master';

export const usePlayerProfiles = () => {
  const [profiles, setProfiles] = useState<Map<string, PlayerProfile>>(new Map());
  const [isReady, setIsReady] = useState(false);

  // Load profiles on mount
  useEffect(() => {
    const load = async () => {
      const storedData = await SecureStorage.load<PlayerProfile[]>(PROFILES_STORAGE_KEY);
      if (storedData && Array.isArray(storedData)) {
        const map = new Map();
        storedData.forEach(p => map.set(p.id, p));
        setProfiles(map);
      }
      setIsReady(true);
    };
    load();
  }, []);

  // Save profiles whenever they change
  useEffect(() => {
    if (!isReady) return;
    const array = Array.from(profiles.values());
    SecureStorage.save(PROFILES_STORAGE_KEY, array);
  }, [profiles, isReady]);

  const findProfileByName = useCallback((name: string): PlayerProfile | undefined => {
    const search = name.trim().toLowerCase();
    for (const profile of profiles.values()) {
        if (profile.name.toLowerCase() === search) return profile;
    }
    return undefined;
  }, [profiles]);

  /**
   * Smart Upsert: 
   * - If 'id' is provided, it forces an UPDATE on that specific profile.
   * - If 'id' is NOT provided, it acts as CREATE, checking name for deduplication.
   */
  const upsertProfile = useCallback((name: string, skillLevel: number, id?: string, extras?: { number?: string, avatar?: string, role?: PlayerRole }): PlayerProfile => {
    const cleanName = name.trim();
    const now = Date.now();
    
    let existing: PlayerProfile | undefined;
    
    // 1. EDIT MODE: Find strict match by ID
    if (id) {
        existing = profiles.get(id);
    } 
    // 2. CREATE MODE: Check for duplicate name
    else {
        existing = findProfileByName(cleanName);
    }
    
    const newProfile: PlayerProfile = {
      id: existing?.id || uuidv4(),
      name: cleanName, // Always update name
      skillLevel: Math.min(10, Math.max(1, skillLevel)),
      // Merge logic: Use new val if provided, else fall back to existing, else undefined
      number: extras?.number !== undefined ? extras.number : existing?.number,
      avatar: extras?.avatar !== undefined ? extras.avatar : existing?.avatar,
      role: extras?.role !== undefined ? extras.role : existing?.role,
      stats: existing?.stats, 
      createdAt: existing?.createdAt || now,
      lastUpdated: now
    };

    setProfiles(prev => {
      const next = new Map(prev);
      next.set(newProfile.id, newProfile);
      return next;
    });

    return newProfile;
  }, [profiles, findProfileByName]);

  const batchUpdateStats = useCallback((updates: Map<string, StatsDelta>) => {
    setProfiles((prev: Map<string, PlayerProfile>) => {
      const next = new Map(prev);
      let hasChanges = false;

      updates.forEach((delta, profileId) => {
        const profile = next.get(profileId);
        if (profile) {
          const newStats = mergeStats(profile.stats, delta);
          
          next.set(profileId, {
            ...profile,
            stats: newStats,
            lastUpdated: Date.now()
          });
          hasChanges = true;
        }
      });

      return hasChanges ? next : prev;
    });
  }, []);

  const deleteProfile = useCallback((id: string): PlayerProfile | undefined => {
    const profileToDelete = profiles.get(id);
    if (profileToDelete) {
        setProfiles(prev => {
          const next = new Map(prev);
          next.delete(id);
          return next;
        });
    }
    return profileToDelete;
  }, [profiles]);

  const getProfile = useCallback((id: string) => profiles.get(id), [profiles]);

  return {
    profiles, 
    upsertProfile,
    deleteProfile,
    findProfileByName,
    getProfile,
    batchUpdateStats,
    isReady
  };
};
