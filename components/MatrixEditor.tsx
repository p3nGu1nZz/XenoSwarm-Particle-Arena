import React from 'react';
import { ColonyDNA } from '../types';

interface Props {
  dna: ColonyDNA;
  onChange: (newDNA: ColonyDNA) => void;
  playerColor: string;
}

const MatrixEditor: React.FC<Props> = ({ dna, onChange, playerColor }) => {
  const handleMatrixChange = (
    type: 'internal' | 'external', 
    row: number, 
    col: number, 
    val: number
  ) => {
    const newDNA = { ...dna };
    const targetMatrix = type === 'internal' ? [...newDNA.internalMatrix] : [...newDNA.externalMatrix];
    targetMatrix[row] = [...targetMatrix[row]];
    targetMatrix[row][col] = val;
    
    if (type === 'internal') newDNA.internalMatrix = targetMatrix;
    else newDNA.externalMatrix = targetMatrix;
    
    onChange(newDNA);
  };

  const MatrixInput = ({ val, row, col, type, label }: any) => {
    const isPositive = val > 0;
    const isZero = val === 0;
    const intensity = Math.abs(val);
    
    // Neon palette logic
    let color = isZero ? '#444' : (isPositive ? '#00f3ff' : '#ff0055');
    let shadow = isZero ? 'none' : `0 0 ${intensity * 10}px ${color}`;

    return (
      <div className="flex flex-col items-center group relative p-3 bg-white/5 border border-white/5 hover:border-white/20 transition-all clip-corner-sm">
        
        {/* Visualizer Bar */}
        <div className="relative w-full h-24 bg-black/50 border border-white/10 mb-3 flex items-end justify-center overflow-hidden">
            <div 
                className="w-full transition-all duration-200 relative z-10"
                style={{
                    backgroundColor: color,
                    height: `${Math.abs(val) * 100}%`,
                    opacity: 0.6 + (intensity * 0.4),
                    boxShadow: shadow
                }}
            >
                {/* Scanline texture inside bar */}
                <div className="absolute inset-0 bg-[linear-gradient(black_1px,transparent_1px)] bg-[size:100%_4px] opacity-20"></div>
            </div>
            
            {/* Zero Line */}
            <div className="absolute bottom-0 w-full h-px bg-white/20"></div>
            
            <div className="absolute inset-0 flex items-center justify-center z-20 pointer-events-none">
                 <span className="text-xs font-bold mono-font drop-shadow-md text-white">
                    {val > 0 ? '+' : ''}{val.toFixed(2)}
                 </span>
            </div>
        </div>

        <input 
          type="range" 
          min="-1" 
          max="1" 
          step="0.05" 
          value={val}
          onChange={(e) => handleMatrixChange(type, row, col, parseFloat(e.target.value))}
          className="w-full h-1 cursor-pointer opacity-80 hover:opacity-100"
          style={{ accentColor: color }} 
        />
        
        <span className="text-[10px] text-neutral-500 mt-2 text-center mono-font uppercase tracking-widest group-hover:text-cyan-400 transition-colors">
          {label}
        </span>
      </div>
    );
  };

  const labels = ["Unit A", "Unit B"];
  
  return (
    <div className="glass-panel p-6 clip-tech-border flex flex-col gap-6 w-full max-w-md shadow-[0_0_50px_rgba(0,0,0,0.5)] border-l-4" style={{ borderLeftColor: playerColor }}>
      <div className="border-b border-white/10 pb-4 flex justify-between items-end">
        <div>
            <h3 className="text-xl font-bold brand-font tracking-wide text-white drop-shadow-lg">
                DNA MATRIX
            </h3>
            <p className="text-neutral-500 text-[10px] uppercase tracking-[0.2em] mt-1 mono-font">Force Vector Configuration</p>
        </div>
        <div className="text-right">
             <div className="text-[10px] text-neutral-600 mono-font">STATUS</div>
             <div className="text-xs text-emerald-400 font-bold animate-pulse">ACTIVE</div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Internal Matrix */}
        <div className="space-y-4">
          <h4 className="text-[10px] uppercase font-bold text-center tracking-widest text-cyan-400 bg-cyan-900/10 py-2 border-b border-cyan-500/30">
            Internal Bonds
          </h4>
          <div className="grid grid-cols-2 gap-2">
            {dna.internalMatrix.map((rowArr, r) => (
              rowArr.map((val, c) => (
                <MatrixInput 
                  key={`int-${r}-${c}`} 
                  val={val} 
                  row={r} 
                  col={c} 
                  type="internal"
                  label={`${labels[r]}→${labels[c]}`}
                />
              ))
            ))}
          </div>
        </div>

        {/* External Matrix */}
        <div className="space-y-4">
          <h4 className="text-[10px] uppercase font-bold text-center tracking-widest text-pink-400 bg-pink-900/10 py-2 border-b border-pink-500/30">
            Xeno Relations
          </h4>
          <div className="grid grid-cols-2 gap-2">
            {dna.externalMatrix.map((rowArr, r) => (
              rowArr.map((val, c) => (
                <MatrixInput 
                  key={`ext-${r}-${c}`} 
                  val={val} 
                  row={r} 
                  col={c} 
                  type="external"
                  label={`${labels[r]}→Xeno`}
                />
              ))
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default MatrixEditor;