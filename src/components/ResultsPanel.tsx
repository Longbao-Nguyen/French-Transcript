import React, { useEffect, useRef, useState } from 'react';
import { FileText, Download, Copy, Check, Loader2 } from 'lucide-react';
import { SegmentResult } from '../types';

interface ResultsPanelProps {
  segments: SegmentResult[];
  doneSegments: number;
  totalSegments: number;
  isProcessing: boolean;
  onDownload: () => void;
  fileName?: string;
}

export const ResultsPanel: React.FC<ResultsPanelProps> = ({
  segments,
  doneSegments,
  totalSegments,
  isProcessing,
  onDownload,
  fileName,
}) => {
  const [copied, setCopied] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll when new segment arrives
  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
    }
  }, [segments.length]);

  const isCompleted = totalSegments > 0 && doneSegments >= totalSegments;
  const progressPercent = totalSegments > 0 ? Math.min(100, Math.round((doneSegments / totalSegments) * 100)) : 0;

  const handleCopy = () => {
    if (segments.length === 0) return;
    const fullText = segments
      .map((s) => `${s.timeRangeStr}\n${s.text}`)
      .join('\n\n---\n\n');
    navigator.clipboard.writeText(fullText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-6 flex flex-col justify-between h-full">
      <div>
        {/* Panel Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-emerald-600 stroke-[2.5]" />
            <h2 className="text-base font-bold tracking-wider text-emerald-600 uppercase">
              RESULTS
            </h2>
          </div>

          {segments.length > 0 && (
            <button
              id="btn-copy-transcript"
              onClick={handleCopy}
              title="Copy-safe Recovery: Sao chép toàn bộ kết quả đã hoàn thành"
              className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200/80 rounded-md transition-colors cursor-pointer"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="text-emerald-700 font-semibold">Đã sao chép</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-slate-500" />
                  <span>Sao chép</span>
                </>
              )}
            </button>
          )}
        </div>

        {/* Scrollable Transcript Box */}
        <div
          ref={scrollContainerRef}
          id="transcript-box"
          className="border border-slate-200/90 rounded-xl p-5 bg-white min-h-[330px] max-h-[380px] overflow-y-auto scroll-smooth text-slate-800"
        >
          <div className="text-xs font-bold text-slate-800 mb-3 tracking-wide">
            Transcribed results:
          </div>

          {segments.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-[260px] text-center text-slate-400">
              <FileText className="w-10 h-10 text-slate-200 mb-2 stroke-1" />
              <p className="text-sm font-medium text-slate-500">
                Chưa có dữ liệu transcript
              </p>
              <p className="text-xs text-slate-400 max-w-[260px] mt-1">
                Tải lên file hoặc dán URL và bấm UPLOAD để bắt đầu nhận dạng từng đoạn 120s.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {segments.map((seg, idx) => (
                <div key={seg.index} className="text-sm">
                  <div className="font-semibold text-slate-800 text-xs tracking-wider mb-1">
                    {seg.timeRangeStr}
                  </div>
                  <div className="text-slate-700 leading-relaxed font-normal text-[13.5px]">
                    {seg.text}
                  </div>
                  {idx < segments.length - 1 && (
                    <div className="border-t border-dashed border-slate-200 my-4" />
                  )}
                </div>
              ))}

              {isProcessing && !isCompleted && (
                <div className="pt-2">
                  <div className="border-t border-dashed border-blue-200 my-3" />
                  <div className="flex items-center gap-2 text-xs font-medium text-blue-600 animate-pulse">
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-600" />
                    <span>
                      Đang xử lý đoạn {doneSegments + 1} / {totalSegments} (Whisper Large v3)...
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Bottom Progress & Download Area */}
      <div className="mt-5 pt-4 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        {/* Progress & Counter */}
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-1">
            <span
              id="progress-counter"
              className="text-base font-bold text-blue-600 shrink-0 font-mono"
            >
              {doneSegments} / {totalSegments}
            </span>
            {/* Small Progress Bar */}
            <div className="w-36 sm:w-44 h-2 bg-slate-100 rounded-full overflow-hidden border border-slate-200/60">
              <div
                className="h-full bg-blue-600 rounded-full transition-all duration-500 ease-out"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
          <p className="text-[11.5px] text-slate-400">
            {isCompleted
              ? `Hoàn tất tất cả ${totalSegments} đoạn (120 giây mỗi đoạn)`
              : `Processing ${Math.min(doneSegments + 1, totalSegments)} of ${totalSegments} segments (120 sec each)`}
          </p>
        </div>

        {/* Download Button */}
        <div className="flex flex-col items-start sm:items-end shrink-0">
          <button
            id="btn-download"
            onClick={onDownload}
            disabled={!isCompleted}
            className={`px-5 py-2.5 rounded-lg font-bold text-sm flex items-center justify-center gap-2 transition-all cursor-pointer ${
              isCompleted
                ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-md active:scale-95'
                : 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed opacity-80'
            }`}
          >
            <Download className="w-4 h-4 stroke-[2.5]" />
            <span>DOWNLOAD</span>
          </button>
          <span className="text-[10px] text-slate-400 mt-1">
            Available when progress reaches {totalSegments} / {totalSegments}
          </span>
        </div>
      </div>
    </div>
  );
};
