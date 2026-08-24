import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { ArrowLeft, CalendarClock } from 'lucide-react';
import { Input, InputRupiah, Kartu, Tombol } from '@/komponen/ui';
import { KotakGalat } from '@/fitur/auth/LayoutAuth';
import { useSesi } from '@/fitur/auth/useSesi';
import { db, type BarisPelanggan } from '@/data/db';
import { catatUtang, tambahHari, tanggalHariIni, ubahUtang } from '@/data/repo/transaksi';
import { PemilihPelanggan } from './PemilihPelanggan';

export function FormUtang({ mode }: { mode: 'baru' | 'ubah' }) {
  const { id } = useParams<{ id: string }>();
  const [params] = useSearchParams();
  const warung = useSesi((s) => s.warung);
  const sesi = useSesi((s) => s.sesi);
  const navigate = useNavigate();

  const utang = useLiveQuery(
    async () => (mode === 'ubah' && id ? await db.transaksi_utang.get(id) : undefined),
    [id, mode],
  );

  // Pelanggan bisa datang dari ?pelanggan= (tombol "+ Utang" di halaman
  // detail) atau dari transaksi yang sedang diubah.
  const idPelangganAwal = params.get('pelanggan') ?? utang?.pelanggan_id ?? null;
  const pelangganAwal = useLiveQuery(
    async () => (idPelangganAwal ? await db.pelanggan.get(idPelangganAwal) : undefined),
    [idPelangganAwal],
  );

  const [pelanggan, setPelanggan] = useState<BarisPelanggan | null>(null);
  const [nominal, setNominal] = useState(0);
  const [keterangan, setKeterangan] = useState('');
  const [tanggal, setTanggal] = useState(tanggalHariIni());
  const [pakaiTempo, setPakaiTempo] = useState(false);
  const [jatuhTempo, setJatuhTempo] = useState('');
  const [galat, setGalat] = useState<string | null>(null);
  const [sedangSimpan, setSedangSimpan] = useState(false);

  // Dua efek terpisah, masing-masing menunggu datanya sendiri tiba dari
  // Dexie. Digabung jadi satu, penanda "sudah diisi" bisa menyala saat
  // transaksi sudah ada tapi baris pelanggannya belum — dan nama pelanggan
  // tidak akan pernah terisi.
  const pelangganDiisi = useRef(false);
  useEffect(() => {
    if (pelangganDiisi.current || !pelangganAwal) return;
    pelangganDiisi.current = true;
    setPelanggan(pelangganAwal);
  }, [pelangganAwal]);

  const isianDiisi = useRef(false);
  useEffect(() => {
    if (mode !== 'ubah' || !utang || isianDiisi.current) return;
    isianDiisi.current = true;
    setNominal(Math.round(utang.nominal));
    setKeterangan(utang.keterangan ?? '');
    setTanggal(utang.tanggal);
    setPakaiTempo(utang.jatuh_tempo !== null);
    setJatuhTempo(utang.jatuh_tempo ?? '');
  }, [mode, utang]);

  /** Menyalakan tempo memakai tempo bawaan warung sebagai titik mulai. */
  function ubahPakaiTempo(aktif: boolean) {
    setPakaiTempo(aktif);
    if (aktif && jatuhTempo === '') {
      setJatuhTempo(tambahHari(tanggal, warung?.tempo_default_hari || 7));
    }
  }

  async function kirim(e: FormEvent) {
    e.preventDefault();
    setGalat(null);

    if (!warung) return;
    if (!pelanggan) {
      setGalat('Pilih dulu pelanggannya.');
      return;
    }
    if (nominal <= 0) {
      setGalat('Nominal utang harus lebih dari nol.');
      return;
    }
    if (pakaiTempo && jatuhTempo !== '' && jatuhTempo < tanggal) {
      setGalat('Jatuh tempo tidak boleh lebih awal dari tanggal utang.');
      return;
    }

    setSedangSimpan(true);
    try {
      const tempo = pakaiTempo && jatuhTempo !== '' ? jatuhTempo : null;

      if (mode === 'ubah' && id) {
        await ubahUtang(id, {
          nominal,
          keterangan: keterangan.trim() || null,
          tanggal,
          jatuh_tempo: tempo,
        });
        navigate(`/utang/${id}`, { replace: true });
      } else {
        const baru = await catatUtang({
          warung_id: warung.id,
          pelanggan_id: pelanggan.id,
          nominal,
          keterangan,
          tanggal,
          jatuh_tempo: tempo,
          reminder_hari_sebelum: 3,
          dibuat_oleh: sesi?.user.id ?? null,
        });
        navigate(`/utang/${baru.id}`, { replace: true });
      }
    } catch (err) {
      setGalat(err instanceof Error ? err.message : 'Gagal menyimpan utang.');
    } finally {
      setSedangSimpan(false);
    }
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
        <h1 className="text-lg font-semibold">
          {mode === 'baru' ? 'Catat Utang' : 'Ubah Utang'}
        </h1>
      </div>

      <Kartu>
        <form onSubmit={kirim} className="flex flex-col gap-4" noValidate>
          <KotakGalat pesan={galat} />

          {warung ? (
            mode === 'ubah' ? (
              <div className="flex flex-col gap-1.5">
                <span className="text-sm text-teks-redup">Pelanggan</span>
                <p className="rounded-[var(--radius-kontrol)] bg-permukaan-2 px-3 py-2.5 text-sm">
                  {pelanggan?.nama ?? '—'}
                </p>
                <p className="text-xs text-teks-samar">
                  Pelanggan tidak bisa dipindah. Hapus utang ini lalu catat ulang
                  kalau salah orang.
                </p>
              </div>
            ) : (
              <PemilihPelanggan
                warungId={warung.id}
                terpilih={pelanggan}
                onPilih={setPelanggan}
              />
            )
          ) : null}

          <InputRupiah
            label="Nominal utang"
            nilai={nominal}
            onChange={setNominal}
            pintasan={[5000, 10_000, 20_000, 50_000]}
            autoFocus={mode === 'baru'}
          />

          <Input
            label="Keterangan"
            value={keterangan}
            onChange={(e) => setKeterangan(e.target.value)}
            placeholder="mis. nasi + es teh"
            bantuan="Opsional, tapi sangat membantu saat menagih."
          />

          <Input
            label="Tanggal"
            type="date"
            value={tanggal}
            onChange={(e) => setTanggal(e.target.value)}
            max={tanggalHariIni()}
          />

          <div className="flex flex-col gap-2">
            <label className="flex items-center gap-2.5 text-sm text-teks-redup">
              <input
                type="checkbox"
                checked={pakaiTempo}
                onChange={(e) => ubahPakaiTempo(e.target.checked)}
                className="size-4 accent-merah-600"
              />
              <CalendarClock size={16} aria-hidden />
              Pakai jatuh tempo
            </label>
            {pakaiTempo ? (
              <Input
                aria-label="Tanggal jatuh tempo"
                type="date"
                value={jatuhTempo}
                min={tanggal}
                onChange={(e) => setJatuhTempo(e.target.value)}
                bantuan="Pengingat muncul 3 hari sebelum tanggal ini."
              />
            ) : (
              <p className="text-xs text-teks-samar">
                Tanpa tempo, utang ini tetap muncul di daftar tagihan sebagai
                utang terlama.
              </p>
            )}
          </div>

          <Tombol type="submit" varian="utama" ukuran="besar" penuh disabled={sedangSimpan}>
            {sedangSimpan ? 'Menyimpan…' : 'Simpan'}
          </Tombol>
        </form>
      </Kartu>
    </div>
  );
}
