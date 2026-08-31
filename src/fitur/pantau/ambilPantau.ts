import type { Enums } from '@/data/database.types';

/*
 * Halaman pantau memanggil PostgREST dengan fetch biasa, BUKAN lewat
 * supabase-js.
 *
 * Yang membukanya adalah pelanggan, bukan pemilik warung: mereka tidak
 * memasang aplikasinya, kemungkinan besar sinyalnya seadanya, dan datang
 * hanya untuk melihat satu angka. Memuat supabase-js untuk itu berarti
 * ~52 kB terkompresi hanya demi satu permintaan POST — beserta lapisan auth
 * dan realtime yang sama sekali tidak dipakai di sini.
 */
const URL_SUPABASE = import.meta.env.VITE_SUPABASE_URL;
const KUNCI = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export interface TransaksiPantau {
  tanggal: string;
  keterangan: string | null;
  nominal: number;
  total_dibayar: number;
  jatuh_tempo: string | null;
  status: Enums<'utang_status'>;
}

export interface PembayaranPantau {
  tanggal: string;
  nominal: number;
  metode: Enums<'metode_bayar'>;
}

export interface DataPantau {
  warung: { nama_warung: string; no_wa_warung: string | null };
  pelanggan: { nama: string };
  sisa_utang: number;
  transaksi: TransaksiPantau[];
  pembayaran: PembayaranPantau[];
}

export class TokenTidakDikenal extends Error {}

/** Bentuk UUID; token yang jelas-jelas salah bentuk tidak perlu dikirim. */
const POLA_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function ambilPantau(token: string, sinyal?: AbortSignal): Promise<DataPantau> {
  if (!POLA_UUID.test(token)) throw new TokenTidakDikenal();

  const tanggapan = await fetch(`${URL_SUPABASE}/rest/v1/rpc/pantau_utang`, {
    method: 'POST',
    headers: {
      apikey: KUNCI,
      Authorization: `Bearer ${KUNCI}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ p_token: token }),
    signal: sinyal,
  });

  if (!tanggapan.ok) {
    throw new Error('Tidak bisa menghubungi server. Coba lagi saat sinyal membaik.');
  }

  const isi: unknown = await tanggapan.json();
  // Fungsi mengembalikan null untuk token tak dikenal DAN untuk pelanggan
  // yang sudah dihapus — sengaja tidak dibedakan, supaya penebak token tidak
  // pernah tahu tebakannya "hampir benar".
  if (isi === null) throw new TokenTidakDikenal();
  return isi as DataPantau;
}
