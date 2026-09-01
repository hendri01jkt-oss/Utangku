import { useState, type FormEvent } from 'react';
import { BottomSheet, Input, InputRupiah, Tombol } from '@/komponen/ui';
import { KotakGalat } from '@/fitur/auth/LayoutAuth';
import { catatPembayaran } from '@/data/repo/pembayaran';
import { sisaUtang, tanggalHariIni } from '@/data/repo/transaksi';
import { formatRupiah } from '@/lib/uang';
import type { BarisTransaksi } from '@/data/db';
import type { Enums } from '@/data/database.types';
import { cn } from '@/lib/cn';

const metodeTersedia: { nilai: Enums<'metode_bayar'>; label: string }[] = [
  { nilai: 'tunai', label: 'Tunai' },
  { nilai: 'transfer', label: 'Transfer' },
  { nilai: 'qris', label: 'QRIS' },
  { nilai: 'lainnya', label: 'Lainnya' },
];

export function FormPembayaran({
  utang,
  dibuatOleh,
  onSelesai,
  onTutup,
}: {
  utang: BarisTransaksi;
  dibuatOleh: string | null;
  onSelesai: () => void;
  onTutup: () => void;
}) {
  const sisa = sisaUtang(utang);
  const [nominal, setNominal] = useState(0);
  const [metode, setMetode] = useState<Enums<'metode_bayar'>>('tunai');
  const [tanggal, setTanggal] = useState(tanggalHariIni());
  const [catatan, setCatatan] = useState('');
  const [galat, setGalat] = useState<string | null>(null);
  const [sedangSimpan, setSedangSimpan] = useState(false);

  const kelebihan = Math.max(nominal - sisa, 0);

  async function kirim(e: FormEvent) {
    e.preventDefault();
    setGalat(null);

    if (nominal <= 0) {
      setGalat('Nominal pembayaran harus lebih dari nol.');
      return;
    }
    if (tanggal > tanggalHariIni()) {
      setGalat('Tanggal pembayaran tidak boleh di masa depan.');
      return;
    }

    setSedangSimpan(true);
    try {
      await catatPembayaran({
        warung_id: utang.warung_id,
        transaksi_id: utang.id,
        // Pembayaran hanya bisa dibuat untuk utang, dan batasan database
        // menjamin utang selalu punya pelanggan.
        pelanggan_id: utang.pelanggan_id ?? '',
        nominal,
        metode,
        tanggal,
        catatan,
        dibuat_oleh: dibuatOleh,
      });
      onSelesai();
    } catch (err) {
      setGalat(err instanceof Error ? err.message : 'Gagal menyimpan pembayaran.');
    } finally {
      setSedangSimpan(false);
    }
  }

  return (
    <BottomSheet judul="Terima Pembayaran" onTutup={onTutup}>
      <form onSubmit={kirim} className="flex flex-col gap-4" noValidate>
        <KotakGalat pesan={galat} />

        <div className="rounded-[var(--radius-kontrol)] bg-permukaan-2 p-3">
          <p className="text-xs text-teks-samar">Sisa utang</p>
          <p className="angka mt-0.5 text-xl font-semibold text-merah-600">
            {formatRupiah(sisa)}
          </p>
        </div>

        <InputRupiah
          label="Nominal dibayar"
          nilai={nominal}
          onChange={setNominal}
          pintasan={[5000, 10_000, 20_000, 50_000]}
          autoFocus
        />

        {/*
          Melunasi seluruh sisa adalah kasus paling sering di warung, jadi
          diberi satu tombol sendiri supaya tidak perlu mengetik angkanya.
        */}
        <Tombol
          type="button"
          varian="sekunder"
          onClick={() => setNominal(sisa)}
          disabled={sisa === 0 || nominal === sisa}
        >
          Lunasi semua — {formatRupiah(sisa)}
        </Tombol>

        {kelebihan > 0 ? (
          <p className="rounded-[var(--radius-kontrol)] bg-[var(--tint-peringatan)] px-3 py-2 text-xs text-peringatan">
            Nominal melebihi sisa utang sebesar {formatRupiah(kelebihan)}. Utang
            tetap akan tercatat lunas — pastikan kembaliannya sudah diberikan.
          </p>
        ) : null}

        <div className="flex flex-col gap-1.5">
          <span className="text-sm text-teks-redup">Metode</span>
          <div className="flex flex-wrap gap-2">
            {metodeTersedia.map((m) => (
              <button
                key={m.nilai}
                type="button"
                onClick={() => setMetode(m.nilai)}
                aria-pressed={metode === m.nilai}
                className={cn(
                  'min-h-9 rounded-full border px-3.5 text-sm transition-colors',
                  metode === m.nilai
                    ? 'border-merah-600 bg-merah-600 text-putih'
                    : 'border-garis bg-putih text-teks-redup hover:bg-permukaan-2',
                )}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>

        <Input
          label="Tanggal"
          type="date"
          value={tanggal}
          max={tanggalHariIni()}
          onChange={(e) => setTanggal(e.target.value)}
        />

        <Input
          label="Catatan"
          value={catatan}
          onChange={(e) => setCatatan(e.target.value)}
          placeholder="mis. dibayar lewat anaknya"
          bantuan="Opsional."
        />

        <Tombol type="submit" varian="utama" ukuran="besar" penuh disabled={sedangSimpan}>
          {sedangSimpan ? 'Menyimpan…' : 'Simpan pembayaran'}
        </Tombol>
      </form>
    </BottomSheet>
  );
}
