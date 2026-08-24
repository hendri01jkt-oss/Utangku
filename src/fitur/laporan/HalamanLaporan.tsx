import { Kartu } from '@/komponen/ui';

export function HalamanLaporan() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-lg font-semibold">Laporan</h1>
      <Kartu>
        <p className="text-sm text-teks-redup">Rekap bulanan beserta export PDF dan Excel akan tersedia di sini. Dibangun di Tahap 10.</p>
      </Kartu>
    </div>
  );
}
