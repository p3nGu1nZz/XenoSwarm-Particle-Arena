import React, { useState } from 'react';
import { ColonyDNA, GameState, PlayerId, MatchResult, ArenaConfig } from './types';
import { P1_DEFAULT_DNA, P2_DEFAULT_DNA, DEFAULT_ARENA_CONFIG } from './constants';
import { evolveColonyDNA, calculateMutationRate } from './services/geminiService';
import TrainingGround from './components/TrainingGround';
import Arena from './components/Arena';
import EvolutionView from './components/EvolutionView';
import Button from './components/Button';
import { Cpu, Users, Sword, BrainCircuit } from 'lucide-react';

const generateNextArenaConfig = (): ArenaConfig => {
  const roll = Math.random();
  
  if (roll < 0.25) {
     return {
        environmentName: "High Viscosity Soup",
        friction: 0.60, // Very high drag
        forceMultiplier: 1.5, // Stronger forces needed
        interactionRadius: 60, // Short range
        particleCount: 200
     };
  } else if (roll < 0.50) {
     return {
        environmentName: "Zero-G Vacuum",
        friction: 0.95, // Slippery
        forceMultiplier: 0.8, // Weaker forces
        interactionRadius: 100, // Long range
        particleCount: 120
     };
  } else if (roll < 0.75) {
     return {
        environmentName: "Dense Swarm Pits",
        friction: 0.8,
        forceMultiplier: 1.0,
        interactionRadius: 80,
        particleCount: 250 // Massive armies
     };
  } else {
     return {
        environmentName: "Standard Arena",
        friction: 0.8,
        forceMultiplier: 1.0,
        interactionRadius: 80,
        particleCount: 150
     };
  }
};

const App: React.FC = () => {
  const [gameState, setGameState] = useState<GameState>({
    player1: P1_DEFAULT_DNA,
    player2: P2_DEFAULT_DNA,
    activeScene: 'menu',
    trainingPlayer: 'player1',
    isAutoMode: false
  });

  const [p1Ready, setP1Ready] = useState(false);
  const [p2Ready, setP2Ready] = useState(false);
  
  // Auto Mode State
  const [matchHistory, setMatchHistory] = useState<MatchResult[]>([]);
  const [evolutionStatus, setEvolutionStatus] = useState<string>("");
  const [arenaConfig, setArenaConfig] = useState<ArenaConfig>(DEFAULT_ARENA_CONFIG);

  const updateDNA = (playerId: PlayerId, newDNA: ColonyDNA) => {
    setGameState(prev => ({
      ...prev,
      [playerId]: newDNA
    }));
  };

  const handleStartTraining = (player: PlayerId) => {
    setGameState(prev => ({
      ...prev,
      activeScene: 'training',
      trainingPlayer: player,
      isAutoMode: false
    }));
  };

  const handleStartArena = () => {
    // Reset to default config for manual play
    setArenaConfig(DEFAULT_ARENA_CONFIG);
    setGameState(prev => ({ ...prev, activeScene: 'arena', isAutoMode: false }));
  };

  const handleStartAutoMode = () => {
     setMatchHistory([]);
     setP1Ready(true);
     setP2Ready(true);
     // Start with a standard config or random? Let's start standard.
     setArenaConfig(DEFAULT_ARENA_CONFIG);
     setGameState(prev => ({ 
         ...prev, 
         activeScene: 'arena', 
         isAutoMode: true,
     }));
  };

  const handleBackToMenu = () => {
    setGameState(prev => ({ ...prev, activeScene: 'menu', isAutoMode: false }));
    setEvolutionStatus("");
  };

  const handlePlayerReady = () => {
    if (gameState.trainingPlayer === 'player1') {
      setP1Ready(true);
      if (!p2Ready) {
         setGameState(prev => ({ ...prev, trainingPlayer: 'player2' }));
      } else {
        handleBackToMenu();
      }
    } else {
      setP2Ready(true);
      if (!p1Ready) {
         setGameState(prev => ({ ...prev, trainingPlayer: 'player1' }));
      } else {
        handleBackToMenu();
      }
    }
  };

  // --- AI LOGIC ---
  const handleAutoMatchComplete = async (stats: { p1: number, p2: number, winner: 'p1' | 'p2' | 'draw' }) => {
    const matchId = matchHistory.length + 1;
    
    // 1. Record History
    const result: MatchResult = {
        id: matchId,
        timestamp: Date.now(),
        winner: stats.winner,
        p1Name: gameState.player1.name,
        p2Name: gameState.player2.name,
        p1Count: stats.p1,
        p2Count: stats.p2,
        duration: 90, // Approximate
        environmentName: arenaConfig.environmentName
    };
    
    setMatchHistory(prev => [result, ...prev]);

    // 2. Determine Next Match Config
    const nextConfig = generateNextArenaConfig();

    // 3. TRANSITION TO EVOLUTION SCENE
    // This unmounts the Arena, preventing the "fast match in background" bug
    const oldConfig = arenaConfig; // Capture current config before state update for calculation
    setArenaConfig(nextConfig); // Show what we are training for
    setEvolutionStatus(`Analysing Data -> Target: ${nextConfig.environmentName}`);
    setGameState(prev => ({ ...prev, activeScene: 'evolution' }));
    
    const p1Outcome = stats.winner === 'p1' ? 'WIN' : stats.winner === 'p2' ? 'LOSS' : 'DRAW';
    const p2Outcome = stats.winner === 'p2' ? 'WIN' : stats.winner === 'p1' ? 'LOSS' : 'DRAW';

    // Calculate Mutation Rates
    // Note: total initial particles per player = particleCount * 2 types
    const initialPerPlayer = oldConfig.particleCount * 2;
    
    const p1Mutation = calculateMutationRate(p1Outcome, stats.p1, stats.p2, initialPerPlayer);
    const p2Mutation = calculateMutationRate(p2Outcome, stats.p2, stats.p1, initialPerPlayer);

    try {
        const [newP1DNA, newP2DNA] = await Promise.all([
            evolveColonyDNA(gameState.player1, p1Outcome, stats.p1, stats.p2, gameState.player2, nextConfig, p1Mutation),
            evolveColonyDNA(gameState.player2, p2Outcome, stats.p2, stats.p1, gameState.player1, nextConfig, p2Mutation)
        ]);

        setEvolutionStatus("Applying Genetic Algorithms...");
        
        // Artificial delay to let the user read the screen and feel the "processing"
        setTimeout(() => {
             // Apply new DNA
             setGameState(prev => ({
                 ...prev,
                 player1: newP1DNA,
                 player2: newP2DNA,
                 activeScene: 'arena' // Switch back to Arena to start next match
             }));
             // arenaConfig is already set to nextConfig above
        }, 1500);

    } catch (e) {
        console.error("Auto Evolution Error", e);
        setEvolutionStatus("Evolution Error - Retrying...");
        setTimeout(() => {
             // If error, just restart arena with old DNA
             setGameState(prev => ({ ...prev, activeScene: 'arena' }));
        }, 2000);
    }
  };

  // --- RENDER ---

  if (gameState.activeScene === 'evolution') {
      return (
          <EvolutionView 
              arenaConfig={arenaConfig} 
              statusMessage={evolutionStatus} 
          />
      );
  }

  if (gameState.activeScene === 'arena') {
    return (
      <Arena 
        p1DNA={gameState.player1} 
        p2DNA={gameState.player2} 
        isAutoMode={gameState.isAutoMode}
        matchHistory={matchHistory}
        onAutoMatchComplete={handleAutoMatchComplete}
        arenaConfig={arenaConfig}
        onExit={() => {
          setP1Ready(false);
          setP2Ready(false);
          handleBackToMenu();
        }} 
      />
    );
  }

  if (gameState.activeScene === 'training') {
    return (
      <TrainingGround
        player={gameState.trainingPlayer}
        dna={gameState.trainingPlayer === 'player1' ? gameState.player1 : gameState.player2}
        onUpdateDNA={(dna) => updateDNA(gameState.trainingPlayer, dna)}
        onBack={handleBackToMenu}
        onReady={handlePlayerReady}
        isReady={gameState.trainingPlayer === 'player1' ? p1Ready : p2Ready}
      />
    );
  }

  // MAIN MENU
  return (
    <div className="min-h-screen bg-[#050505] flex items-center justify-center relative overflow-hidden">
      {/* Background Ambience */}
      <div className="absolute inset-0 z-0">
         <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-cyan-900/20 blur-[150px] rounded-full animate-pulse"></div>
         <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-orange-900/20 blur-[150px] rounded-full animate-pulse" style={{animationDelay: '2s'}}></div>
      </div>

      <div className="z-10 w-full max-w-4xl p-8">
        <header className="text-center mb-16 space-y-4">
          <h1 className="text-7xl font-bold text-white brand-font tracking-tighter drop-shadow-[0_0_25px_rgba(255,255,255,0.3)]">
            XENO<span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-600">SWARM</span>
          </h1>
          <p className="text-xl text-neutral-400 max-w-xl mx-auto font-light">
            Engineer intelligent particle colonies. Dominate the arena.
          </p>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Player 1 Card */}
          <div className={`relative group p-8 rounded-2xl border transition-all duration-300 ${p1Ready ? 'bg-cyan-950/30 border-cyan-500/50' : 'bg-neutral-900/50 border-white/5 hover:border-cyan-500/30'}`}>
            <div className="flex justify-between items-start mb-6">
              <div className="bg-cyan-950 text-cyan-400 p-3 rounded-xl border border-cyan-900">
                <Users size={24} />
              </div>
              {p1Ready && <span className="bg-cyan-500 text-black font-bold text-xs px-2 py-1 rounded">READY</span>}
            </div>
            <h2 className="text-2xl font-bold text-white mb-2 brand-font">Player 1</h2>
            <p className="text-neutral-500 mb-8 h-6 text-sm overflow-hidden">{gameState.player1.name}</p>
            <Button 
              className="w-full" 
              variant={p1Ready ? "ghost" : "primary"}
              onClick={() => handleStartTraining('player1')}
              icon={<Cpu size={16}/>}
            >
              {p1Ready ? 'Modify DNA' : 'Configure Colony'}
            </Button>
          </div>

          {/* Player 2 Card */}
          <div className={`relative group p-8 rounded-2xl border transition-all duration-300 ${p2Ready ? 'bg-orange-950/30 border-orange-500/50' : 'bg-neutral-900/50 border-white/5 hover:border-orange-500/30'}`}>
            <div className="flex justify-between items-start mb-6">
              <div className="bg-orange-950 text-orange-400 p-3 rounded-xl border border-orange-900">
                <Users size={24} />
              </div>
              {p2Ready && <span className="bg-orange-500 text-black font-bold text-xs px-2 py-1 rounded">READY</span>}
            </div>
            <h2 className="text-2xl font-bold text-white mb-2 brand-font">Player 2</h2>
            <p className="text-neutral-500 mb-8 h-6 text-sm overflow-hidden">{gameState.player2.name}</p>
            <Button 
              className="w-full" 
              variant={p2Ready ? "ghost" : "secondary"} // Should use a different color variant normally, but secondary is fine
              onClick={() => handleStartTraining('player2')}
              icon={<Cpu size={16}/>}
              style={{ borderColor: !p2Ready ? '#f97316' : '', color: !p2Ready ? '#f97316' : '' }} // Custom override for orange
            >
              {p2Ready ? 'Modify DNA' : 'Configure Colony'}
            </Button>
          </div>
        </div>

        {/* Start Game Button */}
        <div className="mt-12 text-center flex flex-col items-center gap-4">
          <Button 
            size="lg" 
            className="w-64 h-16 text-lg tracking-widest"
            disabled={!p1Ready || !p2Ready}
            onClick={handleStartArena}
            icon={<Sword size={24} />}
          >
            ENTER ARENA
          </Button>

          <div className="flex items-center gap-4 w-full justify-center">
             <div className="h-px bg-white/10 w-24"></div>
             <span className="text-neutral-600 text-xs uppercase tracking-widest">OR</span>
             <div className="h-px bg-white/10 w-24"></div>
          </div>

          <Button 
            variant="secondary"
            size="md" 
            className="w-64 border-purple-500/30 text-purple-400 hover:bg-purple-900/20 hover:border-purple-400 hover:shadow-[0_0_15px_rgba(168,85,247,0.3)]"
            onClick={handleStartAutoMode}
            icon={<BrainCircuit size={18} />}
          >
            AI AGENT BATTLE (AUTO)
          </Button>

          {(!p1Ready || !p2Ready) && (
            <p className="mt-4 text-neutral-600 text-sm animate-pulse">Configure both players manually or start AI Auto-Battle</p>
          )}
        </div>
      </div>
      
      <div className="absolute bottom-4 right-6 text-neutral-700 text-xs">
        v1.1.0 // AI_EVOLUTION_ONLINE
      </div>
    </div>
  );
};

export default App;