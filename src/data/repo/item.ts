import { db, type BarisItem } from '@/data/db';
import { idBaru, sekarang } from './dasar';

/** Satu baris rincian yang diketik pemilik warung, sebelum jadi baris database. */
export interface ItemBaru {
  nama_item: string;
  qty: number;
  harga_satuan: number;
}

export const itemKosong = (): ItemBaru => ({ nama_item: '', qty: 1, harga_satuan: 0 });

/** Baris yang benar-benar layak disimpan: punya nama dan qty positif. */
export const itemTerisi = (daftar: readonly ItemBaru[]): ItemBaru[] =>
  daftar.filter((i) => i.nama_item.trim() !== '' && i.qty > 0);

export const subtotalItem = (i: { qty: number; harga_satuan: number }) =>
  Math.round(i.qty) * Math.round(i.harga_satuan);

export const totalItem = (daftar: readonly ItemBaru[]) =>
  daftar.reduce((jumlah, i) => jumlah + subtotalItem(i), 0);

/**
 * Ringkasan teks dari rincian item, mis. "nasi rames x2, es teh x1".
 *
 * Ini yang membuat rincian item menjadi TAMBAHAN, bukan pengganti. Hasilnya
 * ditulis ke kolom `keterangan` yang sudah ada, sehingga setiap permukaan
 * lama — pesan tagihan WhatsApp, ekspor PDF dan Excel, halaman pantau —
 * tetap punya sesuatu untuk ditampilkan tanpa satu baris pun diubah.
 * Permukaan yang sadar-item membaca tabelnya dan menggambar daftar.
 *
 * Sekaligus jaring pengaman: kalau baris item gagal tersinkron, keterangannya
 * sudah menyatu di baris transaksi dan tidak ikut hilang.
 */
export function ringkasanItem(daftar: readonly ItemBaru[]): string {
  return daftar
    .map((i) => `${i.nama_item.trim()}${i.qty > 1 ? ` x${i.qty}` : ''}`)
    .filter(Boolean)
    .join(', ');
}

export function barisItemBaru(
  warungId: string,
  transaksiId: string,
  daftar: readonly ItemBaru[],
): BarisItem[] {
  const waktu = sekarang();
  return daftar.map((i, urutan) => ({
    id: idBaru(),
    warung_id: warungId,
    transaksi_id: transaksiId,
    urutan,
    nama_item: i.nama_item.trim(),
    qty: Math.round(i.qty),
    harga_satuan: Math.round(i.harga_satuan),
    // Dihitung lokal hanya supaya UI punya angka sebelum sync. Server
    // menghitungnya sendiri sebagai kolom generated, dan nilai ini tidak
    // pernah ikut dikirim.
    subtotal: subtotalItem(i),
    created_at: waktu,
    updated_at: waktu,
    deleted_at: null,
  }));
}

/** Item satu transaksi, urut sesuai cara pemiliknya mencatat. */
export const itemTransaksi = async (transaksiId: string): Promise<BarisItem[]> => {
  const baris = await db.transaksi_item
    .where('transaksi_id')
    .equals(transaksiId)
    .filter((i) => i.deleted_at === null)
    .toArray();
  return baris.sort((a, b) => a.urutan - b.urutan || a.created_at.localeCompare(b.created_at));
};

/** Item untuk beberapa transaksi sekaligus, dikelompokkan per transaksi. */
export async function itemPerTransaksi(
  idTransaksi: readonly string[],
): Promise<Map<string, BarisItem[]>> {
  if (idTransaksi.length === 0) return new Map();
  const semua = await db.transaksi_item
    .where('transaksi_id')
    .anyOf([...idTransaksi])
    .filter((i) => i.deleted_at === null)
    .toArray();

  const peta = new Map<string, BarisItem[]>();
  for (const i of semua) {
    const daftar = peta.get(i.transaksi_id);
    if (daftar) daftar.push(i);
    else peta.set(i.transaksi_id, [i]);
  }
  for (const daftar of peta.values()) {
    daftar.sort((a, b) => a.urutan - b.urutan || a.created_at.localeCompare(b.created_at));
  }
  return peta;
}
