import { ColonyDNA, ArenaConfig } from "./types";

export const CANVAS_WIDTH = 1200;
export const CANVAS_HEIGHT = 800;

export const MIN_RADIUS = 10; // Min interaction radius (collision like) - kept constant for collision logic consistency

// Default Simulation Constants (Fallback)
export const DEFAULT_ARENA_CONFIG: ArenaConfig = {
  friction: 0.80,
  forceMultiplier: 1.0,
  interactionRadius: 80,
  particleCount: 150,
  environmentName: "Standard Vacuum"
};

export const PARTICLE_COUNT_PER_TYPE_TRAINING = 200;

// Player 1 Defaults (Cyan/Blue Theme)
// UPDATED: Now includes positive external values to encourage chasing/attacking from the start
export const P1_DEFAULT_DNA: ColonyDNA = {
  name: "Cyan Swarm",
  colorPalette: ["#00ffff", "#0088ff"], // Type A, Type B
  internalMatrix: [
    [0.5, -0.2], // A likes A, A dislikes B
    [0.1, 1.0]   // B likes A, B loves B
  ],
  externalMatrix: [
    [0.6, -0.5], // A CHASES Enemy A, A hates Enemy B
    [0.3, -0.8]  // B slightly chases Enemy A, B avoids Enemy B
  ]
};

// Player 2 Defaults (Orange/Red Theme)
// UPDATED: Aggressive 'Berserker' default config
export const P2_DEFAULT_DNA: ColonyDNA = {
  name: "Crimson Legion",
  colorPalette: ["#ff4400", "#ffaa00"],
  internalMatrix: [
    [0.8, 0.1], 
    [-0.1, 0.5]
  ],
  externalMatrix: [
    [0.8, 0.2], // A Hunts Enemy A, A slightly hunts Enemy B
    [-0.5, -1.0] // B runs away (support unit)
  ]
};