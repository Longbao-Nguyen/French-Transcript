# Queue cancellation (pre-worker implementation)

The queue-cancellation change request is implemented for the existing Milestones 2–4 app without changing Google Auth, direct private Blob upload, download authorization, or persistent jobs.

## What works now

- `002_queue_cancellation.sql` adds durable `user_queue_state` and extends the existing job-status constraint. It does not drop any table or existing job data. The production Vercel build runs `npm run db:migrate:deploy`; to apply manually with a real `DATABASE_URL`, run `npm run db:migrate`.
- `GET /api/jobs` returns `jobs`, `queueState`, and `queuedCount` for the signed-in user. The client polls this response; refresh preserves queue state.
- `POST /api/jobs/:jobId/cancel` checks the authenticated owner. A QUEUED job atomically becomes CANCELLED, without changing queue state or other jobs, then its source object is deleted. Repeated cancellation is safe and retries deletion. A processing job becomes CANCEL_REQUESTED and its queue becomes PAUSING in one transaction. Source deletion waits for worker acknowledgement. COMPLETED jobs return 409.
- `claimNextQueuedJob` takes the per-user queue row lock first, requires RUNNING, and claims only QUEUED jobs. Cancellation takes the same queue lock before locking the job. This serializes claim vs cancellation and blocks new claims while PAUSING or PAUSED.
- `GET /api/internal/jobs/:jobId/cancel-state` and `POST /api/internal/jobs/:jobId/cancelled` require an expiring HMAC bearer credential scoped to user, job, and worker run. The latter atomically changes CANCEL_REQUESTED → CANCELLED and PAUSING → PAUSED, then deletes only that job's source object. The same valid credential can retry cleanup after a transient Blob failure.
- The UI offers Cancel on queued jobs, confirms active cancellation, shows Cancelling/Stopping/Queue paused, and keeps queued files visible. No SSE was added.

## Milestone 5–6 worker contract to finish

No Kaggle worker or Kaggle connection exists yet. The PAUSED START TRANSCRIPT control calls `POST /api/queue/start`, which checks for PAUSING/RUNNING/empty queue but currently returns `KAGGLE_NOT_CONNECTED` (503) rather than falsely switching to RUNNING. The worker milestone must validate the Kaggle connection, atomically start exactly one run and switch PAUSED/IDLE → RUNNING, and only then allow the oldest QUEUED job to be claimed. Do not auto-start from a PAUSED queue.

At worker start, assign `worker_run_id` to each claimed job and issue a short-lived `signWorkerJobScope(...)` credential from trusted server code using `WORKER_CALLBACK_SECRET`; never expose the secret or credential to the browser. The worker should poll `cancel-state` before and after source download, before/after preprocessing, before/after every inference batch, before assembly, and before transcript upload. On `shouldCancel`, stop inference, delete local temporary files, call `cancelled`, and exit the worker loop without claiming another job. Never upload/commit a completed transcript after cancellation was requested. Worker completion must call `completeForWorker` after final output upload: it conditionally transitions from FINALIZING only while queue is RUNNING and the worker-run ID still matches; whichever transaction wins (completion or cancellation) determines the final status. If completion loses, delete the newly uploaded output object. The future worker-run record should be marked stopped and queue resumption must verify the old worker exited before launching another.

`WORKER_CALLBACK_SECRET` is only needed when Milestone 6 starts issuing worker credentials. Do not set it as a browser or `VITE_` environment variable. The internal endpoints return 503 until it is configured.

Automated tests currently cover state transitions, migration shape, scoped-token rejection, and existing Milestone 2–4 paths. A real Kaggle integration test (worker acknowledgement, run shutdown, pause/resume, and cancel-versus-completion under load) is deferred until the worker exists; the current app cannot truthfully pass that end-to-end flow.
