import React from 'react';
import { MatchResult } from '../types';
import { Trophy, Minus, Activity } from 'lucide-react';

interface Props {
  history: MatchResult[];
}

const Leaderboard: React.FC<Props> = ({ history }) => {
  // Sort by ID descending (newest first)
  const sortedHistory = [...history].sort((a, b) => b.id - a.id);
  const p1Wins = history.filter(h => h.winner === 'p1').length;
  const p2Wins = history.filter(h => h.winner === 'p2').length;

  return (
    <div className="bg-neutral-900/90 backdrop-blur border border-white/10 rounded-xl overflow-hidden flex flex-col h-full shadow-2xl">
      <div className="p-4 border-b border-white/10 bg-black/40 flex justify-between items-center">
        <h3 className="text-white font-bold brand-font flex items-center gap-2">
          <Activity size={18} className="text-cyan-400" />
          Battle Logs
        </h3>
        <div className="flex gap-3 text-xs font-mono font-bold">
          <span className="text-cyan-400">P1: {p1Wins}</span>
          <span className="text-neutral-600">|</span>
          <span className="text-orange-400">P2: {p2Wins}</span>
        </div>
      </div>
      
      <div className="overflow-y-auto flex-1 p-2 space-y-2 max-h-[300px] custom-scrollbar">
        {sortedHistory.length === 0 && (
          <div className="text-center text-neutral-600 py-8 text-sm italic">
            No matches recorded yet...
          </div>
        )}
        
        {sortedHistory.map((match) => (
          <div 
            key={match.id} 
            className="flex items-center justify-between bg-white/5 p-3 rounded border border-white/5 hover:bg-white/10 transition-colors"
          >
            <div className="flex items-center gap-3">
              <span className="text-neutral-500 font-mono text-xs">#{match.id}</span>
              <div className="flex flex-col">
                 <div className="flex items-center gap-2 text-xs font-bold uppercase">
                    {match.winner === 'p1' && <Trophy size={12} className="text-cyan-400"/>}
                    {match.winner === 'p2' && <Trophy size={12} className="text-orange-400"/>}
                    {match.winner === 'draw' && <Minus size={12} className="text-neutral-400"/>}
                    
                    <span className={match.winner === 'p1' ? 'text-cyan-400' : 'text-neutral-500'}>
                        {match.p1Name}
                    </span>
                    <span className="text-neutral-600">vs</span>
                    <span className={match.winner === 'p2' ? 'text-orange-400' : 'text-neutral-500'}>
                        {match.p2Name}
                    </span>
                 </div>
              </div>
            </div>
            
            <div className="text-right">
               <div className="text-xs font-mono text-white/80">
                 {match.p1Count} - {match.p2Count}
               </div>
               <div className="text-[10px] text-neutral-600">
                 {Math.floor(match.duration)}s
               </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Leaderboard;