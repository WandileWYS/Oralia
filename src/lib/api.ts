import { z } from 'zod';
import { bookmarksSchema, catalogSchema, challengeSchema, okSchema } from '../types/api';
import { creatorSessionSchema, type CreatorSession } from '../types/creator';

export const sessionStorageKey = 'oralia-creator-session';
// The credential boundary retains a session only when browser persistence is blocked.
let volatileSession: CreatorSession | null | undefined;
export function persistSession(value: CreatorSession | null) {
  volatileSession = value;
  try {
    if (value) localStorage.setItem(sessionStorageKey, JSON.stringify(value));
    else localStorage.removeItem(sessionStorageKey);
    volatileSession = undefined;
    return true;
  } catch { return false; }
}
export function readSession() {
  if (volatileSession !== undefined) return volatileSession && Date.parse(volatileSession.expiresAt) > Date.now() ? volatileSession : null;
  try {
    const result = creatorSessionSchema.safeParse(JSON.parse(localStorage.getItem(sessionStorageKey) || 'null'));
    return result.success && Date.parse(result.data.expiresAt) > Date.now() ? result.data : null;
  } catch { return null; }
}
export async function request<T>(path: string, schema: z.ZodType<T>, options: RequestInit = {}): Promise<T> {
  const session = readSession();
  const response = await fetch(`/api/v1${path}`, { ...options, headers: { 'Content-Type': 'application/json', ...(session ? { Authorization: `Bearer ${session.token}` } : {}), ...options.headers } });
  const data: unknown = await response.json();
  if (!response.ok) {
    const error = z.object({ error: z.string() }).safeParse(data);
    throw new Error(error.success ? error.data.error : 'The request could not be completed.');
  }
  return schema.parse(data);
}
export const api = {
  catalog: (signal?: AbortSignal) => request('/catalog', catalogSchema, { signal }),
  requestPin: (email: string) => request('/auth/otp/request', challengeSchema, { method: 'POST', body: JSON.stringify({ email }) }),
  verifyPin: (challengeId: string, pin: string) => request('/auth/otp/verify', creatorSessionSchema, { method: 'POST', body: JSON.stringify({ challengeId, pin }) }),
  session: () => request('/auth/session', creatorSessionSchema),
  logout: () => request('/auth/logout', okSchema, { method: 'POST' }),
  voice: (voiceType: 'ORIGINAL' | 'STUDIO_AI') => request('/me/voice', creatorSessionSchema, { method: 'PATCH', body: JSON.stringify({ voiceType }) }),
  bookmarks: () => request('/bookmarks', bookmarksSchema),
  bookmark: (storyId: string, saved: boolean) => request(`/bookmarks/${encodeURIComponent(storyId)}`, okSchema, { method: saved ? 'PUT' : 'DELETE' }),
};
