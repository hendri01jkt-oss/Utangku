import { useEffect, useRef, useState, type FormEvent } from 'react';
import { RotateCcw } from 'lucide-react';
import { Input, Kartu, Tombol } from '@/komponen/ui';
import { KotakGalat, KotakInfo } from '@/fitur/auth/LayoutAuth';
import { useSesi } from '@/fitur/auth/useSesi';
import { ubahWarung } from '@/data/repo/warung';
import { contohPesan, TEMPLATE_BAWAAN } from '@/fitur/tagihan/pesanTagihan';
import { useKeluar } from '@/fitur/auth/useKeluar';
import { KartuSinkron } from './KartuSinkron';
import { lebarKertasSah, UKURAN_KERTAS, type LebarKertas } from '@/fitur/struk/barisStruk';
import { cn } from '@/lib/cn';

const variabel = [
  { kunci: '{nama}', arti: 'nama pelanggan' },
  { kunci: '{warung}', arti: 'nama warung Anda' },
  { kunci: '{sisa}', arti: 'total sisa utang' },
  { kunci: '{rincian}', arti: 'daftar utangnya' },
  { kunci: '{jatuh_tempo}', arti: 'tempo terdekat' },
];

export function HalamanAkun() {
  const warung = useSesi((s) => s.warung);
  const setWarung = useSesi((s) => s.setWarung);
  const { mintaKeluar, dialogKeluar } = useKeluar();

  const [namaWarung, setNamaWarung] = useState('');
  const [noWa, setNoWa] = useState('');
  const [tempo, setTempo] = useState('0');
  const [template, setTemplate] = useState('');
  const [lebarStruk, setLebarStruk] = useState<LebarKertas>(58);
  const [galat, setGalat] = useState<string | null>(null);
  const [tersimpan, setTersimpan] = useState(false);
  const [sedangSimpan, setSedangSimpan] = useState(false);

  const sudahDiisi = useRef(false);
  useEffect(() => {
    if (sudahDiisi.current || !warung) return;
    sudahDiisi.current = true;
    setNamaWarung(warung.nama_warung);
    setNoWa(warung.no_wa_warung ?? '');
    setTempo(String(warung.tempo_default_hari));
    setTemplate(warung.template_pesan_tagihan || TEMPLATE_BAWAAN);
    setLebarStruk(lebarKertasSah(warung.lebar_struk));
  }, [warung]);

  async function simpan(e: FormEvent) {
    e.preventDefault();
    setGalat(null);
    setTersimpan(false);

    if (!warung) return;
    if (namaWarung.trim() === '') {
      setGalat('Nama warung wajib diisi.');
      return;
    }

    setSedangSimpan(true);
    try {
      const baru = await ubahWarung(warung.id, {
        nama_warung: namaWarung.trim(),
        no_wa_warung: noWa.trim() || null,
        tempo_default_hari: Number(tempo) || 0,
        template_pesan_tagihan: template.trim() || TEMPLATE_BAWAAN,
        lebar_struk: lebarStruk,
      });
      // Header dan pesan tagihan ikut memakai data ini, jadi sesi diperbarui
      // sekarang juga tanpa menunggu penarikan data berikutnya.
      setWarung(baru);
      setTersimpan(true);
    } catch (err) {
      setGalat(err instanceof Error ? err.message : 'Gagal menyimpan pengaturan.');
    } finally {
      setSedangSimpan(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-lg font-semibold">Akun</h1>

      {/*
        Status sinkron paling atas: inilah pertanyaan yang paling sering
        dibawa pemilik warung ke halaman ini — "catatan saya sudah aman
        belum?" — dan sejak ikonnya hilang dari header, halaman ini satu-
        satunya tempat jawabannya.
      */}
      <KartuSinkron />

      <Kartu>
        <form onSubmit={simpan} className="flex flex-col gap-4" noValidate>
          <KotakGalat pesan={galat} />
          {tersimpan ? <KotakInfo pesan="Pengaturan tersimpan." /> : null}

          <Input
            label="Nama warung"
            required
            value={namaWarung}
            onChange={(e) => setNamaWarung(e.target.value)}
          />
          <Input
            label="Nomor WhatsApp warung"
            type="tel"
            inputMode="tel"
            value={noWa}
            onChange={(e) => setNoWa(e.target.value)}
            placeholder="08xxxxxxxxxx"
          />
          <Input
            label="Tempo bayar bawaan (hari)"
            type="number"
            inputMode="numeric"
            min={0}
            value={tempo}
            onChange={(e) => setTempo(e.target.value)}
            bantuan="Isi 0 kalau warung Anda tidak memberi tempo."
          />

          <fieldset className="flex flex-col gap-1.5">
            <legend className="text-sm text-teks-redup">Lebar kertas struk</legend>
            <div className="flex gap-2">
              {([58, 80] as const).map((mm) => (
                <label
                  key={mm}
                  className={cn(
                    'flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-[var(--radius-kontrol)] border px-3 py-2.5 text-sm transition-colors',
                    lebarStruk === mm
                      ? 'border-emas-600 bg-[var(--tint-emas)] font-semibold text-teks-utama'
                      : 'border-garis bg-putih text-teks-redup hover:bg-permukaan-2',
                  )}
                >
                  <input
                    type="radio"
                    name="lebar-struk"
                    value={mm}
                    checked={lebarStruk === mm}
                    onChange={() => setLebarStruk(mm)}
                    className="sr-only"
                  />
                  {mm} mm
                </label>
              ))}
            </div>
            <p className="text-xs text-teks-samar">
              58 mm adalah ukuran paling umum untuk warung. Gambar struk dibuat
              selebar {UKURAN_KERTAS[lebarStruk].titik} titik supaya tidak
              diskalakan ulang saat dicetak.
            </p>
          </fieldset>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="template" className="text-sm text-teks-redup">
              Template pesan tagihan
            </label>
            <textarea
              id="template"
              value={template}
              onChange={(e) => setTemplate(e.target.value)}
              rows={9}
              className="rounded-[var(--radius-kontrol)] border border-garis bg-putih px-3 py-2.5 text-sm text-teks-utama outline-none transition-colors focus:border-emas-600"
            />
            <div className="flex flex-wrap gap-1.5 pt-1">
              {variabel.map((v) => (
                <button
                  key={v.kunci}
                  type="button"
                  onClick={() => setTemplate((t) => `${t}${v.kunci}`)}
                  title={`Sisipkan ${v.arti}`}
                  className="angka rounded-full border border-garis bg-putih px-2.5 py-1 text-xs text-teks-redup transition-colors hover:bg-permukaan-2"
                >
                  {v.kunci}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setTemplate(TEMPLATE_BAWAAN)}
              className="mt-1 flex items-center gap-1.5 self-start text-xs text-teks-samar underline underline-offset-4"
            >
              <RotateCcw size={12} aria-hidden />
              Kembalikan ke template bawaan
            </button>
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-sm text-teks-redup">Pratinjau</span>
            <pre className="whitespace-pre-wrap rounded-[var(--radius-kontrol)] bg-permukaan-2 p-3 text-sm text-teks-utama">
              {contohPesan(template || TEMPLATE_BAWAAN, namaWarung || 'Warung Anda')}
            </pre>
          </div>

          <Tombol type="submit" varian="utama" ukuran="besar" penuh disabled={sedangSimpan}>
            {sedangSimpan ? 'Menyimpan…' : 'Simpan pengaturan'}
          </Tombol>
        </form>
      </Kartu>

      {/*
        Keluar tetap lewat useKeluar() yang sama: kalau masih ada catatan di
        antrean, pemiliknya diberi tahu persis berapa yang akan hilang dan
        bisa membatalkan. Pengaman itu justru lebih penting sekarang —
        tombolnya pindah ke halaman yang jauh lebih sering dibuka daripada
        ikon kecil di pojok header.
      */}
      <Tombol varian="bahaya" onClick={() => void mintaKeluar()} penuh>
        Keluar dari akun
      </Tombol>
      <p className="text-center text-xs text-teks-samar">
        Keluar mengosongkan catatan di HP ini.
      </p>
      {dialogKeluar}
    </div>
  );
}
