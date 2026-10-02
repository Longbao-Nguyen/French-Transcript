import { getToken } from '@auth/core/jwt';

import { getRepositories } from '../db/index.js';
import type { User } from '../db/interface.js';
import { HttpError } from '../http/responses.js';

export async function requireUser(request: Request): Promise<User> {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error('AUTH_SECRET is required.');

  const token = await getToken({
    req: request,
    secret,
    secureCookie: request.headers.get('x-forwarded-proto') === 'https'
      || new URL(request.url).protocol === 'https:',
  });
  const userId = token?.appUserId;
  if (typeof userId !== 'string') {
    throw new HttpError(401, 'Sign in is required.', 'UNAUTHENTICATED');
  }

  const repositories = await getRepositories();
  const user = await repositories.users.getById(userId);
  if (!user) {
    throw new HttpError(401, 'Your session is no longer valid.', 'INVALID_SESSION');
  }
  return user;
}
