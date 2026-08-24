import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Send, TriangleAlert } from 'lucide-react';
import { normalisasiNomorWa, tautanWa } from '@/lib/wa';
import { sisaUtang } from '@/data/repo/transaksi';
import { susunPesanTagihan, TEMPLATE_BAWAAN } from './pesanTagihan';
import type { BarisTransaksi } from '@/data/db';
import { cn } from '@/lib/cn';

interface Props {
  idPelanggan: string;
  namaPelanggan: string;
  noWa: string | null;
  namaWarung: string;
  template: string | null;
  utangBelumLunas: BarisTransaksi[];
  penuh?: boolean;
  ukuran?: 'sedang' | 'besar';
  label?: string;
  /** Tampilan ringkas untuk baris daftar: hanya ikon. */
  ikonSaja?: boolean;
}

/**
 * Membuka WhatsApp dengan pesan tagihan yang sudah terisi.
 *
 * Tautan wa.me tidak menghubungi server UtangKu sama sekali, jadi menagih
 * tetap bisa dilakukan tanpa sinyal data — cukup aplikasi WhatsApp di HP.
 * Pesannya sengaja tidak dikirim otomatis: pemilik warung yang menentukan
 * nadanya, dan masih bisa menyuntingnya sebelum menekan kirim.
 */
export function TombolTagihWa({
  idPelanggan,
  namaPelanggan,
  noWa,
  namaWarung,
  template,
  utangBelumLunas,
  penuh,
  ukuran = 'sedang',
  label = 'Tagih via WhatsApp',
  ikonSaja,
}: Props) {
  const [galat, setGalat] = useState<string | null>(null);
  const nomor = normalisasiNomorWa(noWa);
  const totalSisa = utangBelumLunas.reduce((jumlah, t) => jumlah + sisaUtang(t), 0);

  const kelasDasar = cn(
    'inline-flex items-center justify-center gap-2 rounded-[var(--radius-kontrol)]',
    'transition-colors duration-150',
    ukuran === 'besar' ? 'min-h-13 px-5 text-base font-semibold' : 'min-h-11 px-4 text-sm',
    ikonSaja && 'size-10 min-h-0 p-0',
    penuh && 'w-full',
  );

  // Tidak ada yang perlu ditagih: tombolnya dimatikan. Mengirimi pelanggan
  // pesan "Sisa utang Anda: Rp 0" bukan sekadar aneh — pelanggan yang baru
  // saja melunasi bisa merasa masih ditagih.
  if (totalSisa <= 0) {
    return (
      <button
        type="button"
        disabled
        aria-label={ikonSaja ? label : undefined}
        title="Tidak ada utang untuk ditagih"
        className={cn(
          kelasDasar,
          'cursor-not-allowed border border-garis bg-permukaan-2 text-teks-samar',
        )}
      >
        <Send size={ukuran === 'besar' ? 17 : 16} aria-hidden />
        {ikonSaja ? null : 'Tidak ada utang'}
      </button>
    );
  }

  if (!nomor.ok) {
    return (
      <div className={cn('flex flex-col gap-1.5', penuh && 'w-full')}>
        <button
          type="button"
          onClick={() => setGalat(nomor.alasan)}
          aria-label={ikonSaja ? label : undefined}
          className={cn(
            kelasDasar,
            'border border-garis bg-putih text-teks-samar hover:bg-permukaan-2',
          )}
        >
          <Send size={ukuran === 'besar' ? 17 : 16} aria-hidden />
          {ikonSaja ? null : label}
        </button>

        {galat ? (
          <p
            role="alert"
            className="flex items-start gap-1.5 rounded-[var(--radius-kontrol)] bg-[var(--tint-peringatan)] px-2.5 py-2 text-xs text-peringatan"
          >
            <TriangleAlert size={13} className="mt-0.5 shrink-0" aria-hidden />
            <span>
              {nomor.alasan}{' '}
              <Link
                to={`/pelanggan/${idPelanggan}/ubah`}
                className="underline underline-offset-2"
              >
                Isi nomornya
              </Link>
            </span>
          </p>
        ) : null}
      </div>
    );
  }

  const pesan = susunPesanTagihan(template?.trim() || TEMPLATE_BAWAAN, {
    namaPelanggan,
    namaWarung,
    utangBelumLunas,
  });

  return (
    <a
      href={tautanWa(nomor.nomor, pesan)}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={ikonSaja ? `${label} untuk ${namaPelanggan}` : undefined}
      className={cn(kelasDasar, 'bg-merah-600 text-putih hover:bg-merah-700')}
    >
      <Send size={ukuran === 'besar' ? 17 : 16} aria-hidden />
      {ikonSaja ? null : label}
    </a>
  );
}
