import { Howl, Howler } from 'howler';

// Enhanced WAV generator with ADSR-like envelope support
const createAudioDataURI = (
  frequency: number, 
  type: 'sine' | 'square' | 'noise' | 'sawtooth' | 'triangle', 
  durationSec: number,
  options: {
    volume?: number,
    attack?: number, // percentage of duration (0-1)
    decay?: number   // percentage of duration (0-1)
  } = {}
) => {
  const { volume = 1.0, attack = 0.01, decay = 0.99 } = options;
  const sampleRate = 44100;
  const numFrames = Math.floor(durationSec * sampleRate);
  const waveData = new Uint8Array(44 + numFrames);
  
  // WAV Header (Standard PCM)
  const view = new DataView(waveData.buffer);
  view.setUint32(0, 0x52494646, false); // "RIFF"
  view.setUint32(4, 36 + numFrames, true);
  view.setUint32(8, 0x57415645, false); // "WAVE"
  view.setUint32(12, 0x666d7420, false); // "fmt "
  view.setUint32(16, 16, true); 
  view.setUint16(20, 1, true); 
  view.setUint16(22, 1, true); 
  view.setUint32(24, sampleRate, true); 
  view.setUint32(28, sampleRate, true); 
  view.setUint16(32, 1, true); 
  view.setUint16(34, 8, true); 
  view.setUint32(36, 0x64617461, false); // "data"
  view.setUint32(40, numFrames, true);
  
  const attackFrames = Math.floor(numFrames * attack);
  
  for (let i = 0; i < numFrames; i++) {
    const t = i / sampleRate;
    let sample = 0;
    
    // Oscillators
    switch (type) {
      case 'noise': sample = Math.random() * 2 - 1; break;
      case 'square': sample = Math.sin(2 * Math.PI * frequency * t) > 0 ? 0.7 : -0.7; break;
      case 'sawtooth': sample = 2 * ((t * frequency) % 1) - 1; break;
      case 'triangle': sample = Math.abs(2 * ((t * frequency) % 1) - 1) * 2 - 1; break;
      case 'sine': default: sample = Math.sin(2 * Math.PI * frequency * t); break;
    }

    // Envelope
    let envelope = 0;
    if (i < attackFrames) {
        // Linear Attack
        envelope = i / attackFrames;
    } else {
        // Exponential Decay
        const decayProgress = (i - attackFrames) / (numFrames - attackFrames);
        envelope = Math.pow(1 - decayProgress, 3); // Cubic falloff for percussive sound
    }
    
    const finalSample = sample * envelope * volume;
    waveData[44 + i] = Math.floor((finalSample + 1) * 127.5);
  }
  
  const blob = new Blob([waveData], { type: 'audio/wav' });
  return URL.createObjectURL(blob);
};

// --- Sound Palette ---

// 1. Light Collision: High pitched, very short sine blip. Represents individual particle contacts.
const collisionLightURI = createAudioDataURI(800, 'sine', 0.05, { volume: 0.6, attack: 0.0, decay: 0.9 });

// 2. Heavy Collision: Lower pitch, square wave presence. Represents clustered impacts.
const collisionHeavyURI = createAudioDataURI(150, 'square', 0.12, { volume: 0.5, attack: 0.05, decay: 0.9 });

// 3. Capture: Rising saw-tooth, distinct "power up" feel.
const captureURI = createAudioDataURI(440, 'sawtooth', 0.25, { volume: 0.4, attack: 0.1, decay: 0.9 });

// 4. Escape: White noise wash.
const escapeURI = createAudioDataURI(100, 'noise', 0.4, { volume: 0.3, attack: 0.1, decay: 0.9 });


class SoundService {
  private collisionLight: Howl;
  private collisionHeavy: Howl;
  private capture: Howl;
  private escape: Howl;
  private enabled: boolean = true;
  
  // Throttling timestamps
  private lastLightTime = 0;
  private lastHeavyTime = 0;
  private lastCaptureTime = 0;
  private lastEscapeTime = 0;

  constructor() {
    // Increase pool size to allow overlapping sounds (layering) without cutting off
    this.collisionLight = new Howl({ 
        src: [collisionLightURI], 
        format: ['wav'], 
        volume: 0.15,
        pool: 20 
    });

    this.collisionHeavy = new Howl({ 
        src: [collisionHeavyURI], 
        format: ['wav'], 
        volume: 0.25,
        pool: 10
    });

    this.capture = new Howl({ 
        src: [captureURI], 
        format: ['wav'], 
        volume: 0.3,
        pool: 5
    });

    this.escape = new Howl({ 
        src: [escapeURI], 
        format: ['wav'], 
        volume: 0.2,
        pool: 5
    });
  }

  playBatch(events: { collisions: number, captures: number, escapes: number }) {
    if (!this.enabled) return;
    const now = Date.now();

    // --- COLLISION LAYERING ---
    if (events.collisions > 0) {
        // Layer 1: Light Texture (Frequent)
        // Throttle to 30ms to allow a "cloud" of clicks but not CPU death
        if (now - this.lastLightTime > 30) {
            const id = this.collisionLight.play();
            // High variance in pitch for texture
            this.collisionLight.rate(0.9 + Math.random() * 0.8, id); 
            // Stereo spread random for immersion
            this.collisionLight.stereo(Math.random() * 2 - 1, id);
            this.lastLightTime = now;
        }

        // Layer 2: Heavy Impact (Intensity based)
        // If density is high (> 3 collisions in this frame), add bass layer
        if (events.collisions > 3 && now - this.lastHeavyTime > 100) {
             const id = this.collisionHeavy.play();
             this.collisionHeavy.rate(0.8 + Math.random() * 0.4, id);
             this.collisionHeavy.stereo(Math.random() * 1.5 - 0.75, id);
             this.lastHeavyTime = now;
        }
    }

    // --- CAPTURES ---
    if (events.captures > 0 && now - this.lastCaptureTime > 150) {
        const id = this.capture.play();
        // Pitch up for positive feedback
        this.capture.rate(1.0 + Math.random() * 0.3, id); 
        this.lastCaptureTime = now;
    }

    // --- ESCAPES ---
    if (events.escapes > 0 && now - this.lastEscapeTime > 200) {
        const id = this.escape.play();
        this.escape.rate(0.8 + Math.random() * 0.4, id);
        this.lastEscapeTime = now;
    }
  }

  toggle(on: boolean) {
    this.enabled = on;
    Howler.mute(!on);
  }
}

export const soundManager = new SoundService();
