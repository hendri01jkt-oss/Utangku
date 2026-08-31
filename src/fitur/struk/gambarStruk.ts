import { barisStruk, UKURAN_KERTAS, type DataStruk, type LebarKertas } from './barisStruk';

/*
 * Ukuran gambar dipatok pada jumlah TITIK printer, bukan piksel CSS.
 *
 * Aplikasi cetak thermal (RawBT dan sejenisnya) mencetak gambar apa adanya
 * kalau lebarnya sudah sama dengan lebar kepala cetak. Kalau tidak, gambar
 * diskalakan — dan penskalaan pada citra satu-bit selalu menghasilkan huruf
 * yang berbayang dan sulit dibaca di kertas selebar 58mm.
 */
const TINGGI_PISAH = 20;
const TINGGI_KOSONG = 14;
const PADDING_ATAS = 24;
const PADDING_BAWAH = 40;

/** Monospace supaya kolom kiri-kanan lurus, sama seperti di kertas. */
const FONT = (ukuran: number, tebal: boolean) =>
  `${tebal ? 'bold ' : ''}${ukuran}px "Courier New", "DejaVu Sans Mono", monospace`;

/**
 * Ukuran font terbesar yang masih membuat SATU BARIS PENUH muat.
 *
 * Tidak dipatok pada angka tetap: lebar huruf monospace berbeda antar
 * perangkat (font yang tersedia tidak sama di setiap HP), dan struk 32
 * kolom pada kertas 58mm punya ruang yang jauh lebih sempit daripada 48
 * kolom pada 80mm. Ukuran yang dipatok membuat baris terpanjang melewati
 * tepi kanvas dan terpotong — persis di kolom nominal, bagian yang paling
 * tidak boleh hilang.
 */
function ukuranFontMuat(
  ctx: CanvasRenderingContext2D,
  kolom: number,
  lebarTersedia: number,
): number {
  const contoh = 'M'.repeat(kolom);
  const ACUAN = 20;
  ctx.font = FONT(ACUAN, true); // tebal selalu sedikit lebih lebar
  const lebarAcuan = ctx.measureText(contoh).width;
  if (lebarAcuan === 0) return ACUAN;
  return Math.max(8, Math.floor((ACUAN * lebarTersedia) / lebarAcuan));
}

function tinggiBaris(jenis: string, tinggiTeks: number): number {
  if (jenis === 'pisah') return TINGGI_PISAH;
  if (jenis === 'kosong') return TINGGI_KOSONG;
  return tinggiTeks;
}

/**
 * Menggambar struk sebagai PNG hitam-putih selebar kertasnya.
 *
 * Digambar langsung di canvas, bukan lewat html2canvas: lebar keluarannya
 * harus tepat 384 atau 576 titik, dan menyalin tata letak DOM tidak
 * memberikan jaminan itu. Seluruhnya berjalan lokal, jadi tetap bisa
 * dipakai tanpa sinyal.
 */
export async function gambarStruk(data: DataStruk, lebarMm: LebarKertas): Promise<Blob> {
  const { titik, karakter } = UKURAN_KERTAS[lebarMm];
  const baris = barisStruk(data, karakter);

  const kanvas = document.createElement('canvas');
  kanvas.width = titik;

  const ctx = kanvas.getContext('2d');
  if (!ctx) throw new Error('Perangkat ini tidak bisa menggambar struk.');

  const marginX = Math.round(titik * 0.03);
  const ukuranFont = ukuranFontMuat(ctx, karakter, titik - marginX * 2);
  // Jarak antarbaris sedikit lebih longgar dari tinggi hurufnya, kalau tidak
  // baris-barisnya berdempetan dan sulit dibaca pada cetakan kecil.
  const tinggiTeks = Math.round(ukuranFont * 1.35);

  const tinggi =
    PADDING_ATAS +
    baris.reduce((jumlah, b) => jumlah + tinggiBaris(b.jenis, tinggiTeks), 0) +
    PADDING_BAWAH;

  // Mengubah ukuran kanvas mengosongkan isinya, jadi tingginya diatur
  // sebelum apa pun digambar.
  kanvas.height = tinggi;

  // Latar putih penuh: PNG transparan akan tercetak jadi bidang hitam pekat
  // di printer thermal, dan boros kertas sekaligus tidak terbaca.
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, titik, tinggi);
  ctx.fillStyle = '#000000';
  ctx.textBaseline = 'middle';

  let y = PADDING_ATAS;

  for (const b of baris) {
    const tinggiIni = tinggiBaris(b.jenis, tinggiTeks);

    if (b.jenis === 'pisah') {
      ctx.fillRect(marginX, y + tinggiIni / 2, titik - marginX * 2, 2);
    } else if (b.jenis === 'teks') {
      ctx.font = FONT(ukuranFont, Boolean(b.tebal));
      ctx.textAlign = b.rata === 'tengah' ? 'center' : 'left';
      ctx.fillText(b.isi, b.rata === 'tengah' ? titik / 2 : marginX, y + tinggiIni / 2);
    }

    y += tinggiIni;
  }

  const blob = await new Promise<Blob | null>((selesai) =>
    kanvas.toBlob(selesai, 'image/png'),
  );
  if (!blob) throw new Error('Gagal membuat gambar struk.');
  return blob;
}

/** Nama berkas yang bisa dikenali kembali di galeri: tanggal + nama pelanggan. */
export function namaBerkasStruk(data: DataStruk): string {
  const nama = data.namaPelanggan
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return `struk-${data.tanggal}-${nama || 'pelanggan'}.png`;
}
