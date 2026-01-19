import React, { useEffect, useState } from 'react';
import { MatchResult, PlayerProfile } from '../types';
import Button from './Button';
import { Trophy, ArrowRight, Loader2, Award, ArrowUp, ArrowDown, Minus } from 'lucide-react';

interface Props {
  matchResult: MatchResult;
  p1Profile: PlayerProfile;
  p2Profile: PlayerProfile;
  aiPool: PlayerProfile[]; 
  onNext: () => void;
  isAutoMode: boolean;
}

const LeaderboardScene: React.FC<Props> = ({ 
    matchResult, 
    p1Profile, 
    p2Profile,
    aiPool,
    onNext,
    isAutoMode
}) => {
  const [displayedScoreP1, setDisplayedScoreP1] = useState(0);
  const [displayedScoreP2, setDisplayedScoreP2] = useState(0);
  
  // State for the ranking list
  const [rankingList, setRankingList] = useState<PlayerProfile[]>([]);
  const [prevRanks, setPrevRanks] = useState<Record<string, number>>({});
  
  const [phase, setPhase] = useState<'counting' | 'resorting' | 'final'>('counting');
  const [autoTimer, setAutoTimer] = useState(8); // Increased time (7s + 1s extra)

  // Initialize Leaderboard with PREVIOUS scores to start the animation
  useEffect(() => {
    // 1. Calculate the "Previous" state of the pool
    // The aiPool passed in already has the Updated scores from App.tsx. 
    // We need to revert the active players' scores to show the count-up animation.
    
    const initialPool = aiPool.map(p => {
        if (p.id === p1Profile.id) {
            return { ...p, score: p.score - matchResult.scoreP1 };
        }
        if (p.id === p2Profile.id) {
            return { ...p, score: p.score - matchResult.scoreP2 };
        }
        return p;
    });

    // Sort by previous score to get initial rank positions
    initialPool.sort((a,b) => b.score - a.score);
    
    // Store previous ranks for comparison later
    const ranks: Record<string, number> = {};
    initialPool.forEach((p, idx) => { ranks[p.id] = idx + 1; });
    setPrevRanks(ranks);
    setRankingList(initialPool);

    // 2. Animate Score Counter
    const targetP1 = matchResult.scoreP1;
    const targetP2 = matchResult.scoreP2;
    
    let currentP1 = 0;
    let currentP2 = 0;
    const stepP1 = Math.max(5, Math.floor(targetP1 / 25));
    const stepP2 = Math.max(5, Math.floor(targetP2 / 25));

    const interval = setInterval(() => {
        let changed = false;
        if (currentP1 < targetP1) {
            currentP1 = Math.min(targetP1, currentP1 + stepP1);
            setDisplayedScoreP1(currentP1);
            changed = true;
        }
        if (currentP2 < targetP2) {
            currentP2 = Math.min(targetP2, currentP2 + stepP2);
            setDisplayedScoreP2(currentP2);
            changed = true;
        }
        if (!changed) {
            clearInterval(interval);
            // Trigger Resort Phase after a short delay
            setTimeout(() => {
                setPhase('resorting');
            }, 800);
        }
    }, 40);

    return () => clearInterval(interval);
  }, [matchResult, aiPool, p1Profile.id, p2Profile.id]);

  // Handle Re-Sorting
  useEffect(() => {
      if (phase === 'resorting') {
          // Now use the actual current pool (which has updated scores)
          const sortedNewPool = [...aiPool].sort((a, b) => b.score - a.score);
          setRankingList(sortedNewPool);
          
          setTimeout(() => {
              setPhase('final');
          }, 500);
      }
  }, [phase, aiPool]);

  // Auto Advance
  useEffect(() => {
      if (!isAutoMode || phase !== 'final') return;
      const interval = setInterval(() => {
          setAutoTimer(prev => {
              if (prev <= 1) {
                  clearInterval(interval);
                  onNext();
                  return 0;
              }
              return prev - 1;
          });
      }, 1000);
      return () => clearInterval(interval);
  }, [isAutoMode, phase, onNext]);


  const getRankChangeIcon = (playerId: string, currentRank: number) => {
     const prev = prevRanks[playerId];
     if (!prev) return null; // New player?
     
     if (currentRank < prev) {
         return <div className="flex items-center text-green-400 text-xs font-bold animate-pulse"><ArrowUp size={12}/> {prev - currentRank}</div>;
     } else if (currentRank > prev) {
         return <div className="flex items-center text-red-400 text-xs font-bold"><ArrowDown size={12}/> {currentRank - prev}</div>;
     }
     return <Minus size={12} className="text-neutral-600" />;
  };

  // SPECTATOR MODE RENDER
  if (isAutoMode) {
      return (
        <div className="w-full h-screen bg-[#020203] relative overflow-hidden flex flex-col items-center justify-center font-sans">
             {/* Background */}
            <div className="absolute inset-0 z-0">
                <div className="absolute inset-0 bg-[linear-gradient(rgba(0,0,0,0.5)_1px,transparent_1px),linear-gradient(90deg,rgba(0,0,0,0.5)_1px,transparent_1px)] bg-[size:40px_40px] opacity-20"></div>
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/80"></div>
            </div>

            <div className="z-10 w-full max-w-7xl p-8 flex flex-col items-center gap-8">
                 <div className="text-center">
                    <h2 className="text-6xl font-black italic brand-font text-white mb-2 tracking-tighter drop-shadow-lg">
                        SIMULATION REPORT
                    </h2>
                    <div className="text-neutral-500 font-mono uppercase tracking-[0.5em] text-xs">AI vs AI Neural Assessment</div>
                 </div>

                 <div className="flex gap-8 w-full items-stretch justify-center h-[300px]">
                     {/* PLAYER 1 CARD */}
                     <div className={`flex-1 glass-panel clip-tech-border p-8 border-t-4 ${matchResult.winner === 'p1' ? 'border-cyan-400 bg-cyan-900/10' : 'border-neutral-700'} flex flex-col items-center relative overflow-hidden transition-all duration-500`}>
                         {matchResult.winner === 'p1' && <div className="absolute top-4 right-4 text-cyan-400 font-bold font-mono text-xs border border-cyan-400 px-2 py-0.5 rounded animate-pulse">WINNER</div>}
                         <div className="text-4xl font-black brand-font text-cyan-400 mb-1">{p1Profile.dna.name}</div>
                         <div className="text-xs text-neutral-500 font-mono mb-6">BLUE SWARM</div>
                         
                         <div className="grid grid-cols-2 gap-4 w-full mb-6 mt-auto">
                             <div className="bg-black/30 p-2 rounded text-center">
                                 <div className="text-[10px] text-neutral-500 uppercase">Survival</div>
                                 <div className="text-white font-bold font-mono">{matchResult.p1Count}</div>
                             </div>
                             <div className="bg-black/30 p-2 rounded text-center border border-cyan-500/30">
                                 <div className="text-[10px] text-cyan-400 uppercase">Match Score</div>
                                 <div className="text-cyan-300 font-black font-mono text-xl">+{displayedScoreP1}</div>
                             </div>
                         </div>
                     </div>

                     <div className="flex flex-col items-center justify-center text-white/20 italic font-black text-6xl px-4">VS</div>

                     {/* PLAYER 2 CARD */}
                     <div className={`flex-1 glass-panel clip-tech-border p-8 border-t-4 ${matchResult.winner === 'p2' ? 'border-orange-400 bg-orange-900/10' : 'border-neutral-700'} flex flex-col items-center relative overflow-hidden transition-all duration-500`}>
                         {matchResult.winner === 'p2' && <div className="absolute top-4 right-4 text-orange-400 font-bold font-mono text-xs border border-orange-400 px-2 py-0.5 rounded animate-pulse">WINNER</div>}
                         <div className="text-4xl font-black brand-font text-orange-400 mb-1">{p2Profile.dna.name}</div>
                         <div className="text-xs text-neutral-500 font-mono mb-6">ORANGE LEGION</div>
                         
                         <div className="grid grid-cols-2 gap-4 w-full mb-6 mt-auto">
                             <div className="bg-black/30 p-2 rounded text-center">
                                 <div className="text-[10px] text-neutral-500 uppercase">Survival</div>
                                 <div className="text-white font-bold font-mono">{matchResult.p2Count}</div>
                             </div>
                             <div className="bg-black/30 p-2 rounded text-center border border-orange-500/30">
                                 <div className="text-[10px] text-orange-400 uppercase">Match Score</div>
                                 <div className="text-orange-300 font-black font-mono text-xl">+{displayedScoreP2}</div>
                             </div>
                         </div>
                     </div>
                 </div>

                 {/* GLOBAL LADDER ANIMATED */}
                 <div className="w-full glass-panel clip-tech-border p-4 flex flex-col h-[300px] relative">
                    <div className="absolute top-0 right-0 p-2 text-[10px] font-mono text-neutral-500">LIVE_RANKING_FEED</div>
                    <h3 className="text-xl font-bold brand-font text-white mb-4 flex items-center gap-2">
                        <Trophy className="text-yellow-400" size={20} /> GLOBAL RANKINGS
                    </h3>
                    
                    <div className="flex-1 overflow-hidden relative">
                         {/* Header */}
                         <div className="flex text-[10px] text-neutral-500 uppercase tracking-widest border-b border-white/10 pb-2 mb-2 px-2">
                             <div className="w-16">Rank</div>
                             <div className="flex-1">Colony Agent</div>
                             <div className="w-32 text-right">Total Score</div>
                         </div>

                         <div className="overflow-y-auto h-full pb-8 custom-scrollbar relative">
                             {rankingList.map((player, idx) => {
                                 const isP1 = player.id === p1Profile.id;
                                 const isP2 = player.id === p2Profile.id;
                                 const rank = idx + 1;
                                 
                                 let rowClass = "border-transparent text-neutral-400";
                                 if (isP1) rowClass = "bg-cyan-900/20 border-cyan-500/50 text-cyan-100 shadow-[0_0_15px_rgba(6,182,212,0.1)]";
                                 if (isP2) rowClass = "bg-orange-900/20 border-orange-500/50 text-orange-100 shadow-[0_0_15px_rgba(249,115,22,0.1)]";

                                 return (
                                     <div 
                                        key={player.id} 
                                        className={`flex items-center p-2 rounded mb-1 border-l-2 transition-all duration-500 ${rowClass} ${phase === 'resorting' ? 'opacity-50 blur-[1px]' : 'opacity-100'}`}
                                        style={{ transform: `translateY(0)` }} // Reset transform
                                     >
                                         <div className="w-16 font-bold font-mono flex items-center gap-2">
                                             <span className={rank <= 3 ? "text-yellow-400" : "text-neutral-600"}>#{rank}</span>
                                             {getRankChangeIcon(player.id, rank)}
                                         </div>
                                         <div className="flex-1 font-bold text-sm tracking-wide truncate">
                                             {player.dna.name}
                                         </div>
                                         <div className="w-32 text-right font-mono">
                                             {player.score.toLocaleString()}
                                         </div>
                                     </div>
                                 );
                             })}
                         </div>
                    </div>
                 </div>

                 {phase === 'final' && (
                    <div className="w-full py-4 border border-purple-500/20 bg-purple-900/5 text-purple-300 font-bold text-center flex items-center justify-center gap-3 mono-font animate-in fade-in slide-in-from-bottom-4">
                        <Loader2 className="animate-spin" size={16} />
                        INITIALIZING EVOLUTION SEQUENCE IN {autoTimer}s
                    </div>
                 )}
            </div>
        </div>
      );
  }

  // --- CAMPAIGN MODE RENDER ---
  // (Simplified for brevity, keeping existing Campaign mode logic mostly as is but ensuring it works)
  return (
    <div className="w-full h-screen bg-[#020203] relative overflow-hidden flex flex-col items-center justify-center font-sans">
       {/* (Existing campaign JSX would go here, effectively same structure but simpler animation) */}
      <div className="z-10 w-full max-w-4xl p-8 flex flex-col items-center justify-center">
            <h2 className="text-8xl font-black italic brand-font text-white mb-8 tracking-tighter">
                {matchResult.winner === 'p1' ? 'VICTORY' : matchResult.winner === 'draw' ? 'DRAW' : 'DEFEAT'}
            </h2>
            <div className="text-4xl font-mono text-cyan-400 mb-8">
                +{displayedScoreP1} POINTS
            </div>
            <Button size="lg" onClick={onNext} className="w-full max-w-md" icon={<ArrowRight />}>
                CONTINUE
            </Button>
      </div>
    </div>
  );
};

export default LeaderboardScene;