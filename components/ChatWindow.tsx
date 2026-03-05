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
  predictiveChips: string[];
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
        <div className="bg-[#6366f1] text-white w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 shadow-sm">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
        </div>
      ) : (
        <div className="bg-[#1e293b] text-[#f1f5f9] w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
          </svg>
        </div>
      )}
      <div className={`max-w-md p-4 rounded-xl shadow-sm relative overflow-hidden ${isModel ? 'bg-[#334155] text-[#f1f5f9]' : 'bg-[#0f172a] border border-[#334155] text-[#f1f5f9]'}`}>
        <p className="text-sm relative z-10" dangerouslySetInnerHTML={{ __html: message.content.replace(/\n/g, '<br />') }} />
      </div>
    </motion.div>
  );
};

const ThinkingIndicator: React.FC = () => (
  <div className="flex items-start gap-3 my-5">
    <div className="bg-[#6366f1] text-white w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 shadow-sm">
      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
      </svg>
    </div>
    <div className="max-w-md p-4 rounded-xl shadow-sm bg-[#334155] text-[#f1f5f9] animate-pulse">
      <div className="flex items-center gap-2">
        <Spinner className="w-4 h-4 text-[#6366f1]" />
        <span className="text-sm font-medium text-[#f1f5f9]">Dr.G is thinking...</span>
      </div>
    </div>
  </div>
);

const ChatWindow: React.FC<ChatWindowProps> = ({ messages, onSendMessage, isLoading, onReviewSymptoms, isReviewing, isChatting, predictiveChips }) => {
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
    // Send the value directly without combining with selected options
    onSendMessage(buildContextualAnswer(val));
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

  const shouldShowPredictive = predictiveChips && predictiveChips.length > 0;

  return (
    <div className="w-full h-full bg-[#1e293b] rounded-2xl shadow-md border border-[#334155] flex flex-col overflow-hidden transition-colors duration-300">
      <div className="p-4 border-b border-[#334155] flex-shrink-0 bg-[#1e293b]/90 backdrop-blur supports-[backdrop-filter]:bg-[#1e293b]/80">
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
        <div className="px-6 pb-4 pt-2 space-y-3 bg-gradient-to-t from-[#1e293b] via-[#1e293b] to-transparent">
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
          {shouldShowPredictive && !showBooleanOptions && (
            <div className="mt-3">
              <OptionChips
                options={predictiveChips}
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
                className="px-4 py-1.5 bg-[#6366f1] text-white text-sm font-semibold rounded-lg shadow-sm hover:opacity-90 transition-opacity flex items-center gap-2 focus:outline-none focus:ring-4 focus:ring-indigo-500/50"
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
            className="px-6 py-2.5 bg-[#0f172a] text-[#6366f1] rounded-lg font-semibold text-sm hover:bg-[#1e293b] transition-colors border border-[#6366f1] shadow-sm flex items-center justify-center mx-auto gap-2 disabled:opacity-50 focus:outline-none focus:ring-4 focus:ring-indigo-500/50"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            I'm done, review my symptoms
          </button>
        </div>
      )}

      <div className="mt-auto p-4 border-t border-[#334155] bg-[#1e293b]">
        <div className="relative">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Describe what you're feeling..."
            rows={1}
            className="w-full p-3 pr-12 bg-[#0f172a] border border-[#334155] rounded-xl text-sm text-[#f1f5f9] placeholder-[#94a3b8] focus:outline-none focus:ring-2 focus:ring-[#6366f1] resize-none overflow-y-hidden transition-all shadow-inner"
            disabled={isLoading || isReviewing}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isLoading || isReviewing}
            className="absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 bg-[#6366f1] text-white rounded-xl flex items-center justify-center hover:opacity-90 disabled:bg-[#334155] disabled:text-[#f1f5f9] disabled:cursor-not-allowed transition-opacity shadow focus:outline-none focus:ring-4 focus:ring-indigo-500/50"
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
