import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

interface VercelConfig {
  rewrites?: Array<{ source: string; destination: string }>;
}

function findTypeScriptFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const pathname = join(directory, entry.name);
    if (entry.isDirectory()) return findTypeScriptFiles(pathname);
    return entry.isFile() && entry.name.endsWith('.ts') ? [pathname] : [];
  });
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

test('Vercel backend uses Node ESM-resolvable relative import specifiers', () => {
  const backendFiles = [
    ...findTypeScriptFiles(fileURLToPath(new URL('../../api', import.meta.url))),
    ...findTypeScriptFiles(fileURLToPath(new URL('../../server', import.meta.url))),
  ];
  const relativeImport = /(?:from\s+|import\s*\()\s*['"](\.{1,2}\/[^'"]+)['"]/g;

  for (const pathname of backendFiles) {
    const source = readFileSync(pathname, 'utf8');
    for (const match of source.matchAll(relativeImport)) {
      assert.match(match[1], /\.js$/, `${pathname} has a Node ESM-incompatible import: ${match[1]}`);
    }
  }
});
