import type { Sql } from 'postgres';

import { createId } from '../../ids.js';
import type {
  Job,
  JobPatch,
  JobRepository,
  ListJobOptions,
  NewJob,
  Repositories,
  UpsertGoogleUserInput,
  User,
  UserRepository,
  UserSettings,
  UserSettingsRepository,
  WorkerRepository,
  WorkerState,
} from '../../interface.js';
import { getPostgresClient } from './client.js';

type Row = Record<string, unknown>;

function asDate(value: unknown): Date {
  return value instanceof Date ? value : new Date(String(value));
}

function asNullableDate(value: unknown): Date | null {
  return value == null ? null : asDate(value);
}

function mapUser(row: Row): User {
  return {
    id: String(row.id),
    email: String(row.email),
    displayName: row.display_name == null ? null : String(row.display_name),
    imageUrl: row.image_url == null ? null : String(row.image_url),
    createdAt: asDate(row.created_at),
    updatedAt: asDate(row.updated_at),
  };
}

function mapJob(row: Row): Job {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    originalFilename: String(row.original_filename),
    sourceObjectKey: String(row.source_object_key),
    outputObjectKey: row.output_object_key == null ? null : String(row.output_object_key),
    contentType: String(row.content_type),
    fileSizeBytes: Number(row.file_size_bytes),
    status: row.status as Job['status'],
    progress: row.progress == null ? null : Number(row.progress),
    durationSec: row.duration_sec == null ? null : Number(row.duration_sec),
    processedAudioSec: row.processed_audio_sec == null ? null : Number(row.processed_audio_sec),
    errorCode: row.error_code == null ? null : String(row.error_code),
    errorMessage: row.error_message == null ? null : String(row.error_message),
    createdAt: asDate(row.created_at),
    updatedAt: asDate(row.updated_at),
    uploadCompletedAt: asNullableDate(row.upload_completed_at),
    startedAt: asNullableDate(row.started_at),
    completedAt: asNullableDate(row.completed_at),
    expiresAt: asNullableDate(row.expires_at),
    workerRunId: row.worker_run_id == null ? null : String(row.worker_run_id),
  };
}

class PostgresUserRepository implements UserRepository {
  constructor(private readonly sql: Sql) {}

  async getById(id: string): Promise<User | null> {
    const rows = await this.sql`select * from users where id = ${id} limit 1`;
    return rows[0] ? mapUser(rows[0] as Row) : null;
  }

  async getByEmail(email: string): Promise<User | null> {
    const rows = await this.sql`select * from users where lower(email) = lower(${email}) limit 1`;
    return rows[0] ? mapUser(rows[0] as Row) : null;
  }

  async upsertGoogleUser(input: UpsertGoogleUserInput): Promise<User> {
    const id = createId('usr');
    const rows = await this.sql`
      insert into users (id, email, google_subject, display_name, image_url)
      values (${id}, ${input.email.toLowerCase()}, ${input.googleSubject}, ${input.displayName ?? null}, ${input.imageUrl ?? null})
      on conflict (email) do update set
        google_subject = excluded.google_subject,
        display_name = excluded.display_name,
        image_url = excluded.image_url,
        updated_at = now()
      returning *
    `;
    return mapUser(rows[0] as Row);
  }
}

const PATCH_COLUMNS: Record<keyof JobPatch, string> = {
  status: 'status',
  progress: 'progress',
  durationSec: 'duration_sec',
  processedAudioSec: 'processed_audio_sec',
  outputObjectKey: 'output_object_key',
  errorCode: 'error_code',
  errorMessage: 'error_message',
  uploadCompletedAt: 'upload_completed_at',
  startedAt: 'started_at',
  completedAt: 'completed_at',
  expiresAt: 'expires_at',
  workerRunId: 'worker_run_id',
};

class PostgresJobRepository implements JobRepository {
  constructor(private readonly sql: Sql) {}

  async create(input: NewJob): Promise<Job> {
    const rows = await this.sql`
      insert into jobs (
        id, user_id, original_filename, source_object_key, content_type,
        file_size_bytes, status, progress
      ) values (
        ${input.id}, ${input.userId}, ${input.originalFilename}, ${input.sourceObjectKey},
        ${input.contentType}, ${input.fileSizeBytes}, ${input.status}, 0
      )
      returning *
    `;
    return mapJob(rows[0] as Row);
  }

  async getByIdForUser(jobId: string, userId: string): Promise<Job | null> {
    const rows = await this.sql`select * from jobs where id = ${jobId} and user_id = ${userId} limit 1`;
    return rows[0] ? mapJob(rows[0] as Row) : null;
  }

  async listForUser(userId: string, options: ListJobOptions = {}): Promise<Job[]> {
    const limit = Math.min(Math.max(options.limit ?? 100, 1), 200);
    const rows = options.activeAndRecent === false
      ? await this.sql`select * from jobs where user_id = ${userId} order by created_at desc limit ${limit}`
      : await this.sql`
          select * from jobs
          where user_id = ${userId}
            and (
              status in ('CREATED', 'UPLOADING', 'QUEUED', 'WORKER_STARTING', 'PREPROCESSING', 'TRANSCRIBING', 'FINALIZING')
              or created_at >= now() - interval '7 days'
            )
          order by created_at desc
          limit ${limit}
        `;
    return rows.map((row) => mapJob(row as Row));
  }

  async updateForUser(jobId: string, userId: string, patch: JobPatch): Promise<Job | null> {
    const entries = Object.entries(patch).filter(([, value]) => value !== undefined) as [keyof JobPatch, unknown][];
    if (entries.length === 0) return this.getByIdForUser(jobId, userId);

    const update = Object.fromEntries(entries.map(([key, value]) => [PATCH_COLUMNS[key], value]));
    update.updated_at = new Date();

    const rows = await this.sql`
      update jobs set ${this.sql(update)}
      where id = ${jobId} and user_id = ${userId}
      returning *
    `;
    return rows[0] ? mapJob(rows[0] as Row) : null;
  }

  async claimNextQueuedJob(userId: string, workerRunId: string): Promise<Job | null> {
    return this.sql.begin(async (transaction) => {
      const rows = await transaction`
        update jobs set
          status = 'PREPROCESSING',
          worker_run_id = ${workerRunId},
          started_at = coalesce(started_at, now()),
          updated_at = now()
        where id = (
          select id from jobs
          where user_id = ${userId} and status = 'QUEUED'
          order by created_at asc
          for update skip locked
          limit 1
        )
        returning *
      `;
      return rows[0] ? mapJob(rows[0] as Row) : null;
    });
  }
}

class PostgresWorkerRepository implements WorkerRepository {
  constructor(private readonly sql: Sql) {}

  async getForUser(userId: string): Promise<WorkerState | null> {
    const rows = await this.sql`
      select * from worker_runs where user_id = ${userId} order by started_at desc limit 1
    `;
    const row = rows[0] as Row | undefined;
    if (!row) return null;
    return {
      id: String(row.id),
      userId: String(row.user_id),
      kaggleRunIdentifier: row.kaggle_run_identifier == null ? null : String(row.kaggle_run_identifier),
      status: String(row.status),
      startedAt: asDate(row.started_at),
      lastHeartbeatAt: asNullableDate(row.last_heartbeat_at),
      completedAt: asNullableDate(row.completed_at),
      errorMessage: row.error_message == null ? null : String(row.error_message),
    };
  }

  async upsertForUser(userId: string, state: WorkerState): Promise<void> {
    await this.sql`
      insert into worker_runs (
        id, user_id, kaggle_run_identifier, status, started_at,
        last_heartbeat_at, completed_at, error_message
      ) values (
        ${state.id}, ${userId}, ${state.kaggleRunIdentifier}, ${state.status}, ${state.startedAt},
        ${state.lastHeartbeatAt}, ${state.completedAt}, ${state.errorMessage}
      )
      on conflict (id) do update set
        kaggle_run_identifier = excluded.kaggle_run_identifier,
        status = excluded.status,
        last_heartbeat_at = excluded.last_heartbeat_at,
        completed_at = excluded.completed_at,
        error_message = excluded.error_message
    `;
  }
}

class PostgresUserSettingsRepository implements UserSettingsRepository {
  constructor(private readonly sql: Sql) {}

  async getForUser(userId: string): Promise<UserSettings> {
    const rows = await this.sql`
      insert into user_settings (user_id) values (${userId})
      on conflict (user_id) do update set user_id = excluded.user_id
      returning *
    `;
    return {
      userId,
      autoDownloadEnabled: Boolean(rows[0].auto_download_enabled),
      updatedAt: asDate(rows[0].updated_at),
    };
  }

  async updateForUser(userId: string, patch: Pick<UserSettings, 'autoDownloadEnabled'>): Promise<UserSettings> {
    const rows = await this.sql`
      insert into user_settings (user_id, auto_download_enabled)
      values (${userId}, ${patch.autoDownloadEnabled})
      on conflict (user_id) do update set
        auto_download_enabled = excluded.auto_download_enabled,
        updated_at = now()
      returning *
    `;
    return {
      userId,
      autoDownloadEnabled: Boolean(rows[0].auto_download_enabled),
      updatedAt: asDate(rows[0].updated_at),
    };
  }
}

export function createPostgresRepositories(sql = getPostgresClient()): Repositories {
  return {
    users: new PostgresUserRepository(sql),
    jobs: new PostgresJobRepository(sql),
    workers: new PostgresWorkerRepository(sql),
    settings: new PostgresUserSettingsRepository(sql),
  };
}
