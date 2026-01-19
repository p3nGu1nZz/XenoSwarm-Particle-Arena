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
  onStatsUpdate?: (p1: number, p2: number, p1Escaped: number, p2Escaped: number, fps: number) => void;
  showVectors?: boolean; 
  showTrails?: boolean;
  // Controlled selection props
  selectedParticleIdx?: number | null;
  onSelectParticle?: (idx: number | null) => void;
  arenaConfig?: ArenaConfig;
  paused?: boolean;
}

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
  paused = false
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<SimulationEngine | null>(null);
  const reqRef = useRef<number>(0);
  const frameCountRef = useRef(0);
  const lastTimeRef = useRef(0);
  
  // Interaction State (Local fallback for uncontrolled mode)
  const [localSelectedIdx, setLocalSelectedIdx] = useState<number | null>(null);

  // Determine active selection (Controlled vs Uncontrolled)
  const isControlled = onSelectParticle !== undefined;
  const activeSelectedIdx = isControlled ? (propSelectedIdx ?? null) : localSelectedIdx;

  useEffect(() => {
    // Init Engine
    const maxP = 2000; // Increased buffer for higher particle counts
    const engine = new SimulationEngine(maxP);
    engineRef.current = engine;

    // Apply Config
    engine.setConfig(arenaConfig);

    if (mode === 'training') {
      engine.initTraining(player1DNA, arenaConfig.particleCount); 
    } else if (mode === 'arena' && player2DNA) {
      engine.init(player1DNA, player2DNA, arenaConfig.particleCount, arenaConfig.particleCount); 
    }

    // Reset local selection on DNA change only if uncontrolled
    if (!isControlled) {
      setLocalSelectedIdx(null);
    }

    // Ensure audio context is ready (user interaction usually required)
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
  }, [mode, player1DNA, player2DNA, isControlled, arenaConfig]); // Re-init on config change

  // Click Handler for Selection
  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!engineRef.current || mode !== 'training') return;
    
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    const scaleX = CANVAS_WIDTH / rect.width;
    const scaleY = CANVAS_HEIGHT / rect.height;
    
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;
    
    const idx = engineRef.current.findParticleAt(x, y, 30); // 30px click radius
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

    const render = (time: number) => {
      const engine = engineRef.current;
      if (!engine) return;

      if (!paused) {
        // Update Physics & Trails
        engine.update();
        engine.updateTrails();
        
        if (mode === 'arena') {
          engine.updateBattleLogic();
        }

        // --- SOUND TRIGGER ---
        // Pass the events accumulated in this frame to the sound manager
        soundManager.playBatch(engine.frameEvents);
      }

      // Draw Background
      ctx.fillStyle = '#050505';
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      // ARENA BOUNDARY WARNING
      if (mode === 'arena') {
         // Draw solid boundary to represent walls
         ctx.strokeStyle = '#ffffff';
         ctx.lineWidth = 2;
         ctx.globalAlpha = 0.2;
         ctx.strokeRect(1, 1, CANVAS_WIDTH - 2, CANVAS_HEIGHT - 2);
         ctx.globalAlpha = 1.0;
      }

      // Glow effect for particles
      ctx.globalCompositeOperation = 'screen';

      const pos = engine.positions;
      const owners = engine.owners;
      const types = engine.types;
      const count = engine.count;
      const colors = engine.colors; 
      const forces = engine.forces;
      const history = engine.trailHistory;
      const stride = TRAIL_LENGTH * 2;

      // 1. Draw Trails
      const drawTrailsForIdx = (i: number, baseAlpha: number) => {
          const owner = owners[i];
          const type = types[i];
          let colorIdx = 0;
          if (owner === 1) colorIdx = type;
          else if (owner === 2) colorIdx = 2 + type;
          else colorIdx = 4;
          
          const color = colors[colorIdx] || '#fff';
          const baseIdx = i * stride;
          
          ctx.beginPath();
          ctx.strokeStyle = color;
          // Simple fading
          ctx.globalAlpha = baseAlpha;
          ctx.moveTo(history[baseIdx], history[baseIdx+1]);
          for (let t = 1; t < TRAIL_LENGTH; t++) {
             ctx.lineTo(history[baseIdx + t*2], history[baseIdx + t*2 + 1]);
          }
          ctx.stroke();
          ctx.globalAlpha = 1.0;
      };

      if (showTrails) {
         ctx.lineWidth = 1;
         for (let i = 0; i < count; i++) {
             drawTrailsForIdx(i, 0.2); // Low opacity for general trails
         }
      }

      // Always draw trail for selected particle with higher visibility
      if (activeSelectedIdx !== null && activeSelectedIdx < count) {
          ctx.lineWidth = 2;
          drawTrailsForIdx(activeSelectedIdx, 0.8);
          ctx.lineWidth = 1;
      }

      // 2. Draw Particles
      for (let i = 0; i < count; i++) {
        const owner = owners[i];
        const type = types[i];
        
        let colorIdx = 0;
        if (owner === 1) colorIdx = type;
        else if (owner === 2) colorIdx = 2 + type;
        else colorIdx = 4;

        ctx.fillStyle = colors[colorIdx] || '#fff';
        
        const px = pos[i * 2];
        const py = pos[i * 2 + 1];

        ctx.beginPath();
        const radius = type === 0 ? 3 : 2; 
        ctx.arc(px, py, radius, 0, Math.PI * 2);
        ctx.fill();

        // Vector Overlay
        if (showVectors) {
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

      // Draw Selected Particle Debug Info
      if (activeSelectedIdx !== null && activeSelectedIdx < count) {
          const debugInfo = engine.inspectParticle(activeSelectedIdx);
          if (debugInfo) {
             const { x, y, netFx, netFy, interactions } = debugInfo;
             
             // Highlight Selection
             ctx.strokeStyle = '#ffff00';
             ctx.lineWidth = 2;
             ctx.beginPath();
             ctx.arc(x, y, 8, 0, Math.PI * 2);
             ctx.stroke();

             // Draw Net Force
             ctx.strokeStyle = '#ffff00';
             ctx.lineWidth = 3;
             ctx.beginPath();
             ctx.moveTo(x, y);
             ctx.lineTo(x + netFx * 30, y + netFy * 30);
             ctx.stroke();

             // Draw Interactions
             interactions.forEach(inter => {
                ctx.strokeStyle = inter.isRepulsion ? 'rgba(255, 0, 0, 0.4)' : 'rgba(0, 255, 0, 0.4)';
                ctx.lineWidth = Math.abs(inter.force) * 3; 
                ctx.beginPath();
                ctx.moveTo(x, y);
                ctx.lineTo(x + inter.dx, y + inter.dy);
                ctx.stroke();
             });
          }
      }

      // FPS & Stats
      frameCountRef.current++;
      if (time - lastTimeRef.current >= 1000) {
        const stats = engine.getStats();
        onStatsUpdate?.(stats.p1, stats.p2, stats.p1Escaped, stats.p2Escaped, frameCountRef.current);
        frameCountRef.current = 0;
        lastTimeRef.current = time;
      }

      reqRef.current = requestAnimationFrame(render);
    };

    reqRef.current = requestAnimationFrame(render);

    return () => {
      if (reqRef.current) cancelAnimationFrame(reqRef.current);
    };
  }, [mode, onStatsUpdate, showVectors, showTrails, activeSelectedIdx, arenaConfig, paused]);

  return (
    <div className="w-full h-full flex items-center justify-center min-h-0 min-w-0">
       {/* Responsive Container */}
       <div 
         className="relative max-w-full max-h-full border border-white/10 rounded-lg overflow-hidden shadow-2xl shadow-black/50"
         style={{ aspectRatio: `${CANVAS_WIDTH}/${CANVAS_HEIGHT}` }}
       >
         <canvas 
           ref={canvasRef} 
           width={CANVAS_WIDTH} 
           height={CANVAS_HEIGHT}
           className="w-full h-full block bg-neutral-950 cursor-crosshair"
           onClick={handleCanvasClick}
         />
         {/* Instructions Overlay */}
         {mode === 'training' && (
           <div className="absolute top-4 right-4 pointer-events-none text-right z-20">
               <div className="text-[10px] text-neutral-500 uppercase tracking-widest bg-black/50 px-2 py-1 rounded backdrop-blur">
                  {activeSelectedIdx !== null ? `Inspecting Particle #${activeSelectedIdx}` : "Click particle to inspect"}
               </div>
           </div>
         )}
         {/* CRT Scanline effect overlay */}
         <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] z-10 bg-[length:100%_2px,3px_100%] opacity-20"></div>
       </div>
    </div>
  );
};

export default SimulationView;