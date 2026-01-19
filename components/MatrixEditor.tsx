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
    // Helper to visualize force color
    const getBgColor = (v: number) => {
      if (v > 0) return `rgba(0, 255, 0, ${Math.abs(v) * 0.3})`; // Green attract
      if (v < 0) return `rgba(255, 0, 0, ${Math.abs(v) * 0.3})`; // Red repel
      return 'transparent';
    };

    return (
      <div className="flex flex-col items-center">
        <div 
          className="w-12 h-12 rounded flex items-center justify-center border border-white/20 mb-1 transition-colors"
          style={{ backgroundColor: getBgColor(val) }}
        >
          <span className="text-xs font-bold font-mono">{val.toFixed(2)}</span>
        </div>
        <input 
          type="range" 
          min="-1" 
          max="1" 
          step="0.05" 
          value={val}
          onChange={(e) => handleMatrixChange(type, row, col, parseFloat(e.target.value))}
          className="w-20 accent-cyan-500 h-1.5 bg-neutral-700 rounded-lg appearance-none cursor-pointer"
        />
        <span className="text-[10px] text-neutral-500 mt-1 text-center leading-tight">
          {label}
        </span>
      </div>
    );
  };

  const labels = ["Soldier", "Worker"];
  
  return (
    <div className="bg-neutral-900/80 backdrop-blur border border-white/10 p-6 rounded-xl flex flex-col gap-6 w-full max-w-md">
      <div>
        <h3 className="text-xl font-bold mb-1 brand-font" style={{ color: playerColor }}>Colony Engineering</h3>
        <p className="text-neutral-400 text-sm">Design the DNA of your swarm.</p>
      </div>

      <div className="grid grid-cols-2 gap-8">
        {/* Internal Matrix */}
        <div className="space-y-4">
          <h4 className="text-sm font-bold text-center border-b border-white/10 pb-2">Internal (Self)</h4>
          <div className="grid grid-cols-2 gap-4">
            {dna.internalMatrix.map((rowArr, r) => (
              rowArr.map((val, c) => (
                <MatrixInput 
                  key={`int-${r}-${c}`} 
                  val={val} 
                  row={r} 
                  col={c} 
                  type="internal"
                  label={`${labels[r]} -> ${labels[c]}`}
                />
              ))
            ))}
          </div>
        </div>

        {/* External Matrix */}
        <div className="space-y-4">
          <h4 className="text-sm font-bold text-center border-b border-white/10 pb-2">External (Enemy)</h4>
          <div className="grid grid-cols-2 gap-4">
            {dna.externalMatrix.map((rowArr, r) => (
              rowArr.map((val, c) => (
                <MatrixInput 
                  key={`ext-${r}-${c}`} 
                  val={val} 
                  row={r} 
                  col={c} 
                  type="external"
                  label={`${labels[r]} -> Enemy ${labels[c]}`}
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