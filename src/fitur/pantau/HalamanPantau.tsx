import { useEffect, useState, type FormEvent } from 'react';
import { ChevronDown, CircleCheck, KeyRound, Lock, MessageCircle, TriangleAlert } from 'lucide-react';
import { Kartu, StatusBadge, type Status } from '@/komponen/ui';
import { formatRupiah } from '@/lib/uang';
import { normalisasiNomorWa, tautanWa } from '@/lib/wa';
import {
  ambilPantau,
  TokenTidakDikenal,
  type DataPantau,
  type PembayaranPantau,
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
  | { jenis: 'pin'; namaWarung: string; sisaPercobaan: number | null }
  | { jenis: 'terkunci'; sisaDetik: number }
  | { jenis: 'tidak-dikenal' }
  | { jenis: 'galat'; pesan: string };

/*
 * PIN diingat di perangkat pelanggan supaya tidak perlu mengetik ulang tiap
 * kali link dibuka. Dibungkus try/catch: penyimpanan bisa kosong atau
 * ditolak (mode privat), dan halaman harus tetap jalan tanpanya.
 */
const kunciPin = (token: string) => `utangku-pin:${token}`;
const bacaPin = (token: string): string | null => {
  try {
    return localStorage.getItem(kunciPin(token));
  } catch {
    return null;
  }
};
const simpanPin = (token: string, pin: string | null) => {
  try {
    if (pin) localStorage.setItem(kunciPin(token), pin);
    else localStorage.removeItem(kunciPin(token));
  } catch {
    /* tidak apa-apa */
  }
};

/**
 * Halaman publik: pelanggan memeriksa sendiri catatan utangnya.
 *
 * Tujuannya kepercayaan — pelanggan tidak perlu percaya begitu saja bahwa
 * nominalnya tidak ditambah-tambahi. Karena itu halaman ini HANYA membaca:
 * tidak ada satu pun tombol yang mengubah data, dan tidak ada permintaan
 * izin apa pun (lokasi, kamera, notifikasi) yang bisa membuat pelanggan
 * curiga balik.
 *
 * Link saja tidak cukup untuk membukanya: pelanggan harus memasukkan PIN 6
 * angka yang diberikan warung. Pemeriksaannya di database, bukan di sini.
 *
 * Sengaja tidak menyentuh Dexie, mesin sync, maupun store sesi: yang membuka
 * ini bukan pemilik warung, tidak memasang aplikasinya, dan tidak perlu
 * mengunduh apa pun selain halaman ini.
 *
 * Token diterima sebagai prop, bukan lewat useParams. Halaman ini dipasang
 * langsung dari titik masuk tanpa react-router — lihat main.tsx.
 */
export function HalamanPantau({ token }: { token: string }) {
  const [hasil, setHasil] = useState<{ token: string; n: number; keadaan: Keadaan } | null>(
    null,
  );
  // n naik setiap PIN dikirim; pin null = belum diisi.
  const [masukan, setMasukan] = useState<{ pin: string | null; n: number }>(() => ({
    pin: bacaPin(token),
    n: 0,
  }));
  const [ketikan, setKetikan] = useState('');

  /*
   * Keadaan diturunkan saat render, bukan disetel ulang dari dalam effect.
   * Kalau tokennya berganti, hasil yang tersimpan langsung dianggap basi.
   */
  const keadaan: Keadaan = hasil?.token === token ? hasil.keadaan : { jenis: 'memuat' };
  const mengirim = hasil?.token !== token || hasil.n !== masukan.n;

  useEffect(() => {
    // Halaman berisi data utang orang: jangan sampai masuk mesin pencari.
    const meta = document.createElement('meta');
    meta.name = 'robots';
    meta.content = 'noindex, nofollow';
    document.head.appendChild(meta);
    return () => meta.remove();
  }, []);

  useEffect(() => {
    const kendali = new AbortController();
    const simpan = (k: Keadaan) => {
      if (!kendali.signal.aborted) setHasil({ token, n: masukan.n, keadaan: k });
    };

    ambilPantau(token, masukan.pin, kendali.signal)
      .then((jawab) => {
        if (jawab.status === 'ok') {
          simpanPin(token, masukan.pin);
          simpan({ jenis: 'siap', data: jawab.data });
        } else if (jawab.status === 'terkunci') {
          simpan({ jenis: 'terkunci', sisaDetik: jawab.sisa_detik });
        } else {
          // PIN yang tersimpan sudah tidak cocok (diganti warung): lupakan.
          if (masukan.pin) simpanPin(token, null);
          simpan({
            jenis: 'pin',
            namaWarung: jawab.nama_warung,
            sisaPercobaan: jawab.status === 'pin_salah' ? jawab.sisa_percobaan : null,
          });
        }
      })
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
  }, [token, masukan]);

  function kirimPin(e: FormEvent) {
    e.preventDefault();
    if (ketikan.length !== 6 || mengirim) return;
    setMasukan((m) => ({ pin: ketikan, n: m.n + 1 }));
    setKetikan('');
  }

  if (keadaan.jenis === 'memuat') {
    return (
      <Bingkai>
        <p className="py-16 text-center text-sm text-teks-redup">Memuat catatan utang…</p>
      </Bingkai>
    );
  }

  if (keadaan.jenis === 'terkunci') {
    const menit = Math.max(1, Math.ceil(keadaan.sisaDetik / 60));
    return (
      <Bingkai>
        <Kartu className="mt-8 text-center">
          <Lock size={28} className="mx-auto text-peringatan" aria-hidden />
          <h1 className="mt-3 text-lg font-semibold text-teks-utama">Dikunci sementara</h1>
          <p className="mt-2 text-sm text-teks-redup">
            PIN salah beberapa kali. Coba lagi sekitar {menit} menit lagi, atau minta PIN
            yang benar ke warung.
          </p>
        </Kartu>
      </Bingkai>
    );
  }

  if (keadaan.jenis === 'pin') {
    return (
      <Bingkai>
        <header className="pt-6 pb-2 text-center">
          <p className="text-xs tracking-wide text-teks-samar uppercase">Catatan utang di</p>
          <h1 className="text-xl font-semibold text-teks-utama">{keadaan.namaWarung}</h1>
        </header>
        <Kartu>
          <form onSubmit={kirimPin} className="flex flex-col gap-3 text-center">
            <KeyRound size={28} className="mx-auto text-emas-700" aria-hidden />
            <label htmlFor="pin-pantau" className="text-sm text-teks-redup">
              Masukkan PIN 6 angka dari warung
            </label>
            <input
              id="pin-pantau"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={ketikan}
              onChange={(e) => setKetikan(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="••••••"
              className="min-h-14 w-full rounded-[var(--radius-kontrol)] border border-garis bg-putih px-3 text-center text-2xl font-bold tracking-[0.4em] text-teks-utama outline-none focus:border-emas-600"
            />
            {keadaan.sisaPercobaan !== null ? (
              <p role="alert" className="text-sm text-bahaya">
                PIN salah. Sisa {keadaan.sisaPercobaan} kali coba.
              </p>
            ) : null}
            <button
              type="submit"
              disabled={ketikan.length !== 6 || mengirim}
              className="min-h-12 rounded-[var(--radius-kontrol)] border border-emas-600 bg-emas-500 px-4 font-semibold text-navy-900 disabled:opacity-50"
            >
              {mengirim ? 'Memeriksa…' : 'Buka catatan'}
            </button>
            <p className="text-xs text-teks-samar">
              Tidak punya PIN? Tanyakan ke {keadaan.namaWarung}.
            </p>
          </form>
        </Kartu>
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
                <KartuUtang t={t} />
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
                <KartuBayar b={b} />
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

/**
 * Satu catatan utang yang bisa dibuka: ketuk untuk melihat rincian belanjaan,
 * yang sudah dibayar, dan batas bayar. Tetap hanya-baca — membuka tidak
 * mengubah apa pun dan tidak mengirim permintaan baru (datanya sudah ada).
 */
function KartuUtang({ t }: { t: TransaksiPantau }) {
  const [buka, setBuka] = useState(false);
  const item = t.item ?? [];

  return (
    <Kartu padat className="p-0">
      <button
        type="button"
        onClick={() => setBuka((b) => !b)}
        aria-expanded={buka}
        className="block w-full rounded-[inherit] p-3 text-left"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-medium text-teks-utama">
              {t.nomor_struk?.trim() || t.keterangan?.trim() || 'Tanpa nomor'}
            </p>
            <p className="mt-0.5 text-xs text-teks-samar">{formatTanggal(t.tanggal)}</p>
          </div>
          <p className="shrink-0 text-sm font-semibold tabular-nums text-teks-utama">
            {formatRupiah(t.nominal)}
          </p>
        </div>
        <div className="mt-2 flex items-center justify-between gap-3">
          <StatusBadge status={statusTampil(t)} />
          <span className="flex items-center gap-1 text-xs tabular-nums text-teks-redup">
            {sisa(t) > 0 ? `sisa ${formatRupiah(sisa(t))}` : null}
            <ChevronDown
              size={16}
              aria-hidden
              className={buka ? 'rotate-180 transition-transform' : 'transition-transform'}
            />
          </span>
        </div>
      </button>

      {buka ? (
        <div className="border-t border-garis px-3 pb-3 pt-2 text-sm">
          {item.length > 0 ? (
            <ul className="flex flex-col gap-1.5">
              {item.map((i, n) => (
                <li key={n} className="flex items-start justify-between gap-3">
                  <span className="min-w-0 text-teks-utama">
                    {i.nama_item}
                    <span className="block text-xs text-teks-samar">
                      {i.qty} x {formatRupiah(i.harga_satuan)}
                    </span>
                  </span>
                  <span className="shrink-0 tabular-nums text-teks-utama">
                    {formatRupiah(i.subtotal)}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-teks-samar">Utang ini dicatat tanpa isi belanjaan.</p>
          )}

          <dl className="mt-2 flex flex-col gap-1 border-t border-garis pt-2 text-xs">
            {t.nomor_struk ? (
              <div className="flex justify-between gap-3">
                <dt className="text-teks-samar">No. Utang</dt>
                <dd className="tabular-nums text-teks-utama">{t.nomor_struk}</dd>
              </div>
            ) : null}
            <div className="flex justify-between gap-3">
              <dt className="text-teks-samar">Total</dt>
              <dd className="tabular-nums text-teks-utama">{formatRupiah(t.nominal)}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-teks-samar">Sudah dibayar</dt>
              <dd className="tabular-nums text-teks-utama">{formatRupiah(t.total_dibayar)}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-teks-samar">Sisa</dt>
              <dd className="font-semibold tabular-nums text-teks-utama">
                {formatRupiah(sisa(t))}
              </dd>
            </div>
            {t.jatuh_tempo ? (
              <div className="flex justify-between gap-3">
                <dt className="text-teks-samar">Batas bayar</dt>
                <dd className="text-teks-utama">{formatTanggal(t.jatuh_tempo)}</dd>
              </div>
            ) : null}
          </dl>
        </div>
      ) : null}
    </Kartu>
  );
}

/** Satu pembayaran yang bisa dibuka: utang mana yang dibayar . */
function KartuBayar({ b }: { b: PembayaranPantau }) {
  const [buka, setBuka] = useState(false);
  const untuk = b.untuk_keterangan?.trim();

  return (
    <Kartu padat className="p-0">
      <button
        type="button"
        onClick={() => setBuka((x) => !x)}
        aria-expanded={buka}
        className="flex w-full items-center justify-between gap-3 rounded-[inherit] p-3 text-left"
      >
        <div className="flex min-w-0 items-center gap-2">
          <CircleCheck size={15} className="shrink-0 text-sukses" aria-hidden />
          <span className="text-sm text-teks-utama">{formatTanggal(b.tanggal)}</span>
          <span className="text-xs text-teks-samar">{LABEL_METODE[b.metode] ?? b.metode}</span>
        </div>
        <span className="flex shrink-0 items-center gap-1">
          <span className="text-sm font-semibold tabular-nums text-sukses">
            {formatRupiah(b.nominal)}
          </span>
          <ChevronDown
            size={16}
            aria-hidden
            className={
              buka ? 'rotate-180 text-teks-redup transition-transform' : 'text-teks-redup transition-transform'
            }
          />
        </span>
      </button>

      {buka ? (
        <dl className="flex flex-col gap-1 border-t border-garis px-3 pb-3 pt-2 text-xs">
          <div className="flex justify-between gap-3">
            <dt className="text-teks-samar">Untuk utang</dt>
            <dd className="text-right text-teks-utama">
              {untuk || 'Tanpa keterangan'}
              {b.untuk_tanggal ? ` (${formatTanggal(b.untuk_tanggal)})` : ''}
            </dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-teks-samar">Metode</dt>
            <dd className="text-teks-utama">{LABEL_METODE[b.metode] ?? b.metode}</dd>
          </div>
        </dl>
      ) : null}
    </Kartu>
  );
}

function Bingkai({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-latar">
      <div className="mx-auto w-full max-w-md px-4">{children}</div>
    </div>
  );
}
