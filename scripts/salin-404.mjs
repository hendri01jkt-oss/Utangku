/**
 * Menyalin dist/index.html menjadi dist/404.html untuk GitHub Pages.
 *
 * GitHub Pages hanya menyajikan berkas statis — tidak ada aturan rewrite
 * seperti _redirects di Netlify. Yang ada hanyalah satu kesepakatan: kalau
 * sebuah alamat tidak punya berkas, Pages menyajikan 404.html. Dengan
 * mengisinya memakai index.html yang sama, alamat seperti /pelanggan/123
 * tetap memuat aplikasi, lalu React Router membaca alamat aslinya dari
 * address bar dan menggambar halaman yang benar.
 *
 * Bedanya dengan Netlify: respons tetap berstatus 404, bukan 200. Browser
 * tidak peduli — JavaScript-nya tetap dijalankan — tapi status itu ikut
 * terlihat di tab Network, dan mesin pencari akan menganggap halaman
 * tersebut tidak ada. Untuk aplikasi di balik layar masuk, itu tidak jadi
 * soal.
 *
 * Dijalankan setelah `vite build`, jadi 404.html tidak ikut masuk daftar
 * precache service worker — dan memang tidak perlu: saat offline, navigasi
 * ditangani navigateFallback yang sudah menunjuk ke index.html.
 */
import { copyFile, access } from 'node:fs/promises';
import { join } from 'node:path';

const dist = join(process.cwd(), 'dist');
const sumber = join(dist, 'index.html');

try {
  await access(sumber);
} catch {
  console.error('Gagal: dist/index.html tidak ada. Jalankan `npm run build` dulu.');
  process.exit(1);
}

await copyFile(sumber, join(dist, '404.html'));
console.log('404.html disalin dari index.html (fallback SPA GitHub Pages).');
