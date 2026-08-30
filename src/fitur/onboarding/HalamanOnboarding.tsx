import { useState, type FormEvent } from 'react';
import { Store } from 'lucide-react';
import { ambilSupabase } from '@/lib/supabase';
import { Input, Tombol } from '@/komponen/ui';
import { KotakGalat, LayoutAuth } from '@/fitur/auth/LayoutAuth';
import { pesanGalat } from '@/fitur/auth/pesanGalat';
import { useSesi } from '@/fitur/auth/useSesi';
import { useKeluar } from '@/fitur/auth/useKeluar';

export function HalamanOnboarding() {
  const [nama, setNama] = useState('');
  const [noWa, setNoWa] = useState('');
  const [alamat, setAlamat] = useState('');
  const [tempo, setTempo] = useState('0');
  const [galat, setGalat] = useState<string | null>(null);
  const [sedangKirim, setSedangKirim] = useState(false);
  const setWarung = useSesi((s) => s.setWarung);
  const { mintaKeluar, dialogKeluar } = useKeluar();

  async function kirim(e: FormEvent) {
    e.preventDefault();
    setGalat(null);

    if (nama.trim() === '') {
      setGalat('Nama warung wajib diisi.');
      return;
    }

    setSedangKirim(true);
    try {
      // Satu RPC transaksional: warung + keanggotaan pemilik + baris
      // langganan dibuat sekaligus, sehingga tidak mungkin ada akun yang
      // berhasil dibuat tapi setengah jadi.
      const { data, error } = await (await ambilSupabase()).rpc('buat_warung', {
        p_nama_warung: nama.trim(),
        p_no_wa: noWa.trim() || undefined,
        p_alamat: alamat.trim() || undefined,
        p_tempo_default_hari: Number(tempo) || 0,
      });
      if (error) throw error;
      if (!data) throw new Error('Warung gagal dibuat. Coba lagi.');
      setWarung(data);
    } catch (err) {
      setGalat(pesanGalat(err));
    } finally {
      setSedangKirim(false);
    }
  }

  return (
    <LayoutAuth
      judul="Siapkan warung Anda"
      keterangan="Satu langkah terakhir. Semua ini bisa diubah nanti di Pengaturan."
      bawah={
        <button
          type="button"
          onClick={() => void mintaKeluar()}
          className="text-teks-samar underline underline-offset-4"
        >
          Keluar
        </button>
      }
    >
      <form onSubmit={kirim} className="flex flex-col gap-4" noValidate>
        <KotakGalat pesan={galat} />
        <div className="flex justify-center py-1">
          <Store size={36} className="text-merah-600" aria-hidden />
        </div>
        <Input
          label="Nama warung"
          required
          autoFocus
          value={nama}
          onChange={(e) => setNama(e.target.value)}
          placeholder="mis. Warteg Bahari"
        />
        <Input
          label="Nomor WhatsApp warung"
          type="tel"
          inputMode="tel"
          value={noWa}
          onChange={(e) => setNoWa(e.target.value)}
          placeholder="08xxxxxxxxxx"
          bantuan="Opsional. Dipakai sebagai identitas di pesan tagihan."
        />
        <Input
          label="Alamat"
          value={alamat}
          onChange={(e) => setAlamat(e.target.value)}
          placeholder="mis. Jl. Mawar No. 5"
          bantuan="Opsional."
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
        <Tombol type="submit" varian="utama" ukuran="besar" penuh disabled={sedangKirim}>
          {sedangKirim ? 'Menyiapkan…' : 'Mulai pakai UtangKu'}
        </Tombol>
      </form>
      {dialogKeluar}
    </LayoutAuth>
  );
}
