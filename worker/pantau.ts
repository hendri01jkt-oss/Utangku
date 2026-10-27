/* eslint-disable @typescript-eslint/no-explicit-any */
import { tambahGagal } from './auth';
import { bacaJson, type Env, json, POLA_UUID, samaPersis, sekarangIso } from './util';

/*
 * Link pantau publik: pelanggan membuka /pantau/{token} dan memasukkan PIN
 * 6 angka untuk melihat catatan utangnya sendiri. Tidak butuh akun.
 *
 * Link saja tidak cukup. PIN diperiksa di sini, salah 5 kali mengunci
 * link 15 menit, dan sebelum PIN benar yang keluar hanya nama warung.
 */

const MAKS_GAGAL = 5;
const KUNCI_DETIK = 15 * 60;

export async function pantau(req: Request, env: Env): Promise<Response> {
  const badan = await bacaJson(req);
  const token = typeof badan.p_token === 'string' ? badan.p_token.toLowerCase() : '';
  const pin = typeof badan.p_pin === 'string' ? badan.p_pin : '';
  // Token salah bentuk dijawab sama dengan token tak dikenal.
  if (!POLA_UUID.test(token)) return json(null);

  const pelanggan = await env.DB.prepare(
    'SELECT * FROM pelanggan WHERE token_pantau = ? AND deleted_at IS NULL',
  )
    .bind(token)
    .first();
  if (!pelanggan) return json(null);

  const warung = await env.DB.prepare('SELECT nama_warung, no_wa_warung FROM warung WHERE id = ?')
    .bind(pelanggan.warung_id)
    .first();
  if (!warung) return json(null);

  const kunci = await env.DB.prepare(
    'SELECT terkunci_sampai FROM pantau_percobaan WHERE token_pantau = ?',
  )
    .bind(token)
    .first();
  const kunciSampai = kunci?.terkunci_sampai as string | null | undefined;
  if (kunciSampai && kunciSampai > sekarangIso()) {
    return json({
      status: 'terkunci',
      sisa_detik: Math.ceil((Date.parse(kunciSampai) - Date.now()) / 1000),
    });
  }

  // Belum memasukkan PIN bukan tebakan: tidak dihitung.
  if (pin === '') return json({ status: 'butuh_pin', nama_warung: warung.nama_warung });

  if (!samaPersis(pin, pelanggan.pin_pantau as string)) {
    const gagal = await tambahGagal(env, 'pantau_percobaan', 'token_pantau', token);
    if (gagal >= MAKS_GAGAL) {
      await env.DB.prepare(
        'UPDATE pantau_percobaan SET terkunci_sampai = ?, gagal = 0 WHERE token_pantau = ?',
      )
        .bind(new Date(Date.now() + KUNCI_DETIK * 1000).toISOString(), token)
        .run();
      return json({ status: 'terkunci', sisa_detik: KUNCI_DETIK });
    }
    return json({
      status: 'pin_salah',
      nama_warung: warung.nama_warung,
      sisa_percobaan: MAKS_GAGAL - gagal,
    });
  }

  await env.DB.prepare('DELETE FROM pantau_percobaan WHERE token_pantau = ?').bind(token).run();

  const [transaksi, item, pembayaran] = await Promise.all([
    env.DB.prepare(
      `SELECT id, tanggal, keterangan, nominal, total_dibayar, jatuh_tempo, status, nomor_struk, created_at
         FROM transaksi_utang
        WHERE pelanggan_id = ? AND deleted_at IS NULL AND jenis = 'utang'
        ORDER BY tanggal DESC, created_at DESC`,
    )
      .bind(pelanggan.id)
      .all(),
    env.DB.prepare(
      `SELECT i.transaksi_id, i.nama_item, i.qty, i.harga_satuan, i.subtotal
         FROM transaksi_item i
        WHERE i.deleted_at IS NULL AND i.transaksi_id IN (
              SELECT id FROM transaksi_utang
               WHERE pelanggan_id = ? AND deleted_at IS NULL AND jenis = 'utang')
        ORDER BY i.urutan, i.created_at`,
    )
      .bind(pelanggan.id)
      .all(),
    env.DB.prepare(
      `SELECT b.tanggal, b.created_at, b.nominal, b.metode, u.keterangan AS untuk_keterangan, u.tanggal AS untuk_tanggal
         FROM pembayaran b JOIN transaksi_utang u ON u.id = b.transaksi_id
        WHERE b.pelanggan_id = ? AND b.deleted_at IS NULL
        ORDER BY b.tanggal DESC, b.created_at DESC`,
    )
      .bind(pelanggan.id)
      .all(),
  ]);

  const perTransaksi = new Map<string, any[]>();
  for (const baris of item.results as any[]) {
    const daftar = perTransaksi.get(baris.transaksi_id) ?? [];
    daftar.push({
      nama_item: baris.nama_item,
      qty: baris.qty,
      harga_satuan: baris.harga_satuan,
      subtotal: baris.subtotal,
    });
    perTransaksi.set(baris.transaksi_id, daftar);
  }

  const daftarTransaksi = (transaksi.results as any[]).map((t) => ({
    tanggal: t.tanggal,
    keterangan: t.keterangan,
    nominal: t.nominal,
    total_dibayar: t.total_dibayar,
    jatuh_tempo: t.jatuh_tempo,
    status: t.status,
    nomor_struk: t.nomor_struk,
    dicatat: t.created_at,
    item: perTransaksi.get(t.id) ?? [],
  }));
  const sisaUtang = (transaksi.results as any[]).reduce(
    (jumlah, t) => jumlah + Math.max(t.nominal - t.total_dibayar, 0),
    0,
  );

  // Stempel kunjungan, dibatasi supaya menyegarkan halaman tidak jadi rentetan tulis.
  const lima = new Date(Date.now() - 5 * 60_000).toISOString();
  const terakhir = pelanggan.terakhir_dilihat_pelanggan as string | null;
  if (!terakhir || terakhir < lima) {
    // updated_at sengaja TIDAK disentuh: kunjungan pelanggan tidak boleh
    // memicu putaran sinkron palsu di HP pemilik warung.
    await env.DB.prepare('UPDATE pelanggan SET terakhir_dilihat_pelanggan = ? WHERE id = ?')
      .bind(sekarangIso(), pelanggan.id)
      .run();
  }

  // Kolom disebut satu per satu: no_wa, alamat, catatan, dan foto pelanggan
  // tidak ada urusannya dengan tagihan yang diperiksa.
  return json({
    status: 'ok',
    warung: { nama_warung: warung.nama_warung, no_wa_warung: warung.no_wa_warung },
    pelanggan: { nama: pelanggan.nama },
    sisa_utang: sisaUtang,
    transaksi: daftarTransaksi,
    pembayaran: pembayaran.results,
  });
}
