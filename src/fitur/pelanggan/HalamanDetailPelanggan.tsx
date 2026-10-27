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
import { KalenderPelanggan } from './KalenderPelanggan';
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
  const [tab, setTab] = useState<'riwayat' | 'kalender' | 'link'>('riwayat');
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
  const totalUtangSemua = utang.reduce((j, t) => j + Math.round(t.nominal), 0);
  const totalDibayar = utang.reduce((j, t) => j + Math.round(t.total_dibayar), 0);
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

      {/* Ringkasan: satu kartu navy-emas, senada dengan catatan utang. */}
      <section className="overflow-hidden rounded-[var(--radius-kartu)] border border-garis bg-putih shadow-sm">
        <div
          className="border-b-4 border-emas-500 px-4 py-4 text-white"
          style={{ background: 'linear-gradient(160deg,#16275a 0%,#0f1b3d 60%,#0a1330 100%)' }}
        >
          <div className="flex items-center gap-3">
            <FotoPelanggan pelangganId={pelanggan.id} nama={pelanggan.nama} ukuran={44} />
            <div className="min-w-0">
              <p className="text-[11px] font-semibold tracking-widest text-[#f6e6a8]">PELANGGAN</p>
              <p className="truncate text-sm text-white/75">
                {pelanggan.no_wa ? pelanggan.no_wa : 'Nomor WA belum diisi'}
              </p>
            </div>
          </div>
          <p className="mt-4 text-xs text-white/70">Sisa utang</p>
          <p
            className="angka text-4xl font-bold tracking-tight"
            style={{
              background: 'linear-gradient(180deg,#fff3c4,#e0be5a)',
              WebkitBackgroundClip: 'text',
              color: 'transparent',
            }}
          >
            {formatRupiah(totalSisa)}
          </p>
          <p className="mt-0.5 text-xs text-white/70">
            {belumLunas.length > 0
              ? `${belumLunas.length} transaksi belum lunas`
              : 'Semua utang sudah lunas'}
          </p>

          <div className="mt-4 grid grid-cols-2 gap-3 border-t border-white/15 pt-3">
            <div>
              <p className="text-[11px] text-white/60">Total utang</p>
              <p className="angka text-base font-semibold">{formatRupiah(totalUtangSemua)}</p>
            </div>
            <div>
              <p className="text-[11px] text-white/60">Sudah dibayar</p>
              <p className="angka text-base font-semibold text-[#9be3b4]">
                {formatRupiah(totalDibayar)}
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-2.5 p-4">
          {pelanggan.catatan ? (
            <p className="text-sm text-teks-redup">{pelanggan.catatan}</p>
          ) : null}

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
          ) : (
            <Tombol
              varian="utama"
              ukuran="besar"
              penuh
              ikon={<Wallet size={17} />}
              disabled={belumLunas.length === 0}
              onClick={() => belumLunas[0] && setBayarUtang(belumLunas[0])}
            >
              Terima Uang
            </Tombol>
          )}

          <div className="grid grid-cols-2 gap-2">
            <TombolTagihWa
              idPelanggan={pelanggan.id}
              namaPelanggan={pelanggan.nama}
              noWa={pelanggan.no_wa}
              namaWarung={warung?.nama_warung ?? 'Warung'}
              template={warung?.template_pesan_tagihan ?? null}
              utangBelumLunas={belumLunas}
              penuh
            />
            <TombolTautan
              to={`/utang/baru?pelanggan=${id}`}
              varian="sekunder"
              ikon={<Plus size={16} />}
            >
              Catat Utang
            </TombolTautan>
          </div>

          {belumLunas.length > 1 ? (
            <button
              type="button"
              onClick={() => navigate(`/pelanggan/${id}/bayar`)}
              className="self-center text-xs text-teks-samar underline underline-offset-4"
            >
              Bayar sebagian saja (pilih utang)
            </button>
          ) : null}
        </div>
      </section>

      {/* Tab: satu hal tampil sekali, supaya halaman tidak menumpuk. */}
      <div
        role="tablist"
        aria-label="Isi halaman pelanggan"
        className="grid grid-cols-3 gap-1 rounded-full bg-permukaan-2 p-1"
      >
        {(
          [
            ['riwayat', 'Riwayat'],
            ['kalender', 'Kalender'],
            ['link', 'Link pantau'],
          ] as const
        ).map(([kunci, label]) => (
          <button
            key={kunci}
            type="button"
            role="tab"
            aria-selected={tab === kunci}
            onClick={() => setTab(kunci)}
            className={`rounded-full py-2 text-sm transition-colors ${
              tab === kunci
                ? 'bg-navy-900 font-semibold text-putih shadow-sm'
                : 'text-teks-redup'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'kalender' ? (
        <KalenderPelanggan warungId={pelanggan.warung_id} pelangganId={pelanggan.id} />
      ) : null}

      {tab === 'link' ? (
        <Kartu>
          <KartuLinkPantau
            pelangganId={pelanggan.id}
            namaPelanggan={pelanggan.nama}
            token={pelanggan.token_pantau}
            pin={pelanggan.pin_pantau}
            terakhirDilihat={pelanggan.terakhir_dilihat_pelanggan}
          />
        </Kartu>
      ) : null}

      {tab === 'riwayat' ? (
        <>
      <section className="flex flex-col gap-2">
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
        </>
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
