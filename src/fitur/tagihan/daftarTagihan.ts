import { db, type BarisPelanggan, type BarisTransaksi } from '@/data/db';
import { sisaUtang, tanggalHariIni } from '@/data/repo/transaksi';

export interface BarisTagihan {
  transaksi: BarisTransaksi;
  namaPelanggan: string;
  noWa: string | null;
  sisa: number;
  /** Selisih hari menuju jatuh tempo; negatif berarti lewat, null bila tanpa tempo. */
  hariKeTempo: number | null;
  /**
   * SELURUH utang pelanggan ini yang belum lunas, bukan hanya baris ini.
   * Saat menagih, yang dikirim adalah rincian semua utangnya — menagih satu
   * catatan lalu menyusul lagi untuk catatan lain terasa tidak enak bagi
   * kedua pihak.
   */
  utangPelanggan: BarisTransaksi[];
}

export interface KelompokTagihan {
  lewatTempo: BarisTagihan[];
  mendekatiTempo: BarisTagihan[];
  /** Tanpa jatuh tempo sama sekali, diurutkan dari yang paling lama. */
  terlama: BarisTagihan[];
}

const selisihHari = (dari: string, ke: string) =>
  Math.round(
    (new Date(`${ke}T00:00:00Z`).getTime() - new Date(`${dari}T00:00:00Z`).getTime()) /
      86_400_000,
  );

/**
 * Mengelompokkan utang yang perlu ditagih.
 *
 * Ambang "mendekati" dibaca dari reminder_hari_sebelum milik masing-masing
 * transaksi, bukan angka tetap tiga hari — supaya warung yang memberi tempo
 * lebih panjang bisa diingatkan lebih awal tanpa mengubah kode.
 *
 * Kelompok "terlama" ada karena banyak warung tidak memberi tempo sama
 * sekali. Tanpa itu, utang mereka tidak akan pernah muncul di daftar tagihan
 * betapapun lamanya.
 */
export async function kelompokTagihan(warungId: string): Promise<KelompokTagihan> {
  const hariIni = tanggalHariIni();

  const belumLunas = await db.transaksi_utang
    .where('warung_id')
    .equals(warungId)
    .filter((t) => t.deleted_at === null && t.status !== 'lunas')
    .toArray();

  if (belumLunas.length === 0) {
    return { lewatTempo: [], mendekatiTempo: [], terlama: [] };
  }

  const perPelanggan = new Map<string, BarisTransaksi[]>();
  for (const t of belumLunas) {
    const daftar = perPelanggan.get(t.pelanggan_id);
    if (daftar) daftar.push(t);
    else perPelanggan.set(t.pelanggan_id, [t]);
  }

  const pelanggan = await db.pelanggan.where('warung_id').equals(warungId).toArray();
  const dataPelanggan = new Map<string, BarisPelanggan>(pelanggan.map((p) => [p.id, p]));

  const jadikanBaris = (t: BarisTransaksi, hariKeTempo: number | null): BarisTagihan => ({
    transaksi: t,
    namaPelanggan: dataPelanggan.get(t.pelanggan_id)?.nama ?? 'Pelanggan terhapus',
    noWa: dataPelanggan.get(t.pelanggan_id)?.no_wa ?? null,
    sisa: sisaUtang(t),
    hariKeTempo,
    utangPelanggan: perPelanggan.get(t.pelanggan_id) ?? [t],
  });

  const lewatTempo: BarisTagihan[] = [];
  const mendekatiTempo: BarisTagihan[] = [];
  const terlama: BarisTagihan[] = [];

  for (const t of belumLunas) {
    if (t.jatuh_tempo === null) {
      terlama.push(jadikanBaris(t, null));
      continue;
    }
    const hari = selisihHari(hariIni, t.jatuh_tempo);
    if (hari < 0) lewatTempo.push(jadikanBaris(t, hari));
    else if (hari <= t.reminder_hari_sebelum) mendekatiTempo.push(jadikanBaris(t, hari));
  }

  // Paling mendesak di atas: yang paling lama lewat tempo bernilai paling negatif.
  lewatTempo.sort((a, b) => (a.hariKeTempo ?? 0) - (b.hariKeTempo ?? 0));
  mendekatiTempo.sort((a, b) => (a.hariKeTempo ?? 0) - (b.hariKeTempo ?? 0));
  terlama.sort((a, b) => a.transaksi.tanggal.localeCompare(b.transaksi.tanggal));

  return { lewatTempo, mendekatiTempo, terlama };
}

/**
 * Yang benar-benar mendesak: lewat tempo dan mendekati tempo.
 * Dipakai beranda dan badge navigasi bawah.
 */
export async function perluDitagih(warungId: string): Promise<BarisTagihan[]> {
  const { lewatTempo, mendekatiTempo } = await kelompokTagihan(warungId);
  return [...lewatTempo, ...mendekatiTempo];
}

/** "Lewat tempo 3 hari" / "Jatuh tempo hari ini" / "3 hari lagi" / "Tanpa tempo". */
export function labelTempo(hariKeTempo: number | null): string {
  if (hariKeTempo === null) return 'Tanpa tempo';
  if (hariKeTempo < 0) return `Lewat tempo ${Math.abs(hariKeTempo)} hari`;
  if (hariKeTempo === 0) return 'Jatuh tempo hari ini';
  return `${hariKeTempo} hari lagi`;
}

/** Berapa lama utang ini sudah berjalan, untuk kelompok tanpa tempo. */
export function labelUmurUtang(tanggal: string): string {
  const hari = selisihHari(tanggal, tanggalHariIni());
  if (hari <= 0) return 'Dicatat hari ini';
  if (hari === 1) return 'Sudah 1 hari';
  return `Sudah ${hari} hari`;
}
