import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface OptionChipsProps {
  options: string[];
  selected?: string[];
  allowMultiple?: boolean;
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

const OptionChips: React.FC<OptionChipsProps> = ({ options, selected = [], allowMultiple = false, disabled, onSelect }) => {
  return (
    <AnimatePresence mode="popLayout">
      <div className="flex flex-wrap gap-2 mt-2">
        {options.map((opt, i) => {
          const isSelected = selected.includes(opt);
          // If multi-select is on, dim unselected items slightly if some are selected, or keep them normal.
          // Actually, let's just make selected items pop more.
          const baseStyle = "relative group overflow-hidden px-4 py-1.5 rounded-full text-xs font-medium tracking-wide transition-all duration-200 disabled:opacity-40 focus:outline-none focus-visible:ring-2 ring-offset-1 ring-indigo-200 dark:ring-indigo-700";

          // Dynamic style based on selection state
          const activeStyle = isSelected
            ? `text-white bg-gradient-to-br ${colors[i % colors.length]} shadow-md scale-105`
            : "text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 hover:border-indigo-300 dark:hover:border-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/30";

          // If not allowing multiple, keep original behavior (always colored)
          const finalStyle = allowMultiple
            ? `${baseStyle} ${activeStyle}`
            : `${baseStyle} text-white bg-gradient-to-br ${colors[i % colors.length]}`;

          return (
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
              className={finalStyle}
            >
              <span className="relative z-10 drop-shadow-sm flex items-center gap-1.5">
                {isSelected && (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                )}
                {opt}
              </span>
              {!isSelected && !allowMultiple && (
                <span className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity bg-white/10" />
              )}
            </motion.button>
          );
        })}
      </div>
    </AnimatePresence>
  );
};

export default OptionChips;
