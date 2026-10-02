create table if not exists user_queue_state (
  user_id text primary key references users(id) on delete cascade,
  state text not null default 'IDLE' check (state in ('IDLE', 'RUNNING', 'PAUSING', 'PAUSED')),
  updated_at timestamptz not null default now()
);

alter table jobs drop constraint jobs_status_check;
alter table jobs add constraint jobs_status_check check (status in (
  'CREATED', 'UPLOADING', 'QUEUED', 'PROCESSING', 'WORKER_STARTING',
  'PREPROCESSING', 'TRANSCRIBING', 'FINALIZING', 'CANCEL_REQUESTED',
  'COMPLETED', 'FAILED_UPLOAD', 'FAILED_WORKER_START', 'FAILED_MEDIA',
  'FAILED_INFERENCE', 'FAILED_OUTPUT', 'CANCELLED', 'EXPIRED'
));
