import ikonUtangku from '@/aset/ikon-utangku.png';
import { Outlet } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { BottomNav } from './BottomNav';
import { useSesi } from '@/fitur/auth/useSesi';
import { Logo } from '@/komponen/ui';
import { db } from '@/data/db';
import { useMesinSync } from '@/data/sync/useMesinSync';
import { perluDitagih } from '@/fitur/tagihan/daftarTagihan';

/**
 * Kerangka aplikasi: header identitas yang menempel di atas, konten yang bisa
 * digulir, dan navigasi bawah yang tetap.
 *
 * Header sengaja tidak punya satu pun kontrol. Status sinkron, pengaturan,
 * dan keluar semuanya pindah ke tab Akun: ketiganya berdesakan sebagai ikon
 * kecil di pojok kanan atas — di luar jangkauan jempol — padahal salah
 * satunya (keluar) menghapus seluruh catatan di HP ini.
 *
 * Lebar dibatasi max-w-lg karena UtangKu adalah aplikasi HP lebih dulu —
 * di layar lebar isinya tetap satu kolom di tengah, bukan melar.
 */
export function LayoutUtama() {
  const warung = useSesi((s) => s.warung);

  // Mesin sync hidup selama pengguna berada di dalam aplikasi.
  useMesinSync(warung?.id);

  const jumlahTagihan = useLiveQuery(
    async () => (warung ? (await perluDitagih(warung.id)).length : 0),
    [warung?.id],
    0,
  );

  /*
   * Hanya entri yang DITOLAK server yang dihitung, bukan seluruh antrean:
   * antrean yang menunggu sinyal adalah keadaan normal, dan lencana merah
   * yang menyala sepanjang hari berhenti berarti apa-apa.
   */
  const jumlahBermasalah = useLiveQuery(
    () => db.outbox.filter((e) => e.galat !== null).count(),
    [],
    0,
  );

  return (
    <div className="mx-auto flex min-h-dvh max-w-lg flex-col">
      {/*
        Header krem terang ala AwetKu dengan garis emas tipis; emas hanya jadi
        aksen. Teks navy-900 di atas #fffdf6 >16:1, dan bilah status HP
        menyatu lewat theme-color yang sama.
      */}
      <header
        className="sticky top-0 z-10 border-b border-emas-500/40 px-4 py-2 text-navy-900"
        style={{
          paddingTop: 'max(0.5rem, env(safe-area-inset-top))',
          backgroundColor: '#fffdf6',
        }}
      >
        {/*
          Kiri: ikon logo UtangKu. Kanan: nama warung, rata kanan. Nama
          warung dipotong dengan elipsis kalau terlalu panjang, ikon tetap.
        */}
        <div className="flex items-center justify-between gap-3">
          <img
            src={ikonUtangku}
            alt="UtangKu"
            width={36}
            height={36}
            className="size-9 shrink-0 object-contain"
          />
          {warung ? (
            <p className="min-w-0 truncate text-right text-base font-semibold tracking-tight">
              {warung.nama_warung}
            </p>
          ) : (
            <span className="inline-flex rounded-lg bg-putih px-2 py-1">
              <Logo tinggi="h-6" />
            </span>
          )}
        </div>
      </header>

      <main
        className="flex-1 px-4 pb-4 pt-3"
        style={{ paddingBottom: 'calc(var(--tinggi-nav) + 1.5rem)' }}
      >
        <Outlet />
      </main>

      <BottomNav jumlahTagihan={jumlahTagihan} jumlahBermasalah={jumlahBermasalah} />
    </div>
  );
}
