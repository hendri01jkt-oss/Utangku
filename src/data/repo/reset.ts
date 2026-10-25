import { db } from '@/data/db';
import { api } from '@/lib/api';

/**
 * Menghapus SEMUA data warung: pelanggan, utang, rincian item, pembayaran,
 * dan foto. Akun serta pengaturan warung tetap.
 *
 * Urutannya penting. Server dikerjakan LEBIH DULU; baru kalau berhasil, HP
 * dikosongkan. Dibalik, kegagalan jaringan akan meninggalkan HP kosong
 * sementara data di server masih utuh — dan sync berikutnya mengembalikannya
 * seolah tidak terjadi apa-apa.
 *
 * Antrean outbox ikut dibuang: perubahan yang belum terkirim milik data yang
 * baru saja dihapus tidak boleh sampai ke server dan menghidupkannya lagi.
 */
export async function resetDataWarung(warungId: string): Promise<void> {
  // Server menghapus data (dan foto, sebisanya) dalam satu panggilan.
  void warungId;
  await api('/reset-data', { method: 'POST', json: {} });

  await db.transaction(
    'rw',
    [db.pelanggan, db.transaksi_utang, db.transaksi_item, db.pembayaran, db.outbox, db.foto],
    async () => {
      await Promise.all([
        db.pelanggan.clear(),
        db.transaksi_utang.clear(),
        db.transaksi_item.clear(),
        db.pembayaran.clear(),
        db.outbox.clear(),
        db.foto.clear(),
      ]);
    },
  );
}
