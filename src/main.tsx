import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';

/*
 * Halaman pantau dipisahkan DI TITIK MASUK, bukan sekadar sebagai rute.
 *
 * Yang membukanya adalah pelanggan: tidak punya akun, tidak memasang
 * aplikasinya, sering bersinyal seadanya, dan datang hanya untuk melihat
 * satu angka. Kalau ia cuma jadi rute di dalam App, seluruh cabang impor
 * aplikasi ikut terunduh — supabase-js, Dexie, mesin sync, store sesi —
 * karena App mengimpor semua itu secara statis. Mematikan PEMANGGILANNYA
 * saja tidak menghapus satu byte pun dari unduhan.
 *
 * Diukur: sebagai rute biasa, membuka halaman ini mengunduh 481 kB lewat 11
 * berkas JS. Dipisahkan di sini, yang terunduh tinggal React, halamannya
 * sendiri, dan beberapa penolong kecil.
 *
 * Konsekuensinya halaman pantau tidak memakai react-router sama sekali;
 * tokennya diambil langsung dari alamat.
 */
const polaPantau = new RegExp(`^${import.meta.env.BASE_URL}pantau/([^/?#]+)`);
const cocok = polaPantau.exec(window.location.pathname);

const akar = createRoot(document.getElementById('root')!);

if (cocok?.[1]) {
  const token = decodeURIComponent(cocok[1]);
  void import('./fitur/pantau/HalamanPantau').then(({ HalamanPantau }) => {
    akar.render(
      <StrictMode>
        <HalamanPantau token={token} />
      </StrictMode>,
    );
  });
} else {
  if (import.meta.env.DEV) {
    void import('./data/dev').then((m) => m.pasangSeamDev());
  }
  void import('./App.tsx').then(({ default: App }) => {
    akar.render(
      <StrictMode>
        <App />
      </StrictMode>,
    );
  });
}
