import type { Job, JobStatus } from '../db/interface.js';

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

const PUBLIC_ERRORS: Record<string, string> = {
  UPLOAD_URL_FAILED: 'Could not prepare object storage upload.',
  UPLOAD_SIZE_MISMATCH: 'Uploaded object size did not match the selected file.',
  DIRECT_UPLOAD_FAILED: 'The browser could not finish the object storage upload.',
  FAILED_WORKER_START: 'Kaggle could not start a GPU session.',
  FAILED_MEDIA: 'This file could not be decoded.',
  FAILED_INFERENCE: 'Transcription failed while processing this file.',
  FAILED_OUTPUT: 'The transcript output could not be saved.',
};

export function toClientJob(job: Job): ClientJob {
  return {
    id: job.id,
    filename: job.originalFilename,
    status: job.status,
    progress: job.progress,
    fileSizeBytes: job.fileSizeBytes,
    durationSec: job.durationSec,
    processedAudioSec: job.processedAudioSec,
    errorCode: job.errorCode,
    errorMessage: job.errorCode
      ? PUBLIC_ERRORS[job.errorCode] || 'This job could not be completed.'
      : null,
    createdAt: job.createdAt.toISOString(),
    uploadCompletedAt: job.uploadCompletedAt?.toISOString() || null,
    completedAt: job.completedAt?.toISOString() || null,
    expiresAt: job.expiresAt?.toISOString() || null,
  };
}
