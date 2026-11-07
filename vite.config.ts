import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { nitro } from 'nitro/vite';
import { workflow } from 'workflow/vite';
import { materializeWindowsBuildLinks } from './scripts/windows-build-links.ts';

export default defineConfig(({command})=>({
  server:{port:5173,strictPort:true},
  plugins:[react(),nitro(),workflow({runtime:'nodejs24.x',dashboard:false,sourcemap:false,dirs:['workflows']})],
  nitro:{serverDir:'./',preset:command==='serve'?'node':'vercel',vercel:{entryFormat:'web',functions:{maxDuration:300,runtime:'nodejs24.x'}},traceOpts:{hooks:{tracedLayout:()=>materializeWindowsBuildLinks('.vercel/output/functions/__server.func/node_modules')}}},
}));
