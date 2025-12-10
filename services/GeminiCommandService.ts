
import { GoogleGenAI, Type } from "@google/genai";
import { Player, TeamId, SkillType } from "../types";
import { SecureStorage } from "./SecureStorage";

const commandSchema = {
  type: Type.OBJECT,
  properties: {
    type: { type: Type.STRING, description: "One of: 'point', 'timeout', 'server', 'undo', 'unknown'" },
    team: { type: Type.STRING, description: "'A' or 'B'. Infer from context, team name, or player name." },
    playerId: { type: Type.STRING, description: "The UUID of the player if mentioned and identified in the roster. Use 'unknown' if player is mentioned but not in roster." },
    skill: { type: Type.STRING, description: "One of: 'attack', 'block', 'ace', 'opponent_error'" },
    isNegative: { type: Type.BOOLEAN, description: "True if the user wants to REMOVE/UNDO a point." }
  }
};

export class GeminiCommandService {
  private static instance: GeminiCommandService;
  private devAi: GoogleGenAI | null = null;

  private constructor() {
    // Only initialize Dev Key if available in build environment
    if (process.env.API_KEY) {
      this.devAi = new GoogleGenAI({ apiKey: process.env.API_KEY });
    }
  }

  public static getInstance(): GeminiCommandService {
    if (!GeminiCommandService.instance) {
      GeminiCommandService.instance = new GeminiCommandService();
    }
    return GeminiCommandService.instance;
  }

  public async parseCommand(
    transcript: string, 
    context: {
      teamAName: string;
      teamBName: string;
      playersA: Player[];
      playersB: Player[];
    }
  ): Promise<any> {
    
    // 1. Try to load User API Key from storage (BYOK)
    let aiClient = this.devAi;
    try {
        const gameState = await SecureStorage.load<any>('action_log'); // 'action_log' key stores the whole GameState
        if (gameState && gameState.config && gameState.config.userApiKey) {
            console.debug("[Gemini] Using User-Provided API Key");
            aiClient = new GoogleGenAI({ apiKey: gameState.config.userApiKey });
        }
    } catch (e) {
        console.warn("[Gemini] Failed to check for user key, falling back to dev key.", e);
    }

    if (!aiClient) {
        console.warn("[Gemini] No API Key available (neither User nor Dev).");
        return null;
    }

    return this.parseLocal(aiClient, transcript, context);
  }

  private async parseLocal(client: GoogleGenAI, transcript: string, context: any): Promise<any> {
    try {
      const model = "gemini-2.5-flash";
      const prompt = this.buildPrompt(transcript, context);

      const response = await client.models.generateContent({
        model,
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: commandSchema,
          thinkingConfig: { thinkingBudget: 0 }
        }
      });

      if (response.text) {
          return JSON.parse(response.text);
      }
      return null;
    } catch (e) {
      console.error("Gemini Local Error:", e);
      return null;
    }
  }

  private buildPrompt(transcript: string, context: any): string {
      const rosterA = context.playersA.map((p: any) => `${p.name} (ID: ${p.id})`).join(", ");
      const rosterB = context.playersB.map((p: any) => `${p.name} (ID: ${p.id})`).join(", ");

      return `
        You are an expert Volleyball Referee Voice Assistant. Analyze the spoken command: "${transcript}".
        
        MATCH CONTEXT:
        - Team A Name: "${context.teamAName}"
        - Team A Roster: [${rosterA}]
        - Team B Name: "${context.teamBName}"
        - Team B Roster: [${rosterB}]
        
        RULES FOR INTERPRETATION:
        1. **TEAM NAME MAPPING**:
           - Identify the Team Name in the transcript (e.g., "Flamengo", "Fluminense").
           - Map it to 'A' if it matches Team A Name, or 'B' if it matches Team B Name.
           - Fuzzy matching is allowed (e.g., "Flu" -> "Fluminense").

        2. **SERVE / POSSESSION COMMANDS**:
           - Keywords: "Serve", "Saque", "Sack" (phonetic for Saque), "Ball to", "Side out", "Rodar".
           - "Serve [Team Name]" / "Sack [Team Name]" -> Return type: 'server', team: [A/B].
           - "Ball to Team A" -> Return type: 'server', team: 'A'.
           - NOTE: "Sack" is often a misheard "Saque" (Serve). Treat "Sack [Team]" as a Server Change for that team.

        3. **POINT COMMANDS**:
           - Keywords: "Point", "Ponto", "Marcou", "Score".
           - "Point [Team Name]" / "Ponto do [Team Name]" -> Return type: 'point', team: [A/B].
           - If user says "Sack Point" or just "Sack" without a team context but implies scoring, infer type: 'point'. But "Sack [Team]" is usually 'server'.

        4. **PLAYER DISAMBIGUATION**: 
           - If players share names, choose the one with the longest matching unique name part.
           - "Ace [Player]" -> type: 'point', skill: 'ace'.
        
        5. **INTENT**:
           - "Timeout" -> type: 'timeout'.
           - "Undo" / "Correction" -> type: 'undo'.
        
        Return JSON only.
      `;
  }
}
