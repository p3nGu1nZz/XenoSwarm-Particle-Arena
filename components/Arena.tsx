import React, { useState, useEffect, useRef } from 'react';
import { ColonyDNA, MatchResult, ArenaConfig } from '../types';
import { DEFAULT_ARENA_CONFIG } from '../constants';
import SimulationView from './SimulationView';
import Button from './Button';
import Leaderboard from './Leaderboard';
import { RefreshCw, Trophy, Home, Skull, Clock, BrainCircuit, Wind, Zap, Users, ShieldAlert } from 'lucide-react';

interface Props {
  p1DNA: ColonyDNA;
  p2DNA: ColonyDNA;
  onExit: () => void;
  isAutoMode?: boolean;
  matchHistory?: MatchResult[];
  onAutoMatchComplete?: (stats: { p1: number, p2: number, winner: 'p1' | 'p2' | 'draw', duration: number }) => void;
  arenaConfig?: ArenaConfig;
}

type MatchStatus = 'countdown' | 'active' | 'finished';

const Arena: React.FC<Props> = ({ 
  p1DNA, 
  p2DNA, 
  onExit, 
  isAutoMode = false, 
  matchHistory = [],
  onAutoMatchComplete,
  arenaConfig = DEFAULT_ARENA_CONFIG
}) => {
  const [stats, setStats] = useState({ p1: 0, p2: 0, p1Escaped: 0, p2Escaped: 0, fps: 0 });
  const [winner, setWinner] = useState<'p1' | 'p2' | 'draw' | null>(null);
  const [rematchKey, setRematchKey] = useState(0);
  const [timeLeft, setTimeLeft] = useState(90);
  
  // New States for Flow Control
  const [matchStatus, setMatchStatus] = useState<MatchStatus>('countdown');
  const [countdown, setCountdown] = useState(3);
  
  // AI Tactics State (for visual and logic)
  const tacticsRef = useRef({ p1Retreat: false, p2Retreat: false });
  const [tacticsDisplay, setTacticsDisplay] = useState({ p1Retreat: false, p2Retreat: false });

  const statsRef = useRef(stats);
  const hasTriggeredAutoEnd = useRef(false);

  useEffect(() => {
    statsRef.current = stats;
  }, [stats]);

  const handleStats = (p1: number, p2: number, p1Escaped: number, p2Escaped: number, fps: number) => {
    setStats({ p1, p2, p1Escaped, p2Escaped, fps });
    
    // Win Condition logic - ONLY when active
    if (matchStatus === 'active' && !winner) {
        
        // 1. Instant Loss Condition (Annihilation)
        if (p1 === 0 && p2 > 0) {
            setWinner('p2');
            setMatchStatus('finished');
            return;
        }
        if (p2 === 0 && p1 > 0) {
            setWinner('p1');
            setMatchStatus('finished');
            return;
        }

        const total = p1 + p2;
        // Wait for initial spawn stabilization (e.g. first few seconds)
        if (total > 50) {
           const initialCount = arenaConfig.particleCount * 2;

           // 2. Aggressive Victory (2x advantage + Net Growth via capture)
           // If a player has doubled the opponent AND has more particles than they started with.
           // This rewards aggressive conversion over just hiding.
           if (p1 > p2 * 2.0 && p1 > initialCount) {
              setWinner('p1');
              setMatchStatus('finished');
              return;
           }
           if (p2 > p1 * 2.0 && p2 > initialCount) {
              setWinner('p2');
              setMatchStatus('finished');
              return;
           }

           // 3. Dominance / Mercy Rule (3x size difference)
           // If one player is just crushing the other, end it regardless of growth.
           if (p1 > p2 * 3.0) {
              setWinner('p1');
              setMatchStatus('finished');
              return;
           } 
           if (p2 > p1 * 3.0) {
              setWinner('p2');
              setMatchStatus('finished');
              return;
           }
        }
    }
  };

  // Reset state on rematch (or new round in auto)
  useEffect(() => {
    setTimeLeft(90);
    setWinner(null);
    hasTriggeredAutoEnd.current = false;
    tacticsRef.current = { p1Retreat: false, p2Retreat: false };
    setTacticsDisplay({ p1Retreat: false, p2Retreat: false });
    
    // Initialize Countdown
    setMatchStatus('countdown');
    setCountdown(3);
  }, [rematchKey, p1DNA, p2DNA]);

  // AI Tactics Loop (Scouting/Retreat Behavior)
  useEffect(() => {
    if (!isAutoMode || matchStatus !== 'active') return;

    const interval = setInterval(() => {
       const { p1, p2 } = statsRef.current;
       
       // P1 Scouting Logic
       // If outnumbered by 1.5x, 30% chance to retreat temporarily to regroup/scout
       if (p2 > p1 * 1.5 && !tacticsRef.current.p1Retreat) {
           if (Math.random() < 0.3) {
               tacticsRef.current.p1Retreat = true;
               setTacticsDisplay(prev => ({ ...prev, p1Retreat: true }));
               
               // Retreat for 2-4 seconds
               setTimeout(() => {
                   tacticsRef.current.p1Retreat = false;
                   setTacticsDisplay(prev => ({ ...prev, p1Retreat: false }));
               }, 2000 + Math.random() * 2000);
           }
       }

       // P2 Scouting Logic
       if (p1 > p2 * 1.5 && !tacticsRef.current.p2Retreat) {
           if (Math.random() < 0.3) {
               tacticsRef.current.p2Retreat = true;
               setTacticsDisplay(prev => ({ ...prev, p2Retreat: true }));
               
               setTimeout(() => {
                   tacticsRef.current.p2Retreat = false;
                   setTacticsDisplay(prev => ({ ...prev, p2Retreat: false }));
               }, 2000 + Math.random() * 2000);
           }
       }
    }, 1000);

    return () => clearInterval(interval);
  }, [isAutoMode, matchStatus]);

  // Countdown Logic
  useEffect(() => {
    if (matchStatus !== 'countdown') return;

    if (countdown > 0) {
        const timer = setTimeout(() => setCountdown(c => c - 1), 1000);
        return () => clearTimeout(timer);
    } else {
        setMatchStatus('active');
    }
  }, [matchStatus, countdown]);

  // Timer Logic
  useEffect(() => {
    if (matchStatus !== 'active' || winner) return;
    
    const timer = setInterval(() => {
        setTimeLeft(prev => {
            if (prev <= 1) {
                clearInterval(timer);
                const s = statsRef.current;
                const total = s.p1 + s.p2;
                const diff = Math.abs(s.p1 - s.p2);
                
                let w: 'p1' | 'p2' | 'draw' = 'draw';
                
                // STALEMATE DETECTION
                // If the difference is less than 10% of the total, declare a DRAW.
                // This prevents "boring" wins where one player has 1 more particle.
                if (total > 0 && (diff / total) < 0.10) {
                   w = 'draw';
                } else {
                   if (s.p1 > s.p2) w = 'p1';
                   else if (s.p2 > s.p1) w = 'p2';
                }
                
                setWinner(w);
                setMatchStatus('finished');
                return 0;
            }
            return prev - 1;
        });
    }, 1000);
    return () => clearInterval(timer);
  }, [matchStatus, winner, rematchKey]);

  // Handle Auto Mode Completion
  useEffect(() => {
    if (isAutoMode && winner && !hasTriggeredAutoEnd.current) {
        hasTriggeredAutoEnd.current = true;
        
        // Wait 2 seconds so user can see the "Winner" overlay briefly before transition
        setTimeout(() => {
           onAutoMatchComplete?.({
               p1: statsRef.current.p1,
               p2: statsRef.current.p2,
               winner: winner,
               duration: 90 - timeLeft
           });
        }, 2000);
    }
  }, [winner, isAutoMode, onAutoMatchComplete, timeLeft]);

  const handleRematch = () => {
    setWinner(null);
    setRematchKey(prev => prev + 1);
  };

  const getBarWidth = (count: number, total: number) => {
    if (total === 0) return '50%';
    return `${(count / total) * 100}%`;
  };

  const totalParticles = stats.p1 + stats.p2;
  const timeString = `${Math.floor(timeLeft / 60)}:${(timeLeft % 60).toString().padStart(2, '0')}`;

  return (
    <div className="relative w-full h-screen bg-[#050505] overflow-hidden flex flex-col">
      
      {/* HUD Header */}
      <div className="h-28 w-full bg-[#0a0a0a] border-b border-white/10 flex items-center justify-between px-8 z-20">
         {/* Player 1 Stats */}
         <div className="flex flex-col items-start w-72 relative">
            <h3 className="text-cyan-400 font-bold text-xl brand-font truncate w-full">{p1DNA.name}</h3>
            <span className="text-neutral-500 text-xs uppercase tracking-widest flex items-center gap-2">
                Player 1 {isAutoMode && <BrainCircuit size={12} className="text-cyan-500 animate-pulse"/>}
            </span>
            <div className="flex items-baseline gap-4 mt-1">
                <div className="text-4xl font-mono font-bold text-white">{stats.p1}</div>
                {stats.p1Escaped > 0 && (
                  <div className="flex items-center text-red-900 text-xs font-mono" title="Lost to Void">
                    <Skull size={12} className="mr-1"/> -{stats.p1Escaped}
                  </div>
                )}
            </div>
            {tacticsDisplay.p1Retreat && (
                <div className="absolute top-full left-0 mt-2 bg-red-500/20 border border-red-500/50 text-red-400 px-2 py-1 text-[10px] uppercase font-bold tracking-wider rounded flex items-center gap-1 animate-pulse">
                    <ShieldAlert size={10} /> Scouting / Retreating
                </div>
            )}
         </div>

         {/* Center Bar & Environment Info */}
         <div className="flex-1 max-w-2xl mx-8 flex flex-col items-center">
            <div className="flex items-center gap-2 bg-neutral-900 border border-white/10 px-4 py-1 rounded-full mb-2">
                 <Clock size={14} className={timeLeft < 10 ? 'text-red-500 animate-pulse' : 'text-neutral-400'} />
                 <span className={`font-mono font-bold text-xl ${timeLeft < 10 ? 'text-red-500' : 'text-white'}`}>
                    {timeString}
                 </span>
            </div>
            
            <div className="w-full">
                <div className="flex justify-between text-xs text-neutral-400 mb-1 font-mono uppercase">
                <span>Dominance</span>
                <span>{stats.fps} FPS</span>
                </div>
                <div className="h-4 bg-neutral-800 rounded-full overflow-hidden flex border border-white/10 relative">
                  <div className="h-full bg-cyan-600 transition-all duration-500" style={{ width: getBarWidth(stats.p1, totalParticles) }}></div>
                  <div className="h-full bg-orange-600 transition-all duration-500" style={{ width: getBarWidth(stats.p2, totalParticles) }}></div>
                  <div className="absolute left-1/2 top-0 bottom-0 w-0.5 bg-white/50 transform -translate-x-1/2"></div>
                </div>
            </div>

            {/* Dynamic Environment Indicators */}
            {isAutoMode && (
              <div className="flex gap-4 mt-2 text-[10px] uppercase font-bold tracking-widest text-neutral-500 bg-black/40 px-3 py-1 rounded border border-white/5">
                 <div className="flex items-center gap-1" title="Particle Density">
                   <Users size={10} className="text-purple-400"/> {arenaConfig.particleCount}
                 </div>
                 <div className="flex items-center gap-1" title="Environment Type">
                   <Wind size={10} className="text-blue-400"/> {arenaConfig.environmentName}
                 </div>
                 <div className="flex items-center gap-1" title="Force Strength">
                   <Zap size={10} className="text-yellow-400"/> {arenaConfig.forceMultiplier.toFixed(1)}x
                 </div>
              </div>
            )}
         </div>

         {/* Player 2 Stats */}
         <div className="flex flex-col items-end w-72 relative">
            <h3 className="text-orange-400 font-bold text-xl brand-font truncate w-full text-right">{p2DNA.name}</h3>
            <span className="text-neutral-500 text-xs uppercase tracking-widest flex items-center gap-2">
                {isAutoMode && <BrainCircuit size={12} className="text-orange-500 animate-pulse"/>} Player 2
            </span>
            <div className="flex items-baseline gap-4 mt-1">
                {stats.p2Escaped > 0 && (
                  <div className="flex items-center text-red-900 text-xs font-mono" title="Lost to Void">
                     -{stats.p2Escaped} <Skull size={12} className="ml-1"/>
                  </div>
                )}
                <div className="text-4xl font-mono font-bold text-white">{stats.p2}</div>
            </div>
            {tacticsDisplay.p2Retreat && (
                <div className="absolute top-full right-0 mt-2 bg-red-500/20 border border-red-500/50 text-red-400 px-2 py-1 text-[10px] uppercase font-bold tracking-wider rounded flex items-center gap-1 animate-pulse">
                     Scouting / Retreating <ShieldAlert size={10} />
                </div>
            )}
         </div>
      </div>

      {/* Main Arena */}
      <div className="flex-1 relative flex items-center justify-center bg-neutral-950 min-h-0">
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:100px_100px] pointer-events-none"></div>

        {isAutoMode && (
            <div className="absolute left-4 top-4 bottom-4 w-80 z-30 opacity-80 hover:opacity-100 transition-opacity hidden xl:block">
                <Leaderboard history={matchHistory} />
            </div>
        )}

        <div className="w-full h-full p-4">
             <SimulationView 
                key={rematchKey} 
                mode="arena" 
                player1DNA={p1DNA} 
                player2DNA={p2DNA} 
                onStatsUpdate={handleStats}
                arenaConfig={arenaConfig}
                paused={matchStatus !== 'active'}
                p1Retreat={tacticsDisplay.p1Retreat}
                p2Retreat={tacticsDisplay.p2Retreat}
             />
        </div>

        {/* Countdown Overlay */}
        {matchStatus === 'countdown' && (
           <div className="absolute inset-0 flex items-center justify-center z-50 pointer-events-none bg-black/20">
              <div className="flex flex-col items-center justify-center animate-bounce-short">
                  <div className="text-[12rem] leading-none font-bold text-white brand-font drop-shadow-[0_0_50px_rgba(255,255,255,0.5)]">
                     {countdown}
                  </div>
                  <div className="text-2xl font-mono text-cyan-400 tracking-[1em] uppercase">Initialize</div>
              </div>
           </div>
        )}

        {/* Winner / Status Overlay */}
        {winner && (
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center animate-in fade-in duration-500">
             
             {/* STANDARD / RESULT OVERLAY */}
             <div className="bg-neutral-900 border border-white/10 p-12 rounded-2xl flex flex-col items-center shadow-2xl text-center max-w-lg w-full">
                {winner === 'draw' ? (
                <RefreshCw size={64} className="text-white mb-6" />
                ) : (
                <Trophy size={64} className={winner === 'p1' ? 'text-cyan-400 mb-6' : 'text-orange-400 mb-6'} />
                )}
                
                <h2 className="text-6xl font-bold brand-font mb-2 text-white">
                {winner === 'p1' ? 'PLAYER 1 WINS' : winner === 'p2' ? 'PLAYER 2 WINS' : 'STALEMATE'}
                </h2>
                <p className="text-xl text-neutral-400 mb-8">
                {winner === 'draw' 
                    ? "Time expired. The forces are evenly matched." 
                    : `The ${winner === 'p1' ? p1DNA.name : p2DNA.name} has consumed the enemy swarm.`
                }
                </p>
                
                {!isAutoMode && (
                    <div className="flex gap-4 w-full">
                    <Button variant="secondary" onClick={onExit} icon={<Home size={18}/>} className="flex-1">
                        Return to Lobby
                    </Button>
                    <Button variant="primary" onClick={handleRematch} icon={<RefreshCw size={18}/>} className="flex-1">
                        Rematch
                    </Button>
                    </div>
                )}
                {isAutoMode && (
                    <p className="text-sm text-neutral-500 animate-pulse">Initializing Evolution Sequence...</p>
                )}
             </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Arena;