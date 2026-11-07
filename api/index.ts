import type { IncomingMessage, ServerResponse } from 'node:http';
import { handleApi } from '../server/api.ts';

// Rewrites can present the function destination instead of the public API URL.
export default async function handler(request: IncomingMessage, response: ServerResponse) {
  const url = new URL(request.url || '/', 'http://localhost');
  if (url.pathname === '/api' || url.pathname === '/api/index') {
    const path = url.searchParams.get('__oralia_path');
    url.searchParams.delete('__oralia_path');
    if (path) url.pathname = `/api/${path}`;
    request.url = url.pathname + url.search;
  }
  await handleApi(request, response);
}
