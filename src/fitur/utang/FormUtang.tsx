import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { ArrowLeft, CalendarClock, ListPlus } from 'lucide-react';
import { Input, InputRupiah, Kartu, Tombol } from '@/komponen/ui';
import { KotakGalat } from '@/fitur/auth/LayoutAuth';
import { useSesi } from '@/fitur/auth/useSesi';
import { db, type BarisPelanggan } from '@/data/db';
import {
  catatUtang,
  gantiItemTransaksi,
  tambahHari,
  tanggalHariIni,
  ubahUtang,
} from '@/data/repo/transaksi';
import {
  itemKosong,
  itemTerisi,
  itemTransaksi,
  totalItem,
  type ItemBaru,
} from '@/data/repo/item';
import { EditorItem } from '@/fitur/item/EditorItem';
import { formatRupiah } from '@/lib/uang';
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
  // Bawaannya tetap teks bebas. Rincian item adalah pilihan, bukan jalur
  // yang harus dilewati setiap kali mencatat utang sambil melayani pembeli.
  const [pakaiItem, setPakaiItem] = useState(false);
  const [item, setItem] = useState<ItemBaru[]>([itemKosong()]);
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

  const itemAwal = useLiveQuery(
    async () => (mode === 'ubah' && id ? await itemTransaksi(id) : undefined),
    [id, mode],
  );

  const itemDiisi = useRef(false);
  useEffect(() => {
    if (mode !== 'ubah' || !itemAwal?.length || itemDiisi.current) return;
    itemDiisi.current = true;
    setPakaiItem(true);
    setItem(
      itemAwal.map((i) => ({
        nama_item: i.nama_item,
        qty: i.qty,
        harga_satuan: Math.round(i.harga_satuan),
      })),
    );
  }, [mode, itemAwal]);

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
    const daftarItem = pakaiItem ? itemTerisi(item) : [];
    if (pakaiItem && daftarItem.length === 0) {
      setGalat('Isi minimal satu item, atau matikan rincian item.');
      return;
    }

    // Saat rincian dipakai, nominalnya diturunkan dari item — jadi yang
    // diperiksa juga totalnya, bukan isian nominal yang sedang terkunci.
    const nilaiAkhir = pakaiItem ? totalItem(daftarItem) : nominal;
    if (nilaiAkhir <= 0) {
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
          nominal: nilaiAkhir,
          keterangan: keterangan.trim() || null,
          tanggal,
          jatuh_tempo: tempo,
        });
        // Selalu dipanggil, termasuk saat rincian dimatikan: itulah yang
        // menghapus baris item lama supaya tidak menggantung di transaksi
        // yang sekarang memakai keterangan teks bebas.
        await gantiItemTransaksi(id, daftarItem);
        navigate(`/utang/${id}`, { replace: true });
      } else {
        const baru = await catatUtang({
          warung_id: warung.id,
          pelanggan_id: pelanggan.id,
          nominal: nilaiAkhir,
          keterangan,
          tanggal,
          jatuh_tempo: tempo,
          reminder_hari_sebelum: 3,
          dibuat_oleh: sesi?.user.id ?? null,
          item: daftarItem,
        });
        navigate(`/utang/${baru.id}`, { replace: true, state: { baruDicatat: true } });
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

          {pakaiItem ? (
            <div className="flex flex-col gap-1.5">
              <span className="text-sm text-teks-redup">Nominal utang</span>
              <p className="angka rounded-[var(--radius-kontrol)] bg-permukaan-2 px-3 py-2.5 text-lg font-semibold">
                {formatRupiah(totalItem(itemTerisi(item)))}
              </p>
              <p className="text-xs text-teks-samar">
                Dihitung otomatis dari rincian item di bawah.
              </p>
            </div>
          ) : (
            <InputRupiah
              label="Nominal utang"
              nilai={nominal}
              onChange={setNominal}
              pintasan={[5000, 10_000, 20_000, 50_000]}
              autoFocus={mode === 'baru'}
            />
          )}

          {pakaiItem ? (
            <EditorItem item={item} onUbah={setItem} />
          ) : (
            <Input
              label="Keterangan"
              value={keterangan}
              onChange={(e) => setKeterangan(e.target.value)}
              placeholder="mis. nasi + es teh"
              bantuan="Opsional, tapi sangat membantu saat menagih."
            />
          )}

          <button
            type="button"
            onClick={() => setPakaiItem(!pakaiItem)}
            className="flex min-h-11 items-center gap-1.5 self-start text-sm text-merah-600 underline underline-offset-4"
          >
            <ListPlus size={16} aria-hidden />
            {pakaiItem ? 'Pakai keterangan biasa saja' : 'Tambah rincian item'}
          </button>

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
