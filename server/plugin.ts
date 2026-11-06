import type { Plugin } from 'vite';
import { handleApi } from './api.ts';

export function databaseApi(): Plugin {
  const attach = (server: { middlewares: { use: (handler: (request: import('node:http').IncomingMessage, response: import('node:http').ServerResponse, next: () => void) => void) => void } }) => {
    server.middlewares.use((request, response, next) => {
      if (request.url?.startsWith('/api/v1/')) void handleApi(request, response);
      else next();
    });
  };
  return { name: 'oralia-database-api', configureServer: attach, configurePreviewServer: attach };
}
