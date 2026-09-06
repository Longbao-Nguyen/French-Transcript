import React from 'react';
import { Headphones, Terminal } from 'lucide-react';

interface HeaderProps {
  onOpenColabGuide: () => void;
  isProcessing: boolean;
  statusText?: string;
}

export const Header: React.FC<HeaderProps> = ({
  onOpenColabGuide,
  isProcessing,
  statusText,
}) => {
  return (
    <header className="w-full bg-white/80 backdrop-blur-md border-b border-slate-200 sticky top-0 z-30 py-3.5 px-4 sm:px-6">
      <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-sm shadow-blue-500/20">
            <Headphones className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold text-slate-800 tracking-tight">
                French Transcript Web App
              </h1>
              <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200/60">
                Whisper Large v3
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Convert audio into French transcripts
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          {statusText && (
            <div className="hidden md:flex items-center gap-1.5 px-3 py-1 rounded-full text-xs bg-slate-100 text-slate-600">
              <span className={`w-2 h-2 rounded-full ${isProcessing ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500'}`} />
              <span>{statusText}</span>
            </div>
          )}

          <button
            id="btn-colab-guide"
            onClick={onOpenColabGuide}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 transition-colors cursor-pointer"
          >
            <Terminal className="w-3.5 h-3.5 text-slate-500" />
            <span>Colab GPU Worker</span>
          </button>
        </div>
      </div>
    </header>
  );
};
