import { Howl, Howler } from 'howler';

// --- GENERATIVE MUSIC ENGINE (SYNTHWAVE) ---

const SCALE_MINOR_PENTATONIC = [0, 3, 5, 7, 10, 12]; 
const BASE_FREQ = 55.0; // A1

class OscillatorVoice {
  osc: OscillatorNode;
  gain: GainNode;
  ctx: AudioContext;

  constructor(ctx: AudioContext, type: OscillatorType, freq: number) {
    this.ctx = ctx;
    this.osc = ctx.createOscillator();
    this.gain = ctx.createGain();
    
    this.osc.type = type;
    this.osc.frequency.value = freq;
    
    this.osc.connect(this.gain);
    this.gain.gain.value = 0;
    this.osc.start();
  }

  connect(dest: AudioNode) {
    this.gain.connect(dest);
  }

  play(duration: number, volume: number, now: number) {
    this.gain.gain.cancelScheduledValues(now);
    this.gain.gain.setValueAtTime(0, now);
    this.gain.gain.linearRampToValueAtTime(volume, now + 0.05); // Attack
    this.gain.gain.exponentialRampToValueAtTime(0.001, now + duration); // Decay
  }
  
  setFreq(freq: number, now: number) {
      this.osc.frequency.setValueAtTime(freq, now);
  }
}

class SynthEngine {
  ctx: AudioContext | null = null;
  masterGain: GainNode | null = null;
  
  // Layers
  bassOsc: OscillatorNode | null = null;
  bassGain: GainNode | null = null;
  
  padFilter: BiquadFilterNode | null = null;
  padOscs: OscillatorVoice[] = [];
  
  arpOsc: OscillatorVoice | null = null;
  arpDelay: DelayNode | null = null;
  arpFeedback: GainNode | null = null;

  isPlaying: boolean = false;
  timerId: number | null = null;
  
  // Sequencer State
  step: number = 0;

  start() {
    if (this.isPlaying) return;
    this.ctx = Howler.ctx;
    if (!this.ctx) return;
    if (this.ctx.state === 'suspended') this.ctx.resume();

    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = 0.4; // Master volume
    this.masterGain.connect(this.ctx.destination);

    // 1. DRONE BASS
    this.bassOsc = this.ctx.createOscillator();
    this.bassOsc.type = 'sawtooth';
    this.bassOsc.frequency.value = BASE_FREQ; // A1
    this.bassGain = this.ctx.createGain();
    this.bassGain.gain.value = 0.15;
    
    // Lowpass on bass to make it deep
    const bassFilter = this.ctx.createBiquadFilter();
    bassFilter.type = 'lowpass';
    bassFilter.frequency.value = 120;
    
    this.bassOsc.connect(bassFilter);
    bassFilter.connect(this.bassGain);
    this.bassGain.connect(this.masterGain);
    this.bassOsc.start();

    // 2. PAD LAYER (Ethereal chords)
    this.padFilter = this.ctx.createBiquadFilter();
    this.padFilter.type = 'lowpass';
    this.padFilter.frequency.value = 400;
    this.padFilter.Q.value = 1;
    this.padFilter.connect(this.masterGain);
    
    // Slow LFO on Pad Filter
    const lfo = this.ctx.createOscillator();
    lfo.frequency.value = 0.1;
    const lfoGain = this.ctx.createGain();
    lfoGain.gain.value = 200;
    lfo.connect(lfoGain);
    lfoGain.connect(this.padFilter.frequency);
    lfo.start();

    // Create a chord (Root, Minor 3rd, 5th)
    const chordFreqs = [BASE_FREQ * 2, BASE_FREQ * 2 * 1.2, BASE_FREQ * 2 * 1.5]; // A2, C3, E3 approx
    chordFreqs.forEach(f => {
        const v = new OscillatorVoice(this.ctx!, 'triangle', f);
        v.gain.gain.value = 0.05;
        v.connect(this.padFilter!);
        this.padOscs.push(v);
    });

    // 3. ARPEGGIATOR (Melodic bleeps)
    this.arpOsc = new OscillatorVoice(this.ctx, 'square', BASE_FREQ * 4);
    
    // Delay Effect for Arp
    this.arpDelay = this.ctx.createDelay();
    this.arpDelay.delayTime.value = 0.3; // 300ms delay
    this.arpFeedback = this.ctx.createGain();
    this.arpFeedback.gain.value = 0.4;
    
    this.arpOsc.connect(this.masterGain); // Dry
    this.arpOsc.connect(this.arpDelay);   // Send to Delay
    this.arpDelay.connect(this.arpFeedback);
    this.arpFeedback.connect(this.arpDelay);
    this.arpDelay.connect(this.masterGain); // Wet

    this.isPlaying = true;
    this.scheduleNextNote();
  }

  scheduleNextNote() {
      if (!this.isPlaying || !this.ctx) return;

      const now = this.ctx.currentTime;
      const bpm = 110;
      const stepTime = 60 / bpm / 2; // 8th notes

      // Random Arp Note from Scale
      if (Math.random() > 0.3) {
          const noteIndex = Math.floor(Math.random() * SCALE_MINOR_PENTATONIC.length);
          const octave = Math.random() > 0.7 ? 4 : 3;
          const semitones = SCALE_MINOR_PENTATONIC[noteIndex];
          const freq = BASE_FREQ * Math.pow(2, octave + semitones/12);
          
          if (this.arpOsc) {
            this.arpOsc.setFreq(freq, now);
            this.arpOsc.play(0.1, 0.08, now);
          }
      }

      // Modulate Bass slightly
      if (this.step % 16 === 0) {
          // Change root note occasionally? Keep it simple drone for now.
      }

      this.step++;
      this.timerId = window.setTimeout(() => this.scheduleNextNote(), stepTime * 1000);
  }

  stop() {
    if (!this.isPlaying) return;
    this.isPlaying = false;
    if (this.timerId) clearTimeout(this.timerId);

    const now = this.ctx?.currentTime || 0;
    
    // Fade out master
    if (this.masterGain) {
        this.masterGain.gain.exponentialRampToValueAtTime(0.001, now + 1);
    }

    setTimeout(() => {
        this.bassOsc?.stop();
        this.padOscs.forEach(o => o.osc.stop());
        this.arpOsc?.osc.stop();
        
        this.bassOsc = null;
        this.padOscs = [];
        this.arpOsc = null;
        this.masterGain = null;
    }, 1000);
  }
}

// --- WAV GENERATOR (SFX) ---
const createAudioDataURI = (
  frequency: number, 
  type: 'sine' | 'square' | 'noise' | 'sawtooth' | 'triangle', 
  durationSec: number,
  options: {
    volume?: number,
    attack?: number, 
    decay?: number   
  } = {}
) => {
  const { volume = 1.0, attack = 0.01, decay = 0.99 } = options;
  const sampleRate = 44100;
  const numFrames = Math.floor(durationSec * sampleRate);
  const waveData = new Uint8Array(44 + numFrames);
  
  const view = new DataView(waveData.buffer);
  view.setUint32(0, 0x52494646, false); 
  view.setUint32(4, 36 + numFrames, true);
  view.setUint32(8, 0x57415645, false); 
  view.setUint32(12, 0x666d7420, false); 
  view.setUint32(16, 16, true); 
  view.setUint16(20, 1, true); 
  view.setUint16(22, 1, true); 
  view.setUint32(24, sampleRate, true); 
  view.setUint32(28, sampleRate, true); 
  view.setUint16(32, 1, true); 
  view.setUint16(34, 8, true); 
  view.setUint32(36, 0x64617461, false); 
  view.setUint32(40, numFrames, true);
  
  const attackFrames = Math.floor(numFrames * attack);
  
  for (let i = 0; i < numFrames; i++) {
    const t = i / sampleRate;
    let sample = 0;
    
    switch (type) {
      case 'noise': sample = (Math.random() * 2 - 1) * 0.7; break; 
      case 'square': sample = Math.sin(2 * Math.PI * frequency * t) > 0 ? 0.4 : -0.4; break;
      case 'triangle': sample = Math.abs(2 * ((t * frequency) % 1) - 1) * 2 - 1; break;
      case 'sawtooth': sample = 2 * ((t * frequency) % 1) - 1; break;
      case 'sine': default: sample = Math.sin(2 * Math.PI * frequency * t); break;
    }

    let envelope = 0;
    if (i < attackFrames) {
        envelope = i / attackFrames;
    } else {
        const decayProgress = (i - attackFrames) / (numFrames - attackFrames);
        envelope = Math.pow(1 - decayProgress, 3); 
    }
    
    const finalSample = sample * envelope * volume;
    waveData[44 + i] = Math.floor((finalSample + 1) * 127.5);
  }
  
  const blob = new Blob([waveData], { type: 'audio/wav' });
  return URL.createObjectURL(blob);
};

// SFX Definitions
const collisionLightURI = createAudioDataURI(120, 'square', 0.1, { volume: 0.4, attack: 0.01, decay: 0.8 });
const collisionHeavyURI = createAudioDataURI(60, 'sawtooth', 0.25, { volume: 0.6, attack: 0.05, decay: 0.9 });
const captureURI = createAudioDataURI(220, 'sine', 0.6, { volume: 0.5, attack: 0.1, decay: 0.8 });
const escapeURI = createAudioDataURI(80, 'noise', 0.8, { volume: 0.3, attack: 0.4, decay: 0.8 });


class SoundService {
  private collisionLight: Howl;
  private collisionHeavy: Howl;
  private capture: Howl;
  private escape: Howl;
  private musicEngine: SynthEngine;
  
  public enabled: boolean = true;
  
  private lastLightTime = 0;
  private lastHeavyTime = 0;
  private lastCaptureTime = 0;

  constructor() {
    this.musicEngine = new SynthEngine();

    this.collisionLight = new Howl({ 
        src: [collisionLightURI], 
        format: ['wav'], 
        volume: 0.2,
        pool: 10
    });

    this.collisionHeavy = new Howl({ 
        src: [collisionHeavyURI], 
        format: ['wav'], 
        volume: 0.3,
        pool: 5
    });

    this.capture = new Howl({ 
        src: [captureURI], 
        format: ['wav'], 
        volume: 0.4,
        pool: 5
    });

    this.escape = new Howl({ 
        src: [escapeURI], 
        format: ['wav'], 
        volume: 0.2,
        pool: 5
    });
  }

  initialize() {
    if (Howler.ctx && Howler.ctx.state === 'suspended') {
        Howler.ctx.resume();
    }
    if (this.enabled) {
        this.musicEngine.start();
    }
  }

  playBatch(events: { collisions: number, captures: number, escapes: number }) {
    if (!this.enabled) return;
    const now = Date.now();

    if (events.captures > 0 && now - this.lastCaptureTime > 200) {
        const id = this.capture.play();
        const scale = [0.75, 0.8, 1.0, 1.2]; 
        const rate = scale[Math.floor(Math.random() * scale.length)];
        this.capture.rate(rate, id); 
        this.lastCaptureTime = now;
        return; 
    }

    if (events.collisions > 0) {
        if (now - this.lastLightTime > 80) {
            if (Math.random() > 0.7 || events.collisions > 5) {
                if (now - this.lastHeavyTime > 150) {
                    const id = this.collisionHeavy.play();
                    this.collisionHeavy.rate(0.8 + Math.random() * 0.4, id);
                    this.collisionHeavy.stereo(Math.random() * 1 - 0.5, id);
                    this.lastHeavyTime = now;
                }
            } else {
                const id = this.collisionLight.play();
                this.collisionLight.rate(0.8 + Math.random() * 0.4, id); 
                this.collisionLight.stereo(Math.random() * 1 - 0.5, id);
                this.lastLightTime = now;
            }
        }
    }

    if (events.escapes > 0 && Math.random() > 0.5) {
        const id = this.escape.play();
        this.escape.rate(0.5 + Math.random() * 0.5, id);
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