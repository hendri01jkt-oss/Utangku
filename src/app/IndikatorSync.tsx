import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { Check, CloudOff, RefreshCw, TriangleAlert } from 'lucide-react';
import { db } from '@/data/db';
import { PanelSyncBermasalah } from './PanelSyncBermasalah';
import { sinkronSekarang } from '@/data/sync/mesin';
import { useSync } from '@/data/sync/useSync';
import { cn } from '@/lib/cn';

/**
 * Status sinkronisasi selalu terlihat, dan bisa ditekan untuk memaksa sync.
 * Pemilik warung berhak tahu apakah catatannya sudah aman.
 *
 * Jumlah tertunda dibaca langsung dari outbox lewat useLiveQuery, bukan
 * disalin ke store — supaya angkanya tidak pernah bisa melenceng dari isi
 * antrean yang sebenarnya.
 */
export function IndikatorSync() {
  const status = useSync((s) => s.status);
  const [panelTerbuka, setPanelTerbuka] = useState(false);
  const tertunda = useLiveQuery(() => db.outbox.filter((e) => e.galat === null).count(), [], 0);
  const bermasalah = useLiveQuery(() => db.outbox.filter((e) => e.galat !== null).count(), [], 0);

  const tampilan =
    bermasalah > 0
      ? { label: 'Perlu diperiksa', Ikon: TriangleAlert, kelas: 'text-bahaya' }
      : status === 'offline'
        ? { label: 'Offline', Ikon: CloudOff, kelas: 'text-peringatan' }
        : status === 'menyinkronkan'
          ? { label: 'Menyinkronkan', Ikon: RefreshCw, kelas: 'text-teks-redup' }
          : { label: 'Tersinkron', Ikon: Check, kelas: 'text-sukses' };

  const { label, Ikon, kelas } = tampilan;
  const jumlah = bermasalah > 0 ? bermasalah : tertunda;

  // "Menyinkronkan" adalah keadaan sesaat, dan tulisannya paling panjang di
  // antara semua status. Di layar 390px ia mendesak nama warung sampai
  // terpotong — padahal nama warung itu identitas utama layarnya. Saat
  // menyinkronkan, ikon berputar sudah cukup menjelaskan; teksnya tetap
  // dibacakan pembaca layar lewat aria-label.
  const sembunyikanLabel = status === 'menyinkronkan' && bermasalah === 0;

  /*
   * Ada dua pekerjaan berbeda di balik satu tombol, dan itu disengaja:
   * dalam keadaan normal menekannya memaksa sinkronisasi, tapi kalau ada
   * yang ditolak server, memaksa sinkron justru tidak akan mengubah apa pun
   * — entri bergalat memang dilewati. Yang dibutuhkan saat itu adalah tahu
   * catatan mana yang tertahan, jadi tombolnya membuka daftarnya.
   */
  const adaMasalah = bermasalah > 0;
  const keterangan = adaMasalah
    ? `${bermasalah} catatan belum terkirim — tekan untuk melihat`
    : `${label} — tekan untuk sinkronkan sekarang`;

  return (
    <>
      <button
        type="button"
        onClick={() => (adaMasalah ? setPanelTerbuka(true) : void sinkronSekarang('manual'))}
        title={keterangan}
        aria-label={keterangan}
        aria-haspopup={adaMasalah ? 'dialog' : undefined}
        aria-expanded={adaMasalah ? panelTerbuka : undefined}
        className={cn(
          'flex items-center gap-1.5 rounded-full px-2 py-1 text-xs transition-colors hover:bg-permukaan-2',
          kelas,
        )}
        aria-live="polite"
      >
        <Ikon
          size={14}
          aria-hidden
          className={status === 'menyinkronkan' && !adaMasalah ? 'animate-spin' : undefined}
        />
        {sembunyikanLabel ? null : <span>{label}</span>}
        {jumlah > 0 ? <span className="angka">({jumlah})</span> : null}
      </button>
      {panelTerbuka ? <PanelSyncBermasalah onTutup={() => setPanelTerbuka(false)} /> : null}
    </>
  );
}
