import React, { useEffect, useRef, useState } from 'react';
import { Header } from './components/Header';
import { UploadPanel } from './components/UploadPanel';
import { ResultsPanel } from './components/ResultsPanel';
import { ColabWorkerModal } from './components/ColabWorkerModal';
import { SegmentResult } from './types';
import { exportToColabTxt } from './utils/format';

interface JobResponse {
  job_id: string;
  job: { totalSegments: number };
}

interface SegmentEvent {
  segment: SegmentResult;
  done: number;
  total: number;
}

export default function App() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [activeJobId, setActiveJobId] = useState<string>();
  const [totalSegments, setTotalSegments] = useState(0);
  const [doneSegments, setDoneSegments] = useState(0);
  const [startSegment, setStartSegment] = useState(1);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showColabModal, setShowColabModal] = useState(false);
  const [statusMessage, setStatusMessage] = useState('Upload an audio file');
  const [segments, setSegments] = useState<SegmentResult[]>([]);
  const [durationSec, setDurationSec] = useState<number>();
  const eventSourceRef = useRef<EventSource | null>(null);
  const segmentsRef = useRef<SegmentResult[]>([]);
  const selectedFileRef = useRef<File | null>(null);
  const autoDownloadedJobIdsRef = useRef(new Set<string>());

  const closeEventSource = () => {
    eventSourceRef.current?.close();
    eventSourceRef.current = null;
  };

  useEffect(() => closeEventSource, []);

  const addOrReplaceSegment = (segment: SegmentResult) => {
    const withoutCurrent = segmentsRef.current.filter((item) => item.index !== segment.index);
    const updatedSegments = [...withoutCurrent, segment].sort((a, b) => a.index - b.index);
    segmentsRef.current = updatedSegments;
    setSegments(updatedSegments);
  };

  const downloadTranscript = () => {
    const file = selectedFileRef.current;
    if (!file || segmentsRef.current.length === 0) return false;

    const textContent = exportToColabTxt(segmentsRef.current, file.name);
    const blob = new Blob([textContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `transcript_${file.name.replace(/\.[^/.]+$/, '')}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    return true;
  };

  const connectToJob = (jobId: string) => {
    closeEventSource();
    const eventSource = new EventSource(`/api/events/${jobId}`);
    eventSourceRef.current = eventSource;

    eventSource.addEventListener('init', (event) => {
      const job = JSON.parse((event as MessageEvent).data);
      setTotalSegments(job.totalSegments);
      setDoneSegments(job.doneSegments);
      setStartSegment(Math.min(job.doneSegments + 1, job.totalSegments));
      segmentsRef.current = job.segments ?? [];
      setSegments(segmentsRef.current);
    });

    eventSource.addEventListener('progress', (event) => {
      const progress = JSON.parse((event as MessageEvent).data);
      setTotalSegments(progress.total);
      setStatusMessage(`Received ${progress.total} segments from the actual file.`);
    });

    eventSource.addEventListener('segment', (event) => {
      const data = JSON.parse((event as MessageEvent).data) as SegmentEvent;
      addOrReplaceSegment(data.segment);
      setDoneSegments(data.done);
      setTotalSegments(data.total);
      setStartSegment(Math.min(data.done + 1, data.total));
      setIsProcessing(true);
      setStatusMessage(`Processed segment ${data.done} / ${data.total}.`);
    });

    eventSource.addEventListener('complete', (event) => {
      const data = JSON.parse((event as MessageEvent).data);
      setDoneSegments(data.doneSegments);
      setTotalSegments(data.totalSegments);
      setIsProcessing(false);
      setStatusMessage(`Processing complete: ${data.doneSegments} / ${data.totalSegments} segments.`);
      if (!autoDownloadedJobIdsRef.current.has(jobId)) {
        autoDownloadedJobIdsRef.current.add(jobId);
        // Wait until the final segment event has updated the transcript ref.
        window.setTimeout(() => downloadTranscript(), 0);
      }
      eventSource.close();
    });
  };

  const handleFileSelect = (file: File) => {
    closeEventSource();
    setSelectedFile(file);
    selectedFileRef.current = file;
    setActiveJobId(undefined);
    setDurationSec(undefined);
    setTotalSegments(0);
    setDoneSegments(0);
    setStartSegment(1);
    setSegments([]);
    segmentsRef.current = [];
    setIsProcessing(false);
    setStatusMessage(`Reading duration: ${file.name}`);

    const objectUrl = URL.createObjectURL(file);
    const media = document.createElement('audio');
    media.preload = 'metadata';
    media.onloadedmetadata = () => {
      URL.revokeObjectURL(objectUrl);
      if (!Number.isFinite(media.duration) || media.duration <= 0) {
        setStatusMessage('Could not read file duration. Please try a different audio/video format.');
        return;
      }
      const actualDuration = Math.ceil(media.duration);
      const segmentCount = Math.max(1, Math.ceil(actualDuration / 120));
      setDurationSec(actualDuration);
      setTotalSegments(segmentCount);
      setStatusMessage(`${file.name} uploaded: ${segmentCount} segments.`);
    };
    media.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      setStatusMessage('Could not read file duration. Please try a different audio/video format.');
    };
    media.src = objectUrl;
  };

  const prepareStartSegment = async (jobId: string) => {
    setStatusMessage(`Preparing transcript from segment ${startSegment}…`);
    try {
      const response = await fetch(`/api/jobs/${jobId}/resume`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ startSegment }),
      });
      if (!response.ok) throw new Error(await response.text());
      setIsProcessing(true);
      connectToJob(jobId);
      setShowColabModal(true);
      setStatusMessage(`Ready to transcript from segment ${startSegment}. Run the Colab code to start.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not prepare transcript.';
      setStatusMessage(`Could not start transcript: ${message}`);
    }
  };

  const startTranscriptionWorkflow = async () => {
    if (activeJobId) {
      await prepareStartSegment(activeJobId);
      return;
    }
    if (!selectedFile || !durationSec || isProcessing) return;

    closeEventSource();
    setSegments([]);
    segmentsRef.current = [];
    setDoneSegments(0);
    setIsProcessing(true);
    setStatusMessage('Uploading file to server…');

    try {
      const response = await fetch('/api/upload', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/octet-stream',
          'X-File-Name': encodeURIComponent(selectedFile.name),
          'X-Duration-Sec': String(durationSec),
          'X-Start-Segment': String(startSegment),
        },
        body: selectedFile,
      });
      if (!response.ok) throw new Error(await response.text());

      const payload = (await response.json()) as JobResponse;
      setActiveJobId(payload.job_id);
      setTotalSegments(payload.job.totalSegments);
      connectToJob(payload.job_id);
      setStatusMessage(`File uploaded. Colab will start from segment ${startSegment}.`);
      setShowColabModal(true);
    } catch (error) {
      setIsProcessing(false);
      const message = error instanceof Error ? error.message : 'Could not upload file to server.';
      setStatusMessage(`Upload failed: ${message}`);
    }
  };

  const handleDownload = () => {
    downloadTranscript();
  };

  return (
    <div className="min-h-screen bg-[#f3f6fa] text-slate-800 flex flex-col font-sans antialiased selection:bg-blue-100 selection:text-blue-900">
      <Header onOpenColabGuide={() => setShowColabModal(true)} isProcessing={isProcessing} statusText={statusMessage} />
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-10 flex flex-col justify-center">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
          <div className="w-full">
            <UploadPanel
              selectedFile={selectedFile}
              onFileSelect={handleFileSelect}
              onStartUpload={startTranscriptionWorkflow}
              activeJobId={activeJobId}
              isProcessing={isProcessing}
              totalSegments={totalSegments}
              startSegment={startSegment}
              onStartSegmentChange={(value) => setStartSegment(Math.min(Math.max(1, value), totalSegments))}
            />
          </div>
          <div className="w-full">
            <ResultsPanel segments={segments} doneSegments={doneSegments} totalSegments={totalSegments} isProcessing={isProcessing} onDownload={handleDownload} fileName={selectedFile?.name} />
          </div>
        </div>
      </main>
      <ColabWorkerModal isOpen={showColabModal} onClose={() => setShowColabModal(false)} activeJobId={activeJobId} />
    </div>
  );
}
