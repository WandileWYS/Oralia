import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { databaseApi } from './server/plugin.ts';

export default defineConfig({ plugins: [react(), databaseApi()] });
