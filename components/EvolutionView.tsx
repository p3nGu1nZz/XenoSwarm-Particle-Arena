import React, { useRef, useEffect } from 'react';
import { BrainCircuit, Wind, Zap, Users, Loader2, Disc } from 'lucide-react';
import { ArenaConfig } from '../types';

interface Props {
  arenaConfig: ArenaConfig;
  statusMessage: string;
}

const NeuroNetworkVisual: React.FC = () => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        
        // Resize
        const resize = () => {
            if (canvas.parentElement) {
                canvas.width = canvas.parentElement.clientWidth;
                canvas.height = canvas.parentElement.clientHeight;
            }
        };
        window.addEventListener('resize', resize);
        resize();

        // Nodes
        const nodes: {x: number, y: number, r: number, pulse: number}[] = [];
        for(let i=0; i<30; i++) {
            nodes.push({
                x: Math.random() * canvas.width,
                y: Math.random() * canvas.height,
                r: Math.random() * 3 + 2,
                pulse: Math.random() * Math.PI
            });
        }

        let animationFrame = 0;

        const render = () => {
            if (!ctx) return;
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            
            // Draw Connections
            ctx.lineWidth = 1;
            for(let i=0; i<nodes.length; i++) {
                const n1 = nodes[i];
                // Animate Node Pulse
                n1.pulse += 0.05;
                const r = n1.r + Math.sin(n1.pulse) * 1;

                // Draw Node
                ctx.fillStyle = '#06b6d4'; // Cyan
                ctx.beginPath();
                ctx.arc(n1.x, n1.y, Math.max(1, r), 0, Math.PI * 2);
                ctx.fill();

                // Connect to nearby
                for(let j=i+1; j<nodes.length; j++) {
                    const n2 = nodes[j];
                    const dist = Math.hypot(n1.x - n2.x, n1.y - n2.y);
                    if (dist < 150) {
                        ctx.strokeStyle = `rgba(6, 182, 212, ${1 - dist/150})`;
                        ctx.beginPath();
                        ctx.moveTo(n1.x, n1.y);
                        ctx.lineTo(n2.x, n2.y);
                        ctx.stroke();

                        // Data Packet
                        const time = Date.now() * 0.002;
                        const offset = (time + i*10) % 1; 
                        const px = n1.x + (n2.x - n1.x) * offset;
                        const py = n1.y + (n2.y - n1.y) * offset;
                        
                        ctx.fillStyle = '#fff';
                        ctx.beginPath();
                        ctx.arc(px, py, 1.5, 0, Math.PI*2);
                        ctx.fill();
                    }
                }
            }
            animationFrame = requestAnimationFrame(render);
        };
        render();

        return () => {
            cancelAnimationFrame(animationFrame);
            window.removeEventListener('resize', resize);
        };
    }, []);

    return <canvas ref={canvasRef} className="absolute inset-0 z-0 opacity-40" />;
};

const EvolutionView: React.FC<Props> = ({ arenaConfig, statusMessage }) => {
  return (
    <div className="w-full h-screen bg-[#050505] flex flex-col items-center justify-center relative overflow-hidden">
      {/* Neuro Visualizer Background */}
      <NeuroNetworkVisual />

      {/* Background Effects */}
      <div className="absolute inset-0 z-0 pointer-events-none">
         <div className="absolute top-[20%] left-[20%] w-[40%] h-[40%] bg-purple-900/10 blur-[100px] rounded-full animate-pulse"></div>
         <div className="absolute inset-0 bg-[linear-gradient(rgba(0,0,0,0.5)_2px,transparent_2px),linear-gradient(90deg,rgba(0,0,0,0.5)_2px,transparent_2px)] bg-[size:50px_50px] opacity-20"></div>
      </div>

      <div className="z-10 flex flex-col items-center max-w-2xl text-center space-y-8 p-12 bg-neutral-900/80 border border-cyan-500/30 backdrop-blur-md rounded-3xl shadow-[0_0_50px_rgba(6,182,212,0.15)] clip-tech-border animate-in zoom-in-95 duration-500">
        
        {/* Animated Icon */}
        <div className="relative">
            <div className="absolute inset-0 bg-cyan-500/20 blur-xl rounded-full animate-ping"></div>
            <BrainCircuit size={80} className="text-cyan-400 relative z-10 animate-pulse" />
        </div>

        <div>
            <h2 className="text-4xl font-bold brand-font text-white mb-2 tracking-widest drop-shadow-[0_0_10px_rgba(255,255,255,0.5)]">
                NEURAL EVOLUTION
            </h2>
            <div className="h-1 w-24 bg-gradient-to-r from-cyan-500 to-transparent mx-auto mb-4"></div>
            <p className="text-cyan-400 font-mono text-sm animate-pulse">
                {statusMessage || "Optimizing Colony DNA..."}
            </p>
        </div>

        {/* Environment Preview Card */}
        <div className="w-full bg-black/60 border border-white/10 rounded-xl p-6 text-left relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-2 text-[10px] text-neutral-600 font-mono">NEXT_MATCH_CONFIG</div>
            
            <h3 className="text-neutral-500 text-xs uppercase tracking-widest mb-4 border-b border-white/5 pb-2">
                Scanning Next Battlefield
            </h3>
            
            <div className="flex items-center gap-3 mb-4">
                <Wind className="text-blue-400 group-hover:rotate-12 transition-transform duration-500" size={24} />
                <div>
                    <div className="text-white font-bold text-lg">{arenaConfig.environmentName}</div>
                    <div className="text-neutral-500 text-xs">Primary Conditions</div>
                </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
                <div className="bg-white/5 p-3 rounded border border-white/5 flex flex-col items-center text-center">
                    <Zap size={16} className="text-yellow-400 mb-1" />
                    <span className="text-xs text-neutral-400 uppercase">Force</span>
                    <span className="text-white font-mono font-bold">{arenaConfig.forceMultiplier.toFixed(1)}x</span>
                </div>
                <div className="bg-white/5 p-3 rounded border border-white/5 flex flex-col items-center text-center">
                    <Users size={16} className="text-purple-400 mb-1" />
                    <span className="text-xs text-neutral-400 uppercase">Density</span>
                    <span className="text-white font-mono font-bold">{arenaConfig.particleCount}</span>
                </div>
                <div className="bg-white/5 p-3 rounded border border-white/5 flex flex-col items-center text-center">
                    <Disc size={16} className="text-green-400 mb-1" />
                    <span className="text-xs text-neutral-400 uppercase">Friction</span>
                    <span className="text-white font-mono font-bold">{arenaConfig.friction.toFixed(2)}</span>
                </div>
            </div>
        </div>
        
        <div className="flex items-center gap-2 text-neutral-500 text-xs font-mono border border-white/10 px-4 py-2 rounded-full">
            <Loader2 size={12} className="animate-spin text-cyan-400" />
            <span>Processing Genetic Algorithms...</span>
        </div>

      </div>
    </div>
  );
};

export default EvolutionView;