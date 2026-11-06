import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createServer } from 'node:http';
import { createClient } from '@libsql/client';
import { resolveDatabaseConfig } from './environment.ts';
import { deployCloudSchema } from './cloudSchema.ts';
import handler from '../api/[...path].ts';

test('database selection keeps tests local and requires complete hosted credentials', () => {
  const cloud = { TURSO_DATABASE_URL: 'libsql://example.turso.io', TURSO_AUTH_TOKEN: 'test-only' };
  assert.deepEqual(resolveDatabaseConfig(cloud), { url: cloud.TURSO_DATABASE_URL, authToken: cloud.TURSO_AUTH_TOKEN });
  assert.deepEqual(resolveDatabaseConfig({ ...cloud, DATABASE_URL: 'file:./isolated.db' }), { url: 'file:./isolated.db' });
  assert.deepEqual(resolveDatabaseConfig({}), { url: 'file:./prisma/oralia.db' });
  for (const env of [{ VERCEL: '1' }, { VERCEL: '1', DATABASE_URL: 'file:./ignored.db' }, { TURSO_AUTH_TOKEN: 'test-only' }, { TURSO_DATABASE_URL: cloud.TURSO_DATABASE_URL }]) {
    assert.throws(() => resolveDatabaseConfig(env));
  }
});

test('cloud schema initializer preserves data, is repeatable and rejects incompatible schemas', async () => {
  const sql = execFileSync(process.execPath, ['node_modules/prisma/build/index.js', 'migrate', 'diff', '--from-empty', '--to-schema', 'prisma/schema.prisma', '--script'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  const client = createClient({ url: 'file::memory:' });
  const incompatible = createClient({ url: 'file::memory:' });
  try {
    assert.equal((await deployCloudSchema(client, sql)).initialized, true);
    await client.execute("INSERT INTO User(id,name,username,email,avatarUrl,bio) VALUES ('test','Test','test','test@example.test','/favicon.svg','Bio')");
    assert.equal((await deployCloudSchema(client, sql)).initialized, false);
    assert.equal((await client.execute('SELECT COUNT(*) AS n FROM User')).rows[0].n, 1);
    await assert.rejects(() => deployCloudSchema(client, sql + '\n-- changed contract'), /checksum changed/);
    await incompatible.execute('CREATE TABLE Story(id TEXT PRIMARY KEY, title TEXT)');
    await assert.rejects(() => deployCloudSchema(incompatible, sql), /incompatible/);
    assert.equal((await incompatible.execute("SELECT COUNT(*) AS n FROM sqlite_master WHERE type='table'")).rows[0].n, 1);
  } finally { client.close(); incompatible.close(); }
});

test('Vercel entrypoint preserves paths, media manifest and structured unknown-route errors', async () => {
  const server = createServer((request, response) => void handler(request, response));
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  const base = `http://127.0.0.1:${address.port}`;
  try {
    assert.deepEqual(await (await fetch(base + '/api/v1/media-status?url=/media/anansi-wisdom.wav')).json(), { available: true });
    assert.deepEqual(await (await fetch(base + '/api/v1/media-status?url=/media/missing.wav')).json(), { available: false });
    assert.equal((await fetch(base + '/api/v1/not-found')).status, 404);
    assert.equal((await fetch(base + '/api/media-status?url=/media/anansi-wisdom.wav')).status, 404);
  } finally { await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())); }
});
