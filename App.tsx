import React, { useState, useEffect, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { Chat } from '@google/genai';
import {
  AppState,
  Message,
  MessageRole,
  CategorizedSymptoms,
  Report,
} from './types';
import { startChatSession, getCategorizedSymptoms, generateFinalReport } from './services/geminiService';
import APSAEngine from './services/apsaEngine';
import DrGLogo from './components/icons/DrGLogo';
import ChatWindow from './components/ChatWindow';
import SymptomReview from './components/SymptomReview';
import ReportView from './components/ReportView';
import Spinner from './components/Spinner';


const App: React.FC = () => {
  const [appState, setAppState] = useState<AppState>(AppState.GREETING);
  const [chat, setChat] = useState<Chat | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [categorizedSymptoms, setCategorizedSymptoms] =
    useState<CategorizedSymptoms | null>(null);
  const [report, setReport] = useState<Report | null>(null);
  const [apsa, setApsa] = useState<APSAEngine | null>(null);
  const [proposedQuestion, setProposedQuestion] = useState<string | null>(null);
  const [datasetLoaded, setDatasetLoaded] = useState<boolean>(false);

  // Load dataset once
  useEffect(() => {
    fetch('mayo_all_letters_symptoms.json').then(r => r.json()).then(data => {
      setApsa(new APSAEngine(data.slice(0, 400))); // slice small subset for performance
      setDatasetLoaded(true);
    }).catch(err => console.error('Failed loading dataset', err));
  }, []);

  const initChat = useCallback(async () => {
    setIsLoading(true);
    setAppState(AppState.CHATTING);
    try {
      const chatSession = await startChatSession();
      setChat(chatSession);
      const response = await chatSession.sendMessage({ message: "Hello, please begin the interview." });
      setMessages([{ role: MessageRole.MODEL, content: response.text }]);
    } catch (error: any) {
      console.error('Failed to initialize chat', error);
      setMessages([{ role: MessageRole.MODEL, content: error?.message?.includes('Missing API key') ? 'API key missing. Please add VITE_GEMINI_API_KEY to .env.local and reload.' : 'Sorry, I\'m having trouble connecting right now. Please try again later.' }]);
      // Stay in chatting view so user sees message & can retry
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleSendMessage = useCallback(async (content: string) => {
    if (!chat || isLoading) return;

    const userMessage: Message = { role: MessageRole.USER, content };
    setMessages((prev) => [...prev, userMessage]);
    setIsLoading(true);

    try {
      // Feed free text into APSA extractor BEFORE model call to capture raw description
      if (apsa) apsa.addUserFreeText(content, messages.length);
      const response = await chat.sendMessage({ message: content });
      const modelMessage: Message = { role: MessageRole.MODEL, content: response.text };
      setMessages((prev) => [...prev, modelMessage]);
      // After model response, propose APSA question if available
      if (apsa) {
        const plan = apsa.proposeQuestion();
        setProposedQuestion(plan?.question || null);
      }
    } catch (error) {
      console.error("Failed to send message:", error);
      const errorMessage: Message = { role: MessageRole.MODEL, content: "I encountered an error. Please try again." };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  }, [chat, isLoading]);

  const handleReviewSymptoms = useCallback(async () => {
    if (!chat || isLoading) return;
    setAppState(AppState.REVIEWING);
    setIsLoading(true);
    try {
      const symptoms = await getCategorizedSymptoms(chat);
      setCategorizedSymptoms(symptoms);
    } catch (error) {
      console.error("Failed to get symptoms:", error);
      const errorMessage: Message = { role: MessageRole.MODEL, content: "I had trouble summarizing the symptoms. Could we try that again? Please confirm when you're ready to review." };
      setMessages((prev) => [...prev, errorMessage]);
      setAppState(AppState.CHATTING);
    } finally {
      setIsLoading(false);
    }
  }, [chat, isLoading]);

  const handleConfirmSymptoms = useCallback(async () => {
    if (!chat || !categorizedSymptoms || isLoading) return;
    setAppState(AppState.GENERATING_REPORT);
    setIsLoading(true);
    try {
      const finalReport = await generateFinalReport(chat, categorizedSymptoms);
      setReport(finalReport);
      setAppState(AppState.REPORTING);
    } catch (error) {
      console.error("Failed to generate report:", error);
      const errorMessage: Message = { role: MessageRole.MODEL, content: "I'm sorry, I couldn't generate the final report. Please let me know if you'd like me to try again." };
      setMessages((prev) => [...prev, errorMessage]);
      setAppState(AppState.REVIEWING); // Go back to review state
    } finally {
      setIsLoading(false);
    }
  }, [chat, categorizedSymptoms, isLoading]);


  const handleStartOver = () => {
    setAppState(AppState.GREETING);
    setChat(null);
    setMessages([]);
    setIsLoading(false);
    setCategorizedSymptoms(null);
    setReport(null);
    setProposedQuestion(null);
  };

  const renderContent = () => {
    switch (appState) {
      case AppState.GREETING:
        return (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col items-center justify-center h-full text-center p-4">
            <DrGLogo className="mb-6" />
            <h1 className="text-4xl font-bold text-slate-800 dark:text-slate-100">Meet Dr.G</h1>
            <p className="mt-4 max-w-lg text-slate-600 dark:text-slate-300">
              Your AI health companion. I'm here to listen to your symptoms and prepare a detailed report for you to share with a healthcare professional.
            </p>
            <div className="mt-8 p-4 bg-amber-50 dark:bg-amber-900/30 border-l-4 border-amber-400 dark:border-amber-500 text-amber-900/90 dark:text-amber-200 text-sm max-w-lg rounded-r-lg text-left">
              <strong>Disclaimer:</strong> I do not provide medical advice, diagnoses, or prescriptions. In case of a medical emergency, please contact your local emergency services immediately.
            </div>
            <button
              onClick={initChat}
              disabled={isLoading}
              className="mt-8 px-8 py-3 bg-indigo-600 dark:bg-indigo-500 text-white rounded-lg font-bold hover:bg-indigo-700 dark:hover:bg-indigo-600 disabled:bg-indigo-400 dark:disabled:bg-indigo-700 transition-all flex items-center shadow-lg shadow-indigo-500/30 focus:outline-none focus:ring-4 focus:ring-indigo-300 dark:focus:ring-indigo-600"
            >
              Start Symptom Interview
            </button>
            {!datasetLoaded && <p className="mt-4 text-xs text-slate-500 dark:text-slate-400 animate-pulse">Loading knowledge base...</p>}
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
              apsa={apsa}
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
    <div className="h-screen p-4 md:p-6 lg:p-8 bg-gradient-to-br from-indigo-50 via-white to-violet-50 dark:from-slate-900 dark:via-slate-800 dark:to-indigo-950 flex flex-col transition-colors duration-300">
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
