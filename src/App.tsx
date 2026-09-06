import React, { useState, useEffect, useRef } from 'react';
import { Header } from './components/Header';
import { UploadPanel } from './components/UploadPanel';
import { ResultsPanel } from './components/ResultsPanel';
import { InfoBanner } from './components/InfoBanner';
import { ColabWorkerModal } from './components/ColabWorkerModal';
import { SegmentResult, Job } from './types';
import { SAMPLE_AUDIO_LIST } from './data/samples';
import {
  formatSegmentTimeRange,
  formatColabHeader,
  exportToColabTxt,
} from './utils/format';

export default function App() {
  // Main workflow states
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileUrl, setFileUrl] = useState<string>('https://example.com/your-file.mp4');
  const [activeJobId, setActiveJobId] = useState<string>('job_demo_101');
  const [totalSegments, setTotalSegments] = useState<number>(10);
  const [doneSegments, setDoneSegments] = useState<number>(1);
  const [resumeFrom, setResumeFrom] = useState<number>(0);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [showColabModal, setShowColabModal] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string>('Hệ thống sẵn sàng');

  // Initial segments display matching the exact screenshot demo state
  const [segments, setSegments] = useState<SegmentResult[]>([
    {
      index: 1,
      startSec: 0,
      endSec: 120,
      timeRangeStr: '[00:00:00 – 00:02:00]',
      vietnameseRangeStr: '00m00s - 02m00s',
      text: 'Bonjour à tous. Bienvenue dans ce cours de macroéconomie appliquée. Aujourd\'hui nous allons analyser la politique monétaire de la Banque Centrale Européenne et ses répercussions sur l\'inflation et la croissance.',
      timestamp: Date.now() - 120000,
    },
  ]);

  const processingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const activeSampleRef = useRef(SAMPLE_AUDIO_LIST[0]);

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (processingTimerRef.current) {
        clearInterval(processingTimerRef.current);
      }
    };
  }, []);

  // Handle File Selection
  const handleFileSelect = (file: File) => {
    setSelectedFile(file);
    setStatusMessage(`Đã chọn: ${file.name}`);

    // Try reading audio duration to compute segments (120s each)
    const audioObj = new Audio(URL.createObjectURL(file));
    audioObj.onloadedmetadata = () => {
      const dur = Math.round(audioObj.duration);
      if (dur > 0) {
        const segCount = Math.max(1, Math.ceil(dur / 120));
        setTotalSegments(segCount);
        setStatusMessage(`File: ${file.name} (~${Math.round(dur / 60)} phút / ${segCount} đoạn 120s)`);
      }
    };
    audioObj.onerror = () => {
      // Fallback calculation based on file size or default 10 segments
      const estimatedSec = Math.max(240, Math.min(7200, Math.round(file.size / (1024 * 64))));
      const segCount = Math.max(1, Math.ceil(estimatedSec / 120));
      setTotalSegments(segCount);
    };
  };

  // Load French Sample Audio & Transcript
  const handleLoadSample = () => {
    const sample = SAMPLE_AUDIO_LIST[0];
    activeSampleRef.current = sample;
    setSelectedFile(null);
    setFileUrl(sample.url);
    setTotalSegments(sample.segmentsCount);
    setDoneSegments(0);
    setResumeFrom(0);
    setSegments([]);
    setStatusMessage(`Đã nạp: ${sample.title}`);
  };

  // Submit URL
  const handleSubmitUrl = () => {
    if (!fileUrl.trim()) return;
    setStatusMessage(`Đã nạp URL: ${fileUrl}`);
    // If it's the demo URL or default, set 10 segments
    if (fileUrl.includes('droit') || fileUrl.includes('sorbonne-droit')) {
      activeSampleRef.current = SAMPLE_AUDIO_LIST[1];
      setTotalSegments(SAMPLE_AUDIO_LIST[1].segmentsCount);
    } else {
      activeSampleRef.current = SAMPLE_AUDIO_LIST[0];
      setTotalSegments(10);
    }
    // Start processing immediately
    startTranscriptionWorkflow();
  };

  // Start or Resume Transcription Workflow
  const startTranscriptionWorkflow = async () => {
    if (isProcessing) return;

    // Call backend /api/upload to register the job
    const newJobId = 'job_' + Math.random().toString(36).substring(2, 9);
    setActiveJobId(newJobId);

    const fileName = selectedFile ? selectedFile.name : fileUrl.split('/').pop() || 'audio_lecture.mp3';
    const totalSegs = totalSegments > 0 ? totalSegments : 10;

    try {
      await fetch('/api/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName,
          fileUrl,
          durationSec: totalSegs * 120,
          resumeFrom,
        }),
      });
    } catch {
      // continue in offline / preview mode
    }

    setIsProcessing(true);
    setStatusMessage(`Đang xử lý đoạn ${resumeFrom + 1} / ${totalSegs}...`);

    // If resuming from segment k, keep completed segments prior to k
    let currentDone = resumeFrom > 0 ? Math.min(resumeFrom, segments.length) : 0;
    const initialSegments = segments.slice(0, currentDone);
    setSegments(initialSegments);
    setDoneSegments(currentDone);

    // Run processing interval to simulate / receive segments from worker
    let segIndex = currentDone + 1;

    if (processingTimerRef.current) {
      clearInterval(processingTimerRef.current);
    }

    processingTimerRef.current = setInterval(() => {
      if (segIndex > totalSegs) {
        if (processingTimerRef.current) {
          clearInterval(processingTimerRef.current);
        }
        setIsProcessing(false);
        setDoneSegments(totalSegs);
        setStatusMessage(`Đã hoàn tất tất cả ${totalSegs} đoạn! Nút DOWNLOAD đã sẵn sàng.`);
        return;
      }

      const startSec = (segIndex - 1) * 120;
      const endSec = segIndex * 120;
      const timeRangeStr = formatSegmentTimeRange(startSec, endSec);
      const vRange = `${Math.floor(startSec / 60)}m${startSec % 60}s - ${Math.floor(endSec / 60)}m${endSec % 60}s`;

      // Get authentic French lecture text from sample database if available
      const sampleSegs = activeSampleRef.current.segments;
      const sampleText =
        sampleSegs[(segIndex - 1) % sampleSegs.length]?.text ||
        `Segment ${segIndex}: L'analyse des données recueillies démontre une corrélation directe entre les variables macroéconomiques et les décisions d'investissement public.`;

      const newSegment: SegmentResult = {
        index: segIndex,
        startSec,
        endSec,
        timeRangeStr,
        vietnameseRangeStr: vRange,
        text: sampleText,
        timestamp: Date.now(),
      };

      // Also send to backend
      fetch('/api/segment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          job_id: newJobId,
          index: segIndex,
          text: sampleText,
          startSec,
          endSec,
        }),
      }).catch(() => {});

      setSegments((prev) => [...prev, newSegment]);
      setDoneSegments(segIndex);
      setStatusMessage(`Đã nhận diện đoạn ${segIndex} / ${totalSegs} (${timeRangeStr})`);

      segIndex++;
    }, 2800); // 2.8s per segment simulation for responsive live feedback
  };

  const handlePauseResume = () => {
    if (isProcessing) {
      if (processingTimerRef.current) {
        clearInterval(processingTimerRef.current);
      }
      setIsProcessing(false);
      setResumeFrom(doneSegments);
      setStatusMessage(`Đã tạm dừng ở đoạn ${doneSegments} / ${totalSegments}. Có thể Resume tiếp tục.`);
    } else {
      startTranscriptionWorkflow();
    }
  };

  const handleReset = () => {
    if (processingTimerRef.current) {
      clearInterval(processingTimerRef.current);
    }
    setIsProcessing(false);
    setDoneSegments(0);
    setResumeFrom(0);
    setSegments([]);
    setStatusMessage('Đã đặt lại tiến trình.');
  };

  // Download final transcript
  const handleDownload = () => {
    if (segments.length === 0) return;

    const fileName = selectedFile
      ? selectedFile.name
      : fileUrl.split('/').pop() || 'french_transcript';

    const textContent = exportToColabTxt(segments, fileName);
    const blob = new Blob([textContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `transcript_${fileName.replace(/\.[^/.]+$/, '')}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setStatusMessage('Đã tải xuống file transcript.txt thành công!');
  };

  return (
    <div className="min-h-screen bg-[#f3f6fa] text-slate-800 flex flex-col font-sans antialiased selection:bg-blue-100 selection:text-blue-900">
      {/* Top Application Header */}
      <Header
        onLoadSample={handleLoadSample}
        onOpenColabGuide={() => setShowColabModal(true)}
        isProcessing={isProcessing}
        statusText={statusMessage}
      />

      {/* Main Workspace matching webapp_user_interface.png */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-10 flex flex-col justify-center">
        {/* Dual Panel Grid Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
          {/* Left Panel: Upload Panel */}
          <div className="w-full">
            <UploadPanel
              selectedFile={selectedFile}
              fileUrl={fileUrl}
              onFileSelect={handleFileSelect}
              onUrlChange={setFileUrl}
              onSubmitUrl={handleSubmitUrl}
              onStartUpload={startTranscriptionWorkflow}
              isProcessing={isProcessing}
              resumeFrom={resumeFrom}
              onResumeFromChange={setResumeFrom}
              totalSegments={totalSegments}
              doneSegments={doneSegments}
              onPauseResume={handlePauseResume}
              onReset={handleReset}
            />
          </div>

          {/* Right Panel: Results Panel */}
          <div className="w-full">
            <ResultsPanel
              segments={segments}
              doneSegments={doneSegments}
              totalSegments={totalSegments}
              isProcessing={isProcessing}
              onDownload={handleDownload}
              fileName={selectedFile?.name || 'lecture.mp3'}
            />
          </div>
        </div>

        {/* Bottom Information Banner */}
        <InfoBanner />
      </main>

      {/* Colab Worker Architecture & Python Code Modal */}
      <ColabWorkerModal
        isOpen={showColabModal}
        onClose={() => setShowColabModal(false)}
        activeJobId={activeJobId}
      />
    </div>
  );
}
