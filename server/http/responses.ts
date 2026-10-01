export class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly code?: string,
  ) {
    super(message);
  }
}

export function jsonResponse(payload: unknown, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers);
  headers.set('Content-Type', 'application/json; charset=utf-8');
  headers.set('Cache-Control', 'no-store');
  return new Response(JSON.stringify(payload), { ...init, headers });
}

export async function readJson<T>(request: Request): Promise<T> {
  const contentType = request.headers.get('content-type') || '';
  if (!contentType.toLowerCase().includes('application/json')) {
    throw new HttpError(415, 'Expected an application/json request body.', 'UNSUPPORTED_MEDIA_TYPE');
  }

  try {
    return (await request.json()) as T;
  } catch {
    throw new HttpError(400, 'Request body must be valid JSON.', 'INVALID_JSON');
  }
}

export function route(handler: (request: Request) => Promise<Response>): (request: Request) => Promise<Response> {
  return async (request: Request) => {
    try {
      return await handler(request);
    } catch (error) {
      if (error instanceof HttpError) {
        return jsonResponse(
          { error: { code: error.code || 'REQUEST_ERROR', message: error.message } },
          { status: error.status },
        );
      }

      console.error('api_request_failed', error);
      return jsonResponse(
        { error: { code: 'INTERNAL_ERROR', message: 'The server could not complete this request.' } },
        { status: 500 },
      );
    }
  };
}

export function extractPathId(pathname: string, prefix: string, suffix = ''): string {
  if (!pathname.startsWith(prefix) || (suffix && !pathname.endsWith(suffix))) {
    throw new HttpError(400, 'Invalid route path.', 'INVALID_ROUTE');
  }
  const end = suffix ? pathname.length - suffix.length : pathname.length;
  const value = pathname.slice(prefix.length, end);
  if (!value || value.includes('/')) {
    throw new HttpError(400, 'Invalid resource identifier.', 'INVALID_ID');
  }
  return decodeURIComponent(value);
}
