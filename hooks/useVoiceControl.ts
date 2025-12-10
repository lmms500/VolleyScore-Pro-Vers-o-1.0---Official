
import { useState, useEffect, useCallback, useRef } from 'react';
import { TeamId, Player, SkillType } from '../types';
import { VoiceRecognitionService } from '../services/VoiceRecognitionService';
import { VoiceCommandParser, VoiceCommandIntent } from '../services/VoiceCommandParser';
import { GeminiCommandService } from '../services/GeminiCommandService';

interface UseVoiceControlProps {
  enabled: boolean;
  enablePlayerStats: boolean;
  onAddPoint: (team: TeamId, playerId?: string, skill?: SkillType) => void;
  onSubtractPoint: (team: TeamId) => void;
  onUndo: () => void;
  onTimeout: (team: TeamId) => void;
  onSetServer: (team: TeamId) => void;
  onError?: (errorType: 'permission' | 'network' | 'generic', transcript?: string) => void;
  onUnknownCommand?: (transcript: string) => void;
  
  language: string;
  teamAName: string;
  teamBName: string;
  playersA: Player[];
  playersB: Player[];
  servingTeam: TeamId | null; // NEW: Context
}

const INTERIM_DELAY_MS = 1500; 
const COMMAND_COOLDOWN_MS = 1000; 

export const useVoiceControl = ({ 
    enabled, enablePlayerStats, onAddPoint, onSubtractPoint, onUndo, onTimeout, onSetServer,
    onError, onUnknownCommand,
    language, teamAName, teamBName, playersA, playersB, servingTeam 
}: UseVoiceControlProps) => {
  const [isListening, setIsListening] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const [isProcessingAI, setIsProcessingAI] = useState(false);
  
  const wantsListeningRef = useRef(false);
  const lastExecutedTimeRef = useRef<number>(0);
  const pendingActionRef = useRef<VoiceCommandIntent | null>(null);
  const executionTimerRef = useRef<any>(null);
  
  // Anti-Duplicate Strategy
  const processedTextSet = useRef<Set<string>>(new Set());
  
  const recognitionService = useRef(VoiceRecognitionService.getInstance()).current;
  const geminiService = useRef(GeminiCommandService.getInstance()).current;

  // Cleanup processed text set
  useEffect(() => {
      const interval = setInterval(() => {
          processedTextSet.current.clear();
      }, 5000);
      return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const checkAvailability = async () => {
      const available = await recognitionService.isAvailable();
      setIsSupported(available);
    };
    checkAvailability();
  }, []);

  // --- COMMAND EXECUTOR ---
  const executeIntent = useCallback((intent: VoiceCommandIntent) => {
      const now = Date.now();
      
      // 1. Cooldown Check
      if (now - lastExecutedTimeRef.current < COMMAND_COOLDOWN_MS) {
          pendingActionRef.current = null;
          return;
      }

      // 2. Duplicate Text Check (For Undo safety)
      const textKey = `${intent.type}:${intent.rawText.toLowerCase()}`;
      if (processedTextSet.current.has(textKey) && intent.type === 'undo') {
          return;
      }

      // Execute
      lastExecutedTimeRef.current = now;
      processedTextSet.current.add(textKey);
      
      console.log(`[Voice] Executing: ${intent.debugMessage}`);

      if (intent.type === 'timeout' && intent.team) {
          onTimeout(intent.team);
      } else if (intent.type === 'server' && intent.team) {
          onSetServer(intent.team);
      } else if (intent.type === 'undo') {
          onUndo();
      } else if (intent.type === 'point' && intent.team) {
          if (intent.isNegative) {
              onSubtractPoint(intent.team);
          } else {
              // Handle "Unknown" vs "Identified"
              const finalPlayerId = (enablePlayerStats && intent.player?.id) ? intent.player.id : (enablePlayerStats ? 'unknown' : undefined);
              onAddPoint(intent.team, finalPlayerId, intent.skill);
          }
      }
  }, [onAddPoint, onSubtractPoint, onUndo, onTimeout, onSetServer, enablePlayerStats]);

  const executeAction = useCallback(async () => {
      const action = pendingActionRef.current;
      if (!action) return;

      // Strategies: Local Fast-Path OR Cloud AI Fallback
      // If local parser flagged uncertainty OR confidence is low, attempt AI.
      if (action.requiresMoreInfo || action.confidence < 0.85) {
          console.log('[Voice] Local parse incomplete/uncertain. Engaging Gemini AI...');
          setIsProcessingAI(true);
          
          const aiResult = await geminiService.parseCommand(action.rawText, {
              teamAName, teamBName, playersA, playersB
          });
          
          setIsProcessingAI(false);

          if (aiResult && aiResult.type !== 'unknown') {
              const aiIntent: VoiceCommandIntent = {
                  type: aiResult.type,
                  team: aiResult.team,
                  player: aiResult.playerId ? { id: aiResult.playerId, name: 'AI Match' } : undefined,
                  skill: aiResult.skill,
                  isNegative: aiResult.isNegative,
                  confidence: 1,
                  rawText: action.rawText,
                  debugMessage: `AI Resolved: ${aiResult.type} for ${aiResult.team}`
              };
              executeIntent(aiIntent);
              pendingActionRef.current = null;
              return;
          } else if (action.type === 'server') {
              // If AI failed on 'Server' and local was ambiguous, abort. Do not toggle blindly.
              console.log('[Voice] AI failed to resolve Serve team. Aborting.');
              pendingActionRef.current = null;
              return;
          }
      }

      if (action.requiresMoreInfo) {
          console.log('[Voice] Incomplete command, executing best effort.');
          if (action.team) {
              executeIntent({ ...action, player: undefined, skill: undefined });
          }
      } else {
          executeIntent(action);
      }

      pendingActionRef.current = null;
  }, [executeIntent, teamAName, teamBName, playersA, playersB, geminiService]);

  // --- RESULT PROCESSOR ---
  const handleResult = useCallback((text: string, isFinal: boolean) => {
      if (executionTimerRef.current) clearTimeout(executionTimerRef.current);

      const intent = VoiceCommandParser.parse(text, language, {
          teamAName, teamBName, playersA, playersB, statsEnabled: enablePlayerStats, servingTeam
      });

      if (!intent) return;

      if (intent.type === 'undo') {
          pendingActionRef.current = null;
          executeIntent(intent);
          return;
      }

      if (intent.type === 'unknown' && isFinal) {
          // Always try AI for unknown final commands
          pendingActionRef.current = { ...intent, requiresMoreInfo: true };
          executeAction();
          return;
      }

      if (intent.type !== 'unknown') {
          const current = pendingActionRef.current;
          let mergedIntent = { ...intent };
          
          if (current && current.requiresMoreInfo) {
              if (intent.team) mergedIntent.team = intent.team;
              if (intent.player) mergedIntent.player = intent.player;
              if (current.skill && !intent.skill) mergedIntent.skill = current.skill;
              
              if (mergedIntent.team && (mergedIntent.player || !enablePlayerStats)) {
                  mergedIntent.requiresMoreInfo = false;
              }
          }

          pendingActionRef.current = mergedIntent;
          
          if (isFinal) {
              executeAction();
          } else {
              if (!mergedIntent.requiresMoreInfo) {
                  executionTimerRef.current = setTimeout(executeAction, INTERIM_DELAY_MS);
              }
          }
      }

  }, [language, teamAName, teamBName, playersA, playersB, servingTeam, executeAction, executeIntent, onUnknownCommand, enablePlayerStats]);

  useEffect(() => {
      recognitionService.setCallbacks(
          handleResult,
          (err) => {
              if (err === 'permission') wantsListeningRef.current = false;
              onError?.(err);
          },
          (status) => {
              setIsListening(status);
              if (!status && wantsListeningRef.current) {
                  setTimeout(() => {
                      recognitionService.start(language);
                  }, 250);
              }
          }
      );
  }, [handleResult, onError, language]);

  const toggleListening = useCallback(async () => {
      if (!isSupported) return;

      if (wantsListeningRef.current) {
          wantsListeningRef.current = false;
          await recognitionService.stop();
      } else {
          const hasPerm = await recognitionService.requestPermissions();
          if (!hasPerm) {
              onError?.('permission');
              return;
          }
          wantsListeningRef.current = true;
          recognitionService.start(language);
      }
  }, [isSupported, onError, language]);

  useEffect(() => {
      if (!enabled && wantsListeningRef.current) {
          wantsListeningRef.current = false;
          recognitionService.stop();
      }
  }, [enabled]);

  return { isListening, isSupported, toggleListening, isProcessingAI };
};
