import { useState } from 'react';
import { CheckCheck } from 'lucide-react';
import { BottomSheet, Tombol } from '@/komponen/ui';
import { lunasiSemua } from '@/data/repo/pembayaran';
import { sisaUtang } from '@/data/repo/transaksi';
import { useSesi } from '@/fitur/auth/useSesi';
import { formatRupiah } from '@/lib/uang';
import type { BarisTransaksi } from '@/data/db';
import type { Enums } from '@/data/database.types';

/** Satu ketukan untuk melunasi seluruh utang pelanggan yang belum lunas. */
export function SheetLunasiSemua({
  utang,
  onTutup,
}: {
  utang: BarisTransaksi[];
  onTutup: () => void;
}) {
  const sesi = useSesi((x) => x.sesi);
  const metode: Enums<'metode_bayar'> = 'tunai';
  const [sedang, setSedang] = useState(false);
  const [galat, setGalat] = useState<string | null>(null);
  const total = utang.reduce((j, t) => j + sisaUtang(t), 0);

  async function lunasi() {
    setSedang(true);
    setGalat(null);
    try {
      await lunasiSemua(utang, { metode, dibuatOleh: sesi?.user.id ?? null });
      onTutup();
    } catch (err) {
      setGalat(err instanceof Error ? err.message : 'Gagal mencatat pelunasan.');
      setSedang(false);
    }
  }

  return (
    <BottomSheet judul="Lunasi semua utang" onTutup={onTutup}>
      <div className="flex flex-col gap-3">
        <div className="rounded-[var(--radius-kontrol)] border border-emas-500/40 bg-[#fffaf0] p-3 text-center">
          <p className="text-xs text-teks-redup">{utang.length} utang akan lunas</p>
          <p className="angka mt-1 text-3xl font-bold text-emas-700">{formatRupiah(total)}</p>
        </div>
        <ul className="flex flex-col gap-1 text-sm">
          {utang.map((t) => (
            <li key={t.id} className="flex justify-between gap-3">
              <span className="min-w-0 truncate text-teks-redup">
                {t.keterangan ?? 'Tanpa keterangan'}
              </span>
              <span className="angka shrink-0">{formatRupiah(sisaUtang(t))}</span>
            </li>
          ))}
        </ul>
        {galat ? <p className="text-xs text-bahaya">{galat}</p> : null}
        <Tombol
          varian="utama"
          ukuran="besar"
          penuh
          ikon={<CheckCheck size={17} />}
          disabled={sedang}
          onClick={() => void lunasi()}
        >
          {sedang ? 'Mencatat…' : 'Terima & lunasi semua'}
        </Tombol>
      </div>
    </BottomSheet>
  );
}
