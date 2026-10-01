export function createId(prefix: 'usr' | 'job' | 'run'): string {
  return `${prefix}_${crypto.randomUUID().replaceAll('-', '')}`;
}
