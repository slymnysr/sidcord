import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        // Sabit bağımlılıkları ayrı 'vendor' chunk'larına al (tarayıcı önbelleği için)
        manualChunks(id) {
          if (id.includes('node_modules')) {
            // Lazy yüklenen büyük veriler vendor'a GİRMESİN — kendi dynamic chunk'larında kalsınlar
            if (id.includes('unicode-emoji-json') || id.includes('@mediapipe') || id.includes('web-noise-suppressor')) return undefined;
            if (id.includes('mediasoup-client')) return 'vendor-voice';
            if (id.includes('/react') || id.includes('redux') || id.includes('@reduxjs') || id.includes('scheduler')) return 'vendor-react';
            return 'vendor';
          }
        },
      },
    },
  },
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
