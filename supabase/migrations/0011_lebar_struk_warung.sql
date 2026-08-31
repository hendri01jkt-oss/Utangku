-- Lebar kertas struk yang dipakai warung, dalam milimeter.
--
-- Disimpan di tabel warung (bukan hanya lokal) supaya ikut berpindah kalau
-- pemiliknya berganti HP, sama seperti template pesan tagihan.
--
-- Dibatasi ke dua nilai yang benar-benar ada di pasaran. Printer thermal
-- beresolusi 203 dpi = 8 titik/mm, jadi 58mm menghasilkan 384 titik dan
-- 80mm menghasilkan 576 titik; klien yang menerjemahkannya.
--
-- Tidak perlu grant tambahan: authenticated memegang INSERT dan UPDATE di
-- level TABEL untuk warung (berbeda dari transaksi_utang yang di-grant per
-- kolom di 0003), jadi kolom baru otomatis tercakup. Sudah diverifikasi
-- lewat information_schema.column_privileges setelah migrasi diterapkan.
alter table public.warung
  add column lebar_struk smallint not null default 58
    check (lebar_struk in (58, 80));

comment on column public.warung.lebar_struk is
  'Lebar kertas struk dalam mm: 58 (384 titik) atau 80 (576 titik) pada 203 dpi.';
