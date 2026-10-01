import type { JobStatus } from '../../types';

const LABELS: Record<JobStatus, string> = {
  CREATED: 'Created',
  UPLOADING: 'Uploading',
  QUEUED: 'Queued',
  WORKER_STARTING: 'Starting GPU',
  PREPROCESSING: 'Preparing media',
  TRANSCRIBING: 'Transcribing',
  FINALIZING: 'Finalizing',
  COMPLETED: 'Completed',
  FAILED_UPLOAD: 'Upload failed',
  FAILED_WORKER_START: 'GPU start failed',
  FAILED_MEDIA: 'Media failed',
  FAILED_INFERENCE: 'Transcription failed',
  FAILED_OUTPUT: 'Output failed',
  CANCELLED: 'Cancelled',
  EXPIRED: 'Expired',
};

export function StatusBadge({ status }: { status: JobStatus }) {
  const color = status === 'COMPLETED'
    ? 'bg-emerald-50 text-emerald-700'
    : status.startsWith('FAILED') || status === 'CANCELLED' || status === 'EXPIRED'
      ? 'bg-red-50 text-red-700'
      : 'bg-blue-50 text-blue-700';
  return <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${color}`}>{LABELS[status]}</span>;
}
