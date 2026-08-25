/*
 * Berkas ini memang mencampur definisi komponen dengan objek router, yang
 * membuat fast refresh tidak bekerja untuknya. Itu wajar untuk satu berkas
 * rute: isinya jarang diubah, dan memecahnya jadi dua berkas hanya untuk
 * menyenangkan aturan lint akan membuat peta rutenya lebih sulit dibaca.
 */
/* eslint-disable react/only-export-components */
import { lazy, Suspense, type ReactNode } from 'react';
import { createBrowserRouter, type RouteObject } from 'react-router-dom';
import { HalamanTidakDitemukan } from './HalamanTidakDitemukan';
import { LayoutUtama } from './LayoutUtama';
import { Memuat, PenjagaOnboarding, PenjagaRute, PenjagaTamu } from './PenjagaRute';
import { HalamanMasuk } from '@/fitur/auth/HalamanMasuk';
import { HalamanBeranda } from '@/fitur/beranda/HalamanBeranda';

/*
 * Halaman masuk dan beranda dimuat di awal karena satu di antaranya PASTI
 * jadi layar pertama. Sisanya dimuat saat benar-benar dibuka — sebagian
 * besar pembukaan aplikasi hanya mencatat utang lalu ditutup lagi, dan
 * tidak perlu ikut mengunduh halaman laporan beserta pustaka ekspornya.
 */
const HalamanDaftar = lazy(() =>
  import('@/fitur/auth/HalamanDaftar').then((m) => ({ default: m.HalamanDaftar })),
);
const HalamanLupaSandi = lazy(() =>
  import('@/fitur/auth/HalamanLupaSandi').then((m) => ({ default: m.HalamanLupaSandi })),
);
const HalamanResetSandi = lazy(() =>
  import('@/fitur/auth/HalamanResetSandi').then((m) => ({ default: m.HalamanResetSandi })),
);
const HalamanOnboarding = lazy(() =>
  import('@/fitur/onboarding/HalamanOnboarding').then((m) => ({
    default: m.HalamanOnboarding,
  })),
);
const HalamanPelanggan = lazy(() =>
  import('@/fitur/pelanggan/HalamanPelanggan').then((m) => ({ default: m.HalamanPelanggan })),
);
const HalamanDetailPelanggan = lazy(() =>
  import('@/fitur/pelanggan/HalamanDetailPelanggan').then((m) => ({
    default: m.HalamanDetailPelanggan,
  })),
);
const FormPelanggan = lazy(() =>
  import('@/fitur/pelanggan/FormPelanggan').then((m) => ({ default: m.FormPelanggan })),
);
const FormUtang = lazy(() =>
  import('@/fitur/utang/FormUtang').then((m) => ({ default: m.FormUtang })),
);
const HalamanDetailUtang = lazy(() =>
  import('@/fitur/utang/HalamanDetailUtang').then((m) => ({ default: m.HalamanDetailUtang })),
);
const HalamanTagihan = lazy(() =>
  import('@/fitur/tagihan/HalamanTagihan').then((m) => ({ default: m.HalamanTagihan })),
);
const HalamanLaporan = lazy(() =>
  import('@/fitur/laporan/HalamanLaporan').then((m) => ({ default: m.HalamanLaporan })),
);
const HalamanPengaturan = lazy(() =>
  import('@/fitur/pengaturan/HalamanPengaturan').then((m) => ({
    default: m.HalamanPengaturan,
  })),
);

const tunggu = (isi: ReactNode) => <Suspense fallback={<Memuat />}>{isi}</Suspense>;

/**
 * Rute detail dan panel digambar di atas halaman induknya, jadi beberapa
 * alamat sengaja memakai elemen yang sama.
 */
const rute: RouteObject[] = [
  {
    element: <PenjagaTamu />,
    children: [
      { path: '/masuk', element: <HalamanMasuk /> },
      { path: '/daftar', element: tunggu(<HalamanDaftar />) },
      { path: '/lupa-sandi', element: tunggu(<HalamanLupaSandi />) },
    ],
  },
  // Reset sandi sengaja di luar PenjagaTamu: pengguna yang membuka tautan
  // dari email sudah memegang sesi pemulihan dan akan terlempar ke beranda
  // sebelum sempat mengganti kata sandinya.
  { path: '/reset-sandi', element: tunggu(<HalamanResetSandi />) },
  {
    element: <PenjagaOnboarding />,
    children: [{ path: '/onboarding', element: tunggu(<HalamanOnboarding />) }],
  },
  {
    element: <PenjagaRute />,
    children: [
      {
        path: '/',
        element: <LayoutUtama />,
        children: [
          { index: true, element: <HalamanBeranda /> },
          { path: 'pelanggan', element: tunggu(<HalamanPelanggan />) },
          { path: 'pelanggan/baru', element: tunggu(<FormPelanggan mode="baru" />) },
          { path: 'pelanggan/:id', element: tunggu(<HalamanDetailPelanggan />) },
          { path: 'pelanggan/:id/bayar', element: tunggu(<HalamanDetailPelanggan />) },
          { path: 'pelanggan/:id/ubah', element: tunggu(<FormPelanggan mode="ubah" />) },
          { path: 'utang/baru', element: tunggu(<FormUtang mode="baru" />) },
          { path: 'utang/:id', element: tunggu(<HalamanDetailUtang />) },
          { path: 'utang/:id/bayar', element: tunggu(<HalamanDetailUtang />) },
          { path: 'utang/:id/ubah', element: tunggu(<FormUtang mode="ubah" />) },
          { path: 'tagihan', element: tunggu(<HalamanTagihan />) },
          { path: 'laporan', element: tunggu(<HalamanLaporan />) },
          { path: 'pengaturan', element: tunggu(<HalamanPengaturan />) },
          /*
           * Penampung alamat asing. Diletakkan DI DALAM penjaga rute supaya
           * pengunjung yang belum masuk tetap diarahkan ke /masuk, bukan
           * disuguhi halaman 404 lalu bingung harus ke mana. Tidak dimuat
           * malas: halaman ini justru dibutuhkan saat ada yang sudah salah,
           * jadi ia tidak boleh bergantung pada unduhan tambahan.
           */
          { path: '*', element: <HalamanTidakDitemukan /> },
        ],
      },
    ],
  },
];

/*
 * basename mengikuti awalan tempat aplikasi disajikan.
 *
 * Di Netlify BASE_URL adalah "/" dan ini tidak berpengaruh apa-apa. Di
 * GitHub Pages nilainya "/Utangku/", dan tanpa basename setiap rute akan
 * dicocokkan terhadap alamat lengkap termasuk nama repo — router tidak akan
 * mengenali satu pun, lalu seluruh aplikasi jatuh ke halaman 404 sendiri.
 */
export const router = createBrowserRouter(rute, { basename: import.meta.env.BASE_URL });
