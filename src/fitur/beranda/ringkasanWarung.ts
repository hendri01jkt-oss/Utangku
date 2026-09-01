import { db } from '@/data/db';
import { sisaUtang, tanggalHariIni } from '@/data/repo/transaksi';

/** Tanggal 1 bulan ini menurut Waktu Indonesia Barat. */
const awalBulanIni = () => `${tanggalHariIni().slice(0, 7)}-01`;

export interface RingkasanWarung {
  totalPiutang: number;
  jumlahPelangganBerutang: number;
  tertagihBulanIni: number;
  adaPelanggan: boolean;
}

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
    // Penjualan tunai selalu berstatus lunas dengan sisa nol, jadi ia tidak
    // bisa menyumbang piutang walaupun ikut terbaca di sini. Yang tetap
    // perlu dijaga hanya pelanggan_id-nya, yang boleh kosong untuk pembeli
    // lewat.
    const sisa = sisaUtang(t);
    totalPiutang += sisa;
    if (t.status !== 'lunas' && sisa > 0 && t.pelanggan_id) berutang.add(t.pelanggan_id);
  }

  return {
    totalPiutang,
    jumlahPelangganBerutang: berutang.size,
    tertagihBulanIni: pembayaran.reduce((jumlah, b) => jumlah + Math.round(b.nominal), 0),
    adaPelanggan: jumlahPelanggan > 0,
  };
}
