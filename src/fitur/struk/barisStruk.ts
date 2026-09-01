import { formatRupiahDatar } from '@/lib/uang';

/**
 * Lebar kertas yang didukung, dalam milimeter.
 *
 * Printer thermal beresolusi 203 dpi = 8 titik/mm. Area cetaknya selalu
 * lebih sempit dari kertasnya (ada margin mekanis di kiri-kanan), jadi
 * angka titiknya bukan sekadar lebar kertas dikali delapan.
 */
export const UKURAN_KERTAS = {
  58: { titik: 384, karakter: 32 },
  80: { titik: 576, karakter: 48 },
} as const;

export type LebarKertas = keyof typeof UKURAN_KERTAS;

export const lebarKertasSah = (nilai: number): LebarKertas =>
  nilai === 80 ? 80 : 58;

export interface ItemStruk {
  nama_item: string;
  qty: number;
  harga_satuan: number;
  subtotal: number;
}

export interface DataStruk {
  namaWarung: string;
  alamatWarung: string | null;
  noWaWarung: string | null;
  /** YYYY-MM-DD */
  tanggal: string;
  /** HH:MM, waktu pencatatan menurut jam perangkat. */
  waktu: string;
  /** null untuk penjualan tunai kepada pembeli yang tidak dicatat namanya. */
  namaPelanggan: string | null;
  keterangan: string | null;
  nominal: number;
  /** Sisa utang SELURUH transaksi pelanggan ini, termasuk yang baru dicatat. */
  sisaUtangPelanggan: number;
  jenis: 'utang' | 'tunai';
  /** Kosong bila pemiliknya memilih keterangan teks bebas. */
  item: readonly ItemStruk[];
}

export type BarisStruk =
  | { jenis: 'teks'; isi: string; rata: 'kiri' | 'tengah'; tebal?: boolean }
  | { jenis: 'pisah' }
  | { jenis: 'kosong' };

/** Memenggal teks panjang agar muat pada lebar kolom, memotong per kata. */
export function penggal(teks: string, lebar: number): string[] {
  const kata = teks.split(/\s+/).filter(Boolean);
  if (kata.length === 0) return [];

  const hasil: string[] = [];
  let baris = '';

  for (const k of kata) {
    // Kata tunggal yang lebih panjang dari kolom dipotong paksa, kalau tidak
    // ia akan menonjol keluar dari kertas dan terpotong printer.
    if (k.length > lebar) {
      if (baris) {
        hasil.push(baris);
        baris = '';
      }
      for (let i = 0; i < k.length; i += lebar) hasil.push(k.slice(i, i + lebar));
      continue;
    }
    if (!baris) baris = k;
    else if (baris.length + 1 + k.length <= lebar) baris += ' ' + k;
    else {
      hasil.push(baris);
      baris = k;
    }
  }

  if (baris) hasil.push(baris);
  return hasil;
}

/**
 * Satu baris dengan label di kiri dan nilai di kanan.
 *
 * Kalau keduanya tidak muat bersama, nilai diletakkan di baris sendiri —
 * lebih baik dua baris rapi daripada satu baris yang angkanya terpotong.
 */
export function duaKolom(kiri: string, kanan: string, lebar: number): string[] {
  if (kiri.length + kanan.length + 1 <= lebar) {
    return [kiri + ' '.repeat(lebar - kiri.length - kanan.length) + kanan];
  }
  return [...penggal(kiri, lebar), kanan.padStart(lebar)];
}

/**
 * Menyusun isi struk sebagai daftar baris, bebas dari cara mencetaknya.
 *
 * Dipakai DUA kali: sekali untuk menggambar di canvas, sekali untuk
 * menyusun byte ESC/POS. Kalau masing-masing menyusun isinya sendiri,
 * gambar yang dibagikan dan kertas yang tercetak bisa berbeda isi tanpa ada
 * yang menyadarinya.
 */
export function barisStruk(data: DataStruk, lebar: number): BarisStruk[] {
  const teks = (isi: string, rata: 'kiri' | 'tengah' = 'kiri', tebal = false): BarisStruk =>
    ({ jenis: 'teks', isi, rata, tebal });

  const baris: BarisStruk[] = [];

  baris.push(teks(data.namaWarung.toUpperCase(), 'tengah', true));
  if (data.alamatWarung?.trim()) {
    for (const b of penggal(data.alamatWarung.trim(), lebar)) baris.push(teks(b, 'tengah'));
  }
  baris.push({ jenis: 'pisah' });

  const tunai = data.jenis === 'tunai';

  for (const b of duaKolom('Tanggal', `${data.tanggal} ${data.waktu}`, lebar)) baris.push(teks(b));
  // Pembeli tanpa nama tidak diberi baris kosong "Pelanggan: -": pada kertas
  // 32 kolom setiap baris yang tidak berguna terasa mahal.
  if (data.namaPelanggan) {
    for (const b of duaKolom('Pelanggan', data.namaPelanggan, lebar)) baris.push(teks(b));
  }
  baris.push({ jenis: 'pisah' });

  baris.push(teks(tunai ? 'STRUK PEMBELIAN' : 'CATATAN UTANG', 'tengah', true));
  baris.push({ jenis: 'kosong' });

  if (data.item.length > 0) {
    /*
     * Rincian item ditulis dua baris per item: namanya penuh di baris
     * pertama, lalu "qty x harga" di kiri dan subtotal di kanan. Memaksanya
     * jadi satu baris membuat nama item terpotong pada 32 kolom — dan nama
     * item yang terpotong persis menghapus gunanya rincian.
     */
    for (const i of data.item) {
      for (const b of penggal(i.nama_item, lebar)) baris.push(teks(b));
      for (const b of duaKolom(
        `  ${i.qty} x ${formatRupiahDatar(i.harga_satuan)}`,
        formatRupiahDatar(i.subtotal),
        lebar,
      )) {
        baris.push(teks(b));
      }
    }
  } else {
    const rincian = data.keterangan?.trim() || (tunai ? 'Pembelian' : 'Utang');
    for (const b of duaKolom(rincian, formatRupiahDatar(data.nominal), lebar)) baris.push(teks(b));
  }
  baris.push({ jenis: 'pisah' });

  if (tunai) {
    for (const b of duaKolom('TOTAL', formatRupiahDatar(data.nominal), lebar)) {
      baris.push(teks(b, 'kiri', true));
    }
    baris.push(teks('LUNAS - TERIMA KASIH', 'tengah', true));
  } else {
    for (const b of duaKolom('Utang kali ini', formatRupiahDatar(data.nominal), lebar)) {
      baris.push(teks(b));
    }
    for (const b of duaKolom('TOTAL SISA UTANG', formatRupiahDatar(data.sisaUtangPelanggan), lebar)) {
      baris.push(teks(b, 'kiri', true));
    }
  }
  baris.push({ jenis: 'pisah' });

  if (data.noWaWarung?.trim()) {
    baris.push(teks(`WA ${data.noWaWarung.trim()}`, 'tengah'));
  }
  if (!tunai) baris.push(teks('Terima kasih', 'tengah'));
  baris.push(teks('Simpan struk ini sebagai bukti', 'tengah'));

  return baris;
}
