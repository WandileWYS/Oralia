import { existsSync } from 'node:fs';
import { loadEnvFile } from 'node:process';

// Node preserves explicitly supplied variables, including isolated test database URLs.
if (process.env.VERCEL !== '1' && existsSync('.env')) loadEnvFile('.env');

export type DatabaseConfigIssue = 'missing-url' | 'missing-token' | 'invalid-url' | 'invalid-local-url';
export class DatabaseConfigurationError extends Error {
  constructor(public readonly issues: readonly DatabaseConfigIssue[]) {
    super('Database configuration is invalid.');
    this.name = 'DatabaseConfigurationError';
  }
}

export function resolveDatabaseConfig(env: NodeJS.ProcessEnv) {
  const local = env.DATABASE_URL?.trim();
  // A leftover DATABASE_URL must never prevent valid hosted Turso configuration.
  if (env.VERCEL !== '1' && local) {
    if (!local.startsWith('file:') || local.length <= 5) throw new DatabaseConfigurationError(['invalid-local-url']);
    return { url: local };
  }
  if (env.VERCEL === '1' || env.TURSO_DATABASE_URL || env.TURSO_AUTH_TOKEN) {
    const url = env.TURSO_DATABASE_URL?.trim();
    const authToken = env.TURSO_AUTH_TOKEN?.trim();
    const issues: DatabaseConfigIssue[] = [];
    if (!url) issues.push('missing-url');
    if (!authToken) issues.push('missing-token');
    if (url) {
      try {
        const parsed = new URL(url);
        if (parsed.protocol !== 'libsql:' || !parsed.hostname || parsed.username || parsed.password || parsed.search || parsed.hash || (parsed.pathname && parsed.pathname !== '/')) issues.push('invalid-url');
      } catch { issues.push('invalid-url'); }
    }
    if (issues.length) throw new DatabaseConfigurationError(issues);
    return { url: url!, authToken: authToken! };
  }
  return { url: 'file:./prisma/oralia.db' };
}
