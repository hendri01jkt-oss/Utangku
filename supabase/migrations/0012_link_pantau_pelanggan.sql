-- Link pantau: pelanggan membuka /pantau/{token} tanpa login untuk melihat
-- riwayat utangnya sendiri.
--
-- Pendekatan keamanannya sengaja TIDAK berupa policy RLS untuk peran anon.
-- Alasannya: token hanya bisa dipercaya kalau database yang memeriksanya.
-- Kalau token cuma jadi filter di URL (?token_pantau=eq.xxx), filter itu
-- milik pemanggil — siapa pun tinggal menghapusnya dan mengambil seluruh
-- tabel. Satu-satunya jalur yang bisa dipercaya adalah header khusus, dan
-- itu menuntut empat policy di empat tabel yang masing-masing jadi peluang
-- membocorkan seluruh isi tabel.
--
-- Jadi: tabel tetap TERTUTUP PENUH untuk anon (RLS tanpa policy, plus hak
-- aksesnya dicabut di bawah), dan satu-satunya pintu publik adalah fungsi
-- security definer di berkas ini — pendek, kolomnya disebut satu per satu,
-- dan bisa dibaca sekali untuk memastikan tidak ada yang bocor.

-- ── Kolom baru ─────────────────────────────────────────────────────────────

alter table public.pelanggan
  add column token_pantau uuid not null default gen_random_uuid(),
  add column terakhir_dilihat_pelanggan timestamptz;

-- Sengaja BUKAN pelanggan.id. ID itu sudah muncul di URL aplikasi pemilik,
-- di muatan outbox, dan di setiap perangkat yang pernah sinkron; memakainya
-- sebagai kunci akses membuat setiap tempat ID bocor menjadi tempat utang
-- bocor. gen_random_uuid() memberi 122 bit acak dari CSPRNG.
create unique index pelanggan_token_pantau_idx on public.pelanggan (token_pantau);

comment on column public.pelanggan.token_pantau is
  'Kunci akses link pantau publik. Bisa diganti pemilik warung bila bocor.';
comment on column public.pelanggan.terakhir_dilihat_pelanggan is
  'Kapan pelanggan terakhir membuka link pantaunya. Hanya ditulis fungsi pantau_utang().';

-- ── updated_at tidak boleh ikut terdorong oleh kunjungan pelanggan ─────────
--
-- Trigger set_updated_at menyetel updated_at = now() pada SETIAP update, dan
-- mesin sync menarik data dengan kursor updated_at > sinkron_terakhir. Tanpa
-- syarat di bawah, setiap kali pelanggan menyegarkan halamannya baris itu
-- ikut terdorong ulang ke HP pemilik warung — putaran sync palsu di HP yang
-- justru sedang menghemat kuota.
--
-- WHEN di bawah membaca: perbarui updated_at hanya kalau yang berubah BUKAN
-- sekadar stempel kunjungan. Perubahan yang menyentuh keduanya sekaligus
-- tidak mungkin terjadi — hak UPDATE kolom stempel sudah dicabut dari
-- authenticated di bawah, jadi hanya fungsi definer yang bisa menulisnya.
drop trigger set_updated_at on public.pelanggan;
create trigger set_updated_at before update on public.pelanggan
  for each row
  when (old.terakhir_dilihat_pelanggan is not distinct from new.terakhir_dilihat_pelanggan)
  execute function public.fn_set_updated_at();

-- ── Hak kolom: client tidak boleh menulis stempel kunjungan ────────────────
--
-- Mencabut hak kolom saja tidak cukup selama masih ada grant di level tabel;
-- PostgreSQL tidak bisa "mengurangi" satu kolom dari grant tabel. Jadi grant
-- tabelnya dicabut dulu, lalu diberikan ulang per kolom — pola yang sama
-- dengan status/total_dibayar di migrasi 0003.
--
-- Kalau tidak: baris pelanggan yang ditarik ke perangkat membawa serta
-- stempel kunjungan, dan suntingan berikutnya mengirimkannya kembali dengan
-- nilai yang sudah basi — menimpa kunjungan yang lebih baru di server.
revoke insert, update on public.pelanggan from authenticated;

grant insert (
  id, warung_id, nama, no_wa, alamat, foto_path, catatan, status,
  deleted_at, token_pantau
) on public.pelanggan to authenticated;

-- id dan warung_id tidak ikut: identitas pelanggan dan warung pemiliknya
-- tidak boleh berpindah lewat sinkronisasi.
grant update (
  nama, no_wa, alamat, foto_path, catatan, status, deleted_at, token_pantau
) on public.pelanggan to authenticated;

-- ── Satu-satunya pintu publik ──────────────────────────────────────────────

create or replace function public.pantau_utang(p_token uuid)
returns jsonb
language plpgsql
security definer
-- search_path kosong seperti warung_saya(): fungsi definer tanpa ini bisa
-- dibelokkan ke objek bernama sama di schema lain.
set search_path = ''
as $$
declare
  v_pelanggan public.pelanggan;
  v_warung public.warung;
  v_hasil jsonb;
begin
  select * into v_pelanggan
  from public.pelanggan
  where token_pantau = p_token and deleted_at is null;

  -- Token tidak dikenal, atau pelanggannya sudah dihapus: jawabannya sama
  -- persis. Membedakan keduanya memberi tahu penebak bahwa tokennya "hampir
  -- benar", dan itu satu-satunya umpan balik yang berguna bagi penebak.
  if not found then
    return null;
  end if;

  select * into v_warung from public.warung where id = v_pelanggan.warung_id;
  if not found then
    return null;
  end if;

  -- Kolom disebut satu per satu, bukan row_to_json. Kolom yang ditambahkan
  -- di kemudian hari tidak boleh ikut terbawa ke halaman publik hanya karena
  -- lupa diperiksa — dan no_wa, alamat, catatan, serta foto pelanggan tidak
  -- ada urusannya dengan tagihan yang sedang ia periksa.
  v_hasil := jsonb_build_object(
    'warung', jsonb_build_object(
      'nama_warung', v_warung.nama_warung,
      'no_wa_warung', v_warung.no_wa_warung
    ),
    'pelanggan', jsonb_build_object('nama', v_pelanggan.nama),
    'sisa_utang', coalesce((
      select sum(greatest(t.nominal - t.total_dibayar, 0))
      from public.transaksi_utang t
      where t.pelanggan_id = v_pelanggan.id and t.deleted_at is null
    ), 0),
    'transaksi', coalesce((
      select jsonb_agg(jsonb_build_object(
               'tanggal', t.tanggal,
               'keterangan', t.keterangan,
               'nominal', t.nominal,
               'total_dibayar', t.total_dibayar,
               'jatuh_tempo', t.jatuh_tempo,
               'status', t.status
             ) order by t.tanggal desc, t.created_at desc)
      from public.transaksi_utang t
      where t.pelanggan_id = v_pelanggan.id and t.deleted_at is null
    ), '[]'::jsonb),
    'pembayaran', coalesce((
      select jsonb_agg(jsonb_build_object(
               'tanggal', b.tanggal,
               'nominal', b.nominal,
               'metode', b.metode
             ) order by b.tanggal desc, b.created_at desc)
      from public.pembayaran b
      where b.pelanggan_id = v_pelanggan.id and b.deleted_at is null
    ), '[]'::jsonb)
  );

  -- Stempel kunjungan, dibatasi supaya menyegarkan halaman berkali-kali
  -- tidak berubah menjadi rentetan penulisan pada tabel yang paling sering
  -- dibaca aplikasi.
  if v_pelanggan.terakhir_dilihat_pelanggan is null
     or v_pelanggan.terakhir_dilihat_pelanggan < now() - interval '5 minutes' then
    update public.pelanggan
       set terakhir_dilihat_pelanggan = now()
     where id = v_pelanggan.id;
  end if;

  return v_hasil;
end;
$$;

revoke execute on function public.pantau_utang(uuid) from public;
grant execute on function public.pantau_utang(uuid) to anon, authenticated;

-- ── Lapisan kedua: anon tidak punya hak baca tabel sama sekali ─────────────
--
-- Supabase memberi anon grant penuh atas semua tabel di schema public secara
-- bawaan. Yang menahan publik hari ini hanyalah RLS tanpa policy anon —
-- artinya satu policy anon yang keliru sedikit saja langsung menemukan hak
-- akses yang sudah terbuka lebar menunggu. Dicabut supaya kekeliruan
-- semacam itu berhenti di lapisan hak akses, bukan hanya di policy.
revoke all on public.profiles        from anon;
revoke all on public.warung          from anon;
revoke all on public.warung_anggota  from anon;
revoke all on public.pelanggan       from anon;
revoke all on public.transaksi_utang from anon;
revoke all on public.pembayaran      from anon;
revoke all on public.subscriptions   from anon;
revoke all on public.payment_orders  from anon;
revoke all on public.v_ringkasan_pelanggan from anon;
revoke all on public.v_ringkasan_warung    from anon;
