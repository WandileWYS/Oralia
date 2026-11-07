import { DatabaseConfigurationError, type DatabaseConfigIssue } from './environment.ts';

const configurationMessages: Record<DatabaseConfigIssue, string> = {
  'missing-url': 'CRITICAL: TURSO_DATABASE_URL is not defined or is empty in process.env',
  'missing-token': 'CRITICAL: TURSO_AUTH_TOKEN is not defined or is empty in process.env',
  'invalid-url': 'CRITICAL: TURSO_DATABASE_URL must be a valid libsql:// database URL',
  'invalid-local-url': 'CRITICAL: DATABASE_URL must reference a local SQLite file outside Vercel',
};
const allowedCodes = new Set(['P1000', 'P1001', 'P1002', 'P1003', 'P1008', 'P1010', 'P1017', 'P2021', 'P2022', 'P2024', 'P2028', 'P2037', 'UNAUTHORIZED', 'AUTHENTICATION_FAILED', 'TOKEN_EXPIRED', 'SERVER_ERROR', 'SQLITE_ERROR', 'SQLITE_BUSY', 'SQLITE_CANTOPEN', 'SQLITE_CONSTRAINT', 'SQLITE_NOTADB', 'CONNECTION_CLOSED', 'CONNECT_TIMEOUT', 'HRANA_WEBSOCKET_ERROR', 'HTTP_SERVER_ERROR', 'ECONNREFUSED', 'ECONNRESET', 'ENOTFOUND', 'ETIMEDOUT']);

export function reportDatabaseFailure(error: unknown, phase: 'initialization' | 'query') {
  if (error instanceof DatabaseConfigurationError) {
    if (phase === 'initialization') for (const issue of error.issues) console.error(configurationMessages[issue]);
    return; // Configuration has already been reported by lazy initialization.
  }
  const codes = new Set<string>();
  let current = error;
  // Only inspect allowlisted codes along a bounded cause chain, never raw errors.
  for (let depth = 0; depth < 4 && typeof current === 'object' && current !== null; depth++) {
    try {
      const value = current as { code?: unknown; errorCode?: unknown; cause?: unknown };
      for (const candidate of [value.code, value.errorCode]) if (typeof candidate === 'string' && allowedCodes.has(candidate)) codes.add(candidate);
      current = value.cause;
    } catch { break; }
  }
  console.error('Oralia database failure', { phase, codes: [...codes], category: codes.size ? 'provider-error' : 'unclassified-error' });
}
