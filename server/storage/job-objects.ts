import type { Job } from '../db/interface';
import { getObjectStorage } from './index';
import type { ObjectStorage } from './interface';

export async function deleteSourceMedia(
  job: Pick<Job, 'sourceObjectKey'>,
  storage: ObjectStorage = getObjectStorage(),
): Promise<void> {
  await storage.deleteObject(job.sourceObjectKey);
}

export async function deleteTranscriptArtifact(
  job: Pick<Job, 'outputObjectKey'>,
  storage: ObjectStorage = getObjectStorage(),
): Promise<void> {
  if (job.outputObjectKey) await storage.deleteObject(job.outputObjectKey);
}
