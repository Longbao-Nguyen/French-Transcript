import assert from 'node:assert/strict';
import test from 'node:test';

import { HttpError } from '../../server/http/responses';
import { assertJobTransition, canTransitionJob } from '../../server/jobs/state';

test('job state machine allows the upload queue path', () => {
  assert.equal(canTransitionJob('CREATED', 'UPLOADING'), true);
  assert.equal(canTransitionJob('UPLOADING', 'QUEUED'), true);
});

test('job state machine rejects terminal and skipped transitions', () => {
  assert.equal(canTransitionJob('COMPLETED', 'TRANSCRIBING'), false);
  assert.throws(
    () => assertJobTransition('UPLOADING', 'COMPLETED'),
    (error: unknown) => error instanceof HttpError && error.code === 'INVALID_JOB_TRANSITION',
  );
});
