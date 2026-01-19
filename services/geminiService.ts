
import { GoogleGenAI, Type } from "@google/genai";
import { ColonyDNA, ArenaConfig, EvolutionStep } from "../types";

// Enhanced mutation logic considering duration and actions (implied by conversion)
export const calculateMutationRate = (
  outcome: 'WIN' | 'LOSS' | 'DRAW',
  myCount: number,
  enemyCount: number,
  initialColonySize: number, // Total initial particles for this player
  durationSeconds: number
): number => {
  // 1. Calculate Conversion/Aggression Efficiency
  // > 1.0 means we captured enemies. < 1.0 means we lost units.
  const survivalRatio = myCount / initialColonySize;
  const enemySurvivalRatio = enemyCount / initialColonySize;

  if (outcome === 'WIN') {
    // SCENARIO A: BLITZKRIEG (Quick Win < 20s)
    if (durationSeconds < 20) return 0.05; // Perfect, don't change much

    // SCENARIO B: DOMINATION (High Conversion)
    if (survivalRatio > 1.2) return 0.10;

    // SCENARIO C: PYRRHIC VICTORY (Won but decimated)
    if (survivalRatio < 0.3) return 0.30; // Needs better defense

    return 0.15; // Standard Win
  } 
  
  if (outcome === 'LOSS') {
    // SCENARIO E: INSTANT WIPEOUT (< 15s)
    if (durationSeconds < 15) return 0.90; // Panic

    // SCENARIO F: CLOSE LOSS (Enemy also low)
    if (enemySurvivalRatio < 0.3) return 0.40; // Slight tweak needed

    // SCENARIO G: CRUSHED
    if (enemySurvivalRatio > 1.5) return 0.70; // Major overhaul

    return 0.55;
  }

  // DRAW
  return 0.65; // Stalemates are bad, force change
};

// AI Agent Logic for Auto-Evolution with MEMORY
export const evolveColonyDNA = async (
  currentDNA: ColonyDNA,
  matchOutcome: 'WIN' | 'LOSS' | 'DRAW',
  myCount: number,
  enemyCount: number,
  enemyDNA: ColonyDNA, 
  nextArenaConfig: ArenaConfig,
  mutationIntensity: number = 0.3,
  history: EvolutionStep[] = []
): Promise<ColonyDNA> => {
  if (!process.env.API_KEY) return currentDNA;

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  // 1. Construct History String for Context
  const recentHistory = history.slice(-5).map((step, i) => 
      `Match -${history.length - i}: ${step.outcome} vs ${step.opponentName}. Strategy: "${step.strategyUsed}". Survivors: ${step.survivors}.`
  ).join("\n");

  const systemInstruction = `
    You are an advanced Genetic Algorithm (AI) optimizing a particle swarm colony.
    Your goal: Evolve the DNA to create an unbeatable organism.
    
    You have a MEMORY of past matches. Analyze the 'Recent History'.
    - If a strategy consistently leads to LOSS, abandon it.
    - If a strategy leads to WIN, refine it (lower mutation).
    - If DRAW, increase aggression drastically.

    PHYSICS:
    - External > 0: Aggression/Chase.
    - External < 0: Fear/Run.
    - Internal > 0: Clumping/Cohesion.
    - Internal < 0: Spreading/Explosion.

    RESPONSE FORMAT:
    - Provide new matrices.
    - Provide a short 'strategyDescription' (max 10 words) explaining your new evolutionary direction (e.g., "Increased cohesion to counter swarming").
    - Update 'name' to verify evolution (e.g. "Cyan Apex V3").
  `;

  let tacticalAdvice = "";
  if (matchOutcome === 'DRAW') {
      tacticalAdvice = "STALEMATE DETECTED. The previous design was too passive. You MUST increase aggression (Positive External Matrix).";
  } else if (matchOutcome === 'LOSS') {
      tacticalAdvice = "DEFEAT DETECTED. Analyze the enemy. If they swarmed you, increase Repulsion. If they kited you, increase Speed/Attraction.";
  } else {
      tacticalAdvice = "VICTORY. Refine the current strategy. Do not deviate significantly.";
  }

  const prompt = `
    CURRENT STATUS:
    Last Result: ${matchOutcome} (My Survivors: ${myCount} vs Enemy: ${enemyCount})
    Tactical Directive: ${tacticalAdvice}
    
    EVOLUTIONARY MEMORY (Learn from this):
    ${recentHistory || "No previous history. This is the first generation."}

    UPCOMING ENVIRONMENT:
    ${nextArenaConfig.environmentName} (Friction: ${nextArenaConfig.friction}, Density: ${nextArenaConfig.particleCount})
    
    MY CURRENT DNA:
    Strategy: "${currentDNA.strategyDescription}"
    Internal: ${JSON.stringify(currentDNA.internalMatrix)}
    External: ${JSON.stringify(currentDNA.externalMatrix)}
    
    ENEMY INTEL (Counter this):
    Name: ${enemyDNA.name}
    Strategy: "${enemyDNA.strategyDescription || 'Unknown'}"
    Internal: ${JSON.stringify(enemyDNA.internalMatrix)}
    External: ${JSON.stringify(enemyDNA.externalMatrix)}
    
    Mutation Intensity: ${mutationIntensity}
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING },
            strategyDescription: { type: Type.STRING },
            internalMatrix: {
              type: Type.ARRAY,
              items: { type: Type.ARRAY, items: { type: Type.NUMBER } },
            },
            externalMatrix: {
              type: Type.ARRAY,
              items: { type: Type.ARRAY, items: { type: Type.NUMBER } },
            },
          },
          required: ["name", "strategyDescription", "internalMatrix", "externalMatrix"],
        },
      },
    });

    const text = response.text;
    if (!text) return currentDNA;
    const data = JSON.parse(text);

    return {
      ...currentDNA,
      name: data.name,
      strategyDescription: data.strategyDescription,
      internalMatrix: data.internalMatrix,
      externalMatrix: data.externalMatrix,
      colorPalette: currentDNA.colorPalette // Keep colors consistent for identity
    };
  } catch (e) {
    console.error("Evolution failed", e);
    return currentDNA;
  }
};
