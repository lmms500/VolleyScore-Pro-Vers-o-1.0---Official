
import { Capacitor } from '@capacitor/core';
import { App as CapApp } from '@capacitor/app';

class AudioService {
  private static instance: AudioService;
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private dynamicsCompressor: DynamicsCompressorNode | null = null;
  private isNative: boolean = Capacitor.isNativePlatform();
  private isSuspendedByApp: boolean = false;
  private initialized: boolean = false;
  
  // Volume State
  private readonly DEFAULT_VOLUME = 0.8;
  private readonly DUCKED_VOLUME = 0.1;

  private constructor() {
    this.setupLifecycleListeners();
    this.setupUnlockListener();
  }

  public static getInstance(): AudioService {
    if (!AudioService.instance) {
      AudioService.instance = new AudioService();
    }
    return AudioService.instance;
  }

  public init() {
    if (this.initialized) return;
    this.getContext();
  }

  private getContext(): AudioContext | null {
    if (!this.ctx) {
      const Ctx = window.AudioContext || (window as any).webkitAudioContext;
      if (Ctx) {
        this.ctx = new Ctx({
          latencyHint: 'interactive',
          sampleRate: 44100 
        });
        this.setupMasterChain();
        this.setupStateListener();
        this.initialized = true;
      }
    }
    return this.ctx;
  }

  private setupMasterChain() {
    if (!this.ctx) return;

    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = this.DEFAULT_VOLUME; 

    this.dynamicsCompressor = this.ctx.createDynamicsCompressor();
    this.dynamicsCompressor.threshold.value = -12;
    this.dynamicsCompressor.knee.value = 40;
    this.dynamicsCompressor.ratio.value = 12;
    this.dynamicsCompressor.attack.value = 0;
    this.dynamicsCompressor.release.value = 0.25;

    this.masterGain.connect(this.dynamicsCompressor);
    this.dynamicsCompressor.connect(this.ctx.destination);
  }

  private setupStateListener() {
    if (!this.ctx) return;
    this.ctx.onstatechange = () => {
        // Automatic recovery for 'interrupted' state (common on iOS)
        if ((this.ctx?.state as any) === 'interrupted') {
            this.ctx.resume().catch(() => {});
        }
    };
  }

  private setupLifecycleListeners() {
    // Native lifecycle hook to suspend/resume audio context to save battery/resources
    if (!this.isNative) return;

    CapApp.addListener('appStateChange', async ({ isActive }) => {
      if (!this.ctx) return;
      if (!isActive) {
        if (this.ctx.state === 'running') {
          this.isSuspendedByApp = true;
          await this.ctx.suspend();
        }
      } else {
        // On resume, forcefully attempt to wake up the context
        if (this.isSuspendedByApp || (this.ctx.state as any) === 'interrupted' || this.ctx.state === 'suspended') {
          await this.ctx.resume();
          this.isSuspendedByApp = false;
        }
      }
    });
  }

  private setupUnlockListener() {
    // Universal unlocker for iOS Safari/WebViews
    // AudioContext starts suspended until user interaction
    const unlock = () => {
      if (!this.ctx) {
          this.getContext();
      }
      
      if (this.ctx && (this.ctx.state === 'suspended' || (this.ctx.state as any) === 'interrupted')) {
        this.ctx.resume().then(() => {
          // Keep listener active for a bit longer just in case, but usually safe to remove
          // We don't remove immediately to ensure we catch the first valid interaction
        }).catch(() => {});
      }
    };
    
    // Listen to all major interaction types
    document.addEventListener('touchstart', unlock, { passive: true });
    document.addEventListener('click', unlock, { passive: true });
    document.addEventListener('keydown', unlock, { passive: true });
  }

  // --- VOLUME CONTROL (DUCKING) ---
  public duck() {
      if (!this.masterGain || !this.ctx) return;
      const t = this.ctx.currentTime;
      this.masterGain.gain.cancelScheduledValues(t);
      this.masterGain.gain.setTargetAtTime(this.DUCKED_VOLUME, t, 0.1); 
  }

  public unduck() {
      if (!this.masterGain || !this.ctx) return;
      const t = this.ctx.currentTime;
      this.masterGain.gain.cancelScheduledValues(t);
      this.masterGain.gain.setTargetAtTime(this.DEFAULT_VOLUME, t, 0.2); 
  }

  // --- SAFE PLAY HELPER ---
  private safePlay(playFn: (ctx: AudioContext, t: number) => void) {
      const ctx = this.getContext();
      if (!ctx || !this.masterGain) return;
      
      // Last-ditch resume attempt before playing
      if (ctx.state === 'suspended') {
          ctx.resume().catch(() => {});
      }

      const t = ctx.currentTime;
      playFn(ctx, t);
  }

  // --- SOUND GENERATORS ---

  // 1. UI Interaction (Minimal Latency)
  public playTap() {
    this.safePlay((ctx, t) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(800, t);
        osc.frequency.exponentialRampToValueAtTime(1600, t + 0.03);

        gain.gain.setValueAtTime(0.08, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.03);

        osc.connect(gain);
        gain.connect(this.masterGain!);

        osc.start(t);
        osc.stop(t + 0.04);
    });
  }

  // 2. Standard Score (Satisfying "Ding")
  public playScore(lowGraphics: boolean) {
    this.safePlay((ctx, t) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        
        osc.type = 'sine';
        osc.frequency.setValueAtTime(523.25, t); // C5
        osc.frequency.exponentialRampToValueAtTime(523.25, t + 0.1);
        
        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(0.2, t + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.6);

        osc.connect(gain);
        gain.connect(this.masterGain!);
        
        osc.start(t);
        osc.stop(t + 0.6);
    });
  }

  // 3. Swap Sides (Spatial Whoosh)
  public playSwap() {
    this.safePlay((ctx, t) => {
        const bufferSize = ctx.sampleRate * 0.5;
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }

        const noise = ctx.createBufferSource();
        noise.buffer = buffer;

        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(200, t);
        filter.frequency.exponentialRampToValueAtTime(3000, t + 0.2);
        filter.frequency.exponentialRampToValueAtTime(100, t + 0.5);

        const panner = ctx.createStereoPanner();
        panner.pan.setValueAtTime(-0.8, t);
        panner.pan.linearRampToValueAtTime(0.8, t + 0.5);

        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(0.3, t + 0.2);
        gain.gain.linearRampToValueAtTime(0, t + 0.5);

        noise.connect(filter);
        filter.connect(panner);
        panner.connect(gain);
        gain.connect(this.masterGain!);

        noise.start(t);
        noise.stop(t + 0.6);
    });
  }

  // 4. Deuce (Mechanical "Lock")
  public playDeuce() {
    this.safePlay((ctx, t) => {
        [0, 0.15].forEach(delay => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            
            osc.type = 'square';
            osc.frequency.setValueAtTime(440, t + delay);
            osc.frequency.exponentialRampToValueAtTime(110, t + delay + 0.1);

            gain.gain.setValueAtTime(0.1, t + delay);
            gain.gain.exponentialRampToValueAtTime(0.001, t + delay + 0.1);

            const filter = ctx.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.value = 800;

            osc.connect(filter);
            filter.connect(gain);
            gain.connect(this.masterGain!);

            osc.start(t + delay);
            osc.stop(t + delay + 0.12);
        });
    });
  }

  // 5. Undo (Low Bloop)
  public playUndo() {
    this.safePlay((ctx, t) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'triangle'; 
        osc.frequency.setValueAtTime(300, t);
        osc.frequency.exponentialRampToValueAtTime(150, t + 0.15);

        gain.gain.setValueAtTime(0.1, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);

        osc.connect(gain);
        gain.connect(this.masterGain!);

        osc.start(t);
        osc.stop(t + 0.2);
    });
  }

  // 6. Whistle (FM Synth)
  public playWhistle(lowGraphics: boolean) {
    this.safePlay((ctx, t) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const mod = ctx.createOscillator();
        const modGain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(2500, t);
        osc.frequency.linearRampToValueAtTime(1500, t + 0.3);

        mod.frequency.value = 50; 
        modGain.gain.value = 600; 

        mod.connect(modGain);
        modGain.connect(osc.frequency);

        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(0.3, t + 0.05);
        gain.gain.linearRampToValueAtTime(0, t + 0.4);

        osc.connect(gain);
        gain.connect(this.masterGain!);

        mod.start(t);
        osc.start(t);
        mod.stop(t + 0.5);
        osc.stop(t + 0.5);
    });
  }

  // 7. Set Point (Rising Tension)
  public playSetPointAlert(lowGraphics: boolean) {
    this.safePlay((ctx, t) => {
        const carrier = ctx.createOscillator();
        const gain = ctx.createGain();

        carrier.type = 'triangle';
        carrier.frequency.setValueAtTime(660, t); 
        carrier.frequency.linearRampToValueAtTime(880, t + 0.2); 

        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(0.15, t + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.4);

        carrier.connect(gain);
        gain.connect(this.masterGain!);

        carrier.start(t);
        carrier.stop(t + 0.4);
    });
  }

  // 8. Match Point (High Tension - Pulsing)
  public playMatchPointAlert(lowGraphics: boolean) {
    this.safePlay((ctx, t) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const lfo = ctx.createOscillator();
        const lfoGain = ctx.createGain();
        
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(440, t); 
        
        lfo.frequency.value = 15; 
        lfoGain.gain.value = 50; 

        lfo.connect(lfoGain);
        lfoGain.connect(osc.frequency);

        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(800, t);
        filter.frequency.linearRampToValueAtTime(2000, t + 0.5); 

        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(0.15, t + 0.1);
        gain.gain.linearRampToValueAtTime(0, t + 0.8);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.masterGain!);
        
        lfo.start(t);
        osc.start(t);
        lfo.stop(t + 0.8);
        osc.stop(t + 0.8);
    });
  }

  // 9. Set Win (Major Arpeggio)
  public playSetWin(lowGraphics: boolean) {
    this.safePlay((ctx, t) => {
        const notes = [523.25, 659.25, 783.99, 1046.50]; 
        notes.forEach((freq, i) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            const start = t + (i * 0.08);

            osc.type = 'sine';
            osc.frequency.value = freq;
            
            gain.gain.setValueAtTime(0, start);
            gain.gain.linearRampToValueAtTime(0.15, start + 0.05);
            gain.gain.exponentialRampToValueAtTime(0.001, start + 0.6);

            osc.connect(gain);
            gain.connect(this.masterGain!);
            osc.start(start);
            osc.stop(start + 0.7);
        });
    });
  }

  // 10. Match Win (Grand Chord)
  public playMatchWin(lowGraphics: boolean) {
    this.safePlay((ctx, t) => {
        const chord = [392.00, 523.25, 659.25, 783.99, 1046.50]; 

        chord.forEach((freq, i) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            const start = t + (i * 0.05); 
            
            osc.type = i % 2 === 0 ? 'sine' : 'triangle'; 
            osc.frequency.value = freq;

            gain.gain.setValueAtTime(0, start);
            gain.gain.linearRampToValueAtTime(0.1, start + 0.1);
            gain.gain.exponentialRampToValueAtTime(0.001, start + 2.0); 

            osc.connect(gain);
            gain.connect(this.masterGain!);
            osc.start(start);
            osc.stop(start + 2.0);
        });
    });
  }

  // 11. Sudden Death Entry (Cinematic Impact)
  public playSuddenDeath(lowGraphics: boolean) {
    this.safePlay((ctx, t) => {
        const subOsc = ctx.createOscillator();
        const subGain = ctx.createGain();
        subOsc.type = 'sine';
        subOsc.frequency.setValueAtTime(150, t);
        subOsc.frequency.exponentialRampToValueAtTime(40, t + 1.5); 
        
        subGain.gain.setValueAtTime(0.6, t);
        subGain.gain.exponentialRampToValueAtTime(0.01, t + 1.5);

        const shaper = ctx.createWaveShaper();
        shaper.curve = this.makeDistortionCurve(400);
        shaper.oversample = '4x';

        subOsc.connect(subGain);
        subGain.connect(shaper);
        shaper.connect(this.masterGain!);
        
        subOsc.start(t);
        subOsc.stop(t + 2);
    });
  }

  // 12. Unlock/Party Effect
  public playUnlock() {
    this.safePlay((ctx, t) => {
        const notes = [523.25, 659.25, 783.99, 1046.50, 1318.51, 1567.98]; 
        
        notes.forEach((freq, i) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            const start = t + (i * 0.06);

            osc.type = 'triangle';
            osc.frequency.value = freq;

            gain.gain.setValueAtTime(0, start);
            gain.gain.linearRampToValueAtTime(0.1, start + 0.05);
            gain.gain.exponentialRampToValueAtTime(0.001, start + 0.5);

            osc.connect(gain);
            gain.connect(this.masterGain!);
            osc.start(start);
            osc.stop(start + 0.6);
        });
    });
  }

  private makeDistortionCurve(amount: number) {
    const k = typeof amount === 'number' ? amount : 50;
    const n_samples = 44100;
    const curve = new Float32Array(n_samples);
    const deg = Math.PI / 180;
    for (let i = 0; i < n_samples; ++i) {
      const x = (i * 2) / n_samples - 1;
      curve[i] = (3 + k) * x * 20 * deg / (Math.PI + k * Math.abs(x));
    }
    return curve;
  }
}

export const audioService = AudioService.getInstance();
