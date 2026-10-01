# Milestones 2–4 — Auth, Durable Jobs, R2 Uploads, and Queue UI

Implemented on 2026-10-02.

## Milestone 2: Google authentication and database abstraction

- Auth.js Core handles Google OAuth at `/api/auth/*` with encrypted JWT sessions.
- Google users are upserted into the application `users` repository; the internal user ID is placed in the encrypted session token and is the only ownership identity accepted by application APIs.
- `server/db/interface.ts` defines provider-neutral user, job, worker, and settings repositories.
- PostgreSQL is the initial adapter under `server/db/providers/postgres/`. No UI, API route, auth helper, upload service, or job service imports `postgres` directly.
- `001_initial.sql` creates users, Kaggle connections, jobs, worker runs, user settings, indexes, status/progress constraints, and foreign keys.
- Run `npm run db:migrate` after setting `DATABASE_URL`.

Google's authorized redirect URI must be:

```text
https://<app-domain>/api/auth/callback/google
```

For local Vercel development, use `http://localhost:3000/api/auth/callback/google`.

## Milestone 3: private R2 direct upload

The browser flow is:

```text
POST /api/uploads/init
  -> authenticated job in PostgreSQL
  -> 15-minute presigned R2 PUT URL
browser PUT directly to R2 with upload progress
POST /api/uploads/:jobId/complete
  -> ownership check
  -> R2 HEAD object/size verification
  -> UPLOADING -> QUEUED
```

Large media never enters a Vercel Function request body. Object keys are generated server-side under `users/{userId}/jobs/{jobId}/source/`, filenames are normalized for storage, and raw object keys are not returned to the browser.

Required R2 bucket CORS behavior:

- allow the deployed app origin and local development origin;
- allow `PUT`, `GET`, and `HEAD`;
- allow the `Content-Type` header;
- do not make the bucket public.

Public job APIs enforce the authenticated owner:

- `GET /api/jobs`
- `GET /api/jobs/:jobId`
- `GET /api/jobs/:jobId/download`

The download API returns a five-minute signed URL only for a completed, unexpired artifact.

## Milestone 4: queue UI and polling

- The V2 page requires Google sign-in and restores jobs from `GET /api/jobs`.
- File selection and drag/drop accept multiple opaque audio/video files.
- Every file initializes, uploads, completes, and fails independently.
- Upload progress comes from browser-to-R2 XHR progress events.
- Current jobs and completed/recent jobs replace the transcript Results panel.
- No transcript content is returned in the client job contract or rendered in the V2 DOM.
- Adaptive batched polling runs at 3–10 second intervals according to active phases and stops when all jobs are terminal.
- Each completed, unexpired row has one explicit Download button.

## Legacy rollback

The old Express server, SSE routes, Results panel, client transcript assembly, and manual Colab modal remain in the repository. Start `npm run dev:legacy` and open `/?legacy=1` to use the legacy UI. They are not imported by the normal V2 application flow.

## Current boundary

Milestones 2–4 create durable authenticated uploads and queues. Jobs intentionally remain `QUEUED` until Milestones 5–6 add Kaggle OAuth and the worker. No temporary fake worker or server-side media processing was introduced.

Local lint, unit tests, static production build, serverless API bundle-smoke, dependency audit, and legacy build are required before release. End-to-end Google/PostgreSQL/R2 verification requires real deployment credentials and is therefore performed in the configured preview environment rather than with repository placeholder values.

## Environment variables

Required for V2:

```text
AUTH_SECRET
GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET
APP_BASE_URL
DB_PROVIDER=postgres
DATABASE_URL
R2_ACCOUNT_ID
R2_ACCESS_KEY_ID
R2_SECRET_ACCESS_KEY
R2_BUCKET_NAME
```

Optional:

```text
R2_ENDPOINT
MAX_UPLOAD_BYTES
```
