create table if not exists users (
  id text primary key,
  email text not null unique,
  google_subject text not null unique,
  display_name text,
  image_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists kaggle_connections (
  id text primary key,
  user_id text not null unique references users(id) on delete cascade,
  kaggle_username text not null,
  encrypted_access_token text not null,
  encrypted_refresh_token text,
  access_token_expires_at timestamptz,
  kernel_slug text,
  connected_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists worker_runs (
  id text primary key,
  user_id text not null references users(id) on delete cascade,
  kaggle_run_identifier text,
  status text not null,
  started_at timestamptz not null default now(),
  last_heartbeat_at timestamptz,
  completed_at timestamptz,
  error_message text
);

create index if not exists worker_runs_user_started_idx
  on worker_runs (user_id, started_at desc);

create table if not exists jobs (
  id text primary key,
  user_id text not null references users(id) on delete cascade,
  original_filename text not null,
  source_object_key text not null unique,
  output_object_key text,
  content_type text not null,
  file_size_bytes bigint not null check (file_size_bytes > 0),
  status text not null,
  progress double precision,
  duration_sec double precision,
  processed_audio_sec double precision,
  error_code text,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  upload_completed_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  expires_at timestamptz,
  worker_run_id text references worker_runs(id) on delete set null,
  constraint jobs_status_check check (status in (
    'CREATED', 'UPLOADING', 'QUEUED', 'WORKER_STARTING', 'PREPROCESSING',
    'TRANSCRIBING', 'FINALIZING', 'COMPLETED', 'FAILED_UPLOAD',
    'FAILED_WORKER_START', 'FAILED_MEDIA', 'FAILED_INFERENCE',
    'FAILED_OUTPUT', 'CANCELLED', 'EXPIRED'
  )),
  constraint jobs_progress_check check (progress is null or (progress >= 0 and progress <= 1))
);

create index if not exists jobs_user_created_idx on jobs (user_id, created_at desc);
create index if not exists jobs_user_queue_idx on jobs (user_id, status, created_at asc);

create table if not exists user_settings (
  user_id text primary key references users(id) on delete cascade,
  auto_download_enabled boolean not null default false,
  updated_at timestamptz not null default now()
);
