import type { JobStatus } from '../db/interface';
import { HttpError } from '../http/responses';

const transitions: Record<JobStatus, readonly JobStatus[]> = {
  CREATED: ['UPLOADING', 'FAILED_UPLOAD', 'CANCELLED'],
  UPLOADING: ['QUEUED', 'FAILED_UPLOAD', 'CANCELLED'],
  QUEUED: ['WORKER_STARTING', 'PREPROCESSING', 'CANCELLED'],
  WORKER_STARTING: ['PREPROCESSING', 'FAILED_WORKER_START', 'CANCELLED'],
  PREPROCESSING: ['TRANSCRIBING', 'FAILED_MEDIA', 'CANCELLED'],
  TRANSCRIBING: ['FINALIZING', 'FAILED_INFERENCE', 'CANCELLED'],
  FINALIZING: ['COMPLETED', 'FAILED_OUTPUT'],
  COMPLETED: ['EXPIRED'],
  FAILED_UPLOAD: ['UPLOADING', 'CANCELLED'],
  FAILED_WORKER_START: ['QUEUED', 'CANCELLED'],
  FAILED_MEDIA: ['QUEUED', 'CANCELLED'],
  FAILED_INFERENCE: ['QUEUED', 'CANCELLED'],
  FAILED_OUTPUT: ['QUEUED', 'CANCELLED'],
  CANCELLED: [],
  EXPIRED: [],
};

export function canTransitionJob(from: JobStatus, to: JobStatus): boolean {
  return transitions[from].includes(to);
}

export function assertJobTransition(from: JobStatus, to: JobStatus): void {
  if (!canTransitionJob(from, to)) {
    throw new HttpError(409, `Job cannot move from ${from} to ${to}.`, 'INVALID_JOB_TRANSITION');
  }
}
