import type { ReactNode } from 'react';
import { Kartu } from '@/komponen/ui';

/** Kerangka halaman auth: satu kartu permukaan di tengah, tanpa bottom nav. */
export function LayoutAuth({
  judul,
  keterangan,
  children,
  bawah,
}: {
  judul: string;
  keterangan?: string;
  children: ReactNode;
  bawah?: ReactNode;
}) {
  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-5 px-4 py-8">
      <div className="text-center">
        <p className="text-2xl font-semibold tracking-tight">
          Utang<span className="text-merah-600">Ku</span>
        </p>
        <p className="mt-1 text-xs text-teks-samar">
          Catatan utang warung yang tetap jalan tanpa sinyal
        </p>
      </div>

      <Kartu className="flex flex-col gap-4 p-5">
        <div>
          <h1 className="text-lg font-semibold">{judul}</h1>
          {keterangan ? (
            <p className="mt-1 text-sm text-teks-redup">{keterangan}</p>
          ) : null}
        </div>
        {children}
      </Kartu>

      {bawah ? <div className="text-center text-sm text-teks-redup">{bawah}</div> : null}
    </div>
  );
}

/** Kotak pesan galat yang konsisten di semua halaman auth. */
export function KotakGalat({ pesan }: { pesan: string | null }) {
  if (!pesan) return null;
  return (
    <p
      role="alert"
      className="rounded-[var(--radius-kontrol)] border border-bahaya/30 bg-[var(--tint-bahaya)] px-3 py-2 text-sm text-bahaya"
    >
      {pesan}
    </p>
  );
}

/** Kotak pesan berhasil / informasi. */
export function KotakInfo({ pesan }: { pesan: string }) {
  return (
    <p
      role="status"
      className="rounded-[var(--radius-kontrol)] border border-sukses/30 bg-[var(--tint-sukses)] px-3 py-2 text-sm text-sukses"
    >
      {pesan}
    </p>
  );
}
