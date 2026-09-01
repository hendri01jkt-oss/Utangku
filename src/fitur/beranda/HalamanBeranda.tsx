import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { Banknote, Plus, TrendingUp, UserPlus, Users, Wallet } from 'lucide-react';
import { Kartu, KartuStatistik, TombolTautan } from '@/komponen/ui';
import { useSesi } from '@/fitur/auth/useSesi';
import { formatRupiah } from '@/lib/uang';
import { KartuBarisTagihan } from '@/fitur/tagihan/KartuBarisTagihan';
import { perluDitagih } from '@/fitur/tagihan/daftarTagihan';
import { ringkasanWarung } from './ringkasanWarung';

/** Beranda hanya menampilkan yang paling mendesak; sisanya di tab Tagihan. */
const BATAS_TAMPIL = 5;

export function HalamanBeranda() {
  const warung = useSesi((s) => s.warung);

  const ringkasan = useLiveQuery(
    async () => (warung ? await ringkasanWarung(warung.id) : undefined),
    [warung?.id],
  );
  const ditagih = useLiveQuery(
    async () => (warung ? await perluDitagih(warung.id) : []),
    [warung?.id],
    [],
  );

  const teratas = ditagih.slice(0, BATAS_TAMPIL);
  const sisaBaris = ditagih.length - teratas.length;

  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-lg font-semibold">Beranda</h1>

      <section aria-label="Ringkasan warung" className="flex flex-col gap-3">
        <KartuStatistik
          label="Total Piutang"
          nilai={ringkasan ? formatRupiah(ringkasan.totalPiutang) : '—'}
          ikon={<Wallet size={16} />}
          penting
        />

        <div className="grid grid-cols-2 gap-3">
          <KartuStatistik
            label="Pelanggan Berutang"
            nilai={
              <span className="angka">{ringkasan ? ringkasan.jumlahPelangganBerutang : '—'}</span>
            }
            ikon={<Users size={16} />}
          />
          <KartuStatistik
            label="Tertagih Bulan Ini"
            nilai={ringkasan ? formatRupiah(ringkasan.tertagihBulanIni) : '—'}
            ikon={<TrendingUp size={16} />}
          />
        </div>

        <div className="flex flex-col gap-2">
          <TombolTautan
            to="/utang/baru"
            varian="utama"
            ukuran="besar"
            penuh
            ikon={<Plus size={18} />}
          >
            Catat Utang
          </TombolTautan>
          {/*
            Penjualan tunai diletakkan sebagai tombol kedua, bukan disamakan
            besarnya dengan Catat Utang: mencatat utang adalah alasan
            aplikasi ini dipasang, dan tombolnya harus tetap yang paling
            gampang dikenai jempol.
          */}
          <TombolTautan to="/tunai/baru" varian="sekunder" penuh ikon={<Banknote size={16} />}>
            Catat Penjualan Tunai
          </TombolTautan>
        </div>
      </section>

      {/* Warung yang baru dibuat: satu ajakan yang jelas, bukan deretan angka nol. */}
      {ringkasan && !ringkasan.adaPelanggan ? (
        <Kartu className="flex flex-col items-center gap-3 py-8 text-center">
          <UserPlus size={32} className="text-teks-samar" aria-hidden />
          <p className="text-sm text-teks-redup">
            Belum ada pelanggan. Tambahkan yang pertama untuk mulai mencatat utang.
          </p>
          <TombolTautan to="/pelanggan/baru" varian="sekunder" ikon={<Plus size={16} />}>
            Tambah Pelanggan
          </TombolTautan>
        </Kartu>
      ) : null}

      <section aria-labelledby="judul-ditagih" className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between gap-3">
          <h2 id="judul-ditagih" className="text-sm font-semibold text-teks-redup">
            Perlu Ditagih
          </h2>
          {ditagih.length > 0 ? (
            <span className="angka text-xs text-teks-samar">{ditagih.length} utang</span>
          ) : null}
        </div>

        {teratas.length === 0 ? (
          <Kartu>
            <p className="text-sm text-teks-samar">
              {ringkasan?.adaPelanggan
                ? 'Tidak ada utang yang mendekati atau melewati jatuh tempo.'
                : 'Belum ada yang perlu ditagih.'}
            </p>
          </Kartu>
        ) : (
          <ul className="flex flex-col gap-2">
            {teratas.map((baris) => (
              <li key={baris.transaksi.id}>
                <KartuBarisTagihan
                  baris={baris}
                  namaWarung={warung?.nama_warung ?? 'Warung'}
                  template={warung?.template_pesan_tagihan ?? null}
                />
              </li>
            ))}
          </ul>
        )}

        {sisaBaris > 0 ? (
          <Link
            to="/tagihan"
            className="flex items-center justify-center gap-1 py-2 text-sm text-merah-600 underline underline-offset-4"
          >
            Lihat {sisaBaris} lainnya
          </Link>
        ) : null}
      </section>
    </div>
  );
}
