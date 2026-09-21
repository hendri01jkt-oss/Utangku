import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Check, CloudOff, RefreshCw, TriangleAlert } from 'lucide-react';
import { Kartu, Tombol } from '@/komponen/ui';
import { PanelSyncBermasalah } from '@/app/PanelSyncBermasalah';
import { db } from '@/data/db';
import { sinkronSekarang } from '@/data/sync/mesin';
import { useSync } from '@/data/sync/useSync';
import { cn } from '@/lib/cn';

/**
 * Status sinkronisasi, dipindah dari header ke halaman Akun.
 *
 * Di header ia hanya muat sebagai ikon kecil dengan satu kata, sehingga
 * "tertunda" dan "ditolak server" — dua keadaan yang tindakannya jauh
 * berbeda — tampil nyaris sama. Di sini keduanya punya ruang untuk dieja:
 * yang tertunda cukup ditunggu, yang ditolak butuh diperiksa.
 *
 * Jumlahnya dibaca langsung dari outbox lewat useLiveQuery, bukan disalin ke
 * store, supaya angkanya tidak pernah melenceng dari isi antrean sebenarnya.
 */
export function KartuSinkron() {
  const status = useSync((s) => s.status);
  const [panelTerbuka, setPanelTerbuka] = useState(false);
  const tertunda = useLiveQuery(
    () => db.outbox.filter((e) => e.galat === null).count(),
    [],
    0,
  );
  const bermasalah = useLiveQuery(
    () => db.outbox.filter((e) => e.galat !== null).count(),
    [],
    0,
  );

  const tampilan =
    status === 'offline'
      ? {
          label: 'Offline',
          Ikon: CloudOff,
          kelas: 'text-peringatan',
          keterangan:
            'Catatan tetap tersimpan di HP ini dan akan terkirim sendiri begitu ada sinyal.',
        }
      : status === 'menyinkronkan'
        ? {
            label: 'Menyinkronkan',
            Ikon: RefreshCw,
            kelas: 'text-teks-redup',
            keterangan: 'Sedang mengirim catatan yang menunggu.',
          }
        : {
            label: 'Tersinkron',
            Ikon: Check,
            kelas: 'text-sukses',
            keterangan:
              'Perubahan tersimpan di HP lebih dulu dan terkirim sendiri saat ada sinyal. Tombol ini hanya untuk memaksa lebih cepat.',
          };

  const { label, Ikon, kelas, keterangan } = tampilan;

  return (
    <>
      <Kartu aria-label="Status sinkronisasi" className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          {/*
            "Menyinkronkan" adalah label terpanjang di antara ketiga status,
            dan di layar 390px ia berebut ruang dengan tombolnya. Jumlah
            tertunda karena itu turun ke baris keterangan, bukan disisipkan
            di sebelah labelnya.
          */}
          <p className={cn('flex min-w-0 items-center gap-2 text-sm font-semibold', kelas)}>
            <Ikon
              size={17}
              aria-hidden
              className={cn('shrink-0', status === 'menyinkronkan' && 'animate-spin')}
            />
            <span className="truncate">{label}</span>
          </p>
          <Tombol
            varian="sekunder"
            ikon={<RefreshCw size={16} />}
            onClick={() => void sinkronSekarang('manual-akun')}
            className="shrink-0"
          >
            Sinkronkan
          </Tombol>
        </div>

        <p className="text-xs text-teks-samar">
          {tertunda > 0 ? (
            <>
              <span className="angka font-medium text-teks-redup">
                {tertunda} catatan menunggu dikirim.
              </span>{' '}
            </>
          ) : null}
          {keterangan}
        </p>

        {/*
          Entri bergalat sengaja TIDAK ikut ke dalam status di atas. Menekan
          "Sinkronkan" tidak akan mengubah apa pun untuknya — entri bergalat
          memang dilewati supaya antrean tidak macet — jadi yang dibutuhkan
          bukan tombol sinkron, melainkan jalan masuk untuk melihat catatan
          mana yang tertahan.
        */}
        {bermasalah > 0 ? (
          <div className="flex items-center justify-between gap-3 rounded-[var(--radius-kontrol)] border border-bahaya/25 bg-[var(--tint-bahaya)] p-3">
            <div className="min-w-0">
              {/*
                Ikon dan kalimatnya sengaja jadi dua anak saja, kalimatnya
                utuh dalam satu span: dengan angka sebagai span terpisah,
                flex memperlakukannya sebagai kotak sendiri dan kalimatnya
                patah jadi "1" lalu "catatan perlu diperiksa" di bawahnya.
              */}
              <p className="flex items-start gap-1.5 text-sm font-semibold text-bahaya">
                <TriangleAlert size={15} aria-hidden className="mt-0.5 shrink-0" />
                <span className="angka">{bermasalah} catatan perlu diperiksa</span>
              </p>
              <p className="text-xs text-teks-samar">
                Ditolak server — tidak akan terkirim sampai diperbaiki.
              </p>
            </div>
            <Tombol
              varian="bahaya"
              onClick={() => setPanelTerbuka(true)}
              aria-haspopup="dialog"
              aria-expanded={panelTerbuka}
            >
              Periksa
            </Tombol>
          </div>
        ) : null}
      </Kartu>

      {panelTerbuka ? <PanelSyncBermasalah onTutup={() => setPanelTerbuka(false)} /> : null}
    </>
  );
}
