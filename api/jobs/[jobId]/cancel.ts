import { requireUser } from '../../../server/auth/session.js';
import { getRepositories } from '../../../server/db/index.js';
import { HttpError, extractPathId, jsonResponse, route } from '../../../server/http/responses.js';
import { deleteSourceMedia } from '../../../server/storage/job-objects.js';

export const POST = route(async (request) => {
  const user = await requireUser(request);
  const jobId = extractPathId(new URL(request.url).pathname, '/api/jobs/', '/cancel');
  const repositories = await getRepositories();
  const result = await repositories.jobs.cancelForUser(jobId, user.id);
  if (!result) throw new HttpError(404, 'Job not found.', 'JOB_NOT_FOUND');
  if (result.job.status === 'COMPLETED') {
    throw new HttpError(409, 'This job has already completed.', 'JOB_ALREADY_COMPLETED');
  }
  if (result.job.status !== 'CANCELLED' && result.job.status !== 'CANCEL_REQUESTED') {
    throw new HttpError(409, 'This job cannot be cancelled.', 'JOB_NOT_CANCELLABLE');
  }
  if (result.job.status === 'CANCELLED') await deleteSourceMedia(result.job);
  return jsonResponse({ jobId, status: result.job.status, queueState: result.queueState });
});
