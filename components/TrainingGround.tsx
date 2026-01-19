import React, { useState, useEffect } from 'react';
import { ColonyDNA, PlayerId } from '../types';
import SimulationView from './SimulationView';
import MatrixEditor from './MatrixEditor';
import Button from './Button';
import { ArrowLeft, Play, Sword, Eye, EyeOff, Keyboard, Activity } from 'lucide-react';

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
    // Optionally reset selection when DNA changes heavily, 
    // but preserving it allows seeing how the SAME index particle behaves (even if it's a new instance)
  };

  return (
    <div className="flex h-screen w-full bg-[#050505]">
      {/* Sidebar Controls */}
      <div className="w-[500px] flex flex-col p-6 border-r border-white/5 bg-[#0a0a0a] z-20 overflow-y-auto">
        <div className="mb-8">
          <Button variant="ghost" size="sm" onClick={onBack} icon={<ArrowLeft size={16}/>} className="mb-4">
            Exit to Menu
          </Button>
          <h2 className="text-4xl font-bold brand-font mb-2" style={{ color: playerColor }}>
            {playerLabel}
          </h2>
          <div className="flex items-center gap-2">
             <div className={`w-3 h-3 rounded-full ${player === 'player1' ? 'bg-cyan-500' : 'bg-orange-500'}`}></div>
             <input 
               type="text" 
               value={dna.name} 
               onChange={(e) => onUpdateDNA({...dna, name: e.target.value})}
               className="bg-transparent border-b border-neutral-700 text-xl font-bold focus:outline-none focus:border-white w-full"
             />
          </div>
        </div>

        <div className="flex-1 flex flex-col gap-8">
           <MatrixEditor dna={dna} onChange={handleMatrixUpdate} playerColor={playerColor} />
           
           <div className="mt-auto pt-6 border-t border-white/5">
             <div className="flex gap-2 mb-4">
                <Button 
                   variant="secondary" 
                   size="sm" 
                   className="flex-1"
                   onClick={() => setShowForces(!showForces)}
                   icon={showForces ? <EyeOff size={16}/> : <Eye size={16}/>}
                >
                   {showForces ? 'Hide Forces (V)' : 'Show Forces (V)'}
                </Button>
                <Button 
                   variant="secondary" 
                   size="sm" 
                   className="flex-1"
                   onClick={() => setShowTrails(!showTrails)}
                   icon={<Activity size={16}/>}
                >
                   {showTrails ? 'Hide Trails (T)' : 'Show Trails (T)'}
                </Button>
             </div>

             <div className="bg-neutral-900/50 p-4 rounded-lg text-sm text-neutral-400 mb-6">
                <div className="flex items-center gap-2 mb-2 text-white/70 uppercase text-xs font-bold tracking-wider">
                  <Keyboard size={14} /> Shortcuts
                </div>
                <div className="grid grid-cols-2 gap-y-1 text-xs font-mono">
                  <span className="text-neutral-500">Toggle Forces</span> <span className="text-white text-right">V</span>
                  <span className="text-neutral-500">Toggle Trails</span> <span className="text-white text-right">T</span>
                  <span className="text-neutral-500">Reset Sim</span> <span className="text-white text-right">R</span>
                  <span className="text-neutral-500">Select Particle</span> <span className="text-white text-right">Arrows</span>
                  <span className="text-neutral-500">Deselect</span> <span className="text-white text-right">Esc</span>
                </div>
             </div>
             
             <Button 
               variant={isReady ? 'primary' : 'secondary'} 
               size="lg" 
               className="w-full"
               onClick={onReady}
               icon={isReady ? <Sword size={20}/> : <Play size={20} />}
             >
               {isReady ? 'Ready for Battle' : 'Lock In Colony'}
             </Button>
           </div>
        </div>
      </div>

      {/* Main Simulation Area */}
      <div className="flex-1 relative flex items-center justify-center p-8 bg-neutral-950">
        <div className="absolute top-8 left-8 z-10 flex gap-4">
           <span className="bg-white/5 text-white/50 px-3 py-1 rounded text-xs font-mono uppercase tracking-widest border border-white/5">
             Simulation Mode: Training
           </span>
        </div>
        <div className="w-full h-full max-w-6xl max-h-[800px]">
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