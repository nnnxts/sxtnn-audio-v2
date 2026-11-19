import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// En développement : Vite (port 5173) redirige /api et /media vers le serveur Express (port 3000).
// En production : Express sert directement le dossier dist/ sur un seul port.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3000',
      '/media': 'http://localhost:3000',
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    chunkSizeWarningLimit: 900,
  },
});
