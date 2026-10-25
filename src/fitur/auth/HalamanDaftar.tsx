import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '@/lib/api';
import { useSesi } from './useSesi';
import { Input, Tombol } from '@/komponen/ui';
import { KotakGalat, LayoutAuth } from './LayoutAuth';
import { pesanGalat } from './pesanGalat';

const PANJANG_SANDI_MINIMAL = 8;

export function HalamanDaftar() {
  const [nama, setNama] = useState('');
  const [email, setEmail] = useState('');
  const [sandi, setSandi] = useState('');
  const [galat, setGalat] = useState<string | null>(null);
  const [sedangKirim, setSedangKirim] = useState(false);
  const navigate = useNavigate();

  async function kirim(e: FormEvent) {
    e.preventDefault();
    setGalat(null);

    if (sandi.length < PANJANG_SANDI_MINIMAL) {
      setGalat(`Kata sandi minimal ${PANJANG_SANDI_MINIMAL} karakter.`);
      return;
    }

    setSedangKirim(true);
    try {
      const { token, user } = await api<{ token: string; user: { id: string; email: string } }>(
        '/auth/daftar',
        {
          publik: true,
          json: { email: email.trim(), password: sandi, nama_lengkap: nama.trim() },
        },
      );
      await useSesi.getState().mulaiSesi(token, user);
      navigate('/onboarding', { replace: true });
    } catch (err) {
      setGalat(pesanGalat(err));
    } finally {
      setSedangKirim(false);
    }
  }

  return (
    <LayoutAuth
      judul="Daftar"
      keterangan="Buat akun untuk mulai mencatat utang pelanggan."
      bawah={
        <>
          Sudah punya akun?{' '}
          <Link to="/masuk" className="text-emas-700 underline underline-offset-4">
            Masuk
          </Link>
        </>
      }
    >
      <form onSubmit={kirim} className="flex flex-col gap-4" noValidate>
        <KotakGalat pesan={galat} />
        <Input
          label="Nama Anda"
          autoComplete="name"
          required
          value={nama}
          onChange={(e) => setNama(e.target.value)}
          placeholder="mis. Pak Hendri"
        />
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
          autoComplete="new-password"
          required
          value={sandi}
          onChange={(e) => setSandi(e.target.value)}
          placeholder="••••••••"
          bantuan={`Minimal ${PANJANG_SANDI_MINIMAL} karakter.`}
        />
        <Tombol type="submit" varian="utama" ukuran="besar" penuh disabled={sedangKirim}>
          {sedangKirim ? 'Sedang mendaftar…' : 'Daftar'}
        </Tombol>
      </form>
    </LayoutAuth>
  );
}
