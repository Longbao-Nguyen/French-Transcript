import type { ClientJob } from '../../types';

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

function putWithProgress(url: string, file: File, onProgress: (value: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open('PUT', url);
    request.setRequestHeader('Content-Type', file.type || 'application/octet-stream');
    request.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(Math.min(event.loaded / event.total, 1));
    };
    request.onload = () => {
      if (request.status >= 200 && request.status < 300) resolve();
      else reject(new Error(`Object upload failed with status ${request.status}.`));
    };
    request.onerror = () => reject(new Error('Object upload failed. Check the R2 CORS configuration.'));
    request.onabort = () => reject(new Error('Upload was cancelled.'));
    request.send(file);
  });
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
  const init = await initResponse.json() as { jobId: string; uploadUrl: string };
  callbacks.onInitialized(init.jobId);

  try {
    await putWithProgress(init.uploadUrl, file, callbacks.onProgress);
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
