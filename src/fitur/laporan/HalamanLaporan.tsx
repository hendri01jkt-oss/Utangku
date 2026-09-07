import { useState, type ReactNode } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { FileSpreadsheet, FileText, X } from 'lucide-react';
import { Input, Kartu, KartuStatistik, Tombol } from '@/komponen/ui';
import { KotakGalat } from '@/fitur/auth/LayoutAuth';
import { useSesi } from '@/fitur/auth/useSesi';
import { tanggalHariIni } from '@/data/repo/transaksi';
import { formatRupiah } from '@/lib/uang';
import { cn } from '@/lib/cn';
import {
  periodeBulanIni,
  periodeBulanLalu,
  susunLaporan,
  type BarisLaporanBayar,
  type BarisLaporanTunai,
  type BarisLaporanUtang,
  type Periode,
} from './dataLaporan';
import {
  bulanDari,
  bulanIni,
  geserBulan,
  judulBulan,
  judulHari,
  periodeBulan,
  susunKalender,
  type Bulan,
} from './dataKalender';
import { KalenderBulan } from './KalenderBulan';
import { unduhExcel, unduhPdf } from './ekspor';

type PilihanPeriode = 'bulan-ini' | 'bulan-lalu' | 'custom';
type Tampilan = 'daftar' | 'kalender';

const formatTanggal = (iso: string) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

export function HalamanLaporan() {
  const warung = useSesi((s) => s.warung);
  const [tampilan, setTampilan] = useState<Tampilan>('daftar');
  const [pilihan, setPilihan] = useState<PilihanPeriode>('bulan-ini');
  const [custom, setCustom] = useState<Periode>(periodeBulanIni());
  const [bulan, setBulan] = useState<Bulan>(bulanIni());
  const [tanggalTerpilih, setTanggalTerpilih] = useState<string | null>(null);
  const [sedangEkspor, setSedangEkspor] = useState<'pdf' | 'excel' | null>(null);
  const [galat, setGalat] = useState<string | null>(null);

  const modeKalender = tampilan === 'kalender';

  /*
   * Di tab Kalender, bulan yang sedang dilihat ADALAH periodenya — kartu
   * ringkasan dan kedua tombol ekspor ikut bulan itu. Chip periode
   * disembunyikan supaya tidak ada dua pengendali periode di satu layar,
   * yang akan membuat angka ringkasan dan kalender bisa bicara soal bulan
   * yang berbeda.
   */
  const periode: Periode = modeKalender
    ? periodeBulan(bulan)
    : pilihan === 'bulan-ini'
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

  /*
   * Kalender punya query sendiri yang hanya membaca satu bulan lewat indeks
   * [warung_id+tanggal]. Kuncinya cuma warung dan bulan: mengetuk tanggal
   * tidak menyentuh IndexedDB sama sekali, karena isi harinya diambil dari
   * Map hasil query ini yang sudah ada di memori.
   */
  const kalender = useLiveQuery(
    async () =>
      warung && modeKalender ? await susunKalender(warung.id, bulan) : undefined,
    [warung?.id, bulan, modeKalender],
  );

  const isiHari = tanggalTerpilih ? kalender?.hari.get(tanggalTerpilih) : undefined;

  function gantiBulan(langkah: number) {
    const berikut = geserBulan(bulan, langkah);
    setBulan(berikut);
    // Tanggal terpilih dari bulan lama tidak lagi terlihat di grid; menahannya
    // akan menampilkan rincian hari yang tidak bisa ditunjuk pemakainya.
    setTanggalTerpilih(null);
  }

  function gantiTampilan(ke: Tampilan) {
    setTampilan(ke);
    if (ke === 'kalender') {
      // Mulai dari bulan periode yang sedang dilihat, bukan selalu bulan ini.
      setBulan(bulanDari(periode.sampai));
      setTanggalTerpilih(null);
    }
  }

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

      <div
        role="tablist"
        aria-label="Tampilan laporan"
        className="permukaan grid grid-cols-2 gap-1 rounded-full p-1"
      >
        {(
          [
            { nilai: 'daftar', label: 'Daftar' },
            { nilai: 'kalender', label: 'Kalender' },
          ] as const
        ).map((t) => (
          <button
            key={t.nilai}
            type="button"
            role="tab"
            aria-selected={tampilan === t.nilai}
            onClick={() => gantiTampilan(t.nilai)}
            className={cn(
              'min-h-9 rounded-full text-sm transition-colors',
              tampilan === t.nilai
                ? 'bg-merah-600 font-semibold text-putih'
                : 'text-teks-redup hover:bg-permukaan-2',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {modeKalender ? (
        <KalenderBulan
          bulan={bulan}
          ringkasan={kalender}
          terpilih={tanggalTerpilih}
          hariIni={tanggalHariIni()}
          onPilih={(t) => setTanggalTerpilih((lama) => (lama === t ? null : t))}
          onGeser={gantiBulan}
        />
      ) : (
        <>
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
        </>
      )}

      {!periodeSah ? (
        <KotakGalat pesan="Tanggal akhir tidak boleh lebih awal dari tanggal mulai." />
      ) : null}
      <KotakGalat pesan={galat} />

      {modeKalender && tanggalTerpilih !== null ? (
        <section aria-label="Rincian satu hari" className="flex flex-col gap-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-[15px] font-semibold">{judulHari(tanggalTerpilih)}</h2>
              <p className="angka text-xs text-teks-samar">
                {isiHari
                  ? `Utang ${formatRupiah(isiHari.totalUtangBaru)} · Tunai ${formatRupiah(
                      isiHari.totalPenjualanTunai,
                    )} · Tertagih ${formatRupiah(isiHari.totalTertagih)}`
                  : 'Tidak ada transaksi pada hari ini.'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setTanggalTerpilih(null)}
              className="flex shrink-0 items-center gap-1 text-xs text-teks-samar hover:text-teks-utama"
            >
              <X size={14} /> Tutup
            </button>
          </div>

          <TigaSeksi
            utangBaru={isiHari?.utangBaru ?? []}
            penjualanTunai={isiHari?.penjualanTunai ?? []}
            pembayaran={isiHari?.pembayaran ?? []}
            lingkup="hari"
          />
        </section>
      ) : null}

      {modeKalender && tanggalTerpilih === null ? (
        <p className="text-center text-xs text-teks-samar">
          Ketuk satu tanggal untuk melihat rinciannya.
        </p>
      ) : null}

      <section aria-label="Ringkasan periode" className="flex flex-col gap-3">
        <KartuStatistik
          label={
            modeKalender
              ? `Sisa piutang akhir ${judulBulan(bulan)}`
              : 'Sisa piutang akhir periode'
          }
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

      {!modeKalender ? (
        <TigaSeksi
          utangBaru={laporan?.utangBaru ?? []}
          penjualanTunai={laporan?.penjualanTunai ?? []}
          pembayaran={laporan?.pembayaran ?? []}
          lingkup="periode"
        />
      ) : null}
    </div>
  );
}

/**
 * Tiga bagian daftar yang sama persis dipakai dua kali: untuk seluruh periode
 * di tab Daftar, dan untuk satu hari di tab Kalender. Dijadikan satu komponen
 * supaya keduanya tidak bisa berbeda bentuk tanpa sengaja.
 */
function TigaSeksi({
  utangBaru,
  penjualanTunai,
  pembayaran,
  lingkup,
}: {
  utangBaru: BarisLaporanUtang[];
  penjualanTunai: BarisLaporanTunai[];
  pembayaran: BarisLaporanBayar[];
  lingkup: 'periode' | 'hari';
}) {
  // Di rincian harian, tanggalnya sudah tertulis besar di judul.
  const tampilkanTanggal = lingkup === 'periode';
  const kapan = lingkup === 'periode' ? 'pada periode ini' : 'pada hari ini';

  return (
    <>
      <Seksi judul="Utang Baru" jumlah={utangBaru.length} kosong={`Tidak ada utang baru ${kapan}.`}>
        {utangBaru.map((t, i) => (
          <BarisNominal
            key={`${t.tanggal}-${i}`}
            nama={t.namaPelanggan}
            sub={[tampilkanTanggal ? formatTanggal(t.tanggal) : null, t.keterangan]}
            nominal={t.nominal}
          />
        ))}
      </Seksi>

      <Seksi
        judul="Penjualan Tunai"
        jumlah={penjualanTunai.length}
        kosong={`Tidak ada penjualan tunai ${kapan}.`}
      >
        {penjualanTunai.map((t, i) => (
          <BarisNominal
            key={`${t.tanggal}-${i}`}
            nama={t.namaPelanggan}
            sub={[tampilkanTanggal ? formatTanggal(t.tanggal) : null, t.keterangan]}
            nominal={t.nominal}
            warna="text-peringatan"
          />
        ))}
      </Seksi>

      <Seksi
        judul="Pembayaran Diterima"
        jumlah={pembayaran.length}
        kosong={`Belum ada pembayaran ${kapan}.`}
      >
        {pembayaran.map((b, i) => (
          <BarisNominal
            key={`${b.tanggal}-${i}`}
            nama={b.namaPelanggan}
            sub={[tampilkanTanggal ? formatTanggal(b.tanggal) : null, b.metode]}
            nominal={b.nominal}
            warna="text-sukses"
            kapitalSub
          />
        ))}
      </Seksi>
    </>
  );
}

function Seksi({
  judul,
  jumlah,
  kosong,
  children,
}: {
  judul: string;
  jumlah: number;
  kosong: string;
  children: ReactNode;
}) {
  const id = `judul-${judul.toLowerCase().replace(/\s+/g, '-')}`;
  return (
    <section aria-labelledby={id} className="flex flex-col gap-2">
      <h2 id={id} className="text-sm font-semibold text-teks-redup">
        {judul} <span className="angka font-normal text-teks-samar">({jumlah})</span>
      </h2>
      {jumlah > 0 ? (
        <ul className="flex flex-col gap-2">{children}</ul>
      ) : (
        <Kartu>
          <p className="text-sm text-teks-samar">{kosong}</p>
        </Kartu>
      )}
    </section>
  );
}

function BarisNominal({
  nama,
  sub,
  nominal,
  warna,
  kapitalSub,
}: {
  nama: string;
  sub: (string | null)[];
  nominal: number;
  warna?: string;
  kapitalSub?: boolean;
}) {
  const keterangan = sub.filter(Boolean).join(' · ');
  return (
    <li>
      <Kartu padat className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{nama}</p>
          {keterangan ? (
            <p
              className={cn(
                'truncate text-xs text-teks-samar',
                kapitalSub && 'capitalize',
              )}
            >
              {keterangan}
            </p>
          ) : null}
        </div>
        <p className={cn('angka shrink-0 text-sm font-semibold', warna)}>
          {formatRupiah(nominal)}
        </p>
      </Kartu>
    </li>
  );
}
