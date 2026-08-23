import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// Auf GitHub Pages liegt die App unter /<repo>/. Lokal (npm run dev) unter /.
// BASE_PATH wird im Deploy-Workflow gesetzt.
const base = process.env.BASE_PATH ?? '/'

// Damit man auf dem Gerät ablesen kann, welcher Bau dort läuft — nach einem
// Update behält die installierte App sonst stumm den alten Stand, und man rätselt,
// ob eine Änderung überhaupt angekommen ist. GITHUB_SHA setzt Actions von selbst.
const buildStamp = [
  new Date().toISOString().slice(0, 10),
  (process.env.GITHUB_SHA ?? 'lokal').slice(0, 7),
].join(' · ')

export default defineConfig({
  base,
  define: {
    __BUILD_STAMP__: JSON.stringify(buildStamp),
  },
  build: {
    // Das Firebase-Bündel liegt naturgemäß über der Standardschwelle von 500 kB.
    // Es wird einmal geladen und bleibt dann im Cache — das ist in Ordnung.
    chunkSizeWarningLimit: 700,
    rolldownOptions: {
      output: {
        advancedChunks: {
          groups: [
            // Firebase ist der mit Abstand größte Brocken und ändert sich fast
            // nie. Als eigenes Bündel bleibt es im Cache liegen, wenn wir an
            // der App etwas ändern — Updates laden dann nur ein paar Kilobyte.
            { name: 'firebase', test: /node_modules[\\/]@?firebase/ },
          ],
        },
      },
    },
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: [
        'favicon.svg',
        'icon-192.png',
        'icon-512.png',
        'icon-maskable.png',
      ],
      manifest: {
        name: 'Rezeptbuch & Essensplan',
        short_name: 'Rezeptbuch',
        description: 'Rezepte, Essensplan und Einkaufsliste für zwei.',
        lang: 'de',
        // Passend zur hellen Fassung: Kopfzeile ist `surface`, Grund `canvas`.
        // Im Dunkelmodus setzt src/lib/theme.ts die Leiste zur Laufzeit um.
        theme_color: '#ffffff',
        background_color: '#f6f4f0',
        display: 'standalone',
        orientation: 'portrait',
        start_url: base,
        scope: base,
        icons: [
          // 192 trägt die vereinfachte Zeichnung: In dieser Größe laufen die
          // feinen Goldlinien und die drei Klingen sonst ineinander.
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          // Eigene Datei fürs maskierbare Symbol: Android legt eine beliebige
          // Form darüber, deshalb randlos und mit kleinerem Zeichen. Das
          // 512er-Symbol hier zu wiederholen würde die Klingen anschneiden.
          {
            src: 'icon-maskable.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        // Firestore verwaltet seinen eigenen Offline-Cache — der Service Worker
        // darf dessen Netzwerkverkehr nicht abfangen.
        navigateFallbackDenylist: [/^\/__/, /firestore\.googleapis\.com/],
      },
    }),
  ],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
  },
})
