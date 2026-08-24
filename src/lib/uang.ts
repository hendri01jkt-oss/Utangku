/**
 * Satu-satunya tempat uang diformat dan dibaca di UtangKu.
 *
 * Aturan yang tidak bisa ditawar (lihat PLAN.md bagian 1):
 * nominal selalu bilangan bulat rupiah penuh — bukan sen, bukan float.
 * Tidak ada komponen yang boleh memformat uang sendiri.
 */

const formatter = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  maximumFractionDigits: 0,
});

const formatterRingkas = new Intl.NumberFormat('id-ID', {
  maximumFractionDigits: 0,
});

/** 1500000 -> "Rp 1.500.000" */
export const formatRupiah = (nominal: number): string =>
  formatter.format(Math.round(nominal));

/** 1500000 -> "1.500.000" (tanpa "Rp", untuk dipakai di dalam input) */
export const formatAngka = (nominal: number): string =>
  formatterRingkas.format(Math.round(nominal));

/**
 * "Rp 1.500.000" / "1.500.000" / "1500000" -> 1500000
 * Semua karakter non-digit dibuang, jadi aman untuk apa pun yang diketik user.
 */
export const parseRupiah = (teks: string): number => {
  const digit = teks.replace(/\D/g, '');
  return digit === '' ? 0 : Number(digit);
};
