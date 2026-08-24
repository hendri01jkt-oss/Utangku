import { useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Input, Tombol } from '@/komponen/ui';
import { KotakGalat, LayoutAuth } from './LayoutAuth';
import { pesanGalat } from './pesanGalat';

export function HalamanMasuk() {
  const [email, setEmail] = useState('');
  const [sandi, setSandi] = useState('');
  const [galat, setGalat] = useState<string | null>(null);
  const [sedangKirim, setSedangKirim] = useState(false);
  const navigate = useNavigate();
  const lokasi = useLocation();

  async function kirim(e: FormEvent) {
    e.preventDefault();
    setGalat(null);
    setSedangKirim(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: sandi,
      });
      if (error) throw error;
      // Ke mana pengguna diarahkan ditentukan penjaga rute berdasarkan
      // apakah warungnya sudah ada; di sini cukup kembali ke akar.
      const tujuan = (lokasi.state as { dari?: string } | null)?.dari ?? '/';
      navigate(tujuan, { replace: true });
    } catch (err) {
      setGalat(pesanGalat(err));
    } finally {
      setSedangKirim(false);
    }
  }

  return (
    <LayoutAuth
      judul="Masuk"
      keterangan="Masuk untuk melihat catatan utang warung Anda."
      bawah={
        <>
          Belum punya akun?{' '}
          <Link to="/daftar" className="text-merah-600 underline underline-offset-4">
            Daftar
          </Link>
        </>
      }
    >
      <form onSubmit={kirim} className="flex flex-col gap-4" noValidate>
        <KotakGalat pesan={galat} />
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
        <Input
          label="Kata sandi"
          type="password"
          autoComplete="current-password"
          required
          value={sandi}
          onChange={(e) => setSandi(e.target.value)}
          placeholder="••••••••"
        />
        <Tombol
          type="submit"
          varian="utama"
          ukuran="besar"
          penuh
          disabled={sedangKirim}
        >
          {sedangKirim ? 'Sedang masuk…' : 'Masuk'}
        </Tombol>
        <Link
          to="/lupa-sandi"
          className="text-center text-sm text-teks-redup underline underline-offset-4"
        >
          Lupa kata sandi?
        </Link>
      </form>
    </LayoutAuth>
  );
}
