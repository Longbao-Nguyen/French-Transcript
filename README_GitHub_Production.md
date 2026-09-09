# French Transcript Web App

> **Production-oriented Design Specification (v1.0)**

------------------------------------------------------------------------

# Project Overview

This project converts an existing **Google Colab notebook** for French
speech transcription into a **fully browser-based web application** that
requires:

-   No installation.
-   No local GPU.
-   No local Python environment.
-   Real-time transcript updates.
-   Resume capability after interruptions.
-   Temporary storage only.

The target users are **students studying in France** who need quick and
accessible transcription.

------------------------------------------------------------------------

# Problem Statement

The existing notebook already performs transcription correctly but has
several usability limitations.

## Current Workflow

1.  Open Colab.
2.  Upload file to Drive.
3.  Copy file's link
4.  Run notebook.
6.  Download transcript.

## Current Problems

- Colab runtime disconnections cause complete progress loss, forcing jobs to restart from scratch.
- Requiring manual uploads to Google Drive creates an unnecessary intermediate bottleneck and wastes time.
- Manually parsing and pasting Google Drive file IDs is error-prone, cumbersome, and provides a poor user experience (UX).

------------------------------------------------------------------------

# Existing Notebook

The current notebook already provides the core ML pipeline.

### Already implemented

-   Upload audio/video.
-   Split into **120-second segments**.
-   Run AI model.
-   Merge transcript.

### Missing

-   Persistent job management.
-   Resume.
-   Queue.
-   Browser-independent execution.
-   Friendly UI.

### Pipeline's Problems

- Processing segments sequentially in a loop underutilizes GPU compute and fails to leverage batching.
- Aggressively clearing cache after every segment introduces allocation overhead and prevents KV/memory cache reuse.

------------------------------------------------------------------------

# Design Goals

## Functional Requirements

-   Browser-only experience.
-   Free hosting.
-   Free GPU.
-   Real-time transcript.
-   Resume from segment.
-   Download final transcript.

## Non-functional Requirements

-   Stateless server.
-   No database.
-   Automatic cleanup.
-   Multi-user capable.
-   Free-tier compatible.

------------------------------------------------------------------------

# System Architecture

## High-level

``` text
Browser
   │
   ▼
Render Backend
   │
   ├────────► Cloudflare R2
   │
   ▼
Colab Worker
```

## Mermaid Diagram

``` mermaid
flowchart LR

A[Browser]

B[Render Backend]

C[Colab Worker]

D[Cloudflare R2]

A --> B

B --> C

C --> B

B --> D

C --> D

B --> A
```

------------------------------------------------------------------------

# Component Responsibilities

## Browser

Responsibilities:

-   Upload
-   Progress
-   Realtime update for transcripts
-   Download

No AI computation occurs here.

------------------------------------------------------------------------

## Backend (Render)

Responsibilities:

-   Create jobs
-   Manage queue
-   Push SSE updates
-   Generate final transcript
-   Delete expired jobs

Why Render?

-   Free.
-   Sleeps automatically.
-   Fixed URL.
-   Suitable for FastAPI.

------------------------------------------------------------------------

## GPU Worker (Colab)

Instead of interactive usage:

``` python
while True:
    ask_server_for_job()
    process_job()
    upload_results()
```

The worker continuously polls the backend.

------------------------------------------------------------------------

## Cloudflare R2

Used as temporary object storage.

Stores:

-   original audio
-   segment transcripts
-   final txt

------------------------------------------------------------------------

# User Workflow

## Normal Case

``` mermaid
sequenceDiagram

User->>Backend: Upload

Backend->>Worker: Queue Job

Worker->>R2: Download Audio

loop Every Segment

Worker->>Backend: Segment Result

Backend->>User: SSE Update

end

Worker->>R2: Upload Final TXT

Backend->>User: Enable Download
```

------------------------------------------------------------------------

## Upload Panel

### Components

-   Drag-and-drop
-   Upload button
-   Start from
-   OK

Start from defaults to 1

------------------------------------------------------------------------

## Results Panel

### Features

-   Real-time updates
-   Scrollable transcript
-   Progress x/y
-   Progress bar
-   Download button

Example:

``` text
Progress: 3/10

██████░░░░░░
```

------------------------------------------------------------------------

# Real-time Updates

Technology:

> **Server-Sent Events (SSE)**

Why SSE?

-   Simpler than WebSocket.
-   Automatic reconnect.
-   Perfect for one-way updates.

Flow:

``` text
Worker -> POST /segment ->Backend -> SSE -> Browser
```

------------------------------------------------------------------------

# Resume Feature (Start from)

Example:

``` text
12 segments

Completed: 1 - 7

Start from: 8
```

Only segments 8, 9, 10, 11, 12 are processed.

------------------------------------------------------------------------

# Job Model

Example JSON

``` json
{
  "job_id": "abc123",
  "status": "processing",
  "start_from": 8,
  "done_segments": 7,
  "total_segments": 12
}
```

Job states:

``` mermaid
stateDiagram-v2

Queued --> Processing

Processing --> Completed

Processing --> Failed

Completed --> Expired

Failed --> Retry
```

------------------------------------------------------------------------

# Failure Recovery

## Case: Worker Dies

Example:

``` text
12 segments

completed: 7

worker stopped
```

User sees:

-   transcript 1-7
-   progress 7/12
-   Start from 8

User can:

1.  Copy transcript.
2.  Start again from segment 8.

This prevents wasting already-completed computation.

------------------------------------------------------------------------

# Edge Cases

## Case 1

User leaves for 1 hour, app and Colab remain open.

Result:

-   Download still available (and even auto-download).
-   Colab may disconnected.
-   But transcript preserved on app.

------------------------------------------------------------------------

## Case 2

Multiple users

### Single Worker

Queue.

``` text
A

↓

B

↓

C
```

### Multiple Workers

``` text
Worker1 → User A

Worker2 → User B

Worker3 → User C
```

Independent processing.

------------------------------------------------------------------------

# API Design

## Upload

``` http
POST /upload
```

Returns

``` json
{
  "job_id": "abc"
}
```

------------------------------------------------------------------------

## Segment Upload

``` http
POST /segment
```

Body

``` json
{
  "job_id": "abc",
  "index": 3,
  "text": "Bonjour..."
}
```

------------------------------------------------------------------------

## Progress Stream

``` http
GET /events/{job_id}
```

SSE endpoint.

------------------------------------------------------------------------

## Download

``` http
GET /download/{job_id}
```

------------------------------------------------------------------------

# Deployment

## Free Stack

  Component   Platform
  ----------- ---------------
  Frontend    Vercel
  Backend     Render
  Storage     Cloudflare R2
  GPU         Google Colab

All selected for free-tier compatibility.

------------------------------------------------------------------------

# Repository Structure

``` text
french-transcript-web/

├── frontend/

│ ├── app/

│ ├── components/

│ └── styles/

├── backend/

│ ├── api/

│ ├── services/

│ ├── queue/

│ └── main.py

├── worker/

│ ├── colab_notebook.ipynb

│ ├── worker.py

│ └── inference.py

├── shared/

│ ├── schemas.py

│ └── utils.py

├── README.md

└── LICENSE
```

------------------------------------------------------------------------

# Roadmap

## Phase 1

-   [ ] Convert notebook into worker

## Phase 2

-   [ ] FastAPI backend

## Phase 3

-   [ ] Next.js frontend

## Phase 4

-   [ ] SSE

## Phase 5

-   [ ] Resume

## Phase 6

-   [ ] Cleanup

------------------------------------------------------------------------

> **Production-oriented Design Specification (v2.0)**

------------------------------------------------------------------------

# Updates

## Batched GPU Inference

Replaced sequential Whisper inference with batched inference (batch_size=4 on Colab GPU).
Reduced GPU idle time between inference calls.

## Removed Temporary WAV I/O

Eliminated intermediate segment_x.wav file creation. Removed repeated disk write/read operations for every segment.

## Optimized GPU Memory Management

Removed torch.cuda.empty_cache() after every segment.
Allowed PyTorch's CUDA memory allocator to reuse cached memory between batches, reducing allocation overhead.

## Upgraded to Distilled Whisper Model
Reduced decoder size while maintaining comparable transcription quality.
Enabled higher inference throughput with lower GPU memory usage.
Distilled models reduces hallucination.
