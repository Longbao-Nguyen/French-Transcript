import { getRepositories } from '../../../../server/db/index.js';
import { HttpError, extractPathId, jsonResponse, route } from '../../../../server/http/responses.js';
import { requireWorkerJobScope } from '../../../../server/worker/cancellation.js';

export const GET = route(async (request) => {
  const jobId = extractPathId(new URL(request.url).pathname, '/api/internal/jobs/', '/cancel-state');
  const scope = requireWorkerJobScope(request, jobId);
  const repositories = await getRepositories();
  const job = await repositories.jobs.getByIdForUser(jobId, scope.userId);
  if (!job || job.workerRunId !== scope.workerRunId) throw new HttpError(404, 'Job not found.', 'JOB_NOT_FOUND');
  const queueState = await repositories.queue.getStateForUser(scope.userId);
  return jsonResponse({ shouldCancel: job.status === 'CANCEL_REQUESTED', queueState });
});
