import { requireUser } from '../../../server/auth/session.js';
import { getRepositories } from '../../../server/db/index.js';
import { HttpError, extractPathId, jsonResponse, route } from '../../../server/http/responses.js';
import { toClientJob } from '../../../server/jobs/public.js';
import { assertJobTransition } from '../../../server/jobs/state.js';
import { getObjectStorage } from '../../../server/storage/index.js';

export const POST = route(async (request) => {
  const user = await requireUser(request);
  const jobId = extractPathId(new URL(request.url).pathname, '/api/uploads/', '/complete');
  const repositories = await getRepositories();
  const job = await repositories.jobs.getByIdForUser(jobId, user.id);
  if (!job) throw new HttpError(404, 'Job not found.', 'JOB_NOT_FOUND');

  if (job.status === 'QUEUED') {
    return jsonResponse({ job: toClientJob(job) });
  }
  if (job.status !== 'UPLOADING') {
    throw new HttpError(409, 'This upload cannot be completed in its current state.', 'INVALID_JOB_STATE');
  }

  const object = await getObjectStorage().headObject(job.sourceObjectKey);
  if (!object) {
    throw new HttpError(409, 'The uploaded object was not found.', 'UPLOAD_NOT_FOUND');
  }
  if (object.pathname !== job.sourceObjectKey || object.size !== job.fileSizeBytes) {
    assertJobTransition(job.status, 'FAILED_UPLOAD');
    await repositories.jobs.updateForUser(job.id, user.id, {
      status: 'FAILED_UPLOAD',
      errorCode: 'UPLOAD_SIZE_MISMATCH',
      errorMessage: 'Uploaded object size did not match the selected file.',
    }, 'UPLOADING');
    throw new HttpError(409, 'Uploaded file size did not match.', 'UPLOAD_SIZE_MISMATCH');
  }

  assertJobTransition(job.status, 'QUEUED');
  const queued = await repositories.jobs.updateForUser(job.id, user.id, {
    status: 'QUEUED',
    progress: 0,
    uploadCompletedAt: new Date(),
    errorCode: null,
    errorMessage: null,
  }, 'UPLOADING');
  if (!queued) throw new HttpError(409, 'This upload has changed state.', 'INVALID_JOB_STATE');
  return jsonResponse({ job: toClientJob(queued) });
});
