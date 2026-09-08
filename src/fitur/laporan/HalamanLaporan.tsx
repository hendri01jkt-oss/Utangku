import { useState, type ReactNode } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { FileSpreadsheet, FileText, X } from 'lucide-react';
import { Input, Kartu, Tombol } from '@/komponen/ui';
import { KotakGalat } from '@/fitur/auth/LayoutAuth';
import { useSesi } from '@/fitur/auth/useSesi';
import { tanggalHariIni } from '@/data/repo/transaksi';
import { formatRupiah } from '@/lib/uang';
import { cn } from '@/lib/cn';
import {
  susunLaporan,
  type BarisLaporanBayar,
  type Laporan,
  type BarisLaporanTunai,
  type BarisLaporanUtang,
  type Periode,
} from './dataLaporan';
import {
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

/**
 * Cakupan yang sedang dilihat. Hanya ada dua, dan kalender yang mengendalikan
 * keduanya: bar bulan memilih bulannya, mengetuk tanggal mempersempit ke satu
 * hari. Tidak ada pengendali periode kedua di layar ini — kalau ada, angka
 * ringkasan dan kalender bisa bicara soal rentang yang berbeda.
 */
type Cakupan = 'bulan' | 'hari';

const formatTanggal = (iso: string) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

/**
 * Halaman Laporan, berpusat pada kalender.
 *
 * Saat pertama dibuka cakupannya SEBULAN PENUH — bulan berjalan, dari tanggal
 * 1 sampai hari terakhirnya, dengan daftar transaksi bulan itu di bawah
 * kalender. Daftar itulah yang menggantikan peran tab "Daftar" yang dihapus,
 * jadi tidak ada lagi dua tampilan yang menyajikan data sama dengan bentuk
 * berbeda. Mengetuk satu tanggal mempersempit cakupan ke hari itu; menutupnya
 * mengembalikan ke sebulan penuh.
 */
export function HalamanLaporan() {
  const warung = useSesi((s) => s.warung);
  const [bulan, setBulan] = useState<Bulan>(bulanIni());
  const [tanggalTerpilih, setTanggalTerpilih] = useState<string | null>(null);
  const [sedangEkspor, setSedangEkspor] = useState<'pdf' | 'excel' | null>(null);
  const [galat, setGalat] = useState<string | null>(null);

  /*
   * Cakupan halaman selalu satu bulan penuh — BUKAN "tanggal 1 sampai hari
   * ini". Kalender menampilkan seluruh kotak bulan itu, jadi ringkasan yang
   * berhenti di hari ini akan bertentangan dengan apa yang terlihat: ada
   * tanggal bertitik di kalender yang nominalnya tidak ikut terhitung.
   */
  const periode: Periode = periodeBulan(bulan);

  const laporan = useLiveQuery(
    async () => (warung ? await susunLaporan(warung.id, periode) : undefined),
    [warung?.id, periode.mulai, periode.sampai],
  );

  /*
   * Kalender punya query sendiri yang hanya membaca satu bulan lewat indeks
   * [warung_id+tanggal]. Kuncinya cuma warung dan bulan: mengetuk tanggal
   * tidak menyentuh IndexedDB sama sekali, karena isi harinya diambil dari
   * Map hasil query ini yang sudah ada di memori.
   */
  const kalender = useLiveQuery(
    async () => (warung ? await susunKalender(warung.id, bulan) : undefined),
    [warung?.id, bulan],
  );

  const isiHari = tanggalTerpilih ? kalender?.hari.get(tanggalTerpilih) : undefined;

  function gantiBulan(langkah: number) {
    const berikut = geserBulan(bulan, langkah);
    setBulan(berikut);
    // Tanggal terpilih dari bulan lama tidak lagi terlihat di grid; menahannya
    // akan menampilkan rincian hari yang tidak bisa ditunjuk pemakainya.
    setTanggalTerpilih(null);
  }

  async function ekspor(jenis: 'pdf' | 'excel', rentang: Periode) {
    if (!warung) return;
    setGalat(null);
    setSedangEkspor(jenis);
    try {
      /*
       * Laporannya disusun di sini, bukan lewat useLiveQuery kedua: rentang
       * khusus hanya dipakai pada saat tombolnya ditekan, dan query hidup
       * untuknya akan membaca ulang IndexedDB setiap ketikan di kotak
       * tanggal — pekerjaan yang hasilnya hampir selalu dibuang.
       */
      const data =
        rentang.mulai === periode.mulai && rentang.sampai === periode.sampai && laporan
          ? laporan
          : await susunLaporan(warung.id, rentang);
      if (jenis === 'pdf') await unduhPdf(data, warung.nama_warung);
      else await unduhExcel(data, warung.nama_warung);
    } catch (err) {
      setGalat(err instanceof Error ? err.message : 'Gagal membuat berkas ekspor.');
    } finally {
      setSedangEkspor(null);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-lg font-semibold">Laporan</h1>

      <NavigasiBulan bulan={bulan} onGeser={gantiBulan} />

      <RingkasanBulanan bulan={bulan} laporan={laporan} />

      <KotakGalat pesan={galat} />

      <PanelEkspor
        bulan={bulan}
        periodeBulanAktif={periode}
        siap={laporan !== undefined}
        sedang={sedangEkspor}
        onEkspor={(jenis, rentang) => void ekspor(jenis, rentang)}
      />

      <KalenderBulan
        bulan={bulan}
        ringkasan={kalender}
        terpilih={tanggalTerpilih}
        hariIni={tanggalHariIni()}
        onPilih={(t) => setTanggalTerpilih((lama) => (lama === t ? null : t))}
      />

      {/* Tidak ada tanggal terpilih = cakupan sebulan penuh, keadaan bawaan. */}
      {tanggalTerpilih === null ? (
        <DaftarBulan bulan={bulan} laporan={laporan} />
      ) : (
        <PanelHari
          tanggal={tanggalTerpilih}
          isi={isiHari}
          onTutup={() => setTanggalTerpilih(null)}
        />
      )}
    </div>
  );
}

/**
 * Ringkasan bulan — satu kartu padat, bukan empat kartu besar.
 *
 * Angka bulanan di sini berperan sebagai kepala dari cakupan yang dipilih di
 * bar bulan, bukan isi utama halaman; empat kartu penuh di posisi ini
 * mendorong kalendernya sendiri turun sampai hampir keluar layar pada HP
 * 390 px.
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
 * Ekspor, dengan pemilih rentangnya sendiri.
 *
 * Rentang khusus ditaruh DI SINI, bukan sebagai chip periode di atas halaman,
 * supaya ia tidak pernah menjadi pengendali periode kedua: yang tampil di
 * layar tetap sepenuhnya ditentukan kalender, dan rentang bebas hanya
 * memengaruhi berkas yang diunduh. Laporan setahun atau per kuartal tetap
 * bisa diambil tanpa membuat pemilik warung menebak-nebak angka mana yang
 * sedang dilihatnya.
 *
 * Bentuknya sengaja setipis mungkin — satu baris keterangan di atas dua
 * tombol. Kalender adalah isi utama halaman ini, dan setiap piksel yang
 * dipakai di atasnya mendorong kalender itu keluar dari layar pertama.
 */
function PanelEkspor({
  bulan,
  periodeBulanAktif,
  siap,
  sedang,
  onEkspor,
}: {
  bulan: Bulan;
  periodeBulanAktif: Periode;
  siap: boolean;
  sedang: 'pdf' | 'excel' | null;
  onEkspor: (jenis: 'pdf' | 'excel', rentang: Periode) => void;
}) {
  const [pakaiRentang, setPakaiRentang] = useState(false);
  const [rentang, setRentang] = useState<Periode>(periodeBulanAktif);

  /*
   * Dibuka = kotak tanggalnya disemai dari bulan yang SEDANG dilihat. Kalau
   * hanya diisi sekali saat komponen dipasang, pemilik warung yang menggeser
   * ke Agustus lalu menekan "pilih rentang lain" akan menemukan September di
   * sana tanpa sebab yang terlihat.
   */
  function togelRentang() {
    if (!pakaiRentang) setRentang(periodeBulanAktif);
    setPakaiRentang(!pakaiRentang);
  }

  const dipakai = pakaiRentang ? rentang : periodeBulanAktif;
  const sah = dipakai.mulai <= dipakai.sampai;
  const bisa = siap && sah && sedang === null;

  return (
    <section aria-label="Ekspor laporan" className="flex flex-col gap-2">
      {/*
        Cakupan yang akan diekspor selalu dieja di sini. Tanpa ini, satu-satunya
        petunjuk adalah kotak tanggal yang mungkin sedang tertutup — dan berkas
        yang isinya bukan yang dikira baru ketahuan setelah dibuka.
      */}
      <p className="text-xs text-teks-samar">
        Ekspor{' '}
        <span className="font-medium text-teks-redup">
          {pakaiRentang
            ? `${formatTanggal(dipakai.mulai)} – ${formatTanggal(dipakai.sampai)}`
            : judulBulan(bulan)}
        </span>{' '}
        ·{' '}
        <button
          type="button"
          onClick={togelRentang}
          className="underline underline-offset-2 hover:text-teks-utama"
        >
          {pakaiRentang ? `pakai ${judulBulan(bulan)}` : 'pilih rentang lain'}
        </button>
      </p>

      {pakaiRentang ? (
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Dari tanggal"
            type="date"
            value={rentang.mulai}
            onChange={(e) => setRentang((r) => ({ ...r, mulai: e.target.value }))}
          />
          <Input
            label="Sampai tanggal"
            type="date"
            value={rentang.sampai}
            onChange={(e) => setRentang((r) => ({ ...r, sampai: e.target.value }))}
          />
        </div>
      ) : null}

      {!sah ? (
        <KotakGalat pesan="Tanggal akhir tidak boleh lebih awal dari tanggal mulai." />
      ) : null}

      <div className="grid grid-cols-2 gap-3">
        <Tombol
          varian="sekunder"
          ikon={<FileText size={16} />}
          onClick={() => onEkspor('pdf', dipakai)}
          disabled={!bisa}
        >
          {sedang === 'pdf' ? 'Menyiapkan…' : 'Export PDF'}
        </Tombol>
        <Tombol
          varian="sekunder"
          ikon={<FileSpreadsheet size={16} />}
          onClick={() => onEkspor('excel', dipakai)}
          disabled={!bisa}
        >
          {sedang === 'excel' ? 'Menyiapkan…' : 'Export Excel'}
        </Tombol>
      </div>
    </section>
  );
}

/**
 * Daftar transaksi sebulan penuh — cakupan bawaan saat halaman dibuka.
 *
 * Kepalanya memakai perlakuan yang sama dengan rincian harian (label cakupan,
 * garis merah di kiri, nama cakupan dieja lengkap) supaya keduanya terbaca
 * sebagai dua isi dari satu tempat, bukan dua bagian halaman yang kebetulan
 * bertumpuk.
 */
function DaftarBulan({ bulan, laporan }: { bulan: Bulan; laporan: Laporan | undefined }) {
  return (
    <section aria-label="Transaksi sebulan" className="flex flex-col gap-3">
      <div className="border-l-4 border-merah-600 pl-3">
        <p className="text-[10.5px] font-semibold tracking-wider text-teks-samar uppercase">
          Rincian sebulan
        </p>
        <h2 className="text-[15px] font-semibold">{judulBulan(bulan)}</h2>
        <p className="text-xs text-teks-samar">
          Ketuk satu tanggal di kalender untuk mempersempit ke satu hari.
        </p>
      </div>

      <TigaSeksi
        utangBaru={laporan?.utangBaru ?? []}
        penjualanTunai={laporan?.penjualanTunai ?? []}
        pembayaran={laporan?.pembayaran ?? []}
        cakupan="bulan"
      />
    </section>
  );
}

/**
 * Rincian satu hari, sengaja dibungkus kartu sendiri.
 *
 * Cakupannya dinyatakan tiga kali: label di atas judul, tanggalnya dieja
 * lengkap, dan barisnya memakai permukaan datar abu di dalam kartu putih —
 * kebalikan dari daftar sebulan yang berupa kartu putih di atas halaman abu.
 * Tanpa itu, dua cakupan data yang berbeda terbaca seperti satu kesatuan.
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
          <p className="text-[10.5px] font-semibold tracking-wider text-teks-samar uppercase">
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
        {/* Menutup rincian hari = kembali ke cakupan sebulan penuh. */}
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
        cakupan="hari"
      />
    </Kartu>
  );
}

/**
 * Tiga bagian daftar yang sama persis dipakai dua kali: untuk sebulan penuh
 * dan untuk satu hari. Dijadikan satu komponen supaya keduanya tidak bisa
 * berbeda bentuk tanpa sengaja.
 */
function TigaSeksi({
  utangBaru,
  penjualanTunai,
  pembayaran,
  cakupan,
}: {
  utangBaru: BarisLaporanUtang[];
  penjualanTunai: BarisLaporanTunai[];
  pembayaran: BarisLaporanBayar[];
  cakupan: Cakupan;
}) {
  // Di rincian harian, tanggalnya sudah tertulis besar di judul.
  const tampilkanTanggal = cakupan === 'bulan';
  const kapan = cakupan === 'bulan' ? 'pada bulan ini' : 'pada hari ini';
  /*
   * Daftar sebulan berdiri langsung di halaman: barisnya kartu putih di atas
   * latar abu. Rincian harian ada DI DALAM kartu putih, jadi polanya
   * dibalik — baris abu di atas putih. Kartu putih di atas kartu putih akan
   * saling lenyap.
   */
  const varian: Varian = cakupan === 'bulan' ? 'kartu' : 'datar';

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
  /*
   * Selalu h3: kedua cakupan kini punya judul cakupannya sendiri sebagai h2
   * (nama bulan atau nama hari), jadi bagian di bawahnya satu tingkat lebih
   * dalam. Tanpa ini tingkatan judulnya melompat dan urutan baca pembaca
   * layar jadi rata, seolah semua bagian sederajat dengan judul cakupan.
   */
  return (
    <section aria-labelledby={id} className="flex flex-col gap-2">
      <h3 id={id} className={cn('font-semibold text-teks-redup', datar ? 'text-xs' : 'text-sm')}>
        {judul} <span className="angka font-normal text-teks-samar">({jumlah})</span>
      </h3>
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
