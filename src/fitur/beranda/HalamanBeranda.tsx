import { useState } from 'react';
import { Plus, Send, TrendingUp, Users, Wallet } from 'lucide-react';
import {
  Input,
  InputRupiah,
  Kartu,
  KartuStatistik,
  StatusBadge,
  Tombol,
} from '@/komponen/ui';
import { formatRupiah } from '@/lib/uang';

/**
 * Tahap 0: halaman ini masih pratinjau design system, memakai angka contoh.
 * Diganti dengan data asli dari Dexie di Tahap 7.
 */
export function HalamanBeranda() {
  const [nominal, setNominal] = useState(0);
  const [nama, setNama] = useState('');

  return (
    <div className="flex flex-col gap-6">
      <section aria-labelledby="judul-ringkasan" className="flex flex-col gap-3">
        <h1 id="judul-ringkasan" className="text-lg font-semibold">
          Beranda
        </h1>

        <KartuStatistik
          label="Total Piutang"
          nilai={formatRupiah(1_275_000)}
          ikon={<Wallet size={16} />}
          penting
        />

        <div className="grid grid-cols-2 gap-3">
          <KartuStatistik
            label="Pelanggan Berutang"
            nilai={<span className="angka">12</span>}
            ikon={<Users size={16} />}
          />
          <KartuStatistik
            label="Tertagih Bulan Ini"
            nilai={formatRupiah(430_000)}
            ikon={<TrendingUp size={16} />}
          />
        </div>

        <Tombol varian="utama" ukuran="besar" penuh ikon={<Plus size={18} />}>
          Catat Utang
        </Tombol>
      </section>

      <section aria-labelledby="judul-contoh" className="flex flex-col gap-3">
        <h2 id="judul-contoh" className="text-sm text-teks-samar">
          Pratinjau komponen — data asli menyusul di tahap berikutnya
        </h2>

        <Kartu className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="font-medium">Bu Siti</p>
              <p className="text-xs text-teks-samar">Jatuh tempo 3 hari lagi</p>
            </div>
            <p className="angka font-semibold text-gold-400">
              {formatRupiah(85_000)}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status="sebagian" />
            <StatusBadge status="lewat_tempo" />
            <StatusBadge status="lunas" />
            <StatusBadge status="belum_lunas" />
          </div>
          <Tombol varian="sekunder" ikon={<Send size={16} />} penuh>
            Tagih via WhatsApp
          </Tombol>
        </Kartu>

        <Kartu className="flex flex-col gap-4">
          <InputRupiah
            label="Nominal utang"
            nilai={nominal}
            onChange={setNominal}
            pintasan={[5000, 10_000, 20_000, 50_000]}
          />
          <Input
            label="Nama pelanggan"
            placeholder="mis. Bu Siti"
            value={nama}
            onChange={(e) => setNama(e.target.value)}
            bantuan="Hanya nama yang wajib diisi."
          />
          <div className="flex gap-2">
            <Tombol varian="halus">Batal</Tombol>
            <Tombol varian="bahaya">Hapus</Tombol>
            <Tombol varian="utama" className="ml-auto">
              Simpan
            </Tombol>
          </div>
        </Kartu>
      </section>
    </div>
  );
}
