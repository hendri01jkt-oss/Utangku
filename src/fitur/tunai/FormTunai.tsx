import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ListPlus } from 'lucide-react';
import { Input, InputRupiah, Kartu, Tombol } from '@/komponen/ui';
import { KotakGalat } from '@/fitur/auth/LayoutAuth';
import { useSesi } from '@/fitur/auth/useSesi';
import type { BarisPelanggan } from '@/data/db';
import { catatTunai, tanggalHariIni } from '@/data/repo/transaksi';
import { itemKosong, itemTerisi, totalItem, type ItemBaru } from '@/data/repo/item';
import { EditorItem } from '@/fitur/item/EditorItem';
import { PemilihPelanggan } from '@/fitur/utang/PemilihPelanggan';
import { formatRupiah } from '@/lib/uang';

/**
 * Catat penjualan tunai — uangnya diterima di tempat, jadi ini bukan utang.
 *
 * Bentuknya sengaja mirip Catat Utang supaya tidak perlu dipelajari ulang,
 * tapi dua hal dihilangkan: pelanggan tidak wajib (pembeli lewat memang
 * tidak perlu dicatat namanya), dan tidak ada jatuh tempo sama sekali —
 * tidak ada yang perlu ditagih.
 */
export function FormTunai() {
  const warung = useSesi((s) => s.warung);
  const sesi = useSesi((s) => s.sesi);
  const navigate = useNavigate();

  const [pelanggan, setPelanggan] = useState<BarisPelanggan | null>(null);
  const [nominal, setNominal] = useState(0);
  const [keterangan, setKeterangan] = useState('');
  const [tanggal, setTanggal] = useState(tanggalHariIni());
  const [pakaiItem, setPakaiItem] = useState(false);
  const [item, setItem] = useState<ItemBaru[]>([itemKosong()]);
  const [galat, setGalat] = useState<string | null>(null);
  const [sedangSimpan, setSedangSimpan] = useState(false);

  async function kirim(e: FormEvent) {
    e.preventDefault();
    setGalat(null);
    if (!warung) return;

    const daftarItem = pakaiItem ? itemTerisi(item) : [];
    if (pakaiItem && daftarItem.length === 0) {
      setGalat('Isi minimal satu item, atau matikan rincian item.');
      return;
    }

    const nilaiAkhir = pakaiItem ? totalItem(daftarItem) : nominal;
    if (nilaiAkhir <= 0) {
      setGalat('Nominal penjualan harus lebih dari nol.');
      return;
    }

    setSedangSimpan(true);
    try {
      const baru = await catatTunai({
        warung_id: warung.id,
        pelanggan_id: pelanggan?.id ?? null,
        nominal: nilaiAkhir,
        keterangan,
        tanggal,
        dibuat_oleh: sesi?.user.id ?? null,
        item: daftarItem,
      });
      // Struk langsung dibuka: penjualan tunai terjadi saat pembeli masih
      // berdiri di depan warung, dan justru di situlah struknya berguna.
      navigate(`/utang/${baru.id}`, { replace: true, state: { baruDicatat: true } });
    } catch (err) {
      setGalat(err instanceof Error ? err.message : 'Gagal menyimpan penjualan.');
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
        <h1 className="text-lg font-semibold">Catat Penjualan Tunai</h1>
      </div>

      <Kartu>
        <form onSubmit={kirim} className="flex flex-col gap-4" noValidate>
          <KotakGalat pesan={galat} />

          <p className="rounded-[var(--radius-kontrol)] bg-[var(--tint-sukses)] p-3 text-sm text-teks-utama">
            Penjualan tunai langsung lunas. Tidak masuk total piutang, dan tidak
            akan muncul di daftar tagihan.
          </p>

          {pakaiItem ? (
            <div className="flex flex-col gap-1.5">
              <span className="text-sm text-teks-redup">Total penjualan</span>
              <p className="angka rounded-[var(--radius-kontrol)] bg-permukaan-2 px-3 py-2.5 text-lg font-semibold">
                {formatRupiah(totalItem(itemTerisi(item)))}
              </p>
              <p className="text-xs text-teks-samar">
                Dihitung otomatis dari rincian item di bawah.
              </p>
            </div>
          ) : (
            <InputRupiah
              label="Total penjualan"
              nilai={nominal}
              onChange={setNominal}
              pintasan={[5000, 10_000, 20_000, 50_000]}
              autoFocus
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
              bantuan="Opsional."
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

          {warung ? (
            <div className="flex flex-col gap-1.5">
              <PemilihPelanggan
                warungId={warung.id}
                terpilih={pelanggan}
                onPilih={setPelanggan}
              />
              <p className="text-xs text-teks-samar">
                Boleh dikosongkan untuk pembeli umum yang cuma lewat.
              </p>
            </div>
          ) : null}

          <Tombol type="submit" varian="utama" penuh disabled={sedangSimpan}>
            {sedangSimpan ? 'Menyimpan…' : 'Simpan Penjualan'}
          </Tombol>
        </form>
      </Kartu>
    </div>
  );
}
