-- Profil dibuat otomatis saat user mendaftar (email/password maupun Google).
create or replace function public.fn_buat_profil()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, nama_lengkap)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data ->> 'full_name',
      new.raw_user_meta_data ->> 'name',
      split_part(coalesce(new.email, ''), '@', 1)
    )
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.fn_buat_profil();

-- Onboarding satu langkah.
--
-- Membuat warung + keanggotaan pemilik + baris langganan dalam SATU
-- transaksi. Tanpa ini tidak mungkin ada user yang berhasil mendaftar tapi
-- tidak punya warung — dan client tidak perlu diberi hak menulis
-- warung_anggota secara langsung.
create or replace function public.buat_warung(
  p_nama_warung text,
  p_no_wa text default null,
  p_alamat text default null,
  p_tempo_default_hari int default 0
)
returns public.warung
language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := auth.uid();
  v_warung public.warung;
begin
  if v_user is null then
    raise exception 'Harus masuk terlebih dahulu' using errcode = '28000';
  end if;

  if coalesce(btrim(p_nama_warung), '') = '' then
    raise exception 'Nama warung wajib diisi' using errcode = '22023';
  end if;

  insert into public.warung (pemilik_id, nama_warung, no_wa_warung, alamat, tempo_default_hari)
  values (v_user, btrim(p_nama_warung), p_no_wa, p_alamat, coalesce(p_tempo_default_hari, 0))
  returning * into v_warung;

  insert into public.warung_anggota (warung_id, user_id, role)
  values (v_warung.id, v_user, 'pemilik');

  insert into public.subscriptions (warung_id)
  values (v_warung.id);

  return v_warung;
end;
$$;

revoke execute on function public.buat_warung(text, text, text, int) from anon;
grant execute on function public.buat_warung(text, text, text, int) to authenticated;
