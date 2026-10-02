import { useCallback, useEffect, useMemo, useState } from 'react';

import { ACTIVE_JOB_STATUSES, type ClientJob, type JobStatus, type QueueState } from '../../types';

const activeStatuses = new Set<JobStatus>(ACTIVE_JOB_STATUSES);

export function isActiveJob(job: ClientJob): boolean {
  return activeStatuses.has(job.status);
}

export function getPollingDelay(jobs: ClientJob[]): number | null {
  const statuses = jobs.filter(isActiveJob).map((job) => job.status);
  if (statuses.length === 0) return null;
  if (statuses.includes('FINALIZING') || statuses.includes('CANCEL_REQUESTED')) return 3_000;
  if (statuses.includes('PROCESSING') || statuses.includes('PREPROCESSING') || statuses.includes('TRANSCRIBING')) return 4_000;
  if (statuses.includes('WORKER_STARTING')) return 5_000;
  return 10_000;
}

export function useJobsPolling(enabled: boolean) {
  const [jobs, setJobs] = useState<ClientJob[]>([]);
  const [queueState, setQueueState] = useState<QueueState>('IDLE');
  const [queuedCount, setQueuedCount] = useState(0);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!enabled) return;
    try {
      const response = await fetch('/api/jobs', { credentials: 'same-origin' });
      if (!response.ok) throw new Error(response.status === 401 ? 'Your session has expired.' : 'Could not load jobs.');
      const payload = await response.json() as { jobs: ClientJob[]; queueState: QueueState; queuedCount: number };
      setJobs(payload.jobs);
      setQueueState(payload.queueState);
      setQueuedCount(payload.queuedCount);
      setError(null);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Could not load jobs.');
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled) {
      setJobs([]);
      setQueueState('IDLE');
      setQueuedCount(0);
      setLoading(false);
      return;
    }
    setLoading(true);
    void refresh();
  }, [enabled, refresh]);

  const delay = useMemo(() => getPollingDelay(jobs), [jobs]);
  useEffect(() => {
    if (!enabled || delay == null) return;
    const timer = window.setTimeout(() => void refresh(), delay);
    return () => window.clearTimeout(timer);
  }, [delay, enabled, jobs, refresh]);

  return { jobs, queueState, queuedCount, loading, error, refresh };
}
