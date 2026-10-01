# Milestone 1 — Vercel-Compatible Frontend/API Skeleton

Implemented on 2026-10-02.

## Outcome

- `npm run build` now emits a static Vite frontend only. It does not bundle or require a persistent Express production server.
- `api/health.ts` is a stateless Vercel Node.js function using the Web `Response` contract.
- `vercel.json` declares the Vite build/output and SPA deep-link fallback.
- The original Express/Colab application remains available through explicit `*:legacy` scripts for rollback and behavior comparison.
- No GPU, upload, job-state, auth, database, Results-panel, or SSE behavior was migrated in this milestone.

## Commands

```text
npm run dev             Vite frontend development server
npm run build           Vercel production frontend build
npm run preview         Preview the built static frontend
npm run test            Serverless route unit tests

npm run dev:legacy      Original Express + Vite application
npm run build:legacy    Original frontend + Express bundle
npm run start:legacy    Run the original production bundle
```

For end-to-end local emulation of `/api/health`, use Vercel's development CLI (`vercel dev`) after linking a Vercel project. The unit test exercises the exact exported route handler without requiring an account.

## Environment contract

Milestone 1's frontend and health function require no environment variables.

`GEMINI_API_KEY` remains optional and legacy-only. `APP_URL` remains documented for the old deployment but is not read by current code. Authentication, database, R2, Kaggle, encryption, and worker-signing variables are intentionally deferred to their corresponding milestones.

## Deployment boundary

The Vercel deployment is a skeleton: the SPA and health API are deployable, but the V1 upload/transcription flow is still supported only by `server.ts`. Moving its in-memory Maps, local files, or SSE responses into Vercel functions would create a broken pseudo-migration, so those routes are deliberately not exposed as serverless functions.

Milestones 2–4 replace those assumptions with authenticated durable repositories, direct R2 uploads, persisted jobs, and polling. Until then, use `npm run dev:legacy` for the original transcription workflow.

## Verification

Run:

```text
npm run lint
npm run test
npm run build
npm run build:legacy
```

Acceptance is complete locally when all four commands pass and `GET()` from `api/health.ts` returns HTTP 200 with `Cache-Control: no-store`.

Verification result on 2026-10-02:

- `npm run lint`: passed.
- `npm run test`: passed (1/1 test).
- `npm run build`: passed; the final `dist/` contains only static frontend output and no `server.mjs`.
- Static production preview: returned HTTP 200 and rendered the Vite root without Express.
- `npm run build:legacy`: passed, confirming the rollback build remains available.
- Remote Vercel preview: not created because this workspace has no Vercel CLI, `VERCEL_TOKEN`, or `.vercel/project.json`. An authenticated project link is required before a preview URL can be produced.
