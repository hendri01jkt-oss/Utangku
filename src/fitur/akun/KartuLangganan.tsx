import { useEffect, useState } from 'react';
import { Check, CreditCard, Crown } from 'lucide-react';
import { useSesi } from '@/fitur/auth/useSesi';
import { api, GalatApi } from '@/lib/api';

const HARGA_TAMPIL = 'Rp35.000';
const HARI = 24 * 3600 * 1000;

type Keadaan =
  | { jenis: 'aktif'; sampai: Date }
  | { jenis: 'percobaan'; sampai: Date }
  | { jenis: 'habis'; sampai: Date | null };

function tentukan(baris: {
  tier: string;
  tanggal_expired: string | null;
  trial_sampai: string;
}): Keadaan {
  const sekarang = Date.now();
  const bayar = baris.tanggal_expired ? new Date(baris.tanggal_expired) : null;
  if (baris.tier === 'pro' && bayar && bayar.getTime() > sekarang) {
    return { jenis: 'aktif', sampai: bayar };
  }
  const trial = new Date(baris.trial_sampai);
  if (trial.getTime() > sekarang) return { jenis: 'percobaan', sampai: trial };
  return { jenis: 'habis', sampai: bayar ?? trial };
}

const tanggal = (d: Date) =>
  d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });

const sisaHari = (d: Date) => Math.max(0, Math.ceil((d.getTime() - Date.now()) / HARI));

/**
 * Status langganan dan tombol bayar.
 *
 * Sengaja hanya memberi tahu: tidak ada fitur yang dikunci di mana pun.
 * Penguncian baru dinyalakan setelah pembayaran terbukti jalan dari ujung
 * ke ujung.
 */
export function KartuLangganan() {
  const warung = useSesi((s) => s.warung);
  const [keadaan, setKeadaan] = useState<Keadaan | null>(null);
  const [sedang, setSedang] = useState(false);
  const [galat, setGalat] = useState<string | null>(null);

  const warungId = warung?.id;

  useEffect(() => {
    if (!warungId) return;
    let batal = false;
    api<{
      langganan: { tier: string; tanggal_expired: string | null; trial_sampai: string } | null;
    }>('/langganan')
      .then(({ langganan }) => {
        if (!batal && langganan) setKeadaan(tentukan(langganan));
      })
      .catch(() => {
        // Offline: kartu cukup tidak tampil, tidak perlu menakut-nakuti.
      });
    return () => {
      batal = true;
    };
  }, [warungId]);

  if (!warung || !keadaan) return null;

  async function bayar() {
    setSedang(true);
    setGalat(null);
    try {
      const data = await api<{ redirect_url?: string }>('/langganan/tagihan', {
        method: 'POST',
        json: {},
      });
      if (!data.redirect_url) {
        setGalat('Gagal membuka halaman bayar. Pastikan ada sinyal lalu coba lagi.');
        return;
      }
      window.location.href = data.redirect_url;
    } catch (err) {
      setGalat(
        err instanceof GalatApi && err.status === 503
          ? 'Pembayaran belum dibuka. Sabar ya, sebentar lagi.'
          : err instanceof GalatApi && err.status > 0
            ? err.message
            : 'Tidak ada sinyal. Sambungkan ke internet lalu coba lagi.',
      );
    } finally {
      setSedang(false);
    }
  }

  const lencana =
    keadaan.jenis === 'aktif'
      ? 'AKTIF'
      : keadaan.jenis === 'percobaan'
        ? 'COBA GRATIS'
        : 'BERAKHIR';
  const keterangan =
    keadaan.jenis === 'habis'
      ? 'Masa percobaan selesai. Catatanmu tetap aman dan bisa dibuka.'
      : `Berlaku sampai ${tanggal(keadaan.sampai)} · ${sisaHari(keadaan.sampai)} hari lagi`;
  const manfaat = [
    'Catat utang tanpa batas, tetap jalan tanpa sinyal',
    'Link pantau untuk pelanggan & tagih via WhatsApp',
    'Laporan PDF dan Excel, catatan utang bisa diunduh',
  ];

  return (
    <section
      className="relative overflow-hidden rounded-2xl border border-emas-500/60 p-5 text-white shadow-lg"
      style={{
        background:
          'radial-gradient(120% 90% at 100% 0%, rgba(201,168,76,0.35) 0%, rgba(201,168,76,0) 55%), linear-gradient(160deg,#16275a 0%,#0f1b3d 55%,#0a1330 100%)',
      }}
    >
      <div
        className="pointer-events-none absolute -right-10 -top-10 size-36 rounded-full border border-emas-500/30"
        aria-hidden
      />
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span
            className="flex size-9 items-center justify-center rounded-full"
            style={{ background: 'linear-gradient(135deg,#f6e6a8,#c9a84c)' }}
          >
            <Crown className="size-5 text-[#0f1b3d]" aria-hidden />
          </span>
          <span className="rounded-full border border-emas-500/60 px-2.5 py-0.5 text-[11px] font-semibold tracking-widest text-[#f6e6a8]">
            {lencana}
          </span>
        </div>
      </div>

      <p className="mt-4 flex items-baseline gap-1">
        <span
          className="text-4xl font-bold tracking-tight"
          style={{
            background: 'linear-gradient(180deg,#fff3c4,#c9a84c)',
            WebkitBackgroundClip: 'text',
            color: 'transparent',
          }}
        >
          {HARGA_TAMPIL}
        </span>
        <span className="text-sm text-white/70">/ bulan</span>
      </p>
      <p className="mt-1 text-sm text-white/75">{keterangan}</p>

      <ul className="mt-4 flex flex-col gap-2">
        {manfaat.map((m) => (
          <li key={m} className="flex items-start gap-2 text-sm text-white/90">
            <Check className="mt-0.5 size-4 shrink-0 text-[#e8c766]" aria-hidden />
            {m}
          </li>
        ))}
      </ul>

      {galat ? (
        <p role="alert" className="mt-4 rounded-lg bg-red-500/15 px-3 py-2 text-sm text-red-100">
          {galat}
        </p>
      ) : null}

      <button
        type="button"
        onClick={bayar}
        disabled={sedang}
        className="mt-5 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-[#a8872f] px-4 font-semibold text-[#0f1b3d] shadow-md transition active:scale-[0.98] disabled:opacity-60"
        style={{ background: 'linear-gradient(180deg,#f6e6a8 0%,#d9b957 55%,#c9a84c 100%)' }}
      >
        <CreditCard className="size-5" aria-hidden />
        {sedang
          ? 'Membuka halaman bayar…'
          : keadaan.jenis === 'aktif'
            ? 'Perpanjang 1 bulan'
            : 'Berlangganan sekarang'}
      </button>
      <p className="mt-2 text-center text-xs text-white/55">
        Bayar lewat QRIS, e-wallet, atau transfer bank · aman via Midtrans
      </p>
    </section>
  );
}
