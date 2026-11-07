import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createServer } from 'node:http';
import { createClient } from '@libsql/client';
import { resolveDatabaseConfig } from './environment.ts';
import { deployCloudSchema } from './cloudSchema.ts';
import handler from '../api/index.ts';
import { readFile } from 'node:fs/promises';
import { createDatabaseAccessor } from './databaseClient.ts';
import { reportDatabaseFailure } from './databaseDiagnostics.ts';
import { db } from './db.ts';

test('database selection keeps tests local and requires complete hosted credentials', () => {
  const cloud = { TURSO_DATABASE_URL: 'libsql://example.turso.io', TURSO_AUTH_TOKEN: 'test-only' };
  assert.deepEqual(resolveDatabaseConfig(cloud), { url: cloud.TURSO_DATABASE_URL, authToken: cloud.TURSO_AUTH_TOKEN });
  assert.deepEqual(resolveDatabaseConfig({ ...cloud, DATABASE_URL: 'file:./isolated.db' }), { url: 'file:./isolated.db' });
  assert.deepEqual(resolveDatabaseConfig({ ...cloud, VERCEL: '1', DATABASE_URL: 'file:./ignored.db' }), { url: cloud.TURSO_DATABASE_URL, authToken: cloud.TURSO_AUTH_TOKEN });
  assert.deepEqual(resolveDatabaseConfig({}), { url: 'file:./prisma/oralia.db' });
  for (const env of [{ VERCEL: '1' }, { VERCEL: '1', DATABASE_URL: 'file:./ignored.db' }, { TURSO_AUTH_TOKEN: 'test-only' }, { TURSO_DATABASE_URL: cloud.TURSO_DATABASE_URL }]) {
    assert.throws(() => resolveDatabaseConfig(env));
  }
});

test('hosted credentials reject missing, blank and malformed values without exposing them', () => {
  const valid = { VERCEL: '1', TURSO_DATABASE_URL: 'libsql://example.turso.io', TURSO_AUTH_TOKEN: 'private-test-token' };
  for (const env of [
    { ...valid, TURSO_DATABASE_URL: undefined }, { ...valid, TURSO_AUTH_TOKEN: undefined },
    { ...valid, TURSO_DATABASE_URL: ' \n ' }, { ...valid, TURSO_AUTH_TOKEN: ' \n ' },
    ...['libsql://', 'https://example.turso.io', 'libsql://user:password@example.turso.io', 'libsql://example.turso.io?auth=private', 'not-a-url'].map(url => ({ ...valid, TURSO_DATABASE_URL: url })),
  ]) assert.throws(() => resolveDatabaseConfig(env), error => error instanceof Error && error.message === 'Database configuration is invalid.');
});

test('lazy client reuses successful construction and retries failures with sanitized diagnostics', () => {
  const messages: unknown[][] = [];
  const original = console.error;
  console.error = (...args: unknown[]) => { messages.push(args); };
  try {
    let env: NodeJS.ProcessEnv = { VERCEL: '1' };
    let attempts = 0;
    const accessor = createDatabaseAccessor(() => {
      attempts++;
      if (attempts === 1) throw Object.assign(new Error('private-test-token in raw SQL'), { code: 'UNAUTHORIZED' });
      return { connected: true };
    }, () => env);
    assert.equal(attempts, 0);
    assert.throws(accessor);
    assert.equal(attempts, 0);
    env = { VERCEL: '1', TURSO_DATABASE_URL: 'libsql://example.turso.io', TURSO_AUTH_TOKEN: 'private-test-token' };
    assert.throws(accessor);
    const client = accessor();
    assert.equal(accessor(), client);
    assert.equal(attempts, 2);
    reportDatabaseFailure({ code: 'private-test-token', cause: { errorCode: 'P1001', cause: { code: 'ENOTFOUND' } }, message: 'raw SQL private-test-token' }, 'query');
    const text = JSON.stringify(messages);
    assert.match(text, /TURSO_DATABASE_URL/);
    assert.match(text, /TURSO_AUTH_TOKEN/);
    assert.match(text, /UNAUTHORIZED/);
    assert.match(text, /P1001/);
    assert.match(text, /ENOTFOUND/);
    assert.doesNotMatch(text, /private-test-token|raw SQL|libsql:\/\//);
  } finally { console.error = original; }
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
    const rewritten = await fetch(base + '/api?__oralia_path=v1/media-status&url=/media/anansi-wisdom.wav');
    assert.match(rewritten.headers.get('content-type') ?? '', /application\/json/);
    assert.deepEqual(await rewritten.json(), { available: true });
    const unknown = await fetch(base + '/api?__oralia_path=v1/not-found');
    assert.equal(unknown.status, 404);
    assert.deepEqual(await unknown.json(), { error: 'API route not found.' });
  } finally { await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())); }
});

test('API rewrite precedes SPA fallback, which excludes static and public asset paths', async () => {
  const config = JSON.parse(await readFile('vercel.json', 'utf8'));
  assert.ok(config.functions['api/index.ts']);
  const [api, spa] = config.rewrites as { source: string; destination: string }[];
  const apiPattern = new RegExp(`^${api.source}$`);
  const spaPattern = new RegExp(`^${spa.source}$`);
  for (const path of ['/api/v1/health', '/api/v1/catalog', '/api/v1/stories/anansi-wisdom', '/api/unknown']) {
    assert.equal(path.replace(apiPattern, api.destination), '/api?__oralia_path=' + path.slice(5));
    assert.equal(spaPattern.test(path), false);
  }
  for (const path of ['/api', '/media/story.wav', '/assets/app.js', '/images/fallback/frame.svg', '/favicon.svg', '/robots.txt', '/missing.css']) assert.equal(spaPattern.test(path), false);
  for (const path of ['/', '/discover', '/creators/example']) assert.equal(path.replace(spaPattern, spa.destination), '/index.html');
});

test('serverless health/catalog fail with JSON 503 and recover after missing configuration is corrected', async () => {
  const names = ['VERCEL', 'DATABASE_URL', 'TURSO_DATABASE_URL', 'TURSO_AUTH_TOKEN'] as const;
  const previous = Object.fromEntries(names.map(name => [name, process.env[name]]));
  const messages: unknown[][] = [];
  const original = console.error;
  console.error = (...args: unknown[]) => { messages.push(args); };
  process.env.VERCEL = '1';
  delete process.env.DATABASE_URL;
  delete process.env.TURSO_DATABASE_URL;
  delete process.env.TURSO_AUTH_TOKEN;
  const server = createServer((request, response) => void handler(request, response));
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  const base = `http://127.0.0.1:${address.port}`;
  try {
    for (const path of ['/api/v1/health', '/api?__oralia_path=v1/catalog']) {
      const response = await fetch(base + path);
      assert.equal(response.status, 503);
      assert.match(response.headers.get('content-type')!, /application\/json/);
      assert.deepEqual(await response.json(), { error: 'The database is unavailable. Please retry shortly.' });
    }
    process.env.VERCEL = '0';
    process.env.DATABASE_URL = 'file::memory:';
    // This memory-only database deliberately lacks tables to exercise query diagnostics.
    assert.equal((await fetch(base + '/api/v1/health')).status, 503);
    await db.$executeRawUnsafe('CREATE TABLE Story(id TEXT PRIMARY KEY)');
    assert.equal((await fetch(base + '/api/v1/health')).status, 200);
    const text = JSON.stringify(messages);
    assert.match(text, /CRITICAL: TURSO_DATABASE_URL/);
    assert.match(text, /CRITICAL: TURSO_AUTH_TOKEN/);
    assert.match(text, /query/);
    assert.doesNotMatch(text, /SELECT|CREATE TABLE|file:|libsql:/);
  } finally {
    await new Promise<void>(resolve => server.close(() => resolve()));
    await db.$disconnect();
    console.error = original;
    for (const name of names) { if (previous[name] === undefined) delete process.env[name]; else process.env[name] = previous[name]; }
  }
});
