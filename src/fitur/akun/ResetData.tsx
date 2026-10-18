import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { TriangleAlert } from 'lucide-react';
import { BottomSheet, Input, Tombol } from '@/komponen/ui';
import { KotakGalat } from '@/fitur/auth/LayoutAuth';
import { useSesi } from '@/fitur/auth/useSesi';
import { db } from '@/data/db';
import { resetDataWarung } from '@/data/repo/reset';

const KATA_KONFIRMASI = 'KONFIRMASI';

/**
 * Tombol dan dialog "Hapus semua data warung".
 *
 * Satu-satunya aksi di aplikasi ini yang tidak bisa dibatalkan, jadi
 * pengamannya berlapis: tombolnya di dasar halaman Akun, dialognya
 * menyebut persis apa yang hilang beserta jumlahnya, dan tombol hapus baru
 * hidup setelah kata KONFIRMASI diketik utuh.
 */
export function ResetData() {
  const warung = useSesi((s) => s.warung);
  const [terbuka, setTerbuka] = useState(false);
  const [ketikan, setKetikan] = useState('');
  const [sedang, setSedang] = useState(false);
  const [galat, setGalat] = useState<string | null>(null);
  const [selesai, setSelesai] = useState(false);

  const jumlah = useLiveQuery(
    async () => ({
      pelanggan: await db.pelanggan.filter((p) => p.deleted_at === null).count(),
      utang: await db.transaksi_utang.filter((t) => t.deleted_at === null).count(),
    }),
    [],
  );

  if (!warung) return null;

  const tutup = () => {
    if (sedang) return;
    setTerbuka(false);
    setKetikan('');
    setGalat(null);
  };

  async function hapus() {
    if (!warung) return;
    setSedang(true);
    setGalat(null);
    try {
      await resetDataWarung(warung.id);
      setSelesai(true);
      setKetikan('');
    } catch (err) {
      setGalat(
        err instanceof Error && /fetch|network|failed/i.test(err.message)
          ? 'Tidak ada sinyal. Sambungkan ke internet lalu coba lagi. Belum ada yang terhapus.'
          : 'Gagal menghapus. Belum ada yang terhapus. Coba lagi.',
      );
    } finally {
      setSedang(false);
    }
  }

  return (
    <>
      <Tombol varian="bahaya" penuh onClick={() => setTerbuka(true)}>
        Hapus semua data warung
      </Tombol>

      {terbuka ? (
        <BottomSheet judul="Hapus semua data warung" onTutup={tutup}>
          {selesai ? (
            <div className="flex flex-col gap-4">
              <p className="text-sm text-teks-redup">
                Selesai. Semua pelanggan, utang, dan pembayaran sudah dihapus. Akun dan
                pengaturan warung tetap ada.
              </p>
              <Tombol
                varian="utama"
                penuh
                onClick={() => {
                  setSelesai(false);
                  setTerbuka(false);
                }}
              >
                Tutup
              </Tombol>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <div className="flex items-start gap-2">
                <TriangleAlert size={18} className="mt-0.5 shrink-0 text-bahaya" aria-hidden />
                <p className="text-sm text-teks-redup">
                  Ini menghapus{' '}
                  <span className="font-semibold text-teks-utama">
                    {jumlah?.pelanggan ?? 0} pelanggan
                  </span>{' '}
                  dan{' '}
                  <span className="font-semibold text-teks-utama">
                    {jumlah?.utang ?? 0} catatan utang
                  </span>{' '}
                  beserta semua pembayaran dan foto, di HP ini <em>dan</em> di server, termasuk
                  di HP lain. <span className="font-semibold">Tidak bisa dibatalkan.</span>
                </p>
              </div>
              <p className="text-xs text-teks-samar">
                Link pantau milik pelanggan juga berhenti berlaku. Akun dan pengaturan
                warung tidak ikut terhapus.
              </p>

              <Input
                label={`Ketik ${KATA_KONFIRMASI} untuk melanjutkan`}
                value={ketikan}
                onChange={(e) => setKetikan(e.target.value)}
                autoComplete="off"
                autoCapitalize="characters"
              />

              <KotakGalat pesan={galat} />

              <Tombol varian="sekunder" penuh onClick={tutup} disabled={sedang}>
                Batal
              </Tombol>
              <Tombol
                varian="bahaya"
                penuh
                disabled={ketikan.trim() !== KATA_KONFIRMASI || sedang}
                onClick={() => void hapus()}
              >
                {sedang ? 'Menghapus…' : 'Hapus semuanya'}
              </Tombol>
            </div>
          )}
        </BottomSheet>
      ) : null}
    </>
  );
}
