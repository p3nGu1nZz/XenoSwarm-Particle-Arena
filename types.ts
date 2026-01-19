export type PlayerId = 'player1' | 'player2';

export interface ParticleConfig {
  count: number;
  color: string;
}

// The DNA of a colony is essentially the attraction/repulsion matrix
// Flattened or structured. For 2 types per player, we have a 2x2 internal matrix
// and a 2x2 external matrix (how I react to enemy types).
// Let's simplify: Each player has N types. The global matrix is (2N)x(2N).
// But for editing, we store "My Interactions" and "Enemy Interactions".

export interface ColonyDNA {
  name: string;
  // Matrix of forces between own types.
  // if types = [A, B], then internalMatrix is [[F_AA, F_AB], [F_BA, F_BB]]
  internalMatrix: number[][];
  // Matrix of forces reacting to enemy types.
  // if enemy types = [X, Y], then externalMatrix is [[F_AX, F_AY], [F_BX, F_BY]]
  externalMatrix: number[][];
  colorPalette: string[];
}

export interface ArenaConfig {
  friction: number;
  forceMultiplier: number;
  interactionRadius: number;
  particleCount: number; // Per player per type
  environmentName: string;
}

export interface GameState {
  player1: ColonyDNA;
  player2: ColonyDNA;
  activeScene: 'menu' | 'training' | 'arena' | 'evolution';
  trainingPlayer: PlayerId;
  isAutoMode: boolean; // New flag for AI vs AI loop
}

export enum SimulationMode {
  TRAINING = 'TRAINING',
  ARENA = 'ARENA'
}

export interface SimulationStats {
  p1Count: number;
  p2Count: number;
  p1Escaped: number;
  p2Escaped: number;
  fps: number;
}

export interface MatchResult {
  id: number;
  timestamp: number;
  winner: 'p1' | 'p2' | 'draw';
  p1Name: string;
  p2Name: string;
  p1Count: number;
  p2Count: number;
  duration: number;
  environmentName?: string; // Track which environment was used
}