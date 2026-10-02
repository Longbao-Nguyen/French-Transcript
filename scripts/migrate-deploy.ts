import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { runMigrations } from './migrate.js';

export function shouldMigrateDuringBuild(environment: string | undefined): boolean {
  return environment === 'production';
}

const isMainModule = process.argv[1]
  ? path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
  : false;

if (isMainModule) {
  if (shouldMigrateDuringBuild(process.env.VERCEL_ENV)) {
    await runMigrations();
  } else {
    console.log('Skipping database migrations outside a Vercel production build.');
  }
}
