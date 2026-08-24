-- Penjadwal harian untuk penanda pengingat.
--
-- Dikerjakan langsung oleh pg_cron memanggil fungsi SQL, tanpa Edge
-- Function. Pekerjaannya murni perubahan data di database yang sama, jadi
-- menambah lapisan HTTP hanya akan menambah endpoint yang harus diamankan,
-- rahasia yang harus dikelola, dan titik gagal baru — tanpa manfaat.
-- Edge Function baru diperlukan di fase 2, saat pengingat benar-benar
-- dikirim sebagai push notification; fungsi itu nanti memanggil fungsi SQL
-- yang sama.
--
-- pg_cron memakai waktu UTC. 23:00 UTC = 06:00 WIB, yaitu saat warung mulai
-- buka dan pemiliknya sempat melihat daftar tagihan.

create extension if not exists pg_cron;

select cron.schedule(
  'tandai-reminder-harian',
  '0 23 * * *',
  $$ select public.tandai_reminder_jatuh_tempo(); $$
);
