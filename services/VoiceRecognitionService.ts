
import { Capacitor } from '@capacitor/core';
import { SpeechRecognition } from '@capacitor-community/speech-recognition';
import { audioService } from './AudioService';

type ResultCallback = (text: string, isFinal: boolean) => void;
type ErrorCallback = (type: 'permission' | 'network' | 'generic') => void;
type StatusCallback = (isListening: boolean) => void;

export class VoiceRecognitionService {
  private static instance: VoiceRecognitionService;
  private webRecognition: any = null;
  private isNative: boolean;
  private onResult?: ResultCallback;
  private onError?: ErrorCallback;
  private onStatusChange?: StatusCallback;
  
  // "Phoenix Loop" State Control
  private intendedState: boolean = false; // Does the user WANT to be listening?
  private isActualState: boolean = false; // Is the service ACTUALLY listening?
  private restartTimer: any = null;

  private constructor() {
    this.isNative = Capacitor.isNativePlatform();
    if (!this.isNative && typeof window !== 'undefined') {
      const WebSpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (WebSpeechRecognition) {
        this.webRecognition = new WebSpeechRecognition();
        this.webRecognition.continuous = true;
        this.webRecognition.interimResults = true;
        this.webRecognition.maxAlternatives = 1;
        this.setupWebListeners();
      }
    }
  }

  public static getInstance(): VoiceRecognitionService {
    if (!VoiceRecognitionService.instance) {
      VoiceRecognitionService.instance = new VoiceRecognitionService();
    }
    return VoiceRecognitionService.instance;
  }

  public setCallbacks(onResult: ResultCallback, onError: ErrorCallback, onStatusChange: StatusCallback) {
    this.onResult = onResult;
    this.onError = onError;
    this.onStatusChange = onStatusChange;
  }

  public async isAvailable(): Promise<boolean> {
    if (this.isNative) {
      try {
        const { available } = await SpeechRecognition.available();
        return available;
      } catch {
        return false;
      }
    }
    return !!this.webRecognition;
  }

  public async requestPermissions(): Promise<boolean> {
    if (this.isNative) {
      try {
        const status = await SpeechRecognition.requestPermissions();
        return status.speechRecognition === 'granted';
      } catch (e) {
        console.warn("Permission request failed", e);
        return false;
      }
    }
    return true; 
  }

  public async start(language: string) {
    // 1. Set Intention
    this.intendedState = true;
    
    // 2. Map language
    const langMap: Record<string, string> = { 'pt': 'pt-BR', 'en': 'en-US', 'es': 'es-ES' };
    const locale = langMap[language] || 'en-US';

    await this.internalStart(locale);
  }

  /**
   * Internal start logic that handles the actual API calls and Audio Ducking.
   */
  private async internalStart(locale: string) {
    if (this.isActualState) return;

    // AUDIO DUCKING: Lower volume to prevent echoes
    audioService.duck();

    if (this.isNative) {
      try {
        this.updateStatus(true); // Optimistic update

        await SpeechRecognition.removeAllListeners().catch(() => {});

        // Listen for partial results (critical for responsiveness)
        await SpeechRecognition.addListener('partialResults', (data: { matches: string[] }) => {
          if (data.matches && data.matches.length > 0) {
            this.handleResult(data.matches[0], false);
          }
        });

        // Start listening
        const result = await SpeechRecognition.start({
          language: locale,
          maxResults: 1,
          prompt: "",
          partialResults: true,
          popup: false
        });
        
        // Final result handling (Android/iOS usually resolves this when silence happens)
        if (result && result.matches && result.matches.length > 0) {
          this.handleResult(result.matches[0], true);
        }
        
        // If we get here, the session ended naturally
        this.handleSessionEnd(locale);

      } catch (e) {
        console.error("Native speech error", e);
        const msg = (e as any)?.message || '';
        // If error is not a simple cancel, treat as generic error
        if (!msg.includes('canceled') && !msg.includes('stop')) {
            this.handleError('generic');
        }
        this.handleSessionEnd(locale);
      }

    } else if (this.webRecognition) {
      try {
        this.webRecognition.lang = locale;
        this.webRecognition.start();
        this.updateStatus(true);
      } catch (e) {
        console.error("Web speech start failed", e);
        this.handleError('generic');
        this.handleSessionEnd(locale);
      }
    }
  }

  public async stop() {
    // 1. Clear Intention
    this.intendedState = false;
    
    // 2. Clear any pending Phoenix restarts
    if (this.restartTimer) {
        clearTimeout(this.restartTimer);
        this.restartTimer = null;
    }

    // 3. Stop actual engines
    if (this.isNative) {
      try { await SpeechRecognition.stop(); } catch(e) {}
    } else if (this.webRecognition) {
      this.webRecognition.stop();
    }
    
    // 4. Update Status & Restore Audio
    this.updateStatus(false);
    audioService.unduck();
  }

  /**
   * PHOENIX LOOP: Logic to handle unexpected stops.
   * If the service stops but intendedState is TRUE, we restart it.
   */
  private handleSessionEnd(lastLocale: string) {
      this.updateStatus(false);
      
      if (this.intendedState) {
          console.debug("[Voice] Phoenix Loop: Resurrecting service...");
          
          if (this.restartTimer) clearTimeout(this.restartTimer);
          
          // Small delay to prevent CPU thrashing if it fails instantly
          this.restartTimer = setTimeout(() => {
              this.internalStart(lastLocale);
          }, 250);
      } else {
          // If we stopped intentionally, restore audio volume
          audioService.unduck();
      }
  }

  private setupWebListeners() {
    if (!this.webRecognition) return;

    this.webRecognition.onresult = (event: any) => {
      let interimTranscript = '';
      let finalTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript;
        } else {
          interimTranscript += event.results[i][0].transcript;
        }
      }

      if (finalTranscript) {
        this.handleResult(finalTranscript, true);
      } else if (interimTranscript) {
        this.handleResult(interimTranscript, false);
      }
    };

    this.webRecognition.onerror = (event: any) => {
      if (event.error === 'no-speech') return; // Ignore simple silence timeouts
      
      console.warn("Web Speech Error:", event.error);
      if (event.error === 'not-allowed') {
          this.intendedState = false; // Stop looping if permission denied
          this.handleError('permission');
      }
      else if (event.error === 'network') this.handleError('network');
      else this.handleError('generic');
    };

    this.webRecognition.onend = () => {
      // In web, trigger Phoenix Loop logic via handleSessionEnd
      this.handleSessionEnd(this.webRecognition.lang);
    };
  }

  private handleResult(text: string, isFinal: boolean) {
    if (this.onResult) this.onResult(text, isFinal);
  }

  private handleError(type: 'permission' | 'network' | 'generic') {
    audioService.unduck(); // Restore volume on error
    if (this.onError) this.onError(type);
  }

  private updateStatus(listening: boolean) {
    if (this.isActualState !== listening) {
        this.isActualState = listening;
        if (this.onStatusChange) this.onStatusChange(listening);
    }
  }
}
