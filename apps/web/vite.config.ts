import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      '/api': 'http://localhost:8080',
      '/socket': {
        target: 'ws://localhost:4000',
        ws: true,
      },
      '/voice-ws': {
        target: 'ws://localhost:4443',
        ws: true,
        rewrite: (p) => p.replace(/^\/voice-ws/, ''),
      },
      '/voice-api': {
        target: 'http://localhost:4444',
        rewrite: (p) => p.replace(/^\/voice-api/, ''),
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
