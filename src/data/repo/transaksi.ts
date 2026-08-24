import { db, type BarisTransaksi } from '@/data/db';
import { idBaru, sekarang, simpanDanAntre } from './dasar';

export interface DataUtangBaru {
  warung_id: string;
  pelanggan_id: string;
  nominal: number;
  keterangan?: string | null;
  tanggal?: string;
  jatuh_tempo?: string | null;
  reminder_hari_sebelum?: number;
  dibuat_oleh?: string | null;
}

/** Tanggal hari ini menurut zona waktu perangkat, format YYYY-MM-DD. */
export function tanggalHariIni(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export async function catatUtang(data: DataUtangBaru) {
  const waktu = sekarang();
  const baris: BarisTransaksi = {
    id: idBaru(),
    warung_id: data.warung_id,
    pelanggan_id: data.pelanggan_id,
    tanggal: data.tanggal ?? tanggalHariIni(),
    nominal: Math.round(data.nominal),
    keterangan: data.keterangan?.trim() || null,
    jatuh_tempo: data.jatuh_tempo ?? null,
    // status dan total_dibayar diisi di sini hanya sebagai nilai awal lokal
    // agar UI punya sesuatu untuk ditampilkan sebelum sync. Keduanya tidak
    // pernah dikirim ke server — server yang menghitungnya dari pembayaran.
    status: 'belum_lunas',
    total_dibayar: 0,
    reminder_hari_sebelum: data.reminder_hari_sebelum ?? 3,
    reminder_terkirim_untuk: null,
    dibuat_oleh: data.dibuat_oleh ?? null,
    created_at: waktu,
    updated_at: waktu,
    deleted_at: null,
  };
  return simpanDanAntre('transaksi_utang', db.transaksi_utang, baris);
}

export async function ubahUtang(
  id: string,
  perubahan: Partial<
    Pick<BarisTransaksi, 'nominal' | 'keterangan' | 'tanggal' | 'jatuh_tempo' | 'deleted_at'>
  >,
) {
  const lama = await db.transaksi_utang.get(id);
  if (!lama) throw new Error('Transaksi tidak ditemukan.');
  return simpanDanAntre('transaksi_utang', db.transaksi_utang, {
    ...lama,
    ...perubahan,
    updated_at: sekarang(),
  });
}

export const hapusUtang = (id: string) => ubahUtang(id, { deleted_at: sekarang() });

export const daftarUtangPelanggan = (pelangganId: string) =>
  db.transaksi_utang
    .where('pelanggan_id')
    .equals(pelangganId)
    .filter((t) => t.deleted_at === null)
    .reverse()
    .sortBy('tanggal');

export const ambilUtang = (id: string) => db.transaksi_utang.get(id);

/** Sisa utang satu transaksi, tidak pernah negatif walau terjadi kelebihan bayar. */
export const sisaUtang = (t: BarisTransaksi) =>
  Math.max(Math.round(t.nominal) - Math.round(t.total_dibayar), 0);
