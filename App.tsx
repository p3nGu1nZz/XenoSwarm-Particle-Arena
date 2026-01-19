import React, { useState, useEffect } from 'react';
import { ColonyDNA, GameState, PlayerId, MatchResult, ArenaConfig, PlayerProfile } from './types';
import { P1_DEFAULT_DNA, P2_DEFAULT_DNA, DEFAULT_ARENA_CONFIG, generateAIPool } from './constants';
import { evolveColonyDNA, calculateMutationRate } from './services/geminiService';
import { calculateMatchScore } from './services/scoringService';
import { soundManager } from './services/SoundService';
import TrainingGround from './components/TrainingGround';
import Arena from './components/Arena';
import EvolutionView from './components/EvolutionView';
import LeaderboardScene from './components/LeaderboardScene';
import Button from './components/Button';
import { Cpu, Users, Sword, BrainCircuit, Activity, Gamepad2, Globe, ShieldAlert, Infinity } from 'lucide-react';

const SceneTransition: React.FC<{ children: React.ReactNode, sceneKey: string }> = ({ children, sceneKey }) => {
    const [displayChildren, setDisplayChildren] = useState(children);
    const [opacity, setOpacity] = useState(0);

    useEffect(() => {
        setOpacity(0);
        const timer = setTimeout(() => {
            setDisplayChildren(children);
            setOpacity(1);
        }, 300); // Wait for fade out
        return () => clearTimeout(timer);
    }, [sceneKey, children]);

    return (
        <div 
            className="w-full h-full transition-opacity duration-500 ease-in-out"
            style={{ opacity }}
        >
            {displayChildren}
        </div>
    );
};

const generateNextArenaConfig = (): ArenaConfig => {
  const roll = Math.random();
  if (roll < 0.25) {
     return { environmentName: "High Viscosity Soup", friction: 0.60, forceMultiplier: 1.5, interactionRadius: 60, particleCount: 350 };
  } else if (roll < 0.50) {
     return { environmentName: "Zero-G Vacuum", friction: 0.95, forceMultiplier: 0.8, interactionRadius: 100, particleCount: 200 };
  } else if (roll < 0.75) {
     return { environmentName: "Dense Swarm Pits", friction: 0.8, forceMultiplier: 1.0, interactionRadius: 80, particleCount: 400 };
  } else {
     return { environmentName: "Standard Arena", friction: 0.8, forceMultiplier: 1.0, interactionRadius: 80, particleCount: 300 };
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
  
  const [aiPool, setAiPool] = useState<PlayerProfile[]>([]);
  
  // Track specific profiles for the current match
  const [activeProfileP1, setActiveProfileP1] = useState<PlayerProfile | null>(null);
  const [activeProfileP2, setActiveProfileP2] = useState<PlayerProfile | null>(null);

  const [playerScore, setPlayerScore] = useState(0); // Only for Campaign Mode
  const [matchHistory, setMatchHistory] = useState<MatchResult[]>([]);
  const [evolutionStatus, setEvolutionStatus] = useState<string>("");
  const [arenaConfig, setArenaConfig] = useState<ArenaConfig>(DEFAULT_ARENA_CONFIG);
  const [isLocalMatch, setIsLocalMatch] = useState(false);
  const [showLocalLobby, setShowLocalLobby] = useState(false);
  
  // Transition state for Evolution View effect
  const [evolutionPhase, setEvolutionPhase] = useState<'analyzing' | 'applying'>('analyzing');

  useEffect(() => {
      setAiPool(generateAIPool(20));
      soundManager.initialize();
  }, []);

  // Sync Music with Scene
  useEffect(() => {
      if (gameState.activeScene === 'menu') {
          soundManager.setTheme('menu');
      } else if (gameState.activeScene === 'arena') {
          soundManager.setTheme('arena', arenaConfig.environmentName);
      } else if (gameState.activeScene === 'evolution') {
          soundManager.setTheme('evolution');
      } else if (gameState.activeScene === 'leaderboard') {
          soundManager.setTheme('leaderboard');
      }
  }, [gameState.activeScene, arenaConfig.environmentName]);

  const updateDNA = (playerId: PlayerId, newDNA: ColonyDNA) => {
    setGameState(prev => ({ ...prev, [playerId]: newDNA }));
  };

  const handleStartTraining = (player: PlayerId) => {
    setGameState(prev => ({ ...prev, activeScene: 'training', trainingPlayer: player, isAutoMode: false }));
  };

  const handleStartCombat = () => {
    const opponent = aiPool[Math.floor(Math.random() * aiPool.length)];
    setActiveProfileP1(null); // P1 is human
    setActiveProfileP2(opponent);
    setArenaConfig(DEFAULT_ARENA_CONFIG);
    setGameState(prev => ({ ...prev, player2: opponent.dna, activeScene: 'arena', isAutoMode: false }));
  };

  const handleStartAutoMode = () => {
     setMatchHistory([]);
     setIsLocalMatch(false);
     
     // Pick two distinct random agents from pool
     const idx1 = Math.floor(Math.random() * aiPool.length);
     let idx2 = Math.floor(Math.random() * aiPool.length);
     while (idx2 === idx1) idx2 = Math.floor(Math.random() * aiPool.length);

     const agent1 = aiPool[idx1];
     const agent2 = aiPool[idx2];

     setActiveProfileP1(agent1);
     setActiveProfileP2(agent2);

     setArenaConfig(DEFAULT_ARENA_CONFIG);
     
     setGameState(prev => ({ 
         ...prev, 
         player1: agent1.dna,
         player2: agent2.dna,
         activeScene: 'arena', 
         isAutoMode: true 
     }));
  };

  const handleStartLocalMatch = () => {
     setArenaConfig(DEFAULT_ARENA_CONFIG);
     setIsLocalMatch(true);
     setGameState(prev => ({ ...prev, activeScene: 'arena', isAutoMode: false }));
  };

  const handleBackToMenu = () => {
    setGameState(prev => ({ ...prev, activeScene: 'menu', isAutoMode: false }));
    setEvolutionStatus("");
    setIsLocalMatch(false);
  };

  const handleMatchComplete = (stats: { p1: number, p2: number, winner: 'p1' | 'p2' | 'draw', duration: number }) => {
     const matchId = matchHistory.length + 1;
     
     // 1. Local Match Logic
     if (isLocalMatch) {
        const result: MatchResult = {
            id: Date.now(), timestamp: Date.now(), winner: stats.winner,
            p1Name: gameState.player1.name, p2Name: gameState.player2.name,
            p1Count: stats.p1, p2Count: stats.p2, duration: stats.duration, 
            environmentName: arenaConfig.environmentName, scoreP1: 0, scoreP2: 0
        };
        setGameState(prev => ({
            ...prev,
            leaderboardData: { lastMatch: result, player1Profile: { id: 'p1', dna: gameState.player1, score: 0, matchesPlayed: 0, wins: 0 }, player2Profile: { id: 'p2', dna: gameState.player2, score: 0, matchesPlayed: 0, wins: 0 } },
            activeScene: 'leaderboard'
        }));
        return;
     }

     const outcomeP1 = stats.winner === 'p1' ? 'WIN' : stats.winner === 'p2' ? 'LOSS' : 'DRAW';
     const outcomeP2 = stats.winner === 'p2' ? 'WIN' : stats.winner === 'p1' ? 'LOSS' : 'DRAW';
     
     const { score: scoreP1 } = calculateMatchScore(outcomeP1, stats.p1, stats.p2, stats.duration, arenaConfig.particleCount * 2);
     const { score: scoreP2 } = calculateMatchScore(outcomeP2, stats.p2, stats.p1, stats.duration, arenaConfig.particleCount * 2);

     const result: MatchResult = {
         id: matchId, timestamp: Date.now(), winner: stats.winner,
         p1Name: gameState.player1.name, p2Name: gameState.player2.name,
         p1Count: stats.p1, p2Count: stats.p2, duration: stats.duration, 
         environmentName: arenaConfig.environmentName, scoreP1, scoreP2
     };

     setMatchHistory(prev => [result, ...prev]);

     // Update Pool Stats Immediately so Leaderboard has correct "final" data
     setAiPool(prevPool => prevPool.map(ai => {
         if (activeProfileP1 && ai.id === activeProfileP1.id) {
             return { ...ai, score: ai.score + scoreP1, matchesPlayed: ai.matchesPlayed + 1, wins: ai.wins + (outcomeP1 === 'WIN' ? 1 : 0) };
         }
         if (activeProfileP2 && ai.id === activeProfileP2.id) {
             return { ...ai, score: ai.score + scoreP2, matchesPlayed: ai.matchesPlayed + 1, wins: ai.wins + (outcomeP2 === 'WIN' ? 1 : 0) };
         }
         // Passive pool movement for background activity simulation
         if (Math.random() < 0.15) return { ...ai, score: ai.score + Math.floor(Math.random() * 150) };
         return ai;
     }));
     
     if (!gameState.isAutoMode) {
        setPlayerScore(prev => prev + scoreP1);
     }

     // Prepare Profiles for Leaderboard
     // We pass the *updated* stats to the leaderboard, it will handle calculating the delta for animation
     const lbP1 = activeProfileP1 || { id: 'player1', dna: gameState.player1, score: playerScore + scoreP1, matchesPlayed: matchHistory.length + 1, wins: 0 };
     const lbP2 = activeProfileP2!; 

     setGameState(prev => ({
         ...prev,
         leaderboardData: {
             lastMatch: result,
             player1Profile: lbP1,
             player2Profile: lbP2
         },
         activeScene: 'leaderboard'
     }));
  };

  const handleLeaderboardNext = async () => {
      if (isLocalMatch) {
          handleBackToMenu();
          return;
      }

      const lastMatch = gameState.leaderboardData!.lastMatch;
      const nextConfig = generateNextArenaConfig();
      setArenaConfig(nextConfig);

      setEvolutionPhase('analyzing'); // Start Phase 1
      setEvolutionStatus("ANALYZING COMBAT DATA...");
      setGameState(prev => ({ ...prev, activeScene: 'evolution' }));

      // --- GAUNTLET MODE LOGIC ---
      if (gameState.isAutoMode && activeProfileP1 && activeProfileP2) {
          const initialPerPlayer = arenaConfig.particleCount * 2;
          
          const outcomeP1 = lastMatch.winner === 'p1' ? 'WIN' : lastMatch.winner === 'p2' ? 'LOSS' : 'DRAW';
          const mutationP1 = calculateMutationRate(outcomeP1, lastMatch.p1Count, lastMatch.p2Count, initialPerPlayer, lastMatch.duration);
          
          const outcomeP2 = lastMatch.winner === 'p2' ? 'WIN' : lastMatch.winner === 'p1' ? 'LOSS' : 'DRAW';
          const mutationP2 = calculateMutationRate(outcomeP2, lastMatch.p2Count, lastMatch.p1Count, initialPerPlayer, lastMatch.duration);

          try {
              // Evolve Both concurrently
              const [newDna1, newDna2] = await Promise.all([
                  evolveColonyDNA(activeProfileP1.dna, outcomeP1, lastMatch.p1Count, lastMatch.p2Count, activeProfileP2.dna, nextConfig, mutationP1),
                  evolveColonyDNA(activeProfileP2.dna, outcomeP2, lastMatch.p2Count, lastMatch.p1Count, activeProfileP1.dna, nextConfig, mutationP2)
              ]);

              // Trigger Phase 2 Visuals
              setEvolutionPhase('applying');
              setEvolutionStatus("APPLYING GENETIC MUTATIONS...");

              // Brief pause to let user see "Applying"
              await new Promise(r => setTimeout(r, 1500));

              // Update Pool
              setAiPool(prev => prev.map(p => {
                  if (p.id === activeProfileP1.id) return { ...p, dna: newDna1 };
                  if (p.id === activeProfileP2.id) return { ...p, dna: newDna2 };
                  return p;
              }));

              // Pick NEW combatants
              let nextAgent1 = activeProfileP1; // Fallback
              let nextAgent2 = activeProfileP2;

              setAiPool(currentPool => {
                  const idx1 = Math.floor(Math.random() * currentPool.length);
                  let idx2 = Math.floor(Math.random() * currentPool.length);
                  while (idx2 === idx1) idx2 = Math.floor(Math.random() * currentPool.length);

                  nextAgent1 = currentPool[idx1];
                  nextAgent2 = currentPool[idx2];
                  return currentPool;
              });

              // Transition to Arena
              setEvolutionStatus("MATCHMAKING COMPLETE");
              await new Promise(r => setTimeout(r, 500));
              
              setActiveProfileP1(nextAgent1);
              setActiveProfileP2(nextAgent2);
              
              setGameState(prev => ({ 
                  ...prev, 
                  player1: nextAgent1.dna, // Usually redundant if we updated pool, but safe
                  player2: nextAgent2.dna, 
                  activeScene: 'arena' 
              }));

          } catch (e) {
             console.error("Evolution failed", e);
             setGameState(prev => ({ ...prev, activeScene: 'arena' }));
          }
          return;
      }

      // --- CAMPAIGN MODE LOGIC ---
      if (!gameState.isAutoMode) {
          const nextOpponent = aiPool[Math.floor(Math.random() * aiPool.length)];
          setActiveProfileP2(nextOpponent);
          
          const outcome = lastMatch.winner === 'p1' ? 'WIN' : lastMatch.winner === 'p2' ? 'LOSS' : 'DRAW';
          const mutation = calculateMutationRate(outcome, lastMatch.p1Count, lastMatch.p2Count, arenaConfig.particleCount * 2, lastMatch.duration);
          
          try {
              const newP1DNA = await evolveColonyDNA(
                  gameState.player1, outcome, lastMatch.p1Count, lastMatch.p2Count, activeProfileP2!.dna, nextConfig, mutation
              );
              
              setEvolutionPhase('applying');
              setEvolutionStatus("RECONFIGURING DNA STRANDS...");
              
              await new Promise(r => setTimeout(r, 1500));
              
              setGameState(prev => ({ ...prev, player1: newP1DNA, player2: nextOpponent.dna, activeScene: 'arena' }));
          } catch (e) {
              setGameState(prev => ({ ...prev, player2: nextOpponent.dna, activeScene: 'arena' }));
          }
      }
  };

  // --- RENDER SCENES ---
  const renderScene = () => {
    switch (gameState.activeScene) {
      case 'leaderboard':
        return gameState.leaderboardData ? (
          <LeaderboardScene 
              matchResult={gameState.leaderboardData.lastMatch}
              p1Profile={gameState.leaderboardData.player1Profile}
              p2Profile={gameState.leaderboardData.player2Profile}
              aiPool={aiPool}
              onNext={handleLeaderboardNext}
              isAutoMode={gameState.isAutoMode}
          />
        ) : null;
      case 'evolution':
        return <EvolutionView 
            arenaConfig={arenaConfig} 
            statusMessage={evolutionStatus} 
            isDual={gameState.isAutoMode}
            p1Name={activeProfileP1?.dna.name}
            p2Name={activeProfileP2?.dna.name}
            phase={evolutionPhase}
        />;
      case 'arena':
        return (
          <Arena 
            p1DNA={gameState.player1} p2DNA={gameState.player2} isAutoMode={gameState.isAutoMode}
            onAutoMatchComplete={handleMatchComplete} onExit={handleBackToMenu} arenaConfig={arenaConfig}
          />
        );
      case 'training':
        return (
          <TrainingGround
            player={gameState.trainingPlayer}
            dna={gameState.trainingPlayer === 'player1' ? gameState.player1 : gameState.player2}
            onUpdateDNA={(dna) => updateDNA(gameState.trainingPlayer, dna)}
            onBack={handleBackToMenu}
            onReady={() => { 
                if(gameState.trainingPlayer === 'player1') setP1Ready(true);
                else setP2Ready(true);
                handleBackToMenu(); 
            }}
            isReady={gameState.trainingPlayer === 'player1' ? p1Ready : p2Ready}
          />
        );
      default: return null;
    }
  };

  // --- RENDER MENU / LOBBY ---
  const renderLocalLobby = () => (
    <div className="z-10 w-full max-w-6xl p-8 flex flex-col items-center">
        <header className="mb-12 text-center">
            <h2 className="text-6xl font-black brand-font text-white mb-2 text-glow-white tracking-tighter">LOCAL LOBBY</h2>
            <div className="h-1 w-32 bg-white mx-auto mb-4"></div>
            <p className="text-neutral-400 font-mono tracking-[0.3em] text-sm">MANUAL CONFIGURATION REQUIRED</p>
        </header>

        <div className="flex gap-16 mb-16 items-center">
            <div className={`w-80 cursor-pointer group transition-all duration-300 transform hover:-translate-y-2 hover:scale-105`} onClick={() => handleStartTraining('player1')}>
                 <div className={`relative h-96 glass-panel clip-tech-border p-1 flex flex-col ${p1Ready ? 'border-cyan-500 box-glow-cyan' : 'border-white/10 hover:border-cyan-500/50'}`}>
                     <div className="h-full bg-black/40 flex flex-col items-center justify-center p-6 text-center relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-2 text-[10px] font-mono text-neutral-600">P1_SYS</div>
                        <Cpu size={64} className={`mb-6 ${p1Ready ? 'text-cyan-400' : 'text-neutral-600'} transition-colors`} />
                        <h3 className="text-3xl font-bold text-white brand-font mb-2">PLAYER 1</h3>
                        <p className="text-cyan-200 font-mono text-xs mb-8 uppercase tracking-widest">{gameState.player1.name}</p>
                        <div className={`mt-auto px-6 py-2 border font-bold uppercase tracking-widest text-xs ${p1Ready ? 'bg-cyan-500 text-black border-cyan-500' : 'border-white/20 text-neutral-500'}`}>
                             {p1Ready ? 'READY' : 'CONFIGURE'}
                        </div>
                     </div>
                 </div>
            </div>
            <div className="text-8xl font-black italic text-white/10 font-orbitron select-none">VS</div>
            <div className={`w-80 cursor-pointer group transition-all duration-300 transform hover:-translate-y-2 hover:scale-105`} onClick={() => handleStartTraining('player2')}>
                 <div className={`relative h-96 glass-panel clip-tech-border p-1 flex flex-col ${p2Ready ? 'border-orange-500 box-glow-pink' : 'border-white/10 hover:border-orange-500/50'}`}>
                     <div className="h-full bg-black/40 flex flex-col items-center justify-center p-6 text-center relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-2 text-[10px] font-mono text-neutral-600">P2_SYS</div>
                        <Users size={64} className={`mb-6 ${p2Ready ? 'text-orange-400' : 'text-neutral-600'} transition-colors`} />
                        <h3 className="text-3xl font-bold text-white brand-font mb-2">PLAYER 2</h3>
                        <p className="text-orange-200 font-mono text-xs mb-8 uppercase tracking-widest">{gameState.player2.name}</p>
                        <div className={`mt-auto px-6 py-2 border font-bold uppercase tracking-widest text-xs ${p2Ready ? 'bg-orange-500 text-black border-orange-500' : 'border-white/20 text-neutral-500'}`}>
                             {p2Ready ? 'READY' : 'CONFIGURE'}
                        </div>
                     </div>
                 </div>
            </div>
        </div>

        <div className="flex gap-6 w-full max-w-lg">
             <Button variant="secondary" className="flex-1" onClick={() => setShowLocalLobby(false)}>CANCEL</Button>
             <Button variant="primary" className="flex-1" disabled={!p1Ready || !p2Ready} onClick={handleStartLocalMatch} icon={<Sword size={20} />}>
                INITIATE
             </Button>
        </div>
    </div>
  );

  const renderMainMenu = () => (
    <div className="z-10 w-full max-w-7xl p-8 relative flex items-center justify-between h-[80vh]">
        <div className="flex flex-col items-start justify-center space-y-8 max-w-2xl">
            <div className="relative">
                <div className="absolute -left-12 top-0 bottom-0 w-1 bg-gradient-to-b from-transparent via-cyan-500 to-transparent opacity-50"></div>
                <h1 className="text-[8rem] font-black text-white brand-font tracking-tighter italic leading-none" style={{ textShadow: "0 0 40px rgba(0,243,255,0.3)" }}>
                  XENO<span className="block text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-600 -mt-4">SWARM</span>
                </h1>
                <div className="flex items-center gap-4 mt-2 ml-2">
                    <span className="bg-cyan-500 text-black px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest">v3.1 Enhanced</span>
                    <p className="text-xl text-cyan-200 font-light tracking-[0.4em] uppercase brand-font">Particle Arena</p>
                </div>
            </div>
            
            <p className="text-neutral-400 font-mono max-w-md leading-relaxed border-l border-white/10 pl-4">
                Engineer the ultimate particle colony. Optimize DNA matrices for swarm behavior. 
                Experience the new Neural Evolution Engine.
            </p>

            <div className="flex gap-8 text-neutral-500 font-mono text-xs">
                <div className="flex items-center gap-2"><Globe size={14} /> <span>Global Ranking: Online</span></div>
                <div className="flex items-center gap-2"><ShieldAlert size={14} /> <span>Security: Max</span></div>
                <div className="flex items-center gap-2"><Activity size={14} /> <span>Ping: 12ms</span></div>
            </div>
        </div>

        <div className="w-[450px] relative perspective-[1000px] group/menu">
            <div className="absolute -inset-4 bg-gradient-to-r from-cyan-500/20 to-blue-600/20 blur-xl opacity-0 group-hover/menu:opacity-100 transition-opacity duration-1000 rounded-3xl"></div>
            <div className="relative bg-black/60 backdrop-blur-xl border border-white/10 p-8 clip-tech-border shadow-2xl flex flex-col gap-6 transform transition-transform duration-500 group-hover/menu:rotate-y-2">
                <div className="flex items-center justify-between border-b border-white/10 pb-4">
                    <div>
                        <div className="text-xs text-neutral-500 font-mono uppercase">Active Profile</div>
                        <div className="text-xl font-bold text-white brand-font">{gameState.player1.name}</div>
                    </div>
                    <div className="text-right">
                        <div className="text-xs text-neutral-500 font-mono uppercase">Score</div>
                        <div className="text-xl font-bold text-cyan-400 mono-font">{playerScore.toLocaleString()}</div>
                    </div>
                </div>

                <div className="space-y-4 py-4">
                    <Button size="lg" className="w-full text-lg shadow-[0_0_30px_rgba(6,182,212,0.2)]" onClick={() => handleStartTraining('player1')} icon={<Cpu size={20} />}>
                        {p1Ready ? 'EDIT COLONY' : 'ENGINEER COLONY'}
                    </Button>
                    <Button variant="secondary" size="lg" className="w-full" onClick={handleStartCombat} icon={<Sword size={20} />}>
                        QUICK MATCH (AI)
                    </Button>
                    <Button variant="danger" size="lg" className="w-full border-purple-500/50 text-purple-400 hover:text-white hover:border-purple-400" onClick={handleStartAutoMode} icon={<Infinity size={20} />}>
                        GAUNTLET MODE
                    </Button>
                    <Button variant="ghost" size="sm" className="w-full mt-4" onClick={() => setShowLocalLobby(true)} icon={<Gamepad2 size={16} />}>
                        LOCAL MULTIPLAYER
                    </Button>
                </div>
                
                <div className="text-center pt-4 border-t border-white/10">
                    <div className="text-[10px] text-neutral-600 font-mono uppercase tracking-widest">System Status: Optimal</div>
                </div>
            </div>
        </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#020203] flex items-center justify-center relative overflow-hidden">
      <div className="absolute inset-0 z-0 perspective-[1000px] pointer-events-none">
        <div className="absolute inset-0 bg-[linear-gradient(rgba(0,243,255,0.05)_2px,transparent_2px),linear-gradient(90deg,rgba(0,243,255,0.05)_2px,transparent_2px)] bg-[size:60px_60px] transform perspective-grid origin-top animate-grid opacity-30"></div>
        <div className="absolute inset-0 bg-gradient-to-b from-[#020203] via-transparent to-[#020203]"></div>
        <div className="absolute top-[20%] left-[20%] w-[500px] h-[500px] bg-cyan-900/10 rounded-full blur-[120px] animate-pulse"></div>
        <div className="absolute bottom-[10%] right-[10%] w-[600px] h-[600px] bg-purple-900/10 rounded-full blur-[120px] animate-pulse" style={{ animationDelay: '2s' }}></div>
      </div>
      
      <SceneTransition sceneKey={showLocalLobby ? 'lobby' : gameState.activeScene}>
         {gameState.activeScene === 'menu' && (showLocalLobby ? renderLocalLobby() : renderMainMenu())}
         {gameState.activeScene !== 'menu' && renderScene()}
      </SceneTransition>
    </div>
  );
};

export default App;