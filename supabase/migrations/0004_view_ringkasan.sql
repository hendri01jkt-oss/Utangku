-- View ringkasan untuk laporan dan verifikasi.
--
-- security_invoker = true WAJIB: tanpa itu view dijalankan sebagai pemiliknya
-- (postgres) dan akan MELEWATI RLS tabel di bawahnya — artinya satu warung
-- bisa membaca ringkasan warung lain.

create view public.v_ringkasan_pelanggan with (security_invoker = true) as
select
  p.id as pelanggan_id,
  p.warung_id,
  p.nama,
  p.no_wa,
  p.foto_path,
  p.status,
  coalesce(sum(t.nominal), 0) as total_utang,
  coalesce(sum(t.total_dibayar), 0) as total_dibayar,
  coalesce(sum(greatest(t.nominal - t.total_dibayar, 0)), 0) as sisa_utang,
  count(t.id) filter (where t.status <> 'lunas') as jumlah_transaksi_aktif,
  min(t.jatuh_tempo) filter (where t.status <> 'lunas') as jatuh_tempo_terdekat,
  min(t.tanggal) filter (where t.status <> 'lunas') as tanggal_utang_terlama
from public.pelanggan p
left join public.transaksi_utang t
  on t.pelanggan_id = p.id
 and t.deleted_at is null
where p.deleted_at is null
group by p.id;

create view public.v_ringkasan_warung with (security_invoker = true) as
select
  w.id as warung_id,
  (select coalesce(sum(greatest(t.nominal - t.total_dibayar, 0)), 0)
     from public.transaksi_utang t
    where t.warung_id = w.id and t.deleted_at is null) as total_piutang,
  (select count(distinct t.pelanggan_id)
     from public.transaksi_utang t
    where t.warung_id = w.id and t.deleted_at is null
      and t.status <> 'lunas') as jumlah_pelanggan_berutang,
  (select coalesce(sum(b.nominal), 0)
     from public.pembayaran b
    where b.warung_id = w.id and b.deleted_at is null
      and b.tanggal >= date_trunc('month', public.hari_ini())::date) as tertagih_bulan_ini,
  (select count(*)
     from public.transaksi_utang t
    where t.warung_id = w.id and t.deleted_at is null
      and t.status <> 'lunas' and t.jatuh_tempo is not null
      and t.jatuh_tempo between public.hari_ini() and public.hari_ini() + 3) as jumlah_jatuh_tempo_3_hari,
  (select count(*)
     from public.transaksi_utang t
    where t.warung_id = w.id and t.deleted_at is null
      and t.status <> 'lunas' and t.jatuh_tempo is not null
      and t.jatuh_tempo < public.hari_ini()) as jumlah_lewat_tempo
from public.warung w;
