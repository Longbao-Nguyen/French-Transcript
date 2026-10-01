import postgres, { type Sql } from 'postgres';

let client: Sql | undefined;

export function getPostgresClient(): Sql {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required for the postgres database provider.');
  }

  if (!client) {
    client = postgres(databaseUrl, {
      max: 5,
      idle_timeout: 20,
      connect_timeout: 10,
      prepare: false,
    });
  }

  return client;
}
