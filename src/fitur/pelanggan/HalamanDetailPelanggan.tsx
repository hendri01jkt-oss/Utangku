import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { ArrowLeft, Pencil, Plus, Wallet } from 'lucide-react';
import { Kartu, StatusBadge, Tombol, TombolTautan, type Status } from '@/komponen/ui';
import { db, type BarisTransaksi } from '@/data/db';
import { daftarUtangPelanggan, sisaUtang } from '@/data/repo/transaksi';
import { riwayatPembayaranPelanggan } from '@/data/repo/pembayaran';
import { formatRupiah } from '@/lib/uang';
import { FotoPelanggan } from './FotoPelanggan';
import { SheetPilihUtang } from '@/fitur/pembayaran/SheetPilihUtang';
import { TombolTagihWa } from '@/fitur/tagihan/TombolTagihWa';
import { useSesi } from '@/fitur/auth/useSesi';

/** Tanggal ISO -> "24 Agu 2026". */
const formatTanggal = (iso: string) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

const hariIni = () => new Date().toISOString().slice(0, 10);

/** Lewat tempo lebih mendesak daripada sekadar belum lunas, jadi didahulukan. */
function statusTampil(t: BarisTransaksi): Status {
  if (t.status !== 'lunas' && t.jatuh_tempo && t.jatuh_tempo < hariIni()) return 'lewat_tempo';
  return t.status;
}

export function HalamanDetailPelanggan() {
  const { id = '' } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const lokasi = useLocation();
  const pilihUtangTerbuka = lokasi.pathname.endsWith('/bayar');
  const warung = useSesi((s) => s.warung);

  const pelanggan = useLiveQuery(async () => await db.pelanggan.get(id), [id]);
  const utang = useLiveQuery(async () => await daftarUtangPelanggan(id), [id], []);
  const pembayaran = useLiveQuery(async () => await riwayatPembayaranPelanggan(id), [id], []);

  if (pelanggan === undefined) {
    return <p className="py-8 text-center text-sm text-teks-samar">Memuat…</p>;
  }
  if (!pelanggan || pelanggan.deleted_at) {
    return (
      <Kartu className="flex flex-col items-center gap-3 py-8 text-center">
        <p className="text-sm text-teks-redup">Pelanggan tidak ditemukan.</p>
        <Link to="/pelanggan" className="text-sm text-merah-600 underline underline-offset-4">
          Kembali ke daftar pelanggan
        </Link>
      </Kartu>
    );
  }

  const totalSisa = utang.reduce((jumlah, t) => jumlah + sisaUtang(t), 0);
  const belumLunas = utang.filter((t) => t.status !== 'lunas');

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
        <h1 className="min-w-0 flex-1 truncate text-lg font-semibold">{pelanggan.nama}</h1>
        <Link
          to={`/pelanggan/${id}/ubah`}
          aria-label="Ubah pelanggan"
          className="flex size-9 items-center justify-center rounded-full text-teks-redup hover:bg-permukaan-2"
        >
          <Pencil size={18} aria-hidden />
        </Link>
      </div>

      <Kartu className="flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <FotoPelanggan pelangganId={pelanggan.id} nama={pelanggan.nama} ukuran={56} />
          <div className="min-w-0">
            <p className="truncate font-medium">{pelanggan.nama}</p>
            <p className="text-xs text-teks-samar">
              {pelanggan.no_wa ? pelanggan.no_wa : 'Nomor WA belum diisi'}
            </p>
          </div>
        </div>

        <div className="rounded-[var(--radius-kontrol)] bg-permukaan-2 p-3">
          <p className="text-xs text-teks-samar">Sisa utang</p>
          <p className="angka mt-1 text-2xl font-semibold text-merah-600">
            {formatRupiah(totalSisa)}
          </p>
          <p className="mt-1 text-xs text-teks-samar">
            {belumLunas.length > 0
              ? `${belumLunas.length} transaksi belum lunas`
              : 'Semua utang sudah lunas'}
          </p>
        </div>

        {pelanggan.catatan ? (
          <p className="text-sm text-teks-redup">{pelanggan.catatan}</p>
        ) : null}

        <div className="flex flex-col gap-2">
          <TombolTagihWa
            idPelanggan={pelanggan.id}
            namaPelanggan={pelanggan.nama}
            noWa={pelanggan.no_wa}
            namaWarung={warung?.nama_warung ?? 'Warung'}
            template={warung?.template_pesan_tagihan ?? null}
            utangBelumLunas={belumLunas}
            ukuran="besar"
            penuh
          />
          <div className="grid grid-cols-2 gap-2">
            <TombolTautan
              to={`/utang/baru?pelanggan=${id}`}
              varian="sekunder"
              ikon={<Plus size={16} />}
            >
              Catat Utang
            </TombolTautan>
            {belumLunas.length === 0 ? (
              <Tombol varian="sekunder" ikon={<Wallet size={16} />} disabled>
                Terima Bayar
              </Tombol>
            ) : (
              <TombolTautan
                // Satu utang belum lunas: langsung ke panel bayarnya, tidak
                // perlu memilih. Lebih dari satu: pemiliknya yang memilih.
                to={
                  belumLunas.length === 1 && belumLunas[0]
                    ? `/utang/${belumLunas[0].id}/bayar`
                    : `/pelanggan/${id}/bayar`
                }
                varian="sekunder"
                ikon={<Wallet size={16} />}
              >
                Terima Bayar
              </TombolTautan>
            )}
          </div>

        </div>
      </Kartu>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold text-teks-redup">Riwayat utang</h2>
        {utang.length === 0 ? (
          <Kartu>
            <p className="text-sm text-teks-samar">Belum ada utang tercatat.</p>
          </Kartu>
        ) : (
          <ul className="flex flex-col gap-2">
            {utang.map((t) => (
              <li key={t.id}>
                <Link to={`/utang/${t.id}`} className="block">
                  <Kartu
                    padat
                    className="flex items-center justify-between gap-3 transition-colors hover:bg-permukaan-2"
                  >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {t.keterangan ?? 'Tanpa keterangan'}
                    </p>
                    <p className="text-xs text-teks-samar">{formatTanggal(t.tanggal)}</p>
                    <StatusBadge status={statusTampil(t)} className="mt-1.5" />
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="angka text-sm font-semibold">{formatRupiah(t.nominal)}</p>
                    {sisaUtang(t) > 0 ? (
                      <p className="angka text-xs text-merah-600">
                        sisa {formatRupiah(sisaUtang(t))}
                      </p>
                    ) : null}
                  </div>
                  </Kartu>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold text-teks-redup">Riwayat pembayaran</h2>
        {pembayaran.length === 0 ? (
          <Kartu>
            <p className="text-sm text-teks-samar">Belum ada pembayaran.</p>
          </Kartu>
        ) : (
          <ul className="flex flex-col gap-2">
            {pembayaran.map((b) => (
              <li key={b.id}>
                <Kartu padat className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm">{formatTanggal(b.tanggal)}</p>
                    <p className="text-xs capitalize text-teks-samar">{b.metode}</p>
                  </div>
                  <p className="angka text-sm font-semibold text-sukses">
                    {formatRupiah(b.nominal)}
                  </p>
                </Kartu>
              </li>
            ))}
          </ul>
        )}
      </section>
      {pilihUtangTerbuka ? (
        <SheetPilihUtang
          utang={belumLunas}
          onTutup={() => navigate(`/pelanggan/${id}`, { replace: true })}
        />
      ) : null}
    </div>
  );
}
