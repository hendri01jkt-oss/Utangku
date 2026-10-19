-- Langganan: masa percobaan 14 hari.
--
-- Warung baru otomatis mendapat 14 hari percobaan (default kolom, jadi
-- buat_warung() tidak perlu diubah). Warung yang sudah ada diberi 14 hari
-- terhitung dari migrasi ini, supaya tidak ada yang langsung terkunci.
--
-- Status "aktif" dihitung di klien dan di fungsi server dari kolom ini dan
-- tanggal_expired; tidak ada kolom turunan yang bisa tidak sinkron.

alter table public.subscriptions
  add column trial_sampai timestamptz not null default (now() + interval '14 days');

-- Baris lama ikut mendapat nilai default (sekarang + 14 hari) saat kolom
-- ditambahkan, sehingga tidak perlu UPDATE terpisah.
