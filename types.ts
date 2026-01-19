export type PlayerId = 'player1' | 'player2';

export interface ParticleConfig {
  count: number;
  color: string;
}

export interface ColonyDNA {
  name: string;
  internalMatrix: number[][];
  externalMatrix: number[][];
  colorPalette: string[];
}

export interface ArenaConfig {
  friction: number;
  forceMultiplier: number;
  interactionRadius: number;
  particleCount: number; 
  environmentName: string;
}

export interface PlayerProfile {
    id: string; // 'player1' or 'ai-xyz'
    dna: ColonyDNA;
    score: number;
    matchesPlayed: number;
    wins: number;
}

export interface GameState {
  player1: ColonyDNA;
  player2: ColonyDNA; // This might be an AI
  activeScene: 'menu' | 'training' | 'arena' | 'evolution' | 'leaderboard';
  trainingPlayer: PlayerId;
  isAutoMode: boolean; 
  leaderboardData?: {
      lastMatch: MatchResult;
      player1Profile: PlayerProfile; // Current user
      player2Profile: PlayerProfile; // The opponent (AI or P2)
  };
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
  environmentName?: string;
  scoreP1: number; // New
  scoreP2: number; // New
}