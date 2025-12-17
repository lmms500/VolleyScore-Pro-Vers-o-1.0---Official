
import { doc, setDoc, getDocs, collection, query, writeBatch, serverTimestamp, orderBy, limit } from 'firebase/firestore';
import { db, isFirebaseInitialized } from './firebase';
import { Match } from '../stores/historyStore';
import { PlayerProfile } from '../types';

/**
 * SyncService v2.0
 * Absolute Data Integrity Protocol
 */
export const SyncService = {
    
    /**
     * Uploads a single match to the cloud.
     */
    async pushMatch(userId: string, match: Match): Promise<boolean> {
        if (!isFirebaseInitialized || !db || !userId || !match.id) return false;
        
        try {
            const matchRef = doc(db, 'users', userId, 'matches', match.id);
            // Ensure no circular refs and strip undefined
            const cleanMatch = JSON.parse(JSON.stringify(match));
            
            // Add server metadata for conflict resolution if needed later
            const payload = {
                ...cleanMatch,
                _lastSynced: serverTimestamp(),
                _syncStatus: 'synced'
            };

            await setDoc(matchRef, payload, { merge: true });
            console.debug(`[Sync] Match ${match.id} pushed.`);
            return true;
        } catch (e) {
            console.error('[Sync] pushMatch failed:', e);
            return false;
        }
    },

    /**
     * Bulk Updates profiles using atomic batching.
     */
    async pushProfiles(userId: string, profiles: PlayerProfile[]): Promise<boolean> {
        if (!isFirebaseInitialized || !db || !userId || profiles.length === 0) return false;
        
        try {
            const batch = writeBatch(db);
            profiles.forEach(profile => {
                const ref = doc(db, 'users', userId, 'profiles', profile.id);
                const cleanProfile = JSON.parse(JSON.stringify(profile));
                batch.set(ref, {
                    ...cleanProfile,
                    _lastSynced: serverTimestamp()
                }, { merge: true });
            });
            await batch.commit();
            console.debug(`[Sync] ${profiles.length} profiles pushed.`);
            return true;
        } catch (e) {
            console.error('[Sync] pushProfiles failed:', e);
            return false;
        }
    },

    /**
     * Pulls match history with basic ordering.
     */
    async pullMatches(userId: string): Promise<Match[]> {
        if (!isFirebaseInitialized || !db || !userId) return [];
        
        try {
            const matchesCol = collection(db, 'users', userId, 'matches');
            const q = query(matchesCol, orderBy('timestamp', 'desc'), limit(100));
            const snapshot = await getDocs(q);
            
            const matches: Match[] = [];
            snapshot.forEach(doc => {
                matches.push(doc.data() as Match);
            });
            return matches;
        } catch (e) {
            console.error('[Sync] pullMatches failed:', e);
            return [];
        }
    },

    /**
     * Pulls profiles for synchronization.
     */
    async pullProfiles(userId: string): Promise<PlayerProfile[]> {
        if (!isFirebaseInitialized || !db || !userId) return [];
        
        try {
            const profilesCol = collection(db, 'users', userId, 'profiles');
            const snapshot = await getDocs(profilesCol);
            
            const profiles: PlayerProfile[] = [];
            snapshot.forEach(doc => {
                profiles.push(doc.data() as PlayerProfile);
            });
            return profiles;
        } catch (e) {
            console.error('[Sync] pullProfiles failed:', e);
            return [];
        }
    }
};
