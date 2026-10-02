import assert from 'node:assert/strict';
import test from 'node:test';

import { getAuthConfig, handleAuthRequest } from '../../server/auth/config';

test('Auth.js is configured for Google and serves CSRF-protected actions', async () => {
  const previous = {
    AUTH_SECRET: process.env.AUTH_SECRET,
    AUTH_URL: process.env.AUTH_URL,
    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
    NEXTAUTH_URL: process.env.NEXTAUTH_URL,
  };
  process.env.AUTH_SECRET = 'test-secret-that-is-long-enough-for-auth';
  process.env.GOOGLE_CLIENT_ID = 'google-client-id';
  process.env.GOOGLE_CLIENT_SECRET = 'google-client-secret';
  delete process.env.AUTH_URL;
  delete process.env.NEXTAUTH_URL;
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

test('Auth.js serves production session, provider, sign-in, and callback routes', async () => {
  const previous = {
    AUTH_SECRET: process.env.AUTH_SECRET,
    AUTH_URL: process.env.AUTH_URL,
    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
    NEXTAUTH_URL: process.env.NEXTAUTH_URL,
  };
  process.env.AUTH_SECRET = 'test-secret-that-is-long-enough-for-auth';
  process.env.GOOGLE_CLIENT_ID = 'google-client-id';
  process.env.GOOGLE_CLIENT_SECRET = 'google-client-secret';
  delete process.env.AUTH_URL;
  delete process.env.NEXTAUTH_URL;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (input, init) => {
    const url = input instanceof Request ? input.url : input.toString();
    if (url === 'https://accounts.google.com/.well-known/openid-configuration') {
      return Response.json({
        issuer: 'https://accounts.google.com',
        authorization_endpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
        token_endpoint: 'https://oauth2.googleapis.com/token',
        userinfo_endpoint: 'https://openidconnect.googleapis.com/v1/userinfo',
        jwks_uri: 'https://www.googleapis.com/oauth2/v3/certs',
      });
    }
    return originalFetch(input, init);
  }) as typeof fetch;

  const productionHeaders = {
    host: 'french-transcript.vercel.app',
    'x-forwarded-host': 'french-transcript.vercel.app',
    'x-forwarded-proto': 'https',
  };

  try {
    const sessionResponse = await handleAuthRequest(new Request(
      'https://french-transcript.vercel.app/api/auth/session',
      { headers: productionHeaders },
    ));
    assert.equal(sessionResponse.status, 200);
    assert.equal(sessionResponse.headers.get('content-type')?.includes('application/json'), true);
    assert.equal(await sessionResponse.json(), null);

    const providersResponse = await handleAuthRequest(new Request(
      'https://french-transcript.vercel.app/api/auth/providers',
      { headers: productionHeaders },
    ));
    const providers = await providersResponse.json() as {
      google?: { callbackUrl?: string; signinUrl?: string };
    };
    assert.equal(providersResponse.status, 200);
    assert.equal(providers.google?.signinUrl, 'https://french-transcript.vercel.app/api/auth/signin/google');
    assert.equal(providers.google?.callbackUrl, 'https://french-transcript.vercel.app/api/auth/callback/google');

    const csrfResponse = await handleAuthRequest(new Request(
      'https://french-transcript.vercel.app/api/auth/csrf',
      { headers: productionHeaders },
    ));
    const { csrfToken } = await csrfResponse.json() as { csrfToken: string };
    const csrfCookie = csrfResponse.headers.get('set-cookie')?.match(/(?:^|, )([^=]*csrf-token=[^;]+)/)?.[1];
    assert.equal(typeof csrfCookie, 'string');

    const signInResponse = await handleAuthRequest(new Request(
      'https://french-transcript.vercel.app/api/auth/signin/google',
      {
        method: 'POST',
        headers: {
          ...productionHeaders,
          'content-type': 'application/x-www-form-urlencoded',
          cookie: csrfCookie!,
        },
        body: new URLSearchParams({
          csrfToken,
          callbackUrl: 'https://french-transcript.vercel.app',
        }),
      },
    ));
    assert.equal(signInResponse.status, 302);
    assert.match(signInResponse.headers.get('location') ?? '', /^https:\/\/accounts\.google\.com\//);

    const originalConsoleError = console.error;
    let callbackResponse: Response;
    try {
      // A callback without Google's state/code is expected to become an Auth.js error redirect.
      console.error = () => undefined;
      callbackResponse = await handleAuthRequest(new Request(
        'https://french-transcript.vercel.app/api/auth/callback/google',
        { headers: productionHeaders },
      ));
    } finally {
      console.error = originalConsoleError;
    }
    assert.equal(callbackResponse.status, 302);
    assert.match(callbackResponse.headers.get('location') ?? '', /^https:\/\/french-transcript\.vercel\.app\/api\/auth\/error/);
  } finally {
    globalThis.fetch = originalFetch;
    for (const [name, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  }
});
