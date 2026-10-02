import { requireUser } from '../../server/auth/session';
import { getRepositories } from '../../server/db';
import { createId } from '../../server/db/ids';
import { HttpError, jsonResponse, readJson, route } from '../../server/http/responses';
import { assertJobTransition } from '../../server/jobs/state';
import { getObjectStorage } from '../../server/storage';
import { createSourceObjectPathname } from '../../server/storage/pathnames';
import { validateUploadInit } from '../../server/uploads/validation';

export const POST = route(async (request) => {
  const user = await requireUser(request);
  const input = validateUploadInit(await readJson<unknown>(request));
  const jobId = createId('job');
  const sourceObjectKey = createSourceObjectPathname(user.id, jobId, input.filename);
  const repositories = await getRepositories();

  const job = await repositories.jobs.create({
    id: jobId,
    userId: user.id,
    originalFilename: input.filename,
    sourceObjectKey,
    contentType: input.contentType,
    fileSizeBytes: input.size,
    status: 'CREATED',
  });

  try {
    getObjectStorage().assertConfigured();
    assertJobTransition(job.status, 'UPLOADING');
    await repositories.jobs.updateForUser(jobId, user.id, { status: 'UPLOADING' });
    return jsonResponse({ jobId, uploadPathname: sourceObjectKey }, { status: 201 });
  } catch (error) {
    assertJobTransition(job.status, 'FAILED_UPLOAD');
    await repositories.jobs.updateForUser(jobId, user.id, {
      status: 'FAILED_UPLOAD',
      errorCode: 'UPLOAD_INIT_FAILED',
      errorMessage: 'Could not prepare object storage upload.',
    });
    throw new HttpError(503, 'Could not prepare the upload. Please retry.', 'UPLOAD_INIT_FAILED');
  }
});
