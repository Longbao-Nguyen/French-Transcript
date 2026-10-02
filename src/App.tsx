import { useCallback, useState } from 'react';

import { AppHeader } from './features/auth/AppHeader';
import { SignInCard } from './features/auth/SignInCard';
import { useSession } from './features/auth/useSession';
import { CompletedJobs } from './features/jobs/CompletedJobs';
import { CurrentJobs } from './features/jobs/CurrentJobs';
import { useJobsPolling } from './features/jobs/useJobsPolling';
import { MultiFileUploadPanel } from './features/upload/MultiFileUploadPanel';
import { uploadFileDirectly } from './features/upload/uploadFile';
import type { ClientJob, LocalUpload } from './types';

function createLocalUpload(file: File): LocalUpload {
  return {
    localId: crypto.randomUUID(),
    file,
    progress: 0,
    state: 'WAITING',
    jobId: null,
    error: null,
  };
}

export default function App() {
  const { session, loading: sessionLoading, error: sessionError } = useSession();
  const { jobs, queueState, queuedCount, loading: jobsLoading, error: jobsError, refresh } = useJobsPolling(Boolean(session));
  const [uploads, setUploads] = useState<LocalUpload[]>([]);
  const [confirmJob, setConfirmJob] = useState<ClientJob | null>(null);
  const [cancellingJobId, setCancellingJobId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const cancelJob = useCallback(async (job: ClientJob) => {
    setConfirmJob(null);
    setCancellingJobId(job.id);
    setActionError(null);
    try {
      const response = await fetch(`/api/jobs/${encodeURIComponent(job.id)}/cancel`, { method: 'POST', credentials: 'same-origin' });
      const payload = await response.json() as { error?: { message?: string } };
      if (!response.ok) throw new Error(payload.error?.message || 'Could not cancel job.');
      await refresh();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Could not cancel job.');
    } finally {
      setCancellingJobId(null);
    }
  }, [refresh]);

  const startQueue = useCallback(async () => {
    setActionError(null);
    try {
      const response = await fetch('/api/queue/start', { method: 'POST', credentials: 'same-origin' });
      const payload = await response.json() as { error?: { message?: string } };
      if (!response.ok) throw new Error(payload.error?.message || 'Could not start transcription.');
      await refresh();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Could not start transcription.');
    }
  }, [refresh]);

  const updateUpload = useCallback((localId: string, patch: Partial<LocalUpload>) => {
    setUploads((current) => current.map((item) => item.localId === localId ? { ...item, ...patch } : item));
  }, []);

  const processUpload = useCallback(async (item: LocalUpload) => {
    try {
      await uploadFileDirectly(item.file, {
        onInitialized(jobId) {
          updateUpload(item.localId, { jobId, state: 'UPLOADING' });
        },
        onProgress(progress) {
          updateUpload(item.localId, { progress, state: 'UPLOADING' });
        },
        onFinalizing() {
          updateUpload(item.localId, { progress: 1, state: 'FINALIZING' });
        },
      });
      updateUpload(item.localId, { progress: 1, state: 'QUEUED' });
      await refresh();
      setUploads((current) => current.filter((upload) => upload.localId !== item.localId));
    } catch (error) {
      updateUpload(item.localId, {
        state: 'FAILED',
        error: error instanceof Error ? error.message : 'Upload failed.',
      });
      await refresh();
    }
  }, [refresh, updateUpload]);

  const handleFiles = useCallback((files: File[]) => {
    const pending = files.map(createLocalUpload);
    setUploads((current) => [...current, ...pending]);
    pending.forEach((item) => void processUpload(item));
  }, [processUpload]);

  const dismissUpload = useCallback((localId: string) => {
    setUploads((current) => current.filter((item) => item.localId !== localId));
  }, []);

  if (sessionLoading) {
    return <div className="min-h-screen bg-slate-50 grid place-items-center text-sm text-slate-500">Loading session…</div>;
  }

  if (!session) {
    return <SignInCard error={sessionError} />;
  }

  return (
    <div className="min-h-screen bg-[#f3f6fa] text-slate-800 font-sans antialiased">
      <AppHeader user={session.user} />
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        <MultiFileUploadPanel onFiles={handleFiles} />
        {(jobsError || sessionError || actionError) && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {jobsError || sessionError || actionError}
          </div>
        )}
        <CurrentJobs
          jobs={jobs}
          uploads={uploads}
          loading={jobsLoading}
          queueState={queueState}
          queuedCount={queuedCount}
          cancellingJobId={cancellingJobId}
          onCancel={(job) => job.status === 'QUEUED' ? void cancelJob(job) : setConfirmJob(job)}
          onStart={() => void startQueue()}
          onDismissUpload={dismissUpload}
        />
        <CompletedJobs jobs={jobs} />
      </main>
      {confirmJob && (
        <div role="presentation" className="fixed inset-0 z-50 grid place-items-center bg-slate-950/50 p-4">
          <div role="dialog" aria-modal="true" aria-labelledby="cancel-title" className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h2 id="cancel-title" className="text-lg font-bold text-slate-900">Cancel current transcription?</h2>
            <p className="mt-3 text-sm text-slate-600">This will stop the current file and pause the remaining queue. Queued files will not be deleted.</p>
            <div className="mt-6 flex justify-end gap-3">
              <button type="button" onClick={() => setConfirmJob(null)} className="rounded-lg border border-slate-300 px-4 py-2 text-sm">Keep processing</button>
              <button type="button" onClick={() => void cancelJob(confirmJob)} className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white">Cancel and pause queue</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
