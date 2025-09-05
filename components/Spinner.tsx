import React from 'react';

const Spinner: React.FC<{ className?: string }> = ({ className = 'w-5 h-5' }) => {
  return (
    <div
      className={`animate-spin rounded-full border-2 border-t-transparent ${className}`}
      style={{ borderRightColor: 'inherit', borderBottomColor: 'inherit', borderLeftColor: 'inherit' }}
    ></div>
  );
};

export default Spinner;
