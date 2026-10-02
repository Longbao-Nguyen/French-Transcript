import type { Job } from '../db/interface.js';
import { HttpError } from '../http/responses.js';
import type { DirectUploadGrant, DirectUploadRequest } from '../storage/interface.js';

const CLIENT_UPLOAD_TOKEN_TTL_MS = 60 * 60 * 1000;

interface UploadClientPayload {
  jobId: string;
}

function parseClientPayload(value: string | null): UploadClientPayload {
  try {
    const parsed = JSON.parse(value || '') as Partial<UploadClientPayload>;
    if (typeof parsed.jobId !== 'string' || !parsed.jobId) throw new Error('Missing job ID.');
    return { jobId: parsed.jobId };
  } catch {
    throw new HttpError(400, 'Invalid upload authorization payload.', 'INVALID_UPLOAD_PAYLOAD');
  }
}

export function getRequestedUploadJobId(clientPayload: string | null): string {
  return parseClientPayload(clientPayload).jobId;
}

export function createDirectUploadGrant(
  request: DirectUploadRequest,
  job: Job,
  userId: string,
  now = Date.now(),
): DirectUploadGrant {
  const { jobId } = parseClientPayload(request.clientPayload);
  if (job.id !== jobId || job.userId !== userId) {
    throw new HttpError(403, 'This upload does not belong to the signed-in user.', 'UPLOAD_FORBIDDEN');
  }
  if (job.status !== 'UPLOADING') {
    throw new HttpError(409, 'This job is not accepting an upload.', 'INVALID_JOB_STATE');
  }
  if (!request.multipart) {
    throw new HttpError(400, 'Multipart direct upload is required.', 'MULTIPART_REQUIRED');
  }
  if (request.pathname !== job.sourceObjectKey) {
    throw new HttpError(403, 'The requested storage pathname is not allowed.', 'UPLOAD_PATH_FORBIDDEN');
  }

  return {
    contentType: job.contentType,
    maximumSizeInBytes: job.fileSizeBytes,
    validUntil: now + CLIENT_UPLOAD_TOKEN_TTL_MS,
  };
}
