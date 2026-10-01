import { requireUser } from '../../server/auth/session';
import { getRepositories } from '../../server/db';
import { createId } from '../../server/db/ids';
import { HttpError, jsonResponse, readJson, route } from '../../server/http/responses';
import { assertJobTransition } from '../../server/jobs/state';
import { createUploadUrl } from '../../server/r2/client';
import { createSourceObjectKey } from '../../server/r2/keys';
import { validateUploadInit } from '../../server/uploads/validation';

export const POST = route(async (request) => {
  const user = await requireUser(request);
  const input = validateUploadInit(await readJson<unknown>(request));
  const jobId = createId('job');
  const sourceObjectKey = createSourceObjectKey(user.id, jobId, input.filename);
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
    const uploadUrl = await createUploadUrl({
      key: sourceObjectKey,
      contentType: input.contentType,
      contentLength: input.size,
    });
    assertJobTransition(job.status, 'UPLOADING');
    await repositories.jobs.updateForUser(jobId, user.id, { status: 'UPLOADING' });
    return jsonResponse({ jobId, uploadUrl }, { status: 201 });
  } catch (error) {
    assertJobTransition(job.status, 'FAILED_UPLOAD');
    await repositories.jobs.updateForUser(jobId, user.id, {
      status: 'FAILED_UPLOAD',
      errorCode: 'UPLOAD_URL_FAILED',
      errorMessage: 'Could not prepare object storage upload.',
    });
    throw new HttpError(503, 'Could not prepare the upload. Please retry.', 'UPLOAD_URL_FAILED');
  }
});
