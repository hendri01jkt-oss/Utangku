import { Kartu } from '@/komponen/ui';

export function HalamanPelanggan() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-lg font-semibold">Pelanggan</h1>
      <Kartu>
        <p className="text-sm text-teks-redup">Daftar pelanggan dan sisa utangnya akan muncul di sini. Dibangun di Tahap 4.</p>
      </Kartu>
    </div>
  );
}
