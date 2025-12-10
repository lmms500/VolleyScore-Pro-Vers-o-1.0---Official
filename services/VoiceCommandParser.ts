
import { TeamId, Player, SkillType } from '../types';
import { isFuzzyMatch } from '../utils/stringUtils';

export interface VoiceCommandIntent {
  type: 'point' | 'timeout' | 'server' | 'undo' | 'unknown';
  team?: TeamId;
  player?: { id: string; name: string };
  skill?: SkillType;
  isNegative?: boolean;
  confidence: number;
  rawText: string;
  debugMessage?: string;
  requiresMoreInfo?: boolean;
}

// --- VOCABULARY DEFINITIONS ---

const VOCABULARY: Record<string, {
  teamA_Strict: string[];
  teamB_Strict: string[];
  pointTriggers: string[];
  negative: string[]; 
  globalUndo: string[];
  timeout: string[];
  server: string[]; 
  prepositions: string[];
  skills: {
      attack: string[];
      block: string[];
      ace: string[];
      opponent_error: string[];
  }
}> = {
  pt: {
    teamA_Strict: ['time a', 'equipe a', 'lado a', 'mandante', 'casa', 'esquerda', 'time da casa'],
    teamB_Strict: ['time b', 'equipe b', 'lado b', 'visitante', 'fora', 'direita', 'time de fora'],
    pointTriggers: ['ponto', 'marcou', 'vai', 'ponto para', 'ponto do', 'ponto da', 'número', 'camisa', 'jogador', 'adicionar', 'mais um'],
    negative: ['tirar', 'remover', 'menos', 'subtrair', 'apagar', 'retirar', 'não foi', 'cancelar', 'volta', 'corrigir'],
    globalUndo: ['desfazer', 'voltar', 'cancelar', 'engano', 'ops', 'undo'],
    timeout: ['tempo', 'parar', 'pausa', 'time out', 'pedido de tempo'],
    // Expanded Server Vocabulary
    server: ['troca de saque', 'mudança de saque', 'bola com', 'servidor', 'serviço de', 'rodar', 'girar', 'saque', 'servir', 'bola', 'serviço', 'de quem é', 'com quem está', 'sacar'], 
    prepositions: ['do', 'da', 'de', 'para', 'pelo', 'pela', 'o', 'no', 'na', 'com'],
    skills: {
        attack: ['ataque', 'cortada', 'cravou', 'bomba', 'frente', 'fundo', 'de ataque', 'atacou', 'largadinha', 'largada'],
        block: ['bloqueio', 'block', 'paredão', 'toco', 'de bloqueio', 'bloqueou', 'fechou'],
        ace: ['ace', 'saque', 'serviço', 'ponto de saque', 'direto', 'sacou'],
        opponent_error: ['erro', 'fora', 'rede', 'toque', 'invasão', 'dois toques', 'erro deles', 'erro dela', 'erro dele', 'condução']
    }
  },
  en: {
    teamA_Strict: ['team a', 'home', 'host', 'left side', 'home team'],
    teamB_Strict: ['team b', 'guest', 'away', 'right side', 'away team'],
    pointTriggers: ['point', 'score', 'goal', 'point for', 'number', 'jersey', 'player', 'add', 'plus one'],
    negative: ['remove', 'minus', 'subtract', 'delete', 'take', 'correction', 'not', 'cancel'],
    globalUndo: ['undo', 'back', 'cancel', 'oops', 'revert'],
    timeout: ['timeout', 'time out', 'pause', 'break'],
    // Expanded Server Vocabulary including 'sack' (phonetic match for saque)
    server: ['change server', 'change serve', 'ball to', 'service change', 'rotate', 'side out', 'serve', 'service', 'ball', 'possession', 'sack'], 
    prepositions: ['of', 'for', 'by', 'the', 'from', 'with', 'to'],
    skills: {
        attack: ['attack', 'kill', 'spike', 'hit', 'smash', 'attack point', 'tip', 'dump'],
        block: ['block', 'roof', 'wall', 'stuff', 'block point'],
        ace: ['ace', 'serve', 'service', 'ace point'],
        opponent_error: ['error', 'out', 'net', 'fault', 'mistake', 'opponent error', 'touch']
    }
  },
  es: {
    teamA_Strict: ['equipo a', 'local', 'casa'],
    teamB_Strict: ['equipo b', 'visitante', 'fuera'],
    pointTriggers: ['punto', 'marcó', 'anotó', 'punto para', 'numero', 'jugador', 'sumar'],
    negative: ['quitar', 'restar', 'menos', 'borrar', 'sacar', 'no fue', 'cancelar'],
    globalUndo: ['deshacer', 'volver', 'cancelar', 'corrección', 'atrás'],
    timeout: ['tiempo', 'pausa', 'time out', 'pedir tiempo'],
    // Expanded Server Vocabulary
    server: ['cambio de saque', 'cambio servicio', 'bola para', 'rotar', 'saque', 'servicio', 'bola', 'balón'],
    prepositions: ['de', 'del', 'para', 'por', 'el', 'la', 'con'],
    skills: {
        attack: ['ataque', 'remate', 'clavo', 'mate', 'punto de ataque', 'finta'],
        block: ['bloqueo', 'block', 'muro', 'punto de bloqueo', 'tapa'],
        ace: ['ace', 'saque', 'servicio', 'directo', 'punto de saque'],
        opponent_error: ['error', 'fuera', 'red', 'falla', 'error rival', 'doble']
    }
  }
};

export class VoiceCommandParser {
  
  private static normalizeText(text: string): string {
    return text.toLowerCase()
      .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, "") // Remove punctuation
      .replace(/\s{2,}/g, " ") // Remove extra spaces
      .trim();
  }

  private static removePrepositions(text: string, vocab: any): string {
      const words = text.split(' ');
      // Filter out prepositions, but allow 'a' if it's part of a known entity pattern handled later
      return words.filter(w => !vocab.prepositions.includes(w)).join(' ');
  }

  private static findSkill(text: string, vocab: any): SkillType | undefined {
      // Priority: Ace > Block > Attack > Error
      if (vocab.skills.ace.some((k: string) => text.includes(k))) return 'ace'; 
      if (vocab.skills.block.some((k: string) => text.includes(k))) return 'block';
      if (vocab.skills.attack.some((k: string) => text.includes(k))) return 'attack';
      if (vocab.skills.opponent_error.some((k: string) => text.includes(k))) return 'opponent_error';
      return undefined;
  }

  private static resolveEntity(
      text: string, 
      playersA: Player[], 
      playersB: Player[], 
      teamAName: string, 
      teamBName: string, 
      vocab: any
  ): { player?: Player, team?: TeamId, confidence: number } | null {
      
      const cleanText = this.removePrepositions(text, vocab);
      const safeNameA = teamAName.toLowerCase().trim();
      const safeNameB = teamBName.toLowerCase().trim();

      // --- 1. REJECTION OF SINGLE LETTERS ---
      const words = cleanText.split(' ');
      if (words.length === 1 && (words[0] === 'a' || words[0] === 'b')) {
          return null;
      }

      // --- 2. PLAYER NAME MATCHING (Longest Match First - CRITICAL for Ana Laura vs Ana) ---
      const allPlayers = [
          ...playersA.map(p => ({ p, t: 'A' as TeamId })), 
          ...playersB.map(p => ({ p, t: 'B' as TeamId }))
      ];

      // Sort by name length descending. This ensures "Ana Laura" is checked before "Ana".
      allPlayers.sort((a, b) => b.p.name.length - a.p.name.length);

      for (const { p, t } of allPlayers) {
          const playerName = p.name.toLowerCase();
          
          // A. Exact Token Match (Robust against substrings)
          // We check if the full player name appears as a distinct phrase in the text
          if (cleanText.includes(playerName)) {
              return { player: p, team: t, confidence: 1.0 };
          }

          // B. Jersey Number Match (Only if explicitly mentioned "Number 10")
          if (p.number && (cleanText.includes(`number ${p.number}`) || cleanText.includes(`numero ${p.number}`))) {
              return { player: p, team: t, confidence: 1.0 };
          }
      }

      // --- 3. TEAM NAME MATCHING ---
      if (safeNameA.length > 2 && cleanText.includes(safeNameA)) return { team: 'A', confidence: 0.95 };
      if (safeNameB.length > 2 && cleanText.includes(safeNameB)) return { team: 'B', confidence: 0.95 };

      // --- 4. GENERIC TEAM KEYWORDS ---
      if (vocab.teamA_Strict.some((k: string) => cleanText.includes(k))) return { team: 'A', confidence: 0.9 };
      if (vocab.teamB_Strict.some((k: string) => cleanText.includes(k))) return { team: 'B', confidence: 0.9 };

      // --- 5. EXPLICIT FALLBACK (Point A / Point B) ---
      // This handles cases where user just says "Point A" and "A" survived preposition cleaning
      if (cleanText.includes('ponto a') || cleanText.includes('point a')) return { team: 'A', confidence: 0.9 };
      if (cleanText.includes('ponto b') || cleanText.includes('point b')) return { team: 'B', confidence: 0.9 };

      return null;
  }

  public static parse(
    rawText: string,
    language: string,
    context: {
      teamAName: string;
      teamBName: string;
      playersA: Player[];
      playersB: Player[];
      statsEnabled: boolean;
      servingTeam: TeamId | null;
    }
  ): VoiceCommandIntent {
    const text = this.normalizeText(rawText);
    const vocab = VOCABULARY[language] || VOCABULARY['en'];
    
    // --- 1. Global Commands ---
    if (vocab.globalUndo.some((k: string) => text.includes(k))) {
      return { type: 'undo', confidence: 1, rawText, debugMessage: "Global Undo triggered" };
    }

    // --- 2. Extract Components ---
    const detectedSkill = this.findSkill(text, vocab);
    const entity = this.resolveEntity(text, context.playersA, context.playersB, context.teamAName, context.teamBName, vocab);
    
    const isNegative = vocab.negative.some((k: string) => text.includes(k));
    const isTimeout = vocab.timeout.some((k: string) => text.includes(k));
    const isExplicitServerChange = vocab.server.some((k: string) => text.includes(k));
    
    // "Point" trigger words
    const isPointTrigger = vocab.pointTriggers.some((k: string) => text.includes(k));

    // --- 3. LOGIC ROUTING ---

    // A. TIMEOUT
    if (isTimeout) {
        if (entity?.team) return { type: 'timeout', team: entity.team, confidence: 1, rawText, debugMessage: `Timeout for Team ${entity.team}` };
    }

    // B. SERVER CHANGE
    if (isExplicitServerChange) {
        if (entity?.team) {
            // High confidence local match
            return { type: 'server', team: entity.team, confidence: 1, rawText, debugMessage: `Serving Team: ${entity.team}` };
        } else {
            // Ambiguous "Serve" command (e.g. "Saque" or "Serve Flamengo" where Flamengo isn't matched locally)
            // Return 'server' type but flag requiresMoreInfo to trigger AI Disambiguation
            // This prevents accidental flipping or ignoring.
            return { 
                type: 'server', 
                confidence: 0.5, 
                rawText, 
                requiresMoreInfo: true,
                debugMessage: `Serve keyword detected, but team ambiguous. Requesting AI.` 
            };
        }
    }

    // C. POINT / SKILL LOGIC
    if (entity?.team || detectedSkill || isPointTrigger) {
        
        let targetTeam = entity?.team;
        
        // CONTEXTUAL INFERENCE: If no team found, but "Point" or "Ace" was said
        if (!targetTeam) {
            if (detectedSkill === 'ace' && context.servingTeam) {
                targetTeam = context.servingTeam; // Ace implies serving team scored
            } 
        }

        if (targetTeam) {
            const playerPayload = entity?.player ? { id: entity.player.id, name: entity.player.name } : undefined;
            
            // Wait for player logic:
            if (context.statsEnabled && detectedSkill && !playerPayload && !isNegative) {
                 return {
                     type: 'point',
                     team: targetTeam,
                     skill: detectedSkill,
                     confidence: 0.6,
                     rawText,
                     requiresMoreInfo: true, // TELLS SYSTEM TO WAIT for player name
                     debugMessage: `Heard ${detectedSkill} for ${targetTeam}, waiting for player...`
                 };
            }

            let debugMsg = isNegative ? "Remove Point" : "Add Point";
            debugMsg += ` [${targetTeam}]`;
            if (playerPayload) debugMsg += ` Player: ${playerPayload.name}`;
            if (detectedSkill) debugMsg += ` (${detectedSkill})`;

            return {
                type: 'point',
                team: targetTeam,
                player: playerPayload,
                skill: detectedSkill,
                isNegative,
                confidence: entity?.confidence || 0.7,
                rawText,
                debugMessage: debugMsg
            };
        }
    }

    // D. ORPHAN SKILL DETECTED
    if (detectedSkill && context.statsEnabled) {
        return {
            type: 'unknown',
            skill: detectedSkill,
            confidence: 0.5,
            rawText,
            requiresMoreInfo: true,
            debugMessage: `Heard skill ${detectedSkill}, waiting for context...`
        };
    }

    return { type: 'unknown', confidence: 0, rawText, debugMessage: "Could not identify Team or Player" };
  }
}
