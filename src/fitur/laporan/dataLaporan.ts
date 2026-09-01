import { db, type BarisPelanggan } from '@/data/db';
import { tanggalHariIni } from '@/data/repo/transaksi';

export interface Periode {
  mulai: string;
  sampai: string;
}

export interface BarisLaporanUtang {
  tanggal: string;
  namaPelanggan: string;
  keterangan: string;
  nominal: number;
  jatuhTempo: string | null;
  status: string;
}

export interface BarisLaporanTunai {
  tanggal: string;
  namaPelanggan: string;
  keterangan: string;
  nominal: number;
}

export interface BarisLaporanBayar {
  tanggal: string;
  namaPelanggan: string;
  metode: string;
  catatan: string;
  nominal: number;
}

export interface Laporan {
  periode: Periode;
  utangBaru: BarisLaporanUtang[];
  penjualanTunai: BarisLaporanTunai[];
  pembayaran: BarisLaporanBayar[];
  totalUtangBaru: number;
  totalPenjualanTunai: number;
  totalTertagih: number;
  /** Sisa piutang pada akhir periode, bukan sisa hari ini. */
  sisaPiutang: number;
  jumlahPelangganBerutang: number;
}

const p2 = (n: number) => String(n).padStart(2, '0');

/** Periode bulan berjalan menurut Waktu Indonesia Barat. */
export function periodeBulanIni(): Periode {
  const hariIni = tanggalHariIni();
  return { mulai: `${hariIni.slice(0, 7)}-01`, sampai: hariIni };
}

/** Periode bulan lalu, penuh dari tanggal 1 sampai hari terakhirnya. */
export function periodeBulanLalu(): Periode {
  const [tahun = 0, bulan = 1] = tanggalHariIni().split('-').map(Number);
  const tahunLalu = bulan === 1 ? tahun - 1 : tahun;
  const bulanLalu = bulan === 1 ? 12 : bulan - 1;
  // Hari ke-0 bulan berikutnya = hari terakhir bulan ini.
  const hariTerakhir = new Date(Date.UTC(tahunLalu, bulanLalu, 0)).getUTCDate();
  return {
    mulai: `${tahunLalu}-${p2(bulanLalu)}-01`,
    sampai: `${tahunLalu}-${p2(bulanLalu)}-${p2(hariTerakhir)}`,
  };
}

export const namaBulan = (iso: string) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

/**
 * Menyusun laporan satu periode dari data lokal.
 *
 * Semuanya dihitung dari Dexie, bukan dari view di server, supaya laporan
 * tetap bisa dibuka dan diekspor saat tidak ada sinyal.
 */
export async function susunLaporan(warungId: string, periode: Periode): Promise<Laporan> {
  const [transaksi, pembayaran, pelanggan] = await Promise.all([
    db.transaksi_utang
      .where('warung_id')
      .equals(warungId)
      .filter((t) => t.deleted_at === null)
      .toArray(),
    db.pembayaran
      .where('warung_id')
      .equals(warungId)
      .filter((b) => b.deleted_at === null)
      .toArray(),
    db.pelanggan.where('warung_id').equals(warungId).toArray(),
  ]);

  const nama = new Map<string, BarisPelanggan>(pelanggan.map((p) => [p.id, p]));
  // Penjualan tunai boleh tanpa pelanggan sama sekali — pembeli yang lewat.
  const namaDari = (id: string | null) =>
    id === null ? 'Pembeli umum' : (nama.get(id)?.nama ?? 'Pelanggan terhapus');

  const dalamPeriode = (tanggal: string) =>
    tanggal >= periode.mulai && tanggal <= periode.sampai;

  const utangBaru = transaksi
    .filter((t) => t.jenis === 'utang' && dalamPeriode(t.tanggal))
    .sort((a, b) => a.tanggal.localeCompare(b.tanggal))
    .map((t) => ({
      tanggal: t.tanggal,
      namaPelanggan: namaDari(t.pelanggan_id),
      keterangan: t.keterangan ?? '',
      nominal: Math.round(t.nominal),
      jatuhTempo: t.jatuh_tempo,
      status: t.status,
    }));

  /*
   * Penjualan tunai dipisah sebagai kategori sendiri, bukan digabung ke
   * "utang baru" maupun ke "tertagih".
   *
   * Menggabungkannya ke tertagih akan salah dua kali: uang tunai bukan utang
   * yang berhasil ditagih, dan angkanya akan terhitung dua kali begitu
   * pemiliknya menjumlahkan penjualan hari itu.
   */
  const penjualanTunai = transaksi
    .filter((t) => t.jenis === 'tunai' && dalamPeriode(t.tanggal))
    .sort((a, b) => a.tanggal.localeCompare(b.tanggal))
    .map((t) => ({
      tanggal: t.tanggal,
      namaPelanggan: namaDari(t.pelanggan_id),
      keterangan: t.keterangan ?? '',
      nominal: Math.round(t.nominal),
    }));

  const bayarPeriode = pembayaran
    .filter((b) => dalamPeriode(b.tanggal))
    .sort((a, b) => a.tanggal.localeCompare(b.tanggal))
    .map((b) => ({
      tanggal: b.tanggal,
      namaPelanggan: namaDari(b.pelanggan_id),
      metode: b.metode,
      catatan: b.catatan ?? '',
      nominal: Math.round(b.nominal),
    }));

  /*
   * Sisa piutang dihitung PADA AKHIR PERIODE, bukan sisa hari ini.
   *
   * Untuk laporan bulan lalu, "sisa hari ini" akan salah: pembayaran yang
   * masuk bulan ini ikut mengurangi, sehingga rekap bulan lalu berubah
   * angkanya setiap kali dibuka. Rekap yang sudah dicetak harus tetap cocok
   * kalau dicetak ulang.
   */
  const dibayarSampai = new Map<string, number>();
  for (const b of pembayaran) {
    if (b.tanggal > periode.sampai) continue;
    dibayarSampai.set(
      b.transaksi_id,
      (dibayarSampai.get(b.transaksi_id) ?? 0) + Math.round(b.nominal),
    );
  }

  let sisaPiutang = 0;
  const berutang = new Set<string>();
  for (const t of transaksi) {
    // Penjualan tunai tidak pernah menyisakan piutang; ikut dihitung di sini
    // akan menaikkan sisa piutang sebesar seluruh penjualan tunai periode.
    if (t.jenis !== 'utang' || t.pelanggan_id === null) continue;
    if (t.tanggal > periode.sampai) continue;
    const sisa = Math.max(
      Math.round(t.nominal) - (dibayarSampai.get(t.id) ?? 0),
      0,
    );
    sisaPiutang += sisa;
    if (sisa > 0) berutang.add(t.pelanggan_id);
  }

  return {
    periode,
    utangBaru,
    penjualanTunai,
    pembayaran: bayarPeriode,
    totalUtangBaru: utangBaru.reduce((j, t) => j + t.nominal, 0),
    totalPenjualanTunai: penjualanTunai.reduce((j, t) => j + t.nominal, 0),
    totalTertagih: bayarPeriode.reduce((j, b) => j + b.nominal, 0),
    sisaPiutang,
    jumlahPelangganBerutang: berutang.size,
  };
}

/** Nama berkas ekspor, mis. "UtangKu-Warteg-Bahari-2026-08-01-sd-2026-08-24". */
export function namaBerkas(namaWarung: string, periode: Periode): string {
  const bersih = namaWarung.replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-');
  return `UtangKu-${bersih || 'Warung'}-${periode.mulai}-sd-${periode.sampai}`;
}
