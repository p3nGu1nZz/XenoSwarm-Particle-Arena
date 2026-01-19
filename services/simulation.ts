import { ColonyDNA, ArenaConfig } from "../types";
import { 
  CANVAS_WIDTH, 
  CANVAS_HEIGHT, 
  MIN_RADIUS,
  DEFAULT_ARENA_CONFIG
} from "../constants";

export const TRAIL_LENGTH = 10;

// Particle structure stored in TypedArrays for performance
// x, y, vx, vy, type, owner(0=none, 1=p1, 2=p2)
// We will use a class to manage the arrays and logic

export class SimulationEngine {
  count: number;
  positions: Float32Array;
  velocities: Float32Array;
  forces: Float32Array; // Store latest forces for visualization
  types: Int8Array; // 0 or 1 (subtype within colony)
  owners: Int8Array; // 1 for P1, 2 for P2
  colors: string[];
  
  // Trail History: [p0_t0_x, p0_t0_y, p0_t1_x, p0_t1_y, ... , p1_t0_x...]
  // Stride = TRAIL_LENGTH * 2
  trailHistory: Float32Array;
  
  // Matrix map: F[owner_type][target_owner_type] -> but that's complex because we have 2 owners * 2 types = 4 global types.
  // Let's map global types: 
  // 0: P1_Type0, 1: P1_Type1
  // 2: P2_Type0, 3: P2_Type1
  forceMatrix: Float32Array; // 4x4 matrix flattened = 16 values
  
  // Simulation Config
  config: ArenaConfig;

  // Arena State
  isArena: boolean = false;
  p1Escaped: number = 0;
  p2Escaped: number = 0;

  // Sound Events
  frameEvents = {
    collisions: 0,
    captures: 0,
    escapes: 0
  };

  constructor(maxParticles: number) {
    this.count = 0;
    this.positions = new Float32Array(maxParticles * 2);
    this.velocities = new Float32Array(maxParticles * 2);
    this.forces = new Float32Array(maxParticles * 2);
    this.types = new Int8Array(maxParticles);
    this.owners = new Int8Array(maxParticles);
    this.trailHistory = new Float32Array(maxParticles * TRAIL_LENGTH * 2);
    this.forceMatrix = new Float32Array(16);
    this.colors = [];
    this.config = { ...DEFAULT_ARENA_CONFIG };
  }

  reset() {
    this.count = 0;
    this.p1Escaped = 0;
    this.p2Escaped = 0;
    this.trailHistory.fill(0);
    this.resetEvents();
  }

  resetEvents() {
    this.frameEvents.collisions = 0;
    this.frameEvents.captures = 0;
    this.frameEvents.escapes = 0;
  }

  // Set config dynamically
  setConfig(cfg: ArenaConfig) {
    this.config = { ...cfg };
  }

  // Initialize P1 and P2 particles
  init(p1: ColonyDNA, p2: ColonyDNA, p1CountPerType: number, p2CountPerType: number) {
    this.reset();
    this.isArena = true;
    
    // Setup Matrix
    // Global Indices:
    // 0: P1-0, 1: P1-1
    // 2: P2-0, 3: P2-1
    
    // Fill Matrix
    // Row 0 (P1-0 acting on others)
    this.setForce(0, 0, p1.internalMatrix[0][0]);
    this.setForce(0, 1, p1.internalMatrix[0][1]);
    this.setForce(0, 2, p1.externalMatrix[0][0]);
    this.setForce(0, 3, p1.externalMatrix[0][1]);

    // Row 1 (P1-1 acting on others)
    this.setForce(1, 0, p1.internalMatrix[1][0]);
    this.setForce(1, 1, p1.internalMatrix[1][1]);
    this.setForce(1, 2, p1.externalMatrix[1][0]);
    this.setForce(1, 3, p1.externalMatrix[1][1]);

    // Row 2 (P2-0 acting on others)
    this.setForce(2, 0, p2.externalMatrix[0][0]);
    this.setForce(2, 1, p2.externalMatrix[0][1]);
    this.setForce(2, 2, p2.internalMatrix[0][0]);
    this.setForce(2, 3, p2.internalMatrix[0][1]);

    // Row 3 (P2-1 acting on others)
    this.setForce(3, 0, p2.externalMatrix[1][0]);
    this.setForce(3, 1, p2.externalMatrix[1][1]);
    this.setForce(3, 2, p2.internalMatrix[1][0]);
    this.setForce(3, 3, p2.internalMatrix[1][1]);

    this.colors = [...p1.colorPalette, ...p2.colorPalette];

    // Spawn Particles
    // Use passed counts or override with config if called from init with config logic outside
    // Actually, in the caller we will pass this.config.particleCount
    
    this.spawnBatch(1, 0, p1CountPerType, 100, CANVAS_WIDTH / 2 - 50);
    this.spawnBatch(1, 1, p1CountPerType, 100, CANVAS_WIDTH / 2 - 50);
    this.spawnBatch(2, 0, p2CountPerType, CANVAS_WIDTH / 2 + 50, CANVAS_WIDTH - 100);
    this.spawnBatch(2, 1, p2CountPerType, CANVAS_WIDTH / 2 + 50, CANVAS_WIDTH - 100);
  }
  
  initTraining(p: ColonyDNA, countPerType: number) {
    this.reset();
    this.isArena = false;

    // Map P1 internal to global 0 and 1
    this.setForce(0, 0, p.internalMatrix[0][0]);
    this.setForce(0, 1, p.internalMatrix[0][1]);
    this.setForce(1, 0, p.internalMatrix[1][0]);
    this.setForce(1, 1, p.internalMatrix[1][1]);
    
    this.colors = [...p.colorPalette, '#333333', '#333333']; // Others are dummy

    this.spawnBatch(1, 0, countPerType, 0, CANVAS_WIDTH);
    this.spawnBatch(1, 1, countPerType, 0, CANVAS_WIDTH);
  }

  private setForce(a: number, b: number, val: number) {
    this.forceMatrix[a * 4 + b] = val;
  }

  private spawnBatch(owner: number, type: number, count: number, xMin: number, xMax: number) {
    for (let i = 0; i < count; i++) {
      const idx = this.count;
      this.positions[idx * 2] = Math.random() * (xMax - xMin) + xMin;
      this.positions[idx * 2 + 1] = Math.random() * (CANVAS_HEIGHT - 200) + 100; // Center vertically more
      this.velocities[idx * 2] = 0;
      this.velocities[idx * 2 + 1] = 0;
      this.types[idx] = type;
      this.owners[idx] = owner;
      
      // Initialize trail with current position
      const stride = TRAIL_LENGTH * 2;
      const base = idx * stride;
      for (let t = 0; t < TRAIL_LENGTH; t++) {
        this.trailHistory[base + t*2] = this.positions[idx*2];
        this.trailHistory[base + t*2 + 1] = this.positions[idx*2+1];
      }

      this.count++;
    }
  }

  // Efficiently remove particle at index i
  private removeParticle(i: number) {
    const last = this.count - 1;
    if (i !== last) {
      // Swap current with last
      this.positions[i*2] = this.positions[last*2];
      this.positions[i*2+1] = this.positions[last*2+1];
      this.velocities[i*2] = this.velocities[last*2];
      this.velocities[i*2+1] = this.velocities[last*2+1];
      this.forces[i*2] = this.forces[last*2];
      this.forces[i*2+1] = this.forces[last*2+1];
      this.types[i] = this.types[last];
      this.owners[i] = this.owners[last];

      // Swap Trail History
      const stride = TRAIL_LENGTH * 2;
      this.trailHistory.copyWithin(i * stride, last * stride, (last + 1) * stride);
    }
    this.count--;
  }

  updateTrails() {
    const stride = TRAIL_LENGTH * 2;
    const count = this.count;
    const history = this.trailHistory;
    const pos = this.positions;

    for (let i = 0; i < count; i++) {
      const base = i * stride;
      // Shift history: move t1..tN to t0..tN-1
      history.copyWithin(base, base + 2, base + stride);
      // Set new head (last position)
      history[base + (TRAIL_LENGTH - 1) * 2] = pos[i * 2];
      history[base + (TRAIL_LENGTH - 1) * 2 + 1] = pos[i * 2 + 1];
    }
  }

  update() {
    this.resetEvents(); // Clear audio events for this frame
    const count = this.count;
    const pos = this.positions;
    const vel = this.velocities;
    const forces = this.forces;
    const owners = this.owners;
    const types = this.types;
    const matrix = this.forceMatrix;
    const isArena = this.isArena;

    // USE DYNAMIC CONFIG
    const { friction, forceMultiplier, interactionRadius } = this.config;
    const maxRadiusSq = interactionRadius * interactionRadius;
    
    const globalTypes = new Int8Array(count);
    for(let i=0; i<count; i++) {
      globalTypes[i] = (owners[i] - 1) * 2 + types[i];
    }

    // Force Calculation
    for (let i = 0; i < count; i++) {
      let fx = 0;
      let fy = 0;
      const typeA = globalTypes[i];

      for (let j = 0; j < count; j++) {
        if (i === j) continue;

        let wdx = pos[j * 2] - pos[i * 2];
        let wdy = pos[j * 2 + 1] - pos[i * 2 + 1];
        
        if (!isArena) {
            if (wdx > CANVAS_WIDTH * 0.5) wdx -= CANVAS_WIDTH;
            if (wdx < -CANVAS_WIDTH * 0.5) wdx += CANVAS_WIDTH;
            if (wdy > CANVAS_HEIGHT * 0.5) wdy -= CANVAS_HEIGHT;
            if (wdy < -CANVAS_HEIGHT * 0.5) wdy += CANVAS_HEIGHT;
        }

        const distSq = wdx*wdx + wdy*wdy;

        if (distSq > 0 && distSq < maxRadiusSq) {
          const dist = Math.sqrt(distSq);
          const typeB = globalTypes[j];
          
          let f = 0;
          
          if (dist < MIN_RADIUS) {
             f = -2.0 * (1.0 - dist/MIN_RADIUS); 
             // Collision detected (approximate)
             this.frameEvents.collisions++;
          } else {
             const forceVal = matrix[typeA * 4 + typeB];
             // Scale force curve by dynamic interaction radius
             f = forceVal * (1.0 - Math.abs(2.0 * dist - interactionRadius - MIN_RADIUS) / (interactionRadius - MIN_RADIUS));
          }

          fx += (wdx / dist) * f;
          fy += (wdy / dist) * f;
        }
      }

      forces[i * 2] = fx * forceMultiplier;
      forces[i * 2 + 1] = fy * forceMultiplier;

      vel[i * 2] += fx * forceMultiplier;
      vel[i * 2 + 1] += fy * forceMultiplier;
    }

    // Integration
    for (let i = 0; i < this.count; i++) {
      
      // Arena-specific dynamic adjustments to prevent stalemates
      if (isArena) {
          // REMOVED: Gravitational pull to center - Walls handle containment now
          
          // Random thermal jitter to prevent crystal-like freezing (Stalemate)
          vel[i * 2] += (Math.random() - 0.5) * 0.3;
          vel[i * 2 + 1] += (Math.random() - 0.5) * 0.3;
      }

      // Friction
      vel[i * 2] *= friction;
      vel[i * 2 + 1] *= friction;

      // Move
      pos[i * 2] += vel[i * 2];
      pos[i * 2 + 1] += vel[i * 2 + 1];

      if (this.isArena) {
          // ARENA MODE: Solid Walls (Bounce)
          let pX = pos[i*2];
          let pY = pos[i*2+1];
          let vX = vel[i*2];
          let vY = vel[i*2+1];
          
          let bounced = false;

          // X Axis Bounce
          if (pX < 0) {
             pX = 0;
             vX *= -1;
             bounced = true;
          } else if (pX > CANVAS_WIDTH) {
             pX = CANVAS_WIDTH;
             vX *= -1;
             bounced = true;
          }

          // Y Axis Bounce
          if (pY < 0) {
             pY = 0;
             vY *= -1;
             bounced = true;
          } else if (pY > CANVAS_HEIGHT) {
             pY = CANVAS_HEIGHT;
             vY *= -1;
             bounced = true;
          }

          if (bounced) {
             pos[i*2] = pX;
             pos[i*2+1] = pY;
             vel[i*2] = vX;
             vel[i*2+1] = vY;
          }
      } else {
          // TRAINING MODE: Wrap
          if (pos[i * 2] < 0) pos[i * 2] += CANVAS_WIDTH;
          if (pos[i * 2] >= CANVAS_WIDTH) pos[i * 2] -= CANVAS_WIDTH;
          if (pos[i * 2 + 1] < 0) pos[i * 2 + 1] += CANVAS_HEIGHT;
          if (pos[i * 2 + 1] >= CANVAS_HEIGHT) pos[i * 2 + 1] -= CANVAS_HEIGHT;
      }
    }
  }

  updateBattleLogic() {
      const count = this.count;
      const pos = this.positions;
      const owners = this.owners;
      const types = this.types;

      for(let i=0; i<count; i++) {
          if (Math.random() > 0.05) continue; 

          const myOwner = owners[i];
          if(myOwner === 0) continue; 

          const enemyOwner = myOwner === 1 ? 2 : 1;
          
          let enemyPressure = 0;
          let friendlySupport = 0;

          for(let j=0; j<count; j++) {
              if (i === j) continue;
              const dx = pos[j * 2] - pos[i * 2];
              const dy = pos[j * 2 + 1] - pos[i * 2 + 1];
              if (Math.abs(dx) > 20 || Math.abs(dy) > 20) continue;
              const d2 = dx*dx + dy*dy;
              if (d2 < 400) { 
                  if (owners[j] === enemyOwner) {
                      enemyPressure += (types[j] === 0 ? 1.5 : 1.0); 
                  } else if (owners[j] === myOwner) {
                      friendlySupport += 1.0;
                  }
              }
          }

          if (enemyPressure > friendlySupport + 2) {
              owners[i] = enemyOwner;
              this.frameEvents.captures++; // Captured!
              this.velocities[i*2] *= -0.5;
              this.velocities[i*2+1] *= -0.5;
          }
      }
  }

  getStats(): {p1: number, p2: number, p1Escaped: number, p2Escaped: number} {
      let p1 = 0;
      let p2 = 0;
      for(let i=0; i<this.count; i++) {
          if (this.owners[i] === 1) p1++;
          if (this.owners[i] === 2) p2++;
      }
      return { 
          p1, 
          p2,
          p1Escaped: this.p1Escaped,
          p2Escaped: this.p2Escaped
      };
  }

  findParticleAt(x: number, y: number, radius: number = 20): number {
    let bestIdx = -1;
    let bestDistSq = radius * radius;
    
    for (let i = 0; i < this.count; i++) {
      const px = this.positions[i*2];
      const py = this.positions[i*2+1];
      const distSq = (px - x)**2 + (py - y)**2;
      
      if (distSq < bestDistSq) {
        bestDistSq = distSq;
        bestIdx = i;
      }
    }
    return bestIdx;
  }

  inspectParticle(i: number) {
    if (i < 0 || i >= this.count) return null;
    
    const interactions = [];
    const pos = this.positions;
    const owners = this.owners;
    const types = this.types;
    const matrix = this.forceMatrix;
    
    // Dynamic config usage for inspection
    const { interactionRadius } = this.config;
    const maxRadiusSq = interactionRadius * interactionRadius;

    const globalTypeA = (owners[i] - 1) * 2 + types[i];
    
    for (let j = 0; j < this.count; j++) {
        if (i === j) continue;

        let wdx = pos[j * 2] - pos[i * 2];
        let wdy = pos[j * 2 + 1] - pos[i * 2 + 1];
        
        if (!this.isArena) {
            if (wdx > CANVAS_WIDTH * 0.5) wdx -= CANVAS_WIDTH;
            if (wdx < -CANVAS_WIDTH * 0.5) wdx += CANVAS_WIDTH;
            if (wdy > CANVAS_HEIGHT * 0.5) wdy -= CANVAS_HEIGHT;
            if (wdy < -CANVAS_HEIGHT * 0.5) wdy += CANVAS_HEIGHT;
        }

        const distSq = wdx*wdx + wdy*wdy;
        if (distSq > 0 && distSq < maxRadiusSq) {
           const dist = Math.sqrt(distSq);
           const globalTypeB = (owners[j] - 1) * 2 + types[j];
           
           let f = 0;
           if (dist < MIN_RADIUS) {
             f = -2.0 * (1.0 - dist/MIN_RADIUS);
           } else {
             const forceVal = matrix[globalTypeA * 4 + globalTypeB];
             f = forceVal * (1.0 - Math.abs(2.0 * dist - interactionRadius - MIN_RADIUS) / (interactionRadius - MIN_RADIUS));
           }
           
           if (Math.abs(f) > 0.01) {
              interactions.push({
                 index: j,
                 x: pos[j*2], 
                 y: pos[j*2+1],
                 dx: wdx, 
                 dy: wdy,
                 force: f,
                 isRepulsion: f < 0
              });
           }
        }
    }
    
    return {
        index: i,
        x: pos[i*2],
        y: pos[i*2+1],
        netFx: this.forces[i*2],
        netFy: this.forces[i*2+1],
        interactions
    };
  }
}