import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface OptionChipsProps {
  options: string[];
  disabled?: boolean;
  onSelect: (value: string) => void;
}

const colors = [
  'from-indigo-500 to-violet-500',
  'from-rose-500 to-pink-500',
  'from-emerald-500 to-teal-500',
  'from-amber-500 to-orange-500',
  'from-sky-500 to-cyan-500'
];

const OptionChips: React.FC<OptionChipsProps> = ({ options, disabled, onSelect }) => {
  return (
    <AnimatePresence mode="popLayout">
      <div className="flex flex-wrap gap-2 mt-2">
        {options.map((opt, i) => (
          <motion.button
            layout
            key={opt}
            whileHover={!disabled ? { y: -2 } : undefined}
            whileTap={!disabled ? { scale: 0.95 } : undefined}
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.85 }}
            disabled={disabled}
            onClick={() => onSelect(opt)}
            className={`relative group overflow-hidden px-4 py-1.5 rounded-full text-xs font-medium tracking-wide text-white disabled:opacity-40 focus:outline-none focus-visible:ring-2 ring-offset-1 ring-indigo-200 bg-gradient-to-br ${colors[i % colors.length]}`}
          >
            <span className="relative z-10 drop-shadow-sm">{opt}</span>
            <span className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity bg-white/10" />
          </motion.button>
        ))}
      </div>
    </AnimatePresence>
  );
};

export default OptionChips;