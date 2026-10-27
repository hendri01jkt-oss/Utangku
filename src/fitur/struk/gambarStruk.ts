import type { DataStruk } from './barisStruk';
import { formatRupiah } from '@/lib/uang';

/*
 * Kartu "Catatan Utang" untuk DISIMPAN dan DIBAGIKAN (galeri, WhatsApp).
 *
 * Digambar langsung di canvas, seluruhnya lokal, jadi tetap jalan tanpa
 * sinyal. Lebarnya tetap 1080 piksel (digandakan 2x supaya tajam saat
 * diperbesar); tingginya mengikuti isi. Dihitung dalam dua putaran: putaran
 * pertama hanya mengukur, putaran kedua baru menggambar di atas kartu yang
 * tingginya sudah pasti.
 */

const LEBAR = 1080;
const SKALA = 2;
const LUAR = 36;
const KARTU_W = LEBAR - LUAR * 2;
const PAD = 56;

const NAVY = '#0f1b3d';
const NAVY_TERANG = '#16275a';
const EMAS = '#c9a84c';
const EMAS_TERANG = '#f6e6a8';
const EMAS_GELAP = '#7d6220';
const ABU = '#5b6478';
const GARIS = '#e8e1cd';
const KRIM = '#fffaf0';
const HIJAU = '#1f7a4d';
const AMBER = '#b45309';

const huruf = (ukuran: number, tebal = false) =>
  `${tebal ? '700' : '400'} ${ukuran}px "Inter", "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif`;

function tanggalPanjang(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

/** Memenggal teks per kata agar muat; kata yang terlalu panjang dipotong per huruf. */
function bungkus(ctx: CanvasRenderingContext2D, teks: string, lebarMaks: number): string[] {
  const kata = teks.split(/\s+/).filter(Boolean);
  const hasil: string[] = [];
  let baris = '';
  const dorong = () => {
    if (baris) hasil.push(baris);
    baris = '';
  };
  for (const k of kata) {
    const calon = baris ? `${baris} ${k}` : k;
    if (ctx.measureText(calon).width <= lebarMaks) {
      baris = calon;
      continue;
    }
    dorong();
    if (ctx.measureText(k).width <= lebarMaks) {
      baris = k;
      continue;
    }
    let potongan = '';
    for (const h of k) {
      if (ctx.measureText(potongan + h).width > lebarMaks) {
        hasil.push(potongan);
        potongan = '';
      }
      potongan += h;
    }
    baris = potongan;
  }
  dorong();
  return hasil;
}

function kotakBulat(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  l: number,
  t: number,
  r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + l, y, x + l, y + t, r);
  ctx.arcTo(x + l, y + t, x, y + t, r);
  ctx.arcTo(x, y + t, x, y, r);
  ctx.arcTo(x, y, x + l, y, r);
  ctx.closePath();
}

function buatKanvas(tinggi: number): CanvasRenderingContext2D {
  const kanvas = document.createElement('canvas');
  kanvas.width = LEBAR * SKALA;
  kanvas.height = Math.max(1, Math.round(tinggi * SKALA));
  const ctx = kanvas.getContext('2d');
  if (!ctx) throw new Error('Perangkat ini tidak bisa menggambar catatan.');
  ctx.scale(SKALA, SKALA);
  ctx.textBaseline = 'alphabetic';
  return ctx;
}

/**
 * Menyusun seluruh isi kartu. Bila `gambar` salah, hanya mengukur.
 * Mengembalikan tinggi KARTU (bukan halaman).
 */
function susun(
  ctx: CanvasRenderingContext2D,
  data: DataStruk,
  gambar: boolean,
  tinggiKartu: number,
): number {
  const x0 = LUAR + PAD;
  const x1 = LUAR + KARTU_W - PAD;
  const lebarIsi = x1 - x0;
  let y = LUAR;

  const teks = (
    isi: string,
    x: number,
    yy: number,
    font: string,
    warna: string,
    rata: CanvasTextAlign = 'left',
  ) => {
    if (!gambar) return;
    ctx.font = font;
    ctx.fillStyle = warna;
    ctx.textAlign = rata;
    ctx.fillText(isi, x, yy);
  };

  // ── Kepala: nama warung di atas pita navy ─────────────────────────────
  ctx.font = huruf(56, true);
  const namaBaris = bungkus(ctx, data.namaWarung, lebarIsi);
  ctx.font = huruf(26);
  const subBaris = [data.alamatWarung?.trim(), data.noWaWarung?.trim() ? `WA ${data.noWaWarung.trim()}` : '']
    .filter((b): b is string => Boolean(b))
    .flatMap((b) => bungkus(ctx, b, lebarIsi));
  const tinggiPita =
    48 + 28 + 22 + namaBaris.length * 66 + (subBaris.length > 0 ? 10 + subBaris.length * 36 : 0) + 44;

  if (gambar) {
    ctx.save();
    kotakBulat(ctx, LUAR, LUAR, KARTU_W, tinggiKartu, 40);
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = 'rgba(15,27,61,0.18)';
    ctx.shadowBlur = 32;
    ctx.shadowOffsetY = 10;
    ctx.fill();
    ctx.restore();

    ctx.save();
    kotakBulat(ctx, LUAR, LUAR, KARTU_W, tinggiKartu, 40);
    ctx.clip();
    const lat = ctx.createLinearGradient(LUAR, y, LUAR + KARTU_W, y + tinggiPita);
    lat.addColorStop(0, NAVY_TERANG);
    lat.addColorStop(1, NAVY);
    ctx.fillStyle = lat;
    ctx.fillRect(LUAR, y, KARTU_W, tinggiPita);
    const emas = ctx.createLinearGradient(LUAR, 0, LUAR + KARTU_W, 0);
    emas.addColorStop(0, EMAS_TERANG);
    emas.addColorStop(1, EMAS);
    ctx.fillStyle = emas;
    ctx.fillRect(LUAR, y + tinggiPita - 8, KARTU_W, 8);
    ctx.restore();
  }

  let yy = y + 48 + 22;
  teks('CATATAN UTANG', x0, yy, huruf(24, true), EMAS_TERANG);
  yy += 28 + 38;
  for (const b of namaBaris) {
    teks(b, x0, yy, huruf(56, true), '#ffffff');
    yy += 66;
  }
  if (subBaris.length > 0) {
    yy += 4;
    for (const b of subBaris) {
      teks(b, x0, yy, huruf(26), 'rgba(255,255,255,0.78)');
      yy += 36;
    }
  }
  y += tinggiPita + 40;

  // ── Status ────────────────────────────────────────────────────────────
  const sisaTransaksi = Math.max(data.nominal - (data.dibayar ?? 0), 0);
  const status = data.status ?? (sisaTransaksi === 0 ? 'lunas' : 'belum_lunas');
  const labelStatus = status === 'lunas' ? 'LUNAS' : status === 'sebagian' ? 'DICICIL' : 'BELUM LUNAS';
  const warnaStatus = status === 'lunas' ? HIJAU : AMBER;
  if (gambar) {
    ctx.font = huruf(26, true);
    const lebarPil = ctx.measureText(labelStatus).width + 56;
    kotakBulat(ctx, x0, y, lebarPil, 52, 26);
    ctx.fillStyle = `${warnaStatus}1f`;
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = warnaStatus;
    ctx.stroke();
  }
  teks(labelStatus, x0 + 28, y + 36, huruf(26, true), warnaStatus);
  y += 52 + 28;

  // ── Baris keterangan: label kiri, nilai kanan ─────────────────────────
  const baris = (label: string, nilai: string) => {
    ctx.font = huruf(30, true);
    const nilaiBaris = bungkus(ctx, nilai, lebarIsi * 0.62);
    const n = Math.max(nilaiBaris.length, 1);
    teks(label, x0, y + 34, huruf(28), ABU);
    nilaiBaris.forEach((b, i) => teks(b, x1, y + 34 + i * 38, huruf(30, true), NAVY, 'right'));
    y += n * 38 + 14;
  };
  if (data.nomorStruk) baris('No. Utang', data.nomorStruk);
  baris('Tanggal', `${tanggalPanjang(data.tanggal)}, ${data.waktu}`);
  if (data.namaPelanggan) baris('Pelanggan', data.namaPelanggan);
  if (data.batasBayar) baris('Batas bayar', tanggalPanjang(data.batasBayar));

  y += 10;
  if (gambar) {
    ctx.fillStyle = GARIS;
    ctx.fillRect(x0, y, lebarIsi, 2);
  }
  y += 34;

  // ── Isi belanjaan ─────────────────────────────────────────────────────
  if (data.item.length > 0) {
    teks('ISI BELANJAAN', x0, y + 24, huruf(24, true), ABU);
    y += 24 + 26;
    data.item.forEach((i, idx) => {
      ctx.font = huruf(32, true);
      const nama = bungkus(ctx, i.nama_item, lebarIsi - 260);
      nama.forEach((b, k) => teks(b, x0, y + 32 + k * 40, huruf(32, true), NAVY));
      teks(formatRupiah(i.subtotal), x1, y + 32, huruf(32, true), NAVY, 'right');
      y += nama.length * 40;
      teks(`${i.qty} x ${formatRupiah(i.harga_satuan)}`, x0, y + 26, huruf(26), ABU);
      y += 26 + 20;
      if (idx < data.item.length - 1) {
        if (gambar) {
          ctx.fillStyle = GARIS;
          ctx.fillRect(x0, y, lebarIsi, 1.5);
        }
        y += 22;
      }
    });
    y += 14;
  } else if (data.keterangan?.trim()) {
    teks('KETERANGAN', x0, y + 24, huruf(24, true), ABU);
    y += 24 + 26;
    ctx.font = huruf(32);
    for (const b of bungkus(ctx, data.keterangan.trim(), lebarIsi)) {
      teks(b, x0, y + 32, huruf(32), NAVY);
      y += 42;
    }
    y += 14;
  }

  // ── Ringkasan angka ───────────────────────────────────────────────────
  const tinggiRingkas = 40 + 44 + (data.dibayar !== undefined ? 44 : 0) + 24 + 2 + 24 + 36 + 76 + 36;
  if (gambar) {
    kotakBulat(ctx, x0 - 20, y, lebarIsi + 40, tinggiRingkas, 28);
    ctx.fillStyle = KRIM;
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = GARIS;
    ctx.stroke();
  }
  let ry = y + 40;
  teks('Total utang', x0 + 4, ry + 28, huruf(30), ABU);
  teks(formatRupiah(data.nominal), x1 - 4, ry + 28, huruf(30, true), NAVY, 'right');
  ry += 44;
  if (data.dibayar !== undefined) {
    teks('Sudah dibayar', x0 + 4, ry + 28, huruf(30), ABU);
    teks(formatRupiah(data.dibayar), x1 - 4, ry + 28, huruf(30, true), HIJAU, 'right');
    ry += 44;
  }
  ry += 24;
  if (gambar) {
    ctx.fillStyle = GARIS;
    ctx.fillRect(x0 + 4, ry, lebarIsi - 8, 2);
  }
  ry += 2 + 24;
  teks('SISA UTANG', x0 + 4, ry + 28, huruf(26, true), ABU);
  ry += 36;
  teks(
    formatRupiah(sisaTransaksi),
    x1 - 4,
    ry + 54,
    huruf(64, true),
    sisaTransaksi === 0 ? HIJAU : EMAS_GELAP,
    'right',
  );
  y += tinggiRingkas + 34;

  // ── Total seluruh utang pelanggan, hanya bila beda ────────────────────
  if (Math.round(data.sisaUtangPelanggan) !== Math.round(sisaTransaksi)) {
    teks('Total semua utang Anda saat ini', LEBAR / 2, y + 28, huruf(26), ABU, 'center');
    teks(formatRupiah(data.sisaUtangPelanggan), LEBAR / 2, y + 28 + 46, huruf(38, true), NAVY, 'center');
    y += 28 + 46 + 30;
  }

  // ── Kaki ──────────────────────────────────────────────────────────────
  if (gambar) {
    ctx.fillStyle = GARIS;
    ctx.fillRect(x0, y, lebarIsi, 2);
  }
  y += 36;
  teks('Simpan catatan ini sebagai bukti', LEBAR / 2, y + 22, huruf(24), ABU, 'center');
  teks('Dicatat dengan UtangKu', LEBAR / 2, y + 22 + 34, huruf(22, true), EMAS_GELAP, 'center');
  y += 22 + 34 + 48;

  return y - LUAR;
}

/** Membuat gambar PNG catatan utang. */
export async function gambarStruk(data: DataStruk): Promise<Blob> {
  const ukur = buatKanvas(10);
  const tinggiKartu = Math.ceil(susun(ukur, data, false, 0));

  const tinggiHalaman = tinggiKartu + LUAR * 2;
  const ctx = buatKanvas(tinggiHalaman);
  const latar = ctx.createLinearGradient(0, 0, 0, tinggiHalaman);
  latar.addColorStop(0, '#f6e6a8');
  latar.addColorStop(0.35, '#fbf1cc');
  latar.addColorStop(1, '#fffaf0');
  ctx.fillStyle = latar;
  ctx.fillRect(0, 0, LEBAR, tinggiHalaman);
  susun(ctx, data, true, tinggiKartu);

  const blob = await new Promise<Blob | null>((selesai) =>
    ctx.canvas.toBlob(selesai, 'image/png'),
  );
  if (!blob) throw new Error('Gagal membuat gambar catatan.');
  return blob;
}

/** Nama berkas yang bisa dikenali kembali di galeri: tanggal + nama pelanggan. */
export function namaBerkasStruk(data: DataStruk): string {
  const nama = (data.namaPelanggan ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return `utang-${data.tanggal}-${nama || 'pelanggan'}.png`;
}
