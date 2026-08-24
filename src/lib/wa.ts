/**
 * Menyiapkan nomor dan tautan WhatsApp.
 *
 * Pemilik warung menyimpan nomor dengan berbagai gaya: 0812-3456-7890,
 * +62 812 3456 7890, (0812) 34567890, bahkan 812345678 tanpa nol. Semua itu
 * harus berakhir sebagai satu bentuk yang diterima wa.me, dan yang benar-benar
 * tidak masuk akal harus ditolak dengan alasan yang bisa dimengerti.
 */

export type HasilNomor =
  | { ok: true; nomor: string }
  | { ok: false; alasan: string };

/** Panjang wajar nomor internasional (E.164 membatasi maksimum 15 digit). */
const MIN_DIGIT = 10;
const MAKS_DIGIT = 15;

export function normalisasiNomorWa(masukan: string | null | undefined): HasilNomor {
  const teks = (masukan ?? '').trim();
  if (teks === '') {
    return { ok: false, alasan: 'Nomor WhatsApp pelanggan belum diisi.' };
  }

  const digit = teks.replace(/\D/g, '');
  if (digit === '') {
    return { ok: false, alasan: 'Nomor WhatsApp tidak berisi angka sama sekali.' };
  }

  // Diawali "+" berarti pengguna sudah menulis format internasional —
  // termasuk negara selain Indonesia. Angkanya dipakai apa adanya.
  const internasional = teks.trimStart().startsWith('+');

  let nomor: string;
  if (internasional) {
    nomor = digit;
  } else if (digit.startsWith('62')) {
    nomor = digit;
  } else if (digit.startsWith('0')) {
    // 08123... -> 628123...
    nomor = `62${digit.slice(1)}`;
  } else if (digit.startsWith('8')) {
    // Ditulis tanpa nol di depan, kebiasaan yang umum.
    nomor = `62${digit}`;
  } else {
    return {
      ok: false,
      alasan: 'Nomor tidak dikenali. Tulis mulai 08…, 62…, atau +62…',
    };
  }

  if (nomor.length < MIN_DIGIT) {
    return { ok: false, alasan: 'Nomor WhatsApp terlalu pendek.' };
  }
  if (nomor.length > MAKS_DIGIT) {
    return { ok: false, alasan: 'Nomor WhatsApp terlalu panjang.' };
  }

  return { ok: true, nomor };
}

/**
 * Tautan wa.me. Membukanya tidak butuh koneksi ke server UtangKu — cukup
 * aplikasi WhatsApp di HP — sehingga menagih tetap bisa dilakukan offline.
 */
export const tautanWa = (nomor: string, pesan: string) =>
  `https://wa.me/${nomor}?text=${encodeURIComponent(pesan)}`;
