import type { ObjectStorage } from './interface';
import { VercelBlobStorage } from './providers/vercel-blob';

let storage: ObjectStorage | undefined;

export function getObjectStorage(): ObjectStorage {
  if (storage) return storage;

  const provider = process.env.STORAGE_PROVIDER || 'vercel-blob';
  if (provider !== 'vercel-blob') {
    throw new Error(`Unsupported STORAGE_PROVIDER: ${provider}`);
  }

  storage = new VercelBlobStorage();
  return storage;
}

export function resetObjectStorageForTests(): void {
  storage = undefined;
}
