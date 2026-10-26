import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '@/lib/api';
import { useSesi } from './useSesi';
import { pesanGalat } from './pesanGalat';

interface PustakaGoogle {
  accounts: {
    id: {
      initialize: (opsi: {
        client_id: string;
        callback: (hasil: { credential: string }) => void;
      }) => void;
      renderButton: (elemen: HTMLElement, opsi: Record<string, unknown>) => void;
    };
  };
}

const ALAMAT_SKRIP = 'https://accounts.google.com/gsi/client';

function muatSkrip(): Promise<void> {
  return new Promise((selesai, gagal) => {
    if ((window as unknown as { google?: PustakaGoogle }).google) return selesai();
    const ada = document.querySelector<HTMLScriptElement>(`script[src="${ALAMAT_SKRIP}"]`);
    const skrip = ada ?? document.createElement('script');
    skrip.addEventListener('load', () => selesai());
    skrip.addEventListener('error', () => gagal(new Error('Skrip Google gagal dimuat.')));
    if (!ada) {
      skrip.src = ALAMAT_SKRIP;
      skrip.async = true;
      document.head.appendChild(skrip);
    }
  });
}

/**
 * Tombol "Masuk dengan Google". Hanya muncul kalau server sudah punya Client
 * ID Google; kalau belum (atau offline), tidak menampilkan apa pun.
 */
export function TombolGoogle({ onGalat }: { onGalat: (pesan: string | null) => void }) {
  const tempat = useRef<HTMLDivElement>(null);
  const [aktif, setAktif] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    let batal = false;
    void (async () => {
      try {
        const { client_id } = await api<{ client_id: string | null }>('/auth/google-config', {
          publik: true,
        });
        if (!client_id || batal) return;
        await muatSkrip();
        const google = (window as unknown as { google?: PustakaGoogle }).google;
        if (!google || batal || !tempat.current) return;
        google.accounts.id.initialize({
          client_id,
          callback: (hasil) => {
            void (async () => {
              onGalat(null);
              try {
                const { token, user } = await api<{
                  token: string;
                  user: { id: string; email: string };
                }>('/auth/google', { publik: true, json: { credential: hasil.credential } });
                await useSesi.getState().mulaiSesi(token, user);
                navigate('/', { replace: true });
              } catch (err) {
                onGalat(pesanGalat(err));
              }
            })();
          },
        });
        google.accounts.id.renderButton(tempat.current, {
          type: 'standard',
          theme: 'outline',
          size: 'large',
          text: 'continue_with',
          shape: 'rectangular',
          width: Math.min(tempat.current.clientWidth || 320, 400),
        });
        setAktif(true);
      } catch {
        // Tanpa sinyal atau Google tidak terjangkau: login email tetap ada.
      }
    })();
    return () => {
      batal = true;
    };
  }, [navigate, onGalat]);

  return (
    <div className={aktif ? 'flex flex-col gap-3' : 'hidden'}>
      <div className="flex items-center gap-3 text-xs text-teks-samar">
        <span className="h-px flex-1 bg-garis" />
        atau
        <span className="h-px flex-1 bg-garis" />
      </div>
      <div ref={tempat} className="flex min-h-10 justify-center" />
    </div>
  );
}
