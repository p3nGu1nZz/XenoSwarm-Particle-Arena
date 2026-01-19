import { Howl, Howler } from 'howler';

// --- MUSIC CONSTANTS ---
const BASE_FREQ_A1 = 55.0;

// Scales
const SCALE_MINOR = [0, 2, 3, 5, 7, 8, 10, 12]; // Natural Minor
const SCALE_LYDIAN = [0, 2, 4, 6, 7, 9, 11, 12]; // Ethereal / Sci-fi
const SCALE_PHRYGIAN = [0, 1, 3, 5, 7, 8, 10, 12]; // Tension / Dark
const SCALE_PENTATONIC_MAJOR = [0, 2, 4, 7, 9, 12]; // Menu / Chill

type ThemeType = 'MENU' | 'BATTLE_STD' | 'BATTLE_VOID' | 'BATTLE_SOUP' | 'EVOLUTION' | 'LEADERBOARD';

interface ThemeConfig {
  scale: number[];
  baseOctave: number;
  bpm: number;
  arpRate: number; // probability 0-1
  padCutoff: number;
  reverbLevel: number; // 0-1 (Delay feedback simulation)
  waveType: OscillatorType;
}

const THEMES: Record<ThemeType, ThemeConfig> = {
  MENU: {
    scale: SCALE_PENTATONIC_MAJOR,
    baseOctave: 2,
    bpm: 60,
    arpRate: 0.2,
    padCutoff: 600,
    reverbLevel: 0.7,
    waveType: 'sine'
  },
  BATTLE_STD: {
    scale: SCALE_MINOR,
    baseOctave: 2,
    bpm: 110,
    arpRate: 0.6,
    padCutoff: 1000,
    reverbLevel: 0.4,
    waveType: 'sawtooth'
  },
  BATTLE_VOID: {
    scale: SCALE_LYDIAN,
    baseOctave: 1,
    bpm: 70,
    arpRate: 0.4,
    padCutoff: 400,
    reverbLevel: 0.8,
    waveType: 'triangle'
  },
  BATTLE_SOUP: {
    scale: SCALE_PHRYGIAN,
    baseOctave: 1,
    bpm: 90,
    arpRate: 0.5,
    padCutoff: 300,
    reverbLevel: 0.6,
    waveType: 'square'
  },
  EVOLUTION: {
    scale: SCALE_LYDIAN,
    baseOctave: 3,
    bpm: 140,
    arpRate: 0.8, // Glitchy fast
    padCutoff: 2000,
    reverbLevel: 0.3,
    waveType: 'square'
  },
  LEADERBOARD: {
    scale: SCALE_PENTATONIC_MAJOR,
    baseOctave: 2,
    bpm: 80,
    arpRate: 0.1,
    padCutoff: 800,
    reverbLevel: 0.5,
    waveType: 'triangle'
  }
};

class OscillatorVoice {
  osc: OscillatorNode;
  gain: GainNode;
  ctx: AudioContext;

  constructor(ctx: AudioContext, type: OscillatorType, freq: number, dest: AudioNode) {
    this.ctx = ctx;
    this.osc = ctx.createOscillator();
    this.gain = ctx.createGain();
    
    this.osc.type = type;
    this.osc.frequency.value = freq;
    
    this.osc.connect(this.gain);
    this.gain.connect(dest);
    this.gain.gain.value = 0;
    this.osc.start();
  }

  play(duration: number, volume: number, now: number, attack: number = 0.05, release: number = 0.1) {
    this.gain.gain.cancelScheduledValues(now);
    this.gain.gain.setValueAtTime(0, now);
    this.gain.gain.linearRampToValueAtTime(volume, now + attack);
    this.gain.gain.exponentialRampToValueAtTime(0.001, now + duration + release);
  }

  stop(now: number) {
    this.gain.gain.exponentialRampToValueAtTime(0.001, now + 1);
    this.osc.stop(now + 1);
  }
}

class SynthEngine {
  ctx: AudioContext | null = null;
  masterGain: GainNode | null = null;
  
  // Effects
  delayNode: DelayNode | null = null;
  feedbackGain: GainNode | null = null;
  compressor: DynamicsCompressorNode | null = null;

  // Layers
  droneOsc: OscillatorNode | null = null;
  droneGain: GainNode | null = null;
  
  padFilter: BiquadFilterNode | null = null;
  activeVoices: OscillatorVoice[] = [];
  
  // State
  currentTheme: ThemeConfig = THEMES.MENU;
  isPlaying: boolean = false;
  timerId: number | null = null;
  step: number = 0;
  chordRootIndex: number = 0; // Index in scale

  init() {
    if (this.ctx) return;
    this.ctx = Howler.ctx;
    if (!this.ctx) return;
    
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = 0.3;

    // Compressor to glue it together
    this.compressor = this.ctx.createDynamicsCompressor();
    this.compressor.threshold.value = -24;
    this.compressor.knee.value = 30;
    this.compressor.ratio.value = 12;
    this.compressor.attack.value = 0.003;
    this.compressor.release.value = 0.25;

    this.masterGain.connect(this.compressor);
    this.compressor.connect(this.ctx.destination);

    // Ethereal Delay (Simulating Reverb/Space)
    this.delayNode = this.ctx.createDelay();
    this.delayNode.delayTime.value = 0.4; // 400ms
    this.feedbackGain = this.ctx.createGain();
    this.feedbackGain.gain.value = 0.5;

    this.delayNode.connect(this.feedbackGain);
    this.feedbackGain.connect(this.delayNode);
    this.feedbackGain.connect(this.masterGain);

    // Pad Filter
    this.padFilter = this.ctx.createBiquadFilter();
    this.padFilter.type = 'lowpass';
    this.padFilter.frequency.value = 800;
    this.padFilter.connect(this.masterGain);
    this.padFilter.connect(this.delayNode); // Send to delay
  }

  setTheme(themeName: ThemeType) {
    const config = THEMES[themeName];
    if (!config || !this.ctx) return;
    
    // Smooth transition of params
    const now = this.ctx.currentTime;
    
    // 1. Update Filter
    if (this.padFilter) {
        this.padFilter.frequency.linearRampToValueAtTime(config.padCutoff, now + 2);
    }

    // 2. Update Delay/Reverb
    if (this.feedbackGain) {
        this.feedbackGain.gain.linearRampToValueAtTime(config.reverbLevel * 0.7, now + 2);
    }
    
    // 3. Update State
    this.currentTheme = config;
  }

  start() {
    this.init();
    if (this.isPlaying || !this.ctx) return;
    if (this.ctx.state === 'suspended') this.ctx.resume();

    this.isPlaying = true;
    this.masterGain!.gain.value = 0.3;
    
    // Start Drone
    this.startDrone();
    this.scheduleLoop();
  }

  startDrone() {
      if (!this.ctx) return;
      if (this.droneOsc) this.stopDrone();

      this.droneOsc = this.ctx.createOscillator();
      this.droneOsc.type = this.currentTheme.waveType === 'sine' ? 'sine' : 'sawtooth';
      // Root note of scale
      const freq = BASE_FREQ_A1 * Math.pow(2, this.currentTheme.baseOctave - 1); // Low drone
      this.droneOsc.frequency.value = freq;
      
      this.droneGain = this.ctx.createGain();
      this.droneGain.gain.value = 0.05;
      
      const lpf = this.ctx.createBiquadFilter();
      lpf.type = 'lowpass';
      lpf.frequency.value = 100;

      this.droneOsc.connect(lpf);
      lpf.connect(this.droneGain);
      this.droneGain.connect(this.masterGain!);
      
      this.droneOsc.start();
  }

  stopDrone() {
      if (this.droneOsc) {
          try { this.droneOsc.stop(); } catch(e) {}
          this.droneOsc.disconnect();
          this.droneOsc = null;
      }
  }

  scheduleLoop() {
    if (!this.isPlaying || !this.ctx) return;

    const now = this.ctx.currentTime;
    const { bpm, scale, baseOctave, arpRate } = this.currentTheme;
    const beatTime = 60 / bpm;
    const sixteenth = beatTime / 4;

    // --- CHORD PROGRESSION LOGIC ---
    // Change root note every 16 steps (1 bar approx)
    if (this.step % 16 === 0) {
        // Simple procedural progression: I -> IV -> V -> vi etc
        const progression = [0, 3, 4, 5, 0, 2]; // Scale degrees
        const nextDegree = progression[Math.floor(Math.random() * progression.length)];
        this.chordRootIndex = nextDegree;
        
        // Update Drone
        if (this.droneOsc) {
             // Calculate frequency for new root
             const semi = scale[this.chordRootIndex % scale.length];
             const freq = BASE_FREQ_A1 * Math.pow(2, (baseOctave - 1) + semi/12);
             this.droneOsc.frequency.setValueAtTime(freq, now);
        }

        // Play a Pad Chord
        this.playPad(now, 4); // 4 seconds duration
    }

    // --- ARPEGGIATOR LOGIC ---
    if (Math.random() < arpRate) {
        // Pick a note from the chord (Root, 3rd, 5th) or scale
        const chordIntervals = [0, 2, 4]; // Indexes in scale array relative to root
        const interval = chordIntervals[Math.floor(Math.random() * chordIntervals.length)];
        const scaleIndex = (this.chordRootIndex + interval) % scale.length;
        
        let octaveOffset = Math.random() > 0.6 ? 1 : 0;
        if (this.currentTheme.waveType === 'sine') octaveOffset += 1; // Higher for ethereal

        const semitones = scale[scaleIndex];
        const freq = BASE_FREQ_A1 * Math.pow(2, (baseOctave + 1 + octaveOffset) + semitones/12);
        
        const voice = new OscillatorVoice(
            this.ctx, 
            this.currentTheme.waveType, 
            freq, 
            this.padFilter! // Route through filter/delay
        );
        
        // Short pluck
        voice.play(sixteenth * 2, 0.05, now, 0.01, 0.2);
        
        // Clean up
        setTimeout(() => {
            voice.stop(this.ctx!.currentTime);
        }, 1000);
    }

    this.step++;
    this.timerId = window.setTimeout(() => this.scheduleLoop(), sixteenth * 1000);
  }

  playPad(now: number, duration: number) {
      if (!this.ctx) return;
      const { scale, baseOctave } = this.currentTheme;
      
      // Triad: Root, +2 scale steps, +4 scale steps
      const notes = [0, 2, 4].map(offset => {
          const idx = (this.chordRootIndex + offset) % scale.length;
          const semi = scale[idx];
          return BASE_FREQ_A1 * Math.pow(2, baseOctave + semi/12);
      });

      notes.forEach(freq => {
          // Detune slightly for "Analog" feel
          const detune = 1 + (Math.random() - 0.5) * 0.01;
          const v = new OscillatorVoice(this.ctx!, 'triangle', freq * detune, this.padFilter!);
          // Slow attack pad
          v.play(duration, 0.03, now, 1.0, 2.0);
          
          setTimeout(() => {
              v.stop(this.ctx!.currentTime);
          }, (duration + 3) * 1000);
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

// --- SFX (UNCHANGED) ---
const createAudioDataURI = (frequency: number, type: any, durationSec: number, options: any = {}) => {
  // ... (Existing SFX generator code kept for brevity, it's efficient) ...
  const { volume = 1.0, attack = 0.01, decay = 0.99 } = options;
  const sampleRate = 44100;
  const numFrames = Math.floor(durationSec * sampleRate);
  const waveData = new Uint8Array(44 + numFrames);
  const view = new DataView(waveData.buffer);
  
  // Header
  view.setUint32(0, 0x52494646, false); view.setUint32(4, 36 + numFrames, true);
  view.setUint32(8, 0x57415645, false); view.setUint32(12, 0x666d7420, false);
  view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true); view.setUint32(28, sampleRate, true);
  view.setUint16(32, 1, true); view.setUint16(34, 8, true);
  view.setUint32(36, 0x64617461, false); view.setUint32(40, numFrames, true);

  const attackFrames = Math.floor(numFrames * attack);
  for (let i = 0; i < numFrames; i++) {
    const t = i / sampleRate;
    let sample = 0;
    if (type === 'noise') sample = (Math.random() * 2 - 1) * 0.7;
    else sample = Math.sin(2 * Math.PI * frequency * t); // Fallback to sine for simplicity in this snippet

    let envelope = i < attackFrames ? i / attackFrames : Math.pow(1 - (i - attackFrames) / (numFrames - attackFrames), 3);
    waveData[44 + i] = Math.floor((sample * envelope * volume + 1) * 127.5);
  }
  const blob = new Blob([waveData], { type: 'audio/wav' });
  return URL.createObjectURL(blob);
};

const captureURI = createAudioDataURI(220, 'sine', 0.6, { volume: 0.5, attack: 0.1, decay: 0.8 });
const collisionURI = createAudioDataURI(100, 'sine', 0.1, { volume: 0.3 });

class SoundService {
  private capture: Howl;
  private collision: Howl;
  private musicEngine: SynthEngine;
  public enabled: boolean = true;
  private lastTime = 0;

  constructor() {
    this.musicEngine = new SynthEngine();
    this.capture = new Howl({ src: [captureURI], format: ['wav'], volume: 0.4, pool: 5 });
    this.collision = new Howl({ src: [collisionURI], format: ['wav'], volume: 0.2, pool: 5 });
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
          else theme = 'BATTLE_STD';
      }

      this.musicEngine.setTheme(theme);
  }

  playBatch(events: any) {
    if (!this.enabled) return;
    const now = Date.now();
    // Throttled SFX to prevent audio tearing
    if (events.captures > 0 && now - this.lastTime > 150) {
        this.capture.play();
        this.lastTime = now;
    } else if (events.collisions > 5 && now - this.lastTime > 150) {
        this.collision.play();
        this.lastTime = now;
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