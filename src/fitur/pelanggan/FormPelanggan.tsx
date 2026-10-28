import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { ArrowLeft, Camera, ImagePlus, Trash2 } from 'lucide-react';
import { Input, Kartu, Tombol } from '@/komponen/ui';
import { KotakGalat } from '@/fitur/auth/LayoutAuth';
import { useSesi } from '@/fitur/auth/useSesi';
import { db } from '@/data/db';
import { buatPelanggan, hapusPelanggan, ubahPelanggan } from '@/data/repo/pelanggan';
import { hapusFotoLokal, jalurFoto, simpanFotoLokal } from '@/data/repo/foto';
import { FotoPelanggan } from './FotoPelanggan';

export function FormPelanggan({ mode }: { mode: 'baru' | 'ubah' }) {
  const { id } = useParams<{ id: string }>();
  const warung = useSesi((s) => s.warung);
  const navigate = useNavigate();

  const pelanggan = useLiveQuery(
    async () => (mode === 'ubah' && id ? await db.pelanggan.get(id) : undefined),
    [id, mode],
  );

  const [nama, setNama] = useState('');
  const [noWa, setNoWa] = useState('');
  const [alamat, setAlamat] = useState('');
  const [catatan, setCatatan] = useState('');
  const [galat, setGalat] = useState<string | null>(null);
  const [sedangSimpan, setSedangSimpan] = useState(false);
  const [fotoBaru, setFotoBaru] = useState<Blob | null>(null);
  const [fotoDihapus, setFotoDihapus] = useState(false);
  const berkasRef = useRef<HTMLInputElement>(null);
  const galeriRef = useRef<HTMLInputElement>(null);

  // Isi formulir sekali begitu data pelanggan tersedia dari Dexie.
  const sudahDiisi = useRef(false);
  useEffect(() => {
    if (mode !== 'ubah' || !pelanggan || sudahDiisi.current) return;
    sudahDiisi.current = true;
    setNama(pelanggan.nama);
    setNoWa(pelanggan.no_wa ?? '');
    setAlamat(pelanggan.alamat ?? '');
    setCatatan(pelanggan.catatan ?? '');
  }, [mode, pelanggan]);

  async function pilihFoto(e: React.ChangeEvent<HTMLInputElement>) {
    const berkas = e.target.files?.[0];
    if (!berkas) return;
    setGalat(null);
    try {
      // Diperkecil sekarang juga supaya pratinjaunya sama persis dengan
      // yang nanti tersimpan dan terunggah.
      const { perkecilGambar } = await import('@/lib/gambar');
      setFotoBaru(await perkecilGambar(berkas));
      setFotoDihapus(false);
    } catch (err) {
      setGalat(err instanceof Error ? err.message : 'Foto tidak bisa dibaca.');
    } finally {
      e.target.value = '';
    }
  }

  async function kirim(e: FormEvent) {
    e.preventDefault();
    setGalat(null);
    if (nama.trim() === '') {
      setGalat('Nama pelanggan wajib diisi.');
      return;
    }
    if (!warung) return;

    setSedangSimpan(true);
    try {
      const adaFoto = fotoBaru !== null;
      const idPelanggan =
        mode === 'ubah' && id
          ? (
              await ubahPelanggan(id, {
                nama: nama.trim(),
                no_wa: noWa.trim() || null,
                alamat: alamat.trim() || null,
                catatan: catatan.trim() || null,
                foto_path: fotoDihapus
                  ? null
                  : adaFoto
                    ? jalurFoto(warung.id, id)
                    : (pelanggan?.foto_path ?? null),
              })
            ).id
          : (
              await buatPelanggan({
                warung_id: warung.id,
                nama,
                no_wa: noWa,
                alamat,
                catatan,
              })
            ).id;

      // Foto disimpan setelah barisnya ada, karena path-nya memuat id.
      if (adaFoto && fotoBaru) {
        await simpanFotoLokal(warung.id, idPelanggan, fotoBaru);
        if (mode === 'baru') {
          await ubahPelanggan(idPelanggan, { foto_path: jalurFoto(warung.id, idPelanggan) });
        }
      }
      if (fotoDihapus) await hapusFotoLokal(idPelanggan);

      navigate(`/pelanggan/${idPelanggan}`, { replace: true });
    } catch (err) {
      setGalat(err instanceof Error ? err.message : 'Gagal menyimpan pelanggan.');
    } finally {
      setSedangSimpan(false);
    }
  }

  async function hapus() {
    if (!id) return;
    if (!window.confirm('Hapus pelanggan ini? Riwayat utangnya ikut disembunyikan.')) return;
    await hapusPelanggan(id);
    navigate('/pelanggan', { replace: true });
  }

  const pratinjauUrl = fotoBaru ? URL.createObjectURL(fotoBaru) : null;

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
        <h1 className="text-lg font-semibold">
          {mode === 'baru' ? 'Tambah Pelanggan' : 'Ubah Pelanggan'}
        </h1>
      </div>

      <Kartu>
        <form onSubmit={kirim} className="flex flex-col gap-3" noValidate>
          <KotakGalat pesan={galat} />

          <div className="flex items-center gap-3">
            {pratinjauUrl ? (
              <img
                src={pratinjauUrl}
                alt="Pratinjau foto"
                width={48}
                height={48}
                className="size-12 shrink-0 rounded-full border border-garis object-cover"
              />
            ) : fotoDihapus || !id ? (
              <FotoPelanggan pelangganId="tidak-ada" nama={nama || '?'} ukuran={48} />
            ) : (
              <FotoPelanggan pelangganId={id} nama={nama || '?'} ukuran={48} />
            )}

            <div className="flex flex-col gap-1">
              <div className="flex gap-2">
                <Tombol
                  type="button"
                  varian="sekunder"
                  ikon={<Camera size={16} />}
                  onClick={() => berkasRef.current?.click()}
                >
                  Kamera
                </Tombol>
                <Tombol
                  type="button"
                  varian="sekunder"
                  ikon={<ImagePlus size={16} />}
                  onClick={() => galeriRef.current?.click()}
                >
                  Galeri
                </Tombol>
              </div>
              <p className="text-xs text-teks-samar">
                {fotoBaru ? 'Foto dipilih. ' : ''}Opsional. Diperkecil otomatis.
              </p>
            </div>

            {/* Kamera: capture membuat HP langsung membuka kamera. */}
            <input
              ref={berkasRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={(e) => void pilihFoto(e)}
              className="hidden"
              aria-hidden
              tabIndex={-1}
            />
            {/* Galeri: tanpa capture, HP menampilkan pemilih berkas/galeri. */}
            <input
              ref={galeriRef}
              type="file"
              accept="image/*"
              onChange={(e) => void pilihFoto(e)}
              className="hidden"
              aria-hidden
              tabIndex={-1}
            />
          </div>

          <Input
            label="Nama pelanggan"
            required
            autoFocus={mode === 'baru'}
            value={nama}
            onChange={(e) => setNama(e.target.value)}
            placeholder="mis. Bu Siti"
          />
          <Input
            label="Nomor WhatsApp (opsional)"
            type="tel"
            inputMode="tel"
            value={noWa}
            onChange={(e) => setNoWa(e.target.value)}
            placeholder="08xxxxxxxxxx"
          />
          <Input
            label="Alamat (opsional)"
            value={alamat}
            onChange={(e) => setAlamat(e.target.value)}
          />
          <Input
            label="Catatan (opsional)"
            value={catatan}
            onChange={(e) => setCatatan(e.target.value)}
            placeholder="mis. tetangga sebelah warung"
          />

          {/*
            Menempel tepat di atas navigasi bawah: di HP berlayar pendek
            tombol Simpan tidak pernah terpotong atau tertutup nav.
          */}
          <div
            className="sticky z-10 -mx-4 bg-putih px-4 pb-1 pt-2"
            style={{ bottom: 'calc(var(--tinggi-nav) + 0.5rem)' }}
          >
            <Tombol type="submit" varian="utama" ukuran="besar" penuh disabled={sedangSimpan}>
              {sedangSimpan ? 'Menyimpan…' : 'Simpan'}
            </Tombol>
          </div>
        </form>
      </Kartu>

      {mode === 'ubah' ? (
        <Tombol varian="bahaya" ikon={<Trash2 size={16} />} onClick={() => void hapus()} penuh>
          Hapus pelanggan
        </Tombol>
      ) : null}
    </div>
  );
}
