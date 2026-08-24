import { createBrowserRouter } from 'react-router-dom';
import { LayoutUtama } from './LayoutUtama';
import { PenjagaOnboarding, PenjagaRute, PenjagaTamu } from './PenjagaRute';
import { HalamanMasuk } from '@/fitur/auth/HalamanMasuk';
import { HalamanDaftar } from '@/fitur/auth/HalamanDaftar';
import { HalamanLupaSandi } from '@/fitur/auth/HalamanLupaSandi';
import { HalamanResetSandi } from '@/fitur/auth/HalamanResetSandi';
import { HalamanOnboarding } from '@/fitur/onboarding/HalamanOnboarding';
import { HalamanBeranda } from '@/fitur/beranda/HalamanBeranda';
import { HalamanPelanggan } from '@/fitur/pelanggan/HalamanPelanggan';
import { HalamanTagihan } from '@/fitur/tagihan/HalamanTagihan';
import { HalamanLaporan } from '@/fitur/laporan/HalamanLaporan';

/**
 * Rute detail (pelanggan/:id, utang/:id, laporan, pengaturan) ditambahkan
 * pada tahapnya masing-masing — lihat PLAN.md bagian 4.3.
 */
export const router = createBrowserRouter([
  {
    element: <PenjagaTamu />,
    children: [
      { path: '/masuk', element: <HalamanMasuk /> },
      { path: '/daftar', element: <HalamanDaftar /> },
      { path: '/lupa-sandi', element: <HalamanLupaSandi /> },
    ],
  },
  // Reset sandi sengaja di luar PenjagaTamu: pengguna yang membuka tautan
  // dari email sudah memegang sesi pemulihan, sehingga penjaga tamu akan
  // melemparnya ke beranda sebelum sempat mengganti kata sandi.
  { path: '/reset-sandi', element: <HalamanResetSandi /> },
  {
    element: <PenjagaOnboarding />,
    children: [{ path: '/onboarding', element: <HalamanOnboarding /> }],
  },
  {
    element: <PenjagaRute />,
    children: [
      {
        path: '/',
        element: <LayoutUtama />,
        children: [
          { index: true, element: <HalamanBeranda /> },
          { path: 'pelanggan', element: <HalamanPelanggan /> },
          { path: 'tagihan', element: <HalamanTagihan /> },
          { path: 'laporan', element: <HalamanLaporan /> },
        ],
      },
    ],
  },
]);
