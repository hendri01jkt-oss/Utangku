import { barisStruk, UKURAN_KERTAS, type DataStruk, type LebarKertas } from './barisStruk';

/*
 * Perintah ESC/POS yang dipakai. Sengaja sedikit: makin banyak perintah
 * dipakai, makin besar kemungkinan salah satunya tidak dikenali printer
 * murah dan tercetak sebagai sampah karakter.
 */
const ESC = 0x1b;
const GS = 0x1d;

const INISIALISASI = [ESC, 0x40]; // ESC @ — reset, sekaligus bersihkan sisa buffer
const RATA_KIRI = [ESC, 0x61, 0x00];
const RATA_TENGAH = [ESC, 0x61, 0x01];
const TEBAL_NYALA = [ESC, 0x45, 0x01];
const TEBAL_MATI = [ESC, 0x45, 0x00];
const POTONG = [GS, 0x56, 0x42, 0x00]; // GS V B — potong sebagian
const BARIS_BARU = [0x0a];

/**
 * Mengubah teks menjadi byte yang aman untuk printer thermal murah.
 *
 * Sengaja dibatasi ke ASCII. Printer kelas ini punya code page yang
 * berbeda-beda dan sering salah menampilkan karakter di luar ASCII —
 * termasuk NBSP dan tanda kutip melengkung yang tanpa sadar ikut terbawa
 * dari teks yang diketik pengguna. Bahasa Indonesia tidak butuh karakter di
 * luar ASCII, jadi menggantinya jauh lebih aman daripada menebak code page.
 */
export function keAscii(teks: string): number[] {
  const pengganti: Record<string, string> = {
    ' ': ' ',
    '‘': "'",
    '’': "'",
    '“': '"',
    '”': '"',
    '–': '-',
    '—': '-',
    '…': '...',
  };

  const byte: number[] = [];
  for (const huruf of teks.replace(/[ ‘’“”–—…]/g, (h) => pengganti[h] ?? h)) {
    const kode = huruf.charCodeAt(0);
    // Di luar ASCII cetak: diganti '?' supaya panjang barisnya tetap sama
    // dan tata letak kolom tidak bergeser.
    byte.push(kode >= 0x20 && kode <= 0x7e ? kode : 0x3f);
  }
  return byte;
}

/**
 * Menyusun seluruh perintah cetak untuk satu struk.
 *
 * Murni: tidak menyentuh Bluetooth, DOM, maupun waktu. Itu disengaja supaya
 * isinya bisa diuji tuntas di sini — bagian yang TIDAK bisa saya uji adalah
 * pengirimannya ke printer sungguhan, jadi bagian yang bisa diuji harus
 * benar-benar diuji.
 */
export function byteStruk(data: DataStruk, lebarMm: LebarKertas): Uint8Array<ArrayBuffer> {
  const kolom = UKURAN_KERTAS[lebarMm].karakter;
  const keluaran: number[] = [...INISIALISASI];

  for (const baris of barisStruk(data, kolom)) {
    if (baris.jenis === 'kosong') {
      keluaran.push(...BARIS_BARU);
      continue;
    }
    if (baris.jenis === 'pisah') {
      keluaran.push(...RATA_KIRI, ...keAscii('-'.repeat(kolom)), ...BARIS_BARU);
      continue;
    }

    keluaran.push(...(baris.rata === 'tengah' ? RATA_TENGAH : RATA_KIRI));
    if (baris.tebal) keluaran.push(...TEBAL_NYALA);
    keluaran.push(...keAscii(baris.isi), ...BARIS_BARU);
    if (baris.tebal) keluaran.push(...TEBAL_MATI);
  }

  // Umpan kertas sebelum dipotong: pisau printer berjarak beberapa milimeter
  // dari kepala cetak, jadi tanpa ini baris terakhir ikut terpotong.
  keluaran.push(...BARIS_BARU, ...BARIS_BARU, ...BARIS_BARU, ...POTONG);

  return new Uint8Array(keluaran);
}

/**
 * Memecah data menjadi potongan sebesar MTU BLE.
 *
 * BLE tidak mengenal aliran panjang: setiap tulis dibatasi ukuran paket, dan
 * printer murah punya buffer kecil yang meluap kalau dikirimi terlalu cepat.
 * Gejalanya khas — cetakan terpotong di tengah atau berubah jadi karakter
 * acak — dan mudah disalahartikan sebagai printer rusak.
 */
export function potongPaket(
  data: Uint8Array<ArrayBuffer>,
  ukuran = 180,
): Uint8Array<ArrayBuffer>[] {
  const paket: Uint8Array<ArrayBuffer>[] = [];
  for (let i = 0; i < data.length; i += ukuran) paket.push(data.slice(i, i + ukuran));
  return paket;
}
