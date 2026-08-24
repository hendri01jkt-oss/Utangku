import { db } from './db';
import * as pelanggan from './repo/pelanggan';
import * as transaksi from './repo/transaksi';
import * as pembayaran from './repo/pembayaran';
import { sinkronSekarang } from './sync/mesin';
import * as laporan from '@/fitur/laporan/dataLaporan';
import * as ekspor from '@/fitur/laporan/ekspor';

/**
 * Jalan masuk ke lapisan data dari konsol browser — HANYA saat mode
 * pengembangan (`import.meta.env.DEV`), tidak pernah ikut ke build produksi.
 *
 * Ada karena lapisan data selesai lebih dulu daripada layar CRUD-nya
 * (Tahap 4-6), jadi ini satu-satunya cara menguji offline dan sinkronisasi
 * sekarang. Contoh pemakaian di DevTools:
 *
 *   await utangku.buatPelanggan({ warung_id: w, nama: 'Bu Siti' })
 *   await utangku.db.outbox.toArray()
 */
export function pasangSeamDev() {
  Object.assign(window, {
    utangku: {
      db,
      ...pelanggan,
      ...transaksi,
      ...pembayaran,
      ...laporan,
      ...ekspor,
      sinkronSekarang,
    },
  });
}
