import assert from 'node:assert/strict';
import test from 'node:test';

import { createSourceObjectKey } from '../../server/r2/keys';

test('source object keys are server-scoped and strip path traversal', () => {
  const key = createSourceObjectKey('usr_123', 'job_456', '../../Cours français 01.mp4');
  assert.equal(key.startsWith('users/usr_123/jobs/job_456/source/'), true);
  assert.equal(key.includes('..'), false);
  assert.equal(key.includes('Cours_francais_01.mp4'), true);
});
