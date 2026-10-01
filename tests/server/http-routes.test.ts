import assert from 'node:assert/strict';
import test from 'node:test';

import { HttpError, extractPathId } from '../../server/http/responses';

test('dynamic upload completion path extracts exactly one owned resource id', () => {
  assert.equal(extractPathId('/api/uploads/job_123/complete', '/api/uploads/', '/complete'), 'job_123');
  assert.throws(
    () => extractPathId('/api/uploads/user/job/complete', '/api/uploads/', '/complete'),
    (error: unknown) => error instanceof HttpError && error.status === 400,
  );
});
