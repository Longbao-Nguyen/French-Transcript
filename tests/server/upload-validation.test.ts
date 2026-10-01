import assert from 'node:assert/strict';
import test from 'node:test';

import { HttpError } from '../../server/http/responses';
import { validateUploadInit } from '../../server/uploads/validation';

test('upload metadata accepts opaque browser media', () => {
  assert.deepEqual(
    validateUploadInit({ filename: 'lecture.unsupported-container', size: 123, contentType: '' }),
    { filename: 'lecture.unsupported-container', size: 123, contentType: 'application/octet-stream' },
  );
});

test('upload presentation names discard client supplied path and control characters', () => {
  assert.equal(
    validateUploadInit({ filename: '../folder/lec\u0000ture.mp4', size: 123, contentType: 'video/mp4' }).filename,
    'lecture.mp4',
  );
});

test('upload metadata enforces the configured size limit', () => {
  const previous = process.env.MAX_UPLOAD_BYTES;
  process.env.MAX_UPLOAD_BYTES = '100';
  try {
    assert.throws(
      () => validateUploadInit({ filename: 'large.mp4', size: 101, contentType: 'video/mp4' }),
      (error: unknown) => error instanceof HttpError && error.status === 413,
    );
  } finally {
    if (previous === undefined) delete process.env.MAX_UPLOAD_BYTES;
    else process.env.MAX_UPLOAD_BYTES = previous;
  }
});
