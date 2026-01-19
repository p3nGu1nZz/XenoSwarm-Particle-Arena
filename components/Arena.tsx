import React, { useState, useEffect, useRef } from 'react';
import { ColonyDNA, MatchResult, ArenaConfig } from '../types';
import { DEFAULT_ARENA_CONFIG } from '../constants';
import SimulationView from './SimulationView';
import { soundManager } from '../services/SoundService';
import { Volume2, VolumeX, AlertOctagon, Activity, Swords, Shield } from 'lucide-react';

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
  onAutoMatchComplete,
  arenaConfig = DEFAULT_ARENA_CONFIG
}) => {
  const [stats, setStats] = useState({ p1: 0, p2: 0, p1Escaped: 0, p2Escaped: 0, fps: 0 });
  const [winner, setWinner] = useState<'p1' | 'p2' | 'draw' | null>(null);
  const [rematchKey, setRematchKey] = useState(0);
  const [timeLeft, setTimeLeft] = useState(90);
  
  const [matchStatus, setMatchStatus] = useState<MatchStatus>('countdown');
  const [countdown, setCountdown] = useState(3);
  const [soundEnabled, setSoundEnabled] = useState(soundManager.enabled);
  const [isStagnated, setIsStagnated] = useState(false);
  
  const tacticsRef = useRef({ 
      p1Retreat: false, 
      p2Retreat: false,
      p1Aggressive: false,
      p2Aggressive: false 
  });
  
  const [tacticsDisplay, setTacticsDisplay] = useState({ 
      p1Retreat: false, 
      p2Retreat: false,
      p1Aggressive: false,
      p2Aggressive: false
  });

  const statsRef = useRef(stats);
  const timeLeftRef = useRef(90); 
  const stagnationCounterRef = useRef<number>(0);
  const distanceHistoryRef = useRef<number[]>([]);
  const lastPopCountRef = useRef<number>(0);
  const hasTriggeredAutoEnd = useRef(false);

  useEffect(() => {
    soundManager.initialize();
  }, []);

  const toggleSound = () => {
    const newState = !soundEnabled;
    setSoundEnabled(newState);
    soundManager.toggle(newState);
  };

  useEffect(() => {
    statsRef.current = stats;
  }, [stats]);

  useEffect(() => {
    timeLeftRef.current = timeLeft;
  }, [timeLeft]);

  const handleStats = (p1: number, p2: number, p1Escaped: number, p2Escaped: number, fps: number, centroidDist: number, avgSpeed: number) => {
    setStats({ p1, p2, p1Escaped, p2Escaped, fps });
    
    if (matchStatus === 'active') {
        const popChanged = Math.abs(p1 - lastPopCountRef.current) > 1; // Tolerance
        lastPopCountRef.current = p1;
        const elapsedTime = 90 - timeLeftRef.current;

        // Stagnation Detection Logic
        // Only start checking stagnation after 10 seconds to allow initial deployment
        if (elapsedTime > 10) {
            if (popChanged) {
                stagnationCounterRef.current = Math.max(0, stagnationCounterRef.current - 1);
            } else {
                const history = distanceHistoryRef.current;
                history.push(centroidDist);
                if (history.length > 20) history.shift(); 

                // Calculate variance in centroid distance to detect movement
                let variance = 0;
                if (history.length > 5) {
                    const mean = history.reduce((a, b) => a + b, 0) / history.length;
                    variance = history.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / history.length;
                }

                // Low variance AND reasonable distance means they are stuck staring at each other
                if (variance < 50 && centroidDist > 100) {
                    stagnationCounterRef.current += 0.5;
                } else if (avgSpeed < 0.3) {
                    stagnationCounterRef.current += 0.2;
                } else {
                    stagnationCounterRef.current = Math.max(0, stagnationCounterRef.current - 0.1);
                }
            }

            if (stagnationCounterRef.current > 10) {
                setIsStagnated(true);
            } else if (stagnationCounterRef.current < 3) {
                setIsStagnated(false);
            }
        }
    }

    if (matchStatus === 'active' && !winner) {
        // Absolute Wipeout Condition (Instant End)
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
        const elapsedTime = 90 - timeLeftRef.current;

        // Mercy Rule / Decimation Logic
        // We add a Grace Period of 15 seconds where we don't call mercy 
        // to prevent bad spawns from ending the game instantly.
        if (elapsedTime > 15 && total > 50) {
           const initialCount = arenaConfig.particleCount * 2;
           
           // If one side has 4x the other, call it.
           if (p1 > p2 * 4.0) { setWinner('p1'); setMatchStatus('finished'); return; }
           if (p2 > p1 * 4.0) { setWinner('p2'); setMatchStatus('finished'); return; }
        }
    }
  };

  useEffect(() => {
    setTimeLeft(90);
    setWinner(null);
    hasTriggeredAutoEnd.current = false;
    tacticsRef.current = { p1Retreat: false, p2Retreat: false, p1Aggressive: false, p2Aggressive: false };
    setTacticsDisplay({ p1Retreat: false, p2Retreat: false, p1Aggressive: false, p2Aggressive: false });
    setIsStagnated(false);
    stagnationCounterRef.current = 0;
    distanceHistoryRef.current = [];
    lastPopCountRef.current = 0;
    setMatchStatus('countdown');
    setCountdown(3);
  }, [rematchKey, p1DNA, p2DNA]);

  // AI STRATEGY LOOP
  useEffect(() => {
    if (!isAutoMode || matchStatus !== 'active') return;

    const interval = setInterval(() => {
       const s = statsRef.current;
       const p1Count = s.p1;
       const p2Count = s.p2;
       const isStuck = stagnationCounterRef.current > 6;
       
       const decideTactics = (myCount: number, enemyCount: number) => {
           const ratio = myCount / (enemyCount + 1);
           let agg = false;
           let ret = false;
           
           if (isStuck) {
               // STAGNATION BREAKER: FLANKING MANEUVER
               // Oscillate between Retreat (Spread) and Aggressive (Collapse)
               const cycle = Date.now() % 5000;
               if (cycle < 2000) {
                   ret = true; // Spread out to flank/surround
               } else {
                   agg = true; // Collapse on center
               }
           } else {
               // DYNAMIC COMBAT
               if (ratio > 1.25) {
                   // Winning: Press advantage
                   agg = true;
               } else if (ratio < 0.75) {
                   // Losing: Guerilla Tactics
                   // Retreat to lure, then snap back
                   const cycle = Date.now() % 4000;
                   if (cycle < 2000) ret = true;
                   else agg = true;
               } else {
                   // Even Match: Probing Attacks
                   const cycle = Date.now() % 3000;
                   if (cycle > 2000) agg = true;
               }
           }
           return { agg, ret };
       };

       const p1T = decideTactics(p1Count, p2Count);
       const p2T = decideTactics(p2Count, p1Count);

       tacticsRef.current = {
           p1Aggressive: p1T.agg,
           p1Retreat: p1T.ret,
           p2Aggressive: p2T.agg,
           p2Retreat: p2T.ret
       };

       setTacticsDisplay({
           p1Aggressive: p1T.agg,
           p1Retreat: p1T.ret,
           p2Aggressive: p2T.agg,
           p2Retreat: p2T.ret
       });

    }, 500); // Fast reaction time
    return () => clearInterval(interval);
  }, [isAutoMode, matchStatus]);

  useEffect(() => {
    if (matchStatus !== 'countdown') return;
    if (countdown > 0) {
        const timer = setTimeout(() => setCountdown(c => c - 1), 1000);
        return () => clearTimeout(timer);
    } else {
        setMatchStatus('active');
    }
  }, [matchStatus, countdown]);

  useEffect(() => {
    if (matchStatus !== 'active' || winner) return;
    const timer = setInterval(() => {
        setTimeLeft(prev => {
            if (prev <= 1) {
                clearInterval(timer);
                const s = statsRef.current;
                let w: 'p1' | 'p2' | 'draw' = 'draw';
                if (s.p1 > s.p2) w = 'p1';
                else if (s.p2 > s.p1) w = 'p2';
                setWinner(w);
                setMatchStatus('finished');
                return 0;
            }
            return prev - 1;
        });
    }, 1000);
    return () => clearInterval(timer);
  }, [matchStatus, winner, rematchKey]);

  useEffect(() => {
    if (matchStatus === 'finished' && winner && !hasTriggeredAutoEnd.current) {
        hasTriggeredAutoEnd.current = true;
        setTimeout(() => {
           onAutoMatchComplete?.({
               p1: statsRef.current.p1,
               p2: statsRef.current.p2,
               winner: winner,
               duration: 90 - timeLeft
           });
        }, 3000);
    }
  }, [matchStatus, winner, isAutoMode, onAutoMatchComplete, timeLeft]);

  const getBarWidth = (count: number, total: number) => {
    if (total === 0) return '50%';
    return `${(count / total) * 100}%`;
  };

  const totalParticles = stats.p1 + stats.p2;
  const timeString = timeLeft.toString();
  const isDangerTime = timeLeft <= 10;

  return (
    <div className="relative w-full h-screen bg-[#020203] overflow-hidden flex flex-col font-sans select-none">
      
      {/* HUD Header */}
      <div className="absolute top-0 left-0 w-full z-20 pointer-events-none flex justify-between items-start p-6">
         
         {/* Player 1 Stats */}
         <div className="flex flex-col items-start gap-2 pointer-events-auto">
            <div className="flex items-center gap-4 bg-black/40 backdrop-blur-xl border border-cyan-500/30 p-4 clip-tech-border min-w-[340px] shadow-lg transition-all duration-300">
                <div className="flex flex-col items-center justify-center border-r border-white/10 pr-4 w-24">
                    {/* Fixed Width for Score to prevent jitter */}
                    <span className="text-4xl font-black text-cyan-400 brand-font leading-none tabular-nums text-center w-full block">
                        {stats.p1}
                    </span>
                    <span className="text-[10px] uppercase tracking-widest text-neutral-500 mt-1">Units</span>
                </div>
                <div className="flex-1">
                    <h3 className="text-white font-bold brand-font text-lg truncate max-w-[200px]">
                        {p1DNA.name}
                    </h3>
                    <div className="flex items-center gap-2 mt-1 h-5">
                        {tacticsDisplay.p1Retreat && (
                            <span className="flex items-center gap-1 bg-red-500/20 text-red-400 px-2 py-0.5 rounded text-[10px] font-bold uppercase animate-pulse border border-red-500/50">
                                <Shield size={10} /> Regrouping
                            </span>
                        )}
                        {tacticsDisplay.p1Aggressive && (
                            <span className="flex items-center gap-1 bg-yellow-500/20 text-yellow-400 px-2 py-0.5 rounded text-[10px] font-bold uppercase animate-pulse border border-yellow-500/50">
                                <Swords size={10} /> Berserk
                            </span>
                        )}
                    </div>
                </div>
            </div>
            <div className="w-full h-2 bg-neutral-900 border border-white/10 relative overflow-hidden skew-x-[-15deg]">
                <div className="absolute top-0 left-0 h-full bg-cyan-500 shadow-[0_0_10px_#00f3ff] transition-all duration-300" style={{ width: `${Math.min(100, (stats.p1 / (arenaConfig.particleCount * 2)) * 100)}%` }}></div>
            </div>
         </div>

         {/* Center Clock */}
         <div className="flex flex-col items-center pointer-events-auto mt-2">
             <div className="relative">
                 <div className="absolute inset-0 bg-black/60 blur-md rounded-full"></div>
                 <div className={`relative text-5xl font-black brand-font tracking-tighter w-32 text-center tabular-nums ${isDangerTime ? 'text-red-500 animate-pulse' : 'text-white'}`}>
                    {timeString}
                 </div>
             </div>
             <button 
                onClick={toggleSound}
                className="mt-4 p-2 rounded-full bg-white/5 hover:bg-white/10 text-neutral-400 hover:text-white transition-colors"
             >
                {soundEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
             </button>
         </div>

         {/* Player 2 Stats */}
         <div className="flex flex-col items-end gap-2 pointer-events-auto text-right">
            <div className="flex flex-row-reverse items-center gap-4 bg-black/40 backdrop-blur-xl border border-pink-500/30 p-4 clip-tech-border min-w-[340px] shadow-lg transform scale-x-[-1] transition-all duration-300">
                <div className="flex flex-col items-center justify-center border-r border-white/10 pr-4 transform scale-x-[-1] w-24">
                    {/* Fixed Width for Score */}
                    <span className="text-4xl font-black text-pink-400 brand-font leading-none tabular-nums text-center w-full block">
                        {stats.p2}
                    </span>
                    <span className="text-[10px] uppercase tracking-widest text-neutral-500 mt-1">Units</span>
                </div>
                <div className="flex-1 transform scale-x-[-1]">
                    <h3 className="text-white font-bold brand-font text-lg truncate max-w-[200px]">
                        {p2DNA.name}
                    </h3>
                    <div className="flex flex-row-reverse items-center gap-2 mt-1 h-5">
                        {tacticsDisplay.p2Retreat && (
                            <span className="flex items-center gap-1 bg-red-500/20 text-red-400 px-2 py-0.5 rounded text-[10px] font-bold uppercase animate-pulse border border-red-500/50">
                                <Shield size={10} /> Regrouping
                            </span>
                        )}
                        {tacticsDisplay.p2Aggressive && (
                            <span className="flex items-center gap-1 bg-yellow-500/20 text-yellow-400 px-2 py-0.5 rounded text-[10px] font-bold uppercase animate-pulse border border-yellow-500/50">
                                <Swords size={10} /> Berserk
                            </span>
                        )}
                    </div>
                </div>
            </div>
            <div className="w-full h-2 bg-neutral-900 border border-white/10 relative overflow-hidden skew-x-[15deg]">
                <div className="absolute top-0 right-0 h-full bg-pink-500 shadow-[0_0_10px_#ff0055] transition-all duration-300" style={{ width: `${Math.min(100, (stats.p2 / (arenaConfig.particleCount * 2)) * 100)}%` }}></div>
            </div>
         </div>
      </div>

      {isStagnated && matchStatus === 'active' && (
          <div className="absolute top-32 left-1/2 -translate-x-1/2 z-30 pointer-events-none">
             <div className="flex items-center gap-3 bg-red-900/60 border border-red-500/50 text-red-100 px-8 py-3 font-bold uppercase tracking-widest animate-pulse backdrop-blur-md shadow-[0_0_20px_rgba(239,68,68,0.4)] clip-tech-border">
                 <AlertOctagon size={24} /> STAGNATION DETECTED // FLANKING PROTOCOLS ENGAGED
             </div>
          </div>
      )}

      {/* Footer Status */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 w-[600px] z-20 pointer-events-none">
           <div className="flex justify-between items-center text-[10px] font-mono text-neutral-500 mb-2 uppercase tracking-widest">
               <span>Power Balance</span>
               <span className="flex items-center gap-2"><Activity size={12}/> {stats.fps} FPS</span>
           </div>
           <div className="h-1 bg-white/10 w-full relative">
                <div className="absolute top-0 left-0 bottom-0 bg-cyan-500 blur-[2px] transition-all duration-500" style={{ width: getBarWidth(stats.p1, totalParticles) }}></div>
                <div className="absolute top-0 right-0 bottom-0 bg-pink-500 blur-[2px] transition-all duration-500" style={{ width: getBarWidth(stats.p2, totalParticles) }}></div>
                <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-1 h-3 bg-white"></div>
           </div>
      </div>

      {/* Main View */}
      <div className="flex-1 relative flex items-center justify-center bg-neutral-950 min-h-0">
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
            p1Aggressive={tacticsDisplay.p1Aggressive}
            p2Aggressive={tacticsDisplay.p2Aggressive}
        />

        {matchStatus === 'countdown' && (
           <div className="absolute inset-0 flex items-center justify-center z-50 pointer-events-none bg-black/40 backdrop-blur-sm">
              <div className="flex flex-col items-center justify-center animate-pulse">
                  <div className="text-[15rem] leading-none font-black text-transparent bg-clip-text bg-gradient-to-b from-white to-neutral-600 brand-font" style={{ textShadow: "0 0 50px rgba(255,255,255,0.5)" }}>
                     {countdown}
                  </div>
                  <div className="text-xl font-mono text-cyan-400 tracking-[1.5em] uppercase mt-8 border-t border-cyan-500/50 pt-4">INITIALIZING COMBAT</div>
              </div>
           </div>
        )}

        {winner && matchStatus === 'finished' && (
          <div className="absolute inset-0 bg-black/80 backdrop-blur-xl z-50 flex items-center justify-center animate-in fade-in duration-700">
             <div className="text-center relative">
                 <div className="absolute -inset-20 bg-gradient-to-r from-cyan-500/20 to-purple-500/20 blur-[100px] rounded-full"></div>
                 <h2 className="relative text-9xl font-black brand-font mb-4 text-white tracking-wide animate-pulse italic">
                    {winner === 'p1' ? 'VICTORY' : winner === 'p2' ? 'DEFEAT' : 'DRAW'}
                 </h2>
                 <p className="relative text-cyan-400 mono-font tracking-widest text-lg border-t border-b border-white/10 py-4">COMPILING BATTLE METRICS...</p>
             </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Arena;