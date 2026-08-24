-- Semua tabel UtangKu. Setiap tabel data punya warung_id: itulah dasar
-- isolasi antar warung yang ditegakkan oleh RLS di migrasi 0005.

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  nama_lengkap text,
  no_wa text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.warung (
  id uuid primary key default gen_random_uuid(),
  pemilik_id uuid not null references auth.users (id) on delete cascade,
  nama_warung text not null check (length(btrim(nama_warung)) > 0),
  alamat text,
  no_wa_warung text,
  logo_path text,
  template_pesan_tagihan text not null default 'Halo {nama} 🙏
Ini pengingat dari {warung}.

Sisa utang Anda: *{sisa}*
{rincian}

Mohon dapat diselesaikan ya. Terima kasih 🙏',
  tempo_default_hari int not null default 0 check (tempo_default_hari >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index warung_pemilik_idx on public.warung (pemilik_id);

-- Kunci isolasi data: semua policy RLS membaca keanggotaan dari tabel ini.
-- Menambah kasir di fase 2 cukup insert satu baris, tanpa ubah skema.
create table public.warung_anggota (
  warung_id uuid not null references public.warung (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role warung_role not null default 'pemilik',
  created_at timestamptz not null default now(),
  primary key (warung_id, user_id)
);
create index warung_anggota_user_idx on public.warung_anggota (user_id);

create table public.pelanggan (
  id uuid primary key default gen_random_uuid(),
  warung_id uuid not null references public.warung (id) on delete cascade,
  nama text not null check (length(btrim(nama)) > 0),
  no_wa text,
  alamat text,
  foto_path text,
  catatan text,
  status pelanggan_status not null default 'aktif',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index pelanggan_warung_nama_idx on public.pelanggan (warung_id, nama);
create index pelanggan_sync_idx on public.pelanggan (warung_id, updated_at);

create table public.transaksi_utang (
  id uuid primary key default gen_random_uuid(),
  warung_id uuid not null references public.warung (id) on delete cascade,
  pelanggan_id uuid not null references public.pelanggan (id) on delete cascade,
  tanggal date not null default public.hari_ini(),
  nominal numeric(14,2) not null check (nominal > 0),
  keterangan text,
  jatuh_tempo date,
  -- status dan total_dibayar TIDAK PERNAH ditulis client: keduanya hasil
  -- hitungan trigger dari tabel pembayaran (lihat migrasi 0003).
  status utang_status not null default 'belum_lunas',
  total_dibayar numeric(14,2) not null default 0 check (total_dibayar >= 0),
  reminder_hari_sebelum int not null default 3 check (reminder_hari_sebelum >= 0),
  reminder_terkirim_untuk date,
  dibuat_oleh uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index transaksi_utang_pelanggan_idx
  on public.transaksi_utang (warung_id, pelanggan_id, status);
create index transaksi_utang_tempo_idx
  on public.transaksi_utang (warung_id, jatuh_tempo) where deleted_at is null;
create index transaksi_utang_sync_idx
  on public.transaksi_utang (warung_id, updated_at);

create table public.pembayaran (
  id uuid primary key default gen_random_uuid(),
  warung_id uuid not null references public.warung (id) on delete cascade,
  transaksi_id uuid not null references public.transaksi_utang (id) on delete cascade,
  -- pelanggan_id didenormalisasi supaya riwayat pembayaran per pelanggan
  -- tidak perlu join ke transaksi_utang.
  pelanggan_id uuid not null references public.pelanggan (id) on delete cascade,
  tanggal date not null default public.hari_ini(),
  nominal numeric(14,2) not null check (nominal > 0),
  metode metode_bayar not null default 'tunai',
  catatan text,
  dibuat_oleh uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index pembayaran_transaksi_idx on public.pembayaran (transaksi_id);
create index pembayaran_pelanggan_idx on public.pembayaran (warung_id, pelanggan_id);
create index pembayaran_sync_idx on public.pembayaran (warung_id, updated_at);

-- Dibuat sejak MVP dengan tier 'free' untuk semua warung, supaya fase 2
-- tidak perlu backfill. Belum ada limit apa pun yang ditegakkan.
create table public.subscriptions (
  warung_id uuid primary key references public.warung (id) on delete cascade,
  tier subscription_tier not null default 'free',
  status subscription_status not null default 'active',
  tanggal_mulai_langganan timestamptz,
  tanggal_expired timestamptz,
  payment_provider text,
  payment_reference text,
  updated_at timestamptz not null default now()
);

-- Fase 2 (Midtrans). Tabel dibuat sekarang agar skema stabil, belum dipakai.
create table public.payment_orders (
  order_id text primary key,
  warung_id uuid not null references public.warung (id) on delete cascade,
  amount numeric(14,2) not null check (amount > 0),
  status payment_status not null default 'pending',
  midtrans_transaction_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index payment_orders_warung_idx on public.payment_orders (warung_id);

create trigger set_updated_at before update on public.profiles
  for each row execute function public.fn_set_updated_at();
create trigger set_updated_at before update on public.warung
  for each row execute function public.fn_set_updated_at();
create trigger set_updated_at before update on public.pelanggan
  for each row execute function public.fn_set_updated_at();
create trigger set_updated_at before update on public.transaksi_utang
  for each row execute function public.fn_set_updated_at();
create trigger set_updated_at before update on public.pembayaran
  for each row execute function public.fn_set_updated_at();
create trigger set_updated_at before update on public.subscriptions
  for each row execute function public.fn_set_updated_at();
create trigger set_updated_at before update on public.payment_orders
  for each row execute function public.fn_set_updated_at();
