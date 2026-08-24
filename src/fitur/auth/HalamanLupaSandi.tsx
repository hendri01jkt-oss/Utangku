import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { ambilSupabase } from '@/lib/supabase';
import { Input, Tombol } from '@/komponen/ui';
import { KotakGalat, KotakInfo, LayoutAuth } from './LayoutAuth';
import { pesanGalat } from './pesanGalat';

export function HalamanLupaSandi() {
  const [email, setEmail] = useState('');
  const [galat, setGalat] = useState<string | null>(null);
  const [terkirim, setTerkirim] = useState(false);
  const [sedangKirim, setSedangKirim] = useState(false);

  async function kirim(e: FormEvent) {
    e.preventDefault();
    setGalat(null);
    setSedangKirim(true);
    try {
      const { error } = await (await ambilSupabase()).auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/reset-sandi`,
      });
      if (error) throw error;
      setTerkirim(true);
    } catch (err) {
      setGalat(pesanGalat(err));
    } finally {
      setSedangKirim(false);
    }
  }

  return (
    <LayoutAuth
      judul="Lupa kata sandi"
      keterangan="Kami kirimkan tautan untuk membuat kata sandi baru."
      bawah={
        <Link to="/masuk" className="text-merah-600 underline underline-offset-4">
          Kembali ke halaman masuk
        </Link>
      }
    >
      <form onSubmit={kirim} className="flex flex-col gap-4" noValidate>
        <KotakGalat pesan={galat} />
        {terkirim ? (
          <KotakInfo pesan="Tautan sudah dikirim. Silakan periksa email Anda, termasuk folder spam." />
        ) : null}
        <Input
          label="Email"
          type="email"
          inputMode="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="nama@email.com"
        />
        <Tombol type="submit" varian="utama" ukuran="besar" penuh disabled={sedangKirim}>
          {sedangKirim ? 'Mengirim…' : 'Kirim tautan'}
        </Tombol>
      </form>
    </LayoutAuth>
  );
}
