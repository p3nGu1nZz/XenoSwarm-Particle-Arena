import React, { useRef, useEffect, useState } from 'react';
import { SimulationEngine, TRAIL_LENGTH } from '../services/simulation';
import { CANVAS_WIDTH, CANVAS_HEIGHT, DEFAULT_ARENA_CONFIG } from '../constants';
import { ColonyDNA, ArenaConfig } from '../types';
import { soundManager } from '../services/SoundService';
import { Howler } from 'howler';
import { Eye, EyeOff } from 'lucide-react';

interface Props {
  mode: 'training' | 'arena';
  player1DNA: ColonyDNA;
  player2DNA?: ColonyDNA;
  onStatsUpdate?: (p1: number, p2: number, p1Escaped: number, p2Escaped: number, fps: number, centroidDist: number, avgSpeed: number) => void;
  showVectors?: boolean; 
  showTrails?: boolean;
  selectedParticleIdx?: number | null;
  onSelectParticle?: (idx: number | null) => void;
  arenaConfig?: ArenaConfig;
  paused?: boolean;
  p1Retreat?: boolean;
  p2Retreat?: boolean;
  p1Aggressive?: boolean;
  p2Aggressive?: boolean;
  disableInteraction?: boolean; // New prop to lock interaction
}

// Optimization: Render trails at lower resolution for "bloom" effect and higher performance
const TRAIL_SCALE = 0.5;

// SPRITE CACHE
const particleSprites: Record<string, HTMLCanvasElement> = {};

const getParticleSprite = (color: string, radius: number): HTMLCanvasElement => {
  const key = `${color}-${radius}`;
  if (particleSprites[key]) return particleSprites[key];

  const canvas = document.createElement('canvas');
  const size = radius * 16; // Larger canvas for glow
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  const center = size / 2;

  // 1. Wide faint glow
  const grad = ctx.createRadialGradient(center, center, radius, center, center, radius * 8);
  grad.addColorStop(0, color);
  grad.addColorStop(1, 'transparent'); 
  ctx.globalAlpha = 0.3;
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(center, center, radius * 8, 0, Math.PI * 2);
  ctx.fill();

  // 2. Focused mid glow
  ctx.globalAlpha = 0.6;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(center, center, radius * 2.5, 0, Math.PI * 2);
  ctx.fill();
  
  // 3. Solid White Core
  ctx.globalAlpha = 1.0;
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(center, center, radius * 1.0, 0, Math.PI * 2);
  ctx.fill();

  particleSprites[key] = canvas;
  return canvas;
};

const SimulationView: React.FC<Props> = ({ 
  mode, 
  player1DNA, 
  player2DNA, 
  onStatsUpdate,
  showVectors = false,
  showTrails = false,
  selectedParticleIdx: propSelectedIdx,
  onSelectParticle,
  arenaConfig = DEFAULT_ARENA_CONFIG,
  paused = false,
  p1Retreat = false,
  p2Retreat = false,
  p1Aggressive = false,
  p2Aggressive = false,
  disableInteraction = false
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const trailCanvasRef = useRef<HTMLCanvasElement | null>(null);
  
  const engineRef = useRef<SimulationEngine | null>(null);
  const reqRef = useRef<number>(0);
  const frameCountRef = useRef(0);
  const lastTimeRef = useRef(0);
  
  const [localSelectedIdx, setLocalSelectedIdx] = useState<number | null>(null);
  const [localShowVectors, setLocalShowVectors] = useState(false);
  
  const isControlled = onSelectParticle !== undefined;
  const activeSelectedIdx = isControlled ? (propSelectedIdx ?? null) : localSelectedIdx;
  const shouldShowVectors = showVectors || localShowVectors;

  useEffect(() => {
    for (const key in particleSprites) delete particleSprites[key];

    // Initialize Trail Buffer
    if (!trailCanvasRef.current) {
        trailCanvasRef.current = document.createElement('canvas');
        trailCanvasRef.current.width = CANVAS_WIDTH * TRAIL_SCALE;
        trailCanvasRef.current.height = CANVAS_HEIGHT * TRAIL_SCALE;
    } else {
        // Clear buffer on restart
        const tCtx = trailCanvasRef.current.getContext('2d');
        tCtx?.clearRect(0, 0, CANVAS_WIDTH * TRAIL_SCALE, CANVAS_HEIGHT * TRAIL_SCALE);
    }

    const maxP = 2500; 
    const engine = new SimulationEngine(maxP);
    engineRef.current = engine;

    engine.setConfig(arenaConfig);

    if (mode === 'training') {
      engine.initTraining(player1DNA, arenaConfig.particleCount); 
    } else if (mode === 'arena' && player2DNA) {
      engine.init(player1DNA, player2DNA, arenaConfig.particleCount, arenaConfig.particleCount); 
    }

    if (!isControlled) {
      setLocalSelectedIdx(null);
    }

    const unlockAudio = () => {
        if (Howler && Howler.ctx && Howler.ctx.state === 'suspended') {
            Howler.ctx.resume();
        }
        document.removeEventListener('click', unlockAudio);
    };
    document.addEventListener('click', unlockAudio);

    return () => {
      if (reqRef.current) cancelAnimationFrame(reqRef.current);
      document.removeEventListener('click', unlockAudio);
    };
  }, [mode, player1DNA, player2DNA, isControlled, arenaConfig]);

  useEffect(() => {
    if (engineRef.current && mode === 'arena') {
        engineRef.current.setTactics(p1Retreat, p2Retreat, p1Aggressive, p2Aggressive);
    }
  }, [p1Retreat, p2Retreat, p1Aggressive, p2Aggressive, mode]);

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (disableInteraction) return; // Locked in Gauntlet/Auto Mode
    if (!engineRef.current) return;
    
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    const scaleX = CANVAS_WIDTH / rect.width;
    const scaleY = CANVAS_HEIGHT / rect.height;
    
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;
    
    const idx = engineRef.current.findParticleAt(x, y, 30); 
    const targetIdx = idx !== -1 ? idx : null;

    if (isControlled) {
      onSelectParticle?.(targetIdx);
    } else {
      setLocalSelectedIdx(targetIdx);
    }
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: false }); 
    if (!ctx) return;

    // Cache Hex Grid
    const bgCanvas = document.createElement('canvas');
    bgCanvas.width = CANVAS_WIDTH;
    bgCanvas.height = CANVAS_HEIGHT;
    const bgCtx = bgCanvas.getContext('2d');
    if (bgCtx) {
        bgCtx.fillStyle = '#020203';
        bgCtx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
        
        // Hex Grid
        bgCtx.strokeStyle = '#0a0a0f';
        bgCtx.lineWidth = 1;
        const hexSize = 50;
        
        bgCtx.beginPath();
        // Draw vertical lines
        for(let x=0; x<=CANVAS_WIDTH; x+=hexSize) {
           bgCtx.moveTo(x, 0);
           bgCtx.lineTo(x, CANVAS_HEIGHT);
        }
        // Draw angled lines to simulate hex grid approximation or just tri-grid for alien feel
        for (let x = -CANVAS_HEIGHT; x < CANVAS_WIDTH; x += hexSize) {
             bgCtx.moveTo(x, 0);
             bgCtx.lineTo(x + CANVAS_HEIGHT, CANVAS_HEIGHT);
        }
        bgCtx.stroke();
    }

    const render = (time: number) => {
      const engine = engineRef.current;
      if (!engine) return;

      if (!paused) {
        engine.update();
        engine.updateTrails();
        if (mode === 'arena') engine.updateBattleLogic();
        soundManager.playBatch(engine.frameEvents);
      }

      // 1. Draw Base Grid
      ctx.drawImage(bgCanvas, 0, 0);
      
      // 2. Drone Vision / Radar Sweep Effect
      // Calculate radar rotation based on time
      const radarAngle = (time * 0.0005) % (Math.PI * 2);
      
      // Create a gradient that sweeps
      const cx = CANVAS_WIDTH / 2;
      const cy = CANVAS_HEIGHT / 2;
      const sweepRadius = Math.max(CANVAS_WIDTH, CANVAS_HEIGHT);
      
      const gradient = ctx.createLinearGradient(
          cx + Math.cos(radarAngle) * -sweepRadius, 
          cy + Math.sin(radarAngle) * -sweepRadius,
          cx + Math.cos(radarAngle) * sweepRadius, 
          cy + Math.sin(radarAngle) * sweepRadius
      );
      
      gradient.addColorStop(0, 'transparent');
      gradient.addColorStop(0.5, 'transparent');
      gradient.addColorStop(0.51, 'rgba(0, 255, 100, 0.05)'); // Leading edge
      gradient.addColorStop(1, 'transparent');
      
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      // 3. Static Grain (Drone Camera Noise)
      if (Math.random() > 0.5) {
          ctx.fillStyle = `rgba(255, 255, 255, ${Math.random() * 0.02})`;
          ctx.fillRect(0, Math.random() * CANVAS_HEIGHT, CANVAS_WIDTH, Math.random() * 10);
      }
      
      // Vignette (Dark Corners)
      const vignette = ctx.createRadialGradient(cx, cy, sweepRadius * 0.4, cx, cy, sweepRadius * 0.8);
      vignette.addColorStop(0, 'transparent');
      vignette.addColorStop(1, 'rgba(0,0,0,0.8)');
      ctx.fillStyle = vignette;
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);


      if (mode === 'arena') {
         // Subtle pulsing border
         const pulse = 0.5 + Math.sin(time * 0.002) * 0.2;
         ctx.strokeStyle = `rgba(30, 30, 30, ${pulse})`;
         ctx.lineWidth = 4;
         ctx.strokeRect(2, 2, CANVAS_WIDTH - 4, CANVAS_HEIGHT - 4);
      }

      const count = engine.count;
      const pos = engine.positions;
      const owners = engine.owners;
      const types = engine.types;
      const colors = engine.colors; 
      const history = engine.trailHistory;
      const stride = TRAIL_LENGTH * 2;

      // Draw Trails (Optimized with dedicated buffer & scaling)
      if (showTrails && trailCanvasRef.current) {
         const tCtx = trailCanvasRef.current.getContext('2d');
         if (tCtx) {
             // 1. Fade Out (Accumulation)
             tCtx.globalCompositeOperation = 'source-over';
             tCtx.fillStyle = 'rgba(2, 2, 3, 0.15)'; 
             // Reset transform to ensure we fill the physical buffer
             tCtx.setTransform(1, 0, 0, 1, 0, 0);
             tCtx.fillRect(0, 0, trailCanvasRef.current.width, trailCanvasRef.current.height);

             // 2. Draw New Segments
             // Apply scaling for low-res buffer
             tCtx.scale(TRAIL_SCALE, TRAIL_SCALE);
             tCtx.globalCompositeOperation = 'lighter';
             tCtx.lineWidth = 2.0; // Thicker lines for downscaling compensation

             const colorCache: string[] = [];
             for(const c of colors) colorCache.push(c || '#fff');

             let lastColorIdx = -1;
             
             // Begin batch
             tCtx.beginPath();

             for (let i = 0; i < count; i++) {
                 // Skip static particles to save cycles
                 const baseIdx = i * stride;
                 const currX = history[baseIdx + (TRAIL_LENGTH-1)*2];
                 const currY = history[baseIdx + (TRAIL_LENGTH-1)*2 + 1];
                 const prevX = history[baseIdx + (TRAIL_LENGTH-2)*2];
                 const prevY = history[baseIdx + (TRAIL_LENGTH-2)*2 + 1];

                 // Squared distance check for performance
                 const dx = currX - prevX;
                 const dy = currY - prevY;
                 if (dx*dx + dy*dy < 0.25 || Math.abs(dx) > 100) continue;

                 const owner = owners[i];
                 const type = types[i];
                 let colorIdx = 0;
                 if (owner === 1) colorIdx = type;
                 else if (owner === 2) colorIdx = 2 + type;
                 else colorIdx = 4;

                 // Batch State Changes
                 if (colorIdx !== lastColorIdx) {
                     if (lastColorIdx !== -1) {
                         tCtx.stroke();
                         tCtx.beginPath();
                     }
                     tCtx.strokeStyle = colorCache[colorIdx];
                     lastColorIdx = colorIdx;
                 }

                 tCtx.moveTo(prevX, prevY);
                 tCtx.lineTo(currX, currY);
             }
             if (lastColorIdx !== -1) tCtx.stroke();
             
             // 3. Composite Buffer to Main Screen
             ctx.globalCompositeOperation = 'screen'; 
             ctx.drawImage(trailCanvasRef.current, 0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
         }
      }

      // Draw Effects (Sparks/Explosions)
      if (engine.effects.length > 0) {
        ctx.globalCompositeOperation = 'lighter'; // Additive blending for glow
        for(const eff of engine.effects) {
            ctx.globalAlpha = eff.life;
            ctx.strokeStyle = eff.color;
            ctx.lineWidth = eff.size; 
            ctx.beginPath();
            ctx.moveTo(eff.x, eff.y);
            // Motion blur tail
            ctx.lineTo(eff.x - eff.vx * 2, eff.y - eff.vy * 2);
            ctx.stroke();
            
            // Dot at head
            ctx.fillStyle = '#fff';
            ctx.beginPath();
            ctx.arc(eff.x, eff.y, 1, 0, Math.PI*2);
            ctx.fill();
        }
        ctx.globalAlpha = 1.0;
      }

      // Draw Particles
      ctx.globalCompositeOperation = 'screen';

      for (let i = 0; i < count; i++) {
        const owner = owners[i];
        const type = types[i];
        
        let colorIdx = 0;
        if (owner === 1) colorIdx = type;
        else if (owner === 2) colorIdx = 2 + type;
        else colorIdx = 4;

        const color = colors[colorIdx] || '#fff';
        const radius = type === 0 ? 3 : 2; 

        // Integer coordinates for crisp rendering
        const px = (pos[i * 2] | 0);
        const py = (pos[i * 2 + 1] | 0);
        
        const sprite = getParticleSprite(color, radius);
        const offset = radius * 8; // Offset based on new sprite size center

        ctx.drawImage(sprite, px - offset, py - offset);
      }
      
      if (shouldShowVectors) {
         ctx.globalCompositeOperation = 'source-over';
         const forces = engine.forces;
         // Sample particles to avoid visual clutter (aim for max ~150 vectors)
         const vectorStride = Math.max(1, Math.floor(count / 150));
         
         for (let i = 0; i < count; i += vectorStride) {
            const px = pos[i * 2];
            const py = pos[i * 2 + 1];
            const fx = forces[i*2];
            const fy = forces[i*2+1];
            const magSq = fx*fx + fy*fy;
            
            if (magSq > 0.0025) { // mag > 0.05
                const mag = Math.sqrt(magSq);
                const alpha = Math.min(mag * 0.5, 0.4);
                ctx.strokeStyle = `rgba(255, 255, 255, ${alpha})`;
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(px, py);
                const vx = fx * 20;
                const vy = fy * 20;
                ctx.lineTo(px + vx, py + vy); 
                
                // Small Arrow Head
                const angle = Math.atan2(vy, vx);
                const headLen = 3;
                ctx.lineTo(px + vx - headLen * Math.cos(angle - Math.PI / 6), py + vy - headLen * Math.sin(angle - Math.PI / 6));
                ctx.moveTo(px + vx, py + vy);
                ctx.lineTo(px + vx - headLen * Math.cos(angle + Math.PI / 6), py + vy - headLen * Math.sin(angle + Math.PI / 6));
                
                ctx.stroke();
            }
         }
      }

      // Selection UI
      ctx.globalCompositeOperation = 'source-over';
      if (activeSelectedIdx !== null && activeSelectedIdx < count) {
          const debugInfo = engine.inspectParticle(activeSelectedIdx);
          if (debugInfo) {
             const { x, y, netFx, netFy, interactions } = debugInfo;
             
             // Selection Circle
             ctx.strokeStyle = '#00f3ff';
             ctx.lineWidth = 2;
             ctx.beginPath();
             ctx.arc(x, y, 16, 0, Math.PI * 2); 
             ctx.stroke();
             
             // Crosshair
             ctx.setLineDash([4, 4]);
             ctx.beginPath();
             ctx.moveTo(x-20, y); ctx.lineTo(x+20, y);
             ctx.moveTo(x, y-20); ctx.lineTo(x, y+20);
             ctx.stroke();
             ctx.setLineDash([]);

             // Net Force Vector
             ctx.strokeStyle = '#00f3ff';
             ctx.lineWidth = 2;
             ctx.beginPath();
             ctx.moveTo(x, y);
             ctx.lineTo(x + netFx * 40, y + netFy * 40);
             ctx.stroke();

             // Interaction Lines
             ctx.globalAlpha = 0.5;
             interactions.forEach(inter => {
                ctx.strokeStyle = inter.isRepulsion ? '#ff0055' : '#00f3ff';
                ctx.lineWidth = Math.min(Math.abs(inter.force) * 4, 3); 
                ctx.beginPath();
                ctx.moveTo(x, y);
                ctx.lineTo(x + inter.dx, y + inter.dy);
                ctx.stroke();
             });
             ctx.globalAlpha = 1.0;
          }
      }

      frameCountRef.current++;
      if (time - lastTimeRef.current >= 1000) {
        const stats = engine.getStats();
        onStatsUpdate?.(
            stats.p1, 
            stats.p2, 
            stats.p1Escaped, 
            stats.p2Escaped, 
            frameCountRef.current,
            stats.centroidDist,
            stats.avgSpeed
        );
        frameCountRef.current = 0;
        lastTimeRef.current = time;
      }

      reqRef.current = requestAnimationFrame(render);
    };

    reqRef.current = requestAnimationFrame(render);

    return () => {
      if (reqRef.current) cancelAnimationFrame(reqRef.current);
    };
  }, [mode, onStatsUpdate, shouldShowVectors, showTrails, activeSelectedIdx, arenaConfig, paused, p1Retreat, p2Retreat, p1Aggressive, p2Aggressive]);

  return (
    <div className="w-full h-full flex items-center justify-center p-2 relative">
       {/* Monitor Frame */}
       <div 
         className="relative w-full h-full overflow-hidden shadow-[0_0_100px_rgba(0,0,0,0.8)] border border-neutral-800 bg-black"
         style={{ maxWidth: '100%', maxHeight: '100%' }}
       >
         {/* Decoration Overlays */}
         <div className="absolute top-4 left-4 w-16 h-16 border-l-2 border-t-2 border-cyan-500/50 rounded-tl-lg z-20 pointer-events-none"></div>
         <div className="absolute top-4 right-4 w-16 h-16 border-r-2 border-t-2 border-cyan-500/50 rounded-tr-lg z-20 pointer-events-none"></div>
         <div className="absolute bottom-4 left-4 w-16 h-16 border-l-2 border-b-2 border-cyan-500/50 rounded-bl-lg z-20 pointer-events-none"></div>
         <div className="absolute bottom-4 right-4 w-16 h-16 border-r-2 border-b-2 border-cyan-500/50 rounded-br-lg z-20 pointer-events-none"></div>
         
         {/* Status Text - Moved lower to avoid Timer overlap */}
         <div className="absolute top-24 left-1/2 -translate-x-1/2 bg-black/60 px-4 py-1 border border-white/10 rounded-full text-[10px] mono-font text-white/50 z-20 pointer-events-none">
             SIMULATION_FEED_LIVE
         </div>

         <canvas 
           ref={canvasRef} 
           width={CANVAS_WIDTH} 
           height={CANVAS_HEIGHT}
           className={`w-full h-full block bg-neutral-950 relative z-10 ${disableInteraction ? 'cursor-not-allowed' : 'cursor-crosshair'}`}
           onClick={handleCanvasClick}
         />
         
         {/* Local Vector Toggle (Available in all modes) */}
         <button 
            onClick={() => setLocalShowVectors(!localShowVectors)}
            className="absolute bottom-8 left-8 z-30 p-2 bg-black/50 border border-white/10 rounded text-neutral-400 hover:text-cyan-400 transition-colors backdrop-blur-sm"
            title="Toggle Force Vectors"
         >
            {shouldShowVectors ? <Eye size={16} /> : <EyeOff size={16} />}
         </button>
         
         {(activeSelectedIdx !== null) && (
           <div className="absolute top-8 right-8 pointer-events-none text-right z-30">
               <div className="text-[10px] text-cyan-400 uppercase tracking-widest bg-black/90 px-4 py-2 border border-cyan-500/50 backdrop-blur-md shadow-lg mono-font clip-tech-border">
                  TARGET_LOCKED :: ID [{activeSelectedIdx}]
               </div>
           </div>
         )}

         {/* Screen Effects */}
         <div className="absolute inset-0 pointer-events-none z-10 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.1)_50%)] bg-[size:100%_4px] opacity-20"></div>
       </div>
    </div>
  );
};

export default SimulationView;