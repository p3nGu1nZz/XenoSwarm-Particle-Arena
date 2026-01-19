import React from 'react';
import { BrainCircuit, Wind, Zap, Users, Loader2, Disc } from 'lucide-react';
import { ArenaConfig } from '../types';

interface Props {
  arenaConfig: ArenaConfig;
  statusMessage: string;
}

const EvolutionView: React.FC<Props> = ({ arenaConfig, statusMessage }) => {
  return (
    <div className="w-full h-screen bg-[#050505] flex flex-col items-center justify-center relative overflow-hidden">
      {/* Background Effects */}
      <div className="absolute inset-0 z-0">
         <div className="absolute top-[20%] left-[20%] w-[40%] h-[40%] bg-purple-900/10 blur-[100px] rounded-full animate-pulse"></div>
         <div className="absolute inset-0 bg-[linear-gradient(rgba(0,0,0,0.5)_2px,transparent_2px),linear-gradient(90deg,rgba(0,0,0,0.5)_2px,transparent_2px)] bg-[size:50px_50px] opacity-20"></div>
      </div>

      <div className="z-10 flex flex-col items-center max-w-2xl text-center space-y-8 p-12 bg-neutral-900/50 border border-white/5 backdrop-blur-md rounded-3xl shadow-2xl">
        
        {/* Animated Icon */}
        <div className="relative">
            <div className="absolute inset-0 bg-cyan-500/20 blur-xl rounded-full animate-ping"></div>
            <BrainCircuit size={80} className="text-white relative z-10 animate-pulse" />
        </div>

        <div>
            <h2 className="text-4xl font-bold brand-font text-white mb-2 tracking-widest">
                NEURAL EVOLUTION
            </h2>
            <p className="text-cyan-400 font-mono text-sm animate-pulse">
                {statusMessage || "Optimizing Colony DNA..."}
            </p>
        </div>

        {/* Environment Preview Card */}
        <div className="w-full bg-black/40 border border-white/10 rounded-xl p-6 text-left">
            <h3 className="text-neutral-500 text-xs uppercase tracking-widest mb-4 border-b border-white/5 pb-2">
                Scanning Next Battlefield
            </h3>
            
            <div className="flex items-center gap-3 mb-4">
                <Wind className="text-blue-400" size={24} />
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
        
        <div className="flex items-center gap-2 text-neutral-600 text-xs font-mono">
            <Loader2 size={12} className="animate-spin" />
            <span>Processing Genetic Algorithms</span>
        </div>

      </div>
    </div>
  );
};

export default EvolutionView;