import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

/*
 * Awalan alamat tempat aplikasi disajikan.
 *
 * Netlify melayani dari akar domain, jadi "/" adalah bawaannya. GitHub Pages
 * melayani dari subpath nama repo (mis. "/Utangku/"), dan nilai itu diisi
 * oleh workflow lewat BASE_PATH — diambil dari nama repo yang sebenarnya,
 * bukan ditulis tangan, supaya tidak pernah melenceng kalau repo berganti
 * nama.
 *
 * Nilai ini merembes ke banyak tempat: alamat aset, basename React Router,
 * start_url manifest, dan navigateFallback service worker. Salah satu saja
 * tertinggal di "/" akan membuat aplikasi tampak kosong di subpath.
 */
const base = process.env.BASE_PATH ?? '/';

export default defineConfig({
  base,
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'UtangKu — Catatan Utang Warung',
        short_name: 'UtangKu',
        description:
          'Catatan utang pelanggan untuk warung, warteg, dan warkop. Tetap jalan tanpa sinyal.',
        lang: 'id',
        start_url: base,
        scope: base,
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#ffffff',
        theme_color: '#c62828',
        icons: [
          { src: 'ikon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'ikon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'ikon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // App shell di-precache seluruhnya supaya pembukaan pertama setelah
        // dipasang tidak butuh jaringan sama sekali.
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        navigateFallback: `${base}index.html`,
        // Chunk ekspor jauh lebih besar dari sisanya dan jarang dipakai.
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        runtimeCaching: [
          {
            // Permintaan ke Supabase TIDAK pernah di-cache service worker.
            // Kesegaran datanya diurus mesin sync lewat Dexie, dan respons
            // basah dari cache justru akan menabrak penanda sinkronisasi.
            urlPattern: ({ url }) => url.hostname.endsWith('.supabase.co'),
            handler: 'NetworkOnly',
          },
        ],
      },
      devOptions: { enabled: false },
    }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  build: {
    rollupOptions: {
      output: {
        /*
         * Memisahkan pustaka besar dari kode aplikasi.
         *
         * Selain memperkecil unduhan awal, ini membuat cache browser jauh
         * lebih berguna: memperbaiki satu tombol tidak lagi membatalkan
         * cache React dan Supabase sekaligus — hal yang terasa betul di
         * koneksi lambat.
         */
        manualChunks(id: string) {
          if (!id.includes('node_modules')) return undefined;
          if (/[\\/]node_modules[\\/](react|react-dom|scheduler|react-router)/.test(id)) {
            return 'react';
          }
          if (id.includes('@supabase')) return 'supabase';
          /*
           * Dexie dan zustand SENGAJA tidak lagi dikelompokkan sendiri.
           *
           * Dulu keduanya dipaksa ke chunk 'data', dan rolldown ikut
           * menaruh runtime JSX di sana — sehingga chunk itu menjadi
           * kebutuhan statis titik masuk dan ter-modulepreload dari
           * index.html. Akibatnya halaman pantau, yang tidak menyentuh
           * basis data sama sekali, tetap mengunduh 104 kB Dexie di kuota
           * pelanggan. Dibiarkan mengikuti pemakainya, keduanya hanya
           * terunduh oleh halaman yang benar-benar memakainya.
           */
          return undefined;
        },
      },
    },
  },
});
