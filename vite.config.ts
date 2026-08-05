import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  /*
   * Auf GitHub Pages liegt die App unter /<repo>/, lokal unter /.
   * Der Workflow setzt VITE_BASE entsprechend.
   */
  base: process.env.VITE_BASE ?? '/',
  build: {
    /*
     * Firebase (Firestore mit Offline-Puffer plus Auth) macht den Großteil des
     * Bündels aus. Bewusst in einem Stück gelassen: das hält den Einzeldatei-Build
     * möglich, und nach dem ersten Besuch liegt alles im Browser-Cache.
     */
    chunkSizeWarningLimit: 1000,
  },
});
