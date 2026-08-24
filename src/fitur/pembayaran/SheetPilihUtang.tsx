import { useNavigate } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { BottomSheet, StatusBadge } from '@/komponen/ui';
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
}: {
  utang: BarisTransaksi[];
  onTutup: () => void;
}) {
  const navigate = useNavigate();
  const hariIni = tanggalHariIni();

  return (
    <BottomSheet judul="Bayar utang yang mana?" onTutup={onTutup}>
      <ul className="flex flex-col gap-2 pb-1">
        {utang.map((t) => (
          <li key={t.id}>
            <button
              type="button"
              onClick={() => navigate(`/utang/${t.id}/bayar`, { replace: true })}
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
                <span className="angka block text-sm font-semibold text-merah-600">
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
