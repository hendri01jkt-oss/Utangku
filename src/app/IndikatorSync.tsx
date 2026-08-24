import { useLiveQuery } from 'dexie-react-hooks';
import { Check, CloudOff, RefreshCw, TriangleAlert } from 'lucide-react';
import { db } from '@/data/db';
import { sinkronSekarang } from '@/data/sync/mesin';
import { useSync } from '@/data/sync/useSync';
import { cn } from '@/lib/cn';

/**
 * Status sinkronisasi selalu terlihat, dan bisa ditekan untuk memaksa sync.
 * Pemilik warung berhak tahu apakah catatannya sudah aman.
 *
 * Jumlah tertunda dibaca langsung dari outbox lewat useLiveQuery, bukan
 * disalin ke store — supaya angkanya tidak pernah bisa melenceng dari isi
 * antrean yang sebenarnya.
 */
export function IndikatorSync() {
  const status = useSync((s) => s.status);
  const tertunda = useLiveQuery(() => db.outbox.filter((e) => e.galat === null).count(), [], 0);
  const bermasalah = useLiveQuery(() => db.outbox.filter((e) => e.galat !== null).count(), [], 0);

  const tampilan =
    bermasalah > 0
      ? { label: 'Perlu diperiksa', Ikon: TriangleAlert, kelas: 'text-bahaya' }
      : status === 'offline'
        ? { label: 'Offline', Ikon: CloudOff, kelas: 'text-peringatan' }
        : status === 'menyinkronkan'
          ? { label: 'Menyinkronkan', Ikon: RefreshCw, kelas: 'text-teks-redup' }
          : { label: 'Tersinkron', Ikon: Check, kelas: 'text-sukses' };

  const { label, Ikon, kelas } = tampilan;
  const jumlah = bermasalah > 0 ? bermasalah : tertunda;

  return (
    <button
      type="button"
      onClick={() => void sinkronSekarang('manual')}
      title="Sinkronkan sekarang"
      className={cn(
        'flex items-center gap-1.5 rounded-full px-2 py-1 text-xs transition-colors hover:bg-white/10',
        kelas,
      )}
      aria-live="polite"
    >
      <Ikon
        size={14}
        aria-hidden
        className={status === 'menyinkronkan' && bermasalah === 0 ? 'animate-spin' : undefined}
      />
      <span>{label}</span>
      {jumlah > 0 ? <span className="angka">({jumlah})</span> : null}
    </button>
  );
}
