import { useCallback, useEffect, useState } from 'react';
import { BadgeCheck, Clock, CreditCard } from 'lucide-react';
import { Kartu, Tombol } from '@/komponen/ui';
import { KotakGalat } from '@/fitur/auth/LayoutAuth';
import { useSesi } from '@/fitur/auth/useSesi';
import { ambilSupabase } from '@/lib/supabase';

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

  const muat = useCallback(async () => {
    if (!warung) return;
    try {
      const sb = await ambilSupabase();
      const { data } = await sb
        .from('subscriptions')
        .select('tier, tanggal_expired, trial_sampai')
        .eq('warung_id', warung.id)
        .maybeSingle();
      if (data) setKeadaan(tentukan(data));
    } catch {
      // Offline: kartu cukup tidak tampil, tidak perlu menakut-nakuti.
    }
  }, [warung]);

  useEffect(() => {
    void muat();
  }, [muat]);

  if (!warung || !keadaan) return null;

  async function bayar() {
    setSedang(true);
    setGalat(null);
    try {
      const sb = await ambilSupabase();
      const { data, error } = await sb.functions.invoke('buat-tagihan');
      if (error || !data?.redirect_url) {
        setGalat(
          (error as { context?: { status?: number } } | null)?.context?.status === 503
            ? 'Pembayaran belum dibuka. Sabar ya, sebentar lagi.'
            : 'Gagal membuka halaman bayar. Pastikan ada sinyal lalu coba lagi.',
        );
        return;
      }
      window.location.href = data.redirect_url as string;
    } catch {
      setGalat('Tidak ada sinyal. Sambungkan ke internet lalu coba lagi.');
    } finally {
      setSedang(false);
    }
  }

  const judul =
    keadaan.jenis === 'aktif'
      ? 'Langganan aktif'
      : keadaan.jenis === 'percobaan'
        ? 'Masa percobaan gratis'
        : 'Masa percobaan selesai';
  const Ikon = keadaan.jenis === 'aktif' ? BadgeCheck : keadaan.jenis === 'percobaan' ? Clock : CreditCard;
  const keterangan =
    keadaan.jenis === 'habis'
      ? 'Catatan kamu aman dan tetap bisa dibuka.'
      : `Sampai ${tanggal(keadaan.sampai)} (${sisaHari(keadaan.sampai)} hari lagi).`;

  return (
    <Kartu>
      <div className="flex items-start gap-3">
        <Ikon className="mt-0.5 size-5 shrink-0 text-emas-700" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="font-semibold">{judul}</p>
          <p className="text-sm text-navy/70">{keterangan}</p>
        </div>
      </div>
      <KotakGalat pesan={galat} />
      <Tombol penuh onClick={bayar} disabled={sedang}>
        {sedang
          ? 'Membuka halaman bayar…'
          : keadaan.jenis === 'aktif'
            ? `Perpanjang 1 bulan · ${HARGA_TAMPIL}`
            : `Bayar ${HARGA_TAMPIL} / bulan`}
      </Tombol>
    </Kartu>
  );
}
