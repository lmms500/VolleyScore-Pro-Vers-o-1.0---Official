import { useEffect, useRef, useCallback } from 'react';
import { GameState } from '../types';
import { useTranslation } from '../contexts/LanguageContext';
import { ttsService } from '../services/TTSService';

interface UseScoreAnnouncerProps {
  state: GameState;
  enabled: boolean;
}

export const useScoreAnnouncer = ({ state, enabled }: UseScoreAnnouncerProps) => {
  const { language } = useTranslation();
  
  // Track previous state to detect changes
  const prevScoreA = useRef(state.scoreA);
  const prevScoreB = useRef(state.scoreB);
  const prevSetsA = useRef(state.setsA);
  const prevSetsB = useRef(state.setsB);
  const prevTimeoutsA = useRef(state.timeoutsA);
  const prevTimeoutsB = useRef(state.timeoutsB);

  // Debounce ref to prevent spamming
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const speak = useCallback((text: string) => {
    if (!enabled) return;

    // Map internal language codes to BCP 47 tags for TTS
    const langMap: Record<string, string> = { 
        'pt': 'pt-BR', 
        'en': 'en-US', 
        'es': 'es-ES' 
    };
    const targetLang = langMap[language] || 'en-US';
    const targetGender = state.config.voiceGender || 'female';

    ttsService.speak(text, targetLang, targetGender);
  }, [enabled, language, state.config.voiceGender]);

  useEffect(() => {
    if (!enabled) {
        // Sync refs so enabling doesn't trigger old events
        prevScoreA.current = state.scoreA;
        prevScoreB.current = state.scoreB;
        prevSetsA.current = state.setsA;
        prevSetsB.current = state.setsB;
        return;
    }

    const configFreq = state.config.announcementFreq || 'all';

    // --- TIMEOUTS ---
    if (state.timeoutsA > prevTimeoutsA.current || state.timeoutsB > prevTimeoutsB.current) {
        const teamName = state.timeoutsA > prevTimeoutsA.current ? state.teamAName : state.teamBName;
        // Timeouts are critical events, always announce
        speak(`Timeout ${teamName}`);
    }
    prevTimeoutsA.current = state.timeoutsA;
    prevTimeoutsB.current = state.timeoutsB;

    // --- SCORE CHANGE DETECTION ---
    const scoreChanged = state.scoreA !== prevScoreA.current || state.scoreB !== prevScoreB.current;
    
    // Only announce if score INCREASED (ignore undos/resets for simplicity)
    const scoreIncreased = state.scoreA > prevScoreA.current || state.scoreB > prevScoreB.current;

    // --- SET/MATCH END ---
    const setChanged = state.setsA !== prevSetsA.current || state.setsB !== prevSetsB.current;
    
    if (setChanged) {
        // Set/Match end are critical events
        if (state.isMatchOver) {
            speak(`Match over. Winner ${state.matchWinner === 'A' ? state.teamAName : state.teamBName}`);
        } else {
            speak(`Set to ${state.setsA > prevSetsA.current ? state.teamAName : state.teamBName}`);
        }
        prevSetsA.current = state.setsA;
        prevSetsB.current = state.setsB;
        prevScoreA.current = state.scoreA;
        prevScoreB.current = state.scoreB;
        return;
    }

    if (scoreChanged && scoreIncreased) {
        // Debounce score announcements to handle rapid taps
        if (debounceRef.current) clearTimeout(debounceRef.current);

        debounceRef.current = setTimeout(() => {
            const leader = state.scoreA > state.scoreB ? state.teamAName : (state.scoreB > state.scoreA ? state.teamBName : null);
            const isTied = state.scoreA === state.scoreB;
            
            let phrase = "";
            let isCriticalEvent = false;
            
            // Critical Points Check
            const isMatchPoint = (state.scoreA >= state.config.pointsPerSet - 1 || state.scoreB >= state.config.pointsPerSet - 1) && 
                                 (Math.abs(state.scoreA - state.scoreB) >= 1) && 
                                 ((state.setsA === Math.ceil(state.config.maxSets/2)-1 && state.scoreA > state.scoreB) || (state.setsB === Math.ceil(state.config.maxSets/2)-1 && state.scoreB > state.scoreA));

            if (isMatchPoint) {
                phrase = `Match Point ${leader}. ${state.scoreA} ${state.scoreB}`;
                isCriticalEvent = true;
            } else if (state.inSuddenDeath) {
                phrase = `Sudden Death. ${state.scoreA} ${state.scoreB}`;
                isCriticalEvent = true;
            } else {
                // Standard Announcement
                // If frequency is 'critical_only', we SKIP this block
                if (configFreq === 'critical_only') {
                    // Do nothing
                } else {
                    if (isTied) {
                        phrase = `${state.scoreA} All.`;
                    } else {
                        // Always announce Serving team first if known, otherwise Leader
                        if (state.servingTeam === 'A') {
                            phrase = `${state.scoreA} serving ${state.scoreB}`;
                        } else if (state.servingTeam === 'B') {
                            phrase = `${state.scoreB} serving ${state.scoreA}`;
                        } else {
                            // Fallback
                            phrase = `${state.scoreA} ${state.scoreB}`;
                        }
                    }
                }
            }
            
            if (phrase) speak(phrase);

        }, 800); // 800ms debounce
    }

    prevScoreA.current = state.scoreA;
    prevScoreB.current = state.scoreB;

  }, [state.scoreA, state.scoreB, state.setsA, state.setsB, state.timeoutsA, state.timeoutsB, enabled, language, speak, state.config.announcementFreq]);
};