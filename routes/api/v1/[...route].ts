import { defineHandler } from 'nitro/h3';
import { fetchNodeHandler } from 'srvx/node';
import { handleApi } from '../../../server/api.ts';

// Keep the existing HTTP contract behind the Fetch adapter used by Nitro's Vercel entry.
// This also works when a local Node request/response pair is already available.
export default defineHandler(event=>fetchNodeHandler(handleApi,event.req));
