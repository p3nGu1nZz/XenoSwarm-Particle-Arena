import { GoogleGenAI, Type } from "@google/genai";
import { ColonyDNA, ArenaConfig } from "../types";

// Helper to determine mutation intensity based on detailed match performance
export const calculateMutationRate = (
  outcome: 'WIN' | 'LOSS' | 'DRAW',
  myCount: number,
  enemyCount: number,
  initialTotalParticles: number
): number => {
  const myRatio = myCount / initialTotalParticles;
  const enemyRatio = enemyCount / initialTotalParticles;

  if (outcome === 'WIN') {
    // DOMINANT VICTORY (>75% survival, Enemy <10%)
    // Strategy is near perfect. Minimal mutation to avoid regression.
    if (myRatio > 0.75 && enemyRatio < 0.1) return 0.05;
    
    // SOLID VICTORY
    // Good performance, standard optimization.
    if (myRatio > 0.4) return 0.15;
    
    // PYRRHIC VICTORY (Won but <20% survived)
    // We won, but the colony is too fragile. Needs defensive buffs.
    return 0.25; 
  }
  
  if (outcome === 'DRAW') {
     // HIGH DENSITY STALEMATE (Both > 50%)
     // The colonies are likely just clumping or looping safely. 
     // Needs a "Breaker" mutation to initiate combat.
     if (myRatio > 0.5 && enemyRatio > 0.5) return 0.40;
     
     // MUTUAL DESTRUCTION (Both < 20%)
     // Both colonies are too aggressive or environment is too harsh.
     // Needs efficiency/survival mutation.
     if (myRatio < 0.2 && enemyRatio < 0.2) return 0.30;
     
     // Standard Draw
     return 0.35; 
  }
  
  // LOSS
  // EXTINCTION (0 survivors)
  // Current DNA is non-viable. Drastic mutation required.
  if (myCount === 0) return 0.95; 
  
  // CRUSHING DEFEAT (Enemy has > 3x advantage)
  // Strategy is fundamentally flawed against this opponent.
  if (enemyCount > myCount * 3) return 0.75;
  
  // CLEAR DEFEAT
  // Significant changes needed.
  if (enemyCount > myCount * 1.5) return 0.55;
  
  // CLOSE LOSS / NARROW DEFEAT
  // Just need better tuning.
  return 0.45;
};

export const generateColonyDNA = async (
  promptText: string,
  currentDNA: ColonyDNA
): Promise<Partial<ColonyDNA>> => {
  if (!process.env.API_KEY) {
    console.error("API Key missing");
    return {};
  }

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  const systemInstruction = `
    You are a biological engineer for a particle life simulation.
    Your job is to configure the 'DNA' (attraction/repulsion forces) of a particle colony based on a description.
    There are 2 types of particles in a colony: Type 0 (Soldier/Core) and Type 1 (Worker/Support).
    
    You need to output two matrices:
    1. internalMatrix (2x2): How the colony interacts with itself.
       [[Force 0->0, Force 0->1], [Force 1->0, Force 1->1]]
    2. externalMatrix (2x2): How the colony interacts with an ENEMY colony.
       [[Force 0->Enemy0, Force 0->Enemy1], [Force 1->Enemy0, Force 1->Enemy1]]
    
    Values range from -1.0 (Strong Repulsion) to 1.0 (Strong Attraction).
    0.0 is neutral.
    
    Be creative. Aggressive colonies should have high negative values towards enemies.
    Clumping colonies should have high positive internal values.
    Swarming/chasing behavior comes from asymmetry (A likes B, B dislikes A).
  `;

  // Provide current state context
  const context = `
    Current DNA State:
    Internal: ${JSON.stringify(currentDNA.internalMatrix)}
    External: ${JSON.stringify(currentDNA.externalMatrix)}
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Context: ${context}\n\nUser Request: "${promptText}"\n\nBased on the request, generate the new matrices. If the request implies modifying the current state (e.g. "more aggressive"), adjust the values accordingly. If it describes a new behavior, generate from scratch.`,
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            internalMatrix: {
              type: Type.ARRAY,
              items: {
                type: Type.ARRAY,
                items: { type: Type.NUMBER },
              },
            },
            externalMatrix: {
              type: Type.ARRAY,
              items: {
                type: Type.ARRAY,
                items: { type: Type.NUMBER },
              },
            },
          },
          required: ["internalMatrix", "externalMatrix"],
        },
      },
    });

    const text = response.text;
    if (!text) return {};

    const data = JSON.parse(text);
    return {
      internalMatrix: data.internalMatrix,
      externalMatrix: data.externalMatrix,
    };
  } catch (error) {
    console.error("Failed to generate DNA:", error);
    return {};
  }
};

// AI Agent Logic for Auto-Evolution
export const evolveColonyDNA = async (
  currentDNA: ColonyDNA,
  matchOutcome: 'WIN' | 'LOSS' | 'DRAW',
  myCount: number,
  enemyCount: number,
  enemyDNA: ColonyDNA, // The AI gets to "see" the opponent's DNA to counter-strat
  nextArenaConfig?: ArenaConfig, // Optional for backward compatibility, but we will use it
  mutationIntensity: number = 0.3 // Default moderate mutation
): Promise<ColonyDNA> => {
  if (!process.env.API_KEY) return currentDNA;

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  const systemInstruction = `
    You are an autonomous evolutionary algorithm controlling a particle swarm colony in a battle simulation.
    Your goal is to mutate the colony's force matrices to MAXIMIZE winning chances in the next round.
    
    MUTATION PARAMETERS:
    - Mutation Intensity: ${mutationIntensity.toFixed(2)} (Range: 0.0 - 1.0)
    
    Evolution Guidance based on Intensity:
    - Low (0.0 - 0.2): CONSERVATIVE. Only tweak values by small amounts (+/- 0.1). Do not change the core behavior (e.g. if it clumps, keep it clumping).
    - Medium (0.3 - 0.6): ADAPTIVE. Adjust strategy to counter specific threats. You can change attraction to repulsion if necessary.
    - High (0.7 - 1.0): DRASTIC. The previous strategy failed. Try something completely new. Invert matrices or try extreme values.
    
    Analysis Strategy:
    - If you LOST: Analyze the opponent's DNA. Did they swarm you? Did they repel you? Adjust your external forces to counter them (e.g., run away or chase harder).
    - If you WON: Refine the current strategy. Don't change too much, just optimize.
    - If DRAW: You need to be more aggressive to force a win.
    
    CRITICAL: The next match will have specific Environmental Conditions (Friction, Gravity, Density).
    You MUST adapt your DNA to survive in this environment. 
    - High Friction: requires stronger propulsion (higher force values) to move.
    - Low Friction: requires dampening or weaker forces to avoid loss of control.
    - High Gravity/Force Multiplier: interactions are dangerous, be careful with repulsion.
    - High Density: Collisions are frequent, maybe become more defensive or explosive.
    
    Return the FULL JSON object with the updated 'internalMatrix' and 'externalMatrix'.
    Also update the 'name' of the colony to reflect its evolution (e.g., "Cyan Swarm Mk II", "Heavy-Grav Adaptation").
  `;

  let envInfo = "Standard Vacuum";
  if (nextArenaConfig) {
    envInfo = `
      ENVIRONMENT WARNING: ${nextArenaConfig.environmentName}
      - Friction: ${nextArenaConfig.friction} (Normal is ~0.8)
      - Force Strength: ${nextArenaConfig.forceMultiplier}x
      - Particle Density: ${nextArenaConfig.particleCount} per type
      - Interaction Radius: ${nextArenaConfig.interactionRadius}px
    `;
  }

  const prompt = `
    Last Match Report:
    Outcome: ${matchOutcome}
    My Particles Remaining: ${myCount}
    Enemy Particles Remaining: ${enemyCount}
    
    UPCOMING BATTLE CONDITIONS:
    ${envInfo}
    
    My Current DNA:
    Internal: ${JSON.stringify(currentDNA.internalMatrix)}
    External: ${JSON.stringify(currentDNA.externalMatrix)}
    
    Enemy DNA (The threat):
    Internal: ${JSON.stringify(enemyDNA.internalMatrix)}
    External: ${JSON.stringify(enemyDNA.externalMatrix)}
    
    Task: Evolve my DNA to beat this enemy in the UPCOMING environment. Apply a mutation intensity of ${mutationIntensity}.
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
            internalMatrix: {
              type: Type.ARRAY,
              items: { type: Type.ARRAY, items: { type: Type.NUMBER } },
            },
            externalMatrix: {
              type: Type.ARRAY,
              items: { type: Type.ARRAY, items: { type: Type.NUMBER } },
            },
          },
          required: ["name", "internalMatrix", "externalMatrix"],
        },
      },
    });

    const text = response.text;
    if (!text) return currentDNA;
    const data = JSON.parse(text);

    return {
      ...currentDNA,
      name: data.name,
      internalMatrix: data.internalMatrix,
      externalMatrix: data.externalMatrix
    };
  } catch (e) {
    console.error("Evolution failed", e);
    return currentDNA;
  }
};