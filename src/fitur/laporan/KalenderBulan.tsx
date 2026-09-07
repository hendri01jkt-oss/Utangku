import { useMemo } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Kartu } from '@/komponen/ui';
import { cn } from '@/lib/cn';
import {
  judulBulan,
  NAMA_HARI,
  selKalender,
  type Bulan,
  type IsiHari,
  type RingkasanBulan,
} from './dataKalender';

interface Props {
  bulan: Bulan;
  ringkasan: RingkasanBulan | undefined;
  terpilih: string | null;
  hariIni: string;
  onPilih: (tanggal: string) => void;
  onGeser: (langkah: number) => void;
}

const JENIS = [
  { kunci: 'utang', label: 'Utang baru', warna: 'bg-merah-600' },
  { kunci: 'bayar', label: 'Pembayaran', warna: 'bg-sukses' },
  { kunci: 'tunai', label: 'Tunai', warna: 'bg-peringatan' },
] as const;

/**
 * Kalender satu bulan dengan titik penanda pada tanggal yang punya transaksi.
 *
 * Titik hanya menyatakan ADA, bukan berapa banyak: pada kotak selebar jempol
 * di layar 360 px, tiga titik sudah batas yang masih terbaca, dan jumlah
 * persisnya toh dibaca di rincian harian di bawahnya.
 */
export function KalenderBulan({
  bulan,
  ringkasan,
  terpilih,
  hariIni,
  onPilih,
  onGeser,
}: Props) {
  // Hanya bergantung pada bulan, jadi tidak ikut dihitung ulang saat data
  // berubah atau saat pengguna mengetuk-ngetuk tanggal.
  const sel = useMemo(() => selKalender(bulan), [bulan]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => onGeser(-1)}
          aria-label="Bulan sebelumnya"
          className="permukaan bisa-ditekan grid size-10 place-items-center rounded-full text-teks-redup"
        >
          <ChevronLeft size={20} />
        </button>
        <p aria-live="polite" className="text-[15px] font-semibold">
          {judulBulan(bulan)}
        </p>
        <button
          type="button"
          onClick={() => onGeser(1)}
          aria-label="Bulan berikutnya"
          className="permukaan bisa-ditekan grid size-10 place-items-center rounded-full text-teks-redup"
        >
          <ChevronRight size={20} />
        </button>
      </div>

      <Kartu padat>
        <div className="grid grid-cols-7 gap-0.5">
          {NAMA_HARI.map((h) => (
            <div key={h} className="pb-1.5 text-center text-[11px] font-semibold text-teks-samar">
              {h}
            </div>
          ))}

          {sel.map((tanggal, i) =>
            tanggal === null ? (
              <div key={`kosong-${i}`} aria-hidden="true" />
            ) : (
              <SelTanggal
                key={tanggal}
                tanggal={tanggal}
                isi={ringkasan?.hari.get(tanggal)}
                dipilih={tanggal === terpilih}
                hariIni={tanggal === hariIni}
                onPilih={onPilih}
              />
            ),
          )}
        </div>

        <div className="flex flex-wrap gap-x-3.5 gap-y-1.5 pt-2.5 text-[11.5px] text-teks-samar">
          {JENIS.map((j) => (
            <span key={j.kunci} className="flex items-center gap-1.5">
              <i className={cn('size-[7px] rounded-full', j.warna)} aria-hidden="true" />
              {j.label}
            </span>
          ))}
        </div>
      </Kartu>
    </div>
  );
}

function SelTanggal({
  tanggal,
  isi,
  dipilih,
  hariIni,
  onPilih,
}: {
  tanggal: string;
  isi: IsiHari | undefined;
  dipilih: boolean;
  hariIni: boolean;
  onPilih: (tanggal: string) => void;
}) {
  const titik = [
    isi && isi.utangBaru.length > 0 ? 'utang' : null,
    isi && isi.pembayaran.length > 0 ? 'bayar' : null,
    isi && isi.penjualanTunai.length > 0 ? 'tunai' : null,
  ].filter((t): t is 'utang' | 'bayar' | 'tunai' => t !== null);

  /*
   * Warna saja tidak cukup: tiga titik 6 px sulit dibedakan oleh mata yang
   * lelah, apalagi oleh pengguna buta warna merah-hijau. Isi tanggalnya
   * dieja lengkap di aria-label supaya tetap bisa dibaca pembaca layar.
   */
  const rincian = isi
    ? [
        isi.utangBaru.length > 0 ? `${isi.utangBaru.length} utang baru` : null,
        isi.pembayaran.length > 0 ? `${isi.pembayaran.length} pembayaran` : null,
        isi.penjualanTunai.length > 0
          ? `${isi.penjualanTunai.length} penjualan tunai`
          : null,
      ]
        .filter(Boolean)
        .join(', ')
    : '';

  const nomor = Number(tanggal.slice(8));

  return (
    <button
      type="button"
      onClick={() => onPilih(tanggal)}
      aria-pressed={dipilih}
      aria-current={hariIni ? 'date' : undefined}
      aria-label={`${nomor} — ${rincian || 'tidak ada transaksi'}`}
      className={cn(
        'flex aspect-square flex-col items-center justify-center gap-1 rounded-xl',
        'text-[15px] transition-colors',
        dipilih
          ? 'bg-merah-600 font-bold text-putih'
          : hariIni
            ? 'font-bold text-teks-utama inset-ring-2 inset-ring-merah-600'
            : 'text-teks-utama hover:bg-permukaan-2',
      )}
    >
      <span className="angka">{nomor}</span>
      <span className="flex h-1.5 gap-[3px]" aria-hidden="true">
        {titik.map((t) => (
          <i
            key={t}
            className={cn(
              'size-1.5 rounded-full',
              dipilih ? 'bg-putih' : JENIS.find((j) => j.kunci === t)?.warna,
            )}
          />
        ))}
      </span>
    </button>
  );
}
