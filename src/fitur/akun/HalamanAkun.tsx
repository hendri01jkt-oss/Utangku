import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { ChevronDown, RotateCcw } from 'lucide-react';
import { Input, Kartu, Tombol } from '@/komponen/ui';
import { KotakGalat, KotakInfo } from '@/fitur/auth/LayoutAuth';
import { useSesi } from '@/fitur/auth/useSesi';
import { ubahWarung } from '@/data/repo/warung';
import { contohPesan, TEMPLATE_BAWAAN, templateAktif } from '@/fitur/tagihan/pesanTagihan';
import { useKeluar } from '@/fitur/auth/useKeluar';
import { KartuSinkron } from './KartuSinkron';
import { ResetData } from './ResetData';
import { KartuLangganan } from './KartuLangganan';

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
    setTemplate(templateAktif(warung.template_pesan_tagihan));
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

  const email = useSesi((s) => s.sesi?.user.email) ?? '';
  const inisial = (warung?.nama_warung ?? 'U').trim().charAt(0).toUpperCase() || 'U';

  return (
    <div className="flex flex-col gap-5">
      {/* Kepala profil: senada dengan kartu pelanggan dan catatan utang. */}
      <section
        className="overflow-hidden rounded-[var(--radius-kartu)] border-b-4 border-emas-500 px-4 py-5 text-white shadow-sm"
        style={{ background: 'linear-gradient(160deg,#16275a 0%,#0f1b3d 60%,#0a1330 100%)' }}
      >
        <div className="flex items-center gap-3.5">
          <span
            className="flex size-14 shrink-0 items-center justify-center rounded-full text-2xl font-bold text-[#0f1b3d]"
            style={{ background: 'linear-gradient(135deg,#f6e6a8,#c9a84c)' }}
            aria-hidden
          >
            {inisial}
          </span>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold tracking-widest text-[#f6e6a8]">AKUN</p>
            <p className="truncate text-xl font-bold leading-tight">
              {warung?.nama_warung ?? 'Warung'}
            </p>
            {email ? <p className="truncate text-sm text-white/70">{email}</p> : null}
          </div>
        </div>
      </section>

      <KartuLangganan />

      <BagianAkun judul="Pengaturan warung">
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

            {/* Template panjang disembunyikan; jarang diubah dan membuat halaman menumpuk. */}
            <details className="group rounded-[var(--radius-kontrol)] border border-garis">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-3 text-sm font-medium">
                Pesan tagihan WhatsApp
                <ChevronDown
                  size={16}
                  aria-hidden
                  className="text-teks-samar transition-transform group-open:rotate-180"
                />
              </summary>
              <div className="flex flex-col gap-1.5 border-t border-garis p-3">
                <textarea
                  id="template"
                  aria-label="Template pesan tagihan"
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
                <span className="mt-2 text-xs font-semibold text-teks-redup">Pratinjau</span>
                <pre className="whitespace-pre-wrap rounded-[var(--radius-kontrol)] bg-permukaan-2 p-3 text-sm text-teks-utama">
                  {contohPesan(template || TEMPLATE_BAWAAN, namaWarung || 'Warung Anda')}
                </pre>
              </div>
            </details>

            <Tombol type="submit" varian="utama" ukuran="besar" penuh disabled={sedangSimpan}>
              {sedangSimpan ? 'Menyimpan…' : 'Simpan pengaturan'}
            </Tombol>
          </form>
        </Kartu>
      </BagianAkun>

      <BagianAkun judul="Sinkronisasi">
        <KartuSinkron />
      </BagianAkun>

      <BagianAkun judul="Zona berbahaya">
        <Kartu className="flex flex-col gap-3">
          <ResetData />
          <p className="text-xs text-teks-samar">
            Menghapus pelanggan, utang, dan pembayaran di HP ini dan di server. Akun tetap ada.
          </p>
        </Kartu>
        <Tombol varian="sekunder" onClick={() => void mintaKeluar()} penuh>
          Keluar dari akun
        </Tombol>
        <p className="text-center text-xs text-teks-samar">
          Keluar mengosongkan catatan di HP ini.
        </p>
      </BagianAkun>
      {dialogKeluar}
    </div>
  );
}

function BagianAkun({ judul, children }: { judul: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2.5">
      <h2 className="px-1 text-[11px] font-semibold tracking-widest text-teks-samar uppercase">
        {judul}
      </h2>
      {children}
    </section>
  );
}
