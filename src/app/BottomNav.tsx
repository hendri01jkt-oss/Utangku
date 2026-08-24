import { NavLink } from 'react-router-dom';
import { FileText, House, Users, Wallet, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/cn';

interface ItemMenu {
  ke: string;
  label: string;
  Ikon: LucideIcon;
  /** `true` hanya untuk "/" supaya tab Beranda tidak ikut aktif di rute lain. */
  ujung?: boolean;
}

const menu: ItemMenu[] = [
  { ke: '/', label: 'Beranda', Ikon: House, ujung: true },
  { ke: '/pelanggan', label: 'Pelanggan', Ikon: Users },
  { ke: '/tagihan', label: 'Tagihan', Ikon: Wallet },
  { ke: '/laporan', label: 'Laporan', Ikon: FileText },
];

/**
 * Navigasi utama di bawah layar: semua tujuan penting berada dalam
 * jangkauan jempol. Tidak ada aksi penting di pojok atas.
 */
export function BottomNav({ jumlahTagihan = 0 }: { jumlahTagihan?: number }) {
  return (
    <nav
      aria-label="Navigasi utama"
      className="kaca fixed inset-x-0 bottom-0 z-20 rounded-none border-x-0 border-b-0"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <ul className="mx-auto flex max-w-lg">
        {menu.map(({ ke, label, Ikon, ujung }) => (
          <li key={ke} className="flex-1">
            <NavLink
              to={ke}
              end={ujung}
              className={({ isActive }) =>
                cn(
                  'relative flex min-h-16 flex-col items-center justify-center gap-1',
                  'text-[11px] transition-colors',
                  isActive ? 'text-gold-400' : 'text-teks-samar hover:text-teks-redup',
                )
              }
            >
              {({ isActive }) => (
                <>
                  <span className="relative">
                    <Ikon size={21} strokeWidth={isActive ? 2.4 : 1.8} aria-hidden />
                    {label === 'Tagihan' && jumlahTagihan > 0 ? (
                      <span
                        className="angka absolute -right-2.5 -top-1.5 min-w-4 rounded-full bg-[var(--tint-bahaya)] px-1 text-center text-[10px] font-semibold text-bahaya ring-1 ring-bahaya/40"
                        aria-label={`${jumlahTagihan} perlu ditagih`}
                      >
                        {jumlahTagihan}
                      </span>
                    ) : null}
                  </span>
                  {label}
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
