import berkasLogo from '@/aset/logo-utangku.png';
import { cn } from '@/lib/cn';

/**
 * Wordmark UtangKu.
 *
 * Gambarnya diimpor sebagai modul, bukan ditulis sebagai alamat "/logo.png".
 * Alamat mentah tidak ikut disesuaikan saat aplikasi disajikan dari subpath
 * — di GitHub Pages ia akan menunjuk ke akar domain dan logonya hilang,
 * persis kelas bug yang sudah pernah terjadi pada tautan reset kata sandi.
 * Lewat impor, Vite yang menuliskan alamat akhirnya beserta awalan basisnya.
 *
 * Ukuran ditentukan lewat TINGGI saja; lebarnya mengikuti sendiri. Menyetel
 * keduanya membuat logo gepeng begitu ada yang mengubah salah satunya.
 */
export function Logo({ tinggi, className }: { tinggi: string; className?: string }) {
  return (
    <img
      src={berkasLogo}
      alt="UtangKu"
      /* Rasio asli diberitahukan ke browser supaya tidak ada lompatan tata
         letak saat gambarnya selesai dimuat. */
      width={600}
      height={146}
      className={cn('w-auto', tinggi, className)}
    />
  );
}
