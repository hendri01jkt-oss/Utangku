import { createBrowserRouter } from 'react-router-dom';
import { LayoutUtama } from './LayoutUtama';
import { HalamanBeranda } from '@/fitur/beranda/HalamanBeranda';
import { HalamanPelanggan } from '@/fitur/pelanggan/HalamanPelanggan';
import { HalamanTagihan } from '@/fitur/tagihan/HalamanTagihan';
import { HalamanLaporan } from '@/fitur/laporan/HalamanLaporan';

/**
 * Rute Tahap 0 baru mencakup empat tab utama. Rute auth, onboarding,
 * dan detail ditambahkan pada tahapnya masing-masing (lihat PLAN.md 4.3).
 */
export const router = createBrowserRouter([
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
]);
