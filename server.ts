import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface SegmentResult {
  index: number;
  startSec: number;
  endSec: number;
  timeRangeStr: string;
  vietnameseRangeStr?: string;
  text: string;
  timestamp: number;
}

interface Job {
  id: string;
  fileName: string;
  fileUrl?: string;
  totalDurationSec: number;
  segmentDurationSec: number;
  totalSegments: number;
  resumeFrom: number;
  status: 'queued' | 'processing' | 'completed' | 'paused' | 'failed';
  doneSegments: number;
  segments: SegmentResult[];
  createdAt: number;
  updatedAt: number;
  error?: string;
}

const jobs = new Map<string, Job>();
const sseClients = new Map<string, express.Response[]>();

function notifyClients(jobId: string, event: string, data: any) {
  const clients = sseClients.get(jobId);
  if (!clients || clients.length === 0) return;
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  clients.forEach((res) => {
    try {
      res.write(payload);
    } catch {
      // client disconnected
    }
  });
}

function padZero(num: number, size = 2): string {
  let s = num.toString();
  while (s.length < size) s = '0' + s;
  return s;
}

function formatSecondsToHMS(totalSec: number): string {
  const hours = Math.floor(totalSec / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const seconds = Math.floor(totalSec % 60);
  return `${padZero(hours)}:${padZero(minutes)}:${padZero(seconds)}`;
}

function formatSecondsToMS(totalSec: number): string {
  const minutes = Math.floor(totalSec / 60);
  const seconds = Math.floor(totalSec % 60);
  return `${padZero(minutes)}m${padZero(seconds)}s`;
}

// Lazy Gemini client helper
let aiClient: GoogleGenAI | null = null;
function getAI() {
  if (!aiClient && process.env.GEMINI_API_KEY) {
    aiClient = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  }
  return aiClient;
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));

  // API: Health check
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'ok',
      activeJobs: jobs.size,
      timestamp: Date.now(),
      hasGeminiKey: !!process.env.GEMINI_API_KEY,
    });
  });

  // API: Upload / Create Job (both /api/upload and /upload for spec compatibility)
  const handleUpload = (req: express.Request, res: express.Response) => {
    const {
      fileName = 'audio.mp3',
      fileUrl,
      durationSec = 1200,
      resumeFrom = 0,
      initialSegments = [],
    } = req.body;

    const jobId = 'job_' + Math.random().toString(36).substring(2, 9);
    const segDur = 120;
    const totalSegments = Math.max(1, Math.ceil(durationSec / segDur));

    const job: Job = {
      id: jobId,
      fileName,
      fileUrl,
      totalDurationSec: durationSec,
      segmentDurationSec: segDur,
      totalSegments,
      resumeFrom: Math.min(Math.max(0, resumeFrom), totalSegments - 1),
      status: 'queued',
      doneSegments: 0,
      segments: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    // If pre-existing completed segments exist (e.g. from resume or initial upload)
    if (Array.isArray(initialSegments) && initialSegments.length > 0) {
      job.segments = initialSegments;
      job.doneSegments = initialSegments.length;
    }

    jobs.set(jobId, job);

    res.json({
      job_id: jobId,
      job,
      message: 'Job created successfully',
    });
  };

  app.post('/api/upload', handleUpload);
  app.post('/upload', handleUpload);

  // API: Get Job Status
  app.get('/api/jobs/:id', (req, res) => {
    const job = jobs.get(req.params.id);
    if (!job) {
      res.status(404).json({ error: 'Job not found' });
      return;
    }
    res.json(job);
  });

  // API: External Segment Upload (matches spec POST /segment)
  const handleSegmentUpload = (req: express.Request, res: express.Response) => {
    const { job_id, index, text, startSec, endSec } = req.body;
    const job = jobs.get(job_id);

    if (!job) {
      res.status(404).json({ error: 'Job not found' });
      return;
    }

    const sSec = typeof startSec === 'number' ? startSec : (index - 1) * 120;
    const eSec = typeof endSec === 'number' ? endSec : Math.min(index * 120, job.totalDurationSec);
    const timeRangeStr = `[${formatSecondsToHMS(sSec)} – ${formatSecondsToHMS(eSec)}]`;
    const vietnameseRangeStr = `${formatSecondsToMS(sSec)} - ${formatSecondsToMS(eSec)}`;

    const segmentResult: SegmentResult = {
      index,
      startSec: sSec,
      endSec: eSec,
      timeRangeStr,
      vietnameseRangeStr,
      text: text || '',
      timestamp: Date.now(),
    };

    // Update segments array without duplicates
    const existingIdx = job.segments.findIndex((s) => s.index === index);
    if (existingIdx >= 0) {
      job.segments[existingIdx] = segmentResult;
    } else {
      job.segments.push(segmentResult);
      job.segments.sort((a, b) => a.index - b.index);
    }

    job.doneSegments = job.segments.length;
    job.updatedAt = Date.now();
    job.status = job.doneSegments >= job.totalSegments ? 'completed' : 'processing';

    // Broadcast SSE update
    notifyClients(job_id, 'segment', {
      segment: segmentResult,
      done: job.doneSegments,
      total: job.totalSegments,
      status: job.status,
    });

    if (job.status === 'completed') {
      notifyClients(job_id, 'complete', {
        job_id,
        totalSegments: job.totalSegments,
        doneSegments: job.doneSegments,
      });
    }

    res.json({
      status: 'ok',
      job_id,
      received_segment: index,
      done_segments: job.doneSegments,
      total_segments: job.totalSegments,
    });
  };

  app.post('/api/segment', handleSegmentUpload);
  app.post('/segment', handleSegmentUpload);

  // API: Server-Sent Events (both /api/events/:job_id and /events/:job_id)
  const handleSSE = (req: express.Request, res: express.Response) => {
    const jobId = req.params.job_id;
    const job = jobs.get(jobId);

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.flushHeaders();

    if (!sseClients.has(jobId)) {
      sseClients.set(jobId, []);
    }
    sseClients.get(jobId)!.push(res);

    // Initial state push
    if (job) {
      res.write(`event: init\ndata: ${JSON.stringify(job)}\n\n`);
    }

    // Keepalive ping
    const keepalive = setInterval(() => {
      res.write(': keepalive\n\n');
    }, 15000);

    req.on('close', () => {
      clearInterval(keepalive);
      const list = sseClients.get(jobId) || [];
      sseClients.set(
        jobId,
        list.filter((client) => client !== res)
      );
    });
  };

  app.get('/api/events/:job_id', handleSSE);
  app.get('/events/:job_id', handleSSE);

  // API: Download final transcript.txt (both /api/download/:job_id and /download/:job_id)
  const handleDownload = (req: express.Request, res: express.Response) => {
    const jobId = req.params.job_id;
    const job = jobs.get(jobId);

    if (!job) {
      res.status(404).send('Job not found');
      return;
    }

    const lines: string[] = [];
    lines.push('BẢN TRANSCRIPT TIẾNG PHÁP - FRENCH TRANSCRIPT WEB APP');
    lines.push(`File gốc: ${job.fileName}`);
    lines.push(`Tổng số đoạn: ${job.totalSegments}`);
    lines.push(`Đoạn đã hoàn thành: ${job.doneSegments}`);
    lines.push(`Thời lượng mỗi đoạn: 120 giây (Mô hình: bofenghuang/whisper-large-v3-french)`);
    lines.push(`Ngày xuất: ${new Date().toLocaleString('fr-FR')}`);
    lines.push('==================================================');
    lines.push('');

    job.segments.sort((a, b) => a.index - b.index);
    job.segments.forEach((seg) => {
      const vStr = seg.vietnameseRangeStr || `${formatSecondsToMS(seg.startSec)} - ${formatSecondsToMS(seg.endSec)}`;
      lines.push(`Đoạn ${seg.index} (${vStr}):`);
      lines.push(seg.text);
      lines.push('--------------------');
    });

    const fileContent = lines.join('\n');
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="transcript_${job.fileName.replace(/\.[^/.]+$/, '')}.txt"`
    );
    res.send(fileContent);
  };

  app.get('/api/download/:job_id', handleDownload);
  app.get('/download/:job_id', handleDownload);

  // API: AI Polish / French Grammar Correction for segments (using Gemini if key available)
  app.post('/api/ai/refine-french', async (req, res) => {
    const { text } = req.body;
    if (!text) {
      res.status(400).json({ error: 'Text required' });
      return;
    }

    try {
      const ai = getAI();
      if (!ai) {
        // Fallback: return original text
        res.json({ refined: text, note: 'Gemini key not set, returned original transcript.' });
        return;
      }

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: `You are an expert French transcription proofreader for French academic lectures. Clean up speech disfluencies, normalize punctuation and accented characters (é, è, ê, à, ç, etc.) without altering the meaning. Return ONLY the polished French transcript:\n\n${text}`,
      });

      res.json({ refined: response.text?.trim() || text });
    } catch (err: any) {
      res.status(500).json({ error: err.message, fallback: text });
    }
  });

  // Vite middleware in development, static files in production
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`French Transcript Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
