import { useEffect, useState } from 'react';
import { Bluetooth, Download, Share2, TriangleAlert } from 'lucide-react';
import { BottomSheet, Tombol } from '@/komponen/ui';
import { siapkanStruk, type StrukSiap } from './dataStruk';
import { gambarStruk, namaBerkasStruk } from './gambarStruk';
import { bluetoothDidukung, cetakLewatBluetooth, GalatCetak } from './bluetooth';
import { byteStruk } from './escpos';

type Status =
  | { keadaan: 'memuat' }
  | { keadaan: 'siap' }
  | { keadaan: 'sibuk'; pesan: string }
  | { keadaan: 'galat'; pesan: string }
  | { keadaan: 'sukses'; pesan: string };

/**
 * Panel struk: pratinjau, bagikan, simpan, dan (kalau didukung) cetak
 * langsung ke printer BLE.
 *
 * Gambarnya dibuat sekali lalu dipakai ulang oleh semua tombol, supaya yang
 * dilihat pemilik warung persis sama dengan yang dibagikan dan disimpan.
 */
export function PanelStruk({
  transaksiId,
  onTutup,
}: {
  transaksiId: string;
  onTutup: () => void;
}) {
  const [struk, setStruk] = useState<StrukSiap | null>(null);
  const [berkas, setBerkas] = useState<File | null>(null);
  const [pratinjau, setPratinjau] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>({ keadaan: 'memuat' });

  useEffect(() => {
    let batal = false;
    let alamatObjek: string | null = null;

    void (async () => {
      try {
        const siap = await siapkanStruk(transaksiId);
        if (!siap) throw new Error('Data transaksi tidak ditemukan di perangkat ini.');

        const blob = await gambarStruk(siap.data, siap.lebar);
        if (batal) return;

        alamatObjek = URL.createObjectURL(blob);
        setStruk(siap);
        setBerkas(new File([blob], namaBerkasStruk(siap.data), { type: 'image/png' }));
        setPratinjau(alamatObjek);
        setStatus({ keadaan: 'siap' });
      } catch (galat) {
        if (!batal) {
          setStatus({
            keadaan: 'galat',
            pesan: galat instanceof Error ? galat.message : 'Gagal menyiapkan struk.',
          });
        }
      }
    })();

    return () => {
      batal = true;
      // Alamat objek dilepas saat panel ditutup; kalau tidak, blob gambarnya
      // menetap di memori selama tab masih terbuka.
      if (alamatObjek) URL.revokeObjectURL(alamatObjek);
    };
  }, [transaksiId]);

  const unduh = () => {
    if (!berkas || !pratinjau) return;
    const tautan = document.createElement('a');
    tautan.href = pratinjau;
    tautan.download = berkas.name;
    tautan.click();
    setStatus({ keadaan: 'sukses', pesan: 'Struk tersimpan ke perangkat.' });
  };

  const bagikan = async () => {
    if (!berkas) return;
    // canShare dengan files harus diperiksa: sebagian browser punya
    // navigator.share tapi menolak berkas, dan share() akan gagal di tengah.
    if (!navigator.canShare?.({ files: [berkas] })) {
      unduh();
      return;
    }
    try {
      await navigator.share({ files: [berkas], title: 'Struk utang' });
      setStatus({ keadaan: 'sukses', pesan: 'Struk dibagikan.' });
    } catch (galat) {
      // Pengguna menutup lembar berbagi: itu pembatalan, bukan kegagalan.
      if (galat instanceof DOMException && galat.name === 'AbortError') return;
      setStatus({ keadaan: 'galat', pesan: 'Gagal membagikan struk.' });
    }
  };

  const cetakBluetooth = async () => {
    if (!struk) return;
    setStatus({ keadaan: 'sibuk', pesan: 'Menghubungkan ke printer…' });
    try {
      await cetakLewatBluetooth(byteStruk(struk.data, struk.lebar));
      setStatus({ keadaan: 'sukses', pesan: 'Data struk terkirim ke printer.' });
    } catch (galat) {
      setStatus({
        keadaan: 'galat',
        pesan:
          galat instanceof GalatCetak
            ? galat.message
            : 'Gagal mencetak. Pastikan printer menyala dan berada di dekat HP.',
      });
    }
  };

  const sibuk = status.keadaan === 'sibuk' || status.keadaan === 'memuat';

  return (
    <BottomSheet judul="Struk utang" onTutup={onTutup}>
      <div className="flex flex-col gap-4">
        {status.keadaan === 'memuat' ? (
          <p className="text-sm text-teks-samar">Menyiapkan struk…</p>
        ) : null}

        {pratinjau ? (
          <div className="flex justify-center">
            {/*
              Pratinjau dibatasi tingginya dan bisa digulir: struk dengan
              keterangan panjang bisa jauh lebih tinggi dari layar, dan
              tombol aksinya tidak boleh sampai terdorong keluar.
            */}
            <div className="max-h-64 overflow-y-auto rounded-lg border border-garis bg-putih p-2">
              <img
                src={pratinjau}
                alt="Pratinjau struk"
                className="w-48 max-w-full"
                style={{ imageRendering: 'pixelated' }}
              />
            </div>
          </div>
        ) : null}

        {struk ? (
          <p className="text-center text-xs text-teks-samar">
            Kertas {struk.lebar} mm · {struk.lebar === 58 ? 384 : 576} titik
          </p>
        ) : null}

        {status.keadaan === 'galat' ? (
          <div className="flex items-start gap-2 rounded-lg bg-[var(--tint-bahaya)] p-3">
            <TriangleAlert size={16} className="mt-0.5 shrink-0 text-bahaya" aria-hidden />
            <p className="text-sm text-teks-utama">{status.pesan}</p>
          </div>
        ) : null}

        {status.keadaan === 'sukses' ? (
          <p className="rounded-lg bg-[var(--tint-sukses)] p-3 text-sm text-teks-utama">
            {status.pesan}
          </p>
        ) : null}

        {status.keadaan === 'sibuk' ? (
          <p className="text-sm text-teks-redup">{status.pesan}</p>
        ) : null}

        <div className="flex flex-col gap-2">
          <Tombol
            varian="utama"
            penuh
            disabled={sibuk || !berkas}
            onClick={() => void bagikan()}
            ikon={<Share2 size={16} />}
          >
            Bagikan struk
          </Tombol>
          <Tombol
            varian="sekunder"
            penuh
            disabled={sibuk || !berkas}
            onClick={unduh}
            ikon={<Download size={16} />}
          >
            Simpan gambar
          </Tombol>

          {bluetoothDidukung() ? (
            <>
              <Tombol
                varian="sekunder"
                penuh
                disabled={sibuk || !struk}
                onClick={() => void cetakBluetooth()}
                ikon={<Bluetooth size={16} />}
              >
                Cetak ke printer Bluetooth
              </Tombol>
              {/*
                Diberi label eksperimental dengan sengaja. Web Bluetooth hanya
                bisa menjangkau printer BLE, sementara sebagian besar printer
                thermal murah memakai Bluetooth Classic dan tidak akan pernah
                muncul di daftar. Lebih baik menyebutkannya di muka daripada
                membiarkan pemilik warung mengira aplikasinya rusak.
              */}
              <p className="text-xs text-teks-samar">
                Eksperimental — hanya untuk printer BLE. Kalau daftar printernya
                kosong, printer Anda kemungkinan Bluetooth Classic: pakai
                &ldquo;Bagikan struk&rdquo; lalu cetak dari aplikasi printer.
              </p>
            </>
          ) : (
            <p className="text-xs text-teks-samar">
              Browser ini tidak bisa mencetak langsung ke Bluetooth. Pakai
              &ldquo;Bagikan struk&rdquo; lalu cetak dari aplikasi printer.
            </p>
          )}
        </div>
      </div>
    </BottomSheet>
  );
}
