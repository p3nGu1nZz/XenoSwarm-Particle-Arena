
import { Howl, Howler } from 'howler';

// --- MUSIC CONSTANTS ---
const BASE_FREQ_A1 = 40.0; 

// CYBERPUNK SCALES (Darker, Exotic)
const SCALE_LOCRIAN = [0, 1, 3, 5, 6, 8, 10, 12]; 
const SCALE_PHRYGIAN_DOM = [0, 1, 4, 5, 7, 8, 10, 12]; 
const SCALE_HUNGARIAN_MINOR = [0, 2, 3, 6, 7, 8, 11, 12]; 
const SCALE_DORIAN_b2 = [0, 1, 3, 5, 7, 9, 10, 12]; 
const SCALE_HIRAJOSHI = [0, 2, 3, 7, 8, 12]; 

type ThemeType = 'MENU' | 'BATTLE_STD' | 'BATTLE_VOID' | 'BATTLE_SOUP' | 'BATTLE_DARK' | 'BATTLE_ACID' | 'EVOLUTION' | 'LEADERBOARD';

interface ThemeConfig {
  scale: number[];
  baseOctave: number;
  bpm: number;
  arpRate: number; 
  padCutoff: number;
  reverbLevel: number; 
  waveType: OscillatorType;
  detuneAmount: number; 
  hasSubBass: boolean;
}

const THEMES: Record<ThemeType, ThemeConfig> = {
  MENU: {
    scale: SCALE_LOCRIAN,
    baseOctave: 1, 
    bpm: 30, // Much slower drone
    arpRate: 0.1,
    padCutoff: 300,
    reverbLevel: 0.9,
    waveType: 'sine', // Smoother
    detuneAmount: 3,
    hasSubBass: true
  },
  BATTLE_STD: {
    scale: SCALE_PHRYGIAN_DOM,
    baseOctave: 2,
    bpm: 60, 
    arpRate: 0.6,
    padCutoff: 1500,
    reverbLevel: 0.5,
    waveType: 'sawtooth',
    detuneAmount: 10,
    hasSubBass: true
  },
  BATTLE_VOID: {
    scale: SCALE_HUNGARIAN_MINOR,
    baseOctave: 1,
    bpm: 40,
    arpRate: 0.3,
    padCutoff: 400,
    reverbLevel: 0.95,
    waveType: 'triangle',
    detuneAmount: 5,
    hasSubBass: true
  },
  BATTLE_SOUP: {
    scale: SCALE_DORIAN_b2,
    baseOctave: 2,
    bpm: 70, 
    arpRate: 0.6,
    padCutoff: 1000,
    reverbLevel: 0.4,
    waveType: 'square',
    detuneAmount: 15,
    hasSubBass: true
  },
  BATTLE_DARK: {
    scale: SCALE_LOCRIAN,
    baseOctave: 1,
    bpm: 50,
    arpRate: 0.5,
    padCutoff: 600,
    reverbLevel: 0.7,
    waveType: 'sawtooth',
    detuneAmount: 20, 
    hasSubBass: true
  },
  BATTLE_ACID: {
      scale: SCALE_HIRAJOSHI,
      baseOctave: 2,
      bpm: 80, 
      arpRate: 0.8,
      padCutoff: 2000, 
      reverbLevel: 0.3,
      waveType: 'square',
      detuneAmount: 8,
      hasSubBass: false
  },
  EVOLUTION: {
    scale: SCALE_HIRAJOSHI,
    baseOctave: 3,
    bpm: 110, // Fast data processing feel
    arpRate: 0.95, 
    padCutoff: 1500,
    reverbLevel: 0.3,
    waveType: 'sine',
    detuneAmount: 2,
    hasSubBass: false
  },
  LEADERBOARD: {
    scale: SCALE_PHRYGIAN_DOM,
    baseOctave: 2,
    bpm: 60,
    arpRate: 0.2,
    padCutoff: 600,
    reverbLevel: 0.6,
    waveType: 'triangle',
    detuneAmount: 5,
    hasSubBass: true
  }
};

class OscillatorVoice {
  osc: OscillatorNode;
  osc2: OscillatorNode; 
  gain: GainNode;
  ctx: AudioContext;

  constructor(ctx: AudioContext, type: OscillatorType, freq: number, dest: AudioNode, detune: number = 0) {
    this.ctx = ctx;
    this.gain = ctx.createGain();

    this.osc = ctx.createOscillator();
    this.osc.type = type;
    this.osc.frequency.value = freq;

    this.osc2 = ctx.createOscillator();
    this.osc2.type = type;
    this.osc2.frequency.value = freq;
    this.osc2.detune.value = detune;

    this.osc.connect(this.gain);
    this.osc2.connect(this.gain);
    
    this.gain.connect(dest);
    this.gain.gain.value = 0;
    
    this.osc.start();
    this.osc2.start();
  }

  play(duration: number, volume: number, now: number, attack: number = 0.05, release: number = 0.1) {
    this.gain.gain.cancelScheduledValues(now);
    this.gain.gain.setValueAtTime(0, now);
    this.gain.gain.linearRampToValueAtTime(volume * 0.5, now + attack); 
    this.gain.gain.exponentialRampToValueAtTime(0.001, now + duration + release);
  }

  stop(now: number) {
    this.gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
    this.osc.stop(now + 0.2);
    this.osc2.stop(now + 0.2);
  }
}

class SynthEngine {
  ctx: AudioContext | null = null;
  masterGain: GainNode | null = null;
  
  // Effects
  delayNode: DelayNode | null = null;
  feedbackGain: GainNode | null = null;
  compressor: DynamicsCompressorNode | null = null;
  distortion: WaveShaperNode | null = null;

  // Layers
  droneOsc: OscillatorNode | null = null;
  droneSub: OscillatorNode | null = null;
  droneGain: GainNode | null = null;
  
  padFilter: BiquadFilterNode | null = null;
  
  // State
  currentTheme: ThemeConfig = THEMES.MENU;
  isPlaying: boolean = false;
  timerId: number | null = null;
  step: number = 0;
  chordRootIndex: number = 0; 

  init() {
    if (this.ctx) return;
    this.ctx = Howler.ctx;
    if (!this.ctx) return;
    
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = 0.6; // Increased from 0.35 to 0.6 for louder music

    this.distortion = this.ctx.createWaveShaper();
    this.distortion.curve = this.makeDistortionCurve(10);
    this.distortion.oversample = '2x';

    this.compressor = this.ctx.createDynamicsCompressor();
    this.compressor.threshold.value = -18;
    this.compressor.ratio.value = 10;
    this.compressor.attack.value = 0.01;
    this.compressor.release.value = 0.2;

    this.masterGain.connect(this.distortion);
    this.distortion.connect(this.compressor);
    this.compressor.connect(this.ctx.destination);

    this.delayNode = this.ctx.createDelay();
    this.delayNode.delayTime.value = 0.5; // Longer delay for space feel
    this.feedbackGain = this.ctx.createGain();
    this.feedbackGain.gain.value = 0.5; // More feedback

    const delayFilter = this.ctx.createBiquadFilter();
    delayFilter.type = 'lowpass';
    delayFilter.frequency.value = 800; 

    this.delayNode.connect(delayFilter);
    delayFilter.connect(this.feedbackGain);
    this.feedbackGain.connect(this.delayNode);
    this.feedbackGain.connect(this.masterGain);

    this.padFilter = this.ctx.createBiquadFilter();
    this.padFilter.type = 'lowpass';
    this.padFilter.Q.value = 1; 
    this.padFilter.connect(this.masterGain);
    this.padFilter.connect(this.delayNode);
  }

  makeDistortionCurve(amount: number) {
    const k = typeof amount === 'number' ? amount : 50;
    const n_samples = 44100;
    const curve = new Float32Array(n_samples);
    const deg = Math.PI / 180;
    for (let i = 0; i < n_samples; ++i) {
      const x = i * 2 / n_samples - 1;
      curve[i] = (3 + k) * x * 20 * deg / (Math.PI + k * Math.abs(x));
    }
    return curve;
  }

  setTheme(themeName: ThemeType) {
    const config = THEMES[themeName];
    if (!config || !this.ctx) return;
    
    const now = this.ctx.currentTime;
    
    if (this.padFilter) {
        this.padFilter.frequency.exponentialRampToValueAtTime(Math.max(100, config.padCutoff), now + 3);
    }

    if (this.feedbackGain) {
        this.feedbackGain.gain.linearRampToValueAtTime(config.reverbLevel * 0.6, now + 3);
    }
    
    this.currentTheme = config;
    this.startDrone();
  }

  start() {
    this.init();
    if (this.isPlaying || !this.ctx) return;
    if (this.ctx.state === 'suspended') this.ctx.resume();

    this.isPlaying = true;
    this.masterGain!.gain.value = 0.6; // Ensure loud start
    
    this.startDrone();
    this.scheduleLoop();
  }

  startDrone() {
      if (!this.ctx) return;
      this.stopDrone();

      this.droneGain = this.ctx.createGain();
      this.droneGain.gain.value = 0.1; // Slightly louder drone

      // Main Drone
      this.droneOsc = this.ctx.createOscillator();
      this.droneOsc.type = this.currentTheme.waveType;
      const freq = BASE_FREQ_A1 * Math.pow(2, this.currentTheme.baseOctave - 1);
      this.droneOsc.frequency.value = freq;
      
      this.droneOsc.connect(this.droneGain);

      // Sub Bass
      if (this.currentTheme.hasSubBass) {
          this.droneSub = this.ctx.createOscillator();
          this.droneSub.type = 'sine';
          this.droneSub.frequency.value = freq * 0.5; 
          this.droneSub.connect(this.droneGain);
          this.droneSub.start();
      }
      
      const lpf = this.ctx.createBiquadFilter();
      lpf.type = 'lowpass';
      lpf.frequency.value = 150; 

      this.droneGain.connect(lpf);
      lpf.connect(this.masterGain!);
      
      this.droneOsc.start();
  }

  stopDrone() {
      if (this.droneOsc) {
          try { this.droneOsc.stop(); } catch(e) {}
          this.droneOsc.disconnect();
          this.droneOsc = null;
      }
      if (this.droneSub) {
          try { this.droneSub.stop(); } catch(e) {}
          this.droneSub.disconnect();
          this.droneSub = null;
      }
  }

  scheduleLoop() {
    if (!this.isPlaying || !this.ctx) return;

    const now = this.ctx.currentTime;
    const { bpm, scale, baseOctave, arpRate, detuneAmount } = this.currentTheme;
    const beatTime = 60 / bpm;
    const sixteenth = beatTime / 4;

    // --- CHORD PROGRESSION ---
    if (this.step % 64 === 0) { // Much slower chord changes
        const progression = [0, 2, 4, 1, 5, 0];
        this.chordRootIndex = progression[Math.floor(Math.random() * progression.length)];
        
        if (this.droneOsc && this.droneSub) {
             const semi = scale[this.chordRootIndex % scale.length];
             const freq = BASE_FREQ_A1 * Math.pow(2, (baseOctave - 1) + semi/12);
             
             this.droneOsc.frequency.exponentialRampToValueAtTime(freq, now + 1.0);
             this.droneSub.frequency.exponentialRampToValueAtTime(freq * 0.5, now + 1.0);
        }

        this.playPad(now, 10); // Long pads
    }

    // --- SPACE ARPEGGIATOR ---
    if (Math.random() < arpRate) {
        const chordIntervals = [0, 2, 4, 7]; 
        const interval = chordIntervals[Math.floor(Math.random() * chordIntervals.length)];
        const scaleIndex = (this.chordRootIndex + interval) % scale.length;
        
        const octaveOffset = Math.floor(Math.random() * 2);

        const semitones = scale[scaleIndex];
        const freq = BASE_FREQ_A1 * Math.pow(2, (baseOctave + 1 + octaveOffset) + semitones/12);
        
        const voice = new OscillatorVoice(
            this.ctx, 
            this.currentTheme.waveType === 'square' ? 'triangle' : 'sine', // Use softer waves for arps
            freq, 
            this.padFilter!,
            detuneAmount
        );
        
        // Soft Pluck
        voice.play(sixteenth * 2, 0.05, now, 0.05, 0.5);
        
        setTimeout(() => {
            voice.stop(this.ctx!.currentTime);
        }, 1000);
    }

    this.step++;
    this.timerId = window.setTimeout(() => this.scheduleLoop(), sixteenth * 1000);
  }

  playPad(now: number, duration: number) {
      if (!this.ctx) return;
      const { scale, baseOctave, detuneAmount } = this.currentTheme;
      
      const notes = [0, 4].map(offset => { 
          const idx = (this.chordRootIndex + offset) % scale.length;
          const semi = scale[idx];
          return BASE_FREQ_A1 * Math.pow(2, baseOctave + semi/12);
      });

      notes.forEach(freq => {
          const v = new OscillatorVoice(this.ctx!, 'sawtooth', freq, this.padFilter!, detuneAmount / 2);
          v.play(duration, 0.03, now, 3.0, 5.0); // Slow attack/release
          
          setTimeout(() => {
              v.stop(this.ctx!.currentTime);
          }, (duration + 8) * 1000);
      });
  }

  stop() {
    this.isPlaying = false;
    if (this.timerId) clearTimeout(this.timerId);
    if (this.masterGain && this.ctx) {
        this.masterGain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 2);
    }
    setTimeout(() => {
        this.stopDrone();
    }, 2000);
  }
}

// --- COMPLEX PROCEDURAL AUDIO GENERATION ---
// Generates complex waveforms by mixing sine, noise, and FM synthesis
const createAudioDataURI = (type: 'impact' | 'swell', durationSec: number, options: any = {}) => {
  const { volume = 1.0 } = options;
  const sampleRate = 44100;
  const numFrames = Math.floor(durationSec * sampleRate);
  const waveData = new Uint8Array(44 + numFrames);
  const view = new DataView(waveData.buffer);
  
  // WAV Header (Standard)
  view.setUint32(0, 0x52494646, false); view.setUint32(4, 36 + numFrames, true);
  view.setUint32(8, 0x57415645, false); view.setUint32(12, 0x666d7420, false);
  view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true); view.setUint32(28, sampleRate, true);
  view.setUint16(32, 1, true); view.setUint16(34, 8, true);
  view.setUint32(36, 0x64617461, false); view.setUint32(40, numFrames, true);

  for (let i = 0; i < numFrames; i++) {
    const t = i / sampleRate;
    let sample = 0;

    if (type === 'impact') {
        // High frequency noise burst + metallic ping
        // Envelope: Instant attack, fast exponential decay
        const envelope = Math.exp(-t * 40); 
        
        // 1. White Noise (Impact)
        const noise = (Math.random() * 2 - 1) * 0.5;
        
        // 2. Metallic Ring (FM Sine)
        const freq = 1200;
        const fm = Math.sin(2 * Math.PI * 50 * t) * 200; // 50Hz vibration
        const metal = Math.sin(2 * Math.PI * (freq + fm) * t);
        
        sample = (noise * 0.7 + metal * 0.3) * envelope;
    } 
    else if (type === 'swell') {
        // "Capture" sound: Low rumble swelling into a digital chime
        // Envelope: Bowed (slow attack, slow decay)
        const envelope = Math.sin(Math.PI * (t / durationSec)); 
        
        // 1. Low Thrum (FM)
        const baseFreq = 80;
        const modFreq = 20;
        const modulation = Math.sin(2 * Math.PI * modFreq * t) * 30;
        const low = Math.sin(2 * Math.PI * (baseFreq + modulation) * t);

        // 2. High Chime (Descending)
        const highFreq = 800 * (1 - t * 0.5);
        const high = Math.sin(2 * Math.PI * highFreq * t);
        
        sample = (low * 0.6 + high * 0.4) * envelope;
    }

    // Clip
    sample = Math.max(-1, Math.min(1, sample));
    
    // Convert to 8-bit offset binary
    waveData[44 + i] = Math.floor((sample * volume * 0.8 + 1) * 127.5);
  }
  
  const blob = new Blob([waveData], { type: 'audio/wav' });
  return URL.createObjectURL(blob);
};

// "Capture" = Swell (Liquid/Sci-fi) - Reduced Volume significantly
const captureURI = createAudioDataURI('swell', 0.6, { volume: 0.3 });
// "Collision" = Impact (Metallic/Click) - Reduced Volume significantly
const collisionURI = createAudioDataURI('impact', 0.1, { volume: 0.15 });

class SoundService {
  private capture: Howl;
  private collision: Howl;
  private musicEngine: SynthEngine;
  public enabled: boolean = true;
  
  private lastCaptureTime = 0;
  private lastCollisionTime = 0;

  constructor() {
    this.musicEngine = new SynthEngine();
    // Reduced base volume of effects
    this.capture = new Howl({ src: [captureURI], format: ['wav'], volume: 0.2, pool: 10 });
    this.collision = new Howl({ src: [collisionURI], format: ['wav'], volume: 0.05, pool: 20 });
  }

  initialize() {
    if (this.enabled) this.musicEngine.start();
  }

  setTheme(scene: 'menu' | 'arena' | 'evolution' | 'leaderboard', envName?: string) {
      let theme: ThemeType = 'MENU';
      
      if (scene === 'menu') theme = 'MENU';
      else if (scene === 'leaderboard') theme = 'LEADERBOARD';
      else if (scene === 'evolution') theme = 'EVOLUTION';
      else if (scene === 'arena') {
          if (envName?.includes('Vacuum')) theme = 'BATTLE_VOID';
          else if (envName?.includes('Soup')) theme = 'BATTLE_SOUP';
          else {
              const rand = Math.random();
              if (rand < 0.33) theme = 'BATTLE_STD';
              else if (rand < 0.66) theme = 'BATTLE_DARK';
              else theme = 'BATTLE_ACID';
          }
      }

      this.musicEngine.setTheme(theme);
  }

  playBatch(events: any) {
    if (!this.enabled) return;
    const now = Date.now();

    if (events.captures > 0) {
        // Increased throttle to 400ms for less frequent sounds
        if (now - this.lastCaptureTime > 400) { 
            const id = this.capture.play();
            // Vary pitch slightly for organic feel
            this.capture.rate(0.9 + Math.random() * 0.2, id);
            this.lastCaptureTime = now;
        }
    }

    if (events.collisions > 0) {
        // Increased throttle to 350ms for less frequent sounds
        if (now - this.lastCollisionTime > 350) { 
            const id = this.collision.play();
            // Higher pitch variation for collisions
            this.collision.rate(0.8 + Math.random() * 0.4, id);
            // Dynamic volume based on intensity (scaled down)
            const vol = Math.min(events.collisions, 10) / 100; 
            this.collision.volume(vol, id);
            this.lastCollisionTime = now;
        }
    }
  }

  toggle(on: boolean) {
    this.enabled = on;
    if (on) {
        Howler.mute(false);
        this.musicEngine.start();
    } else {
        Howler.mute(true);
        this.musicEngine.stop();
    }
  }
}

export const soundManager = new SoundService();
