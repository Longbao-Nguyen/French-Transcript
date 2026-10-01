# Milestone 0 — Current Repository Audit

Audit date: 2026-10-02 (Asia/Saigon)

Scope: document the current V1 implementation before any architectural refactor. This report describes what is implemented in this repository, not the aspirational architecture in `README_GitHub_Production.md`.

## Baseline result

- Dependency install: `npm ci` completed successfully.
- Type check: `npm run lint` passed.
- Production build: `npm run build` passed and produced the Vite client plus `dist/server.mjs`.
- Local runtime: `npm run dev` served the UI and API on port 3000.
- HTTP smoke checks: `/` returned 200, `/api/health` returned 200, and an unknown job returned 404.
- No Git repository metadata is present in this workspace, so a baseline tag/commit could not be created or inspected here.
- Baseline screenshot: [screenshots/milestone-0-baseline.png](screenshots/milestone-0-baseline.png).
- Manual regression procedure: [manual-regression-checklist.md](manual-regression-checklist.md).

The current app remains runnable with the original commands before Milestone 1 changes.

## Current architecture

```text
Browser: React 19 + Vite SPA
  ├─ decodes selected media metadata in an HTMLAudioElement
  ├─ uploads one complete media body to Express
  ├─ opens one EventSource for the active job
  ├─ renders live transcript segments
  └─ assembles/downloads a transcript Blob in browser RAM
             │
             ▼
Persistent Node process: Express in server.ts
  ├─ owns all job, upload-path, and SSE-client state in Maps
  ├─ writes source media under the host OS temp directory
  ├─ serves the Vite dev middleware or built static files
  ├─ accepts unauthenticated worker progress/segment callbacks
  └─ optionally calls Gemini to refine arbitrary French text
             │
             ▼
Manual Google Colab worker copied from ColabWorkerModal.tsx
  ├─ installs Python packages on each run
  ├─ downloads one job's source file from Express
  ├─ loads one Hugging Face PyTorch model for that job/run
  ├─ decodes and slices media with pydub in 120-second chunks
  └─ POSTs duration metadata and transcript segments to Express
```

There is no application authentication, database, durable queue, object store integration, cleanup scheduler, worker credential, user ownership boundary, or deployable serverless API. `README_GitHub_Production.md` describes R2 and a polling worker, but neither is implemented in code.

`server.ts` owns both the web-server lifecycle and every backend concern. In development it mounts Vite as middleware; in production it serves `dist` and calls `app.listen(3000)`. The production artifact therefore requires one long-lived Node process.

## Backend route map

All current routes are unauthenticated. There are no ownership checks and no rate limits.

| Method | Route | Caller | Request contract | Response / side effects |
|---|---|---|---|---|
| GET | `/api/health` | Browser/operator | None | `{status, activeJobs, timestamp, hasGeminiKey}`. `activeJobs` is actually `jobs.size`, including completed/failed entries because jobs are never removed. |
| POST | `/api/upload` | Browser | Raw body up to 1 GB. Headers: `X-File-Name`, required numeric `X-Duration-Sec`, optional 1-based `X-Start-Segment`. | Writes the full body to local temp storage, creates a RAM job with 120-second segmentation, and returns 201 `{job_id, job, message}`. |
| GET | `/api/jobs/:id/audio` | Colab | Job ID in path. | Reads the RAM path mapping and downloads the local source file. Adds encoded original name in `X-File-Name`. |
| GET | `/api/jobs/:id` | Browser/Colab | Job ID in path. | Returns the entire RAM job, including all transcript text and `resumeFrom`. |
| POST | `/api/jobs/:id/resume` | Browser | JSON `{startSegment}` using a 1-based segment number. | Mutates `resumeFrom`, `doneSegments`, status, and timestamp; emits SSE `resume`; returns `{status, job}`. |
| POST | `/api/jobs/:id/progress` | Colab | JSON `{durationSec, totalSegments}`. | Treats worker/pydub values as authoritative, adjusts the resume bound, emits SSE `progress`, and returns `{status, totalSegments}`. |
| POST | `/api/segment` | Colab | JSON `{job_id, index, text, startSec?, endSec?, totalSegments?, durationSec?}`. | Upserts one transcript segment, updates progress/status, emits SSE `segment`, possibly emits `complete`, and returns snake-case acknowledgement fields. |
| POST | `/segment` | Colab alias | Same as `/api/segment`. | Exact alias of the segment callback. |
| GET | `/api/events/:job_id` | Browser | Long-lived EventSource connection. | Registers the Express response in RAM; emits `init`, then update events; sends a comment keepalive every 15 seconds. |
| GET | `/events/:job_id` | Browser alias | Same as `/api/events/:job_id`. | Exact SSE alias. |
| GET | `/api/download/:job_id` | Browser/manual | Job ID in path. | Builds a text file synchronously from transcript segments held in RAM and sends it as an attachment. The current React UI does not use this route. |
| GET | `/download/:job_id` | Browser/manual alias | Same as `/api/download/:job_id`. | Exact download alias. |
| POST | `/api/ai/refine-french` | Browser/API client | JSON `{text}`. | If `GEMINI_API_KEY` exists, sends text to `gemini-2.5-flash`; otherwise echoes the original text. This route is not called by the current UI. |
| USE | Vite middleware | Browser, development only | Any unmatched route. | Vite transforms/serves the SPA during development. |
| USE/GET | Static `dist` + `*` fallback | Browser, production only | Any unmatched route. | Serves built assets and returns `dist/index.html` for SPA fallback. |

Global JSON and URL-encoded parsers accept up to 50 MB. `/api/upload` adds a route-local raw parser with a 1 GB limit.

## State held only in RAM

### Backend process

- `jobs: Map<string, Job>`: every job, status, progress counter, resume offset, and every transcript segment.
- `uploadedAudioFiles: Map<string, string>`: job ID to local source-file path.
- `sseClients: Map<string, express.Response[]>`: all open responses grouped by job ID.
- `aiClient: GoogleGenAI | null`: lazily initialized Gemini SDK singleton.
- One 15-second `setInterval` per SSE connection. It is cleared on request close; empty arrays and job entries are not pruned.

A process restart loses the three Maps immediately. A horizontal second instance would have an independent copy, so the upload, Colab callback, SSE connection, and download must all happen to hit compatible process state.

### Browser tab

`App.tsx` stores the selected `File`, active job ID, duration, total/done segment counts, resume position, processing flag, modal visibility, status text, and every transcript segment in React state/refs. It also stores the active `EventSource` and the set of auto-downloaded job IDs in refs.

There is no localStorage/sessionStorage persistence. Refreshing or closing the tab loses the active job ID and transcript UI, even if the Express process still has the job.

### Colab runtime

The generated worker holds the downloaded source file, decoded `AudioSegment`, pending batch arrays, loaded processor/model/pipeline, and batch metadata in one Colab runtime. A runtime loss ends the worker; recovery requires the user to copy/run code again and choose a resume segment.

## Filesystem and local-temp dependencies

- Express source uploads are written to `path.join(os.tmpdir(), 'french-transcript-web-app', jobId + extension)`.
- The path is only discoverable through the in-process `uploadedAudioFiles` Map. A server restart can leave an orphan file that the app cannot find.
- There is no source-file TTL, transcript artifact, cleanup task, startup reconciliation, or quota enforcement.
- Production serving depends on a local `dist/` directory created by Vite/esbuild.
- The generated Colab worker writes `uploaded_audio.<original extension>` in the Colab filesystem. It decodes the whole source with pydub; it does not use R2, ffprobe, or explicit ffmpeg normalization.
- The older `demo.ipynb` separately downloads `audio.m4a`, writes `audio.wav`, writes/deletes `temp_segment_N.wav`, and writes `transcript.txt` in the notebook runtime. It is not called by the web app.
- Browser download uses an ephemeral object URL backed by a Blob assembled from transcript text in browser RAM.

These assumptions conflict with Vercel's request-size/duration limits, read-only deployment filesystem plus ephemeral `/tmp`, stateless invocations, and lack of affinity between invocations.

## Current frontend ↔ backend ↔ Colab contract

### Browser upload and job creation

1. `UploadPanel` accepts one file and passes only the first dropped/selected file to `App`.
2. `App` creates an `<audio>` element and object URL to obtain duration. Unsupported browser codecs cannot proceed even when ffmpeg could decode the file.
3. The browser calculates `ceil(duration / 120)` and allows a 1-based resume segment.
4. `App` POSTs the complete file to `/api/upload` as `application/octet-stream`, with filename, browser duration, and start segment in custom headers.
5. Express sanitizes the filename with `path.basename`, generates a short random job ID, writes the file locally, and returns the full initial job.
6. The browser opens `/api/events/{jobId}` and opens the Colab modal.

### Colab worker

The source code is generated inside `ColabWorkerModal.tsx`, with `SERVER_URL` and the active `JOB_ID` interpolated into the copied code.

1. Every run executes `pip install transformers datasets pydub requests accelerate`.
2. It loads `bofenghuang/whisper-large-v3-french-distil-dec16` through Transformers/PyTorch, using CUDA FP16 when available and batch size 4.
3. It downloads one source from `GET /api/jobs/{JOB_ID}/audio` and trusts `X-File-Name` for the extension.
4. pydub decodes the full source and computes authoritative duration/segment count.
5. It POSTs `{durationSec, totalSegments}` to `/api/jobs/{JOB_ID}/progress`.
6. It GETs `/api/jobs/{JOB_ID}` and starts from zero-based `resumeFrom`.
7. It batches up to four 120-second in-memory arrays through the ASR pipeline.
8. For each result it POSTs transcript text and timing to `/api/segment`.
9. Completion is inferred by Express when the highest posted segment index reaches `totalSegments`; there is no explicit worker-complete or worker-fail call.

There is no worker authentication, scoped token, callback signature, user binding, atomic claim, heartbeat, output upload, source deletion, retry lease, or queue loop. Anyone who knows/guesses a job ID can read or mutate the job.

### Browser updates and download

- SSE `init` replaces the current segment list and counters.
- SSE `progress` updates worker-authoritative total segments.
- SSE `segment` upserts live text and advances progress.
- SSE `complete` triggers an unconditional one-time browser download for that tab and closes the stream.
- The Download button also builds the file client-side with `exportToColabTxt`; it does not call the backend download route.

The current auto-download behavior is always enabled, is not a persisted user setting, and cannot recover after the tab is closed.

## Frontend components affected by removing Results/SSE

| File | Current coupling | Required direction by Milestone 4 |
|---|---|---|
| `src/App.tsx` | Owns single-file state, segment text, `EventSource`, event handlers, client transcript assembly, auto-download, and the two-column layout. | Replace segment/SSE state with server job records, independent per-file upload state, batched adaptive polling, current/recent job lists, and explicit downloads. |
| `src/components/ResultsPanel.tsx` | Entire component is a live transcript preview, copy UI, segment progress, and one aggregate download. | Remove from the rendered app and replace with current-jobs and completed/recent job-list components. No transcript text remains in the DOM. |
| `src/components/UploadPanel.tsx` | Selects exactly one file, depends on browser media duration, exposes segment resume, and starts one upload. | Accept multiple opaque files, remove browser duration and segment-resume coupling, and show independent upload progress/failure. |
| `src/components/Header.tsx` | Displays the single job's transient status and opens the manual Colab guide. | Move job detail into lists; later expose auth/Kaggle state. During Milestones 1–4 the legacy Colab entry may remain explicitly marked as legacy. |
| `src/components/ColabWorkerModal.tsx` | Hard-codes one job ID and tells the user results arrive via SSE. | Keep unchanged through the serverless skeleton where possible; before the queue UI lands, revise/remove SSE-specific copy. It is replaced by Kaggle connection/worker flows in later milestones. |
| `src/types.ts` | Models segment text and the five-state V1 job. | Introduce the explicit V2 job-state union and client-safe job summaries; isolate any temporary legacy types. |
| `src/utils/format.ts` | Formats segment previews and constructs transcript files in the browser. | Remove from the V2 UI path; downloads become server-authorized artifact URLs. Retain only while legacy rollback needs it. |

## Concrete file-level plan for Milestones 1–4

### Milestone 1 — Vercel-compatible frontend/API skeleton

- Add `api/health.ts` as a stateless Vercel function with an explicit JSON/no-store response.
- Add `vercel.json` for Vite build/output and SPA fallback behavior.
- Change `package.json` so the production build emits only the Vite frontend and does not bundle/start `server.ts`; preserve explicit `dev:legacy`, `build:legacy`, and `start:legacy` commands for rollback.
- Keep `server.ts` and current React behavior intact as legacy code; do not pretend its Maps/uploads/SSE are serverless-safe.
- Update `.env.example` and deployment documentation to distinguish current Milestone 1 variables from planned Milestone 2+ variables.
- Add a small API test for the health handler if the existing test-free toolchain can support it without broad framework churn; otherwise verify the handler directly plus production build/typecheck.

### Milestone 2 — Google authentication and database abstraction

- Add framework-compatible auth routes under `api/auth/` and server-only auth helpers under `server/auth/`.
- Add provider-neutral domain types/interfaces under `server/db/interface.ts` and repository boundaries under `server/db/repositories/`.
- Add exactly one initial provider adapter under `server/db/providers/<provider>/`; no provider SDK imports outside that directory.
- Add users, jobs, worker runs, Kaggle connections, and user settings schema/migrations for the chosen adapter.
- Add `server/http/require-user.ts` so protected functions derive user ID from the session, never request input.
- Add auth/session UI under `src/features/auth/` and wire it into `Header.tsx`/`App.tsx`.
- Add repository contract and ownership tests under `tests/server/`.

### Milestone 3 — R2 direct upload

- Add private R2 wrappers under `server/r2/` for object-key generation, presigning, object existence, and deletion.
- Add `api/uploads/init.ts` and `api/uploads/[jobId]/complete.ts`; both require auth and use repositories rather than provider SDKs.
- Add `api/jobs/index.ts` and `api/jobs/[jobId].ts` so refresh can restore authenticated jobs.
- Add upload orchestration under `src/features/upload/`, using direct browser-to-R2 PUT and per-file progress (XHR or equivalent upload-progress transport).
- Update `src/types.ts` with client-safe job/upload contracts shared by the API boundary.
- Keep object keys server-generated and verify R2 object existence before `UPLOADING -> QUEUED`.
- Add upload initialization/completion, ownership, size-limit, key-sanitization, and failed-upload tests.

### Milestone 4 — New queue UI and polling

- Replace `ResultsPanel.tsx` in `App.tsx` with components such as `src/features/jobs/CurrentJobs.tsx` and `RecentJobs.tsx`.
- Refactor `UploadPanel.tsx` for multi-select/drop and render one independent upload row per file.
- Add `src/features/jobs/useJobsPolling.ts` with one batched adaptive polling request and no polling when all jobs are terminal.
- Add `api/jobs/active.ts`, or support an equivalent filtered `GET /api/jobs`, returning only client-safe fields and no transcript text.
- Remove `EventSource`, segment event handlers, segment refs/state, transcript preview/copy logic, and client-side transcript assembly from the V2 path.
- Remove `ResultsPanel.tsx` and unused formatting/type code only after the replacement is verified; preserve legacy code separately if rollback still requires it.
- Add browser/component tests for multiple independent uploads, polling stop/resume, refresh restoration, terminal/expired rows, and one-file failure isolation.

## Key migration risks to preserve explicitly

- Milestone 1 cannot make the V1 data path serverless by moving the same Maps and temp files into functions. The old pipeline must remain a labeled legacy rollback path until Milestones 2–4 replace its state and upload assumptions.
- The current UI and worker disagree with the V2 product on auto-download, live transcript visibility, browser media probing, worker authentication, and durable ownership.
- The workspace has no Git metadata. Before a production cutover, the repository should be restored/cloned with history so the spec's legacy tag/branch rollback can be implemented.
- A live Vercel preview requires an authenticated Vercel project/account; local code can establish deployability, but it cannot prove a remote preview URL without those credentials.
