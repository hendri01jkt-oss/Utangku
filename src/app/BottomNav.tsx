import { NavLink } from 'react-router-dom';
import { CircleUser, FileText, House, Users, Wallet, type LucideIcon } from 'lucide-react';
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
  { ke: '/akun', label: 'Akun', Ikon: CircleUser },
];

/**
 * Navigasi utama di bawah layar: semua tujuan penting berada dalam
 * jangkauan jempol. Tidak ada aksi penting di pojok atas.
 */
export function BottomNav({
  jumlahTagihan = 0,
  jumlahBermasalah = 0,
}: {
  jumlahTagihan?: number;
  jumlahBermasalah?: number;
}) {
  return (
    <nav
      aria-label="Navigasi utama"
      className="fixed inset-x-0 bottom-0 z-20 border-t border-garis bg-putih"
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
                  isActive ? 'text-emas-700' : 'text-teks-samar hover:text-teks-redup',
                )
              }
            >
              {({ isActive }) => (
                <>
                  <span className="relative">
                    <Ikon size={21} strokeWidth={isActive ? 2.4 : 1.8} aria-hidden />
                    {/*
                      Dua lencana dengan arti berbeda, bentuknya sengaja sama:
                      keduanya berarti "ada N hal yang menunggu Anda", dan
                      tab tempatnya menempel yang membedakan apanya.

                      Lencana Akun hanya menghitung entri yang DITOLAK server,
                      bukan seluruh antrean. Antrean yang sekadar menunggu
                      sinyal adalah keadaan normal di warung bersinyal lemah;
                      kalau ikut dihitung, lencana merahnya menyala sepanjang
                      hari dan berhenti berarti apa-apa.
                    */}
                    {label === 'Tagihan' && jumlahTagihan > 0 ? (
                      <Lencana
                        jumlah={jumlahTagihan}
                        keterangan={`${jumlahTagihan} perlu ditagih`}
                      />
                    ) : null}
                    {label === 'Akun' && jumlahBermasalah > 0 ? (
                      <Lencana
                        jumlah={jumlahBermasalah}
                        keterangan={`${jumlahBermasalah} catatan perlu diperiksa`}
                      />
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

function Lencana({ jumlah, keterangan }: { jumlah: number; keterangan: string }) {
  return (
    <span
      className="angka absolute -right-2.5 -top-1.5 min-w-4 rounded-full bg-bahaya px-1 text-center text-[10px] font-semibold text-putih"
      aria-label={keterangan}
    >
      {jumlah}
    </span>
  );
}
