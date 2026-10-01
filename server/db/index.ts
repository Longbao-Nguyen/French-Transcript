import type { Repositories } from './interface';

let repositoriesPromise: Promise<Repositories> | undefined;

export async function getRepositories(): Promise<Repositories> {
  if (!repositoriesPromise) {
    repositoriesPromise = createRepositories();
  }
  return repositoriesPromise;
}

async function createRepositories(): Promise<Repositories> {
  const provider = process.env.DB_PROVIDER || 'postgres';

  if (provider === 'postgres') {
    const { createPostgresRepositories } = await import('./providers/postgres/repositories');
    return createPostgresRepositories();
  }

  throw new Error(`Unsupported DB_PROVIDER: ${provider}`);
}

export function resetRepositoriesForTests(): void {
  repositoriesPromise = undefined;
}
