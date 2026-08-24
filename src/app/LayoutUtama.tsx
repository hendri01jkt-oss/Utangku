import { Outlet } from 'react-router-dom';
import { BottomNav } from './BottomNav';
import { IndikatorSync } from './IndikatorSync';

/**
 * Kerangka aplikasi: header kaca yang menempel di atas, konten yang bisa
 * digulir, dan navigasi bawah yang tetap.
 *
 * Lebar dibatasi max-w-lg karena UtangKu adalah aplikasi HP lebih dulu —
 * di layar lebar isinya tetap satu kolom di tengah, bukan melar.
 */
export function LayoutUtama() {
  return (
    <div className="mx-auto flex min-h-dvh max-w-lg flex-col">
      <header
        className="kaca sticky top-0 z-10 rounded-none border-x-0 border-t-0 px-4 py-3"
        style={{ paddingTop: 'max(0.75rem, env(safe-area-inset-top))' }}
      >
        <div className="flex items-center justify-between gap-3">
          <p className="text-base font-semibold tracking-tight">
            Utang<span className="text-gold-400">Ku</span>
          </p>
          <IndikatorSync />
        </div>
      </header>

      <main
        className="flex-1 px-4 py-4"
        style={{ paddingBottom: 'calc(var(--tinggi-nav) + 1.5rem)' }}
      >
        <Outlet />
      </main>

      {/* Angka badge masih contoh; disambungkan ke data di Tahap 9. */}
      <BottomNav jumlahTagihan={3} />
    </div>
  );
}
