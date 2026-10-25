import type { Enums } from '@/data/database.types';

/*
 * Halaman pantau memanggil API dengan fetch biasa, tanpa token masuk.
 *
 * Yang membukanya adalah pelanggan, bukan pemilik warung: mereka tidak
 * memasang aplikasinya, kemungkinan besar sinyalnya seadanya, dan datang
 * hanya untuk melihat satu angka. Modul yang dimuat sengaja sekecil mungkin.
 */

export interface ItemPantau {
  nama_item: string;
  qty: number;
  harga_satuan: number;
  subtotal: number;
}

export interface TransaksiPantau {
  nomor_struk?: string | null;
  /** Rincian belanjaan; kosong untuk utang yang dicatat tanpa rincian. */
  item?: ItemPantau[];
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
  untuk_keterangan?: string | null;
  untuk_tanggal?: string | null;
}

export interface DataPantau {
  warung: { nama_warung: string; no_wa_warung: string | null };
  pelanggan: { nama: string };
  sisa_utang: number;
  transaksi: TransaksiPantau[];
  pembayaran: PembayaranPantau[];
}

export class TokenTidakDikenal extends Error {}

/**
 * Jawaban server. Selalu ada `status`: halaman tidak pernah menebak dari ada
 * tidaknya data. Hanya status 'ok' yang membawa catatan utang.
 */
export type HasilPantau =
  | { status: 'ok'; data: DataPantau }
  | { status: 'butuh_pin'; nama_warung: string }
  | { status: 'pin_salah'; nama_warung: string; sisa_percobaan: number }
  | { status: 'terkunci'; sisa_detik: number };

/** Bentuk UUID; token yang jelas-jelas salah bentuk tidak perlu dikirim. */
const POLA_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function ambilPantau(
  token: string,
  pin: string | null,
  sinyal?: AbortSignal,
): Promise<HasilPantau> {
  if (!POLA_UUID.test(token)) throw new TokenTidakDikenal();

  const tanggapan = await fetch('/api/pantau', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_token: token, p_pin: pin }),
    signal: sinyal,
  });

  if (!tanggapan.ok) {
    throw new Error('Tidak bisa menghubungi server. Coba lagi saat sinyal membaik.');
  }

  const isi = (await tanggapan.json()) as (Record<string, unknown> & { status?: string }) | null;
  // null untuk token tak dikenal DAN pelanggan yang sudah dihapus — sengaja
  // tidak dibedakan, supaya penebak token tidak tahu tebakannya "hampir benar".
  if (isi === null) throw new TokenTidakDikenal();

  if (isi.status === 'ok') {
    const { status: _status, ...data } = isi;
    void _status;
    return { status: 'ok', data: data as unknown as DataPantau };
  }
  return isi as unknown as HasilPantau;
}
