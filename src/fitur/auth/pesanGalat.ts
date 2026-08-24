/**
 * Menerjemahkan galat Supabase menjadi kalimat yang bisa dimengerti pemilik
 * warung. Pesan asli Supabase berbahasa Inggris dan sering teknis
 * ("Invalid login credentials"), yang tidak membantu siapa pun di sini.
 */
export function pesanGalat(galat: unknown): string {
  const asli =
    typeof galat === 'object' && galat !== null && 'message' in galat
      ? String((galat as { message: unknown }).message)
      : String(galat ?? '');

  const cocok = (kunci: string) => asli.toLowerCase().includes(kunci);

  if (cocok('invalid login credentials')) {
    return 'Email atau kata sandi salah. Coba periksa lagi.';
  }
  if (cocok('email not confirmed')) {
    return 'Email Anda belum dikonfirmasi. Buka tautan yang kami kirim ke email Anda.';
  }
  if (cocok('user already registered') || cocok('already been registered')) {
    return 'Email ini sudah terdaftar. Silakan masuk atau gunakan Lupa Kata Sandi.';
  }
  if (cocok('password should be at least')) {
    return 'Kata sandi terlalu pendek. Gunakan minimal 8 karakter.';
  }
  if (cocok('for security purposes') || cocok('rate limit') || cocok('too many requests')) {
    return 'Terlalu banyak percobaan. Tunggu sebentar lalu coba lagi.';
  }
  if (cocok('unable to validate email') || cocok('invalid email')) {
    return 'Format email tidak benar.';
  }
  if (cocok('nama warung wajib diisi')) {
    return 'Nama warung wajib diisi.';
  }
  if (cocok('harus masuk terlebih dahulu')) {
    return 'Sesi Anda sudah berakhir. Silakan masuk lagi.';
  }
  if (cocok('failed to fetch') || cocok('network')) {
    return 'Tidak bisa terhubung ke server. Periksa koneksi internet Anda.';
  }

  return asli || 'Terjadi kesalahan. Coba lagi sebentar.';
}
