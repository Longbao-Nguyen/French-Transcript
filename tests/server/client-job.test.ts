import assert from 'node:assert/strict';
import test from 'node:test';

import type { Job } from '../../server/db/interface';
import { toClientJob } from '../../server/jobs/public';

test('client job contract does not expose ownership or storage pathnames', () => {
  const now = new Date('2026-10-02T00:00:00.000Z');
  const job: Job = {
    id: 'job_1',
    userId: 'usr_secret',
    originalFilename: 'lecture.mp4',
    sourceObjectKey: 'users/usr_secret/jobs/job_1/source/lecture.mp4',
    outputObjectKey: null,
    contentType: 'video/mp4',
    fileSizeBytes: 123,
    status: 'QUEUED',
    progress: 0,
    durationSec: null,
    processedAudioSec: null,
    errorCode: null,
    errorMessage: null,
    createdAt: now,
    updatedAt: now,
    uploadCompletedAt: now,
    startedAt: null,
    completedAt: null,
    expiresAt: null,
    workerRunId: null,
  };
  const client = toClientJob(job) as unknown as Record<string, unknown>;
  assert.equal('userId' in client, false);
  assert.equal('sourceObjectKey' in client, false);
  assert.equal('outputObjectKey' in client, false);
});
