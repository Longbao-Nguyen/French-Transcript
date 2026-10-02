import { requireUser } from '../../server/auth/session.js';
import { getRepositories } from '../../server/db/index.js';
import { HttpError, jsonResponse, readJson, route } from '../../server/http/responses.js';
import { getObjectStorage } from '../../server/storage/index.js';
import { createDirectUploadGrant, getRequestedUploadJobId } from '../../server/uploads/direct-upload.js';

export const POST = route(async (request) => {
  const body = await readJson<unknown>(request);
  const storage = getObjectStorage();
  const result = await storage.handleDirectUploadRequest(body, async (uploadRequest) => {
    const user = await requireUser(request);
    const jobId = getRequestedUploadJobId(uploadRequest.clientPayload);
    const repositories = await getRepositories();
    const job = await repositories.jobs.getByIdForUser(jobId, user.id);
    if (!job) throw new HttpError(404, 'Job not found.', 'JOB_NOT_FOUND');
    return createDirectUploadGrant(uploadRequest, job, user.id);
  });

  return jsonResponse(result);
});
