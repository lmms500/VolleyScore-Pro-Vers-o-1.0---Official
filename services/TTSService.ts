import { Capacitor } from '@capacitor/core';
import { TextToSpeech } from '@capacitor-community/text-to-speech';

export class TTSService {
  private static instance: TTSService;
  private isNative: boolean;

  private constructor() {
    this.isNative = Capacitor.isNativePlatform();
  }

  public static getInstance(): TTSService {
    if (!TTSService.instance) {
      TTSService.instance = new TTSService();
    }
    return TTSService.instance;
  }

  /**
   * Speak the provided text using the best available engine.
   * @param text The text to speak
   * @param language BCP-47 language tag (e.g., 'en-US', 'pt-BR')
   * @param genderPreference 'male' | 'female' (Best effort)
   */
  public async speak(text: string, language: string, genderPreference: 'male' | 'female' = 'female'): Promise<void> {
    if (this.isNative) {
      await this.speakNative(text, language); // Native doesn't easily support gender selection without listing voices first
    } else {
      this.speakWeb(text, language, genderPreference);
    }
  }

  private async speakNative(text: string, language: string) {
    try {
      // Basic stop to clear queue
      await TextToSpeech.stop();
      
      await TextToSpeech.speak({
        text,
        lang: language,
        rate: 1.1, // Slight speed up for sportscaster feel
        pitch: 1.0,
        volume: 1.0,
        category: 'ambient', // Android: plays even if ringer is off usually
      });
    } catch (e) {
      console.warn('Native TTS Error, falling back to Web:', e);
      this.speakWeb(text, language, 'female');
    }
  }

  private speakWeb(text: string, language: string, genderPreference: 'male' | 'female') {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;

    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = language;
    utterance.rate = 1.1;
    utterance.pitch = 1.0;

    // Best effort gender matching for Web
    const voices = window.speechSynthesis.getVoices();
    if (voices.length > 0) {
      const targetGender = genderPreference;
      const maleKeywords = ['male', 'david', 'daniel', 'rishi', 'fred', 'george'];
      const femaleKeywords = ['female', 'zira', 'samantha', 'google', 'karen', 'moira', 'victoria'];
      const keywords = targetGender === 'male' ? maleKeywords : femaleKeywords;

      const exactMatch = voices.find(v => 
        v.lang.startsWith(language.split('-')[0]) && 
        keywords.some(k => v.name.toLowerCase().includes(k))
      );

      if (exactMatch) {
        utterance.voice = exactMatch;
      } else {
        // Fallback: just language match
        const langMatch = voices.find(v => v.lang.startsWith(language.split('-')[0]));
        if (langMatch) utterance.voice = langMatch;
      }
    }

    // Small delay to prevent cutting off sound effects
    setTimeout(() => {
        window.speechSynthesis.speak(utterance);
    }, 300);
  }
}

export const ttsService = TTSService.getInstance();