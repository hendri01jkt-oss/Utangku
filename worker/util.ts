/*
 * Penolong server UtangKu (Cloudflare Worker): JSON, kata sandi, token.
 *
 * Tipe D1/R2 sengaja `any`: paket tipe Cloudflare tidak dipasang di proyek
 * ini dan Worker dibundel wrangler tanpa pemeriksaan tipe.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
export interface Env {
  DB: any;
  FOTO: any;
  JWT_SECRET: string;
  GOOGLE_CLIENT_ID?: string;
  MIDTRANS_SERVER_KEY?: string;
  MIDTRANS_IS_PRODUCTION?: string;
  HARGA_LANGGANAN?: string;
  RESEND_API_KEY?: string;
  EMAIL_PENGIRIM?: string;
}

export class GalatApi extends Error {
  status: number;
  constructor(status: number, pesan: string) {
    super(pesan);
    this.status = status;
  }
}

export const json = (data: unknown, status = 200): Response =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });

export const sekarangIso = (): string => new Date().toISOString();

export const POLA_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const enc = new TextEncoder();
const dec = new TextDecoder();

export function keBase64(data: ArrayBuffer | Uint8Array): string {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
  let teks = '';
  for (const b of bytes) teks += String.fromCharCode(b);
  return btoa(teks);
}

export function dariBase64(teks: string): Uint8Array {
  return Uint8Array.from(atob(teks), (c) => c.charCodeAt(0));
}

const keB64Url = (data: ArrayBuffer | Uint8Array) =>
  keBase64(data).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

const dariB64Url = (teks: string) =>
  dariBase64(teks.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (teks.length % 4)) % 4));

/** Perbandingan yang waktunya tidak membocorkan di karakter mana beda. */
export function samaPersis(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let selisih = 0;
  for (let i = 0; i < a.length; i++) selisih |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return selisih === 0;
}

/*
 * PBKDF2-SHA256 100.000 putaran: batas atas yang diizinkan Workers, dan
 * cukup untuk kata sandi pengguna dengan garam acak per akun.
 */
export async function hashSandi(sandi: string, garamBase64?: string) {
  const garam = garamBase64 ? dariBase64(garamBase64) : crypto.getRandomValues(new Uint8Array(16));
  const kunci = await crypto.subtle.importKey('raw', enc.encode(sandi), 'PBKDF2', false, [
    'deriveBits',
  ]);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: garam, iterations: 100_000 },
    kunci,
    256,
  );
  return { hash: keBase64(bits), garam: keBase64(garam) };
}

export async function sha256Hex(teks: string): Promise<string> {
  const hash = await crypto.subtle.digest('SHA-256', enc.encode(teks));
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function sha512Hex(teks: string): Promise<string> {
  const hash = await crypto.subtle.digest('SHA-512', enc.encode(teks));
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

const kunciHmac = (rahasia: string) =>
  crypto.subtle.importKey('raw', enc.encode(rahasia), { name: 'HMAC', hash: 'SHA-256' }, false, [
    'sign',
    'verify',
  ]);

/** Token masuk HS256. `sub` = id pengguna. */
export async function buatToken(rahasia: string, sub: string, hari = 30): Promise<string> {
  const header = keB64Url(enc.encode(JSON.stringify({ alg: 'HS256', typ: 'JWT' })));
  const sekarang = Math.floor(Date.now() / 1000);
  const isi = keB64Url(enc.encode(JSON.stringify({ sub, iat: sekarang, exp: sekarang + hari * 86400 })));
  const tanda = await crypto.subtle.sign('HMAC', await kunciHmac(rahasia), enc.encode(`${header}.${isi}`));
  return `${header}.${isi}.${keB64Url(tanda)}`;
}

/** Mengembalikan id pengguna bila token sah dan belum kedaluwarsa, selain itu null. */
export async function periksaToken(rahasia: string, token: string): Promise<string | null> {
  const bagian = token.split('.');
  if (bagian.length !== 3) return null;
  const [header, isi, tanda] = bagian as [string, string, string];
  try {
    const sah = await crypto.subtle.verify(
      'HMAC',
      await kunciHmac(rahasia),
      dariB64Url(tanda),
      enc.encode(`${header}.${isi}`),
    );
    if (!sah) return null;
    const muatan = JSON.parse(dec.decode(dariB64Url(isi))) as { sub?: unknown; exp?: unknown };
    if (typeof muatan.exp !== 'number' || muatan.exp < Date.now() / 1000) return null;
    return typeof muatan.sub === 'string' ? muatan.sub : null;
  } catch {
    return null;
  }
}

export async function bacaJson(req: Request): Promise<Record<string, unknown>> {
  try {
    const isi = (await req.json()) as unknown;
    if (isi && typeof isi === 'object' && !Array.isArray(isi)) return isi as Record<string, unknown>;
  } catch {
    /* jatuh ke galat di bawah */
  }
  throw new GalatApi(400, 'Isi permintaan tidak valid.');
}
