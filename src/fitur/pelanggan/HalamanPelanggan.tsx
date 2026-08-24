import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { Plus, Search, UserPlus } from 'lucide-react';
import { Input, Kartu } from '@/komponen/ui';
import { useSesi } from '@/fitur/auth/useSesi';
import { formatRupiah } from '@/lib/uang';
import { cn } from '@/lib/cn';
import { FotoPelanggan } from './FotoPelanggan';
import {
  cocokPencarian,
  daftarPelangganRingkas,
  type UrutanPelanggan,
} from './ringkasan';

const pilihanUrutan: { nilai: UrutanPelanggan; label: string }[] = [
  { nilai: 'sisa', label: 'Utang terbesar' },
  { nilai: 'lama', label: 'Paling lama' },
  { nilai: 'nama', label: 'Nama' },
];

export function HalamanPelanggan() {
  const warung = useSesi((s) => s.warung);
  const [kueri, setKueri] = useState('');
  const [urutan, setUrutan] = useState<UrutanPelanggan>('sisa');

  const semua = useLiveQuery(
    () => (warung ? daftarPelangganRingkas(warung.id, urutan) : Promise.resolve([])),
    [warung?.id, urutan],
  );

  const hasil = (semua ?? []).filter((b) => cocokPencarian(b, kueri));

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-lg font-semibold">Pelanggan</h1>

      <Input
        aria-label="Cari pelanggan"
        placeholder="Cari nama atau nomor WA"
        value={kueri}
        onChange={(e) => setKueri(e.target.value)}
        awalan={<Search size={16} />}
        inputMode="search"
      />

      <div className="flex flex-wrap gap-2">
        {pilihanUrutan.map((p) => (
          <button
            key={p.nilai}
            type="button"
            onClick={() => setUrutan(p.nilai)}
            aria-pressed={urutan === p.nilai}
            className={cn(
              'rounded-full border px-3 py-1.5 text-xs transition-colors',
              urutan === p.nilai
                ? 'border-merah-600 bg-merah-600 text-putih'
                : 'border-garis bg-putih text-teks-redup hover:bg-permukaan-2',
            )}
          >
            {p.label}
          </button>
        ))}
      </div>

      {semua === undefined ? (
        <p className="py-8 text-center text-sm text-teks-samar">Memuat…</p>
      ) : hasil.length === 0 ? (
        <Kartu className="flex flex-col items-center gap-3 py-8 text-center">
          <UserPlus size={32} className="text-teks-samar" aria-hidden />
          <p className="text-sm text-teks-redup">
            {kueri
              ? `Tidak ada pelanggan yang cocok dengan "${kueri}".`
              : 'Belum ada pelanggan. Tambahkan yang pertama.'}
          </p>
        </Kartu>
      ) : (
        <ul className="flex flex-col gap-2">
          {hasil.map(({ pelanggan, sisaUtang, jumlahUtangAktif }) => (
            <li key={pelanggan.id}>
              <Link
                to={`/pelanggan/${pelanggan.id}`}
                className="permukaan flex items-center gap-3 rounded-[var(--radius-kartu)] p-3 transition-colors hover:bg-permukaan-2"
              >
                <FotoPelanggan pelangganId={pelanggan.id} nama={pelanggan.nama} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{pelanggan.nama}</span>
                  <span className="block text-xs text-teks-samar">
                    {jumlahUtangAktif > 0
                      ? `${jumlahUtangAktif} utang belum lunas`
                      : 'Tidak ada utang'}
                  </span>
                </span>
                <span
                  className={cn(
                    'angka shrink-0 text-sm font-semibold',
                    sisaUtang > 0 ? 'text-merah-600' : 'text-teks-samar',
                  )}
                >
                  {sisaUtang > 0 ? formatRupiah(sisaUtang) : '—'}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {/* Tombol tambah mengambang, selalu dalam jangkauan jempol. */}
      <Link
        to="/pelanggan/baru"
        className="fixed bottom-[calc(var(--tinggi-nav)+1rem)] left-1/2 z-10 flex min-h-12 -translate-x-1/2 items-center gap-2 rounded-full bg-merah-600 px-5 text-sm font-semibold text-putih shadow-[var(--bayang-angkat)] transition-colors hover:bg-merah-700"
      >
        <Plus size={18} aria-hidden />
        Tambah Pelanggan
      </Link>
    </div>
  );
}
