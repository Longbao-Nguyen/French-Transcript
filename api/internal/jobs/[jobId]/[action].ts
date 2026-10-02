import { getRepositories } from '../../../../server/db/index.js';
import { HttpError, extractPathId, jsonResponse, route } from '../../../../server/http/responses.js';
import { deleteSourceMedia } from '../../../../server/storage/job-objects.js';
import { requireWorkerJobScope } from '../../../../server/worker/cancellation.js';

function jobIdForAction(request: Request, action: 'cancel-state' | 'cancelled'): string {
  return extractPathId(new URL(request.url).pathname, '/api/internal/jobs/', `/${action}`);
}

export const GET = route(async (request) => {
  const jobId = jobIdForAction(request, 'cancel-state');
  const scope = requireWorkerJobScope(request, jobId);
  const repositories = await getRepositories();
  const job = await repositories.jobs.getByIdForUser(jobId, scope.userId);
  if (!job || job.workerRunId !== scope.workerRunId) throw new HttpError(404, 'Job not found.', 'JOB_NOT_FOUND');
  const queueState = await repositories.queue.getStateForUser(scope.userId);
  return jsonResponse({ shouldCancel: job.status === 'CANCEL_REQUESTED', queueState });
});

export const POST = route(async (request) => {
  const jobId = jobIdForAction(request, 'cancelled');
  const scope = requireWorkerJobScope(request, jobId);
  const repositories = await getRepositories();
  const result = await repositories.jobs.acknowledgeCancellation(jobId, scope.userId, scope.workerRunId);
  if (!result || result.job.workerRunId !== scope.workerRunId) {
    throw new HttpError(404, 'Job not found.', 'JOB_NOT_FOUND');
  }
  if (result.job.status !== 'CANCELLED' || result.queueState !== 'PAUSED') {
    throw new HttpError(409, 'Cancellation is not pending.', 'CANCELLATION_NOT_PENDING');
  }
  await deleteSourceMedia(result.job);
  return jsonResponse({ jobId, status: 'CANCELLED', queueState: 'PAUSED' });
});
