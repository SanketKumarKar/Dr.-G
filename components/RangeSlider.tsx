import React, { useState } from 'react';
import { motion } from 'framer-motion';

interface RangeSliderProps {
  min?: number;
  max?: number;
  step?: number;
  initial?: number;
  onCommit: (value: number) => void;
  label?: string;
}

const RangeSlider: React.FC<RangeSliderProps> = ({ min = 1, max = 10, step = 1, initial = 5, onCommit, label }) => {
  const [value, setValue] = useState(initial);
  return (
    <div className="mt-3 w-full">
      {label && <div className="text-[11px] uppercase tracking-wide font-semibold text-slate-500 mb-1">{label}: <span className="text-indigo-600">{value}</span></div>}
      <div className="flex items-center gap-3">
        <span className="text-[10px] font-medium text-slate-400">{min}</span>
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={e => setValue(parseInt(e.target.value))}
          onMouseUp={() => onCommit(value)}
          onTouchEnd={() => onCommit(value)}
          className="flex-1 accent-indigo-600 cursor-pointer"
        />
        <span className="text-[10px] font-medium text-slate-400">{max}</span>
        <motion.button whileTap={{ scale: 0.9 }} onClick={() => onCommit(value)} className="px-2 py-1 rounded-md text-[10px] font-semibold bg-indigo-600 text-white shadow">
          Set
        </motion.button>
      </div>
    </div>
  );
};

export default RangeSlider;