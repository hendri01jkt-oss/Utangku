/**
 * Pengecek kontras WCAG untuk token warna UtangKu.
 *
 * Tema terang punya jebakan kontrasnya sendiri: warna aksen dan status yang
 * terlihat "cukup pekat" di layar sering hanya mencapai 3:1 di atas putih.
 * Skrip ini menguji setiap warna teks terhadap SEMUA permukaan yang dipakai,
 * termasuk tint badge, lalu mengambil hasil terburuk.
 *
 * Jalankan: npm run cek:kontras
 */

const hex = (h) => {
  const s = h.replace('#', '');
  return [0, 2, 4].map((i) => parseInt(s.slice(i, i + 2), 16));
};

/** Luminansi relatif WCAG 2.1 */
const luminansi = ([r, g, b]) => {
  const [R, G, B] = [r, g, b].map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * R + 0.7152 * G + 0.0722 * B;
};

const rasio = (a, b) => {
  const [x, y] = [luminansi(a), luminansi(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
};

// ── Token warna (harus sama persis dengan src/gaya/tokens.css) ──────────────
const T = {
  putih: '#FFFFFF',
  permukaan2: '#F4F4F6',
  merah700: '#A61B14',
  merah600: '#C62828',
  teksUtama: '#17181C',
  teksRedup: '#4A4F5C',
  teksSamar: '#616675',
  sukses: '#137038',
  peringatan: '#A15C07',
  bahaya: '#C62828',
  tintSukses: '#ECFDF3',
  tintPeringatan: '#FEF6E7',
  tintBahaya: '#FDECEC',
};

/**
 * Semua permukaan tempat teks bisa berdiri. Warna status diuji juga di atas
 * tint badge-nya sendiri, bukan cuma di atas putih — di tema terang, tint
 * berwarna adalah latar yang paling mudah membuat teks gagal kontras.
 */
const permukaan = [
  ['putih (halaman & kartu)', hex(T.putih)],
  ['permukaan-2 (baris/input)', hex(T.permukaan2)],
  ['tint sukses (badge lunas)', hex(T.tintSukses)],
  ['tint peringatan (badge sebagian)', hex(T.tintPeringatan)],
  ['tint bahaya (badge belum lunas)', hex(T.tintBahaya)],
];

const teks = [
  ['teks-utama', T.teksUtama],
  ['teks-redup', T.teksRedup],
  ['teks-samar', T.teksSamar],
  ['merah-600', T.merah600],
  ['merah-700', T.merah700],
  ['sukses', T.sukses],
  ['peringatan', T.peringatan],
  ['bahaya', T.bahaya],
];

const AMBANG = 4.5;
let gagal = 0;

console.log('\nKontras teks terhadap semua permukaan (ambang WCAG AA = 4.5:1)');
console.log('='.repeat(74));

for (const [namaTeks, warnaTeks] of teks) {
  const hasil = permukaan.map(([namaBg, bg]) => ({
    namaBg,
    r: rasio(hex(warnaTeks), bg),
  }));
  const terburuk = hasil.reduce((a, b) => (a.r < b.r ? a : b));
  const lolos = terburuk.r >= AMBANG;
  if (!lolos) gagal++;
  console.log(
    `${lolos ? 'LULUS' : 'GAGAL'}  ${namaTeks.padEnd(12)} ` +
      `terburuk ${terburuk.r.toFixed(2)}:1  pada ${terburuk.namaBg}`,
  );
}

// Tombol utama: emas solid dengan teks navy paling gelap.
console.log('\nTeks di atas isian solid');
console.log('='.repeat(74));
const solid = [
  ['putih di atas merah-600 (tombol utama)', T.putih, T.merah600],
  ['putih di atas merah-700 (tombol ditekan)', T.putih, T.merah700],
];
for (const [nama, fg, bg] of solid) {
  const r = rasio(hex(fg), hex(bg));
  const lolos = r >= AMBANG;
  if (!lolos) gagal++;
  console.log(`${lolos ? 'LULUS' : 'GAGAL'}  ${nama.padEnd(42)} ${r.toFixed(2)}:1`);
}

console.log('='.repeat(74));
if (gagal > 0) {
  console.error(`\n${gagal} pasangan warna GAGAL memenuhi 4.5:1. Perbaiki token sebelum lanjut.\n`);
  process.exit(1);
}
console.log('\nSemua pasangan warna memenuhi WCAG AA (4.5:1).\n');
