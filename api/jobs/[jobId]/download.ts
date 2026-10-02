import { requireUser } from '../../../server/auth/session.js';
import { getRepositories } from '../../../server/db/index.js';
import { HttpError, extractPathId, route } from '../../../server/http/responses.js';
import { attachmentContentDisposition, createTranscriptDownloadFilename } from '../../../server/storage/downloads.js';
import { getObjectStorage } from '../../../server/storage/index.js';

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

  const object = await getObjectStorage().getPrivateObject(job.outputObjectKey);
  if (!object) throw new HttpError(404, 'Transcript file was not found.', 'TRANSCRIPT_NOT_FOUND');

  return new Response(object.stream, {
    status: 200,
    headers: {
      'Cache-Control': 'private, no-store, max-age=0',
      'Content-Disposition': attachmentContentDisposition(createTranscriptDownloadFilename(job.originalFilename)),
      'Content-Length': String(object.size),
      'Content-Type': object.contentType || 'text/plain; charset=utf-8',
      'X-Content-Type-Options': 'nosniff',
    },
  });
});
