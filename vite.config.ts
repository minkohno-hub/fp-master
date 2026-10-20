/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  base: '/fp-master/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      injectRegister: false,
      includeManifestIcons: false,
      manifest: {
        id: '/fp-master/',
        name: 'FP Master',
        short_name: 'FP Master',
        description: 'FP2級・3級の学習と復習を支える個人学習アプリ',
        lang: 'ja',
        start_url: '/fp-master/',
        scope: '/fp-master/',
        display: 'standalone',
        background_color: '#f6f8f7',
        theme_color: '#153f39',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
        navigateFallback: '/fp-master/index.html',
        navigateFallbackAllowlist: [/^\/fp-master\/(?!assets\/|icons\/)/],
        cleanupOutdatedCaches: true,
        // Keep a newly downloaded version waiting until the user closes existing tabs.
        // Never reload an active learning session or touch IndexedDB during updates.
        skipWaiting: false,
        clientsClaim: false,
      },
      devOptions: { enabled: false },
    }),
  ],
  test: {
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    restoreMocks: true,
    exclude: ['e2e/**', 'node_modules/**', 'dist/**'],
  },
});
