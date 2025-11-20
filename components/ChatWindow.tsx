import React, { useState, useRef, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Message, MessageRole } from '../types';
import DrGLogo from './icons/DrGLogo';
import Spinner from './Spinner';
import OptionChips from './OptionChips';
import RangeSlider from './RangeSlider';

interface ChatWindowProps {
  messages: Message[];
  onSendMessage: (message: string) => void;
  isLoading: boolean;
  onReviewSymptoms: () => void;
  isReviewing: boolean;
  isChatting: boolean;
  apsa?: any; // lightweight to avoid circular type import
}

const ChatMessage: React.FC<{ message: Message }> = ({ message }) => {
  const isModel = message.role === MessageRole.MODEL;
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: 'easeOut' }}
      className={`flex items-start gap-3 my-5 ${isModel ? '' : 'flex-row-reverse'}`}
    >
      {isModel ? (
        <div className="bg-indigo-600 text-white w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 shadow-sm">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
        </div>
      ) : (
        <div className="bg-slate-200 text-slate-600 w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
          </svg>
        </div>
      )}
      <div className={`max-w-md p-4 rounded-xl shadow-sm relative overflow-hidden ${isModel ? 'bg-indigo-50 dark:bg-indigo-900/30 text-slate-800 dark:text-slate-200' : 'bg-white dark:bg-slate-700 border border-slate-200/80 dark:border-slate-600/80 text-slate-800 dark:text-slate-200'}`}>
        <div className="absolute inset-0 pointer-events-none opacity-[0.15] bg-[radial-gradient(circle_at_20%_20%,#6366f1,transparent_60%)]" />
        <p className="text-sm relative z-10" dangerouslySetInnerHTML={{ __html: message.content.replace(/\n/g, '<br />') }} />
      </div>
    </motion.div>
  );
};

const ThinkingIndicator: React.FC = () => (
  <div className="flex items-start gap-3 my-5">
    <div className="bg-indigo-600 dark:bg-indigo-500 text-white w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 shadow-sm">
      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
      </svg>
    </div>
    <div className="max-w-md p-4 rounded-xl shadow-sm bg-indigo-50 dark:bg-indigo-900/30 text-slate-800 dark:text-slate-200 animate-pulse">
      <div className="flex items-center gap-2">
        <Spinner className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
        <span className="text-sm font-medium text-slate-600 dark:text-slate-300">Dr.G is thinking...</span>
      </div>
    </div>
  </div>
);

const ChatWindow: React.FC<ChatWindowProps> = ({ messages, onSendMessage, isLoading, onReviewSymptoms, isReviewing, isChatting, apsa }) => {
  const [input, setInput] = useState('');
  const [selectedOptions, setSelectedOptions] = useState<string[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
    setSelectedOptions([]); // Clear selections when new messages arrive
  }, [messages, isLoading]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      const scrollHeight = textareaRef.current.scrollHeight;
      textareaRef.current.style.height = `${scrollHeight}px`;
    }
  }, [input]);

  const handleSend = () => {
    if (input.trim() && !isLoading) {
      onSendMessage(input.trim());
      setInput('');
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Keep both original and lowercase versions of last model message
  const { lastModelQuestion, lastModelOriginal } = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === MessageRole.MODEL) {
        return { lastModelQuestion: messages[i].content.toLowerCase(), lastModelOriginal: messages[i].content };
      }
    }
    return { lastModelQuestion: '', lastModelOriginal: '' };
  }, [messages]);

  // Detect instruction-style prompts (e.g. asking for JSON summary) where quick-answer UI should be hidden
  const isInstructionPrompt = /provide a json|json summary|summarize|please provide.*json/.test(lastModelQuestion);

  const showBooleanOptions = !isInstructionPrompt && /\b(do you|have you|are you|did you)\b/.test(lastModelQuestion);
  // Only show severity slider if user is asked to RATE something explicitly
  const showSeveritySlider = !isInstructionPrompt && /(rate).*(1\s*(-|to|out of)\s*10)|on a scale of 1-10|rate.*sever(i|e)r?ity|rate.*pain/.test(lastModelQuestion);

  // Predictive option generation using APSA hypotheses + last question intent
  const predictiveOptions: string[] = useMemo(() => {
    if (!apsa || !lastModelQuestion || isInstructionPrompt) return [];
    let opts: string[] = [];
    try {
      const snapshot = apsa.getSnapshot?.();
      const q = lastModelQuestion;
      // Infer currently focused primary symptom from recent user or model messages
      const symptomKeywords = ['sore throat', 'throat pain', 'cough', 'fever', 'headache', 'abdominal pain', 'stomach pain', 'nausea', 'vomiting', 'diarrhea', 'chest pain'];
      let currentSymptom = '';
      for (let i = messages.length - 1; i >= 0; i--) {
        const txt = messages[i].content.toLowerCase();
        for (const kw of symptomKeywords) {
          if (txt.includes(kw)) { currentSymptom = kw; break; }
        }
        if (currentSymptom) break;
      }
      // Pattern groups
      const onsetPattern = /(when (did )?it start|when it started|when did (the|your) .* start|how long ago|onset|sudden or gradual|sudden or gradual|started|sudden|gradual)/;
      const locationPattern = /(where exactly|where (is|does)|location|in your (head|throat|abdomen|stomach|chest))/;
      const aggravatePattern = /(what (makes|makes it) (worse|better)|aggravating|alleviating|triggers|worse when|better when)/;
      const characterPattern = /(describe|what kind of|character|type of (pain|cough|headache))/;
      const durationPattern = /(how long|lasting|last|does it last|constant|intermittent|come and go|comes and goes)/;

      const locationMap: Record<string, string[]> = {
        'sore throat': ['Right side', 'Left side', 'Both sides', 'Back of throat', 'Radiates to ear', 'Hard to localize'],
        'throat pain': ['Right side', 'Left side', 'Both sides', 'Back of throat', 'Radiates to ear', 'Hard to localize'],
        'headache': ['Forehead', 'One side', 'Both sides', 'Behind eyes', 'Back of head', 'Neck'],
        'abdominal pain': ['Upper right', 'Upper left', 'Lower right', 'Lower left', 'Center', 'Diffuse'],
        'stomach pain': ['Upper right', 'Upper left', 'Lower right', 'Lower left', 'Center', 'Diffuse'],
        'chest pain': ['Left side', 'Right side', 'Center', 'Diffuse', 'Radiates to arm', 'Radiates to jaw']
      };
      const characterMap: Record<string, string[]> = {
        'sore throat': ['Scratchy', 'Burning', 'Raw', 'Sharp when swallowing', 'Dull ache'],
        'throat pain': ['Scratchy', 'Burning', 'Raw', 'Sharp when swallowing', 'Dull ache'],
        'headache': ['Throbbing', 'Pressure', 'Sharp', 'Dull', 'Pulsating'],
        'cough': ['Dry', 'Productive', 'Barking', 'Tickly', 'Spasmodic'],
        'chest pain': ['Pressure', 'Sharp', 'Burning', 'Tightness', 'Stabbing']
      };
      const aggravateMap: Record<string, string[]> = {
        'sore throat': ['Swallowing', 'Talking', 'Cold air', 'Night', 'Morning', 'Nothing specific'],
        'throat pain': ['Swallowing', 'Talking', 'Cold air', 'Night', 'Morning', 'Nothing specific'],
        'headache': ['Light', 'Noise', 'Movement', 'Coughing', 'Nothing specific'],
        'abdominal pain': ['Eating', 'Not eating', 'Movement', 'Deep breath', 'Nothing specific'],
        'chest pain': ['Exertion', 'Deep breath', 'Lying down', 'Movement', 'Nothing specific']
      };

      if (durationPattern.test(q)) {
        opts = ['Constant', 'Comes and goes', 'Improving', 'Worsening', 'Not sure'];
        return opts;
      }
      if (onsetPattern.test(q)) {
        opts = ['Sudden', 'Gradual', 'Not sure', 'Can\'t remember'];
        return opts;
      }
      if (locationPattern.test(q)) {
        const base = locationMap[currentSymptom] || ['One area', 'Multiple areas', 'All over', 'Hard to localize'];
        return base;
      }
      if (aggravatePattern.test(q)) {
        const base = aggravateMap[currentSymptom] || ['Movement', 'Rest', 'Eating', 'Night', 'Morning', 'Exercise'];
        return base;
      }
      if (characterPattern.test(q)) {
        const base = characterMap[currentSymptom] || ['Sharp', 'Dull', 'Pressure', 'Burning', 'Stabbing'];
        return base;
      }
      // If question is clarifying presence of already mentioned symptom, show qualifiers
      const qualifierTriggers = /(where|location|worse|better|character|type|kind|how long|duration|when did|what time|trigger|aggravate|constant|gradual)/;
      if (qualifierTriggers.test(q)) {
        if (/location|where/.test(q)) opts = ['Head', 'Chest', 'Abdomen', 'Back', 'Joints', 'All over'];
        else if (/duration|how long|when did/.test(q)) opts = ['Minutes', 'Hours', 'Days', 'Weeks', 'Months'];
        else if (/worse|better|trigger|aggravate/.test(q)) opts = ['Movement', 'Rest', 'Eating', 'Night', 'Morning', 'Exercise'];
        else opts = ['Mild', 'Moderate', 'Severe'];
        return opts;
      }
      // If the model asks about additional symptoms
      if (/other symptom|any other|anything else|additional symptom/.test(q)) {
        // Suggest high information gain symptoms from hypotheses
        const hyp = snapshot?.hypotheses || [];
        const evidenceNames = new Set((snapshot?.evidence || []).map((e: any) => e.name));
        const candidates: Record<string, number> = {};
        for (const h of hyp) {
          const condition = h.condition;
          const tokens = apsa.knowledge ? apsa.knowledge[condition] : undefined;
          if (!tokens) continue;
          for (const t of tokens) {
            if (evidenceNames.has(t)) continue;
            if (!/pain|fever|cough|rash|headache|nausea|vomit|swelling|fatigue|diarrhea|shortness of breath|sore|throat|runny nose|stiff|chills/.test(t)) continue;
            candidates[t] = Math.max(candidates[t] || 0, h.probability);
          }
        }
        opts = Object.entries(candidates)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 8)
          .map(([k]) => k);
        return opts;
      }
      // If APSA proposed question (stored elsewhere) asked about a specific symptom pattern like 'have you experienced X'
      const m = q.match(/have you experienced ([a-z0-9 \-]+)/);
      if (m) {
        const symptom = m[1].trim();
        // Provide Yes/No plus related co-occurring symptoms
        const co = apsa.getCooccurring?.(symptom, 4) || [];
        opts = ['Yes', 'No', 'Not sure', ...co.slice(0, 4).map(c => `Also ${c}`)];
        return opts;
      }
      return [];
    } catch (e) {
      return [];
    }
  }, [apsa, lastModelQuestion, messages]);

  // Extract enumerated symptom options when model lists them (after 'like', 'such as')
  const symptomOptions = useMemo(() => {
    if (!lastModelQuestion || isInstructionPrompt) return [] as string[];
    const likeIdx = lastModelQuestion.indexOf('like ');
    let segment = '';
    if (likeIdx !== -1) {
      segment = lastModelQuestion.slice(likeIdx + 5);
    } else {
      const suchAsIdx = lastModelQuestion.indexOf('such as ');
      if (suchAsIdx !== -1) segment = lastModelQuestion.slice(suchAsIdx + 8);
    }
    if (!segment) return [];
    segment = segment.split('?')[0];
    const raw = segment.split(/,|\bor\b|\band\b/).map(s => s.trim());
    const cleaned = raw
      .map(s => s.replace(/^(a|an|any|other)\s+/, '').replace(/\.$/, ''))
      .filter(s => s.length > 2 && /[a-z]/.test(s) && !/symptom/.test(s) && !/like/.test(s));
    // de-dup
    return Array.from(new Set(cleaned));
  }, [lastModelQuestion]);

  const buildContextualAnswer = (raw: string | string[]): string => {
    // Handle multi-select array
    if (Array.isArray(raw)) {
      if (raw.length === 0) return '';
      const items = raw.map(r => r.replace(/^(Also )/i, '')); // clean up "Also X"
      if (items.includes('None of these') || items.includes('No other symptoms')) return "I don't have any of those symptoms.";

      const joined = items.length > 1
        ? items.slice(0, -1).join(', ') + ' and ' + items.slice(-1)
        : items[0];
      return `I am experiencing ${joined}.`;
    }

    // Only enrich Yes/No/Not sure answers
    if (!/^(yes|no|not sure)$/i.test(raw) || !lastModelOriginal) return raw;
    // Extract the core phenomenon from the question
    let q = lastModelOriginal.replace(/\s+/g, ' ').trim();
    // Remove trailing question mark
    q = q.replace(/\?+$/, '');
    // Try to grab clause after common starters
    const patterns = [
      /are you saying (you )?/i,
      /are you experiencing /i,
      /do you (feel|have) /i,
      /have you noticed /i,
      /are you /i
    ];
    let clause = '';
    for (const p of patterns) {
      if (p.test(q)) { clause = q.split(p)[1]; break; }
    }
    if (!clause) {
      // Fallback: use whole question after first capitalized sentence start
      clause = q.toLowerCase().startsWith("i want to make sure") ? q.split('? ').pop() || q : q;
    }
    clause = clause.replace(/^that\s+/i, '').replace(/^you\s+/i, '').replace(/^the\s+/i, 'the ');
    clause = clause.replace(/^feel\s+/i, '').replace(/^have\s+/i, '').trim();
    if (raw.toLowerCase() === 'yes') return `Yes, I am experiencing ${clause}.`;
    if (raw.toLowerCase() === 'no') return `No, I'm not experiencing ${clause}.`;
    return `I'm not sure about ${clause}.`;
  };

  const handleQuickSelect = (val: string) => {
    // If there are selected symptoms and this is a severity value, combine them
    if (selectedOptions.length > 0 && val.startsWith('Severity')) {
      const symptomsText = buildContextualAnswer(selectedOptions);
      const combinedMessage = `${symptomsText} ${val}.`;
      setSelectedOptions([]); // Clear selections after sending
      onSendMessage(combinedMessage);
    } else {
      onSendMessage(buildContextualAnswer(val));
    }
  };

  const handleMultiSelectToggle = (val: string) => {
    setSelectedOptions(prev => {
      if (val === 'None of these') return ['None of these'];
      // If selecting something else, remove 'None of these' if present
      const cleanPrev = prev.filter(p => p !== 'None of these');

      if (cleanPrev.includes(val)) return cleanPrev.filter(p => p !== val);
      return [...cleanPrev, val];
    });
  };

  const handleConfirmSelection = () => {
    if (selectedOptions.length === 0) return;
    onSendMessage(buildContextualAnswer(selectedOptions));
  };

  const shouldShowPredictive = predictiveOptions.length > 0;

  return (
    <div className="w-full h-full bg-gradient-to-br from-slate-50 to-white dark:from-slate-800 dark:to-slate-900 rounded-2xl shadow-xl border border-slate-200/70 dark:border-slate-700/70 flex flex-col overflow-hidden ring-1 ring-black/5 dark:ring-white/5 backdrop-blur transition-colors duration-300">
      <div className="p-4 border-b border-slate-200/60 dark:border-slate-700/60 flex-shrink-0 bg-white/70 dark:bg-slate-800/70 backdrop-blur supports-[backdrop-filter]:bg-white/40 dark:supports-[backdrop-filter]:bg-slate-800/40">
        <DrGLogo />
      </div>
      <div className="flex-1 overflow-y-auto p-6 pb-4 space-y-1">
        {messages.map((msg, index) => (
          <ChatMessage key={index} message={msg} />
        ))}
        {isLoading && messages[messages.length - 1]?.role === MessageRole.USER && <ThinkingIndicator />}
        <div ref={messagesEndRef} />
      </div>
      {(showBooleanOptions || showSeveritySlider || symptomOptions.length > 1 || shouldShowPredictive) && (
        <div className="px-6 pb-4 pt-2 space-y-3 bg-gradient-to-t from-white via-white to-transparent">
          {showBooleanOptions && (
            <OptionChips options={["Yes", "No", "Not sure"]} disabled={isLoading} onSelect={handleQuickSelect} />
          )}
          {showSeveritySlider && (
            <div className="animate-[fadeIn_0.35s_ease]">
              <RangeSlider label="Severity" onCommit={(v) => handleQuickSelect(`Severity ${v} out of 10`)} />
            </div>
          )}
          {symptomOptions.length > 1 && (
            <div className="mt-3">
              <OptionChips
                options={[...symptomOptions.map(o => o), 'None of these']}
                selected={selectedOptions}
                allowMultiple={true}
                disabled={isLoading}
                onSelect={(val) => {
                  if (val === 'None of these') {
                    // Immediate send for "None" if it's the only thing? Or just select it?
                    // Let's select it to be consistent.
                    handleMultiSelectToggle(val);
                  } else {
                    handleMultiSelectToggle(val);
                  }
                }}
              />
            </div>
          )}
          {shouldShowPredictive && !showBooleanOptions && predictiveOptions.length > 0 && (
            <div className="mt-3">
              <OptionChips
                options={predictiveOptions}
                selected={selectedOptions}
                allowMultiple={true}
                disabled={isLoading}
                onSelect={handleMultiSelectToggle}
              />
            </div>
          )}
          {(selectedOptions.length > 0) && (
            <div className="mt-3 flex justify-end animate-[fadeIn_0.2s_ease]">
              <button
                onClick={handleConfirmSelection}
                className="px-4 py-1.5 bg-indigo-600 text-white text-sm font-semibold rounded-lg shadow-md hover:bg-indigo-700 transition-colors flex items-center gap-2"
              >
                <span>Send Selected</span>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
          )}
        </div>
      )}

      {isChatting && messages.length > 1 && (
        <div className="px-6 pb-4 text-center">
          <button
            onClick={onReviewSymptoms}
            disabled={isLoading || isReviewing}
            className="px-6 py-2.5 bg-white dark:bg-slate-700 text-indigo-700 dark:text-indigo-300 rounded-lg font-semibold text-sm hover:bg-indigo-50 dark:hover:bg-slate-600 transition-all border border-indigo-200 dark:border-indigo-700 shadow-sm flex items-center justify-center mx-auto gap-2 disabled:opacity-50"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            I'm done, review my symptoms
          </button>
        </div>
      )}

      <div className="mt-auto p-4 border-t border-slate-200/60 dark:border-slate-700/60 bg-white/80 dark:bg-slate-800/80 backdrop-blur">
        <div className="relative">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Describe what you're feeling..."
            rows={1}
            className="w-full p-3 pr-12 bg-slate-100/80 dark:bg-slate-700/80 rounded-xl text-sm text-slate-800 dark:text-slate-200 placeholder-slate-500 dark:placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-400 dark:focus:ring-indigo-500 resize-none overflow-y-hidden transition-all shadow-inner"
            disabled={isLoading || isReviewing}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isLoading || isReviewing}
            className="absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 bg-gradient-to-br from-indigo-600 to-violet-600 dark:from-indigo-500 dark:to-violet-500 text-white rounded-xl flex items-center justify-center hover:from-indigo-500 hover:to-violet-500 dark:hover:from-indigo-400 dark:hover:to-violet-400 disabled:bg-slate-400 dark:disabled:bg-slate-600 disabled:cursor-not-allowed transition-all shadow focus:outline-none focus:ring-4 focus:ring-indigo-300 dark:focus:ring-indigo-600"
            aria-label="Send message"
          >
            {isLoading ? <Spinner className="w-4 h-4" /> : (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 transform rotate-90" viewBox="0 0 20 20" fill="currentColor">
                <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.428A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
              </svg>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChatWindow;
