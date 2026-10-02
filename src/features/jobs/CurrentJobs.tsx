import { Clock3, Loader2, X } from 'lucide-react';

import type { ClientJob, LocalUpload, QueueState } from '../../types';
import { StatusBadge } from './StatusBadge';
import { isActiveJob } from './useJobsPolling';

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function progressText(job: ClientJob): string | null {
  if (job.progress == null || job.status === 'QUEUED' || job.status === 'WORKER_STARTING' || job.status === 'CANCEL_REQUESTED') return null;
  return `${Math.round(job.progress * 100)}%`;
}

export function CurrentJobs({
  jobs,
  uploads,
  loading,
  queueState,
  queuedCount,
  cancellingJobId,
  onCancel,
  onStart,
  onDismissUpload,
}: {
  jobs: ClientJob[];
  uploads: LocalUpload[];
  loading: boolean;
  queueState: QueueState;
  queuedCount: number;
  cancellingJobId: string | null;
  onCancel: (job: ClientJob) => void;
  onStart: () => void;
  onDismissUpload: (localId: string) => void;
}) {
  const localJobIds = new Set(uploads.flatMap((item) => item.jobId ? [item.jobId] : []));
  const activeJobs = jobs.filter((job) => isActiveJob(job) && !localJobIds.has(job.id));
  const empty = uploads.length === 0 && activeJobs.length === 0;

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Clock3 className="h-5 w-5 text-blue-600" />
          <h2 className="font-bold text-slate-900">Current jobs</h2>
        </div>
        {loading && <Loader2 className="h-4 w-4 animate-spin text-slate-400" />}
      </div>

      {(queueState === 'PAUSING' || queueState === 'PAUSED') && (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <p className="font-semibold">{queueState === 'PAUSING' ? 'Stopping current worker...' : 'Queue paused'}</p>
          <p>{queuedCount} {queuedCount === 1 ? 'file is' : 'files are'} still waiting.</p>
          {queueState === 'PAUSED' && queuedCount > 0 && (
            <button type="button" onClick={onStart} className="mt-3 rounded-lg bg-blue-600 px-4 py-2 font-semibold text-white hover:bg-blue-700">
              START TRANSCRIPT
            </button>
          )}
        </div>
      )}

      {empty ? (
        <p className="rounded-xl bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">No active jobs.</p>
      ) : (
        <div className="divide-y divide-slate-100">
          {uploads.map((upload) => (
            <div key={upload.localId} className="py-4 first:pt-0 last:pb-0">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-800">{upload.file.name}</p>
                  <p className="mt-1 text-xs text-slate-400">{formatBytes(upload.file.size)}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${upload.state === 'FAILED' ? 'bg-red-50 text-red-700' : 'bg-blue-50 text-blue-700'}`}>
                    {upload.state === 'UPLOADING' ? `Uploading ${Math.round(upload.progress * 100)}%` : upload.state.toLowerCase()}
                  </span>
                  {upload.state === 'FAILED' && (
                    <button type="button" onClick={() => onDismissUpload(upload.localId)} className="p-1 text-slate-400 hover:text-slate-700 cursor-pointer" title="Dismiss">
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
              {upload.state === 'UPLOADING' && (
                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full rounded-full bg-blue-600 transition-all" style={{ width: `${Math.round(upload.progress * 100)}%` }} />
                </div>
              )}
              {upload.error && <p className="mt-2 text-xs text-red-600">{upload.error}</p>}
            </div>
          ))}

          {activeJobs.map((job) => (
            <div key={job.id} className="flex items-center justify-between gap-3 py-4 first:pt-0 last:pb-0">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-800">{job.filename}</p>
                <p className="mt-1 text-xs text-slate-400">{formatBytes(job.fileSizeBytes)}</p>
              </div>
              <div className="flex items-center gap-2">
                <StatusBadge status={job.status} />
                {progressText(job) && <span className="w-10 text-right text-xs font-semibold text-slate-500">{progressText(job)}</span>}
                {(job.status === 'QUEUED' || ['PROCESSING', 'WORKER_STARTING', 'PREPROCESSING', 'TRANSCRIBING', 'FINALIZING'].includes(job.status)) && (
                  <button type="button" disabled={cancellingJobId === job.id} onClick={() => onCancel(job)} className="rounded-lg border border-red-200 px-3 py-1 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50">
                    {cancellingJobId === job.id ? 'Cancelling...' : job.status === 'QUEUED' ? 'Cancel' : 'Cancel processing'}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
