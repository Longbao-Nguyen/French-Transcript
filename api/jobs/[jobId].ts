import { requireUser } from '../../server/auth/session';
import { getRepositories } from '../../server/db';
import { HttpError, extractPathId, jsonResponse, route } from '../../server/http/responses';
import { toClientJob } from '../../server/jobs/public';

export const GET = route(async (request) => {
  const user = await requireUser(request);
  const jobId = extractPathId(new URL(request.url).pathname, '/api/jobs/');
  const repositories = await getRepositories();
  const job = await repositories.jobs.getByIdForUser(jobId, user.id);
  if (!job) throw new HttpError(404, 'Job not found.', 'JOB_NOT_FOUND');
  return jsonResponse({ job: toClientJob(job) });
});
