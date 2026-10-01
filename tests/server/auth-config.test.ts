import assert from 'node:assert/strict';
import test from 'node:test';

import { getAuthConfig, handleAuthRequest } from '../../server/auth/config';

test('Auth.js is configured for Google and serves CSRF-protected actions', async () => {
  const previous = {
    AUTH_SECRET: process.env.AUTH_SECRET,
    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
  };
  process.env.AUTH_SECRET = 'test-secret-that-is-long-enough-for-auth';
  process.env.GOOGLE_CLIENT_ID = 'google-client-id';
  process.env.GOOGLE_CLIENT_SECRET = 'google-client-secret';
  try {
    const config = getAuthConfig();
    const provider = typeof config.providers[0] === 'function' ? config.providers[0]() : config.providers[0];
    assert.equal(config.basePath, '/api/auth');
    assert.equal(config.session?.strategy, 'jwt');
    assert.equal(provider.id, 'google');
    const response = await handleAuthRequest(new Request('http://localhost:3000/api/auth/csrf'));
    const payload = await response.json() as { csrfToken?: string };
    assert.equal(response.status, 200);
    assert.equal(typeof payload.csrfToken, 'string');
    assert.equal(response.headers.has('set-cookie'), true);
  } finally {
    for (const [name, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  }
});
