import { HttpError } from '../http/responses';

export interface UploadInitInput {
  filename: string;
  size: number;
  contentType: string;
}

export function getMaxUploadBytes(): number {
  const configured = Number(process.env.MAX_UPLOAD_BYTES);
  return Number.isSafeInteger(configured) && configured > 0
    ? configured
    : 2 * 1024 * 1024 * 1024;
}

export function validateUploadInit(value: unknown): UploadInitInput {
  if (!value || typeof value !== 'object') {
    throw new HttpError(400, 'Upload metadata is required.', 'INVALID_UPLOAD');
  }
  const input = value as Partial<UploadInitInput>;
  const rawFilename = typeof input.filename === 'string' ? input.filename.trim() : '';
  const filename = (rawFilename.split(/[\\/]/).pop() || '')
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .trim();
  if (!filename || filename.length > 255) {
    throw new HttpError(400, 'Filename must contain 1–255 valid characters.', 'INVALID_FILENAME');
  }
  if (!Number.isSafeInteger(input.size) || Number(input.size) <= 0) {
    throw new HttpError(400, 'File size must be a positive integer.', 'INVALID_FILE_SIZE');
  }
  if (Number(input.size) > getMaxUploadBytes()) {
    throw new HttpError(413, 'This file exceeds the configured upload limit.', 'FILE_TOO_LARGE');
  }
  const contentType = typeof input.contentType === 'string' && input.contentType.length <= 255
    ? input.contentType.trim()
    : '';
  return {
    filename,
    size: Number(input.size),
    contentType: contentType || 'application/octet-stream',
  };
}
