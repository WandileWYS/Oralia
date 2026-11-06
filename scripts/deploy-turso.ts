import { execFileSync } from 'node:child_process';
import { createClient } from '@libsql/client';
import { resolveDatabaseConfig } from '../server/environment.ts';
import { deployCloudSchema } from '../server/cloudSchema.ts';

const config = resolveDatabaseConfig({ ...process.env, DATABASE_URL: undefined });
if (!config.url.startsWith('libsql://')) throw new Error('Explicit Turso credentials are required for cloud schema deployment.');
const sql = execFileSync(process.execPath, [
  'node_modules/prisma/build/index.js', 'migrate', 'diff', '--from-empty', '--to-schema', 'prisma/schema.prisma', '--script',
], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] });
const client = createClient(config);
try {
  const result = await deployCloudSchema(client, sql);
  console.log(JSON.stringify({ schema: result.initialized ? 'initialized' : 'verified', checksum: result.checksum }));
} catch {
  // Driver errors can contain connection details. Expose neither tokens nor raw SQL.
  console.error('Cloud schema deployment failed. Verify connectivity and schema compatibility; no reset will be attempted.');
  process.exitCode = 1;
} finally { client.close(); }
