-- Enum, fungsi tanggal, dan pemicu updated_at.

create type warung_role as enum ('pemilik', 'kasir');
create type pelanggan_status as enum ('aktif', 'nonaktif');
create type utang_status as enum ('belum_lunas', 'sebagian', 'lunas');
create type metode_bayar as enum ('tunai', 'transfer', 'qris', 'lainnya');
create type subscription_tier as enum ('free', 'pro');
create type subscription_status as enum ('active', 'expired', 'cancelled');
create type payment_status as enum ('pending', 'settlement', 'expired', 'failed');

-- Tanggal "hari ini" menurut Waktu Indonesia Barat, bukan UTC.
-- Tanpa ini, utang yang dicatat setelah pukul 17.00 WIB akan tercatat
-- di tanggal berikutnya oleh perhitungan berbasis UTC.
create or replace function public.hari_ini()
returns date language sql stable set search_path = '' as $$
  select (now() at time zone 'Asia/Jakarta')::date;
$$;

-- updated_at selalu diisi server. Sync engine memakai kolom ini sebagai
-- penanda "apa yang berubah sejak terakhir tarik data", jadi nilainya tidak
-- boleh bergantung pada jam perangkat yang bisa saja salah setel.
create or replace function public.fn_set_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
