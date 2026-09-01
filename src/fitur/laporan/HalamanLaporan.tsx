import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { FileSpreadsheet, FileText } from 'lucide-react';
import { Input, Kartu, KartuStatistik, Tombol } from '@/komponen/ui';
import { KotakGalat } from '@/fitur/auth/LayoutAuth';
import { useSesi } from '@/fitur/auth/useSesi';
import { formatRupiah } from '@/lib/uang';
import { cn } from '@/lib/cn';
import {
  periodeBulanIni,
  periodeBulanLalu,
  susunLaporan,
  type Periode,
} from './dataLaporan';
import { unduhExcel, unduhPdf } from './ekspor';

type PilihanPeriode = 'bulan-ini' | 'bulan-lalu' | 'custom';

const formatTanggal = (iso: string) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

export function HalamanLaporan() {
  const warung = useSesi((s) => s.warung);
  const [pilihan, setPilihan] = useState<PilihanPeriode>('bulan-ini');
  const [custom, setCustom] = useState<Periode>(periodeBulanIni());
  const [sedangEkspor, setSedangEkspor] = useState<'pdf' | 'excel' | null>(null);
  const [galat, setGalat] = useState<string | null>(null);

  const periode: Periode =
    pilihan === 'bulan-ini'
      ? periodeBulanIni()
      : pilihan === 'bulan-lalu'
        ? periodeBulanLalu()
        : custom;

  const periodeSah = periode.mulai <= periode.sampai;

  const laporan = useLiveQuery(
    async () =>
      warung && periodeSah ? await susunLaporan(warung.id, periode) : undefined,
    [warung?.id, periode.mulai, periode.sampai, periodeSah],
  );

  async function ekspor(jenis: 'pdf' | 'excel') {
    if (!laporan || !warung) return;
    setGalat(null);
    setSedangEkspor(jenis);
    try {
      if (jenis === 'pdf') await unduhPdf(laporan, warung.nama_warung);
      else await unduhExcel(laporan, warung.nama_warung);
    } catch (err) {
      setGalat(err instanceof Error ? err.message : 'Gagal membuat berkas ekspor.');
    } finally {
      setSedangEkspor(null);
    }
  }

  const pilihanPeriode: { nilai: PilihanPeriode; label: string }[] = [
    { nilai: 'bulan-ini', label: 'Bulan ini' },
    { nilai: 'bulan-lalu', label: 'Bulan lalu' },
    { nilai: 'custom', label: 'Pilih sendiri' },
  ];

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-lg font-semibold">Laporan</h1>

      <div className="flex flex-wrap gap-2">
        {pilihanPeriode.map((p) => (
          <button
            key={p.nilai}
            type="button"
            onClick={() => setPilihan(p.nilai)}
            aria-pressed={pilihan === p.nilai}
            className={cn(
              'min-h-9 rounded-full border px-3.5 text-sm transition-colors',
              pilihan === p.nilai
                ? 'border-merah-600 bg-merah-600 text-putih'
                : 'border-garis bg-putih text-teks-redup hover:bg-permukaan-2',
            )}
          >
            {p.label}
          </button>
        ))}
      </div>

      {pilihan === 'custom' ? (
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Dari tanggal"
            type="date"
            value={custom.mulai}
            onChange={(e) => setCustom((c) => ({ ...c, mulai: e.target.value }))}
          />
          <Input
            label="Sampai tanggal"
            type="date"
            value={custom.sampai}
            onChange={(e) => setCustom((c) => ({ ...c, sampai: e.target.value }))}
          />
        </div>
      ) : (
        <p className="text-xs text-teks-samar">
          {formatTanggal(periode.mulai)} – {formatTanggal(periode.sampai)}
        </p>
      )}

      {!periodeSah ? (
        <KotakGalat pesan="Tanggal akhir tidak boleh lebih awal dari tanggal mulai." />
      ) : null}
      <KotakGalat pesan={galat} />

      <section aria-label="Ringkasan periode" className="flex flex-col gap-3">
        <KartuStatistik
          label="Sisa piutang akhir periode"
          nilai={laporan ? formatRupiah(laporan.sisaPiutang) : '—'}
          penting
        />
        <div className="grid grid-cols-2 gap-3">
          <KartuStatistik
            label="Utang baru"
            nilai={laporan ? formatRupiah(laporan.totalUtangBaru) : '—'}
          />
          <KartuStatistik
            label="Tertagih"
            nilai={laporan ? formatRupiah(laporan.totalTertagih) : '—'}
          />
        </div>
        {/*
          Penjualan tunai berdiri sendiri, sebaris penuh, supaya tidak pernah
          terbaca sebagai bagian dari piutang maupun dari uang tagihan yang
          masuk. Keduanya sudah punya kartunya sendiri di atas.
        */}
        <KartuStatistik
          label="Penjualan tunai"
          nilai={laporan ? formatRupiah(laporan.totalPenjualanTunai) : '—'}
        />
      </section>

      <div className="grid grid-cols-2 gap-3">
        <Tombol
          varian="sekunder"
          ikon={<FileText size={16} />}
          onClick={() => void ekspor('pdf')}
          disabled={!laporan || sedangEkspor !== null}
        >
          {sedangEkspor === 'pdf' ? 'Menyiapkan…' : 'Export PDF'}
        </Tombol>
        <Tombol
          varian="sekunder"
          ikon={<FileSpreadsheet size={16} />}
          onClick={() => void ekspor('excel')}
          disabled={!laporan || sedangEkspor !== null}
        >
          {sedangEkspor === 'excel' ? 'Menyiapkan…' : 'Export Excel'}
        </Tombol>
      </div>

      <section aria-labelledby="judul-utang" className="flex flex-col gap-2">
        <h2 id="judul-utang" className="text-sm font-semibold text-teks-redup">
          Utang Baru{' '}
          <span className="angka font-normal text-teks-samar">
            ({laporan?.utangBaru.length ?? 0})
          </span>
        </h2>
        {laporan && laporan.utangBaru.length > 0 ? (
          <ul className="flex flex-col gap-2">
            {laporan.utangBaru.map((t, i) => (
              <li key={`${t.tanggal}-${i}`}>
                <Kartu padat className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{t.namaPelanggan}</p>
                    <p className="truncate text-xs text-teks-samar">
                      {formatTanggal(t.tanggal)}
                      {t.keterangan ? ` · ${t.keterangan}` : ''}
                    </p>
                  </div>
                  <p className="angka shrink-0 text-sm font-semibold">
                    {formatRupiah(t.nominal)}
                  </p>
                </Kartu>
              </li>
            ))}
          </ul>
        ) : (
          <Kartu>
            <p className="text-sm text-teks-samar">
              Tidak ada utang baru pada periode ini.
            </p>
          </Kartu>
        )}
      </section>

      <section aria-labelledby="judul-tunai" className="flex flex-col gap-2">
        <h2 id="judul-tunai" className="text-sm font-semibold text-teks-redup">
          Penjualan Tunai{' '}
          <span className="angka font-normal text-teks-samar">
            ({laporan?.penjualanTunai.length ?? 0})
          </span>
        </h2>
        {laporan && laporan.penjualanTunai.length > 0 ? (
          <ul className="flex flex-col gap-2">
            {laporan.penjualanTunai.map((t, i) => (
              <li key={`${t.tanggal}-${i}`}>
                <Kartu padat className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{t.namaPelanggan}</p>
                    <p className="truncate text-xs text-teks-samar">
                      {formatTanggal(t.tanggal)}
                      {t.keterangan ? ` · ${t.keterangan}` : ''}
                    </p>
                  </div>
                  <p className="angka shrink-0 text-sm font-semibold text-sukses">
                    {formatRupiah(t.nominal)}
                  </p>
                </Kartu>
              </li>
            ))}
          </ul>
        ) : (
          <Kartu>
            <p className="text-sm text-teks-samar">
              Tidak ada penjualan tunai pada periode ini.
            </p>
          </Kartu>
        )}
      </section>

      <section aria-labelledby="judul-bayar" className="flex flex-col gap-2">
        <h2 id="judul-bayar" className="text-sm font-semibold text-teks-redup">
          Pembayaran Diterima{' '}
          <span className="angka font-normal text-teks-samar">
            ({laporan?.pembayaran.length ?? 0})
          </span>
        </h2>
        {laporan && laporan.pembayaran.length > 0 ? (
          <ul className="flex flex-col gap-2">
            {laporan.pembayaran.map((b, i) => (
              <li key={`${b.tanggal}-${i}`}>
                <Kartu padat className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{b.namaPelanggan}</p>
                    <p className="truncate text-xs capitalize text-teks-samar">
                      {formatTanggal(b.tanggal)} · {b.metode}
                    </p>
                  </div>
                  <p className="angka shrink-0 text-sm font-semibold text-sukses">
                    {formatRupiah(b.nominal)}
                  </p>
                </Kartu>
              </li>
            ))}
          </ul>
        ) : (
          <Kartu>
            <p className="text-sm text-teks-samar">
              Belum ada pembayaran pada periode ini.
            </p>
          </Kartu>
        )}
      </section>
    </div>
  );
}
