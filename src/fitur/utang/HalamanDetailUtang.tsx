import { useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { ArrowLeft, Download, Pencil, Trash2, Wallet, X } from 'lucide-react';
import { Kartu, StatusBadge, Tombol, TombolTautan, type Status } from '@/komponen/ui';
import { db, type BarisTransaksi } from '@/data/db';
import { hapusUtang, sisaUtang, tanggalHariIni } from '@/data/repo/transaksi';
import { hapusPembayaran, riwayatPembayaran } from '@/data/repo/pembayaran';
import { itemTransaksi } from '@/data/repo/item';
import { useSesi } from '@/fitur/auth/useSesi';
import { FormPembayaran } from '@/fitur/pembayaran/FormPembayaran';
import { unduhCatatan } from '@/fitur/struk/unduhCatatan';
import { formatRupiah } from '@/lib/uang';

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
  if (hari === 0) return 'Batas bayar hari ini';
  if (hari > 0) return `Batas bayar ${hari} hari lagi`;
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
  const [sedangUnduh, setSedangUnduh] = useState(false);
  const [galatUnduh, setGalatUnduh] = useState<string | null>(null);

  async function unduh() {
    setSedangUnduh(true);
    setGalatUnduh(null);
    try {
      await unduhCatatan(id);
    } catch (err) {
      setGalatUnduh(err instanceof Error ? err.message : 'Gagal mengunduh. Coba lagi.');
    } finally {
      setSedangUnduh(false);
    }
  }

  const utang = useLiveQuery(async () => await db.transaksi_utang.get(id), [id]);
  const pelanggan = useLiveQuery(
    async () => (utang?.pelanggan_id ? await db.pelanggan.get(utang.pelanggan_id) : undefined),
    [utang?.pelanggan_id],
  );
  const warung = useLiveQuery(
    async () => (utang?.warung_id ? await db.warung.get(utang.warung_id) : undefined),
    [utang?.warung_id],
  );
  const sisaSemua =
    useLiveQuery(async () => {
      if (!utang?.pelanggan_id) return 0;
      const semua = await db.transaksi_utang
        .where('pelanggan_id')
        .equals(utang.pelanggan_id)
        .filter((t) => t.deleted_at === null && t.jenis === 'utang')
        .toArray();
      return semua.reduce((j, t) => j + sisaUtang(t), 0);
    }, [utang?.pelanggan_id]) ?? 0;
  const pembayaran = useLiveQuery(async () => await riwayatPembayaran(id), [id], []);
  const item = useLiveQuery(async () => await itemTransaksi(id), [id], []);

  if (utang === undefined) {
    return <p className="py-8 text-center text-sm text-teks-samar">Memuat…</p>;
  }
  if (!utang || utang.deleted_at) {
    return (
      <Kartu className="flex flex-col items-center gap-3 py-8 text-center">
        <p className="text-sm text-teks-redup">Utang ini tidak ditemukan.</p>
        <Link to="/pelanggan" className="text-sm text-emas-700 underline underline-offset-4">
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
        <h1 className="flex-1 text-lg font-semibold">
          {utang.jenis === 'tunai' ? 'Detail Penjualan' : 'Detail Utang'}
        </h1>
        <Link
          to={`/utang/${id}/ubah`}
          aria-label="Ubah utang"
          className="flex size-9 items-center justify-center rounded-full text-teks-redup hover:bg-permukaan-2"
        >
          <Pencil size={18} aria-hidden />
        </Link>
      </div>

      <section className="overflow-hidden rounded-[var(--radius-kartu)] border border-garis bg-putih shadow-sm">
        {/* Kepala navy-emas: sama dengan gambar hasil Download. */}
        <div
          className="border-b-4 border-emas-500 px-5 py-5 text-white"
          style={{ background: 'linear-gradient(160deg,#16275a 0%,#0f1b3d 60%,#0a1330 100%)' }}
        >
          <p className="text-[11px] font-semibold tracking-widest text-[#f6e6a8]">
            {utang.jenis === 'tunai' ? 'CATATAN PENJUALAN' : 'CATATAN UTANG'}
          </p>
          <p className="mt-1 text-2xl font-bold leading-tight">
            {warung?.nama_warung ?? 'Warung'}
          </p>
          {warung?.alamat || warung?.no_wa_warung ? (
            <p className="mt-3 text-sm leading-snug text-white/70">
              {warung?.alamat ? <span className="block">{warung.alamat}</span> : null}
              {warung?.no_wa_warung ? <span className="block">WA {warung.no_wa_warung}</span> : null}
            </p>
          ) : null}
        </div>

        <div className="flex flex-col gap-4 px-5 py-4">
          <div>
            <StatusBadge status={statusTampil(utang)} />
          </div>

          <dl className="flex flex-col gap-2 border-b border-garis pb-4 text-sm">
            {utang.nomor_struk ? (
              <div className="flex justify-between gap-3">
                <dt className="text-teks-samar">No. Utang</dt>
                <dd className="font-bold tabular-nums text-teks-utama">{utang.nomor_struk}</dd>
              </div>
            ) : null}
            <div className="flex justify-between gap-3">
              <dt className="text-teks-samar">Tanggal</dt>
              <dd className="font-bold text-teks-utama">{formatTanggal(utang.tanggal)}</dd>
            </div>
            {pelanggan ? (
              <div className="flex justify-between gap-3">
                <dt className="text-teks-samar">Pelanggan</dt>
                <dd className="font-bold text-teks-utama">
                  <Link to={`/pelanggan/${pelanggan.id}`}>{pelanggan.nama}</Link>
                </dd>
              </div>
            ) : null}
            <div className="flex justify-between gap-3">
              <dt className="text-teks-samar">Batas bayar</dt>
              <dd className={`text-right ${utang.jatuh_tempo ? 'font-bold text-teks-utama' : 'text-teks-samar'}`}>
                {utang.jatuh_tempo ? (
                  <>
                    {formatTanggal(utang.jatuh_tempo)}
                    <span className="block text-xs font-normal text-teks-samar">
                      {keteranganTempo(utang.jatuh_tempo)}
                    </span>
                  </>
                ) : (
                  'Tanpa tempo'
                )}
              </dd>
            </div>
            {utang.keterangan && item.length === 0 ? (
              <div className="flex justify-between gap-3">
                <dt className="shrink-0 text-teks-samar">Keterangan</dt>
                <dd className="text-right font-bold text-teks-utama">{utang.keterangan}</dd>
              </div>
            ) : null}
          </dl>

          {item.length > 0 ? (
            <div>
              <p className="mb-1 text-[11px] font-bold tracking-widest text-teks-samar">
                ISI BELANJAAN
              </p>
              <ul className="flex flex-col divide-y divide-garis">
                {item.map((i) => (
                  <li key={i.id} className="flex items-baseline justify-between gap-3 py-2.5">
                    <span className="min-w-0">
                      <span className="block truncate text-base font-bold text-teks-utama">
                        {i.nama_item}
                      </span>
                      <span className="angka block text-xs text-teks-samar">
                        {i.qty} x {formatRupiah(i.harga_satuan)}
                      </span>
                    </span>
                    <span className="angka shrink-0 text-base font-bold text-teks-utama">
                      {formatRupiah(i.subtotal)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="rounded-2xl border border-emas-500/30 bg-[#fffaf0] p-4">
            <div className="flex justify-between gap-3 text-sm">
              <span className="text-teks-redup">
                {utang.jenis === 'tunai' ? 'Total belanja' : 'Total utang'}
              </span>
              <span className="angka font-bold text-teks-utama">{formatRupiah(nominal)}</span>
            </div>
            {utang.jenis !== 'tunai' ? (
              <>
                <div className="mt-1 flex justify-between gap-3 text-sm">
                  <span className="text-teks-redup">Sudah dibayar</span>
                  <span className="angka font-bold text-sukses">{formatRupiah(dibayar)}</span>
                </div>
                <div className="mt-3 border-t border-emas-500/30 pt-3">
                  <p className="text-xs font-bold tracking-widest text-teks-redup">SISA UTANG</p>
                  <p className="angka mt-1 text-right text-4xl font-bold text-emas-700">
                    {formatRupiah(sisa)}
                  </p>
                </div>
              </>
            ) : null}
          </div>

          {utang.jenis !== 'tunai' && pelanggan ? (
            <div className="border-b border-garis pb-4 text-center">
              <p className="text-sm text-teks-redup">Total semua utang pelanggan ini saat ini</p>
              <p className="angka mt-1 text-xl font-bold text-teks-utama">
                {formatRupiah(sisaSemua)}
              </p>
            </div>
          ) : null}

          <p className="text-center text-sm text-teks-redup">
            Dicatat dengan <span className="font-bold text-emas-700">UtangKu</span>
          </p>
        </div>
      </section>

      <div className="flex flex-col gap-3">
        {sisa > 0 ? (
          <TombolTautan
            to={`/utang/${id}/bayar`}
            varian="utama"
            ukuran="besar"
            penuh
            ikon={<Wallet size={17} />}
          >
            Terima Uang
          </TombolTautan>
        ) : (
          <p className="rounded-[var(--radius-kontrol)] bg-[var(--tint-sukses)] px-3 py-2.5 text-center text-sm text-sukses">
            {utang.jenis === 'tunai'
              ? 'Penjualan tunai — uang sudah diterima.'
              : 'Utang ini sudah lunas.'}
          </p>
        )}
        <Tombol
          varian="sekunder"
          penuh
          ikon={<Download size={16} />}
          disabled={sedangUnduh}
          onClick={() => void unduh()}
        >
          {sedangUnduh ? 'Menyiapkan…' : 'Download'}
        </Tombol>
        {galatUnduh ? <p className="text-xs text-bahaya">{galatUnduh}</p> : null}
      </div>

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
