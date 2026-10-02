import assert from 'node:assert/strict';
import test from 'node:test';

import type { Job } from '../../server/db/interface';
import { HttpError } from '../../server/http/responses';
import { createDirectUploadGrant } from '../../server/uploads/direct-upload';

function uploadingJob(): Job {
  const now = new Date('2026-10-02T00:00:00.000Z');
  return {
    id: 'job_456',
    userId: 'usr_123',
    originalFilename: 'lesson.mp4',
    sourceObjectKey: 'users/usr_123/jobs/job_456/source/lesson.mp4',
    outputObjectKey: null,
    contentType: 'video/mp4',
    fileSizeBytes: 1234,
    status: 'UPLOADING',
    progress: 0,
    durationSec: null,
    processedAudioSec: null,
    errorCode: null,
    errorMessage: null,
    createdAt: now,
    updatedAt: now,
    uploadCompletedAt: null,
    startedAt: null,
    completedAt: null,
    expiresAt: null,
    workerRunId: null,
  };
}

test('direct upload grant binds owner, job, pathname, type, and size', () => {
  const job = uploadingJob();
  const grant = createDirectUploadGrant({
    pathname: job.sourceObjectKey,
    clientPayload: JSON.stringify({ jobId: job.id }),
    multipart: true,
  }, job, job.userId, 1000);

  assert.equal(grant.contentType, 'video/mp4');
  assert.equal(grant.maximumSizeInBytes, 1234);
  assert.equal(grant.validUntil, 1000 + 60 * 60 * 1000);
});

test('direct upload grant rejects a client-selected pathname', () => {
  const job = uploadingJob();
  assert.throws(
    () => createDirectUploadGrant({
      pathname: 'users/another-user/arbitrary.mp4',
      clientPayload: JSON.stringify({ jobId: job.id }),
      multipart: true,
    }, job, job.userId),
    (error: unknown) => error instanceof HttpError && error.code === 'UPLOAD_PATH_FORBIDDEN',
  );
});

test('direct upload grant requires the authenticated owner and multipart transport', () => {
  const job = uploadingJob();
  const request = {
    pathname: job.sourceObjectKey,
    clientPayload: JSON.stringify({ jobId: job.id }),
    multipart: true,
  };

  assert.throws(
    () => createDirectUploadGrant(request, job, 'usr_other'),
    (error: unknown) => error instanceof HttpError && error.code === 'UPLOAD_FORBIDDEN',
  );
  assert.throws(
    () => createDirectUploadGrant({ ...request, multipart: false }, job, job.userId),
    (error: unknown) => error instanceof HttpError && error.code === 'MULTIPART_REQUIRED',
  );
});
