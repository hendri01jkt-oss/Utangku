/* eslint-disable @typescript-eslint/no-explicit-any */
import { wajibMasuk, wajibWarung } from './auth';
import { type Env, GalatApi, json, samaPersis, sekarangIso, sha512Hex } from './util';

const HARI_PER_BULAN = 30;

export async function ambilLangganan(req: Request, env: Env): Promise<Response> {
  const pengguna = await wajibMasuk(req, env);
  const warung = await wajibWarung(env, pengguna.id);
  const baris = await env.DB.prepare(
    'SELECT tier, status, tanggal_expired, trial_sampai FROM subscriptions WHERE warung_id = ?',
  )
    .bind(warung.id)
    .first();
  return json({ langganan: baris ?? null });
}

export async function buatTagihan(req: Request, env: Env): Promise<Response> {
  if (!env.MIDTRANS_SERVER_KEY) throw new GalatApi(503, 'Pembayaran belum disiapkan di server.');
  const pengguna = await wajibMasuk(req, env);
  const warung = await wajibWarung(env, pengguna.id);
  if (warung.pemilik_id !== pengguna.id) {
    throw new GalatApi(403, 'Hanya pemilik warung yang bisa berlangganan.');
  }

  const harga = Number(env.HARGA_LANGGANAN ?? '35000');
  const orderId = `UK-${String(warung.id).slice(0, 8)}-${Date.now()}`;
  const waktu = sekarangIso();
  await env.DB.prepare(
    "INSERT INTO payment_orders (order_id, warung_id, amount, status, created_at, updated_at) VALUES (?, ?, ?, 'pending', ?, ?)",
  )
    .bind(orderId, warung.id, harga, waktu, waktu)
    .run();

  const alamat =
    env.MIDTRANS_IS_PRODUCTION === 'true'
      ? 'https://app.midtrans.com/snap/v1/transactions'
      : 'https://app.sandbox.midtrans.com/snap/v1/transactions';
  const tanggapan = await fetch(alamat, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Authorization: `Basic ${btoa(`${env.MIDTRANS_SERVER_KEY}:`)}`,
    },
    body: JSON.stringify({
      transaction_details: { order_id: orderId, gross_amount: harga },
      item_details: [
        { id: 'langganan-1-bulan', price: harga, quantity: 1, name: 'Langganan UtangKu 1 bulan' },
      ],
      customer_details: { email: pengguna.email },
      callbacks: { finish: new URL(req.url).origin },
    }),
  });

  if (!tanggapan.ok) {
    await env.DB.prepare("UPDATE payment_orders SET status = 'failed', updated_at = ? WHERE order_id = ?")
      .bind(sekarangIso(), orderId)
      .run();
    throw new GalatApi(502, 'Midtrans menolak permintaan. Coba lagi nanti.');
  }
  const { token, redirect_url } = (await tanggapan.json()) as { token: string; redirect_url: string };
  return json({ token, redirect_url, order_id: orderId, jumlah: harga });
}

/** Webhook Midtrans: tanda tangan dicek, nominal dicocokkan, perpanjangan idempoten. */
export async function webhookMidtrans(req: Request, env: Env): Promise<Response> {
  if (!env.MIDTRANS_SERVER_KEY) throw new GalatApi(503, 'Belum disiapkan.');

  let n: Record<string, string>;
  try {
    n = (await req.json()) as Record<string, string>;
  } catch {
    throw new GalatApi(400, 'Isi tidak valid.');
  }
  const { order_id, status_code, gross_amount, signature_key } = n;
  if (!order_id || !status_code || !gross_amount || !signature_key) {
    throw new GalatApi(400, 'Isi tidak lengkap.');
  }

  const seharusnya = await sha512Hex(`${order_id}${status_code}${gross_amount}${env.MIDTRANS_SERVER_KEY}`);
  if (!samaPersis(seharusnya, String(signature_key))) throw new GalatApi(401, 'Tanda tangan tidak cocok.');

  const pesanan = await env.DB.prepare(
    'SELECT order_id, warung_id, amount, status FROM payment_orders WHERE order_id = ?',
  )
    .bind(order_id)
    .first();
  if (!pesanan) throw new GalatApi(404, 'Pesanan tidak dikenal.');
  if (Math.round(Number(gross_amount)) !== Math.round(Number(pesanan.amount))) {
    throw new GalatApi(400, 'Nominal tidak cocok.');
  }

  const kabar = n.transaction_status;
  const lunas = kabar === 'settlement' || (kabar === 'capture' && n.fraud_status === 'accept');
  if (!lunas) {
    const status =
      kabar === 'expire' ? 'expired' : ['deny', 'cancel', 'failure'].includes(kabar) ? 'failed' : null;
    if (status && pesanan.status !== 'settlement') {
      await env.DB.prepare('UPDATE payment_orders SET status = ?, updated_at = ? WHERE order_id = ?')
        .bind(status, sekarangIso(), order_id)
        .run();
    }
    return json({ ok: true });
  }

  // Penanda lunas diambil secara atomik: notifikasi ganda tidak menambah hari dua kali.
  const ubah = await env.DB.prepare(
    "UPDATE payment_orders SET status = 'settlement', midtrans_transaction_id = ?, updated_at = ? WHERE order_id = ? AND status <> 'settlement'",
  )
    .bind(n.transaction_id ?? null, sekarangIso(), order_id)
    .run();
  if (!ubah.meta?.changes) return json({ ok: true, sudah: true });

  const langganan = await env.DB.prepare('SELECT tanggal_expired FROM subscriptions WHERE warung_id = ?')
    .bind(pesanan.warung_id)
    .first();
  const sekarang = new Date();
  const sisa = langganan?.tanggal_expired ? new Date(langganan.tanggal_expired as string) : null;
  const masihAktif = sisa !== null && sisa > sekarang;
  const mulai = masihAktif ? (sisa as Date) : sekarang;
  const baru = new Date(mulai.getTime() + HARI_PER_BULAN * 86400_000).toISOString();

  await env.DB.prepare(
    `UPDATE subscriptions
        SET tier = 'pro', status = 'active', tanggal_expired = ?,
            tanggal_mulai_langganan = CASE WHEN ? = 1 THEN tanggal_mulai_langganan ELSE ? END,
            payment_provider = 'midtrans', payment_reference = ?, updated_at = ?
      WHERE warung_id = ?`,
  )
    .bind(baru, masihAktif ? 1 : 0, sekarang.toISOString(), order_id, sekarangIso(), pesanan.warung_id)
    .run();

  return json({ ok: true });
}
