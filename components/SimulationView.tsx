import React, { useRef, useEffect, useState } from 'react';
import { SimulationEngine, TRAIL_LENGTH } from '../services/simulation';
import { CANVAS_WIDTH, CANVAS_HEIGHT, DEFAULT_ARENA_CONFIG } from '../constants';
import { ColonyDNA, ArenaConfig } from '../types';
import { soundManager } from '../services/SoundService';
import { Howler } from 'howler';

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
}

// SPRITE CACHE
const particleSprites: Record<string, HTMLCanvasElement> = {};

const getParticleSprite = (color: string, radius: number): HTMLCanvasElement => {
  const key = `${color}-${radius}`;
  if (particleSprites[key]) return particleSprites[key];

  const canvas = document.createElement('canvas');
  const size = radius * 8; 
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  const center = size / 2;

  // Outer Soft Glow
  const grad = ctx.createRadialGradient(center, center, radius, center, center, radius * 4);
  grad.addColorStop(0, color);
  grad.addColorStop(1, 'transparent'); 

  ctx.globalAlpha = 0.4;
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(center, center, radius * 4, 0, Math.PI * 2);
  ctx.fill();
  
  // Inner Core
  ctx.globalAlpha = 1.0;
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(center, center, radius * 0.8, 0, Math.PI * 2);
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
  p2Aggressive = false
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const trailCanvasRef = useRef<HTMLCanvasElement | null>(null);
  
  const engineRef = useRef<SimulationEngine | null>(null);
  const reqRef = useRef<number>(0);
  const frameCountRef = useRef(0);
  const lastTimeRef = useRef(0);
  
  const [localSelectedIdx, setLocalSelectedIdx] = useState<number | null>(null);
  const isControlled = onSelectParticle !== undefined;
  const activeSelectedIdx = isControlled ? (propSelectedIdx ?? null) : localSelectedIdx;

  useEffect(() => {
    for (const key in particleSprites) delete particleSprites[key];

    if (!trailCanvasRef.current) {
        trailCanvasRef.current = document.createElement('canvas');
        trailCanvasRef.current.width = CANVAS_WIDTH;
        trailCanvasRef.current.height = CANVAS_HEIGHT;
    } else {
        const tCtx = trailCanvasRef.current.getContext('2d');
        tCtx?.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
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
    if (!engineRef.current || mode !== 'training') return;
    
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

    // Cache Background
    const bgCanvas = document.createElement('canvas');
    bgCanvas.width = CANVAS_WIDTH;
    bgCanvas.height = CANVAS_HEIGHT;
    const bgCtx = bgCanvas.getContext('2d');
    if (bgCtx) {
        bgCtx.fillStyle = '#020203';
        bgCtx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
        
        // Hex Grid
        bgCtx.strokeStyle = '#0a0a0f';
        bgCtx.lineWidth = 2;
        const hexSize = 60;
        
        // Simple grid for performance
        bgCtx.beginPath();
        for(let x=0; x<=CANVAS_WIDTH; x+=hexSize) {
           bgCtx.moveTo(x, 0);
           bgCtx.lineTo(x, CANVAS_HEIGHT);
        }
        for(let y=0; y<=CANVAS_HEIGHT; y+=hexSize) {
           bgCtx.moveTo(0, y);
           bgCtx.lineTo(CANVAS_WIDTH, y);
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

      ctx.drawImage(bgCanvas, 0, 0);

      if (mode === 'arena') {
         ctx.strokeStyle = '#222';
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

      if (showTrails && trailCanvasRef.current) {
         const tCtx = trailCanvasRef.current.getContext('2d');
         if (tCtx) {
             tCtx.globalCompositeOperation = 'source-over';
             tCtx.fillStyle = 'rgba(2, 2, 3, 0.2)'; 
             tCtx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

             tCtx.globalCompositeOperation = 'lighter';
             tCtx.lineWidth = 1.5;

             const colorCache: string[] = [];
             for(const c of colors) colorCache.push(c || '#fff');

             let lastColorIdx = -1;

             for (let i = 0; i < count; i++) {
                 const baseIdx = i * stride;
                 const currX = history[baseIdx + (TRAIL_LENGTH-1)*2];
                 const currY = history[baseIdx + (TRAIL_LENGTH-1)*2 + 1];
                 const prevX = history[baseIdx + (TRAIL_LENGTH-2)*2];
                 const prevY = history[baseIdx + (TRAIL_LENGTH-2)*2 + 1];

                 if (Math.abs(currX - prevX) < 0.1 || Math.abs(currX - prevX) > 100) continue;

                 const owner = owners[i];
                 const type = types[i];
                 let colorIdx = 0;
                 if (owner === 1) colorIdx = type;
                 else if (owner === 2) colorIdx = 2 + type;
                 else colorIdx = 4;

                 if (colorIdx !== lastColorIdx) {
                     if (lastColorIdx !== -1) tCtx.stroke(); 
                     tCtx.strokeStyle = colorCache[colorIdx];
                     tCtx.beginPath();
                     lastColorIdx = colorIdx;
                 }

                 tCtx.moveTo(prevX, prevY);
                 tCtx.lineTo(currX, currY);
             }
             if (lastColorIdx !== -1) tCtx.stroke();
             
             ctx.globalCompositeOperation = 'screen'; 
             ctx.drawImage(trailCanvasRef.current, 0, 0);
         }
      }

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

        const sprite = getParticleSprite(color, radius);
        const px = (pos[i * 2] | 0);
        const py = (pos[i * 2 + 1] | 0);
        const offset = radius * 4; 

        ctx.drawImage(sprite, px - offset, py - offset);
      }
      
      if (showVectors) {
         ctx.globalCompositeOperation = 'source-over';
         const forces = engine.forces;
         for (let i = 0; i < count; i++) {
            const px = pos[i * 2];
            const py = pos[i * 2 + 1];
            const fx = forces[i*2];
            const fy = forces[i*2+1];
            const mag = Math.sqrt(fx*fx + fy*fy);
            if (mag > 0.05) {
                ctx.strokeStyle = `rgba(255, 255, 255, ${Math.min(mag * 0.5, 0.3)})`;
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(px, py);
                ctx.lineTo(px + fx * 20, py + fy * 20); 
                ctx.stroke();
            }
         }
      }

      ctx.globalCompositeOperation = 'source-over';

      if (activeSelectedIdx !== null && activeSelectedIdx < count) {
          const debugInfo = engine.inspectParticle(activeSelectedIdx);
          if (debugInfo) {
             const { x, y, netFx, netFy, interactions } = debugInfo;
             
             ctx.strokeStyle = '#00f3ff';
             ctx.lineWidth = 2;
             ctx.beginPath();
             ctx.arc(x, y, 16, 0, Math.PI * 2); 
             ctx.stroke();
             
             ctx.setLineDash([4, 4]);
             ctx.beginPath();
             ctx.moveTo(x-20, y); ctx.lineTo(x+20, y);
             ctx.moveTo(x, y-20); ctx.lineTo(x, y+20);
             ctx.stroke();
             ctx.setLineDash([]);

             ctx.strokeStyle = '#00f3ff';
             ctx.lineWidth = 2;
             ctx.beginPath();
             ctx.moveTo(x, y);
             ctx.lineTo(x + netFx * 40, y + netFy * 40);
             ctx.stroke();

             ctx.globalAlpha = 0.4;
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
  }, [mode, onStatsUpdate, showVectors, showTrails, activeSelectedIdx, arenaConfig, paused, p1Retreat, p2Retreat, p1Aggressive, p2Aggressive]);

  return (
    <div className="w-full h-full flex items-center justify-center p-2">
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
         
         <div className="absolute top-6 left-1/2 -translate-x-1/2 bg-black/60 px-4 py-1 border border-white/10 rounded-full text-[10px] mono-font text-white/50 z-20 pointer-events-none">
             SIMULATION_FEED_LIVE
         </div>

         <canvas 
           ref={canvasRef} 
           width={CANVAS_WIDTH} 
           height={CANVAS_HEIGHT}
           className="w-full h-full block bg-neutral-950 cursor-crosshair relative z-10"
           onClick={handleCanvasClick}
         />
         
         {mode === 'training' && (
           <div className="absolute top-8 right-8 pointer-events-none text-right z-30">
               <div className="text-[10px] text-cyan-400 uppercase tracking-widest bg-black/90 px-4 py-2 border border-cyan-500/50 backdrop-blur-md shadow-lg mono-font clip-tech-border">
                  {activeSelectedIdx !== null ? `TARGET_LOCKED :: ID [${activeSelectedIdx}]` : "AWAITING_INPUT"}
               </div>
           </div>
         )}

         {/* Screen Effects */}
         <div className="absolute inset-0 pointer-events-none z-10 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.1)_50%)] bg-[size:100%_4px] opacity-20"></div>
         <div className="absolute inset-0 pointer-events-none z-10"
              style={{
                background: 'radial-gradient(circle, transparent 50%, rgba(0,0,0,0.7) 100%)',
              }}
         ></div>
       </div>
    </div>
  );
};

export default SimulationView;