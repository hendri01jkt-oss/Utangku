import { useEffect, useRef, useState, type FormEvent } from 'react';
import { RefreshCw, RotateCcw } from 'lucide-react';
import { Input, Kartu, Tombol } from '@/komponen/ui';
import { KotakGalat, KotakInfo } from '@/fitur/auth/LayoutAuth';
import { useSesi } from '@/fitur/auth/useSesi';
import { ubahWarung } from '@/data/repo/warung';
import { sinkronSekarang } from '@/data/sync/mesin';
import { contohPesan, TEMPLATE_BAWAAN } from '@/fitur/tagihan/pesanTagihan';

const variabel = [
  { kunci: '{nama}', arti: 'nama pelanggan' },
  { kunci: '{warung}', arti: 'nama warung Anda' },
  { kunci: '{sisa}', arti: 'total sisa utang' },
  { kunci: '{rincian}', arti: 'daftar utangnya' },
  { kunci: '{jatuh_tempo}', arti: 'tempo terdekat' },
];

export function HalamanPengaturan() {
  const warung = useSesi((s) => s.warung);
  const setWarung = useSesi((s) => s.setWarung);
  const keluar = useSesi((s) => s.keluar);

  const [namaWarung, setNamaWarung] = useState('');
  const [noWa, setNoWa] = useState('');
  const [tempo, setTempo] = useState('0');
  const [template, setTemplate] = useState('');
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
      <h1 className="text-lg font-semibold">Pengaturan</h1>

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

          <div className="flex flex-col gap-1.5">
            <label htmlFor="template" className="text-sm text-teks-redup">
              Template pesan tagihan
            </label>
            <textarea
              id="template"
              value={template}
              onChange={(e) => setTemplate(e.target.value)}
              rows={9}
              className="rounded-[var(--radius-kontrol)] border border-garis bg-putih px-3 py-2.5 text-sm text-teks-utama outline-none transition-colors focus:border-merah-600"
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

      <Kartu className="flex flex-col gap-3">
        <p className="text-sm font-medium">Sinkronisasi</p>
        <Tombol
          varian="sekunder"
          ikon={<RefreshCw size={16} />}
          onClick={() => void sinkronSekarang('manual-pengaturan')}
          penuh
        >
          Sinkronkan sekarang
        </Tombol>
        <p className="text-xs text-teks-samar">
          Perubahan tersimpan di HP lebih dulu dan terkirim sendiri saat ada
          sinyal. Tombol ini hanya untuk memaksa lebih cepat.
        </p>
      </Kartu>

      <Tombol varian="bahaya" onClick={() => void keluar()} penuh>
        Keluar dari akun
      </Tombol>
    </div>
  );
}
