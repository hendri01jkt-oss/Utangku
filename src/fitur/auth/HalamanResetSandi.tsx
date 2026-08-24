import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Input, Tombol } from '@/komponen/ui';
import { KotakGalat, KotakInfo, LayoutAuth } from './LayoutAuth';
import { pesanGalat } from './pesanGalat';

const PANJANG_SANDI_MINIMAL = 8;

/**
 * Halaman tujuan tautan reset dari email.
 *
 * Klien Supabase dikonfigurasi dengan detectSessionInUrl, jadi kode PKCE di
 * URL sudah ditukar menjadi sesi pemulihan sebelum komponen ini dirender.
 * Yang tersisa hanya memastikan sesi itu benar-benar ada — kalau tidak,
 * tautannya kedaluwarsa atau sudah dipakai.
 */
export function HalamanResetSandi() {
  const [sandi, setSandi] = useState('');
  const [galat, setGalat] = useState<string | null>(null);
  const [sedangKirim, setSedangKirim] = useState(false);
  const [berhasil, setBerhasil] = useState(false);
  const [tautanSah, setTautanSah] = useState<boolean | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    let batal = false;
    void supabase.auth.getSession().then(({ data }) => {
      if (!batal) setTautanSah(Boolean(data.session));
    });
    return () => {
      batal = true;
    };
  }, []);

  async function kirim(e: FormEvent) {
    e.preventDefault();
    setGalat(null);

    if (sandi.length < PANJANG_SANDI_MINIMAL) {
      setGalat(`Kata sandi minimal ${PANJANG_SANDI_MINIMAL} karakter.`);
      return;
    }

    setSedangKirim(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: sandi });
      if (error) throw error;
      setBerhasil(true);
      setTimeout(() => navigate('/', { replace: true }), 1500);
    } catch (err) {
      setGalat(pesanGalat(err));
    } finally {
      setSedangKirim(false);
    }
  }

  if (tautanSah === false) {
    return (
      <LayoutAuth
        judul="Tautan tidak berlaku"
        keterangan="Tautan reset kata sandi hanya berlaku sekali dan punya masa berlaku."
        bawah={
          <Link to="/lupa-sandi" className="text-merah-600 underline underline-offset-4">
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
