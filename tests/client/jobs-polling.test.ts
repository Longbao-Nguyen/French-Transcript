import assert from 'node:assert/strict';
import test from 'node:test';

import { getPollingDelay } from '../../src/features/jobs/useJobsPolling';
import type { ClientJob, JobStatus } from '../../src/types';

function job(status: JobStatus): ClientJob {
  return {
    id: status,
    filename: 'lecture.mp4',
    status,
    progress: null,
    fileSizeBytes: 1,
    durationSec: null,
    processedAudioSec: null,
    errorCode: null,
    errorMessage: null,
    createdAt: new Date(0).toISOString(),
    uploadCompletedAt: null,
    completedAt: null,
    expiresAt: null,
  };
}

test('adaptive polling stops for terminal jobs', () => {
  assert.equal(getPollingDelay([job('COMPLETED'), job('FAILED_MEDIA')]), null);
});

test('adaptive polling uses the fastest active phase', () => {
  assert.equal(getPollingDelay([job('QUEUED')]), 10_000);
  assert.equal(getPollingDelay([job('QUEUED'), job('TRANSCRIBING')]), 4_000);
  assert.equal(getPollingDelay([job('TRANSCRIBING'), job('FINALIZING')]), 3_000);
});
