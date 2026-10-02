import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { config as loadEnvironment } from 'dotenv';

import { getPostgresClient } from '../server/db/providers/postgres/client.js';

const MIGRATION_FILENAME = /^(\d+)_[a-z0-9_-]+\.sql$/;
const MIGRATION_LOCK_ID = 1_802_450_210;
const DEFAULT_MIGRATION_DIRECTORY = fileURLToPath(new URL(
  '../server/db/providers/postgres/migrations/',
  import.meta.url,
));

export interface Migration {
  version: string;
  filename: string;
  checksum: string;
  sql: string;
}

export function migrationChecksum(sql: string): string {
  const normalizedSql = sql.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n');
  return createHash('sha256').update(normalizedSql).digest('hex');
}

export async function loadMigrations(directory = DEFAULT_MIGRATION_DIRECTORY): Promise<Migration[]> {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const migrations = await Promise.all(entries
    .filter((entry) => entry.isFile() && MIGRATION_FILENAME.test(entry.name))
    .sort((left, right) => left.name.localeCompare(right.name))
    .map(async (entry) => {
      const sql = await fs.readFile(path.join(directory, entry.name), 'utf8');
      return {
        version: entry.name.match(MIGRATION_FILENAME)![1],
        filename: entry.name,
        checksum: migrationChecksum(sql),
        sql,
      };
    }));

  const versions = new Set<string>();
  for (const migration of migrations) {
    if (versions.has(migration.version)) {
      throw new Error(`Duplicate database migration version: ${migration.version}`);
    }
    versions.add(migration.version);
  }
  return migrations;
}

function getArgumentValue(name: string): string | undefined {
  const prefix = `--${name}=`;
  return process.argv.find((argument) => argument.startsWith(prefix))?.slice(prefix.length);
}

export async function runMigrations(): Promise<void> {
  const requestedEnvFile = getArgumentValue('env-file');
  const envFile = requestedEnvFile ?? '.env.local';
  const environment = loadEnvironment({
    path: path.resolve(envFile),
    quiet: true,
    override: Boolean(requestedEnvFile),
  });
  if (requestedEnvFile && environment.error) {
    throw new Error(`Could not load the requested environment file: ${envFile}`, {
      cause: environment.error,
    });
  }
  if (process.env.DATABASE_URL?.trim() === '[SENSITIVE]') {
    throw new Error(
      `${envFile} contains Vercel's [SENSITIVE] placeholder. Copy the real PostgreSQL connection string from Neon into DATABASE_URL before migrating.`,
    );
  }

  const migrations = await loadMigrations();
  if (migrations.length === 0) throw new Error('No database migrations were found.');

  const sql = getPostgresClient();
  try {
    await sql.begin(async (transaction) => {
      await transaction`select pg_advisory_xact_lock(${MIGRATION_LOCK_ID})`;
      await transaction`
        create table if not exists schema_migrations (
          version text primary key,
          filename text not null,
          checksum text not null,
          applied_at timestamptz not null default now()
        )
      `;

      const appliedRows = await transaction<{
        version: string;
        filename: string;
        checksum: string;
      }[]>`select version, filename, checksum from schema_migrations order by version`;
      const applied = new Map(appliedRows.map((row) => [row.version, row]));

      for (const migration of migrations) {
        const previous = applied.get(migration.version);
        if (previous) {
          if (previous.filename !== migration.filename || previous.checksum !== migration.checksum) {
            throw new Error(
              `Migration ${migration.version} differs from the version already applied to this database.`,
            );
          }
          console.log(`Already applied: ${migration.filename}`);
          continue;
        }

        await transaction.unsafe(migration.sql);
        await transaction`
          insert into schema_migrations (version, filename, checksum)
          values (${migration.version}, ${migration.filename}, ${migration.checksum})
        `;
        console.log(`Applied migration: ${migration.filename}`);
      }
    });
  } finally {
    await sql.end({ timeout: 5 });
  }
}

const isMainModule = process.argv[1]
  ? path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
  : false;

if (isMainModule) {
  await runMigrations();
}
