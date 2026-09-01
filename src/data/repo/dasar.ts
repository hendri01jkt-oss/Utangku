import { db, type NamaEntitas } from '@/data/db';
import { jadwalkanSync } from '@/data/sync/mesin';

/**
 * Kolom yang HANYA boleh diisi server, jadi tidak pernah ikut dikirim.
 *
 * Untuk transaksi_utang ini bukan sekadar kerapian: hak INSERT/UPDATE pada
 * kolom `status` dan `total_dibayar` sudah dicabut dari peran authenticated
 * di migrasi 0003. Menyertakannya membuat PostgREST menolak seluruh baris
 * dengan "permission denied", bukan mengabaikannya diam-diam.
 */
const KOLOM_MILIK_SERVER: Record<NamaEntitas, readonly string[]> = {
  // pemilik_id ikut dibuang: kepemilikan warung bukan sesuatu yang boleh
  // berpindah lewat sinkronisasi biasa.
  warung: ['created_at', 'updated_at', 'pemilik_id'],
  // terakhir_dilihat_pelanggan hanya ditulis fungsi pantau_utang() di server,
  // dan hak UPDATE-nya sudah dicabut dari authenticated di migrasi 0012.
  // Kalau ikut dikirim, PostgREST menolak SELURUH baris dengan "permission
  // denied" — dan sebelum itu pun nilainya sudah basi: baris yang ditarik ke
  // perangkat membawa stempel lama, lalu suntingan berikutnya akan
  // menimpanya di atas kunjungan yang lebih baru.
  pelanggan: ['created_at', 'updated_at', 'terakhir_dilihat_pelanggan'],
  transaksi_utang: ['created_at', 'updated_at', 'status', 'total_dibayar'],
  // subtotal adalah kolom generated di server. PostgreSQL menolak INSERT
  // yang menyebutnya sama sekali — "cannot insert a non-DEFAULT value into
  // column subtotal" — jadi menyertakannya menggagalkan SELURUH baris item,
  // bukan sekadar diabaikan.
  transaksi_item: ['created_at', 'updated_at', 'subtotal'],
  pembayaran: ['created_at', 'updated_at'],
};

export function muatanUntukServer(
  entitas: NamaEntitas,
  baris: Record<string, unknown>,
): Record<string, unknown> {
  const buang = new Set(KOLOM_MILIK_SERVER[entitas]);
  return Object.fromEntries(
    Object.entries(baris).filter(([kunci]) => !buang.has(kunci)),
  );
}

/** Stempel waktu lokal sementara, ditimpa nilai server saat sync menarik data. */
export const sekarang = () => new Date().toISOString();

export const idBaru = () => crypto.randomUUID();

type TabelDexie =
  | typeof db.warung
  | typeof db.pelanggan
  | typeof db.transaksi_utang
  | typeof db.pembayaran;

/**
 * Mengantrekan satu baris ke outbox.
 *
 * HARUS dipanggil dari dalam transaksi Dexie yang sudah mencakup db.outbox.
 * Dipisahkan dari simpanDanAntre supaya pemanggil yang perlu menulis
 * beberapa tabel sekaligus (mis. pembayaran beserta perhitungan ulang
 * utangnya) bisa melakukannya dalam SATU transaksi.
 */
export async function antreKeOutbox(
  entitas: NamaEntitas,
  baris: { id: string } & Record<string, unknown>,
) {
  const muatan = muatanUntukServer(entitas, baris);

  // Kalau baris ini sudah punya entri yang menunggu, muatannya diperbarui
  // DI TEMPAT — bukan dihapus lalu ditambahkan di belakang. Memindahkannya
  // ke ujung antrean akan mengacaukan urutan: pembayaran bisa terkirim
  // sebelum transaksi yang menjadi induknya.
  const menunggu = await db.outbox.where('[entitas+id]').equals([entitas, baris.id]).first();

  if (menunggu?.urutan !== undefined) {
    await db.outbox.update(menunggu.urutan, {
      muatan,
      // Data berubah, jadi galat sebelumnya belum tentu masih berlaku:
      // beri kesempatan sekali lagi.
      galat: null,
      percobaan: 0,
    });
    return;
  }

  await db.outbox.add({
    entitas,
    id: baris.id,
    muatan,
    dibuat_at: sekarang(),
    percobaan: 0,
    galat: null,
  });
}

/**
 * Menulis satu baris ke tabel lokal DAN mengantrekannya ke outbox dalam satu
 * transaksi Dexie. Keduanya berhasil atau keduanya gagal — sehingga tidak
 * mungkin ada data yang tersimpan di perangkat tapi tidak pernah antre
 * untuk dikirim.
 */
export async function simpanDanAntre<T extends { id: string }>(
  entitas: NamaEntitas,
  tabel: TabelDexie,
  baris: T,
): Promise<T> {
  await db.transaction('rw', [tabel, db.outbox], async () => {
    await (tabel as unknown as { put: (b: T) => Promise<unknown> }).put(baris);
    await antreKeOutbox(entitas, baris as { id: string } & Record<string, unknown>);
  });

  jadwalkanSync('mutasi');
  return baris;
}
