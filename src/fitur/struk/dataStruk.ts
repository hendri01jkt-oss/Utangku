import { db } from '@/data/db';
import { sisaUtang } from '@/data/repo/transaksi';
import { lebarKertasSah, type DataStruk, type LebarKertas } from './barisStruk';

/** Jam:menit menurut jam perangkat, dua digit. */
const jamSekarang = (waktu = new Date()): string =>
  `${String(waktu.getHours()).padStart(2, '0')}:${String(waktu.getMinutes()).padStart(2, '0')}`;

export interface StrukSiap {
  data: DataStruk;
  lebar: LebarKertas;
}

/**
 * Menyusun isi struk dari data LOKAL saja.
 *
 * Semuanya dibaca dari Dexie — tidak ada satu pun panggilan jaringan. Itu
 * bukan kebetulan: struk paling sering dicetak tepat setelah utang dicatat,
 * dan pencatatan itu justru dirancang untuk tetap jalan saat sinyal mati.
 * Struk yang butuh internet akan gagal persis di saat ia paling dibutuhkan.
 *
 * @returns null bila transaksinya tidak ada di perangkat ini
 */
export async function siapkanStruk(transaksiId: string): Promise<StrukSiap | null> {
  const transaksi = await db.transaksi_utang.get(transaksiId);
  if (!transaksi) return null;

  const [warung, pelanggan] = await Promise.all([
    db.warung.get(transaksi.warung_id),
    db.pelanggan.get(transaksi.pelanggan_id),
  ]);
  if (!warung) return null;

  /*
   * Sisa utang SELURUH transaksi pelanggan ini, bukan hanya yang barusan.
   *
   * Inilah angka yang sebenarnya ingin diketahui pembeli saat menerima
   * struk: "jadi total utang saya sekarang berapa". Dihitung ulang dari
   * baris-baris lokal, termasuk transaksi yang baru saja dicatat dan belum
   * tersinkron — kalau memakai angka dari server, struk yang dicetak saat
   * offline akan menyebut jumlah yang sudah kedaluwarsa.
   */
  const transaksiPelanggan = await db.transaksi_utang
    .where('pelanggan_id')
    .equals(transaksi.pelanggan_id)
    .filter((t) => t.deleted_at === null)
    .toArray();
  const sisaTotal = transaksiPelanggan.reduce((jumlah, t) => jumlah + sisaUtang(t), 0);

  return {
    lebar: lebarKertasSah(warung.lebar_struk),
    data: {
      namaWarung: warung.nama_warung,
      alamatWarung: warung.alamat,
      noWaWarung: warung.no_wa_warung,
      tanggal: transaksi.tanggal,
      waktu: jamSekarang(),
      namaPelanggan: pelanggan?.nama ?? 'Pelanggan',
      keterangan: transaksi.keterangan,
      nominal: transaksi.nominal,
      sisaUtangPelanggan: sisaTotal,
    },
  };
}
