# Milestones 2–4 — Auth, Durable Jobs, Vercel Blob Uploads, and Queue UI

Implemented on 2026-10-02. Milestone 3 was migrated from Cloudflare R2 to Vercel Blob on the same date. This document supersedes the R2 details in the original implementation plan.

## Milestone 2: Google authentication and database abstraction

- Auth.js Core handles Google OAuth at `/api/auth/*` with encrypted JWT sessions.
- Google users are upserted into the application `users` repository; the internal user ID stored in the encrypted session token is the only ownership identity accepted by application APIs.
- `server/db/interface.ts` defines provider-neutral user, job, worker, and settings repositories.
- PostgreSQL/Neon remains the durable job database and its adapter remains under `server/db/providers/postgres/`.
- Existing database columns `source_object_key` and `output_object_key` now contain provider-neutral storage pathnames. No PostgreSQL provider or schema change is required.
- Apply the ordered SQL migrations before the first sign-in. The migration runner uses one
  transaction, a PostgreSQL advisory lock, and checksums recorded in `schema_migrations`, so it
  can be run repeatedly and will not reapply or silently modify an existing migration.

For local development, pull the linked development environment and migrate:

```powershell
vercel env pull .env.local --environment=development --yes
npm run db:migrate
```

For the production database, copy its PostgreSQL connection string from the Neon dashboard into
the Git-ignored `.env.production.local` file as `DATABASE_URL`. Vercel marks this value as a
Sensitive Environment Variable, so `vercel env pull` and `vercel env run` return a `[SENSITIVE]`
placeholder instead of the secret. Then run this exact command from the repository root:

```powershell
npm run db:migrate -- --env-file=.env.production.local
```

The environment files are ignored by Git and must never be committed. Migration `001_initial.sql`
creates only `users` (Google identity) and `jobs` (durable uploads/queue), which are required by
Milestones 2–4. `worker_runs` and `kaggle_connections` are deferred until the Kaggle worker
milestones; `user_settings` is deferred until a settings API/UI exists. The nullable
`jobs.worker_run_id` column is reserved for that later migration and currently has no foreign key.

Google's authorized redirect URI must be:

```text
https://<app-domain>/api/auth/callback/google
```

For local development, use `http://localhost:3000/api/auth/callback/google`.

## Milestone 3: private Vercel Blob direct upload

The browser flow is:

```text
POST /api/uploads/init (small JSON metadata only)
  -> create one authenticated job in PostgreSQL
  -> generate the job's storage pathname on the server
browser calls @vercel/blob/client uploadPresigned(..., multipart: true)
POST /api/uploads/blob (small presigned-request metadata only)
  -> re-authenticate the user
  -> require the owned job to be UPLOADING
  -> require the exact server-generated pathname, content type, and maximum size
  -> use project-scoped OIDC to issue a pathname-scoped signed upload delegation
browser uploads file parts directly to the private Blob store
POST /api/uploads/:jobId/complete
  -> ownership check
  -> Blob metadata/pathname/size verification
  -> UPLOADING -> QUEUED
```

Large audio/video bytes never enter a Vercel Function request body. The Function receives only upload metadata and the presigned-upload exchange. Multipart uploads are always enabled for reliability with large files.

Pathnames are generated under `users/{userId}/jobs/{jobId}/source/`. Although the browser must echo the generated pathname to the official Blob client SDK, it cannot select an arbitrary pathname: `/api/uploads/blob` compares it to the owned PostgreSQL job before issuing a one-hour, size/type/path-scoped upload delegation. Random suffixes and overwrites are disabled because every job already has a unique server-generated pathname.

The server-side Blob SDK authenticates with Vercel's automatically injected, short-lived `VERCEL_OIDC_TOKEN` and the connected store's `BLOB_STORE_ID`. No long-lived Blob read-write token is required or accepted by application code. `BLOB_WEBHOOK_PUBLIC_KEY` is intentionally absent because this application does not consume Blob completion webhooks; the authenticated browser calls `/api/uploads/:jobId/complete`, which independently verifies the stored object.

`server/storage/interface.ts` is the provider-neutral boundary used by routes and services. The Vercel-specific implementation is isolated in `server/storage/providers/vercel-blob.ts`; the browser SDK wrapper is isolated in `src/features/upload/vercelBlobClient.ts`.

The storage abstraction supports:

- metadata lookup for upload-complete verification;
- authenticated private reads;
- source-media deletion after successful transcription;
- transcript-artifact deletion during expiry/cleanup.

Public job APIs continue to enforce the authenticated owner:

- `GET /api/jobs`
- `GET /api/jobs/:jobId`
- `GET /api/jobs/:jobId/download`

Completed transcript downloads are streamed from the private store only after job ownership, completion status, and expiry are checked. Provider URLs and Blob credentials are never returned. The response uses `private, no-store` caching, so each download is a fresh authorized request rather than a durable public link. Only the small completed transcript passes through the Function; source media does not.

## Milestone 4: queue UI and polling

- The V2 page requires Google sign-in and restores jobs from `GET /api/jobs`.
- File selection and drag/drop accept multiple opaque audio/video files.
- Every file initializes, uploads, completes, and fails independently.
- Upload progress comes from the official Vercel Blob client upload callback.
- Current jobs and completed/recent jobs replace the transcript Results panel.
- No transcript content is returned in the client job contract or rendered in the V2 DOM before an authorized download.
- Adaptive batched polling runs at 3–10 second intervals according to active phases and stops when all jobs are terminal.
- Each completed, unexpired row has one explicit Download button.
- SSE is not used or reintroduced.

## Vercel dashboard configuration

Configure the production and preview projects as follows:

1. Open the Vercel project, go to **Storage**, create a **Blob** store, and choose **Private** access. Store access cannot be changed after creation, so do not create a public store.
2. Connect that private Blob store to this project and use the project's **Upgrade to OIDC** action if this is an older token-based connection. The connection supplies `BLOB_STORE_ID`; Vercel Functions receive and rotate `VERCEL_OIDC_TOKEN` automatically.
3. Do not configure `BLOB_READ_WRITE_TOKEN` or any `VITE_`-prefixed Blob credential. No Blob credential is exposed to browser code; the browser receives only a short-lived, pathname-scoped presigned upload delegation from `/api/uploads/blob`.
4. In **Settings → Environment Variables**, keep the existing auth/database values: `AUTH_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `APP_BASE_URL`, `DB_PROVIDER=postgres`, and `DATABASE_URL`.
5. Set `STORAGE_PROVIDER=vercel-blob` or omit it because `vercel-blob` is the default. Optionally set `MAX_UPLOAD_BYTES`; it defaults to 2 GiB and must not exceed the limits of the selected Vercel plan/store.
6. Redeploy after connecting the store or changing environment variables. Confirm Google OAuth still has the exact production/preview callback URL where needed.

No R2 credentials, bucket policy, R2 CORS configuration, long-lived Blob token, or Blob webhook key is used. For local development, run `vercel link` and `vercel env pull .env.local`; this supplies `BLOB_STORE_ID` and a short-lived `VERCEL_OIDC_TOKEN`. Re-run the pull when the local OIDC token expires. Never commit that local token.

Required V2 environment variables:

```text
AUTH_SECRET
GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET
APP_BASE_URL
DB_PROVIDER=postgres
DATABASE_URL
BLOB_STORE_ID
```

Optional:

```text
STORAGE_PROVIDER=vercel-blob
MAX_UPLOAD_BYTES=2147483648
```

## Legacy rollback

The old Express server, SSE routes, Results panel, client transcript assembly, and manual Colab modal remain in the repository. Start `npm run dev:legacy` and open `/?legacy=1` to use the legacy UI. They are not imported by the normal V2 application flow. This legacy rollback is the only place where the old SSE behavior remains.

## Current boundary

Milestones 2–4 create durable authenticated uploads and queues. Jobs intentionally remain `QUEUED` until Milestones 5–6 add Kaggle OAuth and the worker. No temporary fake worker or server-side media processing was introduced.

Before release, run `npm run lint`, `npm test`, `npx tsc --noEmit`, and `npm run build`. End-to-end Google/PostgreSQL/Vercel Blob verification requires real deployment credentials and must be performed in a configured preview environment.
