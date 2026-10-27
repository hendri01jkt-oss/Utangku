import { barisStruk, UKURAN_KERTAS, type DataStruk, type LebarKertas } from './barisStruk';

/*
 * Gambar struk ini untuk DISIMPAN dan DIBAGIKAN (galeri, WhatsApp), bukan
 * untuk printer — pencetakan Bluetooth memakai byteStruk() yang terpisah.
 *
 * Dulu gambarnya dibuat 1-bit selebar grid printer (384/576 titik) lalu
 * diperbesar 2x tanpa penghalusan. Di layar HP hasilnya bergerigi dan
 * huruf-hurufnya pecah. Sekarang digambar langsung pada resolusi tinggi
 * (1152 piksel lebar) dengan antialias biasa, jadi tajam di layar dan tetap
 * jelas saat diperbesar atau dikirim lewat WhatsApp.
 */

/** Lebar gambar keluaran dalam piksel. */
const LEBAR_KELUARAN = 1152;

const TINGGI_PISAH = 20;
const TINGGI_KOSONG = 14;
const PADDING_ATAS = 24;
const PADDING_BAWAH = 40;
/** Tebal garis pembatas, dalam titik printer. */
const TEBAL_GARIS = 3;

/** Monospace supaya kolom kiri-kanan lurus, sama seperti di kertas. */
const FONT = (ukuran: number) =>
  `bold ${ukuran}px "Courier New", "DejaVu Sans Mono", monospace`;

/**
 * Ukuran font terbesar yang masih membuat SATU BARIS PENUH muat.
 *
 * Tidak dipatok pada angka tetap: lebar huruf monospace berbeda antar
 * perangkat, dan struk 32 kolom pada kertas 58mm punya ruang yang jauh lebih
 * sempit daripada 48 kolom pada 80mm. Ukuran yang dipatok membuat baris
 * terpanjang melewati tepi kanvas dan terpotong — persis di kolom nominal,
 * bagian yang paling tidak boleh hilang.
 */
function ukuranFontMuat(
  ctx: CanvasRenderingContext2D,
  kolom: number,
  lebarTersedia: number,
): number {
  const contoh = 'M'.repeat(kolom);
  const ACUAN = 20;
  ctx.font = FONT(ACUAN);
  const lebarAcuan = ctx.measureText(contoh).width;
  if (lebarAcuan === 0) return ACUAN;
  return Math.max(8, Math.floor((ACUAN * lebarTersedia) / lebarAcuan));
}

function tinggiBaris(jenis: string, tinggiTeks: number): number {
  if (jenis === 'pisah') return TINGGI_PISAH;
  if (jenis === 'kosong') return TINGGI_KOSONG;
  return tinggiTeks;
}

function buatKanvas(lebar: number, tinggi: number): CanvasRenderingContext2D {
  const kanvas = document.createElement('canvas');
  kanvas.width = lebar;
  kanvas.height = tinggi;
  const ctx = kanvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Perangkat ini tidak bisa menggambar struk.');
  return ctx;
}

/**
 * Menggambar struk sebagai PNG beresolusi tinggi dengan tata letak sesuai lebar kertasnya.
 *
 * Digambar langsung di canvas, bukan lewat html2canvas: lebar keluarannya
 * harus tepat kelipatan 384 atau 576 titik, dan menyalin tata letak DOM
 * tidak memberikan jaminan itu. Seluruhnya berjalan lokal, jadi tetap bisa
 * dipakai tanpa sinyal.
 */
export async function gambarStruk(data: DataStruk, lebarMm: LebarKertas): Promise<Blob> {
  const { titik, karakter } = UKURAN_KERTAS[lebarMm];
  const baris = barisStruk(data, karakter);

  const ukur = buatKanvas(titik, 1);
  const marginX = Math.round(titik * 0.03);
  const ukuranFont = ukuranFontMuat(ukur, karakter, titik - marginX * 2);
  // Jarak antarbaris sedikit lebih longgar dari tinggi hurufnya, kalau tidak
  // baris-barisnya berdempetan dan sulit dibaca pada cetakan kecil.
  const tinggiTeks = Math.round(ukuranFont * 1.35);

  const tinggi =
    PADDING_ATAS +
    baris.reduce((jumlah, b) => jumlah + tinggiBaris(b.jenis, tinggiTeks), 0) +
    PADDING_BAWAH;

  const skala = LEBAR_KELUARAN / titik;
  const kerja = buatKanvas(LEBAR_KELUARAN, Math.round(tinggi * skala));
  kerja.scale(skala, skala);
  kerja.fillStyle = '#ffffff';
  kerja.fillRect(0, 0, titik, tinggi);
  kerja.fillStyle = '#000000';
  kerja.strokeStyle = '#000000';
  kerja.textBaseline = 'middle';

  let y = PADDING_ATAS;

  for (const b of baris) {
    const tinggiIni = tinggiBaris(b.jenis, tinggiTeks);

    if (b.jenis === 'pisah') {
      kerja.fillRect(marginX, y + (tinggiIni - TEBAL_GARIS) / 2, titik - marginX * 2, TEBAL_GARIS);
    } else if (b.jenis === 'teks') {
      kerja.font = FONT(ukuranFont);
      kerja.textAlign = b.rata === 'tengah' ? 'center' : 'left';
      const x = b.rata === 'tengah' ? titik / 2 : marginX;
      const tengah = y + tinggiIni / 2;
      kerja.fillText(b.isi, x, tengah);
      /*
       * Baris penting digariskan sekali lagi di atas isiannya.
       *
       * Seluruh teks sudah tebal — printer thermal memakan batang huruf yang
       * tipis — jadi penegasan tidak bisa lagi memakai bobot font. Goresan
       * tipis ini menambah kira-kira setengah titik di setiap sisi, cukup
       * untuk membedakan nama warung dan baris total dari sekitarnya setelah
       * diambangkan.
       */
      if (b.tebal) {
        kerja.lineWidth = 0.35;
        kerja.strokeText(b.isi, x, tengah);
      }
    }

    y += tinggiIni;
  }

  const blob = await new Promise<Blob | null>((selesai) =>
    kerja.canvas.toBlob(selesai, 'image/png'),
  );
  if (!blob) throw new Error('Gagal membuat gambar struk.');
  return blob;
}

/** Nama berkas yang bisa dikenali kembali di galeri: tanggal + nama pelanggan. */
export function namaBerkasStruk(data: DataStruk): string {
  const nama = (data.namaPelanggan ?? (data.jenis === 'tunai' ? 'tunai' : ''))
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return `utang-${data.tanggal}-${nama || 'pelanggan'}.png`;
}
