/*
 * Klien API UtangKu (Cloudflare Worker di /api).
 *
 * Pengganti supabase-js: hanya fetch biasa, jadi unduhan awal jauh lebih
 * kecil. Token masuk disimpan di localStorage dan dikirim sebagai Bearer.
 */

const KUNCI_TOKEN = 'utangku-token';

/** Dipancarkan saat server menolak token (kedaluwarsa atau dicabut). */
export const PERISTIWA_SESI_HABIS = 'utangku:sesi-habis';

export function bacaToken(): string | null {
  try {
    return localStorage.getItem(KUNCI_TOKEN);
  } catch {
    return null;
  }
}

export function simpanToken(token: string | null): void {
  try {
    if (token) localStorage.setItem(KUNCI_TOKEN, token);
    else localStorage.removeItem(KUNCI_TOKEN);
  } catch {
    /* penyimpanan bisa ditolak (mode privat); sesi hanya berlaku sampai tab ditutup */
  }
}

export class GalatApi extends Error {
  status: number;
  constructor(status: number, pesan: string) {
    super(pesan);
    this.status = status;
  }
}

interface Opsi {
  method?: string;
  /** Badan JSON. */
  json?: unknown;
  /** Badan mentah (mis. foto) beserta tipenya. */
  badan?: BodyInit;
  tipe?: string;
  sinyal?: AbortSignal;
  /** Tanpa token: untuk masuk, daftar, dan halaman pantau. */
  publik?: boolean;
}

/** Mengirim permintaan; melempar GalatApi (status 0 = tidak ada jaringan). */
export async function kirim(jalur: string, opsi: Opsi = {}): Promise<Response> {
  const header: Record<string, string> = {};
  const token = opsi.publik ? null : bacaToken();
  if (token) header.Authorization = `Bearer ${token}`;

  let badan: BodyInit | undefined;
  if (opsi.json !== undefined) {
    header['Content-Type'] = 'application/json';
    badan = JSON.stringify(opsi.json);
  } else if (opsi.badan !== undefined) {
    badan = opsi.badan;
    if (opsi.tipe) header['Content-Type'] = opsi.tipe;
  }

  let respons: Response;
  try {
    respons = await fetch(`/api${jalur}`, {
      method: opsi.method ?? (badan === undefined ? 'GET' : 'POST'),
      headers: header,
      body: badan,
      signal: opsi.sinyal,
    });
  } catch (galat) {
    if (galat instanceof DOMException && galat.name === 'AbortError') throw galat;
    throw new GalatApi(0, 'Tidak bisa terhubung ke server. Periksa koneksi internet Anda.');
  }

  if (!respons.ok) {
    let pesan = 'Terjadi kesalahan. Coba lagi sebentar.';
    try {
      const isi = (await respons.json()) as { galat?: unknown };
      if (typeof isi.galat === 'string') pesan = isi.galat;
    } catch {
      /* badan bukan JSON; pakai pesan umum */
    }
    if (respons.status === 401 && token) window.dispatchEvent(new Event(PERISTIWA_SESI_HABIS));
    throw new GalatApi(respons.status, pesan);
  }
  return respons;
}

export async function api<T>(jalur: string, opsi: Opsi = {}): Promise<T> {
  const respons = await kirim(jalur, opsi);
  return (await respons.json()) as T;
}
