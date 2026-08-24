import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { Download, RefreshCw, X } from 'lucide-react';
import { db } from '@/data/db';
import { Tombol } from '@/komponen/ui';

/** Peristiwa install milik Chromium; belum ada di lib DOM baku. */
interface PeristiwaPasang extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const KUNCI_TUNDA = 'utangku:pasang-ditunda';
const JEDA_TUNDA_HARI = 14;
/** Ajakan memasang baru muncul setelah warung punya sebanyak ini pelanggan. */
const MINIMAL_PELANGGAN = 2;

const sudahTerpasang = () =>
  window.matchMedia('(display-mode: standalone)').matches ||
  (navigator as unknown as { standalone?: boolean }).standalone === true;

function masihDitunda() {
  const tersimpan = localStorage.getItem(KUNCI_TUNDA);
  if (!tersimpan) return false;
  const selisih = Date.now() - Number(tersimpan);
  return selisih < JEDA_TUNDA_HARI * 86_400_000;
}

function Panel({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="permukaan-angkat fixed inset-x-3 z-40 flex flex-col gap-3 rounded-[var(--radius-kartu)] p-4"
      style={{ bottom: 'calc(var(--tinggi-nav) + 0.75rem + env(safe-area-inset-bottom))' }}
      role="dialog"
      aria-live="polite"
    >
      {children}
    </div>
  );
}

export function PemberitahuanPwa() {
  const {
    needRefresh: [perluMuatUlang, setPerluMuatUlang],
    updateServiceWorker,
  } = useRegisterSW();

  const [peristiwa, setPeristiwa] = useState<PeristiwaPasang | null>(null);
  const [tutupPasang, setTutupPasang] = useState(false);

  // Ajakan memasang baru pantas muncul setelah aplikasi terbukti berguna.
  // Menodong pengguna di detik pertama membuka aplikasi hanya membuat
  // ajakan itu ditutup refleks, dan tidak akan dilihat lagi.
  const jumlahPelanggan = useLiveQuery(() => db.pelanggan.count(), [], 0);

  useEffect(() => {
    if (sudahTerpasang() || masihDitunda()) return;

    const tangkap = (e: Event) => {
      // Ditahan supaya bisa dimunculkan pada saat yang tepat, bukan sekarang.
      e.preventDefault();
      setPeristiwa(e as PeristiwaPasang);
    };
    window.addEventListener('beforeinstallprompt', tangkap);
    return () => window.removeEventListener('beforeinstallprompt', tangkap);
  }, []);

  async function pasang() {
    if (!peristiwa) return;
    await peristiwa.prompt();
    await peristiwa.userChoice;
    setPeristiwa(null);
  }

  function tundaPasang() {
    localStorage.setItem(KUNCI_TUNDA, String(Date.now()));
    setTutupPasang(true);
  }

  // Pembaruan didahulukan: memberi tahu ada versi baru lebih mendesak
  // daripada mengajak memasang.
  if (perluMuatUlang) {
    return (
      <Panel>
        <div className="flex items-start gap-3">
          <RefreshCw size={18} className="mt-0.5 shrink-0 text-merah-600" aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">Versi baru UtangKu tersedia</p>
            <p className="mt-0.5 text-xs text-teks-samar">
              Catatan yang belum tersinkron tetap aman saat dimuat ulang.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setPerluMuatUlang(false)}
            aria-label="Tutup"
            className="flex size-8 shrink-0 items-center justify-center rounded-full text-teks-samar hover:bg-permukaan-2"
          >
            <X size={16} aria-hidden />
          </button>
        </div>
        <Tombol varian="utama" penuh onClick={() => void updateServiceWorker(true)}>
          Muat ulang sekarang
        </Tombol>
      </Panel>
    );
  }

  const bolehAjakPasang =
    peristiwa !== null && !tutupPasang && (jumlahPelanggan ?? 0) >= MINIMAL_PELANGGAN;

  if (!bolehAjakPasang) return null;

  return (
    <Panel>
      <div className="flex items-start gap-3">
        <Download size={18} className="mt-0.5 shrink-0 text-merah-600" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">Pasang UtangKu di layar utama</p>
          <p className="mt-0.5 text-xs text-teks-samar">
            Buka langsung dari ikon, tanpa browser, dan tetap jalan tanpa sinyal.
          </p>
        </div>
      </div>
      <div className="flex gap-2">
        <Tombol varian="halus" onClick={tundaPasang}>
          Nanti saja
        </Tombol>
        <Tombol varian="utama" penuh onClick={() => void pasang()}>
          Pasang
        </Tombol>
      </div>
    </Panel>
  );
}
