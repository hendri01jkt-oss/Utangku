import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { MailCheck } from 'lucide-react';
import { alamatAplikasi } from '@/lib/alamat';
import { ambilSupabase } from '@/lib/supabase';
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
  const [perluKonfirmasi, setPerluKonfirmasi] = useState(false);
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
      const { data, error } = await (await ambilSupabase()).auth.signUp({
        email: email.trim(),
        password: sandi,
        options: {
          // Dibaca trigger on_auth_user_created untuk mengisi profiles.nama_lengkap.
          data: { full_name: nama.trim() },
          emailRedirectTo: alamatAplikasi(),
        },
      });
      if (error) throw error;

      // Bila konfirmasi email diaktifkan di project, signUp tidak
      // mengembalikan sesi — pengguna harus membuka tautan di emailnya dulu.
      if (!data.session) {
        setPerluKonfirmasi(true);
        return;
      }
      navigate('/onboarding', { replace: true });
    } catch (err) {
      setGalat(pesanGalat(err));
    } finally {
      setSedangKirim(false);
    }
  }

  if (perluKonfirmasi) {
    return (
      <LayoutAuth
        judul="Cek email Anda"
        keterangan="Satu langkah lagi sebelum warung Anda siap."
        bawah={
          <Link to="/masuk" className="text-merah-600 underline underline-offset-4">
            Kembali ke halaman masuk
          </Link>
        }
      >
        <div className="flex flex-col items-center gap-3 py-2 text-center">
          <MailCheck size={40} className="text-merah-600" aria-hidden />
          <p className="text-sm text-teks-redup">
            Kami mengirim tautan konfirmasi ke{' '}
            <span className="text-teks-utama">{email.trim()}</span>. Buka tautan
            itu, lalu masuk untuk melanjutkan.
          </p>
          <p className="text-xs text-teks-samar">
            Tidak ada emailnya? Periksa folder spam.
          </p>
        </div>
      </LayoutAuth>
    );
  }

  return (
    <LayoutAuth
      judul="Daftar"
      keterangan="Buat akun untuk mulai mencatat utang pelanggan."
      bawah={
        <>
          Sudah punya akun?{' '}
          <Link to="/masuk" className="text-merah-600 underline underline-offset-4">
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
