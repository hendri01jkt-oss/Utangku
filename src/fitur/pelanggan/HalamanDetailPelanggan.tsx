import { useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { ArrowLeft, CheckCheck, Pencil, Plus, Wallet } from 'lucide-react';
import { Kartu, Tombol, TombolTautan } from '@/komponen/ui';
import { db, type BarisTransaksi } from '@/data/db';
import { daftarTunaiPelanggan, daftarUtangPelanggan, sisaUtang } from '@/data/repo/transaksi';
import { formatRupiah } from '@/lib/uang';
import { FotoPelanggan } from './FotoPelanggan';
import { KartuLinkPantau } from './KartuLinkPantau';
import { KartuRiwayatUtang } from './KartuRiwayatUtang';
import { SheetLunasiSemua } from '@/fitur/pembayaran/SheetLunasiSemua';
import { FormPembayaran } from '@/fitur/pembayaran/FormPembayaran';
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

export function HalamanDetailPelanggan() {
  const { id = '' } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const lokasi = useLocation();
  const pilihUtangTerbuka = lokasi.pathname.endsWith('/bayar');
  const warung = useSesi((s) => s.warung);
  const [lunasiTerbuka, setLunasiTerbuka] = useState(false);
  const [bayarUtang, setBayarUtang] = useState<BarisTransaksi | null>(null);
  const sesi = useSesi((x) => x.sesi);

  const pelanggan = useLiveQuery(async () => await db.pelanggan.get(id), [id]);
  const utang = useLiveQuery(async () => await daftarUtangPelanggan(id), [id], []);
  const tunai = useLiveQuery(async () => await daftarTunaiPelanggan(id), [id], []);

  if (pelanggan === undefined) {
    return <p className="py-8 text-center text-sm text-teks-samar">Memuat…</p>;
  }
  if (!pelanggan || pelanggan.deleted_at) {
    return (
      <Kartu className="flex flex-col items-center gap-3 py-8 text-center">
        <p className="text-sm text-teks-redup">Pelanggan tidak ditemukan.</p>
        <Link to="/pelanggan" className="text-sm text-emas-700 underline underline-offset-4">
          Kembali ke daftar pelanggan
        </Link>
      </Kartu>
    );
  }

  const totalSisa = utang.reduce((jumlah, t) => jumlah + sisaUtang(t), 0);
  const belumLunas = utang.filter((t) => t.status !== 'lunas');
  const totalBelumLunas = belumLunas.reduce((j, t) => j + sisaUtang(t), 0);

  return (
    <div className="flex flex-col gap-3">
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

      <Kartu className="flex flex-col gap-3">
        {/* Nama sudah ada di judul halaman; tidak diulang di sini. */}
        <div className="flex items-center gap-2.5">
          <FotoPelanggan pelangganId={pelanggan.id} nama={pelanggan.nama} ukuran={36} />
          <p className="text-sm text-teks-redup">
            {pelanggan.no_wa ? pelanggan.no_wa : 'Nomor WA belum diisi'}
          </p>
        </div>

        <div className="flex items-center justify-between gap-3 rounded-[var(--radius-kontrol)] bg-permukaan-2 px-3 py-2">
          <div className="min-w-0">
            <p className="text-xs text-teks-samar">Sisa utang</p>
            <p className="text-xs text-teks-samar">
              {belumLunas.length > 0
                ? `${belumLunas.length} transaksi belum lunas`
                : 'Semua utang sudah lunas'}
            </p>
          </div>
          <p className="angka text-xl font-semibold text-emas-700">{formatRupiah(totalSisa)}</p>
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
            penuh
          />
          {belumLunas.length > 1 ? (
            <Tombol
              varian="utama"
              ukuran="besar"
              penuh
              ikon={<CheckCheck size={17} />}
              onClick={() => setLunasiTerbuka(true)}
            >
              Lunasi semua · {formatRupiah(totalBelumLunas)}
            </Tombol>
          ) : null}
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
                Terima Uang
              </Tombol>
            ) : (
              <Tombol
                // Satu utang belum lunas: langsung ke panel bayarnya, tidak
                // perlu memilih. Lebih dari satu: pemiliknya yang memilih.
                varian="sekunder"
                ikon={<Wallet size={16} />}
                onClick={() =>
                  belumLunas.length === 1 && belumLunas[0]
                    ? setBayarUtang(belumLunas[0])
                    : navigate(`/pelanggan/${id}/bayar`)
                }
              >
                Terima Uang
              </Tombol>
            )}
          </div>
        </div>

        <KartuLinkPantau
          pelangganId={pelanggan.id}
          namaPelanggan={pelanggan.nama}
          token={pelanggan.token_pantau}
          pin={pelanggan.pin_pantau}
          terakhirDilihat={pelanggan.terakhir_dilihat_pelanggan}
        />
      </Kartu>

      <section className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-teks-redup">Riwayat utang</h2>
          {belumLunas.length > 1 ? (
            <button
              type="button"
              onClick={() => setLunasiTerbuka(true)}
              className="flex items-center gap-1.5 rounded-full border border-[#a8872f] px-3 py-1.5 text-xs font-semibold text-[#0f1b3d] shadow-sm active:scale-[0.98]"
              style={{ background: 'linear-gradient(180deg,#f6e6a8 0%,#d9b957 100%)' }}
            >
              <CheckCheck size={14} aria-hidden />
              Lunasi semua · {formatRupiah(totalBelumLunas)}
            </button>
          ) : null}
        </div>
        {utang.length === 0 ? (
          <Kartu>
            <p className="text-sm text-teks-samar">Belum ada utang tercatat.</p>
          </Kartu>
        ) : (
          <ul className="flex flex-col gap-2">
            {utang.map((t) => (
              <li key={t.id}>
                <KartuRiwayatUtang t={t} />
              </li>
            ))}
          </ul>
        )}
      </section>

      {/*
        Belanja tunai berdiri sebagai daftar sendiri, di bawah riwayat utang.
        Digabung ke daftar utang, angkanya akan terbaca sebagai piutang yang
        belum dibayar — padahal uangnya sudah diterima di tempat. Bagian ini
        disembunyikan sama sekali kalau pelanggan ini memang tidak pernah
        belanja tunai, supaya halamannya tidak jadi ramai tanpa guna.
      */}
      {tunai.length > 0 ? (
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold text-teks-redup">Riwayat belanja tunai</h2>
          <ul className="flex flex-col gap-2">
            {tunai.map((t) => (
              <li key={t.id}>
                <Link to={`/utang/${t.id}`} className="block">
                  <Kartu
                    padat
                    dapatDitekan
                    className="sorot-kartu flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {t.keterangan ?? 'Tanpa keterangan'}
                      </p>
                      <p className="text-xs text-teks-samar">{formatTanggal(t.tanggal)}</p>
                    </div>
                    <p className="angka shrink-0 text-sm font-semibold text-sukses">
                      {formatRupiah(t.nominal)}
                    </p>
                  </Kartu>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {bayarUtang ? (
        <FormPembayaran
          utang={bayarUtang}
          dibuatOleh={sesi?.user.id ?? null}
          onTutup={() => setBayarUtang(null)}
          onSelesai={() => setBayarUtang(null)}
        />
      ) : null}
      {lunasiTerbuka ? (
        <SheetLunasiSemua utang={belumLunas} onTutup={() => setLunasiTerbuka(false)} />
      ) : null}
      {pilihUtangTerbuka ? (
        <SheetPilihUtang
          utang={belumLunas}
          onTutup={() => navigate(`/pelanggan/${id}`, { replace: true })}
          onPilih={(t) => {
            navigate(`/pelanggan/${id}`, { replace: true });
            setBayarUtang(t);
          }}
        />
      ) : null}
    </div>
  );
}
