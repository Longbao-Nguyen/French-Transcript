import { useCallback, useState } from 'react';

import { AppHeader } from './features/auth/AppHeader';
import { SignInCard } from './features/auth/SignInCard';
import { useSession } from './features/auth/useSession';
import { CompletedJobs } from './features/jobs/CompletedJobs';
import { CurrentJobs } from './features/jobs/CurrentJobs';
import { useJobsPolling } from './features/jobs/useJobsPolling';
import { MultiFileUploadPanel } from './features/upload/MultiFileUploadPanel';
import { uploadFileDirectly } from './features/upload/uploadFile';
import type { LocalUpload } from './types';

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
  const { jobs, loading: jobsLoading, error: jobsError, refresh } = useJobsPolling(Boolean(session));
  const [uploads, setUploads] = useState<LocalUpload[]>([]);

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
        {(jobsError || sessionError) && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {jobsError || sessionError}
          </div>
        )}
        <CurrentJobs
          jobs={jobs}
          uploads={uploads}
          loading={jobsLoading}
          onDismissUpload={dismissUpload}
        />
        <CompletedJobs jobs={jobs} />
      </main>
    </div>
  );
}
