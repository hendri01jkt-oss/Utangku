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
        Header navy pekat: putih di atasnya 16.87:1, dan bilah status HP
        ikut menyatu dengannya lewat theme-color yang sama.
      */}
      <header
        className="sticky top-0 z-10 bg-navy-900 px-4 py-3 text-putih"
        style={{ paddingTop: 'max(0.75rem, env(safe-area-inset-top))' }}
      >
        <div className="min-w-0">
          {warung ? (
            <>
              <p className="truncate text-base font-semibold tracking-tight">
                {warung.nama_warung}
              </p>
              {/*
                Baris kedua ini sengaja TETAP teks, bukan logo. Pada 11px
                wordmark-nya jadi sesak dan garis putih tipisnya luntur —
                diuji pada 14, 20, 24, 32 dan 56px, dan di bawah 20px ia
                hanya menambah keramaian di sebelah nama warung yang justru
                harus menonjol.
              */}
              <p className="text-[11px] text-emas-500">UtangKu</p>
            </>
          ) : (
            /*
              Tanpa warung, nama aplikasilah identitas utamanya.
              Logonya masih tanda merah yang lama (penggantinya menyusul),
              dan merah di atas navy nyaris tidak terbaca — jadi untuk
              sementara ia berdiri di atas kepingan putih. Begitu logo
              navy/gold datang, kepingan ini dibuang.
            */
            <span className="inline-flex rounded-lg bg-putih px-2 py-1">
              <Logo tinggi="h-6" />
            </span>
          )}
        </div>
      </header>

      <main
        className="flex-1 px-4 py-4"
        style={{ paddingBottom: 'calc(var(--tinggi-nav) + 1.5rem)' }}
      >
        <Outlet />
      </main>

      <BottomNav jumlahTagihan={jumlahTagihan} jumlahBermasalah={jumlahBermasalah} />
    </div>
  );
}
