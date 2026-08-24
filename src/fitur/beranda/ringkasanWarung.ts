import { db, type BarisPelanggan, type BarisTransaksi } from '@/data/db';
import { sisaUtang, tanggalHariIni } from '@/data/repo/transaksi';

export interface RingkasanWarung {
  totalPiutang: number;
  jumlahPelangganBerutang: number;
  tertagihBulanIni: number;
  adaPelanggan: boolean;
}

export interface BarisPerluDitagih {
  transaksi: BarisTransaksi;
  namaPelanggan: string;
  noWa: string | null;
  sisa: number;
  /** Selisih hari menuju jatuh tempo; negatif berarti sudah lewat. */
  hariKeTempo: number;
  /**
   * SELURUH utang pelanggan ini yang belum lunas, bukan hanya baris ini.
   * Saat menagih, yang dikirim adalah rincian semua utangnya — menagih satu
   * catatan lalu menyusul lagi untuk catatan lain terasa tidak enak bagi
   * kedua pihak.
   */
  utangPelanggan: BarisTransaksi[];
}

/** Tanggal 1 bulan ini menurut Waktu Indonesia Barat. */
const awalBulanIni = () => `${tanggalHariIni().slice(0, 7)}-01`;

const selisihHari = (dari: string, ke: string) =>
  Math.round(
    (new Date(`${ke}T00:00:00Z`).getTime() - new Date(`${dari}T00:00:00Z`).getTime()) /
      86_400_000,
  );

/**
 * Ringkasan warung dihitung dari Dexie, bukan dari view v_ringkasan_warung.
 *
 * View-nya tetap ada dan dipakai untuk laporan, tapi angka yang tampil di
 * beranda harus benar juga saat offline — dan mengambilnya dari server
 * berarti beranda kosong persis pada saat sinyal mati.
 */
export async function ringkasanWarung(warungId: string): Promise<RingkasanWarung> {
  const [transaksi, pembayaran, jumlahPelanggan] = await Promise.all([
    db.transaksi_utang
      .where('warung_id')
      .equals(warungId)
      .filter((t) => t.deleted_at === null)
      .toArray(),
    db.pembayaran
      .where('warung_id')
      .equals(warungId)
      .filter((b) => b.deleted_at === null && b.tanggal >= awalBulanIni())
      .toArray(),
    db.pelanggan
      .where('warung_id')
      .equals(warungId)
      .filter((p) => p.deleted_at === null)
      .count(),
  ]);

  const berutang = new Set<string>();
  let totalPiutang = 0;

  for (const t of transaksi) {
    const sisa = sisaUtang(t);
    totalPiutang += sisa;
    if (t.status !== 'lunas' && sisa > 0) berutang.add(t.pelanggan_id);
  }

  return {
    totalPiutang,
    jumlahPelangganBerutang: berutang.size,
    tertagihBulanIni: pembayaran.reduce((jumlah, b) => jumlah + Math.round(b.nominal), 0),
    adaPelanggan: jumlahPelanggan > 0,
  };
}

/**
 * Utang yang perlu ditagih: yang sudah lewat tempo lebih dulu, lalu yang
 * mendekati jatuh tempo.
 *
 * Ambang "mendekati" dibaca dari reminder_hari_sebelum milik masing-masing
 * transaksi, bukan angka tetap tiga hari — supaya warung yang memberi tempo
 * lebih panjang bisa diingatkan lebih awal tanpa mengubah kode.
 */
export async function perluDitagih(warungId: string): Promise<BarisPerluDitagih[]> {
  const hariIni = tanggalHariIni();

  const belumLunas = await db.transaksi_utang
    .where('warung_id')
    .equals(warungId)
    .filter((t) => t.deleted_at === null && t.status !== 'lunas')
    .toArray();

  const mendesak = belumLunas
    .filter((t) => t.jatuh_tempo !== null)
    .map((t) => ({ t, hariKeTempo: selisihHari(hariIni, t.jatuh_tempo as string) }))
    .filter(({ t, hariKeTempo }) => hariKeTempo <= t.reminder_hari_sebelum);

  if (mendesak.length === 0) return [];

  const perPelanggan = new Map<string, BarisTransaksi[]>();
  for (const t of belumLunas) {
    const daftar = perPelanggan.get(t.pelanggan_id);
    if (daftar) daftar.push(t);
    else perPelanggan.set(t.pelanggan_id, [t]);
  }

  const pelanggan = await db.pelanggan
    .where('warung_id')
    .equals(warungId)
    .toArray();
  const dataPelanggan = new Map<string, BarisPelanggan>(pelanggan.map((p) => [p.id, p]));

  return (
    mendesak
      .map(({ t, hariKeTempo }) => ({
        transaksi: t,
        namaPelanggan: dataPelanggan.get(t.pelanggan_id)?.nama ?? 'Pelanggan terhapus',
        noWa: dataPelanggan.get(t.pelanggan_id)?.no_wa ?? null,
        sisa: sisaUtang(t),
        hariKeTempo,
        utangPelanggan: perPelanggan.get(t.pelanggan_id) ?? [t],
      }))
      // Satu kunci urut sudah cukup: yang paling lama lewat tempo bernilai
      // paling negatif, sehingga otomatis berada di paling atas.
      .sort((a, b) => a.hariKeTempo - b.hariKeTempo)
  );
}

/** "Lewat tempo 3 hari" / "Jatuh tempo hari ini" / "3 hari lagi". */
export function labelTempo(hariKeTempo: number): string {
  if (hariKeTempo < 0) return `Lewat tempo ${Math.abs(hariKeTempo)} hari`;
  if (hariKeTempo === 0) return 'Jatuh tempo hari ini';
  return `${hariKeTempo} hari lagi`;
}
