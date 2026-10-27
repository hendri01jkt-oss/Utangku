import { db, type BarisPembayaran, type BarisTransaksi } from '@/data/db';
import { antreKeOutbox, idBaru, sekarang } from './dasar';
import { jadwalkanSync } from '@/data/sync/mesin';
import { sisaUtang, tanggalHariIni } from './transaksi';
import type { Enums } from '@/data/database.types';

export interface DataPembayaranBaru {
  warung_id: string;
  transaksi_id: string;
  pelanggan_id: string;
  nominal: number;
  metode?: Enums<'metode_bayar'>;
  catatan?: string | null;
  tanggal?: string;
  dibuat_oleh?: string | null;
}

/**
 * Cerminan lokal dari trigger fn_hitung_ulang_utang di server.
 *
 * Ini menulis LANGSUNG ke tabel lokal tanpa lewat outbox — disengaja.
 * Kolom status dan total_dibayar milik server; mengantrekannya hanya akan
 * menghasilkan permintaan yang isinya dibuang. Nilai lokal ini cuma supaya
 * angka di layar benar saat offline, dan akan ditimpa nilai resmi server
 * pada penarikan data berikutnya.
 *
 * Dipanggil dari dalam transaksi yang sama dengan penulisan pembayarannya.
 */
async function hitungUlangUtangLokal(transaksiId: string) {
  const transaksi = await db.transaksi_utang.get(transaksiId);
  if (!transaksi) return;

  const pembayaran = await db.pembayaran.where('transaksi_id').equals(transaksiId).toArray();
  const totalDibayar = pembayaran
    .filter((b) => b.deleted_at === null)
    .reduce((jumlah, b) => jumlah + Math.round(b.nominal), 0);

  await db.transaksi_utang.put({
    ...transaksi,
    total_dibayar: totalDibayar,
    status:
      totalDibayar >= Math.round(transaksi.nominal)
        ? 'lunas'
        : totalDibayar > 0
          ? 'sebagian'
          : 'belum_lunas',
  });
}

/**
 * Menulis pembayaran, mengantrekannya, dan menghitung ulang utangnya dalam
 * SATU transaksi Dexie.
 *
 * Ketiganya harus atomik. Kalau baris pembayaran tersimpan lebih dulu dan
 * perhitungan ulangnya menyusul belakangan, sempat ada keadaan di mana
 * cicilan sudah hilang dari riwayat tapi sisa utangnya belum berubah — dan
 * pada aplikasi yang mencatat uang orang, keadaan setengah jadi seperti itu
 * tidak boleh pernah terlihat.
 */
async function tulisPembayaran(baris: BarisPembayaran) {
  await db.transaction(
    'rw',
    [db.pembayaran, db.transaksi_utang, db.outbox],
    async () => {
      await db.pembayaran.put(baris);
      await antreKeOutbox('pembayaran', baris as unknown as { id: string } & Record<string, unknown>);
      await hitungUlangUtangLokal(baris.transaksi_id);
    },
  );
  jadwalkanSync('mutasi');
}

export async function catatPembayaran(data: DataPembayaranBaru) {
  const waktu = sekarang();
  const baris: BarisPembayaran = {
    id: idBaru(),
    warung_id: data.warung_id,
    transaksi_id: data.transaksi_id,
    pelanggan_id: data.pelanggan_id,
    tanggal: data.tanggal ?? tanggalHariIni(),
    nominal: Math.round(data.nominal),
    metode: data.metode ?? 'tunai',
    catatan: data.catatan?.trim() || null,
    dibuat_oleh: data.dibuat_oleh ?? null,
    created_at: waktu,
    updated_at: waktu,
    deleted_at: null,
  };

  await tulisPembayaran(baris);
  return baris;
}

/**
 * Melunasi beberapa utang sekaligus: satu pembayaran sebesar sisa untuk
 * masing-masing utang, dari yang paling lama. Tiap utang tetap punya
 * riwayat cicilannya sendiri, jadi laporan dan pembatalan per utang tidak
 * berubah — pemilik hanya tidak perlu mengetuk satu per satu.
 */
export async function lunasiSemua(
  utang: BarisTransaksi[],
  opsi: { metode: Enums<'metode_bayar'>; dibuatOleh: string | null },
) {
  const urut = [...utang].sort(
    (a, b) => a.tanggal.localeCompare(b.tanggal) || a.created_at.localeCompare(b.created_at),
  );
  for (const t of urut) {
    const sisa = sisaUtang(t);
    if (sisa <= 0 || !t.pelanggan_id) continue;
    await catatPembayaran({
      warung_id: t.warung_id,
      transaksi_id: t.id,
      pelanggan_id: t.pelanggan_id,
      nominal: sisa,
      metode: opsi.metode,
      catatan: 'Lunas sekaligus',
      dibuat_oleh: opsi.dibuatOleh,
    });
  }
}

/**
 * Pembayaran hanya ditambah atau di-soft-delete, tidak pernah diubah
 * nominalnya. Itu yang membuat penggabungan data saat sync tidak bisa
 * menghilangkan angka cicilan (lihat PLAN.md bagian 7.3).
 */
export async function hapusPembayaran(id: string) {
  const lama = await db.pembayaran.get(id);
  if (!lama) throw new Error('Pembayaran tidak ditemukan.');
  const waktu = sekarang();
  await tulisPembayaran({ ...lama, deleted_at: waktu, updated_at: waktu });
}

const terbaruDulu = <T extends { tanggal: string; created_at: string }>(baris: T[]) =>
  baris.sort(
    (a, b) => b.tanggal.localeCompare(a.tanggal) || b.created_at.localeCompare(a.created_at),
  );

export const riwayatPembayaran = async (transaksiId: string) =>
  terbaruDulu(
    await db.pembayaran
      .where('transaksi_id')
      .equals(transaksiId)
      .filter((b) => b.deleted_at === null)
      .toArray(),
  );

export const riwayatPembayaranPelanggan = async (pelangganId: string) =>
  terbaruDulu(
    await db.pembayaran
      .where('pelanggan_id')
      .equals(pelangganId)
      .filter((b) => b.deleted_at === null)
      .toArray(),
  );
