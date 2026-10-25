/* eslint-disable @typescript-eslint/no-explicit-any */
import { wajibMasuk, wajibWarung, warungPengguna } from './auth';
import { bacaJson, type Env, GalatApi, json, POLA_UUID, sekarangIso } from './util';

/*
 * Sinkronisasi baris klien <-> D1.
 *
 * D1 tidak punya RLS, jadi seluruh pagar akses ada di sini:
 *   - warung_id SELALU diambil dari pengguna yang masuk, tidak pernah dari
 *     muatan klien;
 *   - tiap kolom disebut satu per satu dan divalidasi tipenya;
 *   - kolom yang hanya boleh diisi saat baris lahir (`sisip`) tidak ikut
 *     diubah oleh pembaruan (`ubah`);
 *   - baris yang sudah ada dan milik warung lain dijawab 403.
 */

type Jenis = string; // uuid | uuid? | teks | teks? | tgl | tgl? | waktu? | angka | bulat | e:a|b

interface Spesifikasi {
  tabel: string;
  sisip: Record<string, Jenis>;
  ubah: Record<string, Jenis>;
  /** Kolom yang menunjuk baris lain di warung yang sama. */
  relasi: Record<string, string>;
}

const STATUS_PELANGGAN = 'e:aktif|nonaktif';

const SPEK: Record<string, Spesifikasi> = {
  warung: {
    tabel: 'warung',
    sisip: {},
    ubah: {
      nama_warung: 'teks',
      alamat: 'teks?',
      no_wa_warung: 'teks?',
      logo_path: 'teks?',
      template_pesan_tagihan: 'teks',
      tempo_default_hari: 'bulat',
      lebar_struk: 'bulat',
    },
    relasi: {},
  },
  pelanggan: {
    tabel: 'pelanggan',
    sisip: {
      nama: 'teks',
      no_wa: 'teks?',
      alamat: 'teks?',
      foto_path: 'teks?',
      catatan: 'teks?',
      status: STATUS_PELANGGAN,
      token_pantau: 'uuid',
      pin_pantau: 'pin',
      created_at: 'waktu?',
      deleted_at: 'waktu?',
    },
    ubah: {
      nama: 'teks',
      no_wa: 'teks?',
      alamat: 'teks?',
      foto_path: 'teks?',
      catatan: 'teks?',
      status: STATUS_PELANGGAN,
      token_pantau: 'uuid',
      pin_pantau: 'pin',
      deleted_at: 'waktu?',
    },
    relasi: {},
  },
  transaksi_utang: {
    tabel: 'transaksi_utang',
    sisip: {
      pelanggan_id: 'uuid?',
      jenis: 'e:utang|tunai',
      tanggal: 'tgl',
      nominal: 'angka',
      keterangan: 'teks?',
      jatuh_tempo: 'tgl?',
      reminder_hari_sebelum: 'bulat',
      nomor_struk: 'teks?',
      created_at: 'waktu?',
      deleted_at: 'waktu?',
    },
    ubah: {
      pelanggan_id: 'uuid?',
      tanggal: 'tgl',
      nominal: 'angka',
      keterangan: 'teks?',
      jatuh_tempo: 'tgl?',
      reminder_hari_sebelum: 'bulat',
      deleted_at: 'waktu?',
    },
    relasi: { pelanggan_id: 'pelanggan' },
  },
  transaksi_item: {
    tabel: 'transaksi_item',
    sisip: {
      transaksi_id: 'uuid',
      urutan: 'bulat',
      nama_item: 'teks',
      qty: 'bulat',
      harga_satuan: 'angka',
      created_at: 'waktu?',
      deleted_at: 'waktu?',
    },
    ubah: {
      urutan: 'bulat',
      nama_item: 'teks',
      qty: 'bulat',
      harga_satuan: 'angka',
      deleted_at: 'waktu?',
    },
    relasi: { transaksi_id: 'transaksi_utang' },
  },
  pembayaran: {
    tabel: 'pembayaran',
    sisip: {
      transaksi_id: 'uuid',
      pelanggan_id: 'uuid',
      tanggal: 'tgl',
      nominal: 'angka',
      metode: 'e:tunai|transfer|qris|lainnya',
      catatan: 'teks?',
      created_at: 'waktu?',
      deleted_at: 'waktu?',
    },
    ubah: {
      tanggal: 'tgl',
      nominal: 'angka',
      metode: 'e:tunai|transfer|qris|lainnya',
      catatan: 'teks?',
      deleted_at: 'waktu?',
    },
    relasi: { transaksi_id: 'transaksi_utang', pelanggan_id: 'pelanggan' },
  },
};

const TIDAK_SAH = (kolom: string) => new GalatApi(422, `Nilai kolom ${kolom} tidak valid.`);

function sahkan(jenis: Jenis, nilai: unknown, kolom: string): unknown {
  const opsional = jenis.endsWith('?');
  const dasar = opsional ? jenis.slice(0, -1) : jenis;
  if (nilai === null || nilai === undefined) {
    if (opsional) return null;
    throw TIDAK_SAH(kolom);
  }
  if (dasar === 'uuid') {
    if (typeof nilai !== 'string' || !POLA_UUID.test(nilai)) throw TIDAK_SAH(kolom);
    return nilai.toLowerCase();
  }
  if (dasar === 'pin') {
    if (typeof nilai !== 'string' || !/^\d{6}$/.test(nilai)) throw TIDAK_SAH(kolom);
    return nilai;
  }
  if (dasar === 'teks') {
    if (typeof nilai !== 'string' || nilai.length > 5000) throw TIDAK_SAH(kolom);
    return nilai;
  }
  if (dasar === 'tgl') {
    if (typeof nilai !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(nilai)) throw TIDAK_SAH(kolom);
    return nilai;
  }
  if (dasar === 'waktu') {
    const t = typeof nilai === 'string' ? Date.parse(nilai) : NaN;
    if (Number.isNaN(t)) throw TIDAK_SAH(kolom);
    return new Date(t).toISOString();
  }
  if (dasar === 'angka') {
    if (typeof nilai !== 'number' || !Number.isFinite(nilai) || nilai < 0 || nilai > 1e13) {
      throw TIDAK_SAH(kolom);
    }
    return nilai;
  }
  if (dasar === 'bulat') {
    if (typeof nilai !== 'number' || !Number.isInteger(nilai) || Math.abs(nilai) > 1e9) {
      throw TIDAK_SAH(kolom);
    }
    return nilai;
  }
  if (dasar.startsWith('e:')) {
    if (typeof nilai !== 'string' || !dasar.slice(2).split('|').includes(nilai)) {
      throw TIDAK_SAH(kolom);
    }
    return nilai;
  }
  throw TIDAK_SAH(kolom);
}

function ambilSpek(nama: string | undefined): Spesifikasi {
  const spek = nama ? SPEK[nama] : undefined;
  if (!spek) throw new GalatApi(404, 'Data tidak dikenal.');
  return spek;
}

// ── Warung ────────────────────────────────────────────────────────────────

const tanpaPeran = (warung: any) => {
  const { role: _role, ...sisa } = warung;
  void _role;
  return sisa;
};

export async function ambilWarung(req: Request, env: Env): Promise<Response> {
  const pengguna = await wajibMasuk(req, env);
  const warung = await warungPengguna(env, pengguna.id);
  return json({ warung: warung ? tanpaPeran(warung) : null });
}

/** Pengganti RPC buat_warung(): warung + keanggotaan pemilik + langganan percobaan. */
export async function buatWarung(req: Request, env: Env): Promise<Response> {
  const pengguna = await wajibMasuk(req, env);
  const ada = await warungPengguna(env, pengguna.id);
  if (ada) return json({ warung: tanpaPeran(ada) });

  const badan = await bacaJson(req);
  const nama = typeof badan.nama_warung === 'string' ? badan.nama_warung.trim() : '';
  if (!nama) throw new GalatApi(422, 'Nama warung wajib diisi.');
  if (nama.length > 120) throw new GalatApi(422, 'Nama warung terlalu panjang.');
  const noWa = sahkan('teks?', badan.no_wa, 'no_wa');
  const alamat = sahkan('teks?', badan.alamat, 'alamat');
  const tempo = Number.isInteger(badan.tempo_default_hari) ? (badan.tempo_default_hari as number) : 0;

  const id = crypto.randomUUID();
  const waktu = sekarangIso();
  const trial = new Date(Date.now() + 14 * 86400_000).toISOString();
  await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO warung (id, pemilik_id, nama_warung, alamat, no_wa_warung, tempo_default_hari, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    ).bind(id, pengguna.id, nama, alamat, noWa, tempo, waktu, waktu),
    env.DB.prepare(
      "INSERT INTO warung_anggota (warung_id, user_id, role, created_at) VALUES (?, ?, 'pemilik', ?)",
    ).bind(id, pengguna.id, waktu),
    env.DB.prepare(
      'INSERT INTO subscriptions (warung_id, trial_sampai, updated_at) VALUES (?, ?, ?)',
    ).bind(id, trial, waktu),
  ]);
  const warung = await warungPengguna(env, pengguna.id);
  return json({ warung: tanpaPeran(warung) });
}

// ── Tarik ─────────────────────────────────────────────────────────────────

const BATAS_HALAMAN = 500;

export async function tarik(req: Request, env: Env, nama: string): Promise<Response> {
  const pengguna = await wajibMasuk(req, env);
  const warung = await wajibWarung(env, pengguna.id);
  const spek = ambilSpek(nama);
  const url = new URL(req.url);

  const sejak = url.searchParams.get('sejak') ?? '1970-01-01T00:00:00.000Z';
  if (Number.isNaN(Date.parse(sejak))) throw new GalatApi(400, 'Parameter sejak tidak valid.');
  const batas = Math.min(Number(url.searchParams.get('batas')) || BATAS_HALAMAN, BATAS_HALAMAN);

  const kolomWarung = spek.tabel === 'warung' ? 'id' : 'warung_id';
  const { results } = await env.DB.prepare(
    `SELECT * FROM ${spek.tabel} WHERE ${kolomWarung} = ? AND updated_at >= ? ORDER BY updated_at ASC LIMIT ?`,
  )
    .bind(warung.id, sejak, batas)
    .all();
  return json({ data: results });
}

// ── Dorong ────────────────────────────────────────────────────────────────

/** Menghitung ulang total_dibayar dan status satu transaksi (pengganti trigger Postgres). */
async function hitungUlang(env: Env, transaksiId: string): Promise<void> {
  const t = await env.DB.prepare('SELECT jenis, nominal FROM transaksi_utang WHERE id = ?')
    .bind(transaksiId)
    .first();
  if (!t) return;

  let total: number;
  let status: string;
  if (t.jenis === 'tunai') {
    total = t.nominal;
    status = 'lunas';
  } else {
    const jumlah = await env.DB.prepare(
      'SELECT COALESCE(SUM(nominal), 0) AS total FROM pembayaran WHERE transaksi_id = ? AND deleted_at IS NULL',
    )
      .bind(transaksiId)
      .first();
    total = Number(jumlah?.total ?? 0);
    status = total >= t.nominal ? 'lunas' : total > 0 ? 'sebagian' : 'belum_lunas';
  }
  await env.DB.prepare(
    'UPDATE transaksi_utang SET total_dibayar = ?, status = ?, updated_at = ? WHERE id = ?',
  )
    .bind(total, status, sekarangIso(), transaksiId)
    .run();
}

async function pastikanMilikWarung(env: Env, tabel: string, id: unknown, warungId: string) {
  if (id === null || id === undefined) return;
  const ada = await env.DB.prepare(`SELECT 1 AS x FROM ${tabel} WHERE id = ? AND warung_id = ?`)
    .bind(id, warungId)
    .first();
  if (!ada) throw new GalatApi(422, 'Data yang dirujuk tidak ditemukan.');
}

export async function dorong(req: Request, env: Env, nama: string): Promise<Response> {
  const pengguna = await wajibMasuk(req, env);
  const warung = await wajibWarung(env, pengguna.id);
  const spek = ambilSpek(nama);
  const badan = await bacaJson(req);
  const muatan = (badan.muatan ?? badan) as Record<string, unknown>;
  const waktu = sekarangIso();

  try {
    if (spek.tabel === 'warung') {
      const set: string[] = [];
      const nilai: unknown[] = [];
      for (const [kolom, jenis] of Object.entries(spek.ubah)) {
        if (!(kolom in muatan)) continue;
        set.push(`${kolom} = ?`);
        nilai.push(sahkan(jenis, muatan[kolom], kolom));
      }
      if (set.length > 0) {
        await env.DB.prepare(`UPDATE warung SET ${set.join(', ')}, updated_at = ? WHERE id = ?`)
          .bind(...nilai, waktu, warung.id)
          .run();
      }
      return json({ ok: true });
    }

    const id = sahkan('uuid', muatan.id, 'id') as string;
    const ada = await env.DB.prepare(`SELECT warung_id FROM ${spek.tabel} WHERE id = ?`)
      .bind(id)
      .first();
    if (ada && ada.warung_id !== warung.id) throw new GalatApi(403, 'Tidak diizinkan.');

    const kolomDipakai = ada ? spek.ubah : spek.sisip;
    const kolom: string[] = [];
    const nilai: unknown[] = [];
    for (const [nm, jenis] of Object.entries(kolomDipakai)) {
      if (!(nm in muatan)) continue;
      const bersih = sahkan(jenis, muatan[nm], nm);
      if (nm in spek.relasi) await pastikanMilikWarung(env, spek.relasi[nm] as string, bersih, warung.id);
      kolom.push(nm);
      nilai.push(bersih);
    }

    if (ada) {
      if (kolom.length > 0) {
        await env.DB.prepare(
          `UPDATE ${spek.tabel} SET ${kolom.map((k) => `${k} = ?`).join(', ')}, updated_at = ? WHERE id = ? AND warung_id = ?`,
        )
          .bind(...nilai, waktu, id, warung.id)
          .run();
      }
    } else {
      const tambahan: Record<string, unknown> = { id, warung_id: warung.id, updated_at: waktu };
      if (!kolom.includes('created_at')) tambahan.created_at = waktu;
      if (spek.tabel === 'transaksi_utang' || spek.tabel === 'pembayaran') {
        tambahan.dibuat_oleh = pengguna.id;
      }
      const semua = [...kolom, ...Object.keys(tambahan)];
      await env.DB.prepare(
        `INSERT INTO ${spek.tabel} (${semua.join(', ')}) VALUES (${semua.map(() => '?').join(', ')})`,
      )
        .bind(...nilai, ...Object.values(tambahan))
        .run();
    }

    if (spek.tabel === 'transaksi_utang') await hitungUlang(env, id);
    if (spek.tabel === 'pembayaran') {
      const baris = await env.DB.prepare('SELECT transaksi_id FROM pembayaran WHERE id = ?')
        .bind(id)
        .first();
      if (baris) await hitungUlang(env, baris.transaksi_id as string);
    }
    return json({ ok: true });
  } catch (galat) {
    if (galat instanceof GalatApi) throw galat;
    const pesan = galat instanceof Error ? galat.message : '';
    // Batasan database (NOT NULL, CHECK, UNIQUE) = muatan salah, bukan server rusak.
    if (/constraint/i.test(pesan)) throw new GalatApi(422, 'Data ditolak karena tidak memenuhi aturan.');
    throw galat;
  }
}

// ── Foto ──────────────────────────────────────────────────────────────────

const FOTO_MAKS_BYTE = 3 * 1024 * 1024;

export async function unggahFoto(req: Request, env: Env, pelangganId: string): Promise<Response> {
  const pengguna = await wajibMasuk(req, env);
  const warung = await wajibWarung(env, pengguna.id);
  if (!POLA_UUID.test(pelangganId)) throw new GalatApi(400, 'Id tidak valid.');

  const isi = await req.arrayBuffer();
  if (isi.byteLength === 0 || isi.byteLength > FOTO_MAKS_BYTE) {
    throw new GalatApi(413, 'Ukuran foto tidak sesuai.');
  }
  await env.FOTO.put(`${warung.id}/${pelangganId.toLowerCase()}.jpg`, isi, {
    httpMetadata: { contentType: 'image/jpeg' },
  });
  return json({ ok: true });
}

export async function ambilFoto(req: Request, env: Env, pelangganId: string): Promise<Response> {
  const pengguna = await wajibMasuk(req, env);
  const warung = await wajibWarung(env, pengguna.id);
  if (!POLA_UUID.test(pelangganId)) throw new GalatApi(400, 'Id tidak valid.');

  const objek = await env.FOTO.get(`${warung.id}/${pelangganId.toLowerCase()}.jpg`);
  if (!objek) throw new GalatApi(404, 'Foto tidak ada.');
  return new Response(objek.body, {
    headers: { 'Content-Type': 'image/jpeg', 'Cache-Control': 'private, max-age=3600' },
  });
}

// ── Reset data ────────────────────────────────────────────────────────────

/** Pengganti RPC reset_data_warung(): hapus-lunak semua data, hapus foto. Pemilik saja. */
export async function resetData(req: Request, env: Env): Promise<Response> {
  const pengguna = await wajibMasuk(req, env);
  const warung = await wajibWarung(env, pengguna.id);
  if (warung.pemilik_id !== pengguna.id) {
    throw new GalatApi(403, 'Hanya pemilik warung yang bisa mereset data.');
  }
  const waktu = sekarangIso();
  const tandai = (tabel: string) =>
    env.DB.prepare(
      `UPDATE ${tabel} SET deleted_at = ?1, updated_at = ?1 WHERE warung_id = ?2 AND deleted_at IS NULL`,
    ).bind(waktu, warung.id);

  const [item, bayar, utang, pelanggan] = await env.DB.batch([
    tandai('transaksi_item'),
    tandai('pembayaran'),
    tandai('transaksi_utang'),
    tandai('pelanggan'),
  ]);

  // Foto dihapus sebisanya; datanya sendiri sudah terhapus.
  try {
    let kursor: string | undefined;
    do {
      const daftar = await env.FOTO.list({ prefix: `${warung.id}/`, cursor: kursor, limit: 500 });
      const kunci = (daftar.objects as { key: string }[]).map((o) => o.key);
      if (kunci.length > 0) await env.FOTO.delete(kunci);
      kursor = daftar.truncated ? daftar.cursor : undefined;
    } while (kursor);
  } catch {
    /* diabaikan dengan sengaja */
  }

  return json({
    pelanggan: pelanggan.meta.changes,
    utang: utang.meta.changes,
    pembayaran: bayar.meta.changes,
    item: item.meta.changes,
  });
}

// ── Jadwal harian ─────────────────────────────────────────────────────────

/** Pengganti pg_cron tandai_reminder_jatuh_tempo(); jalan 06:00 WIB. */
export async function tandaiReminder(env: Env): Promise<void> {
  const hariIniWib = new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10);
  await env.DB.prepare(
    `UPDATE transaksi_utang
        SET reminder_terkirim_untuk = jatuh_tempo, updated_at = ?1
      WHERE deleted_at IS NULL AND status <> 'lunas' AND jatuh_tempo IS NOT NULL
        AND date(jatuh_tempo, '-' || reminder_hari_sebelum || ' days') <= ?2
        AND (reminder_terkirim_untuk IS NULL OR reminder_terkirim_untuk <> jatuh_tempo)`,
  )
    .bind(sekarangIso(), hariIniWib)
    .run();
}
