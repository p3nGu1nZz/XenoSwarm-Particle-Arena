import React, { useEffect, useState } from 'react';
import { MatchResult, PlayerProfile } from '../types';
import Button from './Button';
import { Trophy, ArrowRight, User, Loader2, Award } from 'lucide-react';

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
  const [displayedScore, setDisplayedScore] = useState(0);
  const [showRankings, setShowRankings] = useState(false);
  const [tallyIndex, setTallyIndex] = useState(0);
  const [autoTimer, setAutoTimer] = useState(5);

  const allPlayers = [p1Profile, ...aiPool].sort((a,b) => b.score - a.score);
  const myRank = allPlayers.findIndex(p => p.id === p1Profile.id) + 1;

  const breakdown = [
      { label: "Base Reward", val: matchResult.winner === 'p1' ? 1000 : matchResult.winner === 'draw' ? 250 : 50 },
      { label: "Unit Survival", val: matchResult.p1Count * 10 },
      { label: "Domination", val: Math.max(0, matchResult.p1Count - matchResult.p2Count) * 5 },
      { label: "Speed Bonus", val: matchResult.winner === 'p1' ? Math.floor(Math.max(0, 90 - matchResult.duration) * 10) : 0 }
  ];

  useEffect(() => {
    if (tallyIndex < breakdown.length) {
        const timer = setTimeout(() => {
            setDisplayedScore(prev => prev + breakdown[tallyIndex].val);
            setTallyIndex(prev => prev + 1);
        }, 300);
        return () => clearTimeout(timer);
    } else {
        setTimeout(() => setShowRankings(true), 600);
    }
  }, [tallyIndex]);

  useEffect(() => {
      if (!isAutoMode || !showRankings) return;
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
  }, [isAutoMode, showRankings]);

  return (
    <div className="w-full h-screen bg-[#020203] relative overflow-hidden flex flex-col items-center justify-center font-sans">
      
      {/* Background */}
      <div className="absolute inset-0 z-0">
          <div className="absolute inset-0 bg-[linear-gradient(rgba(0,243,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(0,243,255,0.03)_1px,transparent_1px)] bg-[size:40px_40px]"></div>
          <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-b from-[#020203] via-transparent to-[#020203]"></div>
          <div className="absolute bottom-0 left-0 right-0 h-1/2 bg-gradient-to-t from-cyan-900/10 to-transparent"></div>
      </div>

      <div className="z-10 w-full max-w-6xl p-8 flex gap-12 h-[80vh]">
          
          {/* LEFT: MATCH REPORT */}
          <div className="flex-1 flex flex-col justify-center">
              <div className="mb-8">
                  <h2 className="text-8xl font-black italic brand-font text-white mb-2 tracking-tighter" style={{ textShadow: "0 0 30px rgba(255,255,255,0.2)" }}>
                      {matchResult.winner === 'p1' ? 'VICTORY' : matchResult.winner === 'draw' ? 'DRAW' : 'DEFEAT'}
                  </h2>
                  <div className="h-1 w-24 bg-gradient-to-r from-cyan-500 to-transparent"></div>
              </div>

              <div className="space-y-3 mb-12 bg-black/20 p-6 border-l-2 border-white/10 backdrop-blur-sm">
                  {breakdown.map((item, idx) => (
                      <div 
                        key={idx} 
                        className={`flex justify-between items-center font-mono p-2 transition-all duration-500 ${idx < tallyIndex ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-4'}`}
                      >
                          <span className="text-neutral-500 uppercase text-xs tracking-widest">{item.label}</span>
                          <span className="text-cyan-400 font-bold text-lg">+{item.val}</span>
                      </div>
                  ))}
                  <div className="border-t border-white/10 my-4 pt-4 flex justify-between items-end">
                      <span className="text-white font-bold brand-font text-xl">TOTAL EARNED</span>
                      <span className="text-4xl font-black text-white text-glow-cyan brand-font">{displayedScore.toLocaleString()}</span>
                  </div>
              </div>

              <div className="mt-auto">
                 {isAutoMode ? (
                     <div className="w-full py-6 border border-cyan-500/20 bg-cyan-900/5 text-cyan-400 font-bold text-center flex items-center justify-center gap-3 mono-font">
                        <Loader2 className="animate-spin" size={16} />
                        NEXT ROUND INITIATING IN {autoTimer}s
                     </div>
                 ) : (
                    <Button size="lg" onClick={onNext} className="w-full" icon={<ArrowRight />}>
                        CONTINUE CAMPAIGN
                    </Button>
                 )}
              </div>
          </div>

          {/* RIGHT: GLOBAL RANKINGS */}
          <div className={`flex-1 glass-panel clip-tech-border p-1 flex flex-col transition-all duration-1000 transform ${showRankings ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
              <div className="bg-black/40 h-full p-6 flex flex-col">
                <div className="border-b border-white/10 pb-4 mb-4 flex justify-between items-center">
                    <h3 className="text-2xl font-bold brand-font text-white flex items-center gap-2">
                        <Trophy className="text-yellow-400" size={24} /> GLOBAL LADDER
                    </h3>
                    <div className="text-[10px] text-neutral-500 font-mono border border-white/10 px-2 py-1 rounded">SEASON_03</div>
                </div>

                <div className="overflow-y-auto flex-1 custom-scrollbar pr-2 space-y-1">
                    {allPlayers.map((player, idx) => {
                        const isMe = player.id === p1Profile.id;
                        const rank = idx + 1;
                        return (
                            <div 
                              key={player.id} 
                              className={`flex items-center p-3 border-l-2 transition-all ${isMe ? 'bg-cyan-500/10 border-cyan-400' : 'border-transparent hover:bg-white/5'}`}
                            >
                                <div className="w-12 text-center font-bold font-mono text-neutral-500">
                                    {rank <= 3 ? <Award size={16} className={rank === 1 ? 'text-yellow-400' : rank === 2 ? 'text-gray-300' : 'text-amber-600'} /> : `#${rank}`}
                                </div>
                                <div className="flex-1">
                                    <div className={`font-bold text-sm ${isMe ? 'text-cyan-300' : 'text-neutral-300'}`}>{player.dna.name}</div>
                                    <div className="text-[10px] text-neutral-600 font-mono">WINS: {player.wins} | MATCHES: {player.matchesPlayed}</div>
                                </div>
                                <div className="text-right font-mono font-bold text-white/80">
                                    {player.score.toLocaleString()}
                                </div>
                            </div>
                        );
                    })}
                </div>
                
                <div className="mt-4 pt-4 border-t border-white/10 text-center">
                    <span className="text-neutral-500 text-[10px] uppercase tracking-widest mr-2">Your Current Standing</span>
                    <span className="text-2xl font-black text-white brand-font">RANK #{myRank}</span>
                </div>
              </div>
          </div>
      </div>
    </div>
  );
};

export default LeaderboardScene;