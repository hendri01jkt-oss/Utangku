import { daftar, lupaSandi, masuk, resetSandi, saya } from './auth';
import { ambilLangganan, buatTagihan, webhookMidtrans } from './langganan';
import { pantau } from './pantau';
import {
  ambilFoto,
  ambilWarung,
  buatWarung,
  dorong,
  resetData,
  tandaiReminder,
  tarik,
  unggahFoto,
} from './sinkron';
import { type Env, GalatApi, json } from './util';

/*
 * Server UtangKu di Cloudflare Workers.
 *
 * Satu Worker melayani aplikasi (berkas statis dari folder dist lewat
 * "assets") dan API di /api/*. Hanya permintaan /api/* yang sampai ke kode
 * ini; sisanya dijawab langsung oleh assets.
 */

async function tangani(req: Request, env: Env): Promise<Response> {
  const url = new URL(req.url);
  const jalur = url.pathname.replace(/\/+$/, '');
  const metode = req.method;

  // Tanpa rahasia penanda tangan yang kuat, token masuk bisa dipalsukan.
  // Lebih baik semua jalur berhenti daripada berjalan tanpa pengaman itu.
  if (typeof env.JWT_SECRET !== 'string' || env.JWT_SECRET.length < 32) {
    throw new GalatApi(503, 'Server belum disiapkan sepenuhnya.');
  }

  if (metode === 'POST' && jalur === '/api/auth/daftar') return daftar(req, env);
  if (metode === 'POST' && jalur === '/api/auth/masuk') return masuk(req, env);
  if (metode === 'GET' && jalur === '/api/auth/saya') return saya(req, env);
  if (metode === 'POST' && jalur === '/api/auth/lupa') return lupaSandi(req, env);
  if (metode === 'POST' && jalur === '/api/auth/reset') return resetSandi(req, env);

  if (metode === 'GET' && jalur === '/api/warung') return ambilWarung(req, env);
  if (metode === 'POST' && jalur === '/api/warung') return buatWarung(req, env);

  const sinkron = /^\/api\/sinkron\/([a-z_]+)$/.exec(jalur);
  if (sinkron?.[1]) {
    if (metode === 'GET') return tarik(req, env, sinkron[1]);
    if (metode === 'PUT') return dorong(req, env, sinkron[1]);
  }

  const foto = /^\/api\/foto\/([0-9a-fA-F-]{36})$/.exec(jalur);
  if (foto?.[1]) {
    if (metode === 'PUT') return unggahFoto(req, env, foto[1]);
    if (metode === 'GET') return ambilFoto(req, env, foto[1]);
  }

  if (metode === 'POST' && jalur === '/api/reset-data') return resetData(req, env);

  if (metode === 'POST' && jalur === '/api/pantau') return pantau(req, env);

  if (metode === 'GET' && jalur === '/api/langganan') return ambilLangganan(req, env);
  if (metode === 'POST' && jalur === '/api/langganan/tagihan') return buatTagihan(req, env);
  if (metode === 'POST' && jalur === '/api/webhook/midtrans') return webhookMidtrans(req, env);

  throw new GalatApi(404, 'Alamat tidak dikenal.');
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    try {
      return await tangani(req, env);
    } catch (galat) {
      if (galat instanceof GalatApi) return json({ galat: galat.message }, galat.status);
      console.error(galat);
      return json({ galat: 'Terjadi kesalahan di server.' }, 500);
    }
  },

  async scheduled(_peristiwa: unknown, env: Env): Promise<void> {
    await tandaiReminder(env);
  },
};
