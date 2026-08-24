-- Postgres memberi EXECUTE pada fungsi baru ke PUBLIC secara default, dan
-- PostgREST mengekspos setiap fungsi di schema public sebagai /rest/v1/rpc/*.
-- Akibatnya fungsi internal (termasuk fungsi trigger) bisa dipanggil dari
-- luar. Grant PUBLIC harus dicabut lebih dulu; mencabut dari 'anon' saja
-- tidak cukup karena anon mewarisi hak dari PUBLIC.

-- Fungsi internal: tidak boleh dipanggil siapa pun lewat API.
-- Trigger tetap jalan: PostgreSQL memeriksa hak EXECUTE saat CREATE TRIGGER,
-- bukan setiap kali trigger menyala. hitung_ulang_utang dipanggil dari
-- fungsi SECURITY DEFINER milik postgres, jadi juga tidak terpengaruh.
revoke execute on function public.fn_set_updated_at() from public, anon, authenticated;
revoke execute on function public.fn_status_utang() from public, anon, authenticated;
revoke execute on function public.fn_hitung_ulang_utang() from public, anon, authenticated;
revoke execute on function public.fn_buat_profil() from public, anon, authenticated;
revoke execute on function public.hitung_ulang_utang(uuid) from public, anon, authenticated;

-- warung_saya() dipakai di dalam ekspresi policy, yang dievaluasi dengan hak
-- pengguna pemanggil — jadi 'authenticated' TETAP butuh EXECUTE. Kalau ini
-- ikut dicabut, seluruh RLS berhenti bekerja.
revoke execute on function public.warung_saya() from public, anon;
grant execute on function public.warung_saya() to authenticated;

-- hari_ini() dipakai sebagai DEFAULT kolom dan di dalam view; default
-- dievaluasi dengan hak pengguna yang menyisipkan baris.
revoke execute on function public.hari_ini() from public, anon;
grant execute on function public.hari_ini() to authenticated;

-- buat_warung() memang sengaja dipanggil dari client, tapi hanya oleh
-- pengguna yang sudah masuk.
revoke execute on function public.buat_warung(text, text, text, int) from public, anon;
grant execute on function public.buat_warung(text, text, text, int) to authenticated;
