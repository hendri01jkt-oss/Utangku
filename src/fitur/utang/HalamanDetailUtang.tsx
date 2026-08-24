import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { ArrowLeft, Pencil, Trash2, Wallet, X } from 'lucide-react';
import { Kartu, StatusBadge, Tombol, TombolTautan, type Status } from '@/komponen/ui';
import { db, type BarisTransaksi } from '@/data/db';
import { hapusUtang, sisaUtang, tanggalHariIni } from '@/data/repo/transaksi';
import { hapusPembayaran, riwayatPembayaran } from '@/data/repo/pembayaran';
import { useSesi } from '@/fitur/auth/useSesi';
import { FormPembayaran } from '@/fitur/pembayaran/FormPembayaran';
import { formatRupiah } from '@/lib/uang';
import { FotoPelanggan } from '@/fitur/pelanggan/FotoPelanggan';

const formatTanggal = (iso: string) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

/** Lewat tempo lebih mendesak daripada sekadar belum lunas, jadi didahulukan. */
function statusTampil(t: BarisTransaksi): Status {
  if (t.status !== 'lunas' && t.jatuh_tempo && t.jatuh_tempo < tanggalHariIni()) {
    return 'lewat_tempo';
  }
  return t.status;
}

/** Selisih hari terhadap hari ini; negatif berarti sudah lewat. */
function selisihHari(target: string): number {
  const a = new Date(`${tanggalHariIni()}T00:00:00Z`).getTime();
  const b = new Date(`${target}T00:00:00Z`).getTime();
  return Math.round((b - a) / 86_400_000);
}

function keteranganTempo(tempo: string): string {
  const hari = selisihHari(tempo);
  if (hari === 0) return 'Jatuh tempo hari ini';
  if (hari > 0) return `Jatuh tempo ${hari} hari lagi`;
  return `Lewat tempo ${Math.abs(hari)} hari`;
}

export function HalamanDetailUtang() {
  const { id = '' } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const lokasi = useLocation();
  const sesi = useSesi((s) => s.sesi);

  // Panel pembayaran punya alamatnya sendiri (/utang/:id/bayar) tapi tetap
  // digambar di atas halaman ini, jadi latar belakangnya tetap terlihat dan
  // tautan langsung ke panel itu tetap bekerja.
  const panelBayarTerbuka = lokasi.pathname.endsWith('/bayar');

  const utang = useLiveQuery(async () => await db.transaksi_utang.get(id), [id]);
  const pelanggan = useLiveQuery(
    async () => (utang ? await db.pelanggan.get(utang.pelanggan_id) : undefined),
    [utang?.pelanggan_id],
  );
  const pembayaran = useLiveQuery(async () => await riwayatPembayaran(id), [id], []);

  if (utang === undefined) {
    return <p className="py-8 text-center text-sm text-teks-samar">Memuat…</p>;
  }
  if (!utang || utang.deleted_at) {
    return (
      <Kartu className="flex flex-col items-center gap-3 py-8 text-center">
        <p className="text-sm text-teks-redup">Utang ini tidak ditemukan.</p>
        <Link to="/pelanggan" className="text-sm text-merah-600 underline underline-offset-4">
          Kembali ke daftar pelanggan
        </Link>
      </Kartu>
    );
  }

  const nominal = Math.round(utang.nominal);
  const dibayar = Math.round(utang.total_dibayar);
  const sisa = sisaUtang(utang);
  const persen = nominal > 0 ? Math.min(100, Math.round((dibayar / nominal) * 100)) : 0;

  /**
   * Membatalkan satu cicilan. Ini soft delete, bukan pengubahan nominal —
   * pembayaran tidak pernah diedit, sehingga penggabungan data saat sync
   * tidak bisa menghilangkan angka cicilan (lihat PLAN.md bagian 7.3).
   */
  async function batalkanCicilan(idPembayaran: string, nominalCicilan: number) {
    if (!window.confirm(`Batalkan cicilan ${formatRupiah(nominalCicilan)}?`)) return;
    await hapusPembayaran(idPembayaran);
  }

  async function hapus() {
    if (!window.confirm('Hapus catatan utang ini?')) return;
    const tujuan = utang?.pelanggan_id ? `/pelanggan/${utang.pelanggan_id}` : '/pelanggan';
    await hapusUtang(id);
    navigate(tujuan, { replace: true });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => navigate(-1)}
          aria-label="Kembali"
          className="flex size-9 items-center justify-center rounded-full text-teks-redup hover:bg-permukaan-2"
        >
          <ArrowLeft size={20} aria-hidden />
        </button>
        <h1 className="flex-1 text-lg font-semibold">Detail Utang</h1>
        <Link
          to={`/utang/${id}/ubah`}
          aria-label="Ubah utang"
          className="flex size-9 items-center justify-center rounded-full text-teks-redup hover:bg-permukaan-2"
        >
          <Pencil size={18} aria-hidden />
        </Link>
      </div>

      {pelanggan ? (
        <Link
          to={`/pelanggan/${pelanggan.id}`}
          className="permukaan flex items-center gap-3 rounded-[var(--radius-kartu)] p-3 transition-colors hover:bg-permukaan-2"
        >
          <FotoPelanggan pelangganId={pelanggan.id} nama={pelanggan.nama} ukuran={40} />
          <span className="min-w-0 flex-1">
            <span className="block truncate font-medium">{pelanggan.nama}</span>
            <span className="block text-xs text-teks-samar">Lihat semua utangnya</span>
          </span>
        </Link>
      ) : null}

      <Kartu className="flex flex-col gap-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs text-teks-samar">Sisa utang</p>
            <p className="angka mt-1 text-3xl font-semibold text-merah-600">
              {formatRupiah(sisa)}
            </p>
          </div>
          <StatusBadge status={statusTampil(utang)} />
        </div>

        {/* Progres cicilan. Tahap 5 belum punya pembayaran, jadi biasanya 0% —
            batangnya tetap ditampilkan supaya bentuk akhirnya sudah terlihat. */}
        <div className="flex flex-col gap-1.5">
          <div
            className="h-2 overflow-hidden rounded-full bg-permukaan-2"
            role="progressbar"
            aria-valuenow={persen}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Progres pembayaran"
          >
            <div className="h-full rounded-full bg-sukses" style={{ width: `${persen}%` }} />
          </div>
          <div className="flex justify-between text-xs text-teks-samar">
            <span className="angka">
              Dibayar {formatRupiah(dibayar)} ({persen}%)
            </span>
            <span className="angka">dari {formatRupiah(nominal)}</span>
          </div>
        </div>

        <dl className="flex flex-col gap-2 border-t border-garis pt-3 text-sm">
          <div className="flex justify-between gap-3">
            <dt className="text-teks-samar">Tanggal</dt>
            <dd>{formatTanggal(utang.tanggal)}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-teks-samar">Jatuh tempo</dt>
            <dd className={utang.jatuh_tempo ? '' : 'text-teks-samar'}>
              {utang.jatuh_tempo ? (
                <>
                  {formatTanggal(utang.jatuh_tempo)}
                  <span className="block text-xs text-teks-samar">
                    {keteranganTempo(utang.jatuh_tempo)}
                  </span>
                </>
              ) : (
                'Tanpa tempo'
              )}
            </dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="shrink-0 text-teks-samar">Keterangan</dt>
            <dd className="text-right">{utang.keterangan ?? '—'}</dd>
          </div>
        </dl>

        {sisa > 0 ? (
          <TombolTautan
            to={`/utang/${id}/bayar`}
            varian="utama"
            ukuran="besar"
            penuh
            ikon={<Wallet size={17} />}
          >
            Terima Pembayaran
          </TombolTautan>
        ) : (
          <p className="rounded-[var(--radius-kontrol)] bg-[var(--tint-sukses)] px-3 py-2.5 text-center text-sm text-sukses">
            Utang ini sudah lunas.
          </p>
        )}
      </Kartu>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold text-teks-redup">Riwayat cicilan</h2>
        {pembayaran.length === 0 ? (
          <Kartu>
            <p className="text-sm text-teks-samar">Belum ada cicilan untuk utang ini.</p>
          </Kartu>
        ) : (
          <ul className="flex flex-col gap-2">
            {pembayaran.map((b) => (
              <li key={b.id}>
                <Kartu padat className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm">{formatTanggal(b.tanggal)}</p>
                    <p className="text-xs capitalize text-teks-samar">{b.metode}</p>
                    {b.catatan ? (
                      <p className="truncate text-xs text-teks-samar">{b.catatan}</p>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <p className="angka text-sm font-semibold text-sukses">
                      {formatRupiah(b.nominal)}
                    </p>
                    <button
                      type="button"
                      onClick={() => void batalkanCicilan(b.id, b.nominal)}
                      aria-label={`Batalkan cicilan ${formatRupiah(b.nominal)}`}
                      className="flex size-8 items-center justify-center rounded-full text-teks-samar transition-colors hover:bg-[var(--tint-bahaya)] hover:text-bahaya"
                    >
                      <X size={15} aria-hidden />
                    </button>
                  </div>
                </Kartu>
              </li>
            ))}
          </ul>
        )}
      </section>

      <Tombol varian="bahaya" ikon={<Trash2 size={16} />} onClick={() => void hapus()} penuh>
        Hapus catatan utang
      </Tombol>

      {panelBayarTerbuka ? (
        <FormPembayaran
          utang={utang}
          dibuatOleh={sesi?.user.id ?? null}
          onTutup={() => navigate(`/utang/${id}`, { replace: true })}
          onSelesai={() => navigate(`/utang/${id}`, { replace: true })}
        />
      ) : null}
    </div>
  );
}
