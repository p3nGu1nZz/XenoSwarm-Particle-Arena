import { ColonyDNA, ArenaConfig } from "../types";
import { 
  CANVAS_WIDTH, 
  CANVAS_HEIGHT, 
  MIN_RADIUS,
  DEFAULT_ARENA_CONFIG
} from "../constants";

export const TRAIL_LENGTH = 10;

// Spatial Partitioning Constants
const GRID_SIZE = 40; // Size of grid cells (should be >= max interaction radius)
const GRID_COLS = Math.ceil(CANVAS_WIDTH / GRID_SIZE);
const GRID_ROWS = Math.ceil(CANVAS_HEIGHT / GRID_SIZE);

// Visual only effect particle
export interface EffectParticle {
    x: number;
    y: number;
    vx: number;
    vy: number;
    life: number; // 0.0 to 1.0
    color: string;
    size: number;
}

export class SimulationEngine {
  count: number;
  positions: Float32Array;
  velocities: Float32Array;
  forces: Float32Array; 
  types: Int8Array; 
  owners: Int8Array; 
  colors: string[];
  
  trailHistory: Float32Array;
  forceMatrix: Float32Array; 
  baseForceMatrix: Float32Array; 
  
  config: ArenaConfig;

  isArena: boolean = false;
  p1Escaped: number = 0;
  p2Escaped: number = 0;
  time: number = 0;

  effects: EffectParticle[] = [];

  frameEvents = {
    collisions: 0,
    captures: 0,
    escapes: 0
  };

  // Spatial Grid: Stores indices of particles in each cell
  // We use a flat array of arrays for simplicity in JS
  grid: number[][]; 

  constructor(maxParticles: number) {
    this.count = 0;
    this.positions = new Float32Array(maxParticles * 2);
    this.velocities = new Float32Array(maxParticles * 2);
    this.forces = new Float32Array(maxParticles * 2);
    this.types = new Int8Array(maxParticles);
    this.owners = new Int8Array(maxParticles);
    this.trailHistory = new Float32Array(maxParticles * TRAIL_LENGTH * 2);
    this.forceMatrix = new Float32Array(16);
    this.baseForceMatrix = new Float32Array(16);
    this.colors = [];
    this.config = { ...DEFAULT_ARENA_CONFIG };
    this.time = 0;
    
    // Init Grid
    this.grid = new Array(GRID_COLS * GRID_ROWS).fill([]).map(() => []);
  }

  reset() {
    this.count = 0;
    this.p1Escaped = 0;
    this.p2Escaped = 0;
    this.trailHistory.fill(0);
    this.time = 0;
    this.effects = [];
    this.resetEvents();
  }

  resetEvents() {
    this.frameEvents.collisions = 0;
    this.frameEvents.captures = 0;
    this.frameEvents.escapes = 0;
  }

  setConfig(cfg: ArenaConfig) {
    this.config = { ...cfg };
  }

  init(p1: ColonyDNA, p2: ColonyDNA, p1CountPerType: number, p2CountPerType: number) {
    this.reset();
    this.isArena = true;
    
    // Matrix Mapping
    this.setForce(0, 0, p1.internalMatrix[0][0]);
    this.setForce(0, 1, p1.internalMatrix[0][1]);
    this.setForce(0, 2, p1.externalMatrix[0][0]);
    this.setForce(0, 3, p1.externalMatrix[0][1]);

    this.setForce(1, 0, p1.internalMatrix[1][0]);
    this.setForce(1, 1, p1.internalMatrix[1][1]);
    this.setForce(1, 2, p1.externalMatrix[1][0]);
    this.setForce(1, 3, p1.externalMatrix[1][1]);

    this.setForce(2, 0, p2.externalMatrix[0][0]);
    this.setForce(2, 1, p2.externalMatrix[0][1]);
    this.setForce(2, 2, p2.internalMatrix[0][0]);
    this.setForce(2, 3, p2.internalMatrix[0][1]);

    this.setForce(3, 0, p2.externalMatrix[1][0]);
    this.setForce(3, 1, p2.externalMatrix[1][1]);
    this.setForce(3, 2, p2.internalMatrix[1][0]);
    this.setForce(3, 3, p2.internalMatrix[1][1]);
    
    this.baseForceMatrix.set(this.forceMatrix);

    this.colors = [...p1.colorPalette, ...p2.colorPalette];

    // Spawn Particles
    this.spawnBatch(1, 0, p1CountPerType, 50, CANVAS_WIDTH / 2 - 50);
    this.spawnBatch(1, 1, p1CountPerType, 50, CANVAS_WIDTH / 2 - 50);
    this.spawnBatch(2, 0, p2CountPerType, CANVAS_WIDTH / 2 + 50, CANVAS_WIDTH - 50);
    this.spawnBatch(2, 1, p2CountPerType, CANVAS_WIDTH / 2 + 50, CANVAS_WIDTH - 50);
  }
  
  initTraining(p: ColonyDNA, countPerType: number) {
    this.reset();
    this.isArena = false;

    this.setForce(0, 0, p.internalMatrix[0][0]);
    this.setForce(0, 1, p.internalMatrix[0][1]);
    this.setForce(1, 0, p.internalMatrix[1][0]);
    this.setForce(1, 1, p.internalMatrix[1][1]);
    
    this.baseForceMatrix.set(this.forceMatrix);

    this.colors = [...p.colorPalette, '#333333', '#333333']; 

    this.spawnBatch(1, 0, countPerType, 0, CANVAS_WIDTH);
    this.spawnBatch(1, 1, countPerType, 0, CANVAS_WIDTH);
  }

  private setForce(a: number, b: number, val: number) {
    this.forceMatrix[a * 4 + b] = val;
  }

  setTactics(p1Retreat: boolean, p2Retreat: boolean, p1Aggressive: boolean, p2Aggressive: boolean) {
     this.forceMatrix.set(this.baseForceMatrix);

     const RETREAT_FORCE = -0.9;
     const AGGRESSIVE_BOOST = 1.5;

     const p1Indices = [2, 3, 6, 7]; 
     for(const idx of p1Indices) {
         if (p1Retreat && this.baseForceMatrix[idx] > -0.2) {
             this.forceMatrix[idx] = RETREAT_FORCE;
         } else if (p1Aggressive && this.baseForceMatrix[idx] > 0) {
             this.forceMatrix[idx] = Math.min(1.0, this.baseForceMatrix[idx] * AGGRESSIVE_BOOST);
         } else if (p1Aggressive && this.baseForceMatrix[idx] <= 0) {
             this.forceMatrix[idx] = 0.5;
         }
     }

     const p2Indices = [8, 9, 12, 13];
     for(const idx of p2Indices) {
         if (p2Retreat && this.baseForceMatrix[idx] > -0.2) {
             this.forceMatrix[idx] = RETREAT_FORCE;
         } else if (p2Aggressive && this.baseForceMatrix[idx] > 0) {
             this.forceMatrix[idx] = Math.min(1.0, this.baseForceMatrix[idx] * AGGRESSIVE_BOOST);
         } else if (p2Aggressive && this.baseForceMatrix[idx] <= 0) {
             this.forceMatrix[idx] = 0.5;
         }
     }
  }

  private spawnBatch(owner: number, type: number, count: number, xMin: number, xMax: number) {
    for (let i = 0; i < count; i++) {
      const idx = this.count;
      this.positions[idx * 2] = Math.random() * (xMax - xMin) + xMin;
      this.positions[idx * 2 + 1] = Math.random() * (CANVAS_HEIGHT - 200) + 100;
      this.velocities[idx * 2] = 0;
      this.velocities[idx * 2 + 1] = 0;
      this.types[idx] = type;
      this.owners[idx] = owner;
      
      const stride = TRAIL_LENGTH * 2;
      const base = idx * stride;
      for (let t = 0; t < TRAIL_LENGTH; t++) {
        this.trailHistory[base + t*2] = this.positions[idx*2];
        this.trailHistory[base + t*2 + 1] = this.positions[idx*2+1];
      }

      this.count++;
    }
  }

  spawnExplosion(x: number, y: number, color: string) {
      const particleCount = 12; // Increased from 6
      for(let i=0; i<particleCount; i++) {
          const angle = Math.random() * Math.PI * 2;
          const speed = Math.random() * 6 + 2; // Faster initial burst
          this.effects.push({
              x: x,
              y: y,
              vx: Math.cos(angle) * speed,
              vy: Math.sin(angle) * speed,
              life: 1.0,
              color: color,
              size: Math.random() * 2 + 1
          });
      }
  }

  updateTrails() {
    const stride = TRAIL_LENGTH * 2;
    const count = this.count;
    const history = this.trailHistory;
    const pos = this.positions;

    for (let i = 0; i < count; i++) {
      const base = i * stride;
      history.copyWithin(base, base + 2, base + stride);
      history[base + (TRAIL_LENGTH - 1) * 2] = pos[i * 2];
      history[base + (TRAIL_LENGTH - 1) * 2 + 1] = pos[i * 2 + 1];
    }
  }

  // --- SPATIAL GRID HELPERS ---
  private updateGrid() {
     // 1. Clear Grid
     for(let i=0; i<this.grid.length; i++) {
         this.grid[i].length = 0; 
     }

     // 2. Insert Particles
     for(let i=0; i<this.count; i++) {
         const x = this.positions[i*2];
         const y = this.positions[i*2+1];
         
         // Clamp to boundaries
         if (x < 0 || x >= CANVAS_WIDTH || y < 0 || y >= CANVAS_HEIGHT) continue;

         const cx = Math.floor(x / GRID_SIZE);
         const cy = Math.floor(y / GRID_SIZE);
         const cellIdx = cy * GRID_COLS + cx;
         
         if (this.grid[cellIdx]) {
             this.grid[cellIdx].push(i);
         }
     }
  }

  update() {
    this.resetEvents(); 
    this.time += 0.005;

    const count = this.count;
    const pos = this.positions;
    const vel = this.velocities;
    const forces = this.forces;
    const owners = this.owners;
    const types = this.types;
    const matrix = this.forceMatrix;
    const isArena = this.isArena;
    const { friction, forceMultiplier, interactionRadius } = this.config;
    const maxRadiusSq = interactionRadius * interactionRadius;
    
    // 0. Update Spatial Grid
    this.updateGrid();

    // 1. Precalculate global types
    const globalTypes = new Int8Array(count);
    for(let i=0; i<count; i++) {
      globalTypes[i] = (owners[i] - 1) * 2 + types[i];
    }

    // 2. Force Calculation with Spatial Partitioning
    for (let i = 0; i < count; i++) {
      let fx = 0;
      let fy = 0;
      const typeA = globalTypes[i];
      const px = pos[i * 2];
      const py = pos[i * 2 + 1];

      // Identify current cell
      const cx = Math.floor(px / GRID_SIZE);
      const cy = Math.floor(py / GRID_SIZE);

      // Check 3x3 neighbor cells
      for(let dy = -1; dy <= 1; dy++) {
          for(let dx = -1; dx <= 1; dx++) {
              const ncx = cx + dx;
              const ncy = cy + dy;

              // Bounds check
              if (ncx >= 0 && ncx < GRID_COLS && ncy >= 0 && ncy < GRID_ROWS) {
                  const cellIdx = ncy * GRID_COLS + ncx;
                  const cellParticles = this.grid[cellIdx];
                  
                  // Iterate over neighbors in this cell
                  const cLen = cellParticles.length;
                  for(let k=0; k<cLen; k++) {
                      const j = cellParticles[k];
                      if (i === j) continue;

                      let wdx = pos[j * 2] - px;
                      let wdy = pos[j * 2 + 1] - py;
                      
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
                           this.frameEvents.collisions++;
                        } else {
                           const forceVal = matrix[typeA * 4 + typeB];
                           f = forceVal * (1.0 - Math.abs(2.0 * dist - interactionRadius - MIN_RADIUS) / (interactionRadius - MIN_RADIUS));
                        }

                        fx += (wdx / dist) * f;
                        fy += (wdy / dist) * f;
                      }
                  }
              }
          }
      }

      forces[i * 2] = fx * forceMultiplier;
      forces[i * 2 + 1] = fy * forceMultiplier;

      vel[i * 2] += fx * forceMultiplier;
      vel[i * 2 + 1] += fy * forceMultiplier;
    }

    // 3. Integration & Arena Logic
    for (let i = 0; i < this.count; i++) {
      if (isArena) {
          const jitter = 0.4 * (1.0 - friction + 0.1);
          vel[i * 2] += (Math.random() - 0.5) * jitter;
          vel[i * 2 + 1] += (Math.random() - 0.5) * jitter;

          const px = pos[i*2];
          const py = pos[i*2+1];
          const scale = 0.005; 
          
          const flowX = Math.sin(py * scale + this.time) + Math.cos(px * scale * 0.5 + this.time * 1.3);
          const flowY = Math.cos(px * scale + this.time) + Math.sin(py * scale * 0.5 + this.time * 1.7);
          
          const flowStrength = 0.035; 
          vel[i * 2] += flowX * flowStrength;
          vel[i * 2 + 1] += flowY * flowStrength;
      }

      vel[i * 2] *= friction;
      vel[i * 2 + 1] *= friction;

      pos[i * 2] += vel[i * 2];
      pos[i * 2 + 1] += vel[i * 2 + 1];

      if (this.isArena) {
          let pX = pos[i*2];
          let pY = pos[i*2+1];
          let vX = vel[i*2];
          let vY = vel[i*2+1];
          let bounced = false;
          let damping = 0;

          if (pX < 0 || pX > CANVAS_WIDTH) {
             pX = (pX < 0) ? 0 : CANVAS_WIDTH;
             if (damping === 0) {
                 const speedSq = vX*vX + vY*vY;
                 damping = Math.min(0.95, 0.6 + (speedSq / 40.0) * 0.35);
             }
             vX *= -damping; 
             bounced = true;
          }

          if (pY < 0 || pY > CANVAS_HEIGHT) {
             pY = (pY < 0) ? 0 : CANVAS_HEIGHT;
             if (damping === 0) {
                 const speedSq = vX*vX + vY*vY;
                 damping = Math.min(0.95, 0.6 + (speedSq / 40.0) * 0.35);
             }
             vY *= -damping; 
             bounced = true;
          }

          if (bounced) {
             pos[i*2] = pX;
             pos[i*2+1] = pY;
             vel[i*2] = vX;
             vel[i*2+1] = vY;
          }
      } else {
          if (pos[i * 2] < 0) pos[i * 2] += CANVAS_WIDTH;
          if (pos[i * 2] >= CANVAS_WIDTH) pos[i * 2] -= CANVAS_WIDTH;
          if (pos[i * 2 + 1] < 0) pos[i * 2 + 1] += CANVAS_HEIGHT;
          if (pos[i * 2 + 1] >= CANVAS_HEIGHT) pos[i * 2 + 1] -= CANVAS_HEIGHT;
      }
    }

    // 4. Update Effects (Sparks)
    for(let i=this.effects.length-1; i>=0; i--) {
        const p = this.effects[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vx *= 0.92; // Drag
        p.vy *= 0.92;
        p.life -= 0.03;
        
        if(p.life <= 0) {
            this.effects.splice(i, 1);
        }
    }
  }

  updateBattleLogic() {
      const count = this.count;
      const pos = this.positions;
      const owners = this.owners;
      const types = this.types;
      const colors = this.colors;

      for(let i=0; i<count; i++) {
          if (Math.random() > 0.05) continue; 

          const myOwner = owners[i];
          if(myOwner === 0) continue; 

          const enemyOwner = myOwner === 1 ? 2 : 1;
          
          let enemyPressure = 0;
          let friendlySupport = 0;

          // Use Spatial Grid for Interaction Checks too
          const px = pos[i * 2];
          const py = pos[i * 2 + 1];
          const cx = Math.floor(px / GRID_SIZE);
          const cy = Math.floor(py / GRID_SIZE);

          for(let dy = -1; dy <= 1; dy++) {
            for(let dx = -1; dx <= 1; dx++) {
                const ncx = cx + dx;
                const ncy = cy + dy;
                if (ncx >= 0 && ncx < GRID_COLS && ncy >= 0 && ncy < GRID_ROWS) {
                    const cellIdx = ncy * GRID_COLS + ncx;
                    const cellParticles = this.grid[cellIdx];
                    
                    for(let k=0; k<cellParticles.length; k++) {
                        const j = cellParticles[k];
                        if (i === j) continue;
                        
                        const wdx = pos[j * 2] - px;
                        const wdy = pos[j * 2 + 1] - py;
                        // Combat radius is small (20px)
                        if (Math.abs(wdx) > 20 || Math.abs(wdy) > 20) continue;
                        
                        const d2 = wdx*wdx + wdy*wdy;
                        if (d2 < 400) { 
                            if (owners[j] === enemyOwner) {
                                enemyPressure += (types[j] === 0 ? 1.5 : 1.0); 
                            } else if (owners[j] === myOwner) {
                                friendlySupport += 1.0;
                            }
                        }
                    }
                }
            }
          }

          if (enemyPressure > friendlySupport + 2) {
              owners[i] = enemyOwner;
              this.frameEvents.captures++; 
              
              // Find color index for new owner
              let colorIdx = 0;
              if (enemyOwner === 1) colorIdx = types[i]; // Keep same type, just swap owner
              else if (enemyOwner === 2) colorIdx = 2 + types[i];
              
              const spawnColor = colors[colorIdx] || '#fff';
              this.spawnExplosion(px, py, spawnColor);

              this.velocities[i*2] *= -0.5;
              this.velocities[i*2+1] *= -0.5;
          }
      }
  }

  getStats(): {
      p1: number, 
      p2: number, 
      p1Escaped: number, 
      p2Escaped: number,
      centroidDist: number,
      avgSpeed: number
  } {
      let p1 = 0;
      let p2 = 0;
      let p1x = 0, p1y = 0;
      let p2x = 0, p2y = 0;
      let totalSpeed = 0;

      for(let i=0; i<this.count; i++) {
          const owner = this.owners[i];
          const vx = this.velocities[i*2];
          const vy = this.velocities[i*2+1];
          totalSpeed += Math.sqrt(vx*vx + vy*vy);

          if (owner === 1) {
              p1++;
              p1x += this.positions[i*2];
              p1y += this.positions[i*2+1];
          }
          if (owner === 2) {
              p2++;
              p2x += this.positions[i*2];
              p2y += this.positions[i*2+1];
          }
      }

      let centroidDist = 0;
      if (p1 > 0 && p2 > 0) {
          const c1x = p1x / p1;
          const c1y = p1y / p1;
          const c2x = p2x / p2;
          const c2y = p2y / p2;
          const dx = c2x - c1x;
          const dy = c2y - c1y;
          centroidDist = Math.sqrt(dx*dx + dy*dy);
      }

      return { 
          p1, 
          p2,
          p1Escaped: this.p1Escaped,
          p2Escaped: this.p2Escaped,
          centroidDist,
          avgSpeed: this.count > 0 ? totalSpeed / this.count : 0
      };
  }

  findParticleAt(x: number, y: number, radius: number = 20): number {
    let bestIdx = -1;
    let bestDistSq = radius * radius;
    
    const cx = Math.floor(x / GRID_SIZE);
    const cy = Math.floor(y / GRID_SIZE);
    
    // Check local neighborhood
    for(let dy = -1; dy <= 1; dy++) {
        for(let dx = -1; dx <= 1; dx++) {
            const ncx = cx + dx;
            const ncy = cy + dy;
            if (ncx >= 0 && ncx < GRID_COLS && ncy >= 0 && ncy < GRID_ROWS) {
                const cellIdx = ncy * GRID_COLS + ncx;
                const cellParticles = this.grid[cellIdx];
                for(let k=0; k<cellParticles.length; k++) {
                    const i = cellParticles[k];
                    const px = this.positions[i*2];
                    const py = this.positions[i*2+1];
                    const distSq = (px - x)**2 + (py - y)**2;
                    if (distSq < bestDistSq) {
                        bestDistSq = distSq;
                        bestIdx = i;
                    }
                }
            }
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
    
    const { interactionRadius } = this.config;
    const maxRadiusSq = interactionRadius * interactionRadius;
    const globalTypeA = (owners[i] - 1) * 2 + types[i];
    
    const px = pos[i*2];
    const py = pos[i*2+1];

    // Grid optimized inspection
    const cx = Math.floor(px / GRID_SIZE);
    const cy = Math.floor(py / GRID_SIZE);

    for(let dy = -1; dy <= 1; dy++) {
        for(let dx = -1; dx <= 1; dx++) {
            const ncx = cx + dx;
            const ncy = cy + dy;
            if (ncx >= 0 && ncx < GRID_COLS && ncy >= 0 && ncy < GRID_ROWS) {
                const cellIdx = ncy * GRID_COLS + ncx;
                const cellParticles = this.grid[cellIdx];
                for(let k=0; k<cellParticles.length; k++) {
                    const j = cellParticles[k];
                    if (i === j) continue;

                    let wdx = pos[j * 2] - px;
                    let wdy = pos[j * 2 + 1] - py;
                    
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
            }
        }
    }
    
    return {
        index: i,
        x: px,
        y: py,
        netFx: this.forces[i*2],
        netFy: this.forces[i*2+1],
        interactions
    };
  }
}