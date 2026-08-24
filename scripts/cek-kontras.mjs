/**
 * Pengecek kontras WCAG untuk token warna UtangKu.
 *
 * Glassmorphism sangat mudah gagal kontras: permukaan kaca semi-transparan
 * membuat latar efektif teks berbeda dari warna yang tertulis di token.
 * Skrip ini menghitung latar efektif (alpha compositing) lalu menguji setiap
 * warna teks terhadap SEMUA permukaan yang mungkin dipakai — bukan hanya
 * yang paling gelap.
 *
 * Jalankan: npm run cek:kontras
 */

const hex = (h) => {
  const s = h.replace('#', '');
  return [0, 2, 4].map((i) => parseInt(s.slice(i, i + 2), 16));
};

/** Menempatkan warna ber-alpha di atas warna dasar yang solid. */
const timpa = ([r, g, b], a, dasar) =>
  dasar.map((d, i) => Math.round(a * [r, g, b][i] + (1 - a) * d));

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

// ── Token warna (harus sama persis dengan src/gaya/tokens.css) ───────────────
const T = {
  navy950: '#060B1A',
  navy900: '#0A1128',
  navy800: '#101A35',
  navy700: '#16223F',
  gold300: '#F2D98D',
  gold400: '#E9C46A',
  gold500: '#D4AF37',
  teksUtama: '#F5F3EE',
  teksRedup: '#B8C0D4',
  teksSamar: '#9AA5BF',
  sukses: '#2FBF71',
  peringatan: '#F4A261',
  bahaya: '#FF8A8A',
};

const PUTIH_KACA = [255, 255, 255];

/**
 * Semua permukaan tempat teks bisa berdiri. Yang paling terang adalah kasus
 * terburuk untuk teks terang — dan justru itu yang gampang terlewat kalau
 * kontras cuma dicek terhadap navy paling gelap.
 */
const permukaan = [
  ['navy-950 (dasar gradien)', hex(T.navy950)],
  ['navy-900 (dasar gradien)', hex(T.navy900)],
  ['navy-800 (dasar gradien)', hex(T.navy800)],
  ['navy-700 (dasar gradien)', hex(T.navy700)],
  ['kaca 6% / navy-900', timpa(PUTIH_KACA, 0.06, hex(T.navy900))],
  ['kaca 6% / navy-800', timpa(PUTIH_KACA, 0.06, hex(T.navy800))],
  ['kaca 10% / navy-800', timpa(PUTIH_KACA, 0.1, hex(T.navy800))],
  ['kaca 10% / navy-700 (paling terang)', timpa(PUTIH_KACA, 0.1, hex(T.navy700))],
];

const teks = [
  ['teks-utama', T.teksUtama],
  ['teks-redup', T.teksRedup],
  ['teks-samar', T.teksSamar],
  ['gold-300', T.gold300],
  ['gold-400', T.gold400],
  ['gold-500', T.gold500],
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
  ['navy-950 di atas gold-500 (tombol utama)', T.navy950, T.gold500],
  ['navy-950 di atas gold-400 (tombol hover)', T.navy950, T.gold400],
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
