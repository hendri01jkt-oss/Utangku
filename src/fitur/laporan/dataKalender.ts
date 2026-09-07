import { db, type BarisPelanggan } from '@/data/db';
import { tanggalHariIni } from '@/data/repo/transaksi';
import type {
  BarisLaporanBayar,
  BarisLaporanTunai,
  BarisLaporanUtang,
  Periode,
} from './dataLaporan';

/** Bulan dalam bentuk "YYYY-MM" — sama urutannya sebagai teks maupun waktu. */
export type Bulan = string;

/** Isi satu hari pada kalender: barisnya sekaligus totalnya. */
export interface IsiHari {
  utangBaru: BarisLaporanUtang[];
  penjualanTunai: BarisLaporanTunai[];
  pembayaran: BarisLaporanBayar[];
  totalUtangBaru: number;
  totalPenjualanTunai: number;
  totalTertagih: number;
}

export interface RingkasanBulan {
  bulan: Bulan;
  /** Kunci = tanggal "YYYY-MM-DD". Hari tanpa transaksi tidak punya kunci. */
  hari: Map<string, IsiHari>;
}

const p2 = (n: number) => String(n).padStart(2, '0');

export const bulanDari = (tanggal: string): Bulan => tanggal.slice(0, 7);

export const bulanIni = (): Bulan => bulanDari(tanggalHariIni());

/** Jumlah hari pada bulan itu — hari ke-0 bulan berikutnya. */
export function jumlahHariBulan(bulan: Bulan): number {
  const [tahun = 0, bl = 1] = bulan.split('-').map(Number);
  return new Date(Date.UTC(tahun, bl, 0)).getUTCDate();
}

export function geserBulan(bulan: Bulan, langkah: number): Bulan {
  const [tahun = 0, bl = 1] = bulan.split('-').map(Number);
  const d = new Date(Date.UTC(tahun, bl - 1 + langkah, 1));
  return `${d.getUTCFullYear()}-${p2(d.getUTCMonth() + 1)}`;
}

/** Periode satu bulan penuh, dipakai sebagai periode laporan saat tab Kalender aktif. */
export function periodeBulan(bulan: Bulan): Periode {
  return { mulai: `${bulan}-01`, sampai: `${bulan}-${p2(jumlahHariBulan(bulan))}` };
}

export const judulBulan = (bulan: Bulan) =>
  new Date(`${bulan}-01T00:00:00`).toLocaleDateString('id-ID', {
    month: 'long',
    year: 'numeric',
  });

export const judulHari = (tanggal: string) =>
  new Date(`${tanggal}T00:00:00`).toLocaleDateString('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

/** Senin dulu, sesuai penanggalan Indonesia dan locale `id`. */
export const NAMA_HARI = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];

/**
 * Kotak-kotak satu bulan, termasuk sel kosong di awal supaya tanggal 1
 * jatuh di kolom harinya. `null` = sel penyeimbang, bukan tanggal.
 *
 * Fungsi murni dan hanya bergantung pada bulan, jadi hasilnya bisa
 * di-memo dan tidak perlu dihitung ulang setiap kali data berubah.
 */
export function selKalender(bulan: Bulan): (string | null)[] {
  const [tahun = 0, bl = 1] = bulan.split('-').map(Number);
  // getUTCDay: 0 = Minggu. Digeser supaya Senin jadi kolom pertama.
  const kosongDiAwal = (new Date(Date.UTC(tahun, bl - 1, 1)).getUTCDay() + 6) % 7;
  const hari = jumlahHariBulan(bulan);
  const sel: (string | null)[] = Array.from({ length: kosongDiAwal }, () => null);
  for (let h = 1; h <= hari; h++) sel.push(`${bulan}-${p2(h)}`);
  // Genapkan baris terakhir supaya grid tidak menyisakan kolom menggantung.
  while (sel.length % 7 !== 0) sel.push(null);
  return sel;
}

const hariKosong = (): IsiHari => ({
  utangBaru: [],
  penjualanTunai: [],
  pembayaran: [],
  totalUtangBaru: 0,
  totalPenjualanTunai: 0,
  totalTertagih: 0,
});

/**
 * Menyusun isi satu bulan untuk kalender, dari Dexie saja (tetap jalan offline).
 *
 * Yang dibaca hanya baris di dalam bulan itu, lewat indeks [warung_id+tanggal].
 * Hasilnya sudah dikelompokkan per tanggal, sehingga menggambar satu kotak
 * kalender maupun membuka rincian satu hari cukup menengok Map — tidak ada
 * penyaringan ulang seluruh riwayat setiap kali komponennya dirender.
 */
export async function susunKalender(
  warungId: string,
  bulan: Bulan,
): Promise<RingkasanBulan> {
  const { mulai, sampai } = periodeBulan(bulan);

  const [transaksi, pembayaran, pelanggan] = await Promise.all([
    db.transaksi_utang
      .where('[warung_id+tanggal]')
      .between([warungId, mulai], [warungId, sampai], true, true)
      .filter((t) => t.deleted_at === null)
      .toArray(),
    db.pembayaran
      .where('[warung_id+tanggal]')
      .between([warungId, mulai], [warungId, sampai], true, true)
      .filter((b) => b.deleted_at === null)
      .toArray(),
    /*
     * Pelanggan dibaca seluruhnya, bukan per bulan: jumlahnya dibatasi
     * banyaknya pelanggan warung (puluhan sampai ratusan), sedangkan
     * transaksi bertambah terus setiap hari. Yang perlu dijaga adalah yang
     * tumbuh tanpa batas.
     */
    db.pelanggan.where('warung_id').equals(warungId).toArray(),
  ]);

  const nama = new Map<string, BarisPelanggan>(pelanggan.map((p) => [p.id, p]));
  const namaDari = (id: string | null) =>
    id === null ? 'Pembeli umum' : (nama.get(id)?.nama ?? 'Pelanggan terhapus');

  const hari = new Map<string, IsiHari>();
  const isiHari = (tanggal: string) => {
    const ada = hari.get(tanggal);
    if (ada) return ada;
    const baru = hariKosong();
    hari.set(tanggal, baru);
    return baru;
  };

  /*
   * Urut waktu pencatatan supaya urutan dalam satu hari masuk akal bagi
   * pemiliknya: `tanggal` tidak menyimpan jam, jadi created_at yang dipakai.
   *
   * Nilainya diperlakukan sebagai boleh hilang. Muatan sync memang tidak
   * mengirim created_at, jadi baris yang sempat tersimpan dari balasan
   * server yang tidak lengkap bisa saja kosong — dan perbandingan yang
   * melempar di sini akan menjatuhkan SELURUH halaman Laporan ke
   * ErrorBoundary, bukan sekadar mengacak urutan satu hari.
   */
  const waktuCatat = (baris: { created_at?: string | null }) => baris.created_at ?? '';
  const urutCatat = (a: { created_at?: string | null }, b: { created_at?: string | null }) =>
    waktuCatat(a).localeCompare(waktuCatat(b));

  for (const t of [...transaksi].sort(urutCatat)) {
    const isi = isiHari(t.tanggal);
    const nominal = Math.round(t.nominal);
    if (t.jenis === 'tunai') {
      isi.penjualanTunai.push({
        tanggal: t.tanggal,
        namaPelanggan: namaDari(t.pelanggan_id),
        keterangan: t.keterangan ?? '',
        nominal,
      });
      isi.totalPenjualanTunai += nominal;
    } else {
      isi.utangBaru.push({
        tanggal: t.tanggal,
        namaPelanggan: namaDari(t.pelanggan_id),
        keterangan: t.keterangan ?? '',
        nominal,
        jatuhTempo: t.jatuh_tempo,
        status: t.status,
      });
      isi.totalUtangBaru += nominal;
    }
  }

  for (const b of [...pembayaran].sort(urutCatat)) {
    const isi = isiHari(b.tanggal);
    const nominal = Math.round(b.nominal);
    isi.pembayaran.push({
      tanggal: b.tanggal,
      namaPelanggan: namaDari(b.pelanggan_id),
      metode: b.metode,
      catatan: b.catatan ?? '',
      nominal,
    });
    isi.totalTertagih += nominal;
  }

  return { bulan, hari };
}
