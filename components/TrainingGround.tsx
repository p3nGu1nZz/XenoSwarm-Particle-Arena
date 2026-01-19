import React, { useState, useEffect } from 'react';
import { ColonyDNA, PlayerId } from '../types';
import SimulationView from './SimulationView';
import MatrixEditor from './MatrixEditor';
import Button from './Button';
import { ArrowLeft, Play, Sword, Eye, EyeOff, Keyboard, Activity, Microscope } from 'lucide-react';

interface Props {
  player: PlayerId;
  dna: ColonyDNA;
  onUpdateDNA: (dna: ColonyDNA) => void;
  onBack: () => void;
  onReady: () => void;
  isReady: boolean;
}

const TrainingGround: React.FC<Props> = ({ 
  player, 
  dna, 
  onUpdateDNA, 
  onBack, 
  onReady,
  isReady 
}) => {
  const playerColor = player === 'player1' ? '#06b6d4' : '#f97316';
  const playerLabel = player === 'player1' ? 'Player 1' : 'Player 2';
  
  // Lifted State
  const [showForces, setShowForces] = useState(false);
  const [showTrails, setShowTrails] = useState(false);
  const [selectedParticleIdx, setSelectedParticleIdx] = useState<number | null>(null);
  const [simKey, setSimKey] = useState(0); // Used to force-reset the simulation
  const [totalParticles, setTotalParticles] = useState(0);

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      const key = e.key.toLowerCase();

      // V: Toggle Vectors
      if (key === 'v') {
        setShowForces(prev => !prev);
      }

      // T: Toggle Trails
      if (key === 't') {
        setShowTrails(prev => !prev);
      }
      
      // R: Reset Simulation
      if (key === 'r') {
        setSimKey(prev => prev + 1);
        setSelectedParticleIdx(null);
      }

      // Escape: Deselect
      if (e.key === 'Escape') {
        setSelectedParticleIdx(null);
      }

      // Arrows: Navigate Particles
      if (totalParticles > 0) {
        if (e.key === 'ArrowRight') {
          e.preventDefault();
          setSelectedParticleIdx(prev => {
             if (prev === null) return 0;
             return (prev + 1) % totalParticles;
          });
        }
        if (e.key === 'ArrowLeft') {
          e.preventDefault();
          setSelectedParticleIdx(prev => {
             if (prev === null) return totalParticles - 1;
             return (prev - 1 + totalParticles) % totalParticles;
          });
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [totalParticles]);

  const handleStatsUpdate = (p1: number, p2: number, p1e: number, p2e: number, fps: number) => {
    setTotalParticles(p1 + p2);
  };

  const handleMatrixUpdate = (newDNA: ColonyDNA) => {
    onUpdateDNA(newDNA);
  };

  return (
    <div className="flex h-screen w-full bg-[#050505] overflow-hidden">
      {/* Sidebar Controls - Glassmorphism Panel */}
      <div className="w-[500px] flex flex-col p-6 border-r border-white/10 bg-neutral-900/60 backdrop-blur-xl z-20 overflow-y-auto relative shadow-[10px_0_30px_rgba(0,0,0,0.5)]">
        {/* Header */}
        <div className="mb-6 pb-6 border-b border-white/10">
          <Button variant="ghost" size="sm" onClick={onBack} icon={<ArrowLeft size={14}/>} className="mb-4 text-neutral-400">
            Back to Hub
          </Button>
          <div className="flex items-center gap-3">
             <div 
               className="w-10 h-10 rounded flex items-center justify-center border border-white/20 shadow-[0_0_15px_rgba(0,0,0,0.5)]"
               style={{ backgroundColor: `${playerColor}20`, borderColor: playerColor }}
             >
                 <Microscope size={24} style={{ color: playerColor }} />
             </div>
             <div>
                <h2 className="text-3xl font-bold brand-font text-white leading-none">
                    {playerLabel}
                </h2>
                <span className="text-xs text-neutral-500 uppercase tracking-widest font-mono">Laboratory Access Granted</span>
             </div>
          </div>
          
          <div className="mt-6">
             <label className="text-[10px] text-neutral-500 uppercase tracking-widest font-bold mb-1 block">Colony Designation</label>
             <input 
               type="text" 
               value={dna.name} 
               onChange={(e) => onUpdateDNA({...dna, name: e.target.value})}
               className="bg-black/30 border border-white/10 rounded px-3 py-2 text-lg font-bold text-white focus:outline-none focus:border-white/40 w-full transition-colors font-mono"
             />
          </div>
        </div>

        <div className="flex-1 flex flex-col gap-6">
           <MatrixEditor dna={dna} onChange={handleMatrixUpdate} playerColor={playerColor} />
           
           <div className="mt-auto pt-6 border-t border-white/10">
             <div className="grid grid-cols-2 gap-3 mb-4">
                <Button 
                   variant="secondary" 
                   size="sm" 
                   onClick={() => setShowForces(!showForces)}
                   icon={showForces ? <EyeOff size={14}/> : <Eye size={14}/>}
                >
                   {showForces ? 'Hide Forces' : 'View Forces'}
                </Button>
                <Button 
                   variant="secondary" 
                   size="sm" 
                   onClick={() => setShowTrails(!showTrails)}
                   icon={<Activity size={14}/>}
                >
                   {showTrails ? 'Hide Trails' : 'Trace Trails'}
                </Button>
             </div>

             <div className="bg-black/40 border border-white/5 p-4 rounded text-sm text-neutral-400 mb-6">
                <div className="flex items-center gap-2 mb-3 text-white/60 uppercase text-[10px] font-bold tracking-widest">
                  <Keyboard size={12} /> System Overrides
                </div>
                <div className="grid grid-cols-2 gap-y-2 text-[10px] font-mono uppercase">
                  <span className="text-neutral-500">Toggle Forces</span> <span className="text-white text-right font-bold">V</span>
                  <span className="text-neutral-500">Toggle Trails</span> <span className="text-white text-right font-bold">T</span>
                  <span className="text-neutral-500">Reboot Sim</span> <span className="text-white text-right font-bold">R</span>
                  <span className="text-neutral-500">Select Unit</span> <span className="text-white text-right font-bold">ARROWS</span>
                </div>
             </div>
             
             <Button 
               variant={isReady ? 'primary' : 'secondary'} 
               size="lg" 
               className="w-full"
               onClick={onReady}
               icon={isReady ? <Sword size={20}/> : <Play size={20} />}
             >
               {isReady ? 'Colony Synced' : 'Save & Lock Colony'}
             </Button>
           </div>
        </div>
      </div>

      {/* Main Simulation Area */}
      <div className="flex-1 relative flex items-center justify-center p-8 bg-neutral-950">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(50,50,50,0.1),transparent_70%)] pointer-events-none"></div>
        <div className="absolute top-8 left-8 z-10">
           <span className="bg-black/60 text-cyan-400 px-4 py-1.5 rounded-full text-xs font-mono uppercase tracking-widest border border-cyan-500/20 backdrop-blur shadow-lg">
             Simulation Environment // Training
           </span>
        </div>
        <div className="w-full h-full max-w-6xl max-h-[800px] shadow-2xl rounded-xl overflow-hidden border border-white/5">
           <SimulationView 
             key={simKey} // Force remount on reset
             mode="training" 
             player1DNA={dna} 
             showVectors={showForces}
             showTrails={showTrails}
             selectedParticleIdx={selectedParticleIdx}
             onSelectParticle={setSelectedParticleIdx}
             onStatsUpdate={handleStatsUpdate}
           />
        </div>
      </div>
    </div>
  );
};

export default TrainingGround;