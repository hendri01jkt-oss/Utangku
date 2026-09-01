import { db, type BarisItem, type BarisTransaksi } from '@/data/db';
import { antreKeOutbox, idBaru, sekarang, simpanDanAntre } from './dasar';
import { jadwalkanSync } from '@/data/sync/mesin';
import { barisItemBaru, ringkasanItem, totalItem, type ItemBaru } from './item';

export interface DataUtangBaru {
  warung_id: string;
  pelanggan_id: string;
  nominal: number;
  keterangan?: string | null;
  tanggal?: string;
  jatuh_tempo?: string | null;
  reminder_hari_sebelum?: number;
  dibuat_oleh?: string | null;
  /** Rincian item opsional. Kalau diisi, nominal dan keterangan diturunkan darinya. */
  item?: readonly ItemBaru[];
}

export interface DataTunaiBaru {
  warung_id: string;
  /** Boleh null: pembeli lewat yang tidak perlu dicatat identitasnya. */
  pelanggan_id?: string | null;
  nominal: number;
  keterangan?: string | null;
  tanggal?: string;
  dibuat_oleh?: string | null;
  item?: readonly ItemBaru[];
}

/**
 * Tanggal hari ini menurut Waktu Indonesia Barat, format YYYY-MM-DD.
 *
 * Sengaja dipatok ke Asia/Jakarta, bukan zona perangkat, supaya sama persis
 * dengan fungsi hari_ini() di database. Kalau jam HP salah setel zona, utang
 * yang dicatat malam hari bisa tercatat di tanggal yang berbeda dengan yang
 * dipakai server untuk menghitung jatuh tempo.
 */
export function tanggalHariIni(): string {
  // en-CA menghasilkan format YYYY-MM-DD.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

/** Menambah sejumlah hari pada tanggal YYYY-MM-DD, mis. untuk jatuh tempo. */
export function tambahHari(tanggal: string, hari: number): string {
  const d = new Date(`${tanggal}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + hari);
  return d.toISOString().slice(0, 10);
}

/**
 * Menulis satu transaksi beserta rincian itemnya dalam SATU transaksi Dexie.
 *
 * Keduanya diantre ke outbox di sini juga, dengan transaksinya lebih dulu.
 * Itu bukan kerapian: outbox dikuras berurutan, dan baris item punya foreign
 * key ke transaksinya — kalau item sampai lebih dulu, server menolaknya.
 * Pola yang sama sudah dipakai pembayaran terhadap transaksi induknya.
 */
async function simpanTransaksi(
  transaksi: BarisTransaksi,
  item: readonly ItemBaru[],
): Promise<BarisTransaksi> {
  const barisItem = barisItemBaru(transaksi.warung_id, transaksi.id, item);

  await db.transaction(
    'rw',
    [db.transaksi_utang, db.transaksi_item, db.outbox],
    async () => {
      await db.transaksi_utang.put(transaksi);
      await antreKeOutbox('transaksi_utang', transaksi);
      for (const baris of barisItem) {
        await db.transaksi_item.put(baris);
        await antreKeOutbox('transaksi_item', baris);
      }
    },
  );

  jadwalkanSync('mutasi');
  return transaksi;
}

/**
 * Nominal dan keterangan saat rincian item dipakai.
 *
 * Nominal diturunkan dari item supaya angka di struk tidak pernah berbeda
 * dari jumlah barisnya. Keterangan diisi ringkasannya supaya permukaan lama
 * yang hanya mengenal teks bebas tetap menampilkan sesuatu yang berarti.
 */
function dariItem(item: readonly ItemBaru[], nominal: number, keterangan?: string | null) {
  if (item.length === 0) {
    return { nominal: Math.round(nominal), keterangan: keterangan?.trim() || null };
  }
  return { nominal: totalItem(item), keterangan: ringkasanItem(item) || null };
}

export async function catatUtang(data: DataUtangBaru) {
  const waktu = sekarang();
  const item = data.item ?? [];
  const { nominal, keterangan } = dariItem(item, data.nominal, data.keterangan);

  const baris: BarisTransaksi = {
    id: idBaru(),
    warung_id: data.warung_id,
    pelanggan_id: data.pelanggan_id,
    jenis: 'utang',
    tanggal: data.tanggal ?? tanggalHariIni(),
    nominal,
    keterangan,
    jatuh_tempo: data.jatuh_tempo ?? null,
    // status dan total_dibayar diisi di sini hanya sebagai nilai awal lokal
    // agar UI punya sesuatu untuk ditampilkan sebelum sync. Keduanya tidak
    // pernah dikirim ke server — server yang menghitungnya dari pembayaran.
    status: 'belum_lunas',
    total_dibayar: 0,
    reminder_hari_sebelum: data.reminder_hari_sebelum ?? 3,
    reminder_terkirim_untuk: null,
    dibuat_oleh: data.dibuat_oleh ?? null,
    created_at: waktu,
    updated_at: waktu,
    deleted_at: null,
  };
  return simpanTransaksi(baris, item);
}

/**
 * Penjualan tunai: uangnya diterima di tempat, jadi ini BUKAN piutang.
 *
 * status dan total_dibayar diisi lunas secara lokal supaya beranda dan
 * halaman tagihan langsung benar sebelum sync. Di server, trigger
 * fn_status_utang() memaksa nilai yang sama — jadi kalaupun nilai lokal ini
 * salah, ia tidak akan pernah sampai ke sana.
 *
 * Sengaja TIDAK membuat baris `pembayaran`. Kalau dibuat, "Tertagih bulan
 * ini" — yang artinya utang yang berhasil ditagih — akan ikut membengkak,
 * sekaligus terhitung dua kali terhadap angka penjualan tunai.
 */
export async function catatTunai(data: DataTunaiBaru) {
  const waktu = sekarang();
  const item = data.item ?? [];
  const { nominal, keterangan } = dariItem(item, data.nominal, data.keterangan);

  const baris: BarisTransaksi = {
    id: idBaru(),
    warung_id: data.warung_id,
    pelanggan_id: data.pelanggan_id ?? null,
    jenis: 'tunai',
    tanggal: data.tanggal ?? tanggalHariIni(),
    nominal,
    keterangan,
    jatuh_tempo: null,
    status: 'lunas',
    total_dibayar: nominal,
    reminder_hari_sebelum: 3,
    reminder_terkirim_untuk: null,
    dibuat_oleh: data.dibuat_oleh ?? null,
    created_at: waktu,
    updated_at: waktu,
    deleted_at: null,
  };
  return simpanTransaksi(baris, item);
}

export async function ubahUtang(
  id: string,
  perubahan: Partial<
    Pick<BarisTransaksi, 'nominal' | 'keterangan' | 'tanggal' | 'jatuh_tempo' | 'deleted_at'>
  >,
) {
  const lama = await db.transaksi_utang.get(id);
  if (!lama) throw new Error('Transaksi tidak ditemukan.');
  return simpanDanAntre('transaksi_utang', db.transaksi_utang, {
    ...lama,
    ...perubahan,
    updated_at: sekarang(),
  });
}

/**
 * Mengganti seluruh rincian item sebuah transaksi.
 *
 * Ganti-semua, bukan cocokkan-per-baris: mencocokkan baris lama dengan baru
 * menuntut identitas yang tidak dimiliki item ("nasi rames" bisa muncul dua
 * kali dengan harga berbeda), dan salah cocok berarti angka uang yang salah.
 * Baris lama di-soft-delete supaya penghapusannya ikut tersinkron.
 */
export async function gantiItemTransaksi(
  transaksiId: string,
  item: readonly ItemBaru[],
): Promise<BarisTransaksi> {
  const transaksi = await db.transaksi_utang.get(transaksiId);
  if (!transaksi) throw new Error('Transaksi tidak ditemukan.');

  const waktu = sekarang();
  const lama: BarisItem[] = await db.transaksi_item
    .where('transaksi_id')
    .equals(transaksiId)
    .filter((i) => i.deleted_at === null)
    .toArray();
  const barisBaru = barisItemBaru(transaksi.warung_id, transaksiId, item);
  const { nominal, keterangan } = dariItem(item, transaksi.nominal, transaksi.keterangan);

  const transaksiBaru: BarisTransaksi = {
    ...transaksi,
    nominal,
    keterangan,
    updated_at: waktu,
  };

  await db.transaction(
    'rw',
    [db.transaksi_utang, db.transaksi_item, db.outbox],
    async () => {
      await db.transaksi_utang.put(transaksiBaru);
      await antreKeOutbox('transaksi_utang', transaksiBaru);

      for (const i of lama) {
        const dihapus: BarisItem = { ...i, deleted_at: waktu, updated_at: waktu };
        await db.transaksi_item.put(dihapus);
        await antreKeOutbox('transaksi_item', dihapus);
      }
      for (const i of barisBaru) {
        await db.transaksi_item.put(i);
        await antreKeOutbox('transaksi_item', i);
      }
    },
  );

  jadwalkanSync('mutasi');
  return transaksiBaru;
}

export const hapusUtang = (id: string) => ubahUtang(id, { deleted_at: sekarang() });

/**
 * Utang satu pelanggan, terbaru dulu.
 *
 * Diurutkan secara eksplisit di JavaScript, bukan mengandalkan sortBy:
 * di warung, beberapa utang pada tanggal yang sama adalah hal biasa, dan
 * tanpa pemecah seri urutannya jadi sembarang setiap kali dimuat.
 */
const urutTerbaru = (baris: BarisTransaksi[]) =>
  baris.sort(
    (a, b) => b.tanggal.localeCompare(a.tanggal) || b.created_at.localeCompare(a.created_at),
  );

const transaksiPelanggan = async (pelangganId: string, jenis: BarisTransaksi['jenis']) => {
  const baris = await db.transaksi_utang
    .where('pelanggan_id')
    .equals(pelangganId)
    .filter((t) => t.deleted_at === null && t.jenis === jenis)
    .toArray();
  return urutTerbaru(baris);
};

/** Hanya utang. Belanja tunai punya daftarnya sendiri di bawah. */
export const daftarUtangPelanggan = (pelangganId: string) =>
  transaksiPelanggan(pelangganId, 'utang');

/** Belanja tunai satu pelanggan — terpisah, dan tidak pernah masuk hitungan piutang. */
export const daftarTunaiPelanggan = (pelangganId: string) =>
  transaksiPelanggan(pelangganId, 'tunai');

export const ambilUtang = (id: string) => db.transaksi_utang.get(id);

/** Sisa utang satu transaksi, tidak pernah negatif walau terjadi kelebihan bayar. */
export const sisaUtang = (t: BarisTransaksi) =>
  Math.max(Math.round(t.nominal) - Math.round(t.total_dibayar), 0);
