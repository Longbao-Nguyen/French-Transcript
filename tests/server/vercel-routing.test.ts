import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

interface VercelConfig {
  rewrites?: Array<{ source: string; destination: string }>;
}

test('Vercel sends all Auth.js routes to the serverless handler before the SPA fallback', () => {
  const config = JSON.parse(
    readFileSync(new URL('../../vercel.json', import.meta.url), 'utf8'),
  ) as VercelConfig;
  const rewrites = config.rewrites ?? [];
  const authRewriteIndex = rewrites.findIndex(({ source }) => source === '/api/auth/:path*');
  const spaRewriteIndex = rewrites.findIndex(({ destination }) => destination === '/index.html');

  assert.notEqual(authRewriteIndex, -1);
  assert.equal(rewrites[authRewriteIndex]?.destination, '/api/auth/[...auth]');
  assert.equal(rewrites[spaRewriteIndex]?.source, '/:path((?!api(?:/|$)).*)');
  assert.equal(authRewriteIndex < spaRewriteIndex, true);
});
