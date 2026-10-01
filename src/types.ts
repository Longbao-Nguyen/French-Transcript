export interface SegmentResult {
  index: number; // 1-based (1, 2, 3...)
  startSec: number;
  endSec: number;
  timeRangeStr: string; // "[00:00:00 – 00:02:00]"
  vietnameseRangeStr?: string; // "00m00s - 02m00s"
  text: string;
  timestamp: number;
}

export interface Job {
  id: string;
  fileName: string;
  fileSize?: string;
  totalDurationSec: number;
  segmentDurationSec: number; // 120
  totalSegments: number;
  resumeFrom: number; // segment index 0 to totalSegments - 1
  status: 'idle' | 'queued' | 'processing' | 'paused' | 'completed' | 'failed';
  doneSegments: number;
  segments: SegmentResult[];
  createdAt: number;
  updatedAt: number;
  error?: string;
}

export const ACTIVE_JOB_STATUSES = [
  'CREATED',
  'UPLOADING',
  'QUEUED',
  'WORKER_STARTING',
  'PREPROCESSING',
  'TRANSCRIBING',
  'FINALIZING',
] as const;

export type ActiveJobStatus = (typeof ACTIVE_JOB_STATUSES)[number];
export type JobStatus = ActiveJobStatus
  | 'COMPLETED'
  | 'FAILED_UPLOAD'
  | 'FAILED_WORKER_START'
  | 'FAILED_MEDIA'
  | 'FAILED_INFERENCE'
  | 'FAILED_OUTPUT'
  | 'CANCELLED'
  | 'EXPIRED';

export interface ClientJob {
  id: string;
  filename: string;
  status: JobStatus;
  progress: number | null;
  fileSizeBytes: number;
  durationSec: number | null;
  processedAudioSec: number | null;
  errorCode: string | null;
  errorMessage: string | null;
  createdAt: string;
  uploadCompletedAt: string | null;
  completedAt: string | null;
  expiresAt: string | null;
}

export type LocalUploadState = 'WAITING' | 'UPLOADING' | 'FINALIZING' | 'QUEUED' | 'FAILED';

export interface LocalUpload {
  localId: string;
  file: File;
  progress: number;
  state: LocalUploadState;
  jobId: string | null;
  error: string | null;
}

export interface AppSession {
  user: {
    email: string;
    name: string | null;
    image: string | null;
  };
  expires: string;
}
