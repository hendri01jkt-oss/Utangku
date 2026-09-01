import { barisStruk, UKURAN_KERTAS, type DataStruk, type LebarKertas } from './barisStruk';

/*
 * Struk digambar untuk PRINTER SATU-BIT, bukan untuk layar.
 *
 * Printer thermal tidak punya abu-abu: setiap titik hanya dipanaskan atau
 * tidak. Canvas, sebaliknya, menggambar huruf dengan antialias — tepinya
 * abu-abu. Ketika aplikasi cetak mengambangkan gambar itu menjadi satu bit,
 * seluruh tepi abu-abu itu hilang, dan yang tersisa adalah batang huruf yang
 * lebih kurus dan patah-patah daripada yang terlihat di layar.
 *
 * Karena itu pengambangannya dikerjakan DI SINI, bukan diserahkan ke
 * aplikasi cetak yang ambangnya tidak kita ketahui:
 *
 *   1. digambar pada kanvas 3x lipat, supaya bentuk hurufnya utuh
 *   2. diperkecil ke grid titik printer yang sebenarnya (384 atau 576)
 *   3. diambangkan menjadi hitam pekat atau putih murni — tidak ada abu-abu
 *      yang tersisa untuk ditafsirkan siapa pun
 *   4. diperbesar kembali dengan kelipatan BULAT tanpa penghalusan
 *
 * Langkah 4 itu yang membuat gambarnya tetap tajam saat diperbesar di layar
 * atau dikirim lewat WhatsApp, tanpa mengubah apa pun bagi printer: satu
 * titik printer tetap satu blok utuh, dan pengecilan 2:1 di aplikasi cetak
 * mengembalikannya persis seperti semula.
 */

/** Piksel keluaran per titik printer. Harus bilangan bulat. */
const SKALA_KELUARAN = 2;

/** Faktor gambar sementara sebelum diperkecil ke grid titik. */
const SUPERSAMPLE = 3;

/**
 * Ambang hitam-putih, 0..1 terhadap luminans.
 *
 * Sengaja tinggi. Titik yang tertutup tinta separuh pun dijadikan hitam
 * penuh, sehingga batang huruf menebal sedikit alih-alih menipis — persis
 * lawan dari yang terjadi kalau pengambangan diserahkan ke aplikasi cetak.
 */
const AMBANG = 0.55;

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
 * Membuang seluruh abu-abu: setiap piksel jadi hitam pekat atau putih murni.
 *
 * Alfa ikut dipenuhkan. PNG dengan piksel tembus pandang tercetak sebagai
 * bidang hitam pekat di sebagian aplikasi cetak — boros kertas sekaligus
 * tidak terbaca.
 */
function ambangkan(ctx: CanvasRenderingContext2D, lebar: number, tinggi: number): void {
  const gambar = ctx.getImageData(0, 0, lebar, tinggi);
  const p = gambar.data;
  const batas = AMBANG * 255;

  for (let i = 0; i < p.length; i += 4) {
    // Luminans perseptual: huruf hitam di atas putih, jadi bobot kanalnya
    // hampir tidak berpengaruh — tapi memakai rumus yang benar membuat
    // ambangnya tetap masuk akal kalau kelak ada logo berwarna.
    const lum = 0.299 * (p[i] ?? 0) + 0.587 * (p[i + 1] ?? 0) + 0.114 * (p[i + 2] ?? 0);
    const nilai = lum < batas ? 0 : 255;
    p[i] = nilai;
    p[i + 1] = nilai;
    p[i + 2] = nilai;
    p[i + 3] = 255;
  }
  ctx.putImageData(gambar, 0, 0);
}

/**
 * Menggambar struk sebagai PNG hitam-putih murni selebar kertasnya.
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

  // ── 1. Gambar pada kanvas berlipat ───────────────────────────────────────
  const kerja = buatKanvas(titik * SUPERSAMPLE, tinggi * SUPERSAMPLE);
  kerja.scale(SUPERSAMPLE, SUPERSAMPLE);
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

  // ── 2. Perkecil ke grid titik printer yang sebenarnya ────────────────────
  const titikCtx = buatKanvas(titik, tinggi);
  titikCtx.imageSmoothingEnabled = true;
  titikCtx.imageSmoothingQuality = 'high';
  titikCtx.drawImage(kerja.canvas, 0, 0, titik, tinggi);

  // ── 3. Buang seluruh abu-abu ─────────────────────────────────────────────
  ambangkan(titikCtx, titik, tinggi);

  // ── 4. Perbesar kelipatan bulat, tanpa penghalusan ───────────────────────
  const keluar = buatKanvas(titik * SKALA_KELUARAN, tinggi * SKALA_KELUARAN);
  keluar.imageSmoothingEnabled = false;
  keluar.drawImage(
    titikCtx.canvas,
    0,
    0,
    titik * SKALA_KELUARAN,
    tinggi * SKALA_KELUARAN,
  );

  const blob = await new Promise<Blob | null>((selesai) =>
    keluar.canvas.toBlob(selesai, 'image/png'),
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
  return `struk-${data.tanggal}-${nama || 'pelanggan'}.png`;
}
