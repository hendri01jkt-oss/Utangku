import { Compass } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { TombolTautan } from '@/komponen/ui';

/**
 * Layar untuk URL yang tidak dikenali.
 *
 * Sebelum di-deploy halaman ini nyaris tidak mungkin terlihat. Setelah ada
 * fallback SPA di Netlify, SETIAP alamat asing berakhir di aplikasi:
 * tautan yang salah ketik, tautan lama yang sudah diubah, atau tautan yang
 * dibagikan dengan potongan yang hilang. Tanpa rute ini yang muncul adalah
 * layar galat bawaan React Router — berbahasa Inggris dan menakutkan untuk
 * pemilik warung yang cuma salah ketik satu huruf.
 */
export function HalamanTidakDitemukan() {
  const { pathname } = useLocation();

  return (
    <div className="flex flex-col items-center gap-4 px-5 py-16 text-center">
      <span className="permukaan flex size-14 items-center justify-center rounded-full text-teks-samar">
        <Compass size={26} aria-hidden />
      </span>
      <div className="flex flex-col gap-1.5">
        <h1 className="text-lg font-semibold text-teks-utama">Halaman tidak ditemukan</h1>
        <p className="text-sm text-teks-redup">
          Alamat <span className="angka break-all text-teks-samar">{pathname}</span> tidak
          ada di UtangKu. Mungkin tautannya salah ketik atau sudah berubah.
        </p>
      </div>
      <p className="text-xs text-teks-samar">
        Catatan utang Anda tetap aman — tidak ada yang hilang.
      </p>
      <TombolTautan to="/" varian="utama">
        Kembali ke Beranda
      </TombolTautan>
    </div>
  );
}
