
import React, { useState, useEffect, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  AppState,
  Message,
  MessageRole,
  CategorizedSymptoms,
  Report,
} from './types';
// import { startChatSession, getCategorizedSymptoms, generateFinalReport, configureApiKey, ChatSession } from './services/geminiService';
import { sendMessageToAPSA, getCategorizedSymptoms, generateFinalReport, ChatMessage as ApiChatMessage } from './services/apsaService';
import DrGLogo from './components/icons/DrGLogo';
import ChatWindow from './components/ChatWindow';
import SymptomReview from './components/SymptomReview';
import ReportView from './components/ReportView';
import Spinner from './components/Spinner';


const App: React.FC = () => {
  const [appState, setAppState] = useState<AppState>(AppState.GREETING);
  // const [chat, setChat] = useState<ChatSession | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [categorizedSymptoms, setCategorizedSymptoms] =
    useState<CategorizedSymptoms | null>(null);
  const [report, setReport] = useState<Report | null>(null);

  // APSA State
  const [currentSymptoms, setCurrentSymptoms] = useState<string[]>([]);
  const [apsaData, setApsaData] = useState<{ predictiveChips: string[] }>({ predictiveChips: [] });


  // Ensure API key is configured on app load
  useEffect(() => {
    // configureApiKey();
  }, []);

  const initChat = useCallback(async () => {
    setIsLoading(true);
    setAppState(AppState.CHATTING);
    try {
      // Backend is stateless
      setMessages([{ role: MessageRole.MODEL, content: "Hello, I'm Dr.G, your AI health companion. I can help organize your symptoms and create a report for your doctor. I don't give medical advice or diagnoses. To get started, could you please tell me what's been bothering you today?" }]);
    } catch (error: any) {
      console.error('Failed to initialize chat', error);
      setMessages([{ role: MessageRole.MODEL, content: 'Sorry, I\'m having trouble connecting right now. Please try again later.' }]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleSendMessage = useCallback(async (content: string) => {
    if (isLoading) return;

    const userMessage: Message = { role: MessageRole.USER, content };
    setMessages((prev) => [...prev, userMessage]);
    setIsLoading(true);

    try {
      // Build history for backend
      const history: ApiChatMessage[] = messages.map(m => ({
        role: m.role === MessageRole.USER ? 'user' : 'model',
        content: m.content
      }));

      // Call RAG Backend
      const response = await sendMessageToAPSA(content, history, currentSymptoms);

      // Update state with extraction results
      if (response.extractedSymptoms && response.extractedSymptoms.length > 0) {
        setCurrentSymptoms(prev => Array.from(new Set([...prev, ...response.extractedSymptoms])));
      }

      setApsaData({ predictiveChips: response.predictiveChips || [] });

      const modelMessage: Message = { role: MessageRole.MODEL, content: response.nextQuestion };
      setMessages((prev) => [...prev, modelMessage]);

      // Keep the local chat session in sync if we need it for final report generation later
      // (The backend is stateless, but generating the final report might use the client-side ChatSession if we kept that logic)
      // Actually, since we switched geminiService to just be a wrapper, we should probably update its history manually or 
      // rely on the backend for everything. For now, let's just push to the local chat object if it exists.
      // But `chat` object in geminiService is stateful.
      // Ideally, the backend should handle the full conversation.
      // For this refactor, we are using the backend for the "interview" phase.
      // The `chat` object was used for `startChatSession`. 
      // We might need to manually inject history into `chat` if we use `generateFinalReport` which depends on `ChatSession`.
      // Let's assume `generateFinalReport` will just work if we pass it the accumulated text or similar.
      // Wait, `generateFinalReport` uses `chat.sendMessage`.
      // We should probably just re-instantiate a ChatSession with full history when needed for reporting.

    } catch (error) {
      console.error("Failed to send message:", error);
      const errorMessage: Message = { role: MessageRole.MODEL, content: "I encountered an error connecting to the server. Please try again." };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  }, [messages, currentSymptoms, isLoading]);

  const handleReviewSymptoms = useCallback(async () => {
    setAppState(AppState.REVIEWING);
    setIsLoading(true);
    try {
      // Build history
      const history: ApiChatMessage[] = messages.map(m => ({
        role: m.role === MessageRole.USER ? 'user' : 'model',
        content: m.content
      }));

      const symptoms = await getCategorizedSymptoms(history);
      setCategorizedSymptoms(symptoms);
    } catch (error) {
      console.error("Failed to get symptoms:", error);
      const errorMessage: Message = { role: MessageRole.MODEL, content: "I had trouble summarizing the symptoms. Could we try that again?" };
      setMessages((prev) => [...prev, errorMessage]);
      setAppState(AppState.CHATTING);
    } finally {
      setIsLoading(false);
    }
  }, [messages]);

  const handleConfirmSymptoms = useCallback(async () => {
    if (!categorizedSymptoms || isLoading) return;
    setAppState(AppState.GENERATING_REPORT);
    setIsLoading(true);
    try {
      // Build history
      const history: ApiChatMessage[] = messages.map(m => ({
        role: m.role === MessageRole.USER ? 'user' : 'model',
        content: m.content
      }));

      const finalReport = await generateFinalReport(history, categorizedSymptoms);
      setReport(finalReport);
      setAppState(AppState.REPORTING);
    } catch (error) {
      console.error("Failed to generate report:", error);
      const errorMessage: Message = { role: MessageRole.MODEL, content: "I'm sorry, I couldn't generate the final report. Please let me know if you'd like me to try again." };
      setMessages((prev) => [...prev, errorMessage]);
      setAppState(AppState.REVIEWING);
    } finally {
      setIsLoading(false);
    }
  }, [messages, categorizedSymptoms, isLoading]);


  const handleStartOver = () => {
    setAppState(AppState.GREETING);
    // setChat(null);
    setMessages([]);
    setIsLoading(false);
    setCategorizedSymptoms(null);
    setReport(null);
    setCurrentSymptoms([]);
    setApsaData({ predictiveChips: [] });
  };

  const renderContent = () => {
    switch (appState) {
      case AppState.GREETING:
        return (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col items-center justify-center h-full text-center p-4">
            <DrGLogo className="mb-6" />
            <h1 className="text-4xl font-bold text-[#f1f5f9] font-['Figtree'] tracking-tight">Meet Dr.G</h1>
            <p className="mt-4 max-w-lg text-[#f1f5f9]/80 font-['Noto_Sans']">
              Your AI health companion. I'm here to listen to your symptoms and prepare a detailed report for you to share with a healthcare professional.
            </p>
            <div className="mt-8 p-4 bg-slate-800 border-l-4 border-indigo-500 text-slate-300 text-sm max-w-lg rounded-r-lg text-left">
              <strong>Disclaimer:</strong> I do not provide medical advice, diagnoses, or prescriptions. In case of a medical emergency, please contact your local emergency services immediately.
            </div>
            <button
              onClick={initChat}
              disabled={isLoading}
              className="mt-8 px-8 py-3 bg-[#6366f1] text-white rounded-lg font-semibold hover:opacity-90 transition-opacity flex items-center shadow-md focus:outline-none focus:ring-4 focus:ring-indigo-500/50 disabled:bg-indigo-300 disabled:cursor-not-allowed font-['Figtree']"
            >
              Start Symptom Interview
            </button>
          </motion.div>
        );
      case AppState.CHATTING:
      case AppState.REVIEWING:
      case AppState.GENERATING_REPORT:
        return (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-full">
            <ChatWindow
              messages={messages}
              onSendMessage={handleSendMessage}
              isLoading={isLoading}
              onReviewSymptoms={handleReviewSymptoms}
              isReviewing={appState === AppState.REVIEWING}
              isChatting={appState === AppState.CHATTING}
              predictiveChips={apsaData.predictiveChips}
            />
            <SymptomReview
              symptoms={categorizedSymptoms}
              onConfirm={handleConfirmSymptoms}
              isGeneratingReport={appState === AppState.GENERATING_REPORT}
              onChange={(u) => setCategorizedSymptoms(u)}
            />
          </div>
        );
      case AppState.REPORTING:
        return report ? <ReportView report={report} onStartOver={handleStartOver} /> : null;
      default:
        return null;
    }
  };

  return (
    <div className="h-screen p-4 md:p-6 lg:p-8 bg-[#0f172a] flex flex-col transition-colors duration-300 font-['Noto_Sans']">
      <header className="mb-6 flex-shrink-0">
        <DrGLogo />
      </header>
      <main className="flex-1 min-h-0 overflow-y-auto">
        <AnimatePresence mode="wait">
          {renderContent()}
        </AnimatePresence>
      </main>
    </div>
  );
};

export default App;
