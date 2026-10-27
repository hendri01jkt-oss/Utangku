import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { ChevronDown } from 'lucide-react';
import { Kartu, StatusBadge, type Status } from '@/komponen/ui';
import type { BarisTransaksi } from '@/data/db';
import { itemTransaksi } from '@/data/repo/item';
import { sisaUtang } from '@/data/repo/transaksi';
import { formatRupiah } from '@/lib/uang';

const formatTanggal = (iso: string) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

function statusTampil(t: BarisTransaksi): Status {
  const hariIni = new Date().toISOString().slice(0, 10);
  if (t.status !== 'lunas' && t.jatuh_tempo && t.jatuh_tempo < hariIni) return 'lewat_tempo';
  return t.status;
}

/** Kartu riwayat utang yang bisa dibuka, tampilannya sama dengan halaman pantau pelanggan. */
export function KartuRiwayatUtang({ t }: { t: BarisTransaksi }) {
  const [buka, setBuka] = useState(false);
  const item = useLiveQuery(() => (buka ? itemTransaksi(t.id) : []), [buka, t.id]) ?? [];
  const sisa = sisaUtang(t);

  return (
    <Kartu padat className="p-0">
      <button
        type="button"
        onClick={() => setBuka((b) => !b)}
        aria-expanded={buka}
        className="block w-full rounded-[inherit] p-3 text-left"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-medium text-teks-utama">
              {t.nomor_struk?.trim() || t.keterangan?.trim() || 'Tanpa nomor'}
            </p>
            <p className="mt-0.5 text-xs text-teks-samar">{formatTanggal(t.tanggal)}</p>
          </div>
          <p className="shrink-0 text-sm font-semibold tabular-nums text-teks-utama">
            {formatRupiah(t.nominal)}
          </p>
        </div>
        <div className="mt-2 flex items-center justify-between gap-3">
          <StatusBadge status={statusTampil(t)} />
          <span className="flex items-center gap-1 text-xs tabular-nums text-teks-redup">
            {sisa > 0 ? `sisa ${formatRupiah(sisa)}` : null}
            <ChevronDown
              size={16}
              aria-hidden
              className={buka ? 'rotate-180 transition-transform' : 'transition-transform'}
            />
          </span>
        </div>
      </button>

      {buka ? (
        <div className="border-t border-garis px-3 pb-3 pt-2 text-sm">
          {item.length > 0 ? (
            <ul className="flex flex-col gap-1.5">
              {item.map((i) => (
                <li key={i.id} className="flex items-start justify-between gap-3">
                  <span className="min-w-0 text-teks-utama">
                    {i.nama_item}
                    <span className="block text-xs text-teks-samar">
                      {i.qty} x {formatRupiah(i.harga_satuan)}
                    </span>
                  </span>
                  <span className="shrink-0 tabular-nums text-teks-utama">
                    {formatRupiah(i.subtotal)}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-teks-samar">Utang ini dicatat tanpa isi belanjaan.</p>
          )}

          <dl className="mt-2 flex flex-col gap-1 border-t border-garis pt-2 text-xs">
            {t.nomor_struk ? (
              <div className="flex justify-between gap-3">
                <dt className="text-teks-samar">No. Utang</dt>
                <dd className="tabular-nums text-teks-utama">{t.nomor_struk}</dd>
              </div>
            ) : null}
            <div className="flex justify-between gap-3">
              <dt className="text-teks-samar">Total</dt>
              <dd className="tabular-nums text-teks-utama">{formatRupiah(t.nominal)}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-teks-samar">Sudah dibayar</dt>
              <dd className="tabular-nums text-teks-utama">{formatRupiah(t.total_dibayar)}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-teks-samar">Sisa</dt>
              <dd className="font-semibold tabular-nums text-teks-utama">{formatRupiah(sisa)}</dd>
            </div>
            {t.jatuh_tempo ? (
              <div className="flex justify-between gap-3">
                <dt className="text-teks-samar">Batas bayar</dt>
                <dd className="text-teks-utama">{formatTanggal(t.jatuh_tempo)}</dd>
              </div>
            ) : null}
          </dl>

          <Link
            to={`/utang/${t.id}`}
            className="mt-3 block rounded-[var(--radius-kontrol)] border border-garis py-2 text-center text-sm font-medium text-teks-utama"
          >
            Buka detail · bayar / ubah / download
          </Link>
        </div>
      ) : null}
    </Kartu>
  );
}
