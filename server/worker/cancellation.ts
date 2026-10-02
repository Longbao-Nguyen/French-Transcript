import { createHmac, timingSafeEqual } from 'node:crypto';

import { HttpError } from '../http/responses.js';

export interface WorkerJobScope {
  userId: string;
  jobId: string;
  workerRunId: string;
  expiresAt: number;
}

// Issued only by the trusted worker-start flow in Milestone 6; never by a browser route.
export function signWorkerJobScope(scope: WorkerJobScope, secret: string): string {
  const body = Buffer.from(JSON.stringify(scope)).toString('base64url');
  const signature = createHmac('sha256', secret).update(body).digest('base64url');
  return `${body}.${signature}`;
}

export function requireWorkerJobScope(request: Request, jobId: string): WorkerJobScope {
  const secret = process.env.WORKER_CALLBACK_SECRET;
  if (!secret) throw new HttpError(503, 'Worker integration is not configured.', 'WORKER_NOT_CONFIGURED');
  const match = /^Bearer ([A-Za-z0-9_-]+)\.([A-Za-z0-9_-]+)$/.exec(request.headers.get('authorization') ?? '');
  if (!match) throw new HttpError(401, 'Worker authorization is required.', 'WORKER_UNAUTHORIZED');
  const [, body, signature] = match;
  const expected = createHmac('sha256', secret).update(body).digest();
  const provided = Buffer.from(signature, 'base64url');
  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) {
    throw new HttpError(401, 'Invalid worker authorization.', 'WORKER_UNAUTHORIZED');
  }
  let scope: WorkerJobScope;
  try {
    scope = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as WorkerJobScope;
  } catch {
    throw new HttpError(401, 'Invalid worker authorization.', 'WORKER_UNAUTHORIZED');
  }
  if (scope.jobId !== jobId || !scope.userId || !scope.workerRunId
    || !Number.isFinite(scope.expiresAt) || scope.expiresAt <= Date.now()) {
    throw new HttpError(401, 'Expired or mismatched worker authorization.', 'WORKER_UNAUTHORIZED');
  }
  return scope;
}
