import { CircleCheck, CircleDot, Clock, TriangleAlert } from 'lucide-react';
import { cn } from '@/lib/cn';

export type Status = 'lunas' | 'sebagian' | 'belum_lunas' | 'lewat_tempo';

/**
 * Setiap status punya ikon DAN label, bukan hanya warna — supaya tetap
 * terbaca oleh pengguna dengan buta warna.
 */
const konfigurasi = {
  lunas: { label: 'Lunas', ikon: CircleCheck, kelas: 'bg-[var(--tint-sukses)] text-sukses border-sukses/25' },
  sebagian: { label: 'Sebagian', ikon: CircleDot, kelas: 'bg-[var(--tint-peringatan)] text-peringatan border-peringatan/25' },
  belum_lunas: { label: 'Belum Lunas', ikon: Clock, kelas: 'kaca text-teks-redup' },
  lewat_tempo: { label: 'Lewat Tempo', ikon: TriangleAlert, kelas: 'bg-[var(--tint-bahaya)] text-bahaya border-bahaya/25' },
} as const;

export function StatusBadge({ status, className }: { status: Status; className?: string }) {
  const { label, ikon: Ikon, kelas } = konfigurasi[status];
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium',
        kelas,
        className,
      )}
    >
      <Ikon size={13} aria-hidden />
      {label}
    </span>
  );
}
