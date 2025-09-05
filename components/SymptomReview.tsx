import React from 'react';
import { CategorizedSymptoms, Symptom, SymptomCategory } from '../types';
import Spinner from './Spinner';

interface SymptomReviewProps {
  symptoms: CategorizedSymptoms | null;
  onConfirm: () => void;
  isGeneratingReport: boolean;
  onChange: (updated: CategorizedSymptoms) => void;
}

const categoryStyles = {
  [SymptomCategory.PROMINENT]: {
    title: 'Prominent Symptoms',
    border: 'border-red-500',
    text: 'text-red-700',
    pillBg: 'bg-red-100',
    titleColor: 'text-red-600',
  },
  [SymptomCategory.MEDIUM]: {
    title: 'Associated Symptoms',
    border: 'border-amber-500',
    text: 'text-amber-700',
    pillBg: 'bg-amber-100',
    titleColor: 'text-amber-600',
  },
  [SymptomCategory.LOW]: {
    title: 'Additional Details',
    border: 'border-sky-500',
    text: 'text-sky-700',
    pillBg: 'bg-sky-100',
    titleColor: 'text-sky-600',
  },
};

const SeverityRating: React.FC<{ rating: number }> = ({ rating }) => {
  const totalStars = 5;
  return (
    <div className="flex items-center flex-shrink-0">
      {[...Array(totalStars)].map((_, index) => {
        const starIndex = index + 1;
        return (
          <svg
            key={starIndex}
            className={`w-4 h-4 ${
              starIndex <= rating ? 'text-amber-400' : 'text-slate-300'
            }`}
            fill="currentColor"
            viewBox="0 0 20 20"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
          </svg>
        );
      })}
    </div>
  );
};

const SymptomCard: React.FC<{ symptom: Symptom; category: SymptomCategory; delay: number; onRemove: ()=>void }> = ({ symptom, category, delay, onRemove }) => {
  const styles = categoryStyles[category];
  return (
    <div
      className={`group bg-white border-l-4 ${styles.border} p-4 rounded-r-lg shadow-sm fade-in-card cursor-grab active:cursor-grabbing relative`}
      style={{ animationDelay: `${delay}ms` }}
      draggable
      onDragStart={(e)=> {
        e.dataTransfer.setData('text/symptom', JSON.stringify({ name: symptom.name, from: category }));
        e.dataTransfer.effectAllowed = 'move';
      }}
    >
      <div className="flex justify-between items-start gap-3 pr-6">
        <h4 className="font-semibold text-slate-900 select-none">{symptom.name}</h4>
        <SeverityRating rating={symptom.severity} />
      </div>
      <p className="mt-2 text-sm text-slate-600">{symptom.notes}</p>
      <div className="flex flex-wrap gap-2 mt-3 text-xs">
        <span className={`px-2.5 py-1 rounded-full ${styles.pillBg} ${styles.text} font-medium`}>Duration: {symptom.duration}</span>
      </div>
      <button
        onClick={onRemove}
        className="absolute top-2 right-2 w-6 h-6 rounded-md flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100 focus:outline-none"
        title="Remove this symptom"
      >
        <svg xmlns='http://www.w3.org/2000/svg' className='w-4 h-4' viewBox='0 0 20 20' fill='currentColor'><path fillRule='evenodd' d='M10 18a8 8 0 100-16 8 8 0 000 16zM8.293 7.293a1 1 0 011.414 0L10 7.586l.293-.293a1 1 0 111.414 1.414L11.414 9l.293.293a1 1 0 01-1.414 1.414L10 10.414l-.293.293a1 1 0 01-1.414-1.414L8.586 9l-.293-.293a1 1 0 010-1.414z' clipRule='evenodd'/></svg>
      </button>
    </div>
  );
};

const SkeletonLoader: React.FC = () => (
    <div className="w-full h-full bg-white rounded-xl shadow-lg border border-slate-200/80 flex flex-col overflow-hidden">
      <div className="p-6 border-b border-slate-200/70 bg-gradient-to-r from-indigo-50/60 to-transparent">
        <h2 className="text-[15px] font-semibold tracking-wide text-slate-800 flex items-center gap-2">
          <span className="inline-block w-2 h-2 rounded-full bg-indigo-500 animate-ping" />
          Preparing Structured Symptom Workspace
        </h2>
        <p className="mt-2 text-xs text-slate-600 leading-relaxed max-w-md">
          Your report will be generated shortly after symptom identification. Please continue describing what you feel—each detail refines the clinical structure.
        </p>
      </div>
      <div className="flex-1 p-6 space-y-6 animate-pulse">
        <div>
          <div className="h-5 bg-slate-200/80 rounded w-40 mb-3" />
          <div className="h-24 bg-slate-100 rounded-lg" />
        </div>
        <div>
          <div className="h-5 bg-slate-200/80 rounded w-56 mb-3" />
          <div className="h-24 bg-slate-100 rounded-lg" />
        </div>
        <div>
          <div className="h-5 bg-slate-200/80 rounded w-32 mb-3" />
          <div className="h-24 bg-slate-100 rounded-lg" />
        </div>
      </div>
      <div className="p-6 border-t border-slate-200/70 bg-white/60">
         <div className="h-10 bg-slate-100 rounded-lg" />
      </div>
    </div>
);


const SymptomReview: React.FC<SymptomReviewProps> = ({ symptoms, onConfirm, isGeneratingReport, onChange }) => {
  if (!symptoms) {
    return <SkeletonLoader />;
  }
  
  let cardIndex = 0;

  return (
    <div className="w-full h-full bg-white rounded-xl shadow-lg border border-slate-200/80 flex flex-col overflow-hidden">
      <div className="p-6 border-b border-slate-200/80 relative">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-slate-800 mb-1">Review Your Symptoms</h2>
            <p className="text-sm text-slate-600">
              Here’s a structured summary. Adjust by telling Dr.G in the chat if anything is missing or inaccurate.
            </p>
          </div>
          <div className="hidden md:flex items-center gap-2 px-3 py-2 rounded-lg bg-gradient-to-r from-indigo-50 to-violet-50 border border-indigo-100 shadow-sm animate-[fadeIn_.6s_ease]">
            <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
            <span className="text-[11px] font-medium text-slate-700 leading-tight">Report will generate<br/>right after confirmation</span>
          </div>
        </div>
        <div className="mt-4 md:mt-5">
          <div className="md:hidden flex items-center gap-2 px-3 py-2 rounded-md bg-indigo-50 border border-indigo-100 text-[11px] text-slate-700 animate-[fadeIn_.6s_ease]">
            <span className="w-2 h-2 rounded-full bg-indigo-500 animate-ping" />
            Your report will be generated shortly after symptom identification.
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50/70">
        <p className="text-[11px] uppercase tracking-wide font-semibold text-slate-500 flex items-center gap-2 mb-2">
          <svg xmlns='http://www.w3.org/2000/svg' className='w-3.5 h-3.5 text-indigo-500' viewBox='0 0 20 20' fill='currentColor'><path d='M10.894 2.553a1 1 0 00-1.788 0l-7 14A1 1 0 003 18h14a1 1 0 00.894-1.447l-7-14z'/></svg>
          Drag symptoms between categories or remove items before generating.
        </p>
        {(Object.keys(symptoms) as SymptomCategory[]).map((category) => {
          const list = symptoms[category];
          return (
            <div
              key={category}
              onDragOver={(e)=> { e.preventDefault(); e.dataTransfer.dropEffect='move'; }}
              onDrop={(e)=> {
                const data = e.dataTransfer.getData('text/symptom');
                if (!data) return;
                try {
                  const payload = JSON.parse(data) as { name: string; from: SymptomCategory };
                  if (payload.from === category) return;
                  const updated: CategorizedSymptoms = { ...symptoms, [payload.from]: [...symptoms[payload.from]].filter(s=> s.name !== payload.name), [category]: [...symptoms[category]] } as CategorizedSymptoms;
                  const moved = (symptoms[payload.from] as Symptom[]).find(s=> s.name === payload.name);
                  if (moved && !updated[category].some(s=> s.name === moved.name)) {
                    updated[category].push(moved);
                    onChange(updated);
                  }
                } catch {}
              }}
              className="transition-colors"
            >
              <h3 className={`text-lg font-semibold mb-3 flex items-center gap-2 ${categoryStyles[category].titleColor}`}>
                {categoryStyles[category].title}
                <span className="text-[11px] font-medium text-slate-400">{list.length}</span>
              </h3>
              <div className={`grid grid-cols-1 gap-4 min-h-[3rem] rounded-md border border-dashed ${list.length? 'border-transparent':'border-slate-300'} p-1`}>
                {list.map((symptom, index) => {
                  const delay = cardIndex * 60;
                  cardIndex++;
                  return <SymptomCard key={`${category}-${symptom.name}`} symptom={symptom} category={category} delay={delay} onRemove={() => {
                    const updated: CategorizedSymptoms = { ...symptoms, [category]: symptoms[category].filter(s=> s.name !== symptom.name) } as CategorizedSymptoms;
                    onChange(updated);
                  }} />;
                })}
                {!list.length && (
                  <div className="text-xs text-slate-400 italic py-4 text-center select-none">Drop symptoms here</div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-auto p-6 border-t border-slate-200/80 bg-white rounded-b-xl text-center">
  <p className="text-slate-600 mb-4 text-sm">Does this summary seem accurate?</p>
        <button
          onClick={onConfirm}
          disabled={isGeneratingReport}
          className="w-full md:w-auto px-8 py-3 bg-indigo-600 text-white rounded-lg font-bold hover:bg-indigo-700 disabled:bg-slate-400 disabled:cursor-wait transition-all flex items-center justify-center shadow-lg shadow-indigo-500/20 focus:outline-none focus:ring-4 focus:ring-indigo-300"
        >
          {isGeneratingReport ? (
            <>
              <Spinner className="w-5 h-5 mr-3" />
              Generating Report...
            </>
          ) : (
            <>
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" />
                <path fillRule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z" clipRule="evenodd" />
              </svg>
              Looks Good, Generate Report
            </>
          )}
        </button>
      </div>
    </div>
  );
};

export default SymptomReview;