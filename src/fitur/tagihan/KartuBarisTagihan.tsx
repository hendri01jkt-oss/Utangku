import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { Kartu, StatusBadge } from '@/komponen/ui';
import { formatRupiah } from '@/lib/uang';
import { cn } from '@/lib/cn';
import { TombolTagihWa } from './TombolTagihWa';
import { labelTempo, labelUmurUtang, type BarisTagihan } from './daftarTagihan';

/**
 * Satu baris utang yang perlu ditagih, dipakai beranda maupun halaman
 * Tagihan supaya keduanya tidak bisa menampilkan hal berbeda untuk data
 * yang sama.
 */
export function KartuBarisTagihan({
  baris,
  namaWarung,
  template,
}: {
  baris: BarisTagihan;
  namaWarung: string;
  template: string | null;
}) {
  const lewat = baris.hariKeTempo !== null && baris.hariKeTempo < 0;
  const keterangan =
    baris.hariKeTempo === null
      ? labelUmurUtang(baris.transaksi.tanggal)
      : labelTempo(baris.hariKeTempo);

  return (
    // Tombol WA berdiri di luar tautan: tombol di dalam tautan bukan HTML
    // yang sah, dan menekannya akan ikut menavigasi.
    <Kartu padat className="flex items-center gap-2">
      <Link
        to={`/utang/${baris.transaksi.id}`}
        className="flex min-w-0 flex-1 items-center gap-3 rounded-[var(--radius-kontrol)] transition-colors hover:bg-permukaan-2"
      >
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium">{baris.namaPelanggan}</span>
          <span className="block truncate text-xs text-teks-samar">
            {baris.transaksi.keterangan ?? 'Tanpa keterangan'}
          </span>
          <StatusBadge
            status={lewat ? 'lewat_tempo' : baris.transaksi.status}
            className="mt-1.5"
          />
        </span>
        <span className="shrink-0 text-right">
          <span className="angka block text-sm font-semibold text-merah-600">
            {formatRupiah(baris.sisa)}
          </span>
          <span className={cn('block text-xs', lewat ? 'text-bahaya' : 'text-teks-samar')}>
            {keterangan}
          </span>
        </span>
        <ChevronRight size={18} className="shrink-0 text-teks-samar" aria-hidden />
      </Link>

      <TombolTagihWa
        idPelanggan={baris.idPelanggan}
        namaPelanggan={baris.namaPelanggan}
        noWa={baris.noWa}
        namaWarung={namaWarung}
        template={template}
        utangBelumLunas={baris.utangPelanggan}
        ikonSaja
      />
    </Kartu>
  );
}
