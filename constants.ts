
import { ColonyDNA, ArenaConfig, PlayerProfile } from "./types";

export const CANVAS_WIDTH = 1200;
export const CANVAS_HEIGHT = 800;

export const MIN_RADIUS = 10; 

// Default Simulation Constants
export const DEFAULT_ARENA_CONFIG: ArenaConfig = {
  friction: 0.80,
  forceMultiplier: 1.0,
  interactionRadius: 80,
  particleCount: 300, // Increased for larger scale battles
  environmentName: "Standard Vacuum"
};

export const PARTICLE_COUNT_PER_TYPE_TRAINING = 300; // Increased

export const P1_DEFAULT_DNA: ColonyDNA = {
  name: "Cyan Swarm",
  strategyDescription: "Balanced standard configuration",
  colorPalette: ["#00ffff", "#0088ff"], 
  internalMatrix: [[0.5, -0.2], [0.1, 1.0]],
  externalMatrix: [[0.6, -0.5], [0.3, -0.8]]
};

export const P2_DEFAULT_DNA: ColonyDNA = {
  name: "Crimson Legion",
  strategyDescription: "Aggressive close-range combat",
  colorPalette: ["#ff4400", "#ffaa00"],
  internalMatrix: [[0.8, 0.1], [-0.1, 0.5]],
  externalMatrix: [[0.8, 0.2], [-0.5, -1.0]]
};

// --- AI OPPONENT GENERATION ---

const AI_PREFIXES = ["Neo", "Cyber", "Void", "Quantum", "Mech", "Bio", "Nano", "Flux", "Zero", "Dark", "Solar", "Lunar", "Hyper", "Techno", "Iron", "Steel", "Plasma", "Aero", "Terra", "Exo"];
const AI_SUFFIXES = ["Swarm", "Core", "Mind", "Grid", "Unit", "Legion", "Horde", "System", "Virus", "Nexus", "Wraith", "Titan", "Phantom", "Spark", "Storm", "Viper", "Matrix", "Reaper", "Ghost", "Pulse"];
const AI_COLORS = [
    ["#a855f7", "#d8b4fe"], // Purple
    ["#22c55e", "#86efac"], // Green
    ["#eab308", "#fde047"], // Yellow
    ["#ef4444", "#fca5a5"], // Red
    ["#3b82f6", "#93c5fd"], // Blue
    ["#f97316", "#fdba74"], // Orange
    ["#ec4899", "#fbcfe8"], // Pink
    ["#14b8a6", "#5eead4"], // Teal
];

const randomInRange = (min: number, max: number) => Math.random() * (max - min) + min;

export const generateAIPool = (count: number = 20): PlayerProfile[] => {
    const pool: PlayerProfile[] = [];
    
    // Create distinct AI personalities
    for(let i=0; i<count; i++) {
        const prefix = AI_PREFIXES[i % AI_PREFIXES.length];
        const suffix = AI_SUFFIXES[(i * 3) % AI_SUFFIXES.length]; // Scramble slightly
        const name = `${prefix} ${suffix} v${Math.floor(Math.random()*9)}.${Math.floor(Math.random()*9)}`;
        const colors = AI_COLORS[i % AI_COLORS.length];
        
        // Randomly assign a "Strategy" via matrix values
        const isAggressive = Math.random() > 0.5;
        const isClumper = Math.random() > 0.5;

        pool.push({
            id: `ai-${i}-${Date.now()}`,
            dna: {
                name,
                strategyDescription: isAggressive ? "Initial Aggressive Protocol" : "Initial Defensive Cluster",
                colorPalette: colors,
                internalMatrix: [
                    [isClumper ? randomInRange(0.5, 1.0) : randomInRange(-0.2, 0.5), randomInRange(-0.5, 0.5)],
                    [randomInRange(-0.5, 0.5), isClumper ? randomInRange(0.5, 1.0) : randomInRange(-0.2, 0.5)]
                ],
                externalMatrix: [
                    [isAggressive ? randomInRange(0.5, 1.0) : randomInRange(-1.0, 0.5), randomInRange(-1.0, 1.0)],
                    [randomInRange(-1.0, 1.0), isAggressive ? randomInRange(0.5, 1.0) : randomInRange(-1.0, 0.5)]
                ]
            },
            score: Math.floor(randomInRange(1000, 10000)), // Fake starting score
            matchesPlayed: Math.floor(randomInRange(5, 50)),
            wins: Math.floor(randomInRange(0, 30)),
            evolutionHistory: []
        });
    }
    
    // Sort initially by score
    return pool.sort((a,b) => b.score - a.score);
};
