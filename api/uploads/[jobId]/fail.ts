import { requireUser } from '../../../server/auth/session';
import { getRepositories } from '../../../server/db';
import { HttpError, extractPathId, jsonResponse, route } from '../../../server/http/responses';
import { toClientJob } from '../../../server/jobs/public';
import { assertJobTransition } from '../../../server/jobs/state';

export const POST = route(async (request) => {
  const user = await requireUser(request);
  const jobId = extractPathId(new URL(request.url).pathname, '/api/uploads/', '/fail');
  const repositories = await getRepositories();
  const job = await repositories.jobs.getByIdForUser(jobId, user.id);
  if (!job) throw new HttpError(404, 'Job not found.', 'JOB_NOT_FOUND');
  if (job.status !== 'UPLOADING') return jsonResponse({ job: toClientJob(job) });

  assertJobTransition(job.status, 'FAILED_UPLOAD');
  const failed = await repositories.jobs.updateForUser(job.id, user.id, {
    status: 'FAILED_UPLOAD',
    errorCode: 'DIRECT_UPLOAD_FAILED',
    errorMessage: 'The browser could not finish the object storage upload.',
  });
  if (!failed) throw new HttpError(404, 'Job not found.', 'JOB_NOT_FOUND');
  return jsonResponse({ job: toClientJob(failed) });
});
