import React, { useState, useRef, useEffect } from 'react';
import { Report } from '../types';
import Spinner from './Spinner';

interface ReportViewProps {
  report: Report;
  onStartOver: () => void;
}

type Tab = 'summary' | 'pdf' | 'clinician';

const ReportView: React.FC<ReportViewProps> = ({ report, onStartOver }) => {
  const [activeTab, setActiveTab] = useState<Tab>('summary');
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [isIframeLoading, setIsIframeLoading] = useState(true);

  useEffect(() => {
    if (activeTab === 'pdf') {
      setIsIframeLoading(true);
      const iframe = iframeRef.current;
      if (!iframe) return;

      const handleLoad = () => {
        // A small delay ensures content is fully rendered before hiding spinner
        setTimeout(() => setIsIframeLoading(false), 300);
      };

      iframe.addEventListener('load', handleLoad);
      // Re-attach srcDoc to trigger load event on tab switch
      iframe.srcdoc = report.professionalReportHtml;

      return () => iframe.removeEventListener('load', handleLoad);
    }
  }, [activeTab, report.professionalReportHtml]);

  const handlePrint = () => {
    const iframe = iframeRef.current;
    if (!iframe?.contentWindow) return;
    iframe.contentWindow.focus();
    iframe.contentWindow.print();
  };

  const handleDownload = () => {
    const blob = new Blob([report.professionalReportHtml], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'DrG_Symptom_Report.html';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const getTabClass = (tabName: Tab) => {
    return activeTab === tabName
      ? 'border-[#6366f1] text-[#6366f1]'
      : 'border-transparent text-[#94a3b8] hover:text-[#818cf8] hover:border-[#1e293b]';
  };

  return (
    <div className="w-full h-full bg-[#1e293b] rounded-xl shadow-md border border-[#334155] flex flex-col">
      <div className="p-6 border-b border-slate-700 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-100">Your Health Report is Ready</h2>
          <p className="text-sm text-slate-400 mt-1">Review the summaries or print the professional report for your doctor.</p>
        </div>
        <button
          onClick={onStartOver}
          className="px-4 py-2 bg-[#0f172a] text-[#f1f5f9] rounded-lg font-semibold text-sm hover:bg-slate-800 transition-all border border-[#334155] shadow-sm focus:outline-none focus:ring-4 focus:ring-indigo-500/50"
        >
          Start New Session
        </button>
      </div>

      <div className="flex-1 p-6 flex flex-col min-h-0">
        <div className="border-b border-[#334155] mb-6">
          <nav className="-mb-px flex space-x-6" aria-label="Tabs">
            <button onClick={() => setActiveTab('summary')} className={`whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm transition-colors focus:outline-none ${getTabClass('summary')}`}>
              For You
            </button>
            <button onClick={() => setActiveTab('pdf')} className={`whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm transition-colors focus:outline-none ${getTabClass('pdf')}`}>
              Professional Report
            </button>
            <button onClick={() => setActiveTab('clinician')} className={`whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm transition-colors focus:outline-none ${getTabClass('clinician')}`}>
              Clinician Notes
            </button>
          </nav>
        </div>

        <div className="flex-1 overflow-y-auto min-h-0">
          {activeTab === 'summary' && (
            <div className="prose prose-sm max-w-none prose-invert bg-[#0f172a] p-6 rounded-lg border border-[#334155] text-slate-300">
              <h3 className="text-lg font-semibold text-[#818cf8] mt-0">Plain Language Summary</h3>
              <div dangerouslySetInnerHTML={{ __html: report.userSummary.replace(/\n/g, '<br />') }} />
            </div>
          )}
          {activeTab === 'clinician' && (
            <div className="prose prose-sm max-w-none prose-invert bg-[#0f172a] p-6 rounded-lg border border-[#334155] text-slate-300">
              <h3 className="text-lg font-semibold text-[#818cf8] mt-0">Notes for Your Clinician</h3>
              <div dangerouslySetInnerHTML={{ __html: report.clinicianReport.replace(/\n/g, '<br />') }} />
            </div>
          )}
          {activeTab === 'pdf' && (
            <div className="flex flex-col h-full">
              <div className="flex justify-end gap-x-3 mb-4 flex-shrink-0">
                <button
                  onClick={handleDownload}
                  className="px-4 py-2 bg-slate-600 text-white rounded-lg font-semibold text-sm hover:bg-slate-700 transition-all flex items-center shadow-sm"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                  Download
                </button>
                <button
                  onClick={handlePrint}
                  disabled={isIframeLoading}
                  className="px-4 py-2 bg-[#6366f1] text-white rounded-lg font-semibold text-sm hover:opacity-90 transition-opacity flex items-center shadow-sm disabled:bg-[#334155] disabled:text-slate-400 disabled:cursor-wait focus:outline-none focus:ring-4 focus:ring-indigo-500/50"
                >
                  {isIframeLoading ? (
                    <>
                      <Spinner className="w-4 h-4 mr-2" />
                      Preparing...
                    </>
                  ) : (
                    <>
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M5 4v3H4a2 2 0 00-2 2v3a2 2 0 002 2h1v3a2 2 0 002 2h6a2 2 0 002-2v-3h1a2 2 0 002-2V9a2 2 0 00-2-2h-1V4a2 2 0 00-2-2H7a2 2 0 00-2 2zm8 0H7v3h6V4zm0 8H7v4h6v-4z" clipRule="evenodd" />
                      </svg>
                      Print
                    </>
                  )}
                </button>
              </div>
              <div className="relative flex-1 min-h-[500px]">
                {isIframeLoading && (
                  <div className="absolute inset-0 bg-[#0f172a]/80 backdrop-blur-sm flex justify-center items-center rounded-lg z-10">
                    <div className="flex flex-col items-center gap-y-2 text-[#f1f5f9]">
                      <Spinner className="w-6 h-6 text-[#6366f1]" />
                      <span>Loading Report Preview...</span>
                    </div>
                  </div>
                )}
                <iframe
                  ref={iframeRef}
                  srcDoc={report.professionalReportHtml}
                  title="Professional Symptoms Report"
                  className="w-full h-full border border-[#334155] rounded-lg bg-white"
                />
              </div>
            </div>
          )}
        </div>
      </div>
      <div className="p-4 bg-indigo-950/40 border-t border-indigo-900/50 text-indigo-200 text-xs text-center rounded-b-xl mt-auto flex-shrink-0">
        <strong>Disclaimer:</strong> This is not a medical diagnosis. Always consult with a qualified healthcare provider for any health concerns.
      </div>
    </div>
  );
};

export default ReportView;
