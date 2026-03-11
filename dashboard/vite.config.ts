/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

export default defineConfig({
  plugins: [react()],
  base: './',
  test: {
    environment: 'happy-dom',
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks: {
          antd: ['antd', '@ant-design/icons'],
          markdown: ['react-markdown', 'remark-gfm'],
          shiki: ['shiki'],
        },
      },
    },
  },
  server: {
    port: 5174,
    proxy: {
      '/ws': {
        target: 'ws://127.0.0.1:18789',
        ws: true,
      },
      '/socket.io': {
        target: 'http://127.0.0.1:18789',
      },
    },
  },
});
