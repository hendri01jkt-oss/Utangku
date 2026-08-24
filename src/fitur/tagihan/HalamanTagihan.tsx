import { useLiveQuery } from 'dexie-react-hooks';
import { CalendarClock, CircleCheck, Clock, TriangleAlert } from 'lucide-react';
import type { ReactNode } from 'react';
import { Kartu } from '@/komponen/ui';
import { useSesi } from '@/fitur/auth/useSesi';
import { formatRupiah } from '@/lib/uang';
import { KartuBarisTagihan } from './KartuBarisTagihan';
import { kelompokTagihan, type BarisTagihan } from './daftarTagihan';

function Kelompok({
  judul,
  penjelasan,
  ikon,
  baris,
  namaWarung,
  template,
}: {
  judul: string;
  penjelasan: string;
  ikon: ReactNode;
  baris: BarisTagihan[];
  namaWarung: string;
  template: string | null;
}) {
  if (baris.length === 0) return null;

  const total = baris.reduce((jumlah, b) => jumlah + b.sisa, 0);

  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold text-teks-redup">
          {ikon}
          {judul}
          <span className="angka font-normal text-teks-samar">({baris.length})</span>
        </h2>
        <span className="angka text-xs font-semibold text-merah-600">
          {formatRupiah(total)}
        </span>
      </div>
      <p className="-mt-1 text-xs text-teks-samar">{penjelasan}</p>
      <ul className="flex flex-col gap-2">
        {baris.map((b) => (
          <li key={b.transaksi.id}>
            <KartuBarisTagihan baris={b} namaWarung={namaWarung} template={template} />
          </li>
        ))}
      </ul>
    </section>
  );
}

export function HalamanTagihan() {
  const warung = useSesi((s) => s.warung);

  const kelompok = useLiveQuery(
    async () => (warung ? await kelompokTagihan(warung.id) : undefined),
    [warung?.id],
  );

  const namaWarung = warung?.nama_warung ?? 'Warung';
  const template = warung?.template_pesan_tagihan ?? null;
  const kosong =
    kelompok &&
    kelompok.lewatTempo.length === 0 &&
    kelompok.mendekatiTempo.length === 0 &&
    kelompok.terlama.length === 0;

  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-lg font-semibold">Perlu Ditagih</h1>

      {kelompok === undefined ? (
        <p className="py-8 text-center text-sm text-teks-samar">Memuat…</p>
      ) : kosong ? (
        <Kartu className="flex flex-col items-center gap-3 py-8 text-center">
          <CircleCheck size={32} className="text-sukses" aria-hidden />
          <p className="text-sm text-teks-redup">
            Tidak ada utang yang perlu ditagih. Semua sudah lunas.
          </p>
        </Kartu>
      ) : (
        <>
          <Kelompok
            judul="Lewat Tempo"
            penjelasan="Sudah melewati tanggal yang dijanjikan."
            ikon={<TriangleAlert size={14} className="text-bahaya" aria-hidden />}
            baris={kelompok.lewatTempo}
            namaWarung={namaWarung}
            template={template}
          />
          <Kelompok
            judul="Mendekati Jatuh Tempo"
            penjelasan="Masuk masa pengingat sesuai tempo masing-masing utang."
            ikon={<CalendarClock size={14} className="text-peringatan" aria-hidden />}
            baris={kelompok.mendekatiTempo}
            namaWarung={namaWarung}
            template={template}
          />
          <Kelompok
            judul="Utang Terlama"
            penjelasan="Tanpa tanggal tempo, diurutkan dari yang paling lama dicatat."
            ikon={<Clock size={14} className="text-teks-samar" aria-hidden />}
            baris={kelompok.terlama}
            namaWarung={namaWarung}
            template={template}
          />
        </>
      )}
    </div>
  );
}
