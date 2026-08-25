/**
 * Menyusun alamat penuh ke sebuah rute di dalam aplikasi.
 *
 * Dipakai untuk tautan yang dibuka DI LUAR aplikasi — tautan konfirmasi
 * email dan reset kata sandi dari Supabase. Router tidak ikut campur di
 * sana: yang dipakai adalah alamat mentah, jadi awalan basis harus
 * disertakan sendiri.
 *
 * `window.location.origin` saja tidak cukup. Di Netlify aplikasi memang
 * duduk di akar domain, tapi di GitHub Pages ia berada di subpath nama repo
 * — dan tautan tanpa subpath itu akan mendarat di halaman kosong milik
 * akun, bukan di UtangKu. Kesalahan seperti ini hanya kelihatan setelah
 * email benar-benar terkirim ke orang lain, jadi jangan disusun manual.
 *
 * @param jalur jalur relatif tanpa garis miring awal, mis. "reset-sandi"
 */
export function alamatAplikasi(jalur = ''): string {
  // BASE_URL selalu berakhiran "/" — "/" di Netlify, "/Utangku/" di Pages.
  return `${window.location.origin}${import.meta.env.BASE_URL}${jalur}`;
}
