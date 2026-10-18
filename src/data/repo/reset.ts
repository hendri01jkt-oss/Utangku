import { db } from '@/data/db';
import { ambilSupabase } from '@/lib/supabase';

const BUCKET = 'foto-pelanggan';

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
  const supabase = await ambilSupabase();

  const { error } = await supabase.rpc('reset_data_warung');
  if (error) throw error;

  // Foto bukan bagian dari tabel; hapus sebisanya. Gagal di sini tidak
  // membatalkan reset karena datanya sudah terhapus dan fotonya tak lagi
  // menunjuk ke pelanggan mana pun.
  try {
    const { data: berkas } = await supabase.storage.from(BUCKET).list(warungId, { limit: 1000 });
    if (berkas && berkas.length > 0) {
      await supabase.storage.from(BUCKET).remove(berkas.map((b) => `${warungId}/${b.name}`));
    }
  } catch {
    // diabaikan, lihat catatan di atas
  }

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
