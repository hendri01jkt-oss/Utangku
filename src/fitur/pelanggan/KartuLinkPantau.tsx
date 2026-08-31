import { useState } from 'react';
import { Check, Copy, Eye, RefreshCw, Share2 } from 'lucide-react';
import { Tombol } from '@/komponen/ui';
import { gantiTokenPantau } from '@/data/repo/pelanggan';
import { alamatAplikasi } from '@/lib/alamat';

const formatWaktu = (iso: string) =>
  new Date(iso).toLocaleString('id-ID', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });

/**
 * Link pantau: pelanggan memeriksa sendiri catatan utangnya tanpa login.
 *
 * Gunanya menghilangkan kecurigaan "nominalnya ditambah-tambahin". Karena
 * itu link-nya harus gampang dikirim lewat WA — pemilik warung tidak akan
 * mengetik ulang URL sepanjang ini.
 */
export function KartuLinkPantau({
  pelangganId,
  namaPelanggan,
  token,
  terakhirDilihat,
}: {
  pelangganId: string;
  namaPelanggan: string;
  token: string;
  terakhirDilihat: string | null;
}) {
  const [tersalin, setTersalin] = useState(false);
  const [konfirmasiGanti, setKonfirmasiGanti] = useState(false);
  const [galat, setGalat] = useState<string | null>(null);

  const alamat = alamatAplikasi(`pantau/${token}`);

  const salin = async () => {
    setGalat(null);
    try {
      await navigator.clipboard.writeText(alamat);
      setTersalin(true);
      setTimeout(() => setTersalin(false), 2000);
    } catch {
      // Clipboard API ditolak (izin, atau konteks tidak aman). Alamatnya
      // tetap terlihat di layar supaya masih bisa disalin manual — jangan
      // sampai pemilik warung buntu tanpa tahu alamatnya apa.
      setGalat('Tidak bisa menyalin otomatis. Salin manual dari alamat di atas.');
    }
  };

  const bagikan = async () => {
    const pesan =
      `Halo ${namaPelanggan}, ini link untuk melihat catatan utang Anda ` +
      `kapan saja:\n${alamat}`;
    if (navigator.share) {
      try {
        await navigator.share({ text: pesan });
        return;
      } catch (kegagalan) {
        // Menutup lembar berbagi adalah pembatalan, bukan kegagalan.
        if (kegagalan instanceof DOMException && kegagalan.name === 'AbortError') return;
      }
    }
    void salin();
  };

  const ganti = async () => {
    await gantiTokenPantau(pelangganId);
    setKonfirmasiGanti(false);
    setTersalin(false);
  };

  return (
    <div className="rounded-[var(--radius-kontrol)] border border-garis p-3">
      <div className="flex items-center gap-2">
        <Eye size={15} className="shrink-0 text-teks-redup" aria-hidden />
        <p className="text-sm font-medium text-teks-utama">Link pantau pelanggan</p>
      </div>

      <p className="mt-1 text-xs text-teks-samar">
        Pelanggan bisa melihat riwayat dan sisa utangnya sendiri, tanpa perlu akun.
        Halaman itu hanya bisa dibaca, tidak bisa diubah.
      </p>

      {/* Alamatnya ditampilkan, bukan disembunyikan di balik tombol: kalau
          penyalinan otomatis gagal, ini satu-satunya jalan keluar. */}
      <p className="mt-2 rounded bg-permukaan-2 px-2 py-1.5 text-xs break-all text-teks-redup">
        {alamat}
      </p>

      <div className="mt-2 grid grid-cols-2 gap-2">
        <Tombol
          varian="sekunder"
          onClick={() => void salin()}
          ikon={tersalin ? <Check size={16} /> : <Copy size={16} />}
        >
          {tersalin ? 'Tersalin' : 'Salin Link'}
        </Tombol>
        <Tombol varian="sekunder" onClick={() => void bagikan()} ikon={<Share2 size={16} />}>
          Kirim
        </Tombol>
      </div>

      {galat ? <p className="mt-2 text-xs text-bahaya">{galat}</p> : null}

      <p className="mt-2 text-xs text-teks-samar">
        {terakhirDilihat
          ? `Terakhir dibuka pelanggan: ${formatWaktu(terakhirDilihat)}`
          : 'Belum pernah dibuka pelanggan.'}
      </p>

      {konfirmasiGanti ? (
        <div className="mt-3 rounded-[var(--radius-kontrol)] bg-[var(--tint-peringatan)] p-3">
          <p className="text-xs text-teks-utama">
            Link lama akan langsung berhenti berlaku. Pelanggan yang sudah menyimpannya
            harus dikirimi link baru.
          </p>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <Tombol varian="sekunder" onClick={() => setKonfirmasiGanti(false)}>
              Batal
            </Tombol>
            <Tombol varian="utama" onClick={() => void ganti()}>
              Ya, ganti link
            </Tombol>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setKonfirmasiGanti(true)}
          className="mt-2 flex min-h-11 items-center gap-1.5 text-xs text-teks-redup underline underline-offset-4"
        >
          <RefreshCw size={13} aria-hidden />
          Ganti link (kalau link lama bocor)
        </button>
      )}
    </div>
  );
}
