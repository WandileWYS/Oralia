import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { keyframeImageRequestSchema, keyframeImageResponseSchema } from '../src/types/images.ts';
import { fallbackImage, synthesizeKeyframe } from './images.ts';

const request = { collection: 'FOLK_AND_FABLE' as const, sceneNumber: 1, prompt: 'A traveler beneath an acacia tree.' };
test('image contract rejects invalid collection, prompt and scene bounds', () => {
  assert.equal(keyframeImageRequestSchema.safeParse(request).success, true);
  for (const input of [{ ...request, collection: 'ALL' }, { ...request, sceneNumber: 0 }, { ...request, sceneNumber: 5 }, { ...request, prompt: ' ' }, { ...request, prompt: 'x'.repeat(2001) }]) {
    assert.equal(keyframeImageRequestSchema.safeParse(input).success, false);
  }
});
test('both collections have four bundled, explicitly illustrative fallback visuals', async () => {
  for (const collection of ['FOLK_AND_FABLE', 'EPIC_AND_CHRONICLE'] as const) {
    for (let sceneNumber = 1; sceneNumber <= 4; sceneNumber++) {
      const result = keyframeImageResponseSchema.parse(fallbackImage({ ...request, collection, sceneNumber }));
      assert.match(await readFile('public' + result.imageUrl, 'utf8'), /<svg/);
      assert.match(result.provenance, /not AI generated/);
    }
  }
});
test('OpenAI adapter uses server credentials, timeout and validated PNG output', async () => {
  const png = Buffer.from([137,80,78,71,13,10,26,10]);
  const fakeFetch: typeof fetch = async (url, options) => {
    assert.equal(url, 'https://api.openai.com/v1/images/generations');
    assert.equal(new Headers(options?.headers).get('Authorization'), 'Bearer test-only');
    assert.ok(options?.signal);
    assert.equal(JSON.parse(String(options?.body)).model, 'configured-test-model');
    return Response.json({ data: [{ b64_json: png.toString('base64') }] });
  };
  const result = await synthesizeKeyframe(request, { env: { OPENAI_API_KEY: 'test-only', OPENAI_IMAGE_MODEL: 'configured-test-model' }, fetch: fakeFetch });
  assert.deepEqual(result.bytes, png);
  await assert.rejects(() => synthesizeKeyframe(request, { env: {}, fetch: fakeFetch }), /not configured/);
});
test('provider errors and malformed outputs are sanitized', async () => {
  for (const fakeFetch of [async () => Response.json({ error: 'private provider details' }, { status: 429 }), async () => Response.json({ data: [{ b64_json: 'invalid' }] }), async () => { throw new Error('Secret credential in driver error'); }]) {
    await assert.rejects(() => synthesizeKeyframe(request, { env: { OPENAI_API_KEY: 'test-only', OPENAI_IMAGE_MODEL: 'configured-test-model' }, fetch: fakeFetch }), error => error instanceof Error && error.message === 'Image generation is unavailable. Use the illustrative fallback.');
  }
});
