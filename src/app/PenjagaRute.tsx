import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useSesi } from '@/fitur/auth/useSesi';

function Memuat() {
  return (
    <div className="flex min-h-dvh items-center justify-center" role="status">
      <Loader2 size={28} className="animate-spin text-gold-400" aria-hidden />
      <span className="sr-only">Memuat…</span>
    </div>
  );
}

/**
 * Rute yang butuh sesi DAN warung. Tiga kemungkinan pengalihan:
 *   belum masuk        -> /masuk (jalur asal disimpan agar bisa kembali)
 *   masuk, tanpa warung-> /onboarding
 *   siap               -> tampilkan aplikasi
 */
export function PenjagaRute() {
  const status = useSesi((s) => s.status);
  const lokasi = useLocation();

  if (status === 'memuat') return <Memuat />;
  if (status === 'tamu') {
    return <Navigate to="/masuk" replace state={{ dari: lokasi.pathname }} />;
  }
  if (status === 'perlu_onboarding') return <Navigate to="/onboarding" replace />;
  return <Outlet />;
}

/**
 * Rute untuk yang belum masuk (masuk, daftar, lupa sandi).
 * Pengguna yang sudah siap tidak boleh terjebak di halaman ini.
 */
export function PenjagaTamu() {
  const status = useSesi((s) => s.status);

  if (status === 'memuat') return <Memuat />;
  if (status === 'siap') return <Navigate to="/" replace />;
  if (status === 'perlu_onboarding') return <Navigate to="/onboarding" replace />;
  return <Outlet />;
}

/**
 * Halaman onboarding: butuh sesi, tapi justru tidak boleh diakses kalau
 * warungnya sudah ada.
 */
export function PenjagaOnboarding() {
  const status = useSesi((s) => s.status);

  if (status === 'memuat') return <Memuat />;
  if (status === 'tamu') return <Navigate to="/masuk" replace />;
  if (status === 'siap') return <Navigate to="/" replace />;
  return <Outlet />;
}
