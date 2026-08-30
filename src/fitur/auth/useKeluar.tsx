import { useState } from 'react';
import { TriangleAlert } from 'lucide-react';
import { BottomSheet, Tombol } from '@/komponen/ui';
import { db } from '@/data/db';
import { useSesi } from './useSesi';

/**
 * Keluar akun, tapi tidak pernah diam-diam membuang catatan yang belum
 * terkirim.
 *
 * Keluar memang HARUS mengosongkan data lokal — satu HP bisa dipakai
 * bergantian, dan catatan utang orang lain tidak boleh tertinggal di
 * IndexedDB. Persoalannya, pengosongan itu ikut membuang antrean outbox:
 * satu ketukan pada ikon keluar di header — yang letaknya bersebelahan
 * dengan ikon pengaturan — cukup untuk melenyapkan perubahan yang belum
 * sempat sampai ke server, tanpa satu pun peringatan.
 *
 * Jadi sebelum keluar, antreannya dihitung dulu. Kalau masih ada isinya,
 * pemiliknya diberi tahu persis berapa catatan yang akan hilang dan diberi
 * kesempatan membatalkan.
 */
export function useKeluar() {
  const keluar = useSesi((s) => s.keluar);
  const [tertunda, setTertunda] = useState<number | null>(null);
  const [sedangKeluar, setSedangKeluar] = useState(false);

  const mintaKeluar = async () => {
    const jumlah = await db.outbox.count();
    if (jumlah > 0) {
      setTertunda(jumlah);
      return;
    }
    await keluar();
  };

  const paksaKeluar = async () => {
    setSedangKeluar(true);
    try {
      await keluar({ paksa: true });
    } finally {
      setSedangKeluar(false);
      setTertunda(null);
    }
  };

  const dialogKeluar =
    tertunda === null ? null : (
      <BottomSheet judul="Masih ada yang belum terkirim" onTutup={() => setTertunda(null)}>
        <div className="flex flex-col gap-4">
          <div className="flex items-start gap-2">
            <TriangleAlert size={18} className="mt-0.5 shrink-0 text-bahaya" aria-hidden />
            <p className="text-sm text-teks-redup">
              Ada <span className="angka font-semibold text-teks-utama">{tertunda}</span> catatan
              yang baru tersimpan di HP ini dan belum sampai ke server. Kalau Anda keluar
              sekarang, catatan itu <span className="font-semibold">hilang permanen</span> —
              tidak ada salinannya di tempat lain.
            </p>
          </div>
          <p className="text-sm text-teks-redup">
            Sambungkan ke internet dan tunggu indikator di header berubah menjadi
            &ldquo;Tersinkron&rdquo; lebih dulu, lalu keluar dengan aman.
          </p>
          <Tombol varian="sekunder" penuh onClick={() => setTertunda(null)}>
            Batal, saya tunggu dulu
          </Tombol>
          <Tombol varian="bahaya" penuh disabled={sedangKeluar} onClick={() => void paksaKeluar()}>
            {sedangKeluar ? 'Keluar…' : `Keluar dan buang ${tertunda} catatan`}
          </Tombol>
        </div>
      </BottomSheet>
    );

  return { mintaKeluar, dialogKeluar };
}
