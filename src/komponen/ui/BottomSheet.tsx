import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

/**
 * Panel yang muncul dari bawah layar.
 *
 * Bentuk ini dipilih karena UtangKu dipakai satu tangan sambil berdiri:
 * isian dan tombolnya berada di paruh bawah layar, dalam jangkauan jempol,
 * bukan di tengah seperti dialog desktop.
 */
export function BottomSheet({
  judul,
  onTutup,
  children,
}: {
  judul: string;
  onTutup: () => void;
  children: ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const saatTombol = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onTutup();
    };
    document.addEventListener('keydown', saatTombol);

    // Kunci gulir halaman di belakang, kalau tidak panel ikut bergeser
    // saat pengguna menggulir isinya.
    const gulirSemula = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', saatTombol);
      document.body.style.overflow = gulirSemula;
    };
  }, [onTutup]);

  /*
   * Dirender ke <body> lewat portal, bukan di tempat ia dipanggil.
   *
   * `z-30` hanya berarti sesuatu bila dibandingkan di stacking context yang
   * sama. Saat panel ini dibuka dari header — yang `sticky z-10` dan karena
   * itu membentuk stacking context sendiri — seluruh panel ikut terkurung di
   * dalamnya dan justru tertimbun navigasi bawah yang `z-20`. Akibatnya
   * tombol aksi di dasar panel tidak bisa ditekan sama sekali di layar
   * 390px. Portal melepaskannya dari kurungan itu, apa pun tempat ia
   * dipanggil.
   */
  return createPortal(
    <div className="fixed inset-0 z-30 flex items-end justify-center">
      {/*
        Latar gelap: menekannya menutup panel. Sengaja BUKAN <button> dan
        disembunyikan dari pembaca layar — kalau ikut masuk pohon
        aksesibilitas, akan ada dua kontrol bernama "Tutup" yang membingungkan.
        Jalur non-tikus sudah tersedia lewat tombol X dan tombol Escape.
      */}
      <div
        aria-hidden
        onClick={onTutup}
        className="absolute inset-0 bg-[rgb(23_18_18/0.45)]"
      />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={judul}
        className="permukaan-angkat relative max-h-[88dvh] w-full max-w-lg overflow-y-auto rounded-t-2xl border-x-0 border-b-0 px-4 pt-3"
        style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}
      >
        {/* Gagang kecil, penanda visual bahwa panel ini datang dari bawah. */}
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-garis-kuat" aria-hidden />

        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-base font-semibold">{judul}</h2>
          <button
            type="button"
            onClick={onTutup}
            aria-label="Tutup"
            className="flex size-9 items-center justify-center rounded-full text-teks-samar hover:bg-permukaan-2"
          >
            <X size={18} aria-hidden />
          </button>
        </div>

        {children}
      </div>
    </div>,
    document.body,
  );
}
