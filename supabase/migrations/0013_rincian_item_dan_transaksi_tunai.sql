-- Tahap 15: rincian item opsional, dan transaksi tunai yang bukan utang.
--
-- CATATAN NAMA TABEL. Setelah migrasi ini, public.transaksi_utang menampung
-- baris yang bukan utang (jenis = 'tunai'). Namanya sengaja TIDAK diganti:
-- penggantian akan menyentuh policy RLS, grant per kolom, dua view, mesin
-- sync, serta nama tabel Dexie beserta migrasi versinya — risiko besar untuk
-- keuntungan yang murni kosmetik. Baca "transaksi_utang" sebagai "transaksi",
-- dan kolom `jenis` yang menentukan sifatnya.

-- ── Bagian A: rincian item ─────────────────────────────────────────────────

create table public.transaksi_item (
  id uuid primary key default gen_random_uuid(),
  warung_id uuid not null references public.warung (id) on delete cascade,
  transaksi_id uuid not null references public.transaksi_utang (id) on delete cascade,
  -- Urutan tampil ditentukan pencatatnya, bukan abjad: pemilik warung
  -- menyebut item sesuai urutan pembeli menyebutnya.
  urutan smallint not null default 0,
  nama_item text not null check (length(btrim(nama_item)) > 0),
  qty integer not null check (qty > 0),
  harga_satuan numeric(14,2) not null check (harga_satuan >= 0),
  -- Kolom turunan: mustahil berbeda dari qty x harga_satuan, dan tidak bisa
  -- ditulis client sama sekali. Karena itu ia harus dikeluarkan dari muatan
  -- outbox — PostgreSQL menolak INSERT yang menyebut kolom generated.
  subtotal numeric(14,2) generated always as (qty * harga_satuan) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index transaksi_item_transaksi_idx
  on public.transaksi_item (transaksi_id) where deleted_at is null;
create index transaksi_item_sync_idx on public.transaksi_item (warung_id, updated_at);

create trigger set_updated_at before update on public.transaksi_item
  for each row execute function public.fn_set_updated_at();

/*
 * SENGAJA TIDAK ADA batasan sum(subtotal) = transaksi_utang.nominal.
 *
 * Item dan induknya sampai ke server sebagai dua permintaan terpisah lewat
 * antrean outbox, jadi batasan lintas-tabel semacam itu pasti gagal di
 * tengah sinkronisasi — bukan karena datanya salah, melainkan karena
 * separuhnya belum tiba. Yang menjaga keduanya tetap sama adalah formulir:
 * field nominal dikunci selama rincian item aktif.
 */

alter table public.transaksi_item enable row level security;

create policy "item transaksi: akses warung sendiri" on public.transaksi_item
  for all to authenticated
  using (warung_id in (select public.warung_saya()))
  with check (warung_id in (select public.warung_saya()));

-- anon tidak pernah menyentuh tabel ini; satu-satunya jalur publik adalah
-- fungsi pantau_utang() di bawah.
revoke all on public.transaksi_item from anon;

-- ── Bagian B: transaksi tunai ──────────────────────────────────────────────

create type public.jenis_transaksi as enum ('utang', 'tunai');

alter table public.transaksi_utang
  add column jenis public.jenis_transaksi not null default 'utang';

-- Penjualan tunai boleh tanpa pelanggan sama sekali (pembeli lewat).
alter table public.transaksi_utang alter column pelanggan_id drop not null;

alter table public.transaksi_utang
  add constraint transaksi_utang_pelanggan_wajib_untuk_utang
    check (jenis = 'tunai' or pelanggan_id is not null),
  add constraint transaksi_utang_tunai_tanpa_tempo
    check (jenis = 'utang' or jatuh_tempo is null);

create index transaksi_utang_jenis_idx
  on public.transaksi_utang (warung_id, jenis, tanggal) where deleted_at is null;

/*
 * Inti keamanan angka Bagian B.
 *
 * Alih-alih menambahkan "and jenis = 'utang'" di setiap kueri piutang yang
 * sudah ada — dan bergantung pada tidak ada satu pun yang terlewat — baris
 * tunai dibuat MUSTAHIL menyumbang piutang: total_dibayar dipaksa sama
 * dengan nominal, sehingga sisa selalu nol dan statusnya selalu 'lunas'.
 *
 * Dengan begitu jalur berikut tetap benar tanpa diubah sama sekali:
 * total_piutang, jumlah_pelanggan_berutang, jatuh tempo, lewat tempo,
 * halaman Tagihan, ringkasan beranda, dan badge sisa utang per pelanggan.
 * Yang tetap perlu penyaring eksplisit hanyalah yang menjumlah `nominal`
 * tanpa melihat status — dan itu jumlahnya sedikit serta bisa didaftar.
 */
create or replace function public.fn_status_utang()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.jenis = 'tunai' then
    new.total_dibayar := new.nominal;
    new.status := 'lunas'::public.utang_status;
    return new;
  end if;

  new.status := case
    when new.total_dibayar >= new.nominal then 'lunas'::public.utang_status
    when new.total_dibayar > 0 then 'sebagian'::public.utang_status
    else 'belum_lunas'::public.utang_status
  end;
  return new;
end;
$$;

-- hitung_ulang_utang() menulis total_dibayar dari tabel pembayaran. Baris
-- tunai tidak punya pembayaran, jadi tanpa penjagaan ini nilainya akan
-- dikembalikan ke 0 begitu ada pembayaran lain menyalakan trigger.
create or replace function public.hitung_ulang_utang(p_transaksi uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if p_transaksi is null then
    return;
  end if;

  update public.transaksi_utang t
  set total_dibayar = coalesce((
        select sum(b.nominal)
        from public.pembayaran b
        where b.transaksi_id = p_transaksi
          and b.deleted_at is null
      ), 0)
  where t.id = p_transaksi
    and t.jenis = 'utang';
end;
$$;

-- `jenis` boleh disebut saat INSERT, tapi TIDAK saat UPDATE: sebuah utang
-- tidak boleh diam-diam berubah menjadi penjualan tunai atau sebaliknya.
-- Perubahan seperti itu memindahkan uang antara piutang dan penjualan tanpa
-- meninggalkan jejak.
grant insert (jenis) on public.transaksi_utang to authenticated;

-- ── View: hanya yang menjumlah nominal tanpa melihat status ────────────────

create or replace view public.v_ringkasan_pelanggan with (security_invoker = true) as
select
  p.id as pelanggan_id,
  p.warung_id,
  p.nama,
  p.no_wa,
  p.foto_path,
  p.status,
  coalesce(sum(t.nominal), 0) as total_utang,
  coalesce(sum(t.total_dibayar), 0) as total_dibayar,
  coalesce(sum(greatest(t.nominal - t.total_dibayar, 0)), 0) as sisa_utang,
  count(t.id) filter (where t.status <> 'lunas') as jumlah_transaksi_aktif,
  min(t.jatuh_tempo) filter (where t.status <> 'lunas') as jatuh_tempo_terdekat,
  min(t.tanggal) filter (where t.status <> 'lunas') as tanggal_utang_terlama
from public.pelanggan p
left join public.transaksi_utang t
  on t.pelanggan_id = p.id
 and t.deleted_at is null
 -- Penyaring baru: total_utang menjumlah nominal tanpa melihat status, jadi
 -- tanpa ini belanja tunai pelanggan ikut terhitung sebagai utangnya.
 and t.jenis = 'utang'
where p.deleted_at is null
group by p.id;

-- ── Halaman pantau: khusus utang, plus rincian item ────────────────────────

create or replace function public.pantau_utang(p_token uuid)
returns jsonb
language plpgsql
security definer
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

  if not found then
    return null;
  end if;

  select * into v_warung from public.warung where id = v_pelanggan.warung_id;
  if not found then
    return null;
  end if;

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
        and t.jenis = 'utang'
    ), 0),
    'transaksi', coalesce((
      select jsonb_agg(jsonb_build_object(
               'tanggal', t.tanggal,
               'keterangan', t.keterangan,
               'nominal', t.nominal,
               'total_dibayar', t.total_dibayar,
               'jatuh_tempo', t.jatuh_tempo,
               'status', t.status,
               -- Rincian item ikut ditampilkan: seluruh gunanya halaman ini
               -- adalah supaya pelanggan bisa memeriksa sendiri, dan "nasi
               -- rames 2 x 15.000" jauh lebih bisa diperiksa daripada satu
               -- angka gabungan.
               'item', coalesce((
                 select jsonb_agg(jsonb_build_object(
                          'nama_item', i.nama_item,
                          'qty', i.qty,
                          'harga_satuan', i.harga_satuan,
                          'subtotal', i.subtotal
                        ) order by i.urutan, i.created_at)
                 from public.transaksi_item i
                 where i.transaksi_id = t.id and i.deleted_at is null
               ), '[]'::jsonb)
             ) order by t.tanggal desc, t.created_at desc)
      from public.transaksi_utang t
      where t.pelanggan_id = v_pelanggan.id and t.deleted_at is null
        -- Halaman ini bernama "catatan utang". Belanja tunai yang sudah
        -- lunas di tempat bukan urusannya, dan memunculkannya hanya
        -- membingungkan pembaca yang sedang memeriksa tagihannya.
        and t.jenis = 'utang'
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

  if v_pelanggan.terakhir_dilihat_pelanggan is null
     or v_pelanggan.terakhir_dilihat_pelanggan < now() - interval '5 minutes' then
    update public.pelanggan
       set terakhir_dilihat_pelanggan = now()
     where id = v_pelanggan.id;
  end if;

  return v_hasil;
end;
$$;
