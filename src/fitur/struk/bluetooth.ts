import { potongPaket } from './escpos';

/*
 * PERINGATAN JUJUR TENTANG BERKAS INI
 *
 * Kode di sini TIDAK PERNAH diuji terhadap printer sungguhan. Lingkungan
 * tempat ia ditulis tidak punya perangkat Bluetooth sama sekali, dan
 * Chromium headless tidak mengimplementasikan BLE. Yang sudah diuji adalah
 * byte ESC/POS yang dikirimkan (lihat escpos.ts) dan alur antarmukanya
 * dengan navigator.bluetooth palsu — bukan sambungannya.
 *
 * Batasan yang melekat pada Web Bluetooth, bukan pada kode ini:
 *
 *  - Hanya BLE/GATT. Printer Bluetooth Classic (SPP) — yaitu MAYORITAS
 *    printer thermal murah di Indonesia — tidak akan pernah terlihat.
 *    Untuk printer itu, jalurnya adalah membagikan gambar struk ke aplikasi
 *    cetak seperti RawBT.
 *  - Tidak ada di Safari/iOS mana pun, dan tidak ada di Firefox.
 *  - Tidak ada UUID standar untuk printer, jadi kandidatnya ditebak dari
 *    daftar di bawah. Printer dengan UUID lain tidak akan cocok meski BLE.
 */

/**
 * Service GATT yang lazim dipakai modul printer BLE.
 *
 * requestDevice mewajibkan UUID disebutkan di muka — tidak ada cara
 * menjelajah service secara bebas — jadi daftar ini menentukan printer mana
 * yang bisa dikenali sama sekali.
 */
const SERVICE_KANDIDAT: readonly string[] = [
  '000018f0-0000-1000-8000-00805f9b34fb', // paling umum pada modul ESC/POS BLE
  '0000ff00-0000-1000-8000-00805f9b34fb',
  '49535343-fe7d-4ae5-8fa9-9fafd205e455', // ISSC / Microchip transparent UART
  '6e400001-b5a3-f393-e0a9-e50e24dcca9e', // Nordic UART
];

export const bluetoothDidukung = (): boolean =>
  typeof navigator !== 'undefined' && 'bluetooth' in navigator;

export class GalatCetak extends Error {}

/** Karakteristik pertama pada service yang bisa ditulisi. */
async function cariKarakteristikTulis(
  server: BluetoothRemoteGATTServer,
): Promise<BluetoothRemoteGATTCharacteristic> {
  for (const uuid of SERVICE_KANDIDAT) {
    let service: BluetoothRemoteGATTService;
    try {
      service = await server.getPrimaryService(uuid);
    } catch {
      continue; // printer ini tidak punya service tersebut
    }

    for (const k of await service.getCharacteristics()) {
      if (k.properties.write || k.properties.writeWithoutResponse) return k;
    }
  }

  throw new GalatCetak(
    'Printer terhubung, tapi tidak ditemukan jalur tulis yang dikenali. ' +
      'Kemungkinan besar model ini memakai UUID di luar daftar yang didukung.',
  );
}

/**
 * Mengirim byte ESC/POS ke printer BLE yang dipilih pengguna.
 *
 * Harus dipanggil dari dalam penanganan ketukan: requestDevice menuntut
 * gestur pengguna, dan browser menolaknya kalau dipanggil dari tempat lain.
 */
export async function cetakLewatBluetooth(byte: Uint8Array<ArrayBuffer>): Promise<void> {
  if (!bluetoothDidukung()) {
    throw new GalatCetak('Browser ini tidak mendukung Bluetooth langsung dari web.');
  }

  let perangkat: BluetoothDevice;
  try {
    perangkat = await navigator.bluetooth.requestDevice({
      filters: SERVICE_KANDIDAT.map((services) => ({ services: [services] })),
      optionalServices: [...SERVICE_KANDIDAT],
    });
  } catch (galat) {
    // Pengguna menutup dialog tanpa memilih: bukan kegagalan, jadi tidak
    // perlu ditampilkan sebagai galat merah.
    if (galat instanceof DOMException && galat.name === 'NotFoundError') {
      throw new GalatCetak(
        'Tidak ada printer BLE yang dipilih. Kalau daftarnya kosong, printer Anda ' +
          'kemungkinan Bluetooth Classic — pakai tombol Bagikan lalu cetak dari ' +
          'aplikasi printer.',
      );
    }
    throw new GalatCetak(
      galat instanceof Error ? galat.message : 'Gagal membuka daftar printer.',
    );
  }

  const server = await perangkat.gatt?.connect();
  if (!server) throw new GalatCetak('Gagal menyambung ke printer.');

  try {
    const karakteristik = await cariKarakteristikTulis(server);

    /*
     * Dikirim sepotong demi sepotong, berurutan, dengan jeda.
     *
     * Buffer printer kelas ini kecil. Mengirim seluruh struk sekaligus —
     * atau mengirim potongannya bersamaan — membuatnya meluap, dan hasilnya
     * cetakan terpotong di tengah atau berubah jadi karakter acak. Gejala
     * itu mudah disalahartikan sebagai printer rusak.
     */
    for (const paket of potongPaket(byte)) {
      if (karakteristik.properties.writeWithoutResponse) {
        await karakteristik.writeValueWithoutResponse(paket);
      } else {
        await karakteristik.writeValue(paket);
      }
      await new Promise((lanjut) => setTimeout(lanjut, 30));
    }
  } finally {
    // Selalu diputus, termasuk saat gagal di tengah: sambungan yang
    // menggantung membuat percobaan berikutnya gagal tanpa sebab yang jelas.
    server.disconnect();
  }
}
