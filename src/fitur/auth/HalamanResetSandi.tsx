import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '@/lib/api';
import { useSesi } from './useSesi';
import { Input, Tombol } from '@/komponen/ui';
import { KotakGalat, KotakInfo, LayoutAuth } from './LayoutAuth';
import { pesanGalat } from './pesanGalat';

const PANJANG_SANDI_MINIMAL = 8;

/**
 * Halaman tujuan tautan reset dari email: /reset-sandi?token=...
 *
 * Tokennya satu kali pakai dan berlaku 1 jam; server yang memeriksanya saat
 * kata sandi baru dikirim. Di sini hanya dipastikan bentuknya benar.
 */
export function HalamanResetSandi() {
  const [sandi, setSandi] = useState('');
  const [galat, setGalat] = useState<string | null>(null);
  const [sedangKirim, setSedangKirim] = useState(false);
  const [berhasil, setBerhasil] = useState(false);
  const navigate = useNavigate();
  const [parameter] = useSearchParams();
  const token = parameter.get('token') ?? '';
  const tautanSah = /^[0-9a-f]{64}$/.test(token);

  async function kirim(e: FormEvent) {
    e.preventDefault();
    setGalat(null);

    if (sandi.length < PANJANG_SANDI_MINIMAL) {
      setGalat(`Kata sandi minimal ${PANJANG_SANDI_MINIMAL} karakter.`);
      return;
    }

    setSedangKirim(true);
    try {
      const hasil = await api<{ token: string; user: { id: string; email: string } }>(
        '/auth/reset',
        { publik: true, json: { token, sandi_baru: sandi } },
      );
      await useSesi.getState().mulaiSesi(hasil.token, hasil.user);
      setBerhasil(true);
      setTimeout(() => navigate('/', { replace: true }), 1500);
    } catch (err) {
      setGalat(pesanGalat(err));
    } finally {
      setSedangKirim(false);
    }
  }

  if (!tautanSah) {
    return (
      <LayoutAuth
        judul="Tautan tidak berlaku"
        keterangan="Tautan reset kata sandi hanya berlaku sekali dan punya masa berlaku."
        bawah={
          <Link to="/lupa-sandi" className="text-emas-700 underline underline-offset-4">
            Minta tautan baru
          </Link>
        }
      >
        <p className="text-sm text-teks-redup">
          Silakan minta tautan baru, lalu buka tautan terbaru dari email Anda.
        </p>
      </LayoutAuth>
    );
  }

  return (
    <LayoutAuth judul="Buat kata sandi baru">
      <form onSubmit={kirim} className="flex flex-col gap-4" noValidate>
        <KotakGalat pesan={galat} />
        {berhasil ? <KotakInfo pesan="Kata sandi berhasil diubah. Mengalihkan…" /> : null}
        <Input
          label="Kata sandi baru"
          type="password"
          autoComplete="new-password"
          required
          value={sandi}
          onChange={(e) => setSandi(e.target.value)}
          placeholder="••••••••"
          bantuan={`Minimal ${PANJANG_SANDI_MINIMAL} karakter.`}
        />
        <Tombol
          type="submit"
          varian="utama"
          ukuran="besar"
          penuh
          disabled={sedangKirim || tautanSah === null || berhasil}
        >
          {sedangKirim ? 'Menyimpan…' : 'Simpan kata sandi'}
        </Tombol>
      </form>
    </LayoutAuth>
  );
}
