import { Check, CloudOff, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/cn';

export type StatusSync = 'offline' | 'menyinkronkan' | 'tersinkron';

const konfigurasi = {
  offline: { label: 'Offline', Ikon: CloudOff, kelas: 'text-peringatan' },
  menyinkronkan: { label: 'Menyinkronkan', Ikon: RefreshCw, kelas: 'text-teks-redup' },
  tersinkron: { label: 'Tersinkron', Ikon: Check, kelas: 'text-sukses' },
} as const;

/**
 * Status sinkronisasi selalu terlihat: pemilik warung berhak tahu apakah
 * catatannya sudah aman.
 *
 * Tahap 0 masih statis. Disambungkan ke sync engine di Tahap 3.
 */
export function IndikatorSync({
  status = 'tersinkron',
  tertunda = 0,
}: {
  status?: StatusSync;
  tertunda?: number;
}) {
  const { label, Ikon, kelas } = konfigurasi[status];
  return (
    <span
      className={cn('flex items-center gap-1.5 text-xs', kelas)}
      role="status"
      aria-live="polite"
    >
      <Ikon
        size={14}
        aria-hidden
        className={status === 'menyinkronkan' ? 'animate-spin' : undefined}
      />
      {label}
      {tertunda > 0 ? <span className="angka">({tertunda})</span> : null}
    </span>
  );
}
