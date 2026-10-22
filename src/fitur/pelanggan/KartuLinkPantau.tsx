import { useState } from 'react';
import { Check, Copy, Eye, KeyRound, RefreshCw, Share2 } from 'lucide-react';
import { Tombol } from '@/komponen/ui';
import { gantiPinPantau, gantiTokenPantau } from '@/data/repo/pelanggan';
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
  pin,
  terakhirDilihat,
}: {
  pelangganId: string;
  namaPelanggan: string;
  token: string;
  /** Kosong hanya pada pelanggan lama yang belum sempat menerima PIN dari server. */
  pin: string | null | undefined;
  terakhirDilihat: string | null;
}) {
  const [tersalin, setTersalin] = useState(false);
  const [pinTersalin, setPinTersalin] = useState(false);
  const [konfirmasiPin, setKonfirmasiPin] = useState(false);
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
      `kapan saja:\n${alamat}\n\nPIN-nya saya kirim terpisah.`;
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

  // PIN sengaja dikirim lewat pesan TERPISAH dari link: kalau keduanya
  // menumpuk di satu pesan, siapa pun yang mendapat teruskan pesan itu
  // memegang kunci sekaligus gemboknya.
  const bagikanPin = async () => {
    if (!pin) return;
    const pesan =
      `PIN untuk membuka catatan utang Anda: ${pin}\n` +
      `Jangan dibagikan ke orang lain.`;
    if (navigator.share) {
      try {
        await navigator.share({ text: pesan });
        return;
      } catch (kegagalan) {
        if (kegagalan instanceof DOMException && kegagalan.name === 'AbortError') return;
      }
    }
    try {
      await navigator.clipboard.writeText(pesan);
      setPinTersalin(true);
      setTimeout(() => setPinTersalin(false), 2000);
    } catch {
      setGalat('Tidak bisa menyalin otomatis. Sebutkan PIN-nya langsung ke pelanggan.');
    }
  };

  const gantiPin = async () => {
    await gantiPinPantau(pelangganId);
    setKonfirmasiPin(false);
  };

  const ganti = async () => {
    await gantiTokenPantau(pelangganId);
    setKonfirmasiGanti(false);
    setTersalin(false);
  };

  return (
    <div className="rounded-[var(--radius-kontrol)] border border-garis p-2.5">
      <div className="flex items-center gap-2">
        <Eye size={15} className="shrink-0 text-teks-redup" aria-hidden />
        <p className="text-sm font-medium text-teks-utama">Link pantau pelanggan</p>
      </div>

      <p className="mt-0.5 text-xs leading-snug text-teks-samar">
        Pelanggan melihat riwayat dan sisa utangnya sendiri dengan link dan PIN
        ini, tanpa perlu akun. Halaman itu hanya bisa dibaca, tidak bisa diubah.
      </p>

      {/* Alamatnya ditampilkan, bukan disembunyikan di balik tombol: kalau
          penyalinan otomatis gagal, ini satu-satunya jalan keluar. */}
      <p className="mt-1.5 rounded bg-permukaan-2 px-2 py-1 text-[11px] leading-snug break-all text-teks-redup">
        {alamat}
      </p>

      <div className="mt-1.5 grid grid-cols-2 gap-2">
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

      <div className="mt-2 rounded-[var(--radius-kontrol)] border border-garis bg-permukaan-2 p-2.5">
        <div className="flex items-center gap-2">
          <KeyRound size={15} className="shrink-0 text-teks-redup" aria-hidden />
          <p className="text-sm font-medium text-teks-utama">PIN pelanggan</p>
        </div>
        {pin ? (
          <>
            <p className="angka mt-1 text-2xl font-bold tracking-[0.3em] text-teks-utama">
              {pin.slice(0, 3)} {pin.slice(3)}
            </p>
            <p className="mt-0.5 text-xs leading-snug text-teks-samar">
              Kirim terpisah dari link, atau sebutkan langsung. Salah 5 kali, link
              terkunci 15 menit.
            </p>
            <div className="mt-1.5 grid grid-cols-2 gap-2">
              <Tombol
                varian="sekunder"
                onClick={() => void bagikanPin()}
                ikon={pinTersalin ? <Check size={16} /> : <Share2 size={16} />}
              >
                {pinTersalin ? 'Tersalin' : 'Kirim PIN'}
              </Tombol>
              <Tombol varian="sekunder" onClick={() => setKonfirmasiPin(true)}>
                Ganti PIN
              </Tombol>
            </div>
            {konfirmasiPin ? (
              <div className="mt-2 rounded-[var(--radius-kontrol)] bg-[var(--tint-peringatan)] p-3">
                <p className="text-xs text-teks-utama">
                  PIN lama langsung tidak berlaku. Pelanggan harus diberi PIN yang baru.
                </p>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <Tombol varian="sekunder" onClick={() => setKonfirmasiPin(false)}>
                    Batal
                  </Tombol>
                  <Tombol varian="utama" onClick={() => void gantiPin()}>
                    Ya, ganti PIN
                  </Tombol>
                </div>
              </div>
            ) : null}
          </>
        ) : (
          <div className="mt-1.5">
            <p className="text-xs text-teks-samar">
              PIN belum tersedia di perangkat ini. Buat sekarang.
            </p>
            <Tombol className="mt-1.5" varian="sekunder" onClick={() => void gantiPin()}>
              Buat PIN
            </Tombol>
          </div>
        )}
      </div>

      <p className="mt-1.5 text-xs text-teks-samar">
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
          className="flex min-h-9 items-center gap-1.5 text-xs text-teks-redup underline underline-offset-4"
        >
          <RefreshCw size={13} aria-hidden />
          Ganti link (kalau link lama bocor)
        </button>
      )}
    </div>
  );
}
