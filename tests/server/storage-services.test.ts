import assert from 'node:assert/strict';
import test from 'node:test';

import { attachmentContentDisposition, createTranscriptDownloadFilename } from '../../server/storage/downloads';
import type { ObjectStorage } from '../../server/storage/interface';
import { deleteSourceMedia, deleteTranscriptArtifact } from '../../server/storage/job-objects';

function deletionOnlyStorage(deleted: string[]): ObjectStorage {
  return {
    assertConfigured() {},
    async handleDirectUploadRequest() { throw new Error('Not used in this test.'); },
    async headObject() { return null; },
    async getPrivateObject() { return null; },
    async deleteObject(pathname) { deleted.push(pathname); },
  };
}

test('storage deletion helpers delete only persisted server-side pathnames', async () => {
  const deleted: string[] = [];
  const storage = deletionOnlyStorage(deleted);

  await deleteSourceMedia({ sourceObjectKey: 'users/u/jobs/j/source/input.mp4' }, storage);
  await deleteTranscriptArtifact({ outputObjectKey: 'users/u/jobs/j/output/transcript.txt' }, storage);
  await deleteTranscriptArtifact({ outputObjectKey: null }, storage);

  assert.deepEqual(deleted, [
    'users/u/jobs/j/source/input.mp4',
    'users/u/jobs/j/output/transcript.txt',
  ]);
});

test('authorized download filename is attachment-safe', () => {
  const filename = createTranscriptDownloadFilename('Cours français\r\n.mp4');
  assert.equal(filename, 'Cours_francais_.txt');
  assert.equal(attachmentContentDisposition(filename), 'attachment; filename="Cours_francais_.txt"');
});
