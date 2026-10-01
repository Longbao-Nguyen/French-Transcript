import { useCallback, useEffect, useMemo, useState } from 'react';

import { ACTIVE_JOB_STATUSES, type ClientJob, type JobStatus } from '../../types';

const activeStatuses = new Set<JobStatus>(ACTIVE_JOB_STATUSES);

export function isActiveJob(job: ClientJob): boolean {
  return activeStatuses.has(job.status);
}

export function getPollingDelay(jobs: ClientJob[]): number | null {
  const statuses = jobs.filter(isActiveJob).map((job) => job.status);
  if (statuses.length === 0) return null;
  if (statuses.includes('FINALIZING')) return 3_000;
  if (statuses.includes('PREPROCESSING') || statuses.includes('TRANSCRIBING')) return 4_000;
  if (statuses.includes('WORKER_STARTING')) return 5_000;
  return 10_000;
}

export function useJobsPolling(enabled: boolean) {
  const [jobs, setJobs] = useState<ClientJob[]>([]);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!enabled) return;
    try {
      const response = await fetch('/api/jobs', { credentials: 'same-origin' });
      if (!response.ok) throw new Error(response.status === 401 ? 'Your session has expired.' : 'Could not load jobs.');
      const payload = await response.json() as { jobs: ClientJob[] };
      setJobs(payload.jobs);
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

  return { jobs, loading, error, refresh };
}
