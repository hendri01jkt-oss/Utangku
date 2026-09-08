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
  type Laporan,
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
  type IsiHari,
} from './dataKalender';
import { KalenderBulan, NavigasiBulan } from './KalenderBulan';
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
        <NavigasiBulan bulan={bulan} onGeser={gantiBulan} />
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

      {modeKalender ? (
        <RingkasanBulanan bulan={bulan} laporan={laporan} />
      ) : (
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
      )}

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

      {modeKalender ? (
        <>
          <KalenderBulan
            bulan={bulan}
            ringkasan={kalender}
            terpilih={tanggalTerpilih}
            hariIni={tanggalHariIni()}
            onPilih={(t) => setTanggalTerpilih((lama) => (lama === t ? null : t))}
          />

          {tanggalTerpilih === null ? (
            <p className="text-center text-xs text-teks-samar">
              Ketuk satu tanggal untuk melihat rinciannya.
            </p>
          ) : (
            <PanelHari
              tanggal={tanggalTerpilih}
              isi={isiHari}
              onTutup={() => setTanggalTerpilih(null)}
            />
          )}
        </>
      ) : (
        <TigaSeksi
          utangBaru={laporan?.utangBaru ?? []}
          penjualanTunai={laporan?.penjualanTunai ?? []}
          pembayaran={laporan?.pembayaran ?? []}
          lingkup="periode"
        />
      )}
    </div>
  );
}

/**
 * Ringkasan bulan di tab Kalender — satu kartu padat, bukan empat kartu besar.
 *
 * Bentuknya sengaja berbeda dari tab Daftar. Di sini angka bulanan berperan
 * sebagai kepala dari cakupan yang baru saja dipilih di bar bulan, bukan isi
 * utama halaman; empat kartu penuh di posisi ini mendorong kalendernya
 * sendiri turun sampai hampir keluar layar pada HP 390 px.
 */
function RingkasanBulanan({
  bulan,
  laporan,
}: {
  bulan: Bulan;
  laporan: Laporan | undefined;
}) {
  const rupiah = (n: number | undefined) => (laporan ? formatRupiah(n ?? 0) : '—');
  return (
    <Kartu aria-label="Ringkasan bulan" className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-xs text-teks-samar">Sisa piutang akhir {judulBulan(bulan)}</p>
        <p className="angka shrink-0 text-xl font-semibold text-merah-600">
          {rupiah(laporan?.sisaPiutang)}
        </p>
      </div>
      <div className="border-t border-garis" />
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: 'Utang baru', nilai: laporan?.totalUtangBaru, warna: '' },
          { label: 'Tertagih', nilai: laporan?.totalTertagih, warna: 'text-sukses' },
          { label: 'Penjualan tunai', nilai: laporan?.totalPenjualanTunai, warna: 'text-tunai' },
        ].map((k) => (
          <div key={k.label}>
            <p className="text-[11px] leading-tight text-teks-samar">{k.label}</p>
            <p className={cn('angka text-sm font-semibold', k.warna)}>{rupiah(k.nilai)}</p>
          </div>
        ))}
      </div>
    </Kartu>
  );
}

/**
 * Rincian satu hari, sengaja dibungkus kartu sendiri.
 *
 * Sebelumnya isinya mengalir langsung ke kartu ringkasan bulanan di
 * bawahnya, sehingga dua cakupan data yang berbeda — satu hari dan satu
 * bulan — terbaca seperti satu kesatuan. Sekarang cakupannya dinyatakan
 * tiga kali: label di atas judul, tanggalnya dieja lengkap, dan barisnya
 * memakai permukaan datar abu di dalam kartu putih — kebalikan dari daftar
 * periode yang berupa kartu putih di atas halaman abu.
 */
function PanelHari({
  tanggal,
  isi,
  onTutup,
}: {
  tanggal: string;
  isi: IsiHari | undefined;
  onTutup: () => void;
}) {
  return (
    <Kartu aria-label="Rincian satu hari" className="flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 border-l-4 border-merah-600 pl-3">
          <p className="text-[10.5px] font-semibold uppercase tracking-wider text-teks-samar">
            Rincian harian
          </p>
          <h2 className="text-[15px] font-semibold">{judulHari(tanggal)}</h2>
          <p className="angka text-xs text-teks-samar">
            {isi
              ? `Utang ${formatRupiah(isi.totalUtangBaru)} · Tunai ${formatRupiah(
                  isi.totalPenjualanTunai,
                )} · Tertagih ${formatRupiah(isi.totalTertagih)}`
              : 'Tidak ada transaksi pada hari ini.'}
          </p>
        </div>
        <button
          type="button"
          onClick={onTutup}
          className="flex shrink-0 items-center gap-1 text-xs text-teks-samar hover:text-teks-utama"
        >
          <X size={14} /> Tutup
        </button>
      </div>

      <div className="border-t border-garis" />

      <TigaSeksi
        utangBaru={isi?.utangBaru ?? []}
        penjualanTunai={isi?.penjualanTunai ?? []}
        pembayaran={isi?.pembayaran ?? []}
        lingkup="hari"
      />
    </Kartu>
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
  /*
   * Daftar periode berdiri langsung di halaman: barisnya kartu putih di atas
   * latar abu. Rincian harian ada DI DALAM kartu putih, jadi polanya
   * dibalik — baris abu di atas putih. Kartu putih di atas kartu putih akan
   * saling lenyap.
   */
  const varian = lingkup === 'periode' ? 'kartu' : 'datar';

  return (
    <>
      <Seksi
        judul="Utang Baru"
        varian={varian}
        jumlah={utangBaru.length}
        kosong={`Tidak ada utang baru ${kapan}.`}
      >
        {utangBaru.map((t, i) => (
          <BarisNominal
            key={`${t.tanggal}-${i}`}
            nama={t.namaPelanggan}
            sub={[tampilkanTanggal ? formatTanggal(t.tanggal) : null, t.keterangan]}
            nominal={t.nominal}
            varian={varian}
          />
        ))}
      </Seksi>

      <Seksi
        judul="Penjualan Tunai"
        varian={varian}
        jumlah={penjualanTunai.length}
        kosong={`Tidak ada penjualan tunai ${kapan}.`}
      >
        {penjualanTunai.map((t, i) => (
          <BarisNominal
            key={`${t.tanggal}-${i}`}
            nama={t.namaPelanggan}
            sub={[tampilkanTanggal ? formatTanggal(t.tanggal) : null, t.keterangan]}
            nominal={t.nominal}
            warna="text-tunai"
            varian={varian}
          />
        ))}
      </Seksi>

      <Seksi
        judul="Pembayaran Diterima"
        varian={varian}
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
            varian={varian}
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
  varian,
  children,
}: {
  judul: string;
  jumlah: number;
  kosong: string;
  varian: Varian;
  children: ReactNode;
}) {
  const id = `judul-${judul.toLowerCase().replace(/\s+/g, '-')}`;
  const datar = varian === 'datar';
  // Di dalam panel harian, judul hari sudah memakai h2 — bagian di bawahnya
  // jadi h3 supaya tingkatan judulnya tidak melompat.
  const Judul = datar ? 'h3' : 'h2';
  return (
    <section aria-labelledby={id} className="flex flex-col gap-2">
      <Judul id={id} className={cn('font-semibold text-teks-redup', datar ? 'text-xs' : 'text-sm')}>
        {judul} <span className="angka font-normal text-teks-samar">({jumlah})</span>
      </Judul>
      {jumlah > 0 ? (
        <ul className="flex flex-col gap-2">{children}</ul>
      ) : datar ? (
        <p className="permukaan-datar rounded-[var(--radius-kontrol)] p-3 text-xs text-teks-samar">
          {kosong}
        </p>
      ) : (
        <Kartu>
          <p className="text-sm text-teks-samar">{kosong}</p>
        </Kartu>
      )}
    </section>
  );
}

type Varian = 'kartu' | 'datar';

function BarisNominal({
  nama,
  sub,
  nominal,
  warna,
  kapitalSub,
  varian,
}: {
  nama: string;
  sub: (string | null)[];
  nominal: number;
  warna?: string;
  kapitalSub?: boolean;
  varian: Varian;
}) {
  const keterangan = sub.filter(Boolean).join(' · ');
  const Pembungkus = varian === 'datar' ? BarisDatar : BarisKartu;
  return (
    <li>
      <Pembungkus>
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
      </Pembungkus>
    </li>
  );
}

const BarisKartu = ({ children }: { children: ReactNode }) => (
  <Kartu padat className="flex items-center justify-between gap-3">
    {children}
  </Kartu>
);

const BarisDatar = ({ children }: { children: ReactNode }) => (
  <div className="permukaan-datar flex items-center justify-between gap-3 rounded-[var(--radius-kontrol)] p-3">
    {children}
  </div>
);
