import React from 'react';

const DrGLogo: React.FC<{ className?: string }> = ({ className }) => {
    return (
        <div className={`flex items-center space-x-3 ${className}`}>
            <div className="bg-indigo-600 dark:bg-indigo-500 text-white w-10 h-10 rounded-full flex items-center justify-center shadow-md shadow-indigo-500/20">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
            </div>
            <span className="text-2xl font-bold text-slate-800 dark:text-white">
                Dr.<span className="text-indigo-600 dark:text-indigo-400">G</span>
            </span>
        </div>
    );
};

export default DrGLogo;
