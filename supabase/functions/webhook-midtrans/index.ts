// Menerima kabar pembayaran dari Midtrans dan memperpanjang langganan.
//
// Dipasang TANPA verifikasi JWT (Midtrans tidak punya token pengguna);
// keasliannya dijamin oleh signature_key, yang hanya bisa dibuat oleh pihak
// yang tahu MIDTRANS_SERVER_KEY. Alamat webhook ini diisi di dashboard
// Midtrans: Settings > Configuration > Payment Notification URL.
import { createClient } from 'npm:@supabase/supabase-js@2';

const HARI_PER_BULAN = 30;

const balas = (badan: unknown, status = 200) =>
  new Response(JSON.stringify(badan), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

async function sha512(teks: string): Promise<string> {
  const hash = await crypto.subtle.digest('SHA-512', new TextEncoder().encode(teks));
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/** Perbandingan yang waktunya tidak bergantung pada letak selisih. */
function samaPersis(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let selisih = 0;
  for (let i = 0; i < a.length; i++) selisih |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return selisih === 0;
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return balas({ galat: 'Metode tidak didukung.' }, 405);

  const kunciServer = Deno.env.get('MIDTRANS_SERVER_KEY');
  if (!kunciServer) return balas({ galat: 'Belum disiapkan.' }, 503);

  let n: Record<string, string>;
  try {
    n = await req.json();
  } catch {
    return balas({ galat: 'Isi tidak valid.' }, 400);
  }

  const { order_id, status_code, gross_amount, signature_key } = n;
  if (!order_id || !status_code || !gross_amount || !signature_key) {
    return balas({ galat: 'Isi tidak lengkap.' }, 400);
  }

  const seharusnya = await sha512(`${order_id}${status_code}${gross_amount}${kunciServer}`);
  if (!samaPersis(seharusnya, String(signature_key))) {
    return balas({ galat: 'Tanda tangan tidak cocok.' }, 401);
  }

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const { data: pesanan } = await admin
    .from('payment_orders')
    .select('order_id, warung_id, amount, status')
    .eq('order_id', order_id)
    .maybeSingle();
  if (!pesanan) return balas({ galat: 'Pesanan tidak dikenal.' }, 404);

  // Nominal yang dibayar harus sama dengan nominal pesanan.
  if (Math.round(Number(gross_amount)) !== Math.round(Number(pesanan.amount))) {
    return balas({ galat: 'Nominal tidak cocok.' }, 400);
  }

  const kabar = n.transaction_status;
  const lunas =
    kabar === 'settlement' || (kabar === 'capture' && n.fraud_status === 'accept');

  if (!lunas) {
    const status =
      kabar === 'expire' ? 'expired' : ['deny', 'cancel', 'failure'].includes(kabar) ? 'failed' : null;
    // Jangan menurunkan pesanan yang sudah lunas.
    if (status && pesanan.status !== 'settlement') {
      await admin.from('payment_orders').update({ status }).eq('order_id', order_id);
    }
    return balas({ ok: true });
  }

  // Idempoten: Midtrans bisa mengirim kabar yang sama berkali-kali. Hanya
  // pemanggil yang berhasil mengubah status ke settlement yang boleh
  // memperpanjang langganan.
  const { data: diubah } = await admin
    .from('payment_orders')
    .update({ status: 'settlement', midtrans_transaction_id: n.transaction_id ?? null })
    .eq('order_id', order_id)
    .neq('status', 'settlement')
    .select('order_id');
  if (!diubah || diubah.length === 0) return balas({ ok: true, sudah: true });

  const { data: langganan } = await admin
    .from('subscriptions')
    .select('tanggal_expired')
    .eq('warung_id', pesanan.warung_id)
    .maybeSingle();

  const sekarang = new Date();
  const sisa = langganan?.tanggal_expired ? new Date(langganan.tanggal_expired) : null;
  // Perpanjang dari tanggal berakhir bila masih berlaku, supaya bayar lebih
  // awal tidak menghanguskan sisa hari.
  const mulai = sisa && sisa > sekarang ? sisa : sekarang;
  const baru = new Date(mulai.getTime() + HARI_PER_BULAN * 24 * 3600 * 1000);

  await admin
    .from('subscriptions')
    .update({
      tier: 'pro',
      status: 'active',
      tanggal_expired: baru.toISOString(),
      tanggal_mulai_langganan: sisa && sisa > sekarang ? undefined : sekarang.toISOString(),
      payment_provider: 'midtrans',
      payment_reference: order_id,
    })
    .eq('warung_id', pesanan.warung_id);

  return balas({ ok: true });
});
