
import { Howl, Howler } from 'howler';

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
    bpm: 25, 
    arpRate: 0.1,
    padCutoff: 200, 
    reverbLevel: 0.95,
    waveType: 'sine', 
    detuneAmount: 3,
    hasSubBass: true
  },
  BATTLE_STD: {
    scale: SCALE_PHRYGIAN_DOM,
    baseOctave: 2,
    bpm: 40, 
    arpRate: 0.4,
    padCutoff: 600, 
    reverbLevel: 0.8,
    waveType: 'triangle', 
    detuneAmount: 5,
    hasSubBass: true
  },
  BATTLE_VOID: {
    scale: SCALE_HUNGARIAN_MINOR,
    baseOctave: 1,
    bpm: 30,
    arpRate: 0.2,
    padCutoff: 300,
    reverbLevel: 0.98,
    waveType: 'sine',
    detuneAmount: 4,
    hasSubBass: true
  },
  BATTLE_SOUP: {
    scale: SCALE_DORIAN_b2,
    baseOctave: 2,
    bpm: 45, 
    arpRate: 0.5,
    padCutoff: 500,
    reverbLevel: 0.85,
    waveType: 'triangle', 
    detuneAmount: 8,
    hasSubBass: true
  },
  BATTLE_DARK: {
    scale: SCALE_LOCRIAN,
    baseOctave: 1,
    bpm: 35,
    arpRate: 0.3,
    padCutoff: 400,
    reverbLevel: 0.9,
    waveType: 'sine', 
    detuneAmount: 6, 
    hasSubBass: true
  },
  BATTLE_ACID: {
      scale: SCALE_HIRAJOSHI,
      baseOctave: 2,
      bpm: 50, 
      arpRate: 0.6,
      padCutoff: 800, 
      reverbLevel: 0.7,
      waveType: 'triangle', 
      detuneAmount: 8,
      hasSubBass: false
  },
  EVOLUTION: {
    scale: SCALE_HIRAJOSHI,
    baseOctave: 3,
    bpm: 60, 
    arpRate: 0.8, 
    padCutoff: 1000,
    reverbLevel: 0.6,
    waveType: 'sine',
    detuneAmount: 2,
    hasSubBass: false
  },
  LEADERBOARD: {
    scale: SCALE_PHRYGIAN_DOM,
    baseOctave: 2,
    bpm: 40,
    arpRate: 0.2,
    padCutoff: 400,
    reverbLevel: 0.9,
    waveType: 'sine',
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
    
    // Robust check for Howler context or fallback
    if (!Howler.ctx) {
        // Attempt to force create a context if Howler hasn't yet
        const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioContext) {
            Howler.ctx = new AudioContext();
        }
    }
    
    this.ctx = Howler.ctx;
    if (!this.ctx) return;
    
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = 0.6; 

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
    this.delayNode.delayTime.value = 0.7; 
    this.feedbackGain = this.ctx.createGain();
    this.feedbackGain.gain.value = 0.7; 

    const delayFilter = this.ctx.createBiquadFilter();
    delayFilter.type = 'lowpass';
    delayFilter.frequency.value = 600; 

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
    if (!config) return;
    
    this.currentTheme = config;

    if (this.ctx) {
        const now = this.ctx.currentTime;
        if (this.padFilter) {
            this.padFilter.frequency.exponentialRampToValueAtTime(Math.max(100, config.padCutoff), now + 3);
        }

        if (this.feedbackGain) {
            this.feedbackGain.gain.linearRampToValueAtTime(config.reverbLevel * 0.7, now + 3);
        }
        
        if (this.isPlaying) {
             this.startDrone();
        }
    }
  }

  start() {
    this.init();
    if (this.isPlaying || !this.ctx) return;
    if (this.ctx.state === 'suspended') this.ctx.resume();

    this.isPlaying = true;
    this.masterGain!.gain.value = 0.6; 
    
    this.startDrone();
    this.scheduleLoop();
  }

  startDrone() {
      if (!this.ctx) return;
      this.stopDrone();

      this.droneGain = this.ctx.createGain();
      this.droneGain.gain.value = 0.25; // Boosted drone volume

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
    if (this.step % 64 === 0) { 
        const progression = [0, 2, 4, 1, 5, 0];
        this.chordRootIndex = progression[Math.floor(Math.random() * progression.length)];
        
        if (this.droneOsc && this.droneSub) {
             const semi = scale[this.chordRootIndex % scale.length];
             const freq = BASE_FREQ_A1 * Math.pow(2, (baseOctave - 1) + semi/12);
             
             this.droneOsc.frequency.exponentialRampToValueAtTime(freq, now + 1.0);
             this.droneSub.frequency.exponentialRampToValueAtTime(freq * 0.5, now + 1.0);
        }

        this.playPad(now, 12); 
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
            this.currentTheme.waveType === 'square' ? 'triangle' : 'sine', 
            freq, 
            this.padFilter!,
            detuneAmount
        );
        
        // Boosted arp volume
        voice.play(sixteenth * 3, 0.15, now, 0.1, 0.8);
        
        setTimeout(() => {
            if (this.ctx) voice.stop(this.ctx.currentTime);
        }, 1500);
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
          const wave = this.currentTheme.waveType === 'sawtooth' ? 'triangle' : this.currentTheme.waveType;
          const v = new OscillatorVoice(this.ctx!, wave, freq, this.padFilter!, detuneAmount / 2);
          // Boosted pad volume
          v.play(duration, 0.1, now, 4.0, 6.0); 
          
          setTimeout(() => {
              if (this.ctx) v.stop(this.ctx.currentTime);
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
const createAudioDataURI = (type: 'impact' | 'swell', durationSec: number, options: any = {}) => {
  const { volume = 1.0 } = options;
  const sampleRate = 44100;
  const numFrames = Math.floor(durationSec * sampleRate);
  const waveData = new Uint8Array(44 + numFrames * 2);
  const view = new DataView(waveData.buffer);
  
  // WAV Header (Standard)
  view.setUint32(0, 0x52494646, false); view.setUint32(4, 36 + numFrames * 2, true);
  view.setUint32(8, 0x57415645, false); view.setUint32(12, 0x666d7420, false);
  view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true); view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true); view.setUint16(34, 16, true);
  view.setUint32(36, 0x64617461, false); view.setUint32(40, numFrames * 2, true);

  for (let i = 0; i < numFrames; i++) {
    const t = i / sampleRate;
    let sample = 0;

    if (type === 'impact') {
        const envelope = Math.exp(-t * 40); 
        const noise = (Math.random() * 2 - 1) * 0.5;
        const freq = 1200;
        const fm = Math.sin(2 * Math.PI * 50 * t) * 200; 
        const metal = Math.sin(2 * Math.PI * (freq + fm) * t);
        sample = (noise * 0.7 + metal * 0.3) * envelope;
    } 
    else if (type === 'swell') {
        const envelope = Math.sin(Math.PI * (t / durationSec)); 
        const baseFreq = 80;
        const modFreq = 20;
        const modulation = Math.sin(2 * Math.PI * modFreq * t) * 30;
        const low = Math.sin(2 * Math.PI * (baseFreq + modulation) * t);
        const highFreq = 800 * (1 - t * 0.5);
        const high = Math.sin(2 * Math.PI * highFreq * t);
        sample = (low * 0.6 + high * 0.4) * envelope;
    }

    sample *= volume;
    // Clip
    sample = Math.max(-1, Math.min(1, sample));
    
    // Convert float to 16-bit PCM (Little Endian)
    const s = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
    view.setInt16(44 + i * 2, s, true);
  }
  
  const blob = new Blob([view], { type: 'audio/wav' });
  return URL.createObjectURL(blob);
};

class SoundManager {
    engine: SynthEngine;
    enabled: boolean = false;
    initialized: boolean = false;
    sfx: Record<string, Howl> = {};

    constructor() {
        this.engine = new SynthEngine();
    }

    initialize() {
        if (this.initialized) return;
        
        try {
            this.sfx['collision'] = new Howl({
                src: [createAudioDataURI('impact', 0.1, { volume: 0.3 })],
                format: ['wav'],
                volume: 0.2
            });
            this.sfx['capture'] = new Howl({
                src: [createAudioDataURI('swell', 0.4, { volume: 0.6 })],
                format: ['wav'],
                volume: 0.5
            });
        } catch(e) { console.warn("SFX gen failed", e); }
        
        this.initialized = true;
    }

    toggle(state: boolean) {
        this.enabled = state;
        if (state) {
            // Ensure context is running if blocked by browser autoplay policy
            if (Howler.ctx && Howler.ctx.state === 'suspended') {
                 Howler.ctx.resume();
            }
            this.engine.start();
        } else {
            this.engine.stop();
        }
    }

    setTheme(scene: string, envName?: string) {
        let theme: ThemeType = 'MENU';
        if (scene === 'menu') theme = 'MENU';
        else if (scene === 'evolution') theme = 'EVOLUTION';
        else if (scene === 'leaderboard') theme = 'LEADERBOARD';
        else if (scene === 'arena') {
             if (envName?.includes('Soup')) theme = 'BATTLE_SOUP';
             else if (envName?.includes('Vacuum')) theme = 'BATTLE_VOID';
             else if (envName?.includes('Swarm')) theme = 'BATTLE_DARK';
             else if (envName?.includes('Zero')) theme = 'BATTLE_ACID';
             else theme = 'BATTLE_STD';
        }
        this.engine.setTheme(theme);
    }

    playBatch(events: { collisions: number, captures: number }) {
        if (!this.enabled) return;
        
        if (events.captures > 0) {
            const id = this.sfx['capture']?.play();
            this.sfx['capture']?.rate(0.9 + Math.random() * 0.2, id);
        }
        if (events.collisions > 0 && Math.random() < 0.1) {
            const id = this.sfx['collision']?.play();
            this.sfx['collision']?.rate(0.8 + Math.random() * 0.4, id);
        }
    }
}

export const soundManager = new SoundManager();
