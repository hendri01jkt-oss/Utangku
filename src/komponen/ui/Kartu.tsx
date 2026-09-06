import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/cn';

interface Props extends HTMLAttributes<HTMLDivElement> {
  /** Bayangan lebih tegas, untuk elemen yang benar-benar terangkat (mis. bottom sheet). */
  terangkat?: boolean;
  padat?: boolean;
  /**
   * Kartu yang bisa disentuh: ikut turun sedikit saat ditekan.
   *
   * Sengaja harus diminta, bukan otomatis. Kartu ringkasan yang tidak
   * menuju ke mana-mana tetapi ikut bergerak saat disentuh membuat
   * pemakainya menunggu sesuatu yang tidak akan terjadi.
   */
  dapatDitekan?: boolean;
}

export function Kartu({
  terangkat,
  padat,
  dapatDitekan,
  className,
  children,
  ...sisa
}: Props) {
  return (
    <div
      className={cn(
        terangkat ? 'permukaan-angkat' : 'permukaan',
        'rounded-[var(--radius-kartu)]',
        dapatDitekan && 'bisa-ditekan',
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
          penting ? 'text-merah-600' : 'text-teks-utama',
        )}
      >
        {nilai}
      </p>
    </Kartu>
  );
}
