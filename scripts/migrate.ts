import fs from 'node:fs/promises';
import path from 'node:path';

import { getPostgresClient } from '../server/db/providers/postgres/client';

const migrationPath = path.resolve('server/db/providers/postgres/migrations/001_initial.sql');
const migration = await fs.readFile(migrationPath, 'utf8');
const sql = getPostgresClient();

try {
  await sql.unsafe(migration);
  console.log('Applied migration: 001_initial.sql');
} finally {
  await sql.end({ timeout: 5 });
}
