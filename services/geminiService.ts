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
     if (myRatio > 0.5 && enemyRatio > 0.5) return 0.60; // Increased mutation for stalemates
     
     // MUTUAL DESTRUCTION (Both < 20%)
     // Both colonies are too aggressive or environment is too harsh.
     // Needs efficiency/survival mutation.
     if (myRatio < 0.2 && enemyRatio < 0.2) return 0.30;
     
     // Standard Draw
     return 0.45; 
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
    Your job is to configure the 'DNA' (attraction/repulsion forces) of a particle colony.
    
    CRITICAL PHYSICS RULES:
    1. Force Range: -1.0 (Repel/Run Away) to 1.0 (Attract/Chase).
    2. To ATTACK: You MUST set a POSITIVE (+) value in the 'externalMatrix' towards enemy types. 
       - Example: If Type 0 is a Soldier, Type 0 -> Enemy 0 should be 0.8 (Chase).
    3. To DEFEND: Set NEGATIVE (-) values to run away.
    4. If you set all external forces to negative, the colony will just run away and stalemate.
    
    Output two matrices:
    1. internalMatrix (2x2): [[Self0->Self0, Self0->Self1], [Self1->Self0, Self1->Self1]]
    2. externalMatrix (2x2): [[Self0->Enemy0, Self0->Enemy1], [Self1->Enemy0, Self1->Enemy1]]
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
      contents: `Context: ${context}\n\nUser Request: "${promptText}"\n\nBased on the request, generate the new matrices.`,
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
    You are an autonomous evolutionary algorithm controlling a particle swarm colony.
    Your goal is to MAXIMIZE winning chances. STALEMATES ARE FAILURES.
    
    COMBAT MECHANICS:
    - Particles "Capture" enemies by surrounding them.
    - To win, your particles MUST move towards the enemy.
    - **External Matrix Rule**: 
      - Negative Value (-0.1 to -1.0) = FEAR / RUN AWAY.
      - Positive Value (0.1 to 1.0) = AGGRESSION / CHASE.
      - Zero = Neutral / Ignore.
    
    STRATEGY GUIDE:
    1. If the last match was a DRAW: You were too passive. You MUST increase positive attraction in 'externalMatrix' to hunt the enemy.
    2. If you LOST: Analyze if you were overrun (increase defense/repulsion) or outmaneuvered (increase speed/attraction).
    3. Types: Usually Type 0 is the "Core/Soldier" and Type 1 is "Support". Make Type 0 aggressive towards enemies.
    
    Mutation Intensity: ${mutationIntensity.toFixed(2)}
    - High Intensity means you should radically change the strategy (e.g., switch from clumping to swarming).
    
    Return the FULL JSON object with the updated 'internalMatrix' and 'externalMatrix'.
    Update the 'name' to reflect the evolution (e.g., "Cyan Hunter V2").
  `;

  let envInfo = "Standard Vacuum";
  if (nextArenaConfig) {
    envInfo = `
      ENVIRONMENT WARNING: ${nextArenaConfig.environmentName}
      - Friction: ${nextArenaConfig.friction} (Low friction = slippery, hard to stop)
      - Force Strength: ${nextArenaConfig.forceMultiplier}x
      - Particle Density: ${nextArenaConfig.particleCount} per type
    `;
  }

  let tacticalAdvice = "";
  if (matchOutcome === 'DRAW') {
      tacticalAdvice = "URGENT: The previous match was a stalemate. Your colony is too cowardly. You MUST set positive attraction values in the External Matrix to chase and destroy the enemy. Do not hide.";
  } else if (matchOutcome === 'LOSS') {
      tacticalAdvice = "You lost. If the enemy chased you, consider a counter-attack or faster evasion. If you died by clumping, increase internal repulsion.";
  } else {
      tacticalAdvice = "You won. Optimize efficiency. Maintain the aggressive edge.";
  }

  const prompt = `
    Last Match Outcome: ${matchOutcome}
    My Survivors: ${myCount}
    Enemy Survivors: ${enemyCount}
    
    TACTICAL ORDER: ${tacticalAdvice}
    
    UPCOMING ENVIRONMENT:
    ${envInfo}
    
    My Current DNA:
    Internal: ${JSON.stringify(currentDNA.internalMatrix)}
    External: ${JSON.stringify(currentDNA.externalMatrix)}
    
    Enemy DNA (Intel):
    Internal: ${JSON.stringify(enemyDNA.internalMatrix)}
    External: ${JSON.stringify(enemyDNA.externalMatrix)}
    
    Task: Evolve my DNA to destroy this enemy. Apply mutation intensity: ${mutationIntensity}.
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