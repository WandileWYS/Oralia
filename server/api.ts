import type { IncomingMessage, ServerResponse } from 'node:http';
import { randomBytes, createHash } from 'node:crypto';
import { stat } from 'node:fs/promises';
import { resolve, sep } from 'node:path';
import { z } from 'zod';
import { db } from './db.ts';
import { readCatalog } from './catalog.ts';
import { creatorEmailSchema } from '../src/types/creator.ts';

class HttpError extends Error { status: number; constructor(status: number, message: string) { super(message); this.status = status; } }
function send(response: ServerResponse, status: number, value: unknown) {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
  response.end(JSON.stringify(value));
}
async function body(request: IncomingMessage): Promise<unknown> {
  let text = '';
  for await (const chunk of request) {
    text += String(chunk);
    if (Buffer.byteLength(text) > 24576) throw new HttpError(413, 'Request is too large.');
  }
  try { return JSON.parse(text); } catch { throw new HttpError(400, 'Send valid JSON.'); }
}
const hash = (token: string) => createHash('sha256').update(token).digest('hex');
async function authorized(request: IncomingMessage) {
  const token = request.headers.authorization?.replace(/^Bearer /, '');
  const session = token ? await db.session.findUnique({ where: { id: hash(token) }, include: { user: true } }) : null;
  if (!session || session.expiresAt.getTime() <= Date.now()) throw new HttpError(401, 'Your session has ended. Sign in again.');
  return { session, token: token! };
}
function sessionData(user: { id: string; name: string; username: string; email: string; avatarUrl: string; preferredVoiceType: string }, token: string, expiresAt: Date) {
  return { kind: 'simulated-otp', id: user.id, displayName: user.name, username: user.username, email: user.email, avatarUrl: user.avatarUrl, token, expiresAt: expiresAt.toISOString(), preferredVoiceType: user.preferredVoiceType };
}

export async function handleApi(request: IncomingMessage, response: ServerResponse) {
  try {
    const url = new URL(request.url || '/', 'http://localhost');
    const route = url.pathname.replace(/^\/api\/v1/, '');
    const method = request.method;
    if (method !== 'GET' && request.headers.origin && new URL(request.headers.origin).host !== request.headers.host) throw new HttpError(403, 'Use this application’s origin.');
    if (method === 'GET' && route === '/health') { await db.story.count(); return send(response, 200, { ok: true }); }
    if (method === 'GET' && route === '/catalog') return send(response, 200, await readCatalog());
    if (method === 'GET' && (route.startsWith('/stories/') || route.startsWith('/creators/'))) {
      const data = await readCatalog();
      const key = decodeURIComponent(route.split('/')[2]);
      const value = route.startsWith('/stories/') ? data.stories.find(story => story.id === key) : data.creators.find(creator => creator.username === key);
      if (!value) throw new HttpError(404, 'This story or creator was not found.');
      return send(response, 200, value);
    }
    if (method === 'GET' && route === '/media-status') {
      const mediaRoot = resolve('public/media');
      const input = url.searchParams.get('url') || '';
      const target = resolve('public', `.${input}`);
      let available = false;
      if (input.startsWith('/media/') && target.startsWith(mediaRoot + sep)) {
        try { available = (await stat(target)).isFile(); } catch { /* Missing media is reported as data, not an audio request failure. */ }
      }
      return send(response, 200, { available });
    }
    if (method === 'POST' && route === '/auth/otp/request') {
      const { email } = z.object({ email: creatorEmailSchema }).parse(await body(request));
      if (email.endsWith('@collections.oralia.invalid')) throw new HttpError(409, 'Collection addresses are reserved. Use your own creator email.');
      const record = await db.otpChallenge.create({ data: { email, expiresAt: new Date(Date.now() + 5 * 60000) } });
      return send(response, 200, { challengeId: record.id, expiresAt: record.expiresAt.toISOString(), simulated: true });
    }
    if (method === 'POST' && route === '/auth/otp/verify') {
      const { challengeId, pin } = z.object({ challengeId: z.string(), pin: z.string().regex(/^\d{6}$/) }).parse(await body(request));
      void pin; // The requested local simulator accepts every six-digit PIN.
      const token = randomBytes(32).toString('hex');
      const result = await db.$transaction(async tx => {
        const challenge = await tx.otpChallenge.findUnique({ where: { id: challengeId } });
        if (!challenge || challenge.used || challenge.expiresAt.getTime() <= Date.now()) throw new HttpError(400, 'This PIN session expired. Request a new PIN.');
        const consumed = await tx.otpChallenge.updateMany({ where: { id: challengeId, used: false }, data: { used: true } });
        if (consumed.count !== 1) throw new HttpError(400, 'This PIN session has already been used.');
        let user = await tx.user.findUnique({ where: { email: challenge.email } });
        if (!user) {
          const prefix = challenge.email.split('@')[0].toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 18) || 'creator';
          const username = `${prefix}_${randomBytes(3).toString('hex')}`;
          user = await tx.user.create({ data: { email: challenge.email, username, name: prefix, bio: 'Creator on Oralia. This profile is ready for its first published story.', avatarUrl: '/favicon.svg', role: 'CREATOR' } });
        } else if (user.role !== 'CREATOR') user = await tx.user.update({ where: { id: user.id }, data: { role: 'CREATOR' } });
        const session = await tx.session.create({ data: { id: hash(token), userId: user.id, expiresAt: new Date(Date.now() + 7 * 86400000) } });
        return sessionData(user, token, session.expiresAt);
      });
      return send(response, 200, result);
    }
    if (method === 'GET' && route === '/auth/session') {
      const { session, token } = await authorized(request);
      return send(response, 200, sessionData(session.user, token, session.expiresAt));
    }
    if (method === 'POST' && route === '/auth/logout') {
      const { session } = await authorized(request);
      await db.session.delete({ where: { id: session.id } });
      return send(response, 200, { ok: true });
    }
    if (method === 'PATCH' && route === '/me/voice') {
      const { session, token } = await authorized(request);
      const { voiceType } = z.object({ voiceType: z.enum(['ORIGINAL', 'STUDIO_AI']) }).parse(await body(request));
      const user = await db.user.update({ where: { id: session.userId }, data: { preferredVoiceType: voiceType } });
      return send(response, 200, sessionData(user, token, session.expiresAt));
    }
    if (route === '/bookmarks' && method === 'GET') {
      const { session } = await authorized(request);
      const bookmarks = await db.bookmark.findMany({ where: { userId: session.userId } });
      return send(response, 200, { storyIds: bookmarks.map(bookmark => bookmark.storyId) });
    }
    if (route.startsWith('/bookmarks/') && (method === 'PUT' || method === 'DELETE')) {
      const { session } = await authorized(request);
      const storyId = decodeURIComponent(route.split('/')[2]);
      if (!await db.story.findUnique({ where: { id: storyId } })) throw new HttpError(404, 'Story not found.');
      const pair = { userId: session.userId, storyId };
      if (method === 'PUT') await db.bookmark.upsert({ where: { userId_storyId: pair }, create: pair, update: {} });
      else await db.bookmark.deleteMany({ where: pair });
      return send(response, 200, { ok: true });
    }
    throw new HttpError(404, 'API route not found.');
  } catch (error) {
    const status = error instanceof HttpError ? error.status : error instanceof z.ZodError ? 400 : 503;
    const message = error instanceof HttpError ? error.message : error instanceof z.ZodError ? 'Check your request values.' : 'The database is unavailable. Run the database setup and retry.';
    send(response, status, { error: message });
  }
}
