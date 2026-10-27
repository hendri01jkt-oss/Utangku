import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { ChevronDown, Download, Wallet } from 'lucide-react';
import { Kartu, StatusBadge, Tombol, TombolTautan, type Status } from '@/komponen/ui';
import type { BarisTransaksi } from '@/data/db';
import { itemTransaksi } from '@/data/repo/item';
import { sisaUtang } from '@/data/repo/transaksi';
import { unduhCatatan } from '@/fitur/struk/unduhCatatan';
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
export function KartuRiwayatUtang({
  t,
  namaPelanggan,
  className,
}: {
  t: BarisTransaksi;
  /** Diisi di laporan, tempat satu daftar memuat banyak pelanggan. */
  namaPelanggan?: string;
  className?: string;
}) {
  const [buka, setBuka] = useState(false);
  const item = useLiveQuery(() => (buka ? itemTransaksi(t.id) : []), [buka, t.id]) ?? [];
  const sisa = sisaUtang(t);
  const [sedangUnduh, setSedangUnduh] = useState(false);
  const [galatUnduh, setGalatUnduh] = useState<string | null>(null);

  async function unduh() {
    setSedangUnduh(true);
    setGalatUnduh(null);
    try {
      await unduhCatatan(t.id);
    } catch (err) {
      setGalatUnduh(err instanceof Error ? err.message : 'Gagal mengunduh. Coba lagi.');
    } finally {
      setSedangUnduh(false);
    }
  }

  return (
    <Kartu padat className={`p-0 ${className ?? ''}`}>
      <button
        type="button"
        onClick={() => setBuka((b) => !b)}
        aria-expanded={buka}
        className="block w-full rounded-[inherit] p-3 text-left"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            {namaPelanggan ? (
              <>
                <p className="text-sm font-semibold text-teks-utama">{namaPelanggan}</p>
                <p className="mt-0.5 text-xs text-teks-samar">
                  {t.nomor_struk?.trim() || 'Tanpa nomor'}
                </p>
                <p className="text-xs text-teks-samar">{formatTanggal(t.tanggal)}</p>
              </>
            ) : (
              <>
                <p className="text-sm font-medium text-teks-utama">
                  {t.nomor_struk?.trim() || t.keterangan?.trim() || 'Tanpa nomor'}
                </p>
                <p className="mt-0.5 text-xs text-teks-samar">{formatTanggal(t.tanggal)}</p>
              </>
            )}
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

          <div className="mt-3 grid grid-cols-2 gap-2">
            {sisa > 0 ? (
              <TombolTautan
                to={`/utang/${t.id}/bayar`}
                varian="utama"
                ikon={<Wallet size={16} />}
              >
                Bayar
              </TombolTautan>
            ) : (
              <Tombol varian="sekunder" ikon={<Wallet size={16} />} disabled>
                Lunas
              </Tombol>
            )}
            <Tombol
              varian="sekunder"
              ikon={<Download size={16} />}
              disabled={sedangUnduh}
              onClick={() => void unduh()}
            >
              {sedangUnduh ? 'Menyiapkan…' : 'Download'}
            </Tombol>
          </div>
          {galatUnduh ? <p className="mt-2 text-xs text-bahaya">{galatUnduh}</p> : null}
        </div>
      ) : null}
    </Kartu>
  );
}
