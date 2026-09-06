export interface SegmentResult {
  index: number; // 1-based (1, 2, 3...)
  startSec: number;
  endSec: number;
  timeRangeStr: string; // "[00:00:00 – 00:02:00]"
  vietnameseRangeStr?: string; // "00m00s - 02m00s"
  text: string;
  timestamp: number;
}

export interface Job {
  id: string;
  fileName: string;
  fileSize?: string;
  fileUrl?: string;
  totalDurationSec: number;
  segmentDurationSec: number; // 120
  totalSegments: number;
  resumeFrom: number; // segment index 0 to totalSegments - 1
  status: 'idle' | 'queued' | 'processing' | 'paused' | 'completed' | 'failed';
  doneSegments: number;
  segments: SegmentResult[];
  createdAt: number;
  updatedAt: number;
  error?: string;
}

export interface SampleAudio {
  id: string;
  title: string;
  description: string;
  durationSec: number;
  segmentsCount: number;
  url: string;
  segments: {
    startSec: number;
    endSec: number;
    text: string;
  }[];
}
