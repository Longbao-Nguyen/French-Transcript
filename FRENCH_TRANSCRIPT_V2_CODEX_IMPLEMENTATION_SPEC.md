# French Transcript Web App — V2 Refactor & Migration Implementation Spec

> **Purpose:** This document is the implementation plan for Codex to refactor the existing French Transcript web app from the current Render + Colab architecture into a Vercel + R2 + Kaggle BYO-GPU architecture.
>
> **Primary repository:** `https://github.com/Longbao-Nguyen/French-Transcript.git`
>
> **Implementation style:** Work milestone-by-milestone. Do not perform a full rewrite in one step. Preserve working behavior where possible, replace architecture deliberately, and keep the app deployable at the end of each major milestone.

---

# 1. Final Product Goals

The application should become a browser-based transcription service where a non-technical user can:

1. Sign in with Google.
2. Connect their own Kaggle account with a single **Connect Kaggle GPU** button.
3. Upload one or many audio/video files.
4. Leave the page while jobs continue in the background.
5. Return later and see current/recent job states.
6. Download each completed transcript individually.
7. Optionally enable auto-download.
8. Never manually open Colab, copy notebook code, configure a GPU runtime, create a Kaggle notebook, or manage model files.

The application uses the user's Kaggle GPU quota instead of a developer-owned GPU pool.

---

# 2. Confirmed Product Decisions

These decisions are fixed unless implementation constraints make one impossible.

## Authentication

- Use **Google sign-in** for the application.
- Job ownership is linked to the authenticated app user.
- Do not identify users by IP address.

## Database

- Implement a provider abstraction.
- Do not hard-code the project to Supabase, Neon, or Vercel Postgres.
- Use a clean repository/data-access layer so a concrete provider can be selected later.
- Initial implementation may use a lightweight provider convenient for deployment, but the rest of the application must not depend directly on that provider's SDK.

## Object retention

- Delete original source media from R2 after transcription completes successfully.
- Keep completed transcript output for **24 hours**.
- Expired output should no longer be downloadable.
- Cleanup must be idempotent.

## Queue behavior

- Every uploaded file is a separate job.
- A single Kaggle kernel run should process the user's queued files **sequentially**.
- Load the model once per kernel run and reuse it across all queued jobs.
- Do not run multiple files concurrently on one GPU in the initial version.

## Auto-download

- Auto-download exists as a setting.
- It is **disabled by default**.
- Every completed job always has an explicit **Download** button.
- Auto-download failure must not affect the job state or delete the output.

## Job history

- Use authenticated-user history, not IP-local history.
- Refreshing, closing, or reopening the browser should not destroy jobs.
- Show current and recent jobs while their metadata/output is valid.
- Transcript output is downloadable only during its 24-hour retention period.
- UI should gracefully show expired jobs if metadata remains longer than the artifact.

## Kaggle integration

- UX requirement matters more than the internal Kaggle resource strategy.
- The user should only need to press **Connect Kaggle GPU**, authenticate/authorize with Kaggle, and continue using the app.
- The app must automatically perform the necessary Kaggle setup/run operations.
- Do not expose notebook creation, kernel slug management, dataset attachment, or runtime setup to normal users.

## Inference MVP

- Switch immediately to:
  - `faster-whisper`
  - CTranslate2
  - FP16
  - existing `bofenghuang/whisper-large-v3-french-distil-dec16`
- Do not retrain the model.
- Do not start with ONNX/TensorRT.
- Optimize infrastructure first, then benchmark additional inference variants.

## VAD

- VAD is **not part of the initial infrastructure migration milestone**.
- Prepare the worker architecture so VAD can be added cleanly afterward.
- Add VAD in a later performance/segmentation milestone.

## Spec detail

This file is intended as a full implementation specification:
- architecture
- milestones
- schemas
- APIs
- state machines
- environment variables
- migration strategy
- acceptance criteria
- tests
- rollback strategy

---

# 3. Non-Goals for V2 MVP

Do not implement these in the first refactor:

- Live transcript result streaming
- SSE
- WebSocket transcription
- Realtime microphone transcription
- ZIP downloads
- Download dropdown menus
- Multiple GPU workers per user
- Parallel inference of multiple files on one GPU
- ONNX inference
- TensorRT
- Model retraining
- dec8/dec4 production switch
- semantic/VAD segmentation
- transcript editor
- collaborative sharing
- permanent storage

Browser microphone recording may be considered later, but it is not part of this migration milestone.

---

# 4. Existing Architecture to Replace

Current system conceptually behaves like:

```text
Browser
  |
  v
Render Express server
  |
  +-- in-memory jobs Map
  +-- in-memory SSE clients
  +-- local /tmp uploaded media
  |
  v
Manual Google Colab worker
```

Problems:

- backend state is tied to one persistent process
- local `/tmp` is ephemeral
- large uploads pass through the application server
- user manually operates Colab
- SSE requires long-lived stateful connections
- refresh/restart durability is limited
- model startup/install flow is user-visible
- one-file-at-a-time UX

All of the above should disappear from the production architecture.

---

# 5. Target Architecture

```text
                    +----------------------+
                    |       Browser        |
                    |----------------------|
                    | Google login         |
                    | Kaggle connect       |
                    | Multi-file upload    |
                    | Queue/status UI      |
                    | Completed downloads  |
                    +----------+-----------+
                               |
                               v
                    +----------------------+
                    |       Vercel         |
                    |----------------------|
                    | Frontend             |
                    | Serverless API       |
                    | Google auth          |
                    | Kaggle OAuth         |
                    | Job orchestration    |
                    | Signed R2 URLs       |
                    +-----+-----------+----+
                          |           |
                          |           |
                          v           v
                  +-----------+   +----------------+
                  | Database  |   | Cloudflare R2  |
                  |-----------|   |----------------|
                  | users     |   | source media   |
                  | jobs      |   | transcripts    |
                  | oauth     |   | temp artifacts |
                  | worker    |   +----------------+
                  +-----------+
                          |
                          v
                   +------------------+
                   | User Kaggle GPU  |
                   |------------------|
                   | worker code      |
                   | ffprobe/ffmpeg   |
                   | faster-whisper   |
                   | CTranslate2 FP16 |
                   +------------------+
```

Key principle:

> Vercel is the control plane.  
> R2 is the object/file plane.  
> The database is durable control-plane state.  
> Kaggle is the user's ephemeral GPU worker.

---

# 6. Repository Refactor Strategy

Do not retain the current architecture where one `server.ts` owns the application lifecycle.

Recommended target layout:

```text
/
├─ src/
│  ├─ app/
│  ├─ components/
│  ├─ features/
│  │  ├─ auth/
│  │  ├─ kaggle/
│  │  ├─ upload/
│  │  ├─ jobs/
│  │  └─ settings/
│  ├─ hooks/
│  ├─ lib/
│  └─ types/
│
├─ api/                    # or framework-native serverless routes
│  ├─ auth/
│  ├─ kaggle/
│  ├─ uploads/
│  ├─ jobs/
│  └─ internal/
│
├─ server/
│  ├─ db/
│  │  ├─ interface.ts
│  │  ├─ repositories/
│  │  └─ providers/
│  ├─ r2/
│  ├─ kaggle/
│  ├─ auth/
│  ├─ jobs/
│  └─ security/
│
├─ worker/
│  ├─ worker.py
│  ├─ media.py
│  ├─ transcribe.py
│  ├─ api_client.py
│  ├─ model.py
│  └─ requirements-not-used-unless-needed.txt
│
├─ docs/
│  └─ architecture.md
│
└─ tests/
```

Exact file organization may vary with the selected frontend framework, but these boundaries must remain clear.

---

# 7. Application Authentication

## Requirement

Users sign in to the web app using Google.

Use a production-ready OAuth/auth framework rather than implementing raw OAuth session handling manually unless necessary.

The authenticated app user ID becomes the ownership boundary for:

- Kaggle connection
- jobs
- uploaded source media
- transcript output
- worker state
- settings

## Required user fields

```ts
type User = {
  id: string;
  email: string;
  displayName?: string | null;
  imageUrl?: string | null;
  createdAt: Date;
  updatedAt: Date;
};
```

Do not expose internal DB IDs unnecessarily to clients.

---

# 8. Kaggle OAuth / BYO GPU

## UX

Disconnected state:

```text
Kaggle GPU
[ Connect Kaggle GPU ]
```

Connected state:

```text
Kaggle GPU
Connected as <username>
[ Disconnect ]
```

The normal user must never have to:

- obtain a Kaggle API key manually
- download `kaggle.json`
- paste credentials
- create a notebook
- upload code
- attach the model dataset
- select T4 manually
- start a kernel manually

## OAuth flow

Conceptual flow:

```text
Browser
  |
  | GET /api/kaggle/connect
  v
Kaggle authorization
  |
  | callback authorization code
  v
/api/kaggle/callback
  |
  +-- exchange code
  +-- store encrypted refresh/access credentials
  +-- fetch Kaggle identity
  +-- ensure worker resource exists
  v
redirect to app
```

Use PKCE if supported/required by Kaggle's OAuth flow.

## Token storage

Never store Kaggle refresh tokens in:

- localStorage
- sessionStorage
- frontend state
- R2 objects
- plaintext DB fields

Store encrypted credentials server-side.

Create a dedicated credential interface:

```ts
interface KaggleCredentialStore {
  getForUser(userId: string): Promise<KaggleCredential | null>;
  saveForUser(userId: string, credential: KaggleCredential): Promise<void>;
  deleteForUser(userId: string): Promise<void>;
}
```

## Worker resource

Implementation is free to choose among supported Kaggle mechanisms as long as UX remains one-click.

Preferred conceptual strategy:

- create/update a private worker kernel under the user's Kaggle account
- automatically associate the developer-provided model artifact/input
- upload/update stable worker code when necessary
- run it automatically when work exists

Do not create one kernel per transcription file.

Reuse the worker resource for the user when possible.

---

# 9. Developer-Owned Model Artifact

The model is:

```text
bofenghuang/whisper-large-v3-french-distil-dec16
```

Use its existing CTranslate2-compatible files.

Do **not** retrain this model during this project.

The developer is responsible for publishing/maintaining the model artifact needed by Kaggle workers.

Recommended content:

```text
whisper-large-v3-french-distil-dec16/
├─ model.bin
├─ config.json
├─ tokenizer.json
├─ vocabulary.json
├─ preprocessor_config.json
└─ any additional files required by faster-whisper
```

Prefer only the CTranslate2 deployment files rather than duplicating the full training checkpoint if unnecessary.

The normal user must never have to create or upload this dataset/model artifact.

Worker code should resolve the model path from a predictable Kaggle input location.

---

# 10. Python Package Strategy

Do not execute a broad `pip install` block at every worker startup.

Initial behavior:

1. Attempt imports from the Kaggle environment.
2. Fail clearly if a truly required package is absent.
3. Add only missing packages after confirming they are not provided.

Expected imports include:

```python
import faster_whisper
import torch
import av
```

or equivalent dependencies.

If `faster-whisper` is not present in Kaggle's image:

- add the smallest required installation step
- pin a tested version
- do not reinstall PyTorch or unrelated packages

Avoid package upgrades unless required.

---

# 11. Inference Engine

## Production baseline for V2

Use:

```text
Model:
bofenghuang/whisper-large-v3-french-distil-dec16

Engine:
faster-whisper / CTranslate2

Device:
CUDA

Compute:
float16
```

Example conceptual code:

```python
from faster_whisper import WhisperModel

model = WhisperModel(
    MODEL_PATH,
    device="cuda",
    compute_type="float16",
)
```

Do not switch model architecture during the infrastructure migration.

## Important distinction

`dec16` refers to decoder depth, not numeric precision.

Future benchmark dimensions are independent:

```text
Architecture:
dec16 / dec8 / dec4

Precision:
FP16 / INT8-FP16 / INT8
```

For V2 MVP use:

```text
dec16 + FP16
```

---

# 12. Media Handling

## Browser

The browser should not need to decode the uploaded media.

Do not depend on HTML `<audio>` codec support to determine whether a file is valid.

Allow a broad set of audio/video inputs.

The upload layer should treat the file as opaque binary media.

## Upload flow

Do not send large media through Vercel Functions.

Required flow:

```text
POST /api/uploads/init
  |
  +-- creates Job
  +-- generates R2 presigned upload
  v
Browser PUTs file directly to R2
  |
  v
POST /api/uploads/:jobId/complete
```

## Worker media inspection

Kaggle worker should use:

- `ffprobe` for reliable media metadata/duration
- `ffmpeg` for universal decoding/normalization

Normalize conceptually to:

```text
16 kHz
mono
PCM/audio array suitable for Whisper
```

Avoid persistent intermediate WAV files if decoding directly to memory/stream is practical and stable.

---

# 13. Multi-File Upload

The browser must support selecting or dragging multiple files.

Each file creates its own independent job.

Example:

```text
Upload queue

lecture_01.m4a    Uploading 68%
lecture_02.mp4    Queued
lecture_03.wav    Queued
lecture_04.flac   Queued
```

Upload failures must affect only the corresponding file.

Do not cancel all files because one upload fails.

---

# 14. Job State Machine

Use explicit states.

```text
CREATED
  |
  v
UPLOADING
  |
  v
QUEUED
  |
  v
WORKER_STARTING
  |
  v
PREPROCESSING
  |
  v
TRANSCRIBING
  |
  v
FINALIZING
  |
  v
COMPLETED
```

Failure states:

```text
FAILED_UPLOAD
FAILED_WORKER_START
FAILED_MEDIA
FAILED_INFERENCE
FAILED_OUTPUT
CANCELLED
EXPIRED
```

Retries must be explicit.

Do not overload a single generic `"failed"` state if the failure source is known.

---

# 15. Database Abstraction

## Interfaces

Create data-access interfaces independent of the provider.

Example:

```ts
interface UserRepository {
  getById(id: string): Promise<User | null>;
  getByEmail(email: string): Promise<User | null>;
  create(input: CreateUserInput): Promise<User>;
}

interface JobRepository {
  create(job: NewJob): Promise<Job>;
  getByIdForUser(jobId: string, userId: string): Promise<Job | null>;
  listForUser(userId: string, options?: ListJobOptions): Promise<Job[]>;
  update(jobId: string, patch: JobPatch): Promise<Job>;
  claimNextQueuedJob(userId: string, workerRunId: string): Promise<Job | null>;
}

interface WorkerRepository {
  getForUser(userId: string): Promise<WorkerState | null>;
  upsertForUser(userId: string, state: WorkerState): Promise<void>;
}
```

Provider-specific code lives under:

```text
server/db/providers/<provider>/
```

The rest of the app imports repositories/interfaces, not provider SDKs.

---

# 16. Suggested Data Model

## users

```text
id
email
display_name
image_url
created_at
updated_at
```

## kaggle_connections

```text
id
user_id
kaggle_username
encrypted_access_token
encrypted_refresh_token
access_token_expires_at
kernel_slug
connected_at
updated_at
```

## jobs

```text
id
user_id
original_filename
source_object_key
output_object_key
status
progress
duration_sec
processed_audio_sec
error_code
error_message
created_at
upload_completed_at
started_at
completed_at
expires_at
worker_run_id
```

## worker_runs

```text
id
user_id
kaggle_run_identifier
status
started_at
last_heartbeat_at
completed_at
error_message
```

## user_settings

```text
user_id
auto_download_enabled
updated_at
```

Do not store media blobs in the database.

---

# 17. R2 Object Layout

Recommended:

```text
users/{userId}/jobs/{jobId}/source/{originalFilename}
users/{userId}/jobs/{jobId}/output/transcript.txt
users/{userId}/jobs/{jobId}/output/metadata.json
```

Optional transient logs:

```text
users/{userId}/jobs/{jobId}/logs/worker.json
```

Do not make bucket objects public.

Use signed URLs.

Object keys must be generated by the server, not trusted from raw client input.

Sanitize filenames for presentation separately from storage keys.

---

# 18. File Retention

On successful completion:

1. Save final transcript to R2.
2. Mark DB job `COMPLETED`.
3. Set `expires_at = completed_at + 24h`.
4. Delete the original source media.
5. Keep transcript available until expiration.

On expiration:

1. Delete transcript output if it exists.
2. Mark job `EXPIRED`.
3. Download endpoint returns an expired response.
4. Cleanup may safely retry.

Failure cases:

- Do not delete source media immediately if a retry may still be useful.
- Define a separate failure TTL for orphaned sources, e.g. 24h, to avoid leaked storage.

---

# 19. Queue Semantics

Queues are per authenticated user.

Example:

```text
User A:
A1 -> A2 -> A3

User B:
B1 -> B2
```

A user's Kaggle worker may claim only that user's jobs.

Never allow User A's Kaggle GPU to process User B's jobs.

## Claiming

Claiming must be atomic at the database level.

A worker asks:

```text
POST /api/internal/worker/next-job
```

The API atomically changes one job:

```text
QUEUED -> PREPROCESSING
```

and binds it to a worker run.

Do not implement claiming by:

```text
SELECT queued
then
UPDATE
```

without transactional/atomic protection.

---

# 20. Kaggle Worker Lifecycle

When a user has queued work and no active worker:

```text
queue receives first job
  |
  v
Vercel starts Kaggle worker run
  |
  v
worker loads model once
  |
  v
while queued jobs exist:
    claim next job
    process
    finalize
  |
  v
brief idle grace period
  |
  v
exit
```

A small idle grace period may allow newly uploaded files to join the existing run.

Suggested starting value:

```text
30–60 seconds
```

Do not keep the GPU alive indefinitely.

## Model loading

Load exactly once per worker run.

Bad:

```text
for job:
    load model
    transcribe
```

Good:

```text
load model

for job:
    transcribe
```

---

# 21. Worker Authentication

The Kaggle worker needs permission to call internal application APIs.

Do not embed permanent application secrets in a public notebook or frontend.

Preferred design:

1. Vercel creates a short-lived worker token for a specific:
   - user
   - worker run
2. Worker receives that temporary credential via a secure run/config mechanism.
3. Internal endpoints validate token scope and expiration.
4. Token cannot access other users' jobs.

Example claims:

```json
{
  "sub": "worker-run-id",
  "userId": "user-id",
  "scope": ["worker:claim", "worker:update", "worker:complete"],
  "exp": 1234567890
}
```

---

# 22. Worker Processing Pipeline — MVP

For each claimed job:

```text
1. mark PREPROCESSING
2. fetch signed source URL
3. download source
4. ffprobe metadata
5. decode with ffmpeg
6. update duration
7. mark TRANSCRIBING
8. run faster-whisper dec16 FP16
9. periodically update progress
10. assemble transcript
11. mark FINALIZING
12. upload transcript to R2
13. notify API completion
14. API marks COMPLETED
15. API deletes source object
```

Worker must continue to the next queued file unless an unrecoverable worker-wide failure occurs.

One bad media file must not kill the entire queue.

---

# 23. Segmentation in MVP

Keep segmentation behavior simple and reliable during the migration.

Do not introduce VAD in the first implementation.

If the existing 120-second segmentation logic is required for stable batching, it may be retained temporarily.

However, isolate segmentation behind a function/interface so it can later be replaced:

```python
def create_chunks(audio, config) -> list[AudioChunk]:
    ...
```

Do not scatter hard-coded `120` values throughout the worker.

---

# 24. Future VAD Milestone

After the architecture is stable:

Add VAD to:

- remove silence
- reduce inference workload
- prefer cuts near natural pauses
- improve progress calculation
- avoid arbitrary fixed boundaries

Likely candidate:

```text
Silero VAD
```

Desired future flow:

```text
decoded audio
  |
  v
VAD speech regions
  |
  v
merge speech regions into target windows
  |
  v
Whisper batches
```

Do not split into tiny sentence-sized chunks.

A future starting benchmark may compare:

```text
120s fixed
60s fixed
VAD-aware <= 60s
VAD-aware <= 90s
```

No value should be declared optimal without measurement.

---

# 25. Progress Model

Do not show live transcript text.

UI only needs meaningful job progress.

During migration without VAD:

```text
processed audio duration / total duration
```

is preferred over:

```text
segments done / segment count
```

because future chunk lengths may vary.

Suggested phase allocation if exact progress is temporarily unavailable:

```text
UPLOADING       browser-native upload progress
QUEUED          no percentage or 0%
WORKER_STARTING 0–3%
PREPROCESSING   3–8%
TRANSCRIBING    8–95%
FINALIZING      95–99%
COMPLETED       100%
```

Do not falsely report precise progress if the backend does not know it.

---

# 26. UI Specification

## Main layout

Remove the current live transcript results panel.

Use the freed area for job lists.

Suggested structure:

```text
+--------------------------------------------------+
| French Transcript                               |
| Google user             Kaggle GPU: Connected   |
+--------------------------------------------------+

+--------------------------------------------------+
| Upload                                           |
| [ Drop files here / Browse ]                     |
+--------------------------------------------------+

+--------------------------------------------------+
| Current jobs                                     |
|                                                  |
| lecture_03.mp4   Processing   63%                |
| lecture_04.m4a   Queued                           |
| lecture_05.wav   Uploading    22%                |
+--------------------------------------------------+

+--------------------------------------------------+
| Completed / recent                               |
|                                                  |
| lecture_01.txt   Completed      [Download]       |
| lecture_02.txt   Completed      [Download]       |
+--------------------------------------------------+

[ ] Auto-download completed transcripts
```

## No transcript preview

Do not render segment text or complete transcript in the app.

## Completed list

Each row should show at minimum:

- original filename
- completion status/time
- download button
- expiry/expired state if relevant

---

# 27. Auto-Download

Default:

```text
OFF
```

Stored per authenticated user.

When enabled and a job transitions to `COMPLETED` while the app is open:

- attempt browser download
- do not alter job state based on browser success/failure
- do not delete output after attempted download

Completed-file list remains authoritative.

---

# 28. Browser Persistence / Refresh Behavior

A refresh must restore state from the server.

Do not rely on React state/localStorage as the source of truth for jobs.

On page load:

```text
GET /api/jobs?scope=active-and-recent
```

Return the authenticated user's active and recent jobs.

Polling resumes for non-terminal jobs.

Because the user may close the app completely:

- jobs continue on Kaggle
- Vercel + DB maintain state
- user sees results on next visit

This requirement replaces the earlier assumption that the page must remain open.

---

# 29. Polling

SSE is removed.

Use adaptive polling for active jobs.

Starting recommendation:

```text
UPLOADING        handled client-side
QUEUED           every 10s
WORKER_STARTING  every 5s
PREPROCESSING    every 3–5s
TRANSCRIBING     every 3–5s
FINALIZING       every 3s
terminal state   stop
```

When no active jobs exist, stop background polling.

Prefer one batched status endpoint over one request per job.

Example:

```text
GET /api/jobs/active
```

---

# 30. API Contract — Public

Exact framework syntax may differ, but semantics should follow this contract.

## Authentication

Handled through selected auth framework.

## Kaggle

```text
GET  /api/kaggle/status
GET  /api/kaggle/connect
GET  /api/kaggle/callback
POST /api/kaggle/disconnect
```

### GET /api/kaggle/status

```json
{
  "connected": true,
  "username": "example"
}
```

## Upload initialization

```text
POST /api/uploads/init
```

Request:

```json
{
  "filename": "lecture.mp4",
  "size": 123456789,
  "contentType": "video/mp4"
}
```

Response:

```json
{
  "jobId": "job_...",
  "uploadUrl": "https://signed-r2-url",
  "objectKey": "opaque-server-generated-key"
}
```

`objectKey` may be omitted from the client response if unnecessary.

## Upload completion

```text
POST /api/uploads/:jobId/complete
```

Server verifies ownership/object existence before changing the job to `QUEUED`.

## Job list

```text
GET /api/jobs
```

Response:

```json
{
  "jobs": [
    {
      "id": "...",
      "filename": "lecture.mp4",
      "status": "TRANSCRIBING",
      "progress": 0.63,
      "createdAt": "...",
      "completedAt": null,
      "expiresAt": null
    }
  ]
}
```

## Single job

```text
GET /api/jobs/:jobId
```

Must enforce user ownership.

## Retry

```text
POST /api/jobs/:jobId/retry
```

Only allowed for retryable states.

## Cancel

Optional MVP endpoint:

```text
POST /api/jobs/:jobId/cancel
```

Cancellation semantics may initially be best-effort.

## Download

```text
GET /api/jobs/:jobId/download
```

Server checks:

- authenticated user
- ownership
- job completed
- not expired

Then returns a short-lived signed R2 download URL or redirects safely.

---

# 31. API Contract — Internal Worker

These endpoints must require a short-lived worker credential.

## Heartbeat

```text
POST /api/internal/worker/heartbeat
```

## Claim next job

```text
POST /api/internal/worker/next-job
```

Response when work exists:

```json
{
  "job": {
    "id": "...",
    "filename": "...",
    "sourceDownloadUrl": "...",
    "uploadOutputUrl": "...",
    "statusUpdateToken": "..."
  }
}
```

Response when queue is empty:

```json
{
  "job": null
}
```

## Metadata/progress update

```text
POST /api/internal/jobs/:jobId/progress
```

Example:

```json
{
  "state": "TRANSCRIBING",
  "progress": 0.42,
  "durationSec": 3841.2,
  "processedAudioSec": 1613.3
}
```

## Failure

```text
POST /api/internal/jobs/:jobId/fail
```

```json
{
  "code": "FAILED_MEDIA",
  "message": "..."
}
```

## Completion

```text
POST /api/internal/jobs/:jobId/complete
```

Server must verify output exists before marking job completed.

---

# 32. Triggering Kaggle Worker Runs

When a job becomes `QUEUED`:

1. Check user's Kaggle connection.
2. Check whether a worker run is already active/starting.
3. If active:
   - do nothing
   - worker will claim the job
4. If not active:
   - start a worker run
   - store run state

Protect this with locking/atomic DB behavior so two simultaneous uploads do not start duplicate workers.

Pseudo logic:

```ts
await db.transaction(async () => {
  const active = await workerRepo.getActiveForUser(userId);

  if (!active) {
    const run = await workerRepo.createStarting(userId);
    triggerKaggle(run);
  }
});
```

Exact implementation depends on provider capabilities.

---

# 33. Worker Run Recovery

Possible failure:

```text
worker status says running
but Kaggle kernel died
```

Use heartbeat timestamps.

If:

```text
now - lastHeartbeatAt > threshold
```

mark worker stale and allow a new run.

Jobs assigned to a dead worker should become retryable/requeued according to safe rules.

Never create duplicate simultaneous processing of one job.

Recommended use:

```text
worker_run_id
job lease/claim timestamp
```

Future robustness can use explicit leases.

---

# 34. Security Requirements

Must implement:

- authenticated app routes
- per-user job ownership checks
- encrypted Kaggle tokens
- private R2 bucket
- short-lived signed upload URLs
- short-lived signed download URLs
- server-generated object paths
- file size limit
- rate limiting where practical
- safe filename handling
- worker token scope
- worker token expiration
- no permanent app secret embedded in Kaggle code
- secrets only in server environment

Do not trust:

- `userId` sent by browser
- object keys sent by browser
- filename MIME type alone
- progress values from arbitrary unauthenticated callers

---

# 35. Environment Variables

Exact names may be adjusted, but maintain a clear env contract.

## App auth

```text
AUTH_SECRET=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
APP_BASE_URL=
```

## Database

Provider-neutral application code; provider adapter may need:

```text
DATABASE_URL=
```

or provider-specific variables.

## R2

```text
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET_NAME=
R2_ENDPOINT=
```

## Kaggle OAuth

```text
KAGGLE_CLIENT_ID=
KAGGLE_CLIENT_SECRET=
KAGGLE_REDIRECT_URI=
```

## Credential encryption

```text
TOKEN_ENCRYPTION_KEY=
```

## Worker signing

```text
WORKER_TOKEN_SIGNING_SECRET=
```

Never expose server secrets through Vite `VITE_*` variables.

---

# 36. Error UX

Normal users should receive actionable plain-language states.

Examples:

```text
Kaggle GPU connection expired.
[Reconnect Kaggle]
```

```text
This file could not be decoded.
[Retry]
```

```text
Kaggle could not start a GPU session.
Please try again later.
[Retry]
```

```text
Transcript expired.
```

Detailed internal error/log data should not be shown by default.

---

# 37. Logging

Log structured events:

```text
user_id (internal safe identifier)
job_id
worker_run_id
event
timestamp
error_code
duration
```

Do not log:

- OAuth refresh tokens
- signed URLs
- raw credentials
- unnecessary transcript contents

Useful events:

```text
job_created
upload_completed
worker_triggered
worker_started
job_claimed
preprocess_completed
transcription_started
transcription_completed
output_uploaded
source_deleted
job_expired
worker_failed
```

---

# 38. Migration Milestones

---

## Milestone 0 — Establish Baseline

Before changes:

- run current repo locally
- document current routes
- document current upload path
- document current Colab worker contract
- capture current UI screenshots
- create a short manual regression checklist

Acceptance:

- existing app can still be run before migration
- current behavior is documented

---

## Milestone 1 — Vercel-Compatible Frontend/API Skeleton

Goals:

- remove dependency on a persistent Express `app.listen()` production server
- introduce serverless route structure
- keep frontend operational
- deploy a basic Vercel preview

Do not yet switch GPU architecture.

Acceptance:

- frontend loads on Vercel
- health/API test route works
- no server process must stay resident

---

## Milestone 2 — Google Authentication + DB Abstraction

Implement:

- Google sign-in
- user model
- provider-neutral repositories
- initial DB provider
- authenticated route helpers

Acceptance:

- user signs in/out
- refresh preserves session
- API can identify current user
- provider-specific DB code is isolated

---

## Milestone 3 — R2 Direct Upload

Implement:

- R2 client
- signed browser upload
- job creation
- upload completion
- remove large upload-through-server behavior

Acceptance:

- 100MB+ media can upload without passing through Vercel request body
- job belongs to correct user
- private R2 object is created
- refresh restores job

---

## Milestone 4 — New Queue UI

Implement:

- multi-file drag/drop/select
- per-file upload progress
- current jobs list
- completed/recent list
- remove transcript results panel
- remove SSE client code
- add adaptive polling

Acceptance:

- multiple files can upload independently
- one failure does not cancel others
- no transcript preview exists
- jobs survive refresh

---

## Milestone 5 — Kaggle OAuth / Connect GPU

Implement:

- connect button
- Kaggle authorization
- secure token storage
- disconnect
- connection status
- automatic worker resource preparation

Acceptance:

- a non-technical user only interacts with Connect Kaggle
- no API key copy/paste
- no notebook manual setup
- app can perform required Kaggle kernel actions on user's behalf

---

## Milestone 6 — Kaggle Worker MVP

Implement worker:

- imports existing environment dependencies
- minimal install only if proven missing
- developer-owned CTranslate2 model input
- ffprobe/ffmpeg media handling
- faster-whisper FP16
- job claim API
- progress updates
- transcript upload
- next-job loop
- idle exit

Acceptance:

- one Kaggle run loads model once
- processes multiple queued files sequentially
- completes transcript without page remaining open
- one failed file does not kill remaining queue

---

## Milestone 7 — Lifecycle / Cleanup

Implement:

- delete source after successful completion
- 24-hour transcript TTL
- expired job state
- orphan source cleanup
- stale worker detection
- safe retry

Acceptance:

- completed source files are removed
- transcript available for 24h
- expiration is reflected in UI
- cleanup is idempotent

---

## Milestone 8 — Download UX

Implement:

- one Download button per completed job
- auto-download user setting OFF by default
- automatic attempt when enabled
- no dropdown
- no ZIP

Acceptance:

- manual download always works during retention
- auto-download failure does not lose file
- setting persists per user

---

## Milestone 9 — VAD / Segmentation Upgrade

After infrastructure is stable:

- add VAD
- benchmark silence removal
- implement speech-aware chunking
- improve duration-based progress
- compare against fixed segmentation

Acceptance:

- no quality regression accepted without evidence
- benchmark data recorded
- feature can be disabled by config if necessary

---

## Milestone 10 — Inference Benchmarking

Benchmark:

```text
current PyTorch baseline
vs
faster-whisper CTranslate2 FP16
```

Then optionally:

```text
dec16 FP16
vs
dec16 INT8-FP16
```

Then only if justified:

```text
dec8
batch-size variations
speculative decoding
ONNX/TensorRT investigation
```

Record:

- model load time
- preprocessing time
- inference time
- total job time
- RTF
- peak VRAM
- transcript quality
- WER/CER if ground truth exists

Do not change production model purely from synthetic speed results.

---

# 39. Testing Strategy

## Unit tests

Cover:

- job state transitions
- ownership checks
- signed URL generation wrappers
- repository behavior
- queue claim behavior
- expiry logic
- worker token validation
- auto-download setting API

## Integration tests

Cover:

```text
Google-authenticated user
  ->
create job
  ->
signed R2 upload
  ->
complete upload
  ->
job queued
```

and:

```text
worker claim
  ->
progress
  ->
output complete
  ->
source deleted
  ->
download
  ->
expiry
```

## Security tests

Test:

- User A cannot read User B job
- User A cannot download User B output
- worker token for A cannot claim B jobs
- expired signed URL fails
- disconnected Kaggle account cannot trigger worker
- OAuth callback validates state/PKCE

## Worker tests

Use small fixture media:

- mp3
- m4a
- wav
- mp4 with audio
- webm
- unsupported/corrupted file

Test sequential queue behavior.

## Browser tests

Test:

- multi-file upload
- refresh during upload/job
- tab close and return
- completed list
- auto-download off/on
- expired transcript
- Kaggle disconnected state

---

# 40. Benchmark Dataset

Before changing segmentation/precision/model architecture, prepare a fixed benchmark sample.

Recommended categories:

```text
clean university lecture
lecture with background noise
fast French speech
technical/scientific vocabulary
long silence sections
video container input
```

Prefer manually corrected reference transcripts for at least a subset.

Do not evaluate quality based on one anecdotal file.

---

# 41. Rollback Strategy

Maintain the existing Render deployment until the V2 pipeline passes acceptance testing.

Use feature/config flags where useful:

```text
ENABLE_KAGGLE_WORKER
ENABLE_VAD
ENABLE_AUTO_DOWNLOAD
```

Do not delete legacy code before equivalent V2 behavior is verified.

Recommended migration:

```text
legacy branch/tag
  |
  +-- keep deployable
  |
main/v2
  |
  +-- Vercel preview
  +-- internal testing
  +-- limited user testing
  +-- production cutover
```

After production cutover and a stability period, remove legacy Render/Colab code.

---

# 42. Definition of Done

V2 refactor is considered complete when:

1. App deploys on Vercel.
2. User signs in with Google.
3. User presses Connect Kaggle GPU and completes only normal Kaggle authentication/authorization.
4. User does not manually manage any notebook/kernel.
5. User uploads multiple audio/video files.
6. Files upload directly to private R2.
7. Jobs persist across page refresh/close.
8. User's Kaggle kernel starts automatically when needed.
9. The worker loads the model once and processes that user's files sequentially.
10. Inference uses the French dec16 CTranslate2 model with faster-whisper FP16.
11. No broad repeated `pip install` step exists.
12. Media is handled with ffprobe/ffmpeg rather than browser codec assumptions.
13. No SSE/live transcript panel remains.
14. Current jobs show status/progress.
15. Completed jobs show one Download button each.
16. Auto-download is available but disabled by default.
17. Source media is deleted after successful completion.
18. Transcript remains available for 24 hours.
19. Job ownership is enforced.
20. Kaggle credentials are encrypted server-side.
21. One user's GPU never processes another user's jobs.
22. Worker failures can recover without losing all queue state.
23. Existing Render deployment can be retired safely.

---

# 43. Instructions to Codex

When implementing this specification:

1. Inspect the existing repository before editing.
2. Reuse existing UI components/styles where sensible.
3. Do not rewrite unrelated working code.
4. Commit/refactor in milestone-sized units.
5. After each milestone:
   - run tests
   - run type checking
   - run build
   - document required environment variables
6. Do not silently introduce paid-only infrastructure.
7. Do not hard-code a DB vendor into domain logic.
8. Do not expose secrets to the browser.
9. Do not route large media through Vercel Functions.
10. Do not bring SSE back.
11. Do not implement VAD before the infrastructure milestones are stable.
12. Do not change the model from dec16 without benchmark evidence.
13. Do not retrain the model.
14. Prefer simple, observable, recoverable architecture over clever stateful behavior.
15. If a Kaggle API limitation prevents the ideal UX, document the exact limitation and implement the closest supported flow without exposing notebook complexity to the user.

---

# 44. First Task for Codex

Start with **Milestone 0 only**.

Deliver:

1. A concise audit of the current repository.
2. A route-by-route map of the current backend.
3. A list of in-memory state and filesystem dependencies that block Vercel.
4. Current Colab worker/backend contract.
5. Current frontend components affected by removal of Results/SSE.
6. A concrete file-level change plan for Milestones 1–4.
7. No destructive refactor yet.

After that audit is reviewed, proceed to Milestone 1.
