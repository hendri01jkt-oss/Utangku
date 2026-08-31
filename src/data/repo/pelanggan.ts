import { db, type BarisPelanggan } from '@/data/db';
import { idBaru, sekarang, simpanDanAntre } from './dasar';

export interface DataPelangganBaru {
  warung_id: string;
  nama: string;
  no_wa?: string | null;
  alamat?: string | null;
  catatan?: string | null;
  foto_path?: string | null;
}

export async function buatPelanggan(data: DataPelangganBaru) {
  const waktu = sekarang();
  const baris: BarisPelanggan = {
    // ID dibuat di perangkat supaya sinkronisasi berupa upsert idempoten —
    // tidak ada ID sementara yang perlu dicocokkan ulang setelah online.
    id: idBaru(),
    warung_id: data.warung_id,
    nama: data.nama.trim(),
    no_wa: data.no_wa?.trim() || null,
    alamat: data.alamat?.trim() || null,
    catatan: data.catatan?.trim() || null,
    foto_path: data.foto_path ?? null,
    status: 'aktif',
    // Token dibuat di perangkat, bukan menunggu default server: pelanggan
    // yang dicatat tanpa sinyal harus langsung punya link pantau yang bisa
    // disalin, bukan link yang baru ada setelah warung dapat sinyal.
    token_pantau: idBaru(),
    terakhir_dilihat_pelanggan: null,
    created_at: waktu,
    updated_at: waktu,
    deleted_at: null,
  };
  return simpanDanAntre('pelanggan', db.pelanggan, baris);
}

export async function ubahPelanggan(
  id: string,
  perubahan: Partial<Omit<BarisPelanggan, 'id' | 'warung_id'>>,
) {
  const lama = await db.pelanggan.get(id);
  if (!lama) throw new Error('Pelanggan tidak ditemukan.');
  return simpanDanAntre('pelanggan', db.pelanggan, {
    ...lama,
    ...perubahan,
    updated_at: sekarang(),
  });
}

/**
 * Membuat token baru untuk link pantau pelanggan.
 *
 * Dipakai kalau link lama bocor — diteruskan di grup WA, misalnya. Tidak ada
 * cara menarik kembali pesan yang sudah tersebar, jadi satu-satunya
 * pencabutan yang berarti adalah membuat token lama berhenti berlaku.
 */
export async function gantiTokenPantau(id: string) {
  return ubahPelanggan(id, { token_pantau: idBaru() });
}

/** Hapus = soft delete, supaya penghapusan ikut tersinkron dan tidak hidup lagi. */
export async function hapusPelanggan(id: string) {
  return ubahPelanggan(id, { deleted_at: sekarang() });
}

export const daftarPelanggan = (warungId: string) =>
  db.pelanggan
    .where('warung_id')
    .equals(warungId)
    .filter((p) => p.deleted_at === null)
    .sortBy('nama');

export const ambilPelanggan = (id: string) => db.pelanggan.get(id);
