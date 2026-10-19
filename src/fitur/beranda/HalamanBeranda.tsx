import { useLiveQuery } from 'dexie-react-hooks';
import { Plus, TrendingUp, UserPlus, Users, Wallet } from 'lucide-react';
import { Kartu, KartuStatistik, TombolTautan } from '@/komponen/ui';
import { useSesi } from '@/fitur/auth/useSesi';
import { formatRupiah } from '@/lib/uang';
import { ringkasanWarung } from './ringkasanWarung';

export function HalamanBeranda() {
  const warung = useSesi((s) => s.warung);

  const ringkasan = useLiveQuery(
    async () => (warung ? await ringkasanWarung(warung.id) : undefined),
    [warung?.id],
  );
  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-lg font-semibold">Beranda</h1>

      <section aria-label="Ringkasan warung" className="flex flex-col gap-3">
        <KartuStatistik
          label="Uang yang belum dibayar"
          nilai={ringkasan ? formatRupiah(ringkasan.totalPiutang) : '—'}
          ikon={<Wallet size={16} />}
          penting
        />

        <div className="grid grid-cols-2 gap-3">
          <KartuStatistik
            label="Yang berutang"
            nilai={
              <span className="angka">{ringkasan ? ringkasan.jumlahPelangganBerutang : '—'}</span>
            }
            ikon={<Users size={16} />}
          />
          <KartuStatistik
            label="Sudah dibayar bulan ini"
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
    </div>
  );
}
