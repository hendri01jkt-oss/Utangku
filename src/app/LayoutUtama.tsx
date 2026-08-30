import { Link, Outlet } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { LogOut, Settings } from 'lucide-react';
import { BottomNav } from './BottomNav';
import { IndikatorSync } from './IndikatorSync';
import { useSesi } from '@/fitur/auth/useSesi';
import { useMesinSync } from '@/data/sync/useMesinSync';
import { perluDitagih } from '@/fitur/tagihan/daftarTagihan';
import { useKeluar } from '@/fitur/auth/useKeluar';

/**
 * Kerangka aplikasi: header permukaan yang menempel di atas, konten yang bisa
 * digulir, dan navigasi bawah yang tetap.
 *
 * Lebar dibatasi max-w-lg karena UtangKu adalah aplikasi HP lebih dulu —
 * di layar lebar isinya tetap satu kolom di tengah, bukan melar.
 */
export function LayoutUtama() {
  const warung = useSesi((s) => s.warung);
  const { mintaKeluar, dialogKeluar } = useKeluar();

  // Mesin sync hidup selama pengguna berada di dalam aplikasi.
  useMesinSync(warung?.id);

  const jumlahTagihan = useLiveQuery(
    async () => (warung ? (await perluDitagih(warung.id)).length : 0),
    [warung?.id],
    0,
  );

  return (
    <div className="mx-auto flex min-h-dvh max-w-lg flex-col">
      <header
        className="sticky top-0 z-10 border-b border-garis bg-putih px-4 py-3"
        style={{ paddingTop: 'max(0.75rem, env(safe-area-inset-top))' }}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-base font-semibold tracking-tight">
              {warung?.nama_warung ?? (
                <>
                  Utang<span className="text-merah-600">Ku</span>
                </>
              )}
            </p>
            {warung ? (
              <p className="text-[11px] text-teks-samar">UtangKu</p>
            ) : null}
          </div>

          <div className="flex shrink-0 items-center gap-3">
            <IndikatorSync />
            <Link
              to="/pengaturan"
              aria-label="Pengaturan"
              title="Pengaturan"
              className="flex size-9 items-center justify-center rounded-full text-teks-samar transition-colors hover:bg-permukaan-2 hover:text-teks-utama"
            >
              <Settings size={18} aria-hidden />
            </Link>
            <button
              type="button"
              onClick={() => void mintaKeluar()}
              aria-label="Keluar"
              title="Keluar"
              className="flex size-9 items-center justify-center rounded-full text-teks-samar transition-colors hover:bg-permukaan-2 hover:text-teks-utama"
            >
              <LogOut size={18} aria-hidden />
            </button>
          </div>
        </div>
      </header>
      {dialogKeluar}

      <main
        className="flex-1 px-4 py-4"
        style={{ paddingBottom: 'calc(var(--tinggi-nav) + 1.5rem)' }}
      >
        <Outlet />
      </main>

      <BottomNav jumlahTagihan={jumlahTagihan} />
    </div>
  );
}
