import { test } from 'node:test';
import assert from 'node:assert/strict';
import { request } from './api.ts';
import { okSchema } from '../types/api.ts';

test('API client reports routing failures clearly rather than parsing HTML as JSON', async () => {
  const original = globalThis.fetch;
  try {
    for (const type of ['text/html', 'text/plain']) {
      globalThis.fetch = async () => new Response('The page could not be found', { status: 404, headers: { 'Content-Type': type } });
      await assert.rejects(() => request('/health', okSchema), /non-JSON response \(HTTP 404\)/);
    }
    globalThis.fetch = async () => Response.json({ ok: true });
    assert.deepEqual(await request('/health', okSchema), { ok: true });
    globalThis.fetch = async () => Response.json({ error: 'API route not found.' }, { status: 404 });
    await assert.rejects(() => request('/missing', okSchema), /API route not found/);
  } finally { globalThis.fetch = original; }
});
