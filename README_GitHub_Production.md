# French Transcript Web App

> **Production-oriented Design Specification (v2.0)**
>
> A GitHub-style technical README for transforming a Google Colab
> transcription notebook into a resilient web application with free-tier
> infrastructure.

------------------------------------------------------------------------

## Table of Contents

1.  Project Overview
2.  Problem Statement
3.  Current Notebook Status
4.  Design Goals
5.  System Architecture
6.  User Workflow
7.  UI Specification
8.  Backend Design
9.  Worker Design
10. Temporary Storage Strategy
11. Job Lifecycle
12. API Design
13. Failure Recovery
14. Multi-user Handling
15. Edge Cases
16. Deployment
17. Repository Structure
18. Roadmap
19. Future Improvements

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
2.  Upload file.
3.  Run notebook.
4.  Wait.
5.  Download transcript.

## Current Problems

  Problem                         Impact
  ------------------------------- -----------------------------------
  Internet disconnect             Lose progress
  Laptop sleeps                   Notebook disconnects
  Browser closed                  Session interrupted
  Must rerun completed segments   Time wasted
  Colab UI                        Difficult for non-technical users

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

# Why this Architecture?

Instead of allowing users to directly execute Colab notebooks, Colab
becomes a **GPU worker**.

Benefits:

-   User browser can disconnect.
-   Browser only displays progress.
-   Server coordinates jobs.
-   Worker performs computation.
-   Temporary files survive server restarts.

------------------------------------------------------------------------

# Component Responsibilities

## Browser

Responsibilities:

-   Upload
-   Progress
-   Realtime transcript
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

TTL example:

  File        Lifetime
  ----------- ----------
  Audio       24h
  Segments    24h
  Final txt   24h

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

# UI Specification

The interface consists of two panels.

## Layout

``` text
+----------------------+----------------------+

| Upload | Results |

| | |

| Drop Zone | Transcript |

| Upload | Scroll |

| Resume | |

| OK | Progress |

| | Download |

+----------------------+----------------------+
```

------------------------------------------------------------------------

## Upload Panel

### Components

-   Drag-and-drop
-   Upload button
-   Resume from
-   OK

Resume from defaults to:

``` text
0
```

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
Worker

↓

POST /segment

↓

Backend

↓

SSE

↓

Browser
```

------------------------------------------------------------------------

# Resume Feature

One of the most valuable features.

Example:

``` text
12 segments

Completed: 8

Resume from: 8
```

Only segments:

``` text
8

9

10

11
```

are processed.

------------------------------------------------------------------------

# Job Model

Example JSON

``` json
{
  "job_id": "abc123",
  "status": "processing",
  "resume_from": 8,
  "done_segments": 8,
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

completed: 8

worker stopped
```

User sees:

-   transcript 1-8
-   progress 8/12
-   Resume from 8

Nothing is lost.

------------------------------------------------------------------------

# Copy-safe Recovery

Even if the worker disappears:

User can:

1.  Copy transcript.
2.  Start again from segment 8.

This prevents wasting already-completed computation.

------------------------------------------------------------------------

# Edge Cases

## Case 1

User leaves for 30 minutes.

Browser remains open.

Result:

-   Download still available.
-   Transcript preserved.

------------------------------------------------------------------------

## Case 2

Laptop sleeps after 10 minutes.

### Job not finished

Browser sleeps.

Worker continues.

If Colab later disconnects:

Progress remains.

### Job finished

Browser reconnects.

Download still works.

------------------------------------------------------------------------

## Case 3

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

# Future Improvements

## Optional Features

-   Queue position display.
-   Remaining time estimation.
-   Multiple GPU workers.
-   Kaggle worker support.
-   Auto retry after worker failure.
-   Drag multiple files.
-   Export DOCX.
-   Subtitle generation (SRT).
-   Speaker diarization.
-   French grammar cleanup.

------------------------------------------------------------------------

# Design Principles

The architecture intentionally favors **ephemeral infrastructure**.

Instead of persisting everything forever, it guarantees that:

-   active jobs survive browser interruptions,
-   completed files remain available for a defined TTL,
-   users can resume failed jobs without repeating completed work,
-   the backend remains stateless and inexpensive.

This makes the application well-suited for free-tier deployment while
still providing a user experience much closer to a production web
service than a traditional Colab notebook.
