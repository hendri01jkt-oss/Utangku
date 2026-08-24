import type { ButtonHTMLAttributes, ReactNode } from 'react';
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
  /* Emas solid — hanya untuk satu aksi utama per layar. */
  utama:
    'bg-gold-500 text-navy-950 font-semibold hover:bg-gold-400 active:bg-gold-600 shadow-lg shadow-gold-500/10',
  /* Kaca dengan garis emas tipis. */
  sekunder: 'kaca text-teks-utama hover:bg-white/10',
  /* Tanpa latar, untuk aksi tersier. */
  halus: 'text-teks-redup hover:bg-white/5 hover:text-teks-utama',
  /* Merah bertint, bukan isian solid — isian merah jenuh gagal kontras. */
  bahaya:
    'bg-[var(--tint-bahaya)] text-bahaya border border-bahaya/30 hover:bg-bahaya/20',
};

const gayaUkuran: Record<Ukuran, string> = {
  /* 44px: target sentuh minimum, aplikasi ini dipakai sambil berdiri. */
  sedang: 'min-h-11 px-4 text-sm gap-2',
  besar: 'min-h-13 px-5 text-base gap-2.5',
};

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
      className={cn(
        'inline-flex items-center justify-center rounded-[var(--radius-kontrol)]',
        'transition-colors duration-150',
        'disabled:cursor-not-allowed disabled:opacity-50',
        gayaVarian[varian],
        gayaUkuran[ukuran],
        penuh && 'w-full',
        className,
      )}
      {...sisa}
    >
      {ikon}
      {children}
    </button>
  );
}
