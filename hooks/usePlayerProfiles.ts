

import { useState, useEffect, useCallback } from 'react';
import { PlayerProfile } from '../types';
import { SecureStorage } from '../services/SecureStorage';
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

  const upsertProfile = useCallback((name: string, skillLevel: number, id?: string, extras?: { number?: string, avatar?: string }): PlayerProfile => {
    const cleanName = name.trim();
    const now = Date.now();
    
    // Check if updating existing or creating new
    let existing: PlayerProfile | undefined;
    if (id) {
        existing = profiles.get(id);
    }
    
    const newProfile: PlayerProfile = {
      id: existing?.id || uuidv4(),
      name: cleanName,
      skillLevel: Math.min(10, Math.max(1, skillLevel)),
      number: extras?.number !== undefined ? extras.number : existing?.number,
      avatar: extras?.avatar !== undefined ? extras.avatar : existing?.avatar,
      createdAt: existing?.createdAt || now,
      lastUpdated: now
    };

    setProfiles(prev => {
      const next = new Map(prev);
      next.set(newProfile.id, newProfile);
      return next;
    });

    return newProfile;
  }, [profiles]);

  const deleteProfile = useCallback((id: string) => {
    setProfiles(prev => {
      const next = new Map(prev);
      next.delete(id);
      return next;
    });
  }, []);

  const findProfileByName = useCallback((name: string): PlayerProfile | undefined => {
    const search = name.trim().toLowerCase();
    for (const profile of profiles.values()) {
        if (profile.name.toLowerCase() === search) return profile;
    }
    return undefined;
  }, [profiles]);

  const getProfile = useCallback((id: string) => profiles.get(id), [profiles]);

  return {
    profiles, // Exposed for sync checking
    upsertProfile,
    deleteProfile,
    findProfileByName,
    getProfile,
    isReady
  };
};