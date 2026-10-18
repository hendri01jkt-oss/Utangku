import { useState, type ReactNode } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { ArrowDownLeft, ArrowUpRight, CalendarRange, FileSpreadsheet, FileText, Wallet, X } from 'lucide-react';
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
  /*
   * Rentang tanggal pilihan sendiri. Kalau diisi, ia MENGGANTIKAN bulan untuk
   * seluruh layar — ringkasan, daftar, dan berkas simpanan memakai rentang
   * yang sama — dan kalender disembunyikan supaya tidak ada dua cakupan yang
   * tampil bersamaan. Kosong = tampilan kalender sebulan seperti biasa.
   */
  const [rentang, setRentang] = useState<Periode | null>(null);
  const periode: Periode = rentang ?? periodeBulan(bulan);
  const rentangSah =
    periode.mulai !== '' && periode.sampai !== '' && periode.mulai <= periode.sampai;
  const label = rentang
    ? rentangSah
      ? `${formatTanggal(periode.mulai)} – ${formatTanggal(periode.sampai)}`
      : 'Rentang tanggal'
    : judulBulan(bulan);

  const laporan = useLiveQuery(
    async () => (warung && rentangSah ? await susunLaporan(warung.id, periode) : undefined),
    [warung?.id, periode.mulai, periode.sampai, rentangSah],
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

  async function ekspor(jenis: 'pdf' | 'excel') {
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
      const data = laporan ?? (await susunLaporan(warung.id, periode));
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

      {rentang ? (
        <PilihRentang
          rentang={rentang}
          sah={rentangSah}
          onUbah={setRentang}
          onTutup={() => setRentang(null)}
        />
      ) : (
        <>
          <NavigasiBulan bulan={bulan} onGeser={gantiBulan} />
          <button
            type="button"
            onClick={() => {
              setTanggalTerpilih(null);
              setRentang(periodeBulan(bulan));
            }}
            className="flex min-h-11 items-center justify-center gap-2 rounded-[var(--radius-kontrol)] border border-emas-600/50 bg-putih px-4 text-sm font-medium text-navy-900"
          >
            <CalendarRange size={18} aria-hidden />
            Pilih tanggal sendiri
          </button>
        </>
      )}

      <RingkasanBulanan label={label} laporan={laporan} />

      {rentang ? null : (
        <KalenderBulan
          bulan={bulan}
          ringkasan={kalender}
          terpilih={tanggalTerpilih}
          hariIni={tanggalHariIni()}
          onPilih={(t) => setTanggalTerpilih((lama) => (lama === t ? null : t))}
        />
      )}

      {/* Tidak ada tanggal terpilih = cakupan penuh (sebulan atau rentang pilihan). */}
      {tanggalTerpilih === null || rentang ? (
        <DaftarBulan label={label} laporan={laporan} bisaKetuk={!rentang} />
      ) : (
        <PanelHari
          tanggal={tanggalTerpilih}
          isi={isiHari}
          onTutup={() => setTanggalTerpilih(null)}
        />
      )}

      <KotakGalat pesan={galat} />

      <PanelEkspor
        label={label}
        siap={laporan !== undefined && rentangSah}
        sedang={sedangEkspor}
        onEkspor={(jenis) => void ekspor(jenis)}
      />
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
  label,
  laporan,
}: {
  label: string;
  laporan: Laporan | undefined;
}) {
  const rupiah = (n: number | undefined) => (laporan ? formatRupiah(n ?? 0) : '—');
  return (
    <section aria-label="Ringkasan bulan" className="flex flex-col gap-2">
      {/* Satu angka besar yang paling penting; dua lainnya berwarna dan berikon. */}
      <Kartu className="flex items-center gap-3">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-emas-500 text-navy-900">
          <Wallet size={22} aria-hidden />
        </span>
        <div className="min-w-0">
          <p className="text-sm text-teks-redup">Uang yang belum dibayar</p>
          <p className="angka text-2xl font-bold text-navy-900">{rupiah(laporan?.sisaPiutang)}</p>
        </div>
      </Kartu>
      <div className="grid grid-cols-2 gap-2">
        <Kartu padat className="flex flex-col gap-1">
          <span className="flex items-center gap-1.5 text-sm text-teks-redup">
            <ArrowUpRight size={18} className="text-bahaya" aria-hidden /> Utang baru
          </span>
          <span className="angka text-lg font-bold text-bahaya">{rupiah(laporan?.totalUtangBaru)}</span>
        </Kartu>
        <Kartu padat className="flex flex-col gap-1">
          <span className="flex items-center gap-1.5 text-sm text-teks-redup">
            <ArrowDownLeft size={18} className="text-sukses" aria-hidden /> Sudah dibayar
          </span>
          <span className="angka text-lg font-bold text-sukses">{rupiah(laporan?.totalTertagih)}</span>
        </Kartu>
      </div>
      <p className="text-center text-xs text-teks-samar">{label}</p>
    </section>
  );
}

/**
 * Pemilih tanggal sendiri. Yang dipilih di sini menentukan SELURUH layar dan
 * berkas yang disimpan — tidak ada rentang kedua yang tersembunyi.
 */
function PilihRentang({
  rentang,
  sah,
  onUbah,
  onTutup,
}: {
  rentang: Periode;
  sah: boolean;
  onUbah: (r: Periode) => void;
  onTutup: () => void;
}) {
  return (
    <Kartu className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold">Pilih tanggal</p>
        <button
          type="button"
          onClick={onTutup}
          className="flex min-h-9 items-center gap-1 text-sm text-teks-redup underline underline-offset-2"
        >
          <X size={14} aria-hidden /> Kembali ke kalender
        </button>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Input
          label="Dari tanggal"
          type="date"
          value={rentang.mulai}
          onChange={(e) => onUbah({ ...rentang, mulai: e.target.value })}
        />
        <Input
          label="Sampai tanggal"
          type="date"
          value={rentang.sampai}
          onChange={(e) => onUbah({ ...rentang, sampai: e.target.value })}
        />
      </div>
      {!sah ? (
        <KotakGalat pesan="Isi kedua tanggal. Tanggal akhir tidak boleh lebih awal dari tanggal mulai." />
      ) : null}
    </Kartu>
  );
}

/** Simpan laporan: berkasnya persis yang sedang tampil di layar. */
function PanelEkspor({
  label,
  siap,
  sedang,
  onEkspor,
}: {
  label: string;
  siap: boolean;
  sedang: 'pdf' | 'excel' | null;
  onEkspor: (jenis: 'pdf' | 'excel') => void;
}) {
  const bisa = siap && sedang === null;
  return (
    <section aria-label="Simpan laporan" className="flex flex-col gap-2">
      <p className="text-xs text-teks-samar">
        Simpan laporan <span className="font-medium text-teks-redup">{label}</span>
      </p>
      <div className="grid grid-cols-2 gap-3">
        <Tombol
          varian="sekunder"
          ikon={<FileText size={16} />}
          onClick={() => onEkspor('pdf')}
          disabled={!bisa}
        >
          {sedang === 'pdf' ? 'Menyiapkan…' : 'Simpan PDF'}
        </Tombol>
        <Tombol
          varian="sekunder"
          ikon={<FileSpreadsheet size={16} />}
          onClick={() => onEkspor('excel')}
          disabled={!bisa}
        >
          {sedang === 'excel' ? 'Menyiapkan…' : 'Simpan Excel'}
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
function DaftarBulan({
  label,
  laporan,
  bisaKetuk,
}: {
  label: string;
  laporan: Laporan | undefined;
  bisaKetuk: boolean;
}) {
  return (
    <section aria-label="Transaksi sebulan" className="flex flex-col gap-3">
      <div className="border-l-4 border-emas-600 pl-3">
        <p className="text-[10.5px] font-semibold tracking-wider text-teks-samar uppercase">
          {bisaKetuk ? 'Satu bulan' : 'Rentang tanggal'}
        </p>
        <h2 className="text-[15px] font-semibold">{label}</h2>
        {bisaKetuk ? (
          <p className="text-xs text-teks-samar">
            Ketuk satu tanggal di kalender untuk melihat hari itu saja.
          </p>
        ) : null}
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
        <div className="min-w-0 border-l-4 border-emas-600 pl-3">
          <p className="text-[10.5px] font-semibold tracking-wider text-teks-samar uppercase">
            Satu hari
          </p>
          <h2 className="text-[15px] font-semibold">{judulHari(tanggal)}</h2>
          <p className="angka text-xs text-teks-samar">
            {isi
              ? `Utang ${formatRupiah(isi.totalUtangBaru)} · Dibayar ${formatRupiah(isi.totalTertagih)}`
              : 'Tidak ada catatan pada hari ini.'}
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
        judul="Yang berutang"
        varian={varian}
        jumlah={utangBaru.length}
        kosong={`Belum ada yang berutang ${kapan}.`}
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

      {/* Fitur catat tunai sudah dihapus; bagian ini hanya muncul untuk catatan lama. */}
      {penjualanTunai.length > 0 ? (
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
      ) : null}

      <Seksi
        judul="Yang membayar"
        varian={varian}
        jumlah={pembayaran.length}
        kosong={`Belum ada yang membayar ${kapan}.`}
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
