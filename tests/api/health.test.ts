import assert from 'node:assert/strict';
import test from 'node:test';

import { GET } from '../../api/health';

test('GET /api/health returns a stateless no-store response', async () => {
  const response = GET();
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.deepEqual(
    {
      status: payload.status,
      service: payload.service,
      architecture: payload.architecture,
      milestone: payload.milestone,
    },
    {
      status: 'ok',
      service: 'french-transcript-api',
      architecture: 'serverless',
      milestone: 1,
    },
  );
  assert.equal(Number.isNaN(Date.parse(payload.timestamp)), false);
});
