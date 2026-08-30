import { db, type NamaEntitas } from '@/data/db';

/**
 * Menulis salinan baris dari server ke penyimpanan lokal — KECUALI baris itu
 * masih punya perubahan yang menunggu dikirim.
 *
 * Aturannya cuma satu dan berlaku untuk semua penulis: selama sebuah baris
 * masih menggantung di outbox, versi lokal yang menang. Kalau tidak,
 * perubahan yang belum sempat terkirim akan ditimpa data server yang justru
 * lebih tua, dan pemiliknya melihat suntingannya batal sendiri tanpa
 * penjelasan.
 *
 * Ditempatkan di satu tempat karena pernah dilanggar: mesin sync menjaganya
 * dengan benar, tapi pemuatan sesi punya jalur pintasnya sendiri yang
 * menimpa baris warung setiap kali aplikasi dibuka. Selama aturannya
 * tersebar di dua tempat, cukup satu yang lupa untuk menghilangkan data.
 *
 * @returns jumlah baris yang benar-benar ditulis
 */
export async function tulisSalinanServer(
  entitas: NamaEntitas,
  baris: readonly { id: string }[],
): Promise<number> {
  if (baris.length === 0) return 0;

  /*
   * Pembacaan penjaga dan penulisannya berada di SATU transaksi. Kalau
   * dipisah, ada celah sempit di antara keduanya: pengguna yang menekan
   * Simpan tepat pada saat itu akan mengantre dengan benar, tapi barisnya
   * keburu ditimpa data server yang sudah terlanjur dianggap boleh ditulis.
   * Dexie menjalankan transaksi rw pada tabel yang sama secara berurutan,
   * jadi menyatukannya menutup celah itu sepenuhnya.
   */
  return db.transaction('rw', [db.table(entitas), db.outbox], async () => {
    const menunggu = new Set(
      (await db.outbox.where('entitas').equals(entitas).toArray()).map((e) => e.id),
    );
    const bolehTulis = baris.filter((b) => !menunggu.has(b.id));
    if (bolehTulis.length > 0) await db.table(entitas).bulkPut(bolehTulis as never[]);
    return bolehTulis.length;
  });
}
