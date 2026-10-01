import { requireUser } from '../../../server/auth/session';
import { getRepositories } from '../../../server/db';
import { HttpError, extractPathId, jsonResponse, route } from '../../../server/http/responses';
import { createDownloadUrl } from '../../../server/r2/client';

export const GET = route(async (request) => {
  const user = await requireUser(request);
  const jobId = extractPathId(new URL(request.url).pathname, '/api/jobs/', '/download');
  const repositories = await getRepositories();
  const job = await repositories.jobs.getByIdForUser(jobId, user.id);
  if (!job) throw new HttpError(404, 'Job not found.', 'JOB_NOT_FOUND');
  if (job.status === 'EXPIRED' || (job.expiresAt && job.expiresAt.getTime() <= Date.now())) {
    throw new HttpError(410, 'This transcript has expired.', 'TRANSCRIPT_EXPIRED');
  }
  if (job.status !== 'COMPLETED' || !job.outputObjectKey) {
    throw new HttpError(409, 'Transcript is not ready for download.', 'TRANSCRIPT_NOT_READY');
  }

  const downloadUrl = await createDownloadUrl(job.outputObjectKey);
  return jsonResponse({ downloadUrl });
});
