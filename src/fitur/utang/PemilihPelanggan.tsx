import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Check, Search, UserPlus, X } from 'lucide-react';
import { db, type BarisPelanggan } from '@/data/db';
import { buatPelanggan } from '@/data/repo/pelanggan';
import { FotoPelanggan } from '@/fitur/pelanggan/FotoPelanggan';
import { cn } from '@/lib/cn';

const BATAS_TAMPIL = 6;

/**
 * Memilih pelanggan tanpa meninggalkan formulir utang.
 *
 * Pemilik warung mencatat sambil melayani pembeli, jadi pelanggan baru harus
 * bisa dibuat di tempat — melempar mereka ke halaman lain lalu kembali akan
 * membuat catatan utang tertunda, dan yang tertunda biasanya tidak jadi
 * dicatat sama sekali.
 */
export function PemilihPelanggan({
  warungId,
  terpilih,
  onPilih,
}: {
  warungId: string;
  terpilih: BarisPelanggan | null;
  onPilih: (pelanggan: BarisPelanggan | null) => void;
}) {
  const [kueri, setKueri] = useState('');
  const [sedangBuat, setSedangBuat] = useState(false);

  const pelanggan = useLiveQuery(
    async () =>
      await db.pelanggan
        .where('warung_id')
        .equals(warungId)
        .filter((p) => p.deleted_at === null)
        .toArray(),
    [warungId],
    [],
  );

  const q = kueri.trim().toLowerCase();
  const angka = q.replace(/\D/g, '');
  const cocok = pelanggan
    .filter((p) => {
      if (q === '') return true;
      const wa = (p.no_wa ?? '').replace(/\D/g, '');
      return p.nama.toLowerCase().includes(q) || (angka !== '' && wa.includes(angka));
    })
    .sort((a, b) => a.nama.localeCompare(b.nama, 'id'))
    .slice(0, BATAS_TAMPIL);

  const adaNamaSamaPersis = pelanggan.some(
    (p) => p.nama.trim().toLowerCase() === q && q !== '',
  );

  async function buatCepat() {
    const nama = kueri.trim();
    if (nama === '') return;
    setSedangBuat(true);
    try {
      onPilih(await buatPelanggan({ warung_id: warungId, nama }));
      setKueri('');
    } finally {
      setSedangBuat(false);
    }
  }

  if (terpilih) {
    return (
      <div className="flex flex-col gap-1.5">
        <span className="text-sm text-teks-redup">Pelanggan</span>
        <div className="flex items-center gap-3 rounded-[var(--radius-kontrol)] border border-garis bg-putih p-2.5">
          <FotoPelanggan pelangganId={terpilih.id} nama={terpilih.nama} ukuran={36} />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium">{terpilih.nama}</span>
            {terpilih.no_wa ? (
              <span className="block text-xs text-teks-samar">{terpilih.no_wa}</span>
            ) : null}
          </span>
          <button
            type="button"
            onClick={() => onPilih(null)}
            aria-label="Ganti pelanggan"
            className="flex size-8 items-center justify-center rounded-full text-teks-samar hover:bg-permukaan-2"
          >
            <X size={16} aria-hidden />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor="cari-pelanggan" className="text-sm text-teks-redup">
        Pelanggan
      </label>
      <div className="flex items-center gap-2 rounded-[var(--radius-kontrol)] border border-garis bg-putih px-3 transition-colors focus-within:border-merah-600">
        <Search size={16} className="text-teks-samar" aria-hidden />
        <input
          id="cari-pelanggan"
          value={kueri}
          onChange={(e) => setKueri(e.target.value)}
          placeholder="Ketik nama pelanggan"
          autoComplete="off"
          className="w-full bg-transparent py-2.5 text-teks-utama outline-none placeholder:text-teks-samar"
        />
      </div>

      <ul className="flex flex-col gap-1">
        {cocok.map((p) => (
          <li key={p.id}>
            <button
              type="button"
              onClick={() => onPilih(p)}
              className="flex w-full items-center gap-3 rounded-[var(--radius-kontrol)] p-2 text-left transition-colors hover:bg-permukaan-2"
            >
              <FotoPelanggan pelangganId={p.id} nama={p.nama} ukuran={32} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm">{p.nama}</span>
                {p.no_wa ? (
                  <span className="block text-xs text-teks-samar">{p.no_wa}</span>
                ) : null}
              </span>
              <Check size={16} className="text-teks-samar" aria-hidden />
            </button>
          </li>
        ))}
      </ul>

      {q !== '' && !adaNamaSamaPersis ? (
        <button
          type="button"
          onClick={() => void buatCepat()}
          disabled={sedangBuat}
          className={cn(
            'flex items-center gap-2 rounded-[var(--radius-kontrol)] border border-dashed',
            'border-merah-600/50 p-2.5 text-left text-sm text-merah-600',
            'transition-colors hover:bg-[var(--tint-bahaya)] disabled:opacity-60',
          )}
        >
          <UserPlus size={16} aria-hidden />
          {sedangBuat ? 'Membuat…' : `Buat pelanggan baru "${kueri.trim()}"`}
        </button>
      ) : null}

      {pelanggan.length === 0 ? (
        <p className="text-xs text-teks-samar">
          Belum ada pelanggan. Ketik namanya untuk membuat yang pertama.
        </p>
      ) : null}
    </div>
  );
}
