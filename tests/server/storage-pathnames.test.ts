import assert from 'node:assert/strict';
import test from 'node:test';

import { createSourceObjectPathname } from '../../server/storage/pathnames';

test('source object pathnames are server-scoped and strip path traversal', () => {
  const pathname = createSourceObjectPathname('usr_123', 'job_456', '../../Cours français 01.mp4');
  assert.equal(pathname.startsWith('users/usr_123/jobs/job_456/source/'), true);
  assert.equal(pathname.includes('..'), false);
  assert.equal(pathname.includes('Cours_francais_01.mp4'), true);
});
