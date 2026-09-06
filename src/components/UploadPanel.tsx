import React, { useRef, useState } from 'react';
import { Upload, Cloud, FileAudio, Check, AlertCircle, Play, Pause, RotateCcw } from 'lucide-react';

interface UploadPanelProps {
  selectedFile: File | null;
  fileUrl: string;
  onFileSelect: (file: File) => void;
  onUrlChange: (url: string) => void;
  onSubmitUrl: () => void;
  onStartUpload: () => void;
  isProcessing: boolean;
  resumeFrom: number;
  onResumeFromChange: (val: number) => void;
  totalSegments: number;
  doneSegments: number;
  onPauseResume?: () => void;
  onReset?: () => void;
}

export const UploadPanel: React.FC<UploadPanelProps> = ({
  selectedFile,
  fileUrl,
  onFileSelect,
  onUrlChange,
  onSubmitUrl,
  onStartUpload,
  isProcessing,
  resumeFrom,
  onResumeFromChange,
  totalSegments,
  doneSegments,
  onPauseResume,
  onReset,
}) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const [showAdvancedResume, setShowAdvancedResume] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      onFileSelect(e.dataTransfer.files[0]);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onFileSelect(e.target.files[0]);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-6 flex flex-col justify-between h-full">
      <div>
        {/* Panel Header */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <Upload className="w-5 h-5 text-blue-600 stroke-[2.5]" />
            <h2 className="text-base font-bold tracking-wider text-blue-600 uppercase">
              UPLOAD
            </h2>
          </div>
          {selectedFile && (
            <span className="text-xs bg-emerald-50 text-emerald-700 font-medium px-2 py-0.5 rounded-full border border-emerald-200">
              Đã chọn file
            </span>
          )}
        </div>

        {/* Drop Zone */}
        <div
          id="drop-zone"
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-xl py-10 px-4 text-center transition-all cursor-pointer select-none flex flex-col items-center justify-center min-h-[175px] ${
            isDragOver
              ? 'border-blue-500 bg-blue-50/50 scale-[1.01]'
              : 'border-blue-200 bg-blue-50/20 hover:bg-blue-50/40 hover:border-blue-300'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="audio/*,video/*,.mp3,.wav,.m4a,.mp4,.aac,.ogg,.flac"
            onChange={handleFileInputChange}
            className="hidden"
          />

          <div className="w-14 h-14 rounded-full bg-blue-50 flex items-center justify-center mb-3">
            <Cloud className="w-8 h-8 text-blue-500 stroke-[1.8]" />
          </div>

          <p className="text-slate-800 font-semibold text-base mb-0.5">
            Drop your file here
          </p>
          <p className="text-slate-400 text-xs">
            or click to browse
          </p>

          {selectedFile && (
            <div className="mt-3 inline-flex items-center gap-2 px-3 py-1 bg-white border border-blue-200 rounded-lg shadow-2xs text-xs text-slate-700 max-w-[90%] truncate">
              <FileAudio className="w-3.5 h-3.5 text-blue-600 shrink-0" />
              <span className="truncate font-medium">{selectedFile.name}</span>
              <span className="text-slate-400 shrink-0">
                ({(selectedFile.size / (1024 * 1024)).toFixed(1)} MB)
              </span>
            </div>
          )}
        </div>

        {/* Main Upload Button */}
        <button
          id="btn-upload"
          onClick={onStartUpload}
          disabled={isProcessing && doneSegments < totalSegments}
          className={`w-full mt-4 py-3 px-4 rounded-lg font-semibold text-white shadow-sm flex items-center justify-center gap-2 transition-all cursor-pointer ${
            isProcessing
              ? 'bg-blue-700/80 hover:bg-blue-700'
              : 'bg-blue-600 hover:bg-blue-700 active:scale-[0.99]'
          }`}
        >
          <Upload className="w-4 h-4 stroke-[2.5]" />
          <span>{isProcessing ? 'PROCESSING TRANSCRIPTION...' : 'UPLOAD'}</span>
        </button>

        {/* Paste URL Section */}
        <div className="mt-6 pt-5 border-t border-slate-100">
          <label
            htmlFor="input-url"
            className="block text-slate-700 font-bold text-sm mb-2"
          >
            Paste URL
          </label>
          <input
            id="input-url"
            type="text"
            value={fileUrl}
            onChange={(e) => onUrlChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                onSubmitUrl();
              }
            }}
            placeholder="https://example.com/your-file.mp4"
            className="w-full px-3.5 py-2.5 rounded-lg border border-slate-200 text-slate-800 text-sm placeholder:text-slate-400 bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all"
          />

          <button
            id="btn-url-ok"
            onClick={onSubmitUrl}
            disabled={isProcessing}
            className="w-full mt-3 py-2.5 px-4 rounded-lg font-bold text-white bg-blue-600 hover:bg-blue-700 active:scale-[0.99] shadow-sm transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            OK
          </button>
        </div>
      </div>

      {/* Resume Feature Section (From Design Spec) */}
      <div className="mt-5 pt-4 border-t border-slate-100">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-600">
            Resume from segment:
          </span>
          <div className="flex items-center gap-2">
            <input
              id="input-resume-from"
              type="number"
              min={0}
              max={Math.max(0, totalSegments - 1)}
              value={resumeFrom}
              onChange={(e) => onResumeFromChange(parseInt(e.target.value) || 0)}
              disabled={isProcessing}
              className="w-16 px-2 py-1 rounded-md border border-slate-200 text-center text-xs font-semibold text-slate-800 focus:outline-hidden focus:ring-1 focus:ring-blue-500"
            />
            <span className="text-xs text-slate-400">
              / {Math.max(1, totalSegments)}
            </span>
          </div>
        </div>
        <p className="text-[11px] text-slate-400 mt-1">
          Mặc định 0. Nếu bị gián đoạn ở đoạn 8, nhập 8 để chỉ xử lý các đoạn còn lại (8 - {Math.max(1, totalSegments)}).
        </p>

        {isProcessing && onPauseResume && (
          <div className="mt-3 flex items-center gap-2">
            <button
              id="btn-pause-resume"
              onClick={onPauseResume}
              className="flex-1 py-1.5 px-3 rounded-md bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 text-xs font-medium flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <Pause className="w-3.5 h-3.5" />
              <span>Tạm dừng</span>
            </button>
            {onReset && (
              <button
                id="btn-reset"
                onClick={onReset}
                className="py-1.5 px-3 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium flex items-center justify-center gap-1 transition-colors cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset</span>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
