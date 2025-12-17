
import { Capacitor } from '@capacitor/core';
import { SpeechRecognition } from '@capacitor-community/speech-recognition';

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
  
  private intendedState: boolean = false; 
  private isActualState: boolean = false; 
  private restartTimer: any = null;

  private constructor() {
    this.isNative = Capacitor.isNativePlatform();
    if (!this.isNative) {
        this.initWebEngine();
    }
  }

  private initWebEngine() {
    if (typeof window !== 'undefined') {
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
      } catch {
        return false;
      }
    }
    return true; 
  }

  public async start(language: string) {
    this.intendedState = true;
    const langMap: Record<string, string> = { 'pt': 'pt-BR', 'en': 'en-US', 'es': 'es-ES' };
    const locale = langMap[language] || 'en-US';

    if (this.isNative) {
        await this.internalStartNative(locale);
    } else {
        await this.internalStartWeb(locale);
    }
  }

  private async internalStartNative(locale: string) {
    if (this.isActualState) return;
    try {
        this.updateStatus(true);
        await SpeechRecognition.removeAllListeners();

        await SpeechRecognition.addListener('partialResults', (data: { matches: string[] }) => {
            if (data.matches?.length > 0) this.handleResult(data.matches[0], false);
        });

        const result = await SpeechRecognition.start({
            language: locale,
            maxResults: 1,
            partialResults: true,
            popup: false
        });
        
        if (result.matches?.length > 0) this.handleResult(result.matches[0], true);
        this.handleNativeSessionEnd(locale);
    } catch (e: any) {
        console.warn("[VoiceService] Native Error:", e);
        this.updateStatus(false);
        if (!e.message?.includes('canceled')) this.handleError('generic');
    }
  }

  private async internalStartWeb(locale: string) {
    if (!this.webRecognition || this.isActualState) return;
    try {
        this.webRecognition.lang = locale;
        this.webRecognition.start();
        this.updateStatus(true);
    } catch (e) {
        this.updateStatus(false);
        this.handleError('generic');
    }
  }

  public async stop() {
    this.intendedState = false;
    if (this.restartTimer) clearTimeout(this.restartTimer);

    if (this.isNative) {
        try { await SpeechRecognition.stop(); } catch {}
    } else if (this.webRecognition) {
        try { this.webRecognition.stop(); } catch {}
    }
    
    this.updateStatus(false);
  }

  private handleNativeSessionEnd(locale: string) {
      this.updateStatus(false);
      if (this.intendedState) {
          if (this.restartTimer) clearTimeout(this.restartTimer);
          this.restartTimer = setTimeout(() => this.internalStartNative(locale), 300);
      }
  }

  private setupWebListeners() {
    if (!this.webRecognition) return;

    this.webRecognition.onresult = (event: any) => {
      let interim = '', final = '';
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) final += event.results[i][0].transcript;
        else interim += event.results[i][0].transcript;
      }
      if (final) this.handleResult(final, true);
      else if (interim) this.handleResult(interim, false);
    };

    this.webRecognition.onerror = (event: any) => {
      if (event.error === 'no-speech') return;
      this.intendedState = false;
      this.updateStatus(false);
      this.handleError(event.error === 'not-allowed' ? 'permission' : 'generic');
    };

    this.webRecognition.onend = () => {
        this.updateStatus(false);
        if (this.intendedState) {
            this.internalStartWeb(this.webRecognition.lang);
        }
    };
  }

  private handleResult(text: string, isFinal: boolean) {
    if (this.onResult) this.onResult(text, isFinal);
  }

  private handleError(type: 'permission' | 'network' | 'generic') {
    if (this.onError) this.onError(type);
  }

  private updateStatus(listening: boolean) {
    if (this.isActualState !== listening) {
        this.isActualState = listening;
        if (this.onStatusChange) this.onStatusChange(listening);
    }
  }
}
