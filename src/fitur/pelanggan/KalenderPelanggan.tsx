import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/data/db';
import { tanggalHariIni } from '@/data/repo/transaksi';
import { Kartu } from '@/komponen/ui';
import { formatRupiah } from '@/lib/uang';
import { KalenderBulan, NavigasiBulan } from '@/fitur/laporan/KalenderBulan';
import {
  bulanDari,
  geserBulan,
  judulHari,
  susunKalender,
} from '@/fitur/laporan/dataKalender';
import { KartuRiwayatUtang } from './KartuRiwayatUtang';

/** Kalender satu pelanggan: titik merah = berutang, hijau = bayar. Ketuk tanggal untuk rinciannya. */
export function KalenderPelanggan({
  warungId,
  pelangganId,
}: {
  warungId: string;
  pelangganId: string;
}) {
  const hariIni = tanggalHariIni();
  const [bulan, setBulan] = useState(bulanDari(hariIni));
  const [terpilih, setTerpilih] = useState<string | null>(null);

  const ringkasan = useLiveQuery(
    async () => await susunKalender(warungId, bulan, pelangganId),
    [warungId, bulan, pelangganId],
  );

  const isi = terpilih ? ringkasan?.hari.get(terpilih) : undefined;
  const idUtang = isi?.utangBaru.map((u) => u.id) ?? [];
  const utangHari = useLiveQuery(
    async () => {
      const baris = await db.transaksi_utang.bulkGet(idUtang);
      return baris.filter((b): b is NonNullable<typeof b> => !!b && b.deleted_at === null);
    },
    [idUtang.join(',')],
    [],
  );

  return (
    <section aria-label="Kalender pelanggan" className="flex flex-col gap-2">
      <NavigasiBulan
        bulan={bulan}
        onGeser={(langkah) => {
          setBulan((b) => geserBulan(b, langkah));
          setTerpilih(null);
        }}
      />
      <KalenderBulan
        bulan={bulan}
        ringkasan={ringkasan}
        terpilih={terpilih}
        hariIni={hariIni}
        onPilih={(t) => setTerpilih((lama) => (lama === t ? null : t))}
      />

      {terpilih ? (
        <Kartu className="flex flex-col gap-3">
          <p className="text-sm font-semibold">{judulHari(terpilih)}</p>
          {!isi ? (
            <p className="text-sm text-teks-samar">Tidak ada catatan pada hari ini.</p>
          ) : (
            <>
              {utangHari.length > 0 ? (
                <ul className="flex flex-col gap-2">
                  {utangHari.map((t) => (
                    <li key={t.id}>
                      <KartuRiwayatUtang t={t} className="permukaan-datar" />
                    </li>
                  ))}
                </ul>
              ) : null}
              {isi.pembayaran.length > 0 ? (
                <ul className="flex flex-col gap-1.5">
                  {isi.pembayaran.map((b, i) => (
                    <li key={i} className="flex items-baseline justify-between gap-3 text-sm">
                      <span className="text-teks-redup">Dibayar</span>
                      <span className="angka font-semibold text-sukses">
                        {formatRupiah(b.nominal)}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </>
          )}
        </Kartu>
      ) : null}
    </section>
  );
}
