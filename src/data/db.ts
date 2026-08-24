import Dexie, { type EntityTable } from 'dexie';
import type { Tables } from './database.types';

export type BarisPelanggan = Tables<'pelanggan'>;
export type BarisTransaksi = Tables<'transaksi_utang'>;
export type BarisPembayaran = Tables<'pembayaran'>;

/** Tabel yang ikut disinkronkan dua arah. */
export type NamaEntitas = 'pelanggan' | 'transaksi_utang' | 'pembayaran';

/**
 * Satu perubahan yang menunggu dikirim ke server.
 *
 * Semua operasi berbentuk `upsert`, termasuk penghapusan — karena hapus di
 * UtangKu adalah soft delete (mengisi kolom deleted_at), bukan DELETE.
 * Itu membuat mesin sync hanya perlu memahami satu bentuk operasi.
 */
export interface EntriOutbox {
  urutan?: number;
  entitas: NamaEntitas;
  id: string;
  muatan: Record<string, unknown>;
  dibuat_at: string;
  percobaan: number;
  /**
   * Terisi bila server menolak muatan ini karena alasan yang tidak akan
   * hilang dengan mencoba ulang (validasi, RLS, hak kolom). Entri bergalat
   * dilewati pada penyaluran berikutnya supaya antrean tidak macet
   * selamanya di satu baris rusak.
   */
  galat: string | null;
}

/** Penyimpanan nilai kecil: penanda sinkronisasi per tabel, dll. */
export interface Meta {
  kunci: string;
  nilai: string;
}

export const db = new Dexie('utangku') as Dexie & {
  pelanggan: EntityTable<BarisPelanggan, 'id'>;
  transaksi_utang: EntityTable<BarisTransaksi, 'id'>;
  pembayaran: EntityTable<BarisPembayaran, 'id'>;
  outbox: EntityTable<EntriOutbox, 'urutan'>;
  meta: EntityTable<Meta, 'kunci'>;
};

db.version(1).stores({
  pelanggan: 'id, warung_id, nama, updated_at, deleted_at',
  transaksi_utang:
    'id, warung_id, pelanggan_id, status, jatuh_tempo, updated_at, deleted_at',
  pembayaran: 'id, warung_id, transaksi_id, pelanggan_id, updated_at, deleted_at',
  // ++urutan menjaga antrean tetap berurutan: transaksi harus sampai di
  // server sebelum pembayaran yang menunjuk ke sana, kalau tidak foreign
  // key-nya ditolak.
  outbox: '++urutan, entitas, galat, [entitas+id]',
  meta: 'kunci',
});

/** Membersihkan seluruh data lokal — dipakai saat pengguna keluar. */
export async function kosongkanDataLokal() {
  await db.transaction(
    'rw',
    [db.pelanggan, db.transaksi_utang, db.pembayaran, db.outbox, db.meta],
    async () => {
      await Promise.all([
        db.pelanggan.clear(),
        db.transaksi_utang.clear(),
        db.pembayaran.clear(),
        db.outbox.clear(),
        db.meta.clear(),
      ]);
    },
  );
}
