import type { IncomingMessage, ServerResponse } from 'node:http';
import { handleApi } from '../server/api.ts';

// Catch-all Node routing retains the original /api/v1 path and streaming body.
export default async function handler(request: IncomingMessage, response: ServerResponse) {
  await handleApi(request, response);
}
