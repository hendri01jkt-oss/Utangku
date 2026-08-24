import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/cn';

interface Props extends HTMLAttributes<HTMLDivElement> {
  /** Permukaan lebih terang, untuk elemen yang "terangkat" (mis. bottom sheet). */
  terangkat?: boolean;
  padat?: boolean;
}

export function Kartu({ terangkat, padat, className, children, ...sisa }: Props) {
  return (
    <div
      className={cn(
        terangkat ? 'kaca-kuat' : 'kaca',
        'rounded-[var(--radius-kartu)]',
        padat ? 'p-3' : 'p-4',
        className,
      )}
      {...sisa}
    >
      {children}
    </div>
  );
}

/** Kartu statistik: label kecil di atas, angka besar di bawah. */
export function KartuStatistik({
  label,
  nilai,
  ikon,
  penting,
}: {
  label: string;
  nilai: ReactNode;
  ikon?: ReactNode;
  /** Angka paling penting di layar — inilah tempat emas dipakai. */
  penting?: boolean;
}) {
  return (
    /* h-full + mt-auto: kalau label salah satu kartu turun dua baris, angka
       di kartu sebelahnya tetap sebaris. */
    <Kartu className="flex h-full flex-col">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs text-teks-samar">{label}</p>
        {ikon ? <span className="text-teks-samar">{ikon}</span> : null}
      </div>
      <p
        className={cn(
          'angka mt-auto pt-2 text-xl font-semibold',
          penting ? 'text-gold-400' : 'text-teks-utama',
        )}
      >
        {nilai}
      </p>
    </Kartu>
  );
}
