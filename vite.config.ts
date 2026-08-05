import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      /*
       * Ohne Service Worker lädt die App ohne Netz gar nicht erst – die Daten
       * liegen zwar dank Firestore lokal, aber das Programm selbst käme vom
       * Server. Genau im Laden ohne Empfang wäre der Planer damit nutzlos.
       *
       * "prompt" statt automatischer Aktualisierung: eine neue Fassung soll
       * nicht mitten im Einkauf unter den Fingern ausgetauscht werden.
       */
      registerType: 'prompt',
      manifest: false, // liegt handgeschrieben unter public/
      includeAssets: ['icon.svg', 'icon-192.png', 'icon-512.png', 'apple-touch-icon.png'],
      workbox: {
        // Der Bündel liegt über dem Vorgabewert von 2 MB.
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        globPatterns: ['**/*.{js,css,html,svg,png,webmanifest}'],
        // Aufrufe an Firebase gehören nie in den Cache: veraltete Antworten
        // wären schlimmer als eine ehrliche Fehlermeldung.
        navigateFallbackDenylist: [/^\/api/],
        runtimeCaching: [],
      },
      devOptions: {
        // Im Entwicklungsbetrieb stört ein Service Worker mehr, als er nützt.
        enabled: false,
      },
    }),
  ],
  /*
   * Auf GitHub Pages liegt die App unter /<repo>/, lokal unter /.
   * Der Workflow setzt VITE_BASE entsprechend.
   */
  base: process.env.VITE_BASE ?? '/',
  build: {
    /*
     * Firebase (Firestore mit Offline-Puffer plus Auth) macht den Großteil des
     * Bündels aus. Bewusst in einem Stück gelassen: das hält den Einzeldatei-Build
     * möglich, und der Service Worker legt alles beim ersten Besuch dauerhaft ab.
     */
    chunkSizeWarningLimit: 1000,
  },
});
