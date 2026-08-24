import { Kartu } from '@/komponen/ui';

export function HalamanTagihan() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-lg font-semibold">Perlu Ditagih</h1>
      <Kartu>
        <p className="text-sm text-teks-redup">Utang yang lewat tempo, jatuh tempo H-3, dan utang terlama akan dikelompokkan di sini. Dibangun di Tahap 9.</p>
      </Kartu>
    </div>
  );
}
