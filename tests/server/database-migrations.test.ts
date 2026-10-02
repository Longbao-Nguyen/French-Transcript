import assert from 'node:assert/strict';
import test from 'node:test';

import { loadMigrations, migrationChecksum } from '../../scripts/migrate';
import { shouldMigrateDuringBuild } from '../../scripts/migrate-deploy';

test('queue cancellation migration preserves existing job data and adds durable per-user queue state', async () => {
  const migrations = await loadMigrations();
  assert.deepEqual(migrations.map(({ filename }) => filename), ['001_initial.sql', '002_queue_cancellation.sql']);

  const migrationSql = migrations.map(({ sql }) => sql).join('\n');
  const createdTables = [...migrationSql.matchAll(/create table if not exists\s+([a-z_]+)/gi)]
    .map((match) => match[1]);

  assert.deepEqual(createdTables, ['users', 'jobs', 'user_queue_state']);
  assert.doesNotMatch(migrationSql, /\b(?:drop table|truncate|delete from jobs)\b/i);
  assert.match(migrationSql, /worker_run_id text/i);
  assert.match(migrationSql, /'CANCEL_REQUESTED'/);
  assert.match(migrationSql, /'PAUSED'/);
  assert.doesNotMatch(migrationSql, /references\s+worker_runs/i);
});

test('database migrations have stable versions and checksums', async () => {
  const migrations = await loadMigrations();
  for (const migration of migrations) {
    assert.match(migration.version, /^\d+$/);
    assert.match(migration.checksum, /^[a-f0-9]{64}$/);
  }
  assert.equal(migrationChecksum('select 1;\r\n'), migrationChecksum('select 1;\n'));
});

test('deployment migration runs only for the production target', () => {
  assert.equal(shouldMigrateDuringBuild('production'), true);
  assert.equal(shouldMigrateDuringBuild('preview'), false);
  assert.equal(shouldMigrateDuringBuild(undefined), false);
});
