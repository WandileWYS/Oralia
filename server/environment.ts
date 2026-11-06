import { existsSync } from 'node:fs';
import { loadEnvFile } from 'node:process';

// Node preserves explicitly supplied variables, including isolated test database URLs.
if (process.env.VERCEL !== '1' && existsSync('.env')) loadEnvFile('.env');

export function resolveDatabaseConfig(env: NodeJS.ProcessEnv) {
  const local = env.DATABASE_URL;
  if (local) {
    if (env.VERCEL === '1' || !local.startsWith('file:')) throw new Error('DATABASE_URL is for local SQLite only. Configure Turso for hosting.');
    return { url: local };
  }
  if (env.TURSO_DATABASE_URL || env.TURSO_AUTH_TOKEN) {
    if (!env.TURSO_DATABASE_URL?.startsWith('libsql://') || !env.TURSO_AUTH_TOKEN?.trim()) throw new Error('Configure both TURSO_DATABASE_URL and TURSO_AUTH_TOKEN.');
    return { url: env.TURSO_DATABASE_URL, authToken: env.TURSO_AUTH_TOKEN };
  }
  if (env.VERCEL === '1') throw new Error('Turso configuration is required on Vercel.');
  return { url: 'file:./prisma/oralia.db' };
}

export const presentationMode = () => process.env.PRESENTATION_MODE === 'true';
