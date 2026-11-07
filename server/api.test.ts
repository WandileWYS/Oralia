import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdir, readFile, unlink } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { createClient } from '@libsql/client';
import { catalogSchema } from '../src/types/api.ts';
import { creatorSessionSchema } from '../src/types/creator.ts';

test('SQLite API: migrated catalog, PIN sessions, ownership, voice preferences and bookmarks', async t => {
  await mkdir('.qa', { recursive: true });
  const file = `.qa/api-test-${process.pid}-${Date.now()}.db`;
  const url = `file:./${file}`;
  const sqlite = createClient({ url });
  await sqlite.executeMultiple(await readFile('prisma/migrations/20261105000000_init/migration.sql', 'utf8'));
  await sqlite.executeMultiple(await readFile('prisma/migrations/20261106000000_thematic_collections/migration.sql','utf8'));
  sqlite.close();
  process.env.DATABASE_URL = url;
  process.env.PRESENTATION_MODE = 'true';
  const seed = () => execFileSync(process.execPath, ['node_modules/tsx/dist/cli.mjs', 'prisma/seed.ts'], { env: { ...process.env, DATABASE_URL: url }, stdio: 'pipe' });
  seed();
  const { db } = await import('./db.ts');
  const { default: handleApi } = await import('../api/index.ts');
  const server = createServer(async (request, response) => {
    if (request.headers['x-test-parsed-body'] === 'true') {
      let raw = '';
      for await (const chunk of request) raw += String(chunk);
      Object.assign(request, { body: JSON.parse(raw) });
    }
    await handleApi(request, response);
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  const origin = `http://127.0.0.1:${address.port}`;
  const call = (path: string, method = 'GET', body?: unknown, token?: string) => fetch(`${origin}/api/v1${path}`, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
  const login = async (email: string) => {
    const challenge = await (await call('/auth/otp/request', 'POST', { email })).json() as { challengeId: string };
    const response = await call('/auth/otp/verify', 'POST', { challengeId: challenge.challengeId, pin: '000000' });
    assert.equal(response.status, 200);
    return creatorSessionSchema.parse(await response.json());
  };
  try {
    await t.test('all eight stories, authors and 32 keyframes are served from SQLite', async () => {
      const response = await call('/catalog');
      assert.equal(response.status, 200);
      const catalog = catalogSchema.parse(await response.json());
      assert.equal(catalog.stories.length, 8);
      const rewritten = await fetch(`${origin}/api?__oralia_path=v1/catalog&collection=EPIC_AND_CHRONICLE`);
      assert.equal(rewritten.status, 200);
      assert.match(rewritten.headers.get('content-type') ?? '', /application\/json/);
      assert.equal(catalogSchema.parse(await rewritten.json()).stories.length, 2);
      assert.equal((await fetch(`${origin}/api?__oralia_path=v1/health`)).status, 200);
      assert.equal((await fetch(`${origin}/api?__oralia_path=v1/stories/anansi-wisdom`)).status, 200);
      assert.equal(catalog.creators.length, 4);
      assert.equal(catalog.stories.filter(s=>s.collection==='FOLK_AND_FABLE').length,6); assert.equal(catalog.stories.filter(s=>s.collection==='EPIC_AND_CHRONICLE').length,2);
      assert.equal(catalogSchema.parse(await(await call('/catalog?collection=FOLK_AND_FABLE')).json()).stories.length,6);
      assert.equal(catalogSchema.parse(await(await call('/catalog?collection=EPIC_AND_CHRONICLE')).json()).stories.length,2);
      assert.equal((await call('/catalog?collection=ALL')).status,400);
      assert.equal(catalog.stories.flatMap(story => story.presentation.keyframes).length, 32);
      for (const story of catalog.stories) {
        assert.ok(catalog.creators.some(creator => creator.id === story.creatorId));
        assert.ok(story.sourceUrl);
        assert.equal(story.voiceType, 'STUDIO_AI');
        assert.ok(!('isDemo' in story));
      }
      await db.story.update({ where: { id: 'anansi-wisdom' }, data: { title: 'Database update visible immediately' } });
      const changed = catalogSchema.parse(await (await call('/catalog')).json());
      assert.equal(changed.stories.find(story => story.id === 'anansi-wisdom')?.title, 'Database update visible immediately');
      assert.equal((await call('/stories/not-found')).status, 404);
      assert.equal((await call('/creators/not-found')).status, 404);
    });
    await t.test('missing media is reported without fetching an absent audio asset', async () => {
      assert.deepEqual(await (await call('/media-status?url=/media/missing.wav')).json(), { available: false });
      assert.deepEqual(await (await call('/media-status?url=/media/anansi-wisdom.wav')).json(), { available: true });
      assert.deepEqual(await (await call('/media-status?url=/media/../../package.json')).json(), { available: false });
    });
    await t.test('PIN validation, single use, expiry and reserved editorial identities', async () => {
      assert.equal((await call('/auth/otp/request', 'POST', { email: 'bad-email' })).status, 400);
      assert.equal((await call('/auth/otp/request', 'POST', { email: 'akan@collections.oralia.invalid' })).status, 409);
      const challenge = await (await call('/auth/otp/request', 'POST', { email: 'pin@example.test' })).json() as { challengeId: string };
      assert.equal((await call('/auth/otp/verify', 'POST', { challengeId: challenge.challengeId, pin: '12345' })).status, 400);
      assert.equal((await call('/auth/otp/verify', 'POST', { challengeId: challenge.challengeId, pin: '123456' })).status, 200);
      assert.equal((await call('/auth/otp/verify', 'POST', { challengeId: challenge.challengeId, pin: '654321' })).status, 400);
      const expired = await db.otpChallenge.create({ data: { email: 'expired@example.test', expiresAt: new Date(0) } });
      assert.equal((await call('/auth/otp/verify', 'POST', { challengeId: expired.id, pin: '123456' })).status, 400);
      const foreignOrigin = await fetch(`${origin}/api/v1/auth/otp/request`, { method: 'POST', headers: { Origin: 'https://other.example', 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'test@example.test' }) });
      assert.equal(foreignOrigin.status, 403);
    });
    const first = await login('  First.Creator@Example.test  ');
    const second = await login('second@example.test');
    await t.test('serverless pre-parsed JSON is handled after its stream is consumed', async () => {
      const request = (body: unknown) => fetch(`${origin}/api/v1/auth/otp/request`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-test-parsed-body': 'true' }, body: JSON.stringify(body) });
      assert.equal((await request({ email: 'serverless@example.test' })).status, 200);
      assert.equal((await request({ email: 'invalid' })).status, 400);
      assert.equal((await request({ email: 'a'.repeat(25000) })).status, 413);
    });
    await t.test('image endpoint rejects guests and malformed input; demo sessions only get fallback', async () => {
      const input = { collection: 'FOLK_AND_FABLE', sceneNumber: 1, prompt: 'An acacia tree at sunset.' };
      assert.equal((await call('/images/keyframe', 'POST', input)).status, 401);
      assert.equal((await call('/images/keyframe', 'POST', { ...input, collection: 'ALL' }, first.token)).status, 400);
      const missing = await (await call('/images/keyframe', 'POST', input, first.token)).json();
      assert.equal(missing.provenance, 'Oralia illustrative placeholder; not AI generated');
      process.env.OPENAI_API_KEY = 'test-only-must-never-be-sent';
      try {
        const result = await (await call('/images/keyframe', 'POST', input, first.token)).json();
        assert.equal(result.fallbackReason, 'presentation-demo');
      } finally { delete process.env.OPENAI_API_KEY; }
      process.env.PRESENTATION_MODE = 'false';
      try { assert.equal((await call('/auth/otp/request', 'POST', { email: 'blocked@example.test' })).status, 403); }
      finally { process.env.PRESENTATION_MODE = 'true'; }
    });
    await t.test('persistent sessions map to database users and public profiles, not seeded identities', async () => {
      assert.equal(first.email, 'first.creator@example.test');
      assert.equal((await db.user.findUniqueOrThrow({ where: { id: first.id } })).role, 'CREATOR');
      assert.ok(!(await db.session.findFirstOrThrow({ where: { userId: first.id } })).id.includes(first.token));
      const restored = creatorSessionSchema.parse(await (await call('/auth/session', 'GET', undefined, first.token)).json());
      assert.equal(restored.username, first.username);
      const profile = await call(`/creators/${first.username}`);
      assert.equal(profile.status, 200);
      assert.ok(!JSON.stringify(await profile.json()).includes(first.email));
      assert.equal((await call('/auth/session')).status, 401);
    });
    await t.test('voice safeguard saves valid selections independently of narration generation', async () => {
      const original = creatorSessionSchema.parse(await (await call('/me/voice', 'PATCH', { voiceType: 'ORIGINAL' }, first.token)).json());
      assert.equal(original.preferredVoiceType, 'ORIGINAL');
      const studio = creatorSessionSchema.parse(await (await call('/me/voice', 'PATCH', { voiceType: 'STUDIO_AI' }, first.token)).json());
      assert.equal(studio.preferredVoiceType, 'STUDIO_AI');
      assert.equal((await db.user.findUniqueOrThrow({ where: { id: first.id } })).preferredVoiceType, 'STUDIO_AI');
      assert.equal((await call('/me/voice', 'PATCH', { voiceType: 'OTHER' }, first.token)).status, 400);
      assert.equal((await call('/me/voice', 'PATCH', { voiceType: 'ORIGINAL' })).status, 401);
    });
    await t.test('bookmarks are idempotent, account scoped, and preserved by a second seed', async () => {
      assert.equal((await call('/bookmarks')).status, 401);
      for (let index = 0; index < 2; index++) assert.equal((await call('/bookmarks/anansi-wisdom', 'PUT', undefined, first.token)).status, 200);
      assert.equal(await db.bookmark.count({ where: { userId: first.id } }), 1);
      assert.deepEqual(await (await call('/bookmarks', 'GET', undefined, second.token)).json(), { storyIds: [] });
      seed();
      assert.deepEqual(await (await call('/bookmarks', 'GET', undefined, first.token)).json(), { storyIds: ['anansi-wisdom'] });
      assert.equal(await db.story.count(), 8);
      assert.equal(await db.keyframeScene.count(), 32);
      assert.equal((await call('/bookmarks/no-story', 'PUT', undefined, first.token)).status, 404);
      assert.equal((await call('/bookmarks/anansi-wisdom', 'DELETE', undefined, first.token)).status, 200);
      assert.deepEqual(await (await call('/bookmarks', 'GET', undefined, first.token)).json(), { storyIds: [] });
    });
    await t.test('logout revokes server access', async () => {
      assert.equal((await call('/auth/logout', 'POST', undefined, first.token)).status, 200);
      assert.equal((await call('/auth/session', 'GET', undefined, first.token)).status, 401);
      await db.session.updateMany({ where: { userId: second.id }, data: { expiresAt: new Date(0) } });
      assert.equal((await call('/auth/session', 'GET', undefined, second.token)).status, 401);
    });
  } finally {
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    await db.$disconnect();
    for (const suffix of ['', '-shm', '-wal', '-journal']) await unlink(`${file}${suffix}`).catch(() => undefined);
  }
});
