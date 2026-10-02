import type { ClientJob } from '../../types';
import { uploadPrivateMedia } from './vercelBlobClient';

interface UploadCallbacks {
  onInitialized(jobId: string): void;
  onProgress(progress: number): void;
  onFinalizing(): void;
}

async function responseError(response: Response): Promise<Error> {
  try {
    const payload = await response.json() as { error?: { message?: string } };
    return new Error(payload.error?.message || `Request failed with status ${response.status}.`);
  } catch {
    return new Error(`Request failed with status ${response.status}.`);
  }
}

export async function uploadFileDirectly(file: File, callbacks: UploadCallbacks): Promise<ClientJob> {
  const contentType = file.type || 'application/octet-stream';
  const initResponse = await fetch('/api/uploads/init', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ filename: file.name, size: file.size, contentType }),
  });
  if (!initResponse.ok) throw await responseError(initResponse);
  const init = await initResponse.json() as { jobId: string; uploadPathname: string };
  callbacks.onInitialized(init.jobId);

  try {
    await uploadPrivateMedia({
      jobId: init.jobId,
      pathname: init.uploadPathname,
      file,
      contentType,
      onProgress: callbacks.onProgress,
    });
    callbacks.onFinalizing();

    const completeResponse = await fetch(`/api/uploads/${encodeURIComponent(init.jobId)}/complete`, {
      method: 'POST',
      credentials: 'same-origin',
    });
    if (!completeResponse.ok) throw await responseError(completeResponse);
    const complete = await completeResponse.json() as { job: ClientJob };
    return complete.job;
  } catch (error) {
    await fetch(`/api/uploads/${encodeURIComponent(init.jobId)}/fail`, {
      method: 'POST',
      credentials: 'same-origin',
    }).catch(() => undefined);
    throw error;
  }
}
