import assert from 'node:assert/strict';
import test from 'node:test';

import { extractPresignedUrlPayload, VercelBlobStorage } from '../../server/storage/providers/vercel-blob';

test('Vercel Blob configuration requires the connected store id, not a read-write token', () => {
  const originalStoreId = process.env.BLOB_STORE_ID;
  const originalReadWriteToken = process.env.BLOB_READ_WRITE_TOKEN;

  try {
    delete process.env.BLOB_STORE_ID;
    process.env.BLOB_READ_WRITE_TOKEN = 'legacy-token-must-not-be-used';
    assert.throws(
      () => new VercelBlobStorage().assertConfigured(),
      /BLOB_STORE_ID is required/,
    );

    process.env.BLOB_STORE_ID = 'store_test';
    delete process.env.BLOB_READ_WRITE_TOKEN;
    assert.doesNotThrow(() => new VercelBlobStorage().assertConfigured());
  } finally {
    if (originalStoreId === undefined) delete process.env.BLOB_STORE_ID;
    else process.env.BLOB_STORE_ID = originalStoreId;
    if (originalReadWriteToken === undefined) delete process.env.BLOB_READ_WRITE_TOKEN;
    else process.env.BLOB_READ_WRITE_TOKEN = originalReadWriteToken;
  }
});

test('presigned upload response exposes only delegation fields required by the browser SDK', () => {
  const payload = extractPresignedUrlPayload(
    'https://vercel.com/api/blob/?pathname=users%2Fu%2Fjobs%2Fj%2Fsource%2Finput.mp4'
      + '&vercel-blob-valid-until=1234'
      + '&vercel-blob-allow-overwrite=false'
      + '&vercel-blob-delegation=delegation-value'
      + '&vercel-blob-signature=signature-value',
  );

  assert.deepEqual(payload, {
    delegationToken: 'delegation-value',
    signature: 'signature-value',
    params: {
      'vercel-blob-valid-until': '1234',
      'vercel-blob-allow-overwrite': 'false',
    },
  });
});
