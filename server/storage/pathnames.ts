function safeObjectName(filename: string): string {
  const normalized = filename
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '_')
    .replace(/\.{2,}/g, '.')
    .replace(/^\.+/, '')
    .slice(0, 120);
  return normalized || 'media';
}

export function createSourceObjectPathname(userId: string, jobId: string, filename: string): string {
  return `users/${userId}/jobs/${jobId}/source/${safeObjectName(filename)}`;
}

export function createOutputObjectPathname(userId: string, jobId: string): string {
  return `users/${userId}/jobs/${jobId}/output/transcript.txt`;
}
