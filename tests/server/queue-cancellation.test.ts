import assert from 'node:assert/strict';
import test from 'node:test';

import { canTransitionJob } from '../../server/jobs/state';
import { requireWorkerJobScope, signWorkerJobScope } from '../../server/worker/cancellation';
import { HttpError } from '../../server/http/responses';

test('job state machine requires acknowledgement after active cancellation', () => {
  for (const phase of ['PROCESSING', 'WORKER_STARTING', 'PREPROCESSING', 'TRANSCRIBING', 'FINALIZING'] as const) {
    assert.equal(canTransitionJob(phase, 'CANCEL_REQUESTED'), true);
    assert.equal(canTransitionJob(phase, 'CANCELLED'), false);
  }
  assert.equal(canTransitionJob('CANCEL_REQUESTED', 'CANCELLED'), true);
  assert.equal(canTransitionJob('QUEUED', 'CANCELLED'), true);
  assert.equal(canTransitionJob('COMPLETED', 'CANCELLED'), false);
});

test('worker callback token is scoped to job, run and expiry', () => {
  const original = process.env.WORKER_CALLBACK_SECRET;
  process.env.WORKER_CALLBACK_SECRET = 'test-only-secret';
  try {
    const scope = { userId: 'usr_a', jobId: 'job_a', workerRunId: 'run_a', expiresAt: Date.now() + 60_000 };
    const token = signWorkerJobScope(scope, 'test-only-secret');
    const request = new Request('https://example.test/api/internal/jobs/job_a/cancelled', {
      headers: { authorization: `Bearer ${token}` },
    });
    assert.deepEqual(requireWorkerJobScope(request, 'job_a'), scope);
    assert.throws(() => requireWorkerJobScope(request, 'job_b'), (error) => error instanceof HttpError && error.status === 401);
    const expired = signWorkerJobScope({ ...scope, expiresAt: Date.now() - 1 }, 'test-only-secret');
    assert.throws(() => requireWorkerJobScope(new Request('https://example.test', { headers: { authorization: `Bearer ${expired}` } }), 'job_a'));
    assert.throws(() => requireWorkerJobScope(new Request('https://example.test', { headers: { authorization: `Bearer ${token}x` } }), 'job_a'));
  } finally {
    if (original === undefined) delete process.env.WORKER_CALLBACK_SECRET;
    else process.env.WORKER_CALLBACK_SECRET = original;
  }
});
