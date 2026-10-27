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

  // Tanpa batas waktu, jaringan yang macet membuat tombol "Menghapus…" menggantung selamanya.
  const pengendali = new AbortController();
  const batas = setTimeout(() => pengendali.abort(), 30_000);
  try {
    await api('/reset-data', { method: 'POST', json: {}, sinyal: pengendali.signal });
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new Error('Server tidak menjawab dalam 30 detik. Belum ada yang terhapus.');
    }
    throw err;
  } finally {
    clearTimeout(batas);
  }

  // Dikosongkan satu per satu (bukan satu transaksi besar): satu tabel yang
  // tersangkut tidak lagi menahan seluruhnya, dan outbox dikosongkan LEBIH
  // DULU supaya perubahan lama tidak sempat terkirim ulang.
  await db.outbox.clear();
  await db.pembayaran.clear();
  await db.transaksi_item.clear();
  await db.transaksi_utang.clear();
  await db.pelanggan.clear();
  await db.foto.clear();
}
