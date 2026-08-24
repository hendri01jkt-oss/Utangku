-- Row Level Security: isolasi antar warung dijamin Postgres, bukan kode UI.

-- Dipakai semua policy tabel data. security definer supaya pembacaan
-- warung_anggota di dalamnya tidak memicu evaluasi policy secara rekursif,
-- dan stable supaya hasilnya di-cache selama satu statement.
create or replace function public.warung_saya()
returns setof uuid language sql security definer stable set search_path = '' as $$
  select a.warung_id from public.warung_anggota a where a.user_id = auth.uid();
$$;

alter table public.profiles        enable row level security;
alter table public.warung          enable row level security;
alter table public.warung_anggota  enable row level security;
alter table public.pelanggan       enable row level security;
alter table public.transaksi_utang enable row level security;
alter table public.pembayaran      enable row level security;
alter table public.subscriptions   enable row level security;
alter table public.payment_orders  enable row level security;

-- profiles: hanya diri sendiri.
create policy "profil sendiri: baca" on public.profiles
  for select to authenticated using (id = (select auth.uid()));
create policy "profil sendiri: ubah" on public.profiles
  for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- warung: anggota boleh baca dan ubah; membuat warung baru hanya untuk
-- diri sendiri; menghapus hanya oleh pemilik.
create policy "warung: baca" on public.warung
  for select to authenticated using (id in (select public.warung_saya()));
create policy "warung: buat" on public.warung
  for insert to authenticated with check (pemilik_id = (select auth.uid()));
create policy "warung: ubah" on public.warung
  for update to authenticated
  using (id in (select public.warung_saya()))
  with check (id in (select public.warung_saya()));
create policy "warung: hapus" on public.warung
  for delete to authenticated using (pemilik_id = (select auth.uid()));

-- warung_anggota: setiap orang hanya melihat keanggotaannya sendiri.
-- Penambahan anggota dilakukan lewat fungsi security definer (migrasi 0006),
-- bukan langsung dari client — jadi sengaja tidak ada policy insert/update.
create policy "keanggotaan sendiri: baca" on public.warung_anggota
  for select to authenticated using (user_id = (select auth.uid()));

-- Tabel data: satu pola yang sama, disaring warung_id.
create policy "pelanggan: akses warung sendiri" on public.pelanggan
  for all to authenticated
  using (warung_id in (select public.warung_saya()))
  with check (warung_id in (select public.warung_saya()));

create policy "transaksi: akses warung sendiri" on public.transaksi_utang
  for all to authenticated
  using (warung_id in (select public.warung_saya()))
  with check (warung_id in (select public.warung_saya()));

create policy "pembayaran: akses warung sendiri" on public.pembayaran
  for all to authenticated
  using (warung_id in (select public.warung_saya()))
  with check (warung_id in (select public.warung_saya()));

-- Langganan dan order pembayaran: client hanya boleh MEMBACA.
-- Tanpa policy tulis, pengguna tidak bisa menaikkan tier-nya sendiri jadi
-- 'pro' di fase 2; perubahan hanya lewat service role atau webhook.
create policy "langganan: baca" on public.subscriptions
  for select to authenticated using (warung_id in (select public.warung_saya()));

create policy "order pembayaran: baca" on public.payment_orders
  for select to authenticated using (warung_id in (select public.warung_saya()));
