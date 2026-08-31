import { useEffect, useState } from 'react';
import { CircleCheck, Lock, MessageCircle, TriangleAlert } from 'lucide-react';
import { Kartu, StatusBadge, type Status } from '@/komponen/ui';
import { formatRupiah } from '@/lib/uang';
import { normalisasiNomorWa, tautanWa } from '@/lib/wa';
import {
  ambilPantau,
  TokenTidakDikenal,
  type DataPantau,
  type TransaksiPantau,
} from './ambilPantau';

const formatTanggal = (iso: string) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

const hariIni = () => new Date().toISOString().slice(0, 10);

function statusTampil(t: TransaksiPantau): Status {
  if (t.status !== 'lunas' && t.jatuh_tempo && t.jatuh_tempo < hariIni()) return 'lewat_tempo';
  return t.status;
}

const sisa = (t: TransaksiPantau) =>
  Math.max(Math.round(t.nominal) - Math.round(t.total_dibayar), 0);

const LABEL_METODE: Record<string, string> = {
  tunai: 'Tunai',
  transfer: 'Transfer',
  qris: 'QRIS',
  lainnya: 'Lainnya',
};

type Keadaan =
  | { jenis: 'memuat' }
  | { jenis: 'siap'; data: DataPantau }
  | { jenis: 'tidak-dikenal' }
  | { jenis: 'galat'; pesan: string };

/**
 * Halaman publik: pelanggan memeriksa sendiri catatan utangnya.
 *
 * Tujuannya kepercayaan — pelanggan tidak perlu percaya begitu saja bahwa
 * nominalnya tidak ditambah-tambahi. Karena itu halaman ini HANYA membaca:
 * tidak ada satu pun tombol yang mengubah data, dan tidak ada permintaan
 * izin apa pun (lokasi, kamera, notifikasi) yang bisa membuat pelanggan
 * curiga balik.
 *
 * Sengaja tidak menyentuh Dexie, mesin sync, maupun store sesi: yang membuka
 * ini bukan pemilik warung, tidak memasang aplikasinya, dan tidak perlu
 * mengunduh apa pun selain halaman ini.
 *
 * Token diterima sebagai prop, bukan lewat useParams. Halaman ini dipasang
 * langsung dari titik masuk tanpa react-router — lihat main.tsx. Satu
 * ketergantungan yang tidak dipakai pun ikut menarik seluruh cabang impornya
 * ke dalam unduhan pelanggan.
 */
export function HalamanPantau({ token }: { token: string }) {
  const [hasil, setHasil] = useState<{ token: string; keadaan: Keadaan } | null>(null);

  /*
   * Keadaan diturunkan saat render, bukan disetel ulang dari dalam effect.
   *
   * Kalau tokennya berganti, hasil yang tersimpan langsung dianggap basi dan
   * layarnya kembali ke "memuat" pada render yang sama — tanpa satu putaran
   * render tambahan, dan tanpa celah sempit tempat data pelanggan lama masih
   * terlihat di bawah token yang baru.
   */
  const keadaan: Keadaan = hasil?.token === token ? hasil.keadaan : { jenis: 'memuat' };

  useEffect(() => {
    const kendali = new AbortController();
    const simpan = (k: Keadaan) => {
      if (!kendali.signal.aborted) setHasil({ token, keadaan: k });
    };

    ambilPantau(token, kendali.signal)
      .then((data) => simpan({ jenis: 'siap', data }))
      .catch((galat: unknown) => {
        if (galat instanceof TokenTidakDikenal) {
          simpan({ jenis: 'tidak-dikenal' });
          return;
        }
        simpan({
          jenis: 'galat',
          pesan: galat instanceof Error ? galat.message : 'Gagal memuat data.',
        });
      });

    return () => kendali.abort();
  }, [token]);

  if (keadaan.jenis === 'memuat') {
    return (
      <Bingkai>
        <p className="py-16 text-center text-sm text-teks-redup">Memuat catatan utang…</p>
      </Bingkai>
    );
  }

  if (keadaan.jenis === 'tidak-dikenal') {
    return (
      <Bingkai>
        <Kartu className="mt-8 text-center">
          <TriangleAlert size={28} className="mx-auto text-peringatan" aria-hidden />
          <h1 className="mt-3 text-lg font-semibold text-teks-utama">Link tidak berlaku</h1>
          <p className="mt-2 text-sm text-teks-redup">
            Link ini sudah tidak aktif atau salah ketik. Minta link baru ke warung
            tempat Anda mencatat utang.
          </p>
        </Kartu>
      </Bingkai>
    );
  }

  if (keadaan.jenis === 'galat') {
    return (
      <Bingkai>
        <Kartu className="mt-8 text-center">
          <TriangleAlert size={28} className="mx-auto text-bahaya" aria-hidden />
          <h1 className="mt-3 text-lg font-semibold text-teks-utama">Gagal memuat</h1>
          <p className="mt-2 text-sm text-teks-redup">{keadaan.pesan}</p>
        </Kartu>
      </Bingkai>
    );
  }

  const { warung, pelanggan, sisa_utang, transaksi, pembayaran } = keadaan.data;
  const nomor = normalisasiNomorWa(warung.no_wa_warung);

  return (
    <Bingkai>
      <header className="pt-6 pb-2 text-center">
        <p className="text-xs tracking-wide text-teks-samar uppercase">Catatan utang di</p>
        <h1 className="text-xl font-semibold text-teks-utama">{warung.nama_warung}</h1>
      </header>

      <Kartu className="text-center">
        <p className="text-sm text-teks-redup">{pelanggan.nama}</p>
        <p className="mt-1 text-3xl font-bold tabular-nums text-teks-utama">
          {formatRupiah(sisa_utang)}
        </p>
        <p className="mt-1 text-xs text-teks-samar">
          {sisa_utang > 0 ? 'Sisa utang Anda' : 'Tidak ada sisa utang'}
        </p>
      </Kartu>

      <section className="mt-5">
        <h2 className="mb-2 text-sm font-semibold text-teks-utama">Riwayat utang</h2>
        {transaksi.length === 0 ? (
          <Kartu padat>
            <p className="text-sm text-teks-samar">Belum ada catatan utang.</p>
          </Kartu>
        ) : (
          <ul className="flex flex-col gap-2">
            {transaksi.map((t, i) => (
              <li key={`${t.tanggal}-${i}`}>
                <Kartu padat>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-teks-utama">
                        {t.keterangan?.trim() || 'Tanpa keterangan'}
                      </p>
                      <p className="mt-0.5 text-xs text-teks-samar">
                        {formatTanggal(t.tanggal)}
                      </p>
                    </div>
                    <p className="shrink-0 text-sm font-semibold tabular-nums text-teks-utama">
                      {formatRupiah(t.nominal)}
                    </p>
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-3">
                    <StatusBadge status={statusTampil(t)} />
                    {sisa(t) > 0 ? (
                      <span className="text-xs tabular-nums text-teks-redup">
                        sisa {formatRupiah(sisa(t))}
                      </span>
                    ) : null}
                  </div>
                </Kartu>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-5">
        <h2 className="mb-2 text-sm font-semibold text-teks-utama">Riwayat pembayaran</h2>
        {pembayaran.length === 0 ? (
          <Kartu padat>
            <p className="text-sm text-teks-samar">Belum ada pembayaran tercatat.</p>
          </Kartu>
        ) : (
          <ul className="flex flex-col gap-2">
            {pembayaran.map((b, i) => (
              <li key={`${b.tanggal}-${i}`}>
                <Kartu padat>
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-2">
                      <CircleCheck size={15} className="shrink-0 text-sukses" aria-hidden />
                      <span className="text-sm text-teks-utama">
                        {formatTanggal(b.tanggal)}
                      </span>
                      <span className="text-xs text-teks-samar">
                        {LABEL_METODE[b.metode] ?? b.metode}
                      </span>
                    </div>
                    <p className="shrink-0 text-sm font-semibold tabular-nums text-sukses">
                      {formatRupiah(b.nominal)}
                    </p>
                  </div>
                </Kartu>
              </li>
            ))}
          </ul>
        )}
      </section>

      {nomor.ok ? (
        <a
          href={tautanWa(
            nomor.nomor,
            `Halo ${warung.nama_warung}, saya ${pelanggan.nama}. Saya mau tanya soal catatan utang saya.`,
          )}
          target="_blank"
          rel="noreferrer"
          className="mt-5 flex min-h-11 items-center justify-center gap-2 rounded-[var(--radius-kartu)] border border-garis px-4 py-3 text-sm font-medium text-teks-utama"
        >
          <MessageCircle size={16} aria-hidden />
          Hubungi {warung.nama_warung}
        </a>
      ) : null}

      {/*
        Kalimat penutup ini bagian dari fitur, bukan hiasan: pelanggan yang
        merasa angkanya keliru harus tahu bahwa halaman ini memang tidak bisa
        diubah dari sini, dan ke mana harus mengadu.
      */}
      <p className="mt-4 flex items-start gap-2 pb-10 text-xs text-teks-samar">
        <Lock size={13} className="mt-0.5 shrink-0" aria-hidden />
        <span>
          Halaman ini hanya menampilkan catatan, tidak bisa diubah dari sini. Kalau ada
          yang tidak sesuai, sampaikan langsung ke {warung.nama_warung}.
        </span>
      </p>
    </Bingkai>
  );
}

function Bingkai({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-latar">
      <div className="mx-auto w-full max-w-md px-4">{children}</div>
    </div>
  );
}
