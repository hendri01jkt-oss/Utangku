/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  bacaJson,
  buatToken,
  type Env,
  GalatApi,
  hashSandi,
  json,
  periksaToken,
  samaPersis,
  sekarangIso,
  sha256Hex,
} from './util';

const SANDI_MINIMAL = 8;
const SANDI_MAKS = 200;
const POLA_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAKS_GAGAL_LOGIN = 10;
const KUNCI_MENIT = 15;

export interface Pengguna {
  id: string;
  email: string;
}

export async function wajibMasuk(req: Request, env: Env): Promise<Pengguna> {
  const header = req.headers.get('Authorization') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  const id = token ? await periksaToken(env.JWT_SECRET, token) : null;
  const baris = id
    ? await env.DB.prepare('SELECT id, email FROM users WHERE id = ?').bind(id).first()
    : null;
  if (!baris) throw new GalatApi(401, 'Sesi Anda sudah berakhir. Silakan masuk lagi.');
  return { id: baris.id as string, email: baris.email as string };
}

/** Warung pertama milik pengguna beserta perannya; null bila belum punya. */
export async function warungPengguna(env: Env, userId: string): Promise<any | null> {
  return env.DB.prepare(
    `SELECT w.*, a.role AS role
       FROM warung w JOIN warung_anggota a ON a.warung_id = w.id
      WHERE a.user_id = ?
      ORDER BY w.created_at ASC LIMIT 1`,
  )
    .bind(userId)
    .first();
}

/** Seperti warungPengguna, tetapi menolak bila pengguna belum punya warung. */
export async function wajibWarung(env: Env, userId: string): Promise<any> {
  const warung = await warungPengguna(env, userId);
  if (!warung) throw new GalatApi(404, 'Warung belum dibuat.');
  return warung;
}

/**
 * Menambah hitungan salah untuk satu kunci (atomik) dan mengembalikan
 * jumlah terbarunya. Hitungan mulai dari 1 lagi bila salah terakhir sudah
 * lewat dari jendela penguncian.
 */
export async function tambahGagal(
  env: Env,
  tabel: 'login_percobaan' | 'pantau_percobaan',
  kolom: 'kunci' | 'token_pantau',
  kunci: string,
): Promise<number> {
  const sekarang = new Date();
  const batas = new Date(sekarang.getTime() - KUNCI_MENIT * 60_000).toISOString();
  const baris = await env.DB.prepare(
    `INSERT INTO ${tabel} (${kolom}, gagal, gagal_terakhir) VALUES (?1, 1, ?2)
     ON CONFLICT(${kolom}) DO UPDATE SET
       gagal = CASE WHEN gagal_terakhir > ?3 THEN gagal + 1 ELSE 1 END,
       gagal_terakhir = ?2,
       terkunci_sampai = NULL
     RETURNING gagal`,
  )
    .bind(kunci, sekarang.toISOString(), batas)
    .first();
  return Number(baris?.gagal ?? 1);
}

async function kunciSampai(env: Env, kunci: string): Promise<string | null> {
  const baris = await env.DB.prepare('SELECT terkunci_sampai FROM login_percobaan WHERE kunci = ?')
    .bind(kunci)
    .first();
  return (baris?.terkunci_sampai as string | null) ?? null;
}

function sahkanEmail(nilai: unknown): string {
  const email = typeof nilai === 'string' ? nilai.trim().toLowerCase() : '';
  if (!POLA_EMAIL.test(email) || email.length > 254) throw new GalatApi(422, 'Format email tidak benar.');
  return email;
}

function sahkanSandi(nilai: unknown): string {
  const sandi = typeof nilai === 'string' ? nilai : '';
  if (sandi.length < SANDI_MINIMAL) {
    throw new GalatApi(422, `Kata sandi minimal ${SANDI_MINIMAL} karakter.`);
  }
  if (sandi.length > SANDI_MAKS) throw new GalatApi(422, 'Kata sandi terlalu panjang.');
  return sandi;
}

const jawabMasuk = async (env: Env, pengguna: Pengguna) =>
  json({ token: await buatToken(env.JWT_SECRET, pengguna.id), user: pengguna });

export async function daftar(req: Request, env: Env): Promise<Response> {
  const badan = await bacaJson(req);
  const email = sahkanEmail(badan.email);
  const sandi = sahkanSandi(badan.password);
  const nama = typeof badan.nama_lengkap === 'string' ? badan.nama_lengkap.trim().slice(0, 120) : '';

  const ada = await env.DB.prepare('SELECT 1 AS x FROM users WHERE email = ?').bind(email).first();
  if (ada) {
    throw new GalatApi(409, 'Email ini sudah terdaftar. Silakan masuk atau gunakan Lupa Kata Sandi.');
  }

  const id = crypto.randomUUID();
  const { hash, garam } = await hashSandi(sandi);
  const waktu = sekarangIso();
  await env.DB.batch([
    env.DB.prepare(
      'INSERT INTO users (id, email, password_hash, password_salt, created_at) VALUES (?, ?, ?, ?, ?)',
    ).bind(id, email, hash, garam, waktu),
    env.DB.prepare(
      'INSERT INTO profiles (id, nama_lengkap, created_at, updated_at) VALUES (?, ?, ?, ?)',
    ).bind(id, nama || null, waktu, waktu),
  ]);
  return jawabMasuk(env, { id, email });
}

export async function masuk(req: Request, env: Env): Promise<Response> {
  const badan = await bacaJson(req);
  const email = typeof badan.email === 'string' ? badan.email.trim().toLowerCase() : '';
  const sandi = typeof badan.password === 'string' ? badan.password : '';
  if (!email || !sandi || sandi.length > SANDI_MAKS) {
    throw new GalatApi(401, 'Email atau kata sandi salah. Coba periksa lagi.');
  }

  const kunci = `login:${email}`;
  const terkunci = await kunciSampai(env, kunci);
  if (terkunci && terkunci > sekarangIso()) {
    throw new GalatApi(429, 'Terlalu banyak percobaan. Tunggu sebentar lalu coba lagi.');
  }

  const pengguna = await env.DB.prepare(
    'SELECT id, email, password_hash, password_salt FROM users WHERE email = ?',
  )
    .bind(email)
    .first();

  // Hash tetap dihitung untuk email yang tidak dikenal, supaya waktu
  // jawabannya tidak membocorkan email mana yang terdaftar.
  const { hash } = await hashSandi(sandi, pengguna?.password_salt);
  const cocok = pengguna ? samaPersis(hash, pengguna.password_hash as string) : false;

  if (!cocok) {
    const gagal = await tambahGagal(env, 'login_percobaan', 'kunci', kunci);
    if (gagal >= MAKS_GAGAL_LOGIN) {
      await env.DB.prepare(
        'UPDATE login_percobaan SET terkunci_sampai = ?, gagal = 0 WHERE kunci = ?',
      )
        .bind(new Date(Date.now() + KUNCI_MENIT * 60_000).toISOString(), kunci)
        .run();
    }
    throw new GalatApi(401, 'Email atau kata sandi salah. Coba periksa lagi.');
  }

  await env.DB.prepare('DELETE FROM login_percobaan WHERE kunci = ?').bind(kunci).run();
  return jawabMasuk(env, { id: pengguna.id as string, email: pengguna.email as string });
}

/** Memeriksa token dan memperpanjang masa berlakunya (sesi bergulir). */
export async function saya(req: Request, env: Env): Promise<Response> {
  const pengguna = await wajibMasuk(req, env);
  return jawabMasuk(env, pengguna);
}

async function kirimEmail(env: Env, ke: string, subjek: string, html: string): Promise<void> {
  const tanggapan = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: env.EMAIL_PENGIRIM ?? 'UtangKu <onboarding@resend.dev>',
      to: [ke],
      subject: subjek,
      html,
    }),
  });
  if (!tanggapan.ok) throw new GalatApi(502, 'Email gagal dikirim. Coba lagi nanti.');
}

export async function lupaSandi(req: Request, env: Env): Promise<Response> {
  if (!env.RESEND_API_KEY) {
    throw new GalatApi(503, 'Reset lewat email belum aktif. Hubungi pengelola UtangKu.');
  }
  const badan = await bacaJson(req);
  const email = sahkanEmail(badan.email);

  const pengguna = await env.DB.prepare('SELECT id FROM users WHERE email = ?').bind(email).first();
  if (pengguna) {
    const mentah = crypto.getRandomValues(new Uint8Array(32));
    const token = [...mentah].map((b) => b.toString(16).padStart(2, '0')).join('');
    await env.DB.prepare(
      'INSERT INTO reset_sandi (token_hash, user_id, kedaluwarsa) VALUES (?, ?, ?)',
    )
      .bind(await sha256Hex(token), pengguna.id, new Date(Date.now() + 3600_000).toISOString())
      .run();
    const alamat = `${new URL(req.url).origin}/reset-sandi?token=${token}`;
    await kirimEmail(
      env,
      email,
      'Reset kata sandi UtangKu',
      `<p>Klik tautan ini untuk membuat kata sandi baru (berlaku 1 jam):</p><p><a href="${alamat}">${alamat}</a></p><p>Kalau bukan Anda yang meminta, abaikan email ini.</p>`,
    );
  }
  // Jawaban sama untuk email yang terdaftar maupun tidak.
  return json({ ok: true });
}

export async function resetSandi(req: Request, env: Env): Promise<Response> {
  const badan = await bacaJson(req);
  const token = typeof badan.token === 'string' ? badan.token : '';
  const sandi = sahkanSandi(badan.sandi_baru);
  const tautanTidakSah = new GalatApi(400, 'Tautan tidak berlaku.');
  if (!/^[0-9a-f]{64}$/.test(token)) throw tautanTidakSah;

  const hashToken = await sha256Hex(token);
  const baris = await env.DB.prepare(
    'SELECT user_id, kedaluwarsa, dipakai FROM reset_sandi WHERE token_hash = ?',
  )
    .bind(hashToken)
    .first();
  if (!baris || baris.dipakai || (baris.kedaluwarsa as string) < sekarangIso()) throw tautanTidakSah;

  // Penanda "dipakai" diambil lebih dulu secara atomik: dua permintaan
  // bersamaan tidak bisa sama-sama memakai satu tautan.
  const ambil = await env.DB.prepare(
    'UPDATE reset_sandi SET dipakai = 1 WHERE token_hash = ? AND dipakai = 0',
  )
    .bind(hashToken)
    .run();
  if (!ambil.meta?.changes) throw tautanTidakSah;

  const { hash, garam } = await hashSandi(sandi);
  await env.DB.prepare('UPDATE users SET password_hash = ?, password_salt = ? WHERE id = ?')
    .bind(hash, garam, baris.user_id)
    .run();

  const pengguna = await env.DB.prepare('SELECT id, email FROM users WHERE id = ?')
    .bind(baris.user_id)
    .first();
  return jawabMasuk(env, { id: pengguna.id as string, email: pengguna.email as string });
}
