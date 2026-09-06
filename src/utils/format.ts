import { SegmentResult } from '../types';

export function padZero(num: number, size = 2): string {
  let s = num.toString();
  while (s.length < size) s = '0' + s;
  return s;
}

export function formatSecondsToHMS(totalSec: number): string {
  const hours = Math.floor(totalSec / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const seconds = Math.floor(totalSec % 60);
  return `${padZero(hours)}:${padZero(minutes)}:${padZero(seconds)}`;
}

export function formatSecondsToMS(totalSec: number): string {
  const minutes = Math.floor(totalSec / 60);
  const seconds = Math.floor(totalSec % 60);
  return `${padZero(minutes)}m${padZero(seconds)}s`;
}

export function formatSegmentTimeRange(startSec: number, endSec: number): string {
  return `[${formatSecondsToHMS(startSec)} – ${formatSecondsToHMS(endSec)}]`;
}

export function formatColabHeader(index: number, startSec: number, endSec: number): string {
  return `Đoạn ${index} (${formatSecondsToMS(startSec)} - ${formatSecondsToMS(endSec)}):`;
}

export function exportToColabTxt(segments: SegmentResult[], fileName = 'audio'): string {
  const lines: string[] = [];
  lines.push(`BẢN TRANSCRIPT TIẾNG PHÁP - FRENCH TRANSCRIPT WEB APP`);
  lines.push(`File: ${fileName}`);
  lines.push(`Số đoạn đã xử lý: ${segments.length}`);
  lines.push(`Thời lượng mỗi đoạn: 120 giây (Mô hình Whisper Large v3 French)`);
  lines.push(`Ngày tạo: ${new Date().toLocaleString('vi-VN')}`);
  lines.push('='.repeat(50));
  lines.push('');

  segments.forEach((seg) => {
    lines.push(formatColabHeader(seg.index, seg.startSec, seg.endSec));
    lines.push(seg.text);
    lines.push('-'.repeat(20));
  });

  return lines.join('\n');
}

export function exportToSRT(segments: SegmentResult[]): string {
  return segments
    .map((seg, idx) => {
      const startHMS = `${formatSecondsToHMS(seg.startSec)},000`;
      const endHMS = `${formatSecondsToHMS(seg.endSec)},000`;
      return `${idx + 1}\n${startHMS} --> ${endHMS}\n${seg.text}\n`;
    })
    .join('\n');
}
