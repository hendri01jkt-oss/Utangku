import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { RefreshCw, TriangleAlert } from 'lucide-react';
import { BottomSheet, Tombol } from '@/komponen/ui';
import { cobaUlangSemua, daftarOutboxBermasalah } from '@/data/repo/outbox';
import { sinkronSekarang } from '@/data/sync/mesin';

/**
 * Daftar catatan yang ditolak server.
 *
 * Sebelumnya jumlahnya muncul di header sebagai angka merah tanpa jalan
 * masuk ke mana pun — pemilik warung hanya diberi tahu bahwa ada yang salah,
 * tanpa cara mengetahui apa. Panel ini menjawab dua pertanyaan yang pantas
 * ditanyakan: catatan mana, dan apa yang bisa saya lakukan.
 */
export function PanelSyncBermasalah({ onTutup }: { onTutup: () => void }) {
  /*
   * Sengaja TANPA nilai awal, sehingga `undefined` berarti "masih dibaca".
   * Dengan nilai awal [] panel sempat berkedip menampilkan "Tidak ada lagi
   * yang tertahan" tepat sebelum daftarnya muncul — persis kebalikan dari
   * kenyataan, di layar yang dibuka justru karena ada yang salah.
   */
  const entri = useLiveQuery(() => daftarOutboxBermasalah());
  const [sedangCoba, setSedangCoba] = useState(false);

  const cobaLagi = async () => {
    setSedangCoba(true);
    try {
      await cobaUlangSemua();
      await sinkronSekarang('manual');
    } finally {
      setSedangCoba(false);
    }
  };

  return (
    <BottomSheet judul="Catatan yang belum terkirim" onTutup={onTutup}>
      <div className="flex flex-col gap-4">
        <p className="text-sm text-teks-redup">
          Catatan berikut tersimpan aman di HP ini, tapi ditolak server saat
          dikirim. Angkanya tetap terhitung benar di Beranda — yang belum ada
          hanyalah salinannya di server.
        </p>

        {entri === undefined ? (
          <p className="text-sm text-teks-samar">Memuat…</p>
        ) : entri.length === 0 ? (
          <p className="text-sm text-sukses">Tidak ada lagi yang tertahan.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {entri.map((e) => (
              <li key={e.urutan} className="permukaan flex flex-col gap-1 rounded-xl p-3">
                <div className="flex items-start gap-2">
                  <TriangleAlert size={16} className="mt-0.5 shrink-0 text-bahaya" aria-hidden />
                  <div className="flex min-w-0 flex-col">
                    <span className="text-sm font-semibold text-teks-utama">{e.judul}</span>
                    {e.rincian ? (
                      <span className="angka text-xs text-teks-redup">{e.rincian}</span>
                    ) : null}
                  </div>
                </div>
                {/*
                  Pesan server ditampilkan apa adanya. Ia memang berbahasa
                  Inggris dan teknis, tapi justru itu yang dibutuhkan kalau
                  pemilik warung harus meneruskannya untuk minta bantuan —
                  menerjemahkannya jadi kalimat manis malah menghilangkan
                  satu-satunya petunjuk yang berguna.
                */}
                <p className="break-words rounded-lg bg-permukaan-2 px-2 py-1 text-xs text-teks-samar">
                  {e.galat}
                </p>
                <p className="text-xs text-teks-samar">
                  Dicoba {e.percobaan}× · antre sejak{' '}
                  {new Date(e.dibuat_at).toLocaleString('id-ID', {
                    day: 'numeric',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
              </li>
            ))}
          </ul>
        )}

        {entri !== undefined && entri.length > 0 ? (
          <Tombol
            varian="utama"
            penuh
            onClick={() => void cobaLagi()}
            disabled={sedangCoba}
            ikon={<RefreshCw size={16} className={sedangCoba ? 'animate-spin' : undefined} />}
          >
            {sedangCoba ? 'Mengirim ulang…' : 'Coba kirim ulang'}
          </Tombol>
        ) : null}
      </div>
    </BottomSheet>
  );
}
