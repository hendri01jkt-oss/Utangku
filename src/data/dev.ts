import { db } from './db';
import * as pelanggan from './repo/pelanggan';
import * as transaksi from './repo/transaksi';
import * as item from './repo/item';
import * as pembayaran from './repo/pembayaran';
import { sinkronSekarang } from './sync/mesin';
import * as laporan from '@/fitur/laporan/dataLaporan';
import * as ringkasan from '@/fitur/beranda/ringkasanWarung';
import * as ekspor from '@/fitur/laporan/ekspor';
import * as struk from '@/fitur/struk/barisStruk';
import * as escpos from '@/fitur/struk/escpos';
import * as gambarStruk from '@/fitur/struk/gambarStruk';
import * as dataStruk from '@/fitur/struk/dataStruk';

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
      ...item,
      ...pembayaran,
      ...laporan,
      ...ringkasan,
      ...ekspor,
      ...struk,
      ...escpos,
      ...gambarStruk,
      ...dataStruk,
      sinkronSekarang,
    },
  });
}
