import { useState } from 'react';
import { CheckCheck, ChevronRight } from 'lucide-react';
import { BottomSheet, StatusBadge, Tombol } from '@/komponen/ui';
import { lunasiSemua } from '@/data/repo/pembayaran';
import { useSesi } from '@/fitur/auth/useSesi';
import type { Enums } from '@/data/database.types';
import { sisaUtang, tanggalHariIni } from '@/data/repo/transaksi';
import { formatRupiah } from '@/lib/uang';
import type { BarisTransaksi } from '@/data/db';

const formatTanggal = (iso: string) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

/**
 * Ditampilkan saat pelanggan punya lebih dari satu utang yang belum lunas.
 *
 * Uang yang diterima sengaja TIDAK dibagi otomatis ke beberapa utang:
 * pemilik warung yang tahu uang itu untuk utang yang mana, dan menebak
 * salah berarti riwayat tagihannya jadi tidak cocok dengan kenyataan.
 */
export function SheetPilihUtang({
  utang,
  onTutup,
  onPilih,
}: {
  utang: BarisTransaksi[];
  onTutup: () => void;
  onPilih: (t: BarisTransaksi) => void;
}) {
  const hariIni = tanggalHariIni();
  const sesi = useSesi((x) => x.sesi);
  const metode: Enums<'metode_bayar'> = 'tunai';
  const [sedang, setSedang] = useState(false);
  const [galat, setGalat] = useState<string | null>(null);
  const totalSisa = utang.reduce((j, t) => j + sisaUtang(t), 0);

  async function lunasi() {
    if (
      !window.confirm(
        `Lunasi ${utang.length} utang sekaligus sebesar ${formatRupiah(totalSisa)}?`,
      )
    ) {
      return;
    }
    setSedang(true);
    setGalat(null);
    try {
      await lunasiSemua(utang, { metode, dibuatOleh: sesi?.user.id ?? null });
      onTutup();
    } catch (err) {
      setGalat(err instanceof Error ? err.message : 'Gagal mencatat pelunasan.');
    } finally {
      setSedang(false);
    }
  }

  return (
    <BottomSheet judul="Bayar utang yang mana?" onTutup={onTutup}>
      <div className="mb-3 flex flex-col gap-2 rounded-[var(--radius-kontrol)] border border-emas-500/40 bg-[#fffaf0] p-3">
        <p className="text-sm font-semibold">Bayar semua sekaligus</p>
        <p className="angka text-xl font-bold text-emas-700">{formatRupiah(totalSisa)}</p>
        {galat ? <p className="text-xs text-bahaya">{galat}</p> : null}
        <Tombol
          varian="utama"
          penuh
          ikon={<CheckCheck size={16} />}
          disabled={sedang}
          onClick={() => void lunasi()}
        >
          {sedang ? 'Mencatat…' : `Lunasi semua (${utang.length} utang)`}
        </Tombol>
      </div>
      <p className="mb-2 text-xs text-teks-samar">Atau bayar salah satu saja:</p>
      <ul className="flex flex-col gap-2 pb-1">
        {utang.map((t) => (
          <li key={t.id}>
            <button
              type="button"
              onClick={() => onPilih(t)}
              className="flex w-full items-center gap-3 rounded-[var(--radius-kontrol)] border border-garis p-3 text-left transition-colors hover:bg-permukaan-2"
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">
                  {t.keterangan ?? 'Tanpa keterangan'}
                </span>
                <span className="block text-xs text-teks-samar">
                  {formatTanggal(t.tanggal)}
                </span>
                <StatusBadge
                  status={
                    t.jatuh_tempo && t.jatuh_tempo < hariIni ? 'lewat_tempo' : t.status
                  }
                  className="mt-1.5"
                />
              </span>
              <span className="shrink-0 text-right">
                <span className="angka block text-sm font-semibold text-navy-900">
                  {formatRupiah(sisaUtang(t))}
                </span>
                <span className="text-xs text-teks-samar">sisa</span>
              </span>
              <ChevronRight size={18} className="shrink-0 text-teks-samar" aria-hidden />
            </button>
          </li>
        ))}
      </ul>
    </BottomSheet>
  );
}
