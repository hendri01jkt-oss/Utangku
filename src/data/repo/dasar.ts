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
  pelanggan: ['created_at', 'updated_at'],
  transaksi_utang: ['created_at', 'updated_at', 'status', 'total_dibayar'],
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

type TabelDexie = typeof db.pelanggan | typeof db.transaksi_utang | typeof db.pembayaran;

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

    const muatan = muatanUntukServer(entitas, baris as Record<string, unknown>);

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
    } else {
      await db.outbox.add({
        entitas,
        id: baris.id,
        muatan,
        dibuat_at: sekarang(),
        percobaan: 0,
        galat: null,
      });
    }
  });

  jadwalkanSync('mutasi');
  return baris;
}
