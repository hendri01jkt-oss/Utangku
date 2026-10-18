-- Reset data warung: menandai SEMUA pelanggan, utang, rincian item, dan
-- pembayaran milik warung pemanggil sebagai terhapus.
--
-- Sengaja soft-delete (deleted_at), bukan DELETE: perangkat lain milik warung
-- yang sama baru tahu data itu dihapus lewat sinkronisasi. Kalau barisnya
-- hilang begitu saja, HP lain yang masih menyimpannya akan mengunggahnya
-- kembali dan data yang sudah direset hidup lagi. Baris yang bertanda
-- terhapus tidak pernah ditampilkan di aplikasi maupun halaman pantau.
--
-- Akun, warung, dan pengaturannya tidak disentuh.

create or replace function public.reset_data_warung()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_warung uuid;
  v_item int;
  v_bayar int;
  v_utang int;
  v_pelanggan int;
begin
  -- Hanya PEMILIK warung; anggota lain tidak boleh mereset.
  select id into v_warung from public.warung where pemilik_id = auth.uid() limit 1;
  if v_warung is null then
    raise exception 'Hanya pemilik warung yang bisa mereset data.';
  end if;

  -- Urutan dari anak ke induk, supaya trigger penghitung utang tidak
  -- bekerja di atas baris yang sudah ditandai terhapus.
  update public.transaksi_item set deleted_at = now()
   where warung_id = v_warung and deleted_at is null;
  get diagnostics v_item = row_count;

  update public.pembayaran set deleted_at = now()
   where warung_id = v_warung and deleted_at is null;
  get diagnostics v_bayar = row_count;

  update public.transaksi_utang set deleted_at = now()
   where warung_id = v_warung and deleted_at is null;
  get diagnostics v_utang = row_count;

  update public.pelanggan set deleted_at = now()
   where warung_id = v_warung and deleted_at is null;
  get diagnostics v_pelanggan = row_count;

  return jsonb_build_object(
    'pelanggan', v_pelanggan,
    'utang', v_utang,
    'pembayaran', v_bayar,
    'item', v_item
  );
end;
$$;

revoke execute on function public.reset_data_warung() from public, anon;
grant execute on function public.reset_data_warung() to authenticated;
