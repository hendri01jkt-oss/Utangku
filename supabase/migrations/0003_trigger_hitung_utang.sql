-- Status utang adalah HASIL HITUNGAN, bukan masukan.
--
-- Dua lapis penjagaan:
--   1. Trigger menurunkan status dari total_dibayar vs nominal.
--   2. Hak akses kolom mencabut kemampuan client menulis kedua kolom itu.
-- Dengan begitu "tertulis lunas padahal masih ada sisa" tidak mungkin terjadi,
-- bahkan bila ada bug di aplikasi.

create or replace function public.fn_status_utang()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.status := case
    when new.total_dibayar >= new.nominal then 'lunas'::public.utang_status
    when new.total_dibayar > 0 then 'sebagian'::public.utang_status
    else 'belum_lunas'::public.utang_status
  end;
  return new;
end;
$$;

create trigger set_status_utang
  before insert or update on public.transaksi_utang
  for each row execute function public.fn_status_utang();

-- Menghitung ulang total_dibayar satu transaksi dari tabel pembayaran.
-- Pembayaran yang di-soft-delete tidak ikut dihitung.
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
  where t.id = p_transaksi;
end;
$$;

create or replace function public.fn_hitung_ulang_utang()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  -- Pada UPDATE, transaksi_id bisa berpindah; kedua sisi dihitung ulang.
  if tg_op in ('UPDATE', 'DELETE') then
    perform public.hitung_ulang_utang(old.transaksi_id);
  end if;
  if tg_op in ('INSERT', 'UPDATE') then
    perform public.hitung_ulang_utang(new.transaksi_id);
  end if;
  return null;
end;
$$;

create trigger hitung_ulang_utang
  after insert or update or delete on public.pembayaran
  for each row execute function public.fn_hitung_ulang_utang();

-- Hak akses kolom.
--
-- Mencabut privilege kolom saja tidak cukup selama masih ada grant di level
-- tabel: PostgreSQL tidak bisa "mengurangi" kolom dari grant tabel. Jadi
-- grant tabel dicabut lebih dulu, lalu diberikan ulang per kolom tanpa
-- status dan total_dibayar.
revoke insert, update on public.transaksi_utang from authenticated;

grant insert (
  id, warung_id, pelanggan_id, tanggal, nominal, keterangan, jatuh_tempo,
  reminder_hari_sebelum, reminder_terkirim_untuk, dibuat_oleh,
  created_at, updated_at, deleted_at
) on public.transaksi_utang to authenticated;

grant update (
  pelanggan_id, tanggal, nominal, keterangan, jatuh_tempo,
  reminder_hari_sebelum, reminder_terkirim_untuk,
  updated_at, deleted_at
) on public.transaksi_utang to authenticated;
