// Membuat tagihan langganan bulanan di Midtrans (Snap) untuk pemilik warung.
//
// Rahasia (diisi di Supabase > Edge Functions > Secrets, BUKAN di kode):
//   MIDTRANS_SERVER_KEY     kunci server Midtrans
//   MIDTRANS_IS_PRODUCTION  "true" untuk produksi; selain itu memakai sandbox
//   HARGA_LANGGANAN         opsional, bawaan 35000 (rupiah per 30 hari)
import { createClient } from 'npm:@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const balas = (badan: unknown, status = 200) =>
  new Response(JSON.stringify(badan), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
  if (req.method !== 'POST') return balas({ galat: 'Metode tidak didukung.' }, 405);

  const kunciServer = Deno.env.get('MIDTRANS_SERVER_KEY');
  if (!kunciServer) {
    return balas({ galat: 'Pembayaran belum disiapkan di server.' }, 503);
  }
  const harga = Number(Deno.env.get('HARGA_LANGGANAN') ?? '35000');
  const produksi = Deno.env.get('MIDTRANS_IS_PRODUCTION') === 'true';

  const url = Deno.env.get('SUPABASE_URL')!;
  const auth = req.headers.get('Authorization') ?? '';

  // Siapa yang meminta: dibaca dari token masuknya, bukan dari isi permintaan.
  const sebagaiPengguna = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: auth } },
  });
  const { data: pengguna } = await sebagaiPengguna.auth.getUser();
  if (!pengguna.user) return balas({ galat: 'Harus masuk dulu.' }, 401);

  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  // Hanya pemilik warung yang boleh membayar langganan warungnya.
  const { data: warung } = await admin
    .from('warung')
    .select('id')
    .eq('pemilik_id', pengguna.user.id)
    .maybeSingle();
  if (!warung) return balas({ galat: 'Hanya pemilik warung yang bisa berlangganan.' }, 403);

  const orderId = `UK-${warung.id.slice(0, 8)}-${Date.now()}`;

  const { error: galatOrder } = await admin
    .from('payment_orders')
    .insert({ order_id: orderId, warung_id: warung.id, amount: harga, status: 'pending' });
  if (galatOrder) return balas({ galat: 'Gagal membuat pesanan.' }, 500);

  const basis = produksi
    ? 'https://app.midtrans.com/snap/v1/transactions'
    : 'https://app.sandbox.midtrans.com/snap/v1/transactions';

  const tanggapan = await fetch(basis, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Authorization: `Basic ${btoa(`${kunciServer}:`)}`,
    },
    body: JSON.stringify({
      transaction_details: { order_id: orderId, gross_amount: harga },
      item_details: [
        { id: 'langganan-1-bulan', price: harga, quantity: 1, name: 'Langganan UtangKu 1 bulan' },
      ],
      customer_details: { email: pengguna.user.email },
    }),
  });

  if (!tanggapan.ok) {
    await admin.from('payment_orders').update({ status: 'failed' }).eq('order_id', orderId);
    return balas({ galat: 'Midtrans menolak permintaan. Coba lagi nanti.' }, 502);
  }

  const { token, redirect_url } = await tanggapan.json();
  return balas({ token, redirect_url, order_id: orderId, jumlah: harga });
});
