# Milestone 0 — Manual Regression Checklist

Use this checklist against the legacy Express app before comparing later milestones.

## Start and smoke test

1. Run `npm ci`.
2. Run `npm run lint`; expect TypeScript to exit successfully.
3. Run `npm run build:legacy`; expect Vite assets and `dist/server.mjs`.
4. Run `npm run dev:legacy`; open `http://localhost:3000`.
5. Confirm the header, Upload panel, Results panel, disabled Download button, and Colab GPU Worker button render.
6. Open `http://localhost:3000/api/health`; expect `status: "ok"`.

## Legacy upload and UI

1. Select a browser-decodable audio/video file.
2. Confirm its name/size and computed segment count appear.
3. Confirm Start transcript from segment accepts only `1..totalSegments`.
4. Start transcription and confirm upload completes, an active job is created, and the Colab modal opens with the job ID embedded in the copied code.
5. Confirm `GET /api/jobs/{jobId}` returns the same job and `GET /api/jobs/{jobId}/audio` downloads the original media.

## Legacy Colab contract

1. In a Colab T4 runtime, copy and run the generated worker code.
2. Confirm package setup and model load complete.
3. Confirm the worker downloads the source, reports the pydub duration/segment count, and respects `resumeFrom`.
4. Confirm segment callbacks cause live Results text and counters to update.
5. Confirm the final segment changes the job to completed and enables Download.
6. Confirm the automatic download happens once while the same browser tab remains open.
7. Confirm the manual Download button produces a `.txt` file with ordered segments.

## Failure/recovery observations

1. Stop Colab partway through and confirm completed segments remain visible while the Express process and browser tab remain alive.
2. Set the next segment, click Start / Resume Transcript, and confirm newly generated worker code resumes there.
3. Refresh the browser and record that the active job is no longer restored automatically; this is a known V1 limitation.
4. Restart Express and record that jobs become unavailable and local temp files may be orphaned; this is a known V1 limitation.
5. Try a media format the browser cannot decode and confirm upload is blocked before the backend; this is a known V1 limitation.

## Security baseline observations

1. Confirm APIs do not request a login.
2. Confirm a known job ID can be read/downloaded/mutated without a credential.
3. Confirm worker callbacks do not require a token.

These security checks document V1 behavior only. They are not acceptable V2 behavior.
