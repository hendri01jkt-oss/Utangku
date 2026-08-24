import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Link, type LinkProps } from 'react-router-dom';
import { cn } from '@/lib/cn';

type Varian = 'utama' | 'sekunder' | 'halus' | 'bahaya';
type Ukuran = 'sedang' | 'besar';

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  varian?: Varian;
  ukuran?: Ukuran;
  ikon?: ReactNode;
  penuh?: boolean;
}

const gayaVarian: Record<Varian, string> = {
  /* Merah solid — hanya untuk satu aksi utama per layar. */
  utama:
    'bg-merah-600 text-putih font-semibold hover:bg-merah-700 active:bg-merah-700',
  /* Putih bergaris: aksi setara yang bukan aksi utama. */
  sekunder: 'permukaan text-teks-utama hover:bg-permukaan-2',
  /* Tanpa latar, untuk aksi tersier. */
  halus: 'text-teks-redup hover:bg-permukaan-2 hover:text-teks-utama',
  /*
   * Aksi merusak. Tetap bergaris, bukan isian merah solid — di satu layar
   * hanya boleh ada satu isian merah, dan itu jatah aksi utama. Kalau Hapus
   * ikut solid, keduanya berebut perhatian yang sama.
   */
  bahaya: 'bg-putih text-bahaya border border-bahaya/40 hover:bg-[var(--tint-bahaya)]',
};

const gayaUkuran: Record<Ukuran, string> = {
  /* 44px: target sentuh minimum, aplikasi ini dipakai sambil berdiri. */
  sedang: 'min-h-11 px-4 text-sm gap-2',
  besar: 'min-h-13 px-5 text-base gap-2.5',
};

/**
 * Kelas bersama tombol dan tautan-yang-tampil-seperti-tombol.
 *
 * Dipakai keduanya supaya "Catat Utang" yang berupa navigasi tidak pernah
 * terlihat berbeda dari tombol di sebelahnya hanya karena kelasnya disalin
 * dan salah satu ketinggalan diperbarui.
 */
function kelasTombol(varian: Varian, ukuran: Ukuran, penuh?: boolean, tambahan?: string) {
  return cn(
    'inline-flex items-center justify-center rounded-[var(--radius-kontrol)]',
    'transition-colors duration-150',
    gayaVarian[varian],
    gayaUkuran[ukuran],
    penuh && 'w-full',
    tambahan,
  );
}

/** Navigasi yang tampil sebagai tombol. */
export function TombolTautan({
  varian = 'sekunder',
  ukuran = 'sedang',
  ikon,
  penuh,
  className,
  children,
  ...sisa
}: LinkProps & {
  varian?: Varian;
  ukuran?: Ukuran;
  ikon?: ReactNode;
  penuh?: boolean;
}) {
  return (
    <Link className={kelasTombol(varian, ukuran, penuh, className)} {...sisa}>
      {ikon}
      {children}
    </Link>
  );
}

export function Tombol({
  varian = 'sekunder',
  ukuran = 'sedang',
  ikon,
  penuh,
  className,
  children,
  ...sisa
}: Props) {
  return (
    <button
      className={kelasTombol(
        varian,
        ukuran,
        penuh,
        cn(
          /* Nonaktif dibuat pudar dengan mengganti warnanya, bukan dengan
             opacity: teks putih di atas merah yang ditipiskan hanya mencapai
             sekitar 2:1, dan malah masih terlihat seperti tombol aktif. */
          'disabled:cursor-not-allowed disabled:border-garis disabled:bg-permukaan-2',
          'disabled:text-teks-samar disabled:shadow-none disabled:hover:bg-permukaan-2',
          className,
        ),
      )}
      {...sisa}
    >
      {ikon}
      {children}
    </button>
  );
}
