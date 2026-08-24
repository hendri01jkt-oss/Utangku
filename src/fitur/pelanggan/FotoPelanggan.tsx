import { useEffect, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/data/db';
import { cn } from '@/lib/cn';

/** Dua huruf awal nama, untuk pelanggan tanpa foto. */
function inisial(nama: string) {
  const bagian = nama.trim().split(/\s+/).filter(Boolean);
  const huruf = bagian.slice(0, 2).map((b) => b[0] ?? '');
  return huruf.join('').toUpperCase() || '?';
}

/**
 * Foto dibaca dari blob di perangkat, bukan dari URL Storage — supaya tetap
 * tampil saat offline dan tidak perlu URL bertanda tangan setiap kali render.
 */
export function FotoPelanggan({
  pelangganId,
  nama,
  ukuran = 44,
  className,
}: {
  pelangganId: string;
  nama: string;
  ukuran?: number;
  className?: string;
}) {
  const foto = useLiveQuery(() => db.foto.get(pelangganId), [pelangganId]);

  // URL diturunkan saat render, bukan lewat setState di dalam efek — supaya
  // foto tampil pada render pertama tanpa satu putaran render tambahan.
  const url = useMemo(() => (foto?.blob ? URL.createObjectURL(foto.blob) : null), [foto]);

  // URL objek menahan blob di memori sampai dilepas.
  useEffect(() => () => { if (url) URL.revokeObjectURL(url); }, [url]);

  const gaya = { width: ukuran, height: ukuran };

  if (url) {
    return (
      <img
        src={url}
        alt={`Foto ${nama}`}
        style={gaya}
        className={cn('shrink-0 rounded-full border border-garis object-cover', className)}
      />
    );
  }

  return (
    <span
      style={gaya}
      aria-hidden
      className={cn(
        'flex shrink-0 items-center justify-center rounded-full',
        'bg-permukaan-2 text-xs font-semibold text-teks-samar',
        className,
      )}
    >
      {inisial(nama)}
    </span>
  );
}
