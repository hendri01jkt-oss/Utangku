-- Penanda pengingat jatuh tempo.
--
-- Kolom reminder_terkirim_untuk diisi dengan tanggal jatuh tempo yang sudah
-- "diumumkan", sehingga satu transaksi tidak diingatkan berulang kali untuk
-- tempo yang sama. Kalau tempo transaksinya diubah, nilainya tidak lagi
-- cocok dan pengingatnya otomatis berlaku lagi — itulah gunanya menyimpan
-- tanggal, bukan sekadar boolean.
--
-- Catatan rancangan: daftar tagihan yang tampil di aplikasi TIDAK membaca
-- kolom ini. Perhitungan H-3 dilakukan di perangkat dari data lokal supaya
-- tetap muncul saat offline. Kolom ini murni penanda untuk fase 2, saat
-- pengingat mulai dikirim sebagai push notification.

create or replace function public.tandai_reminder_jatuh_tempo()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_jumlah integer;
begin
  update public.transaksi_utang t
  set reminder_terkirim_untuk = t.jatuh_tempo
  where t.deleted_at is null
    and t.status <> 'lunas'
    and t.jatuh_tempo is not null
    -- Sudah masuk jendela pengingat milik transaksi ini sendiri.
    and t.jatuh_tempo - t.reminder_hari_sebelum <= public.hari_ini()
    and (
      t.reminder_terkirim_untuk is null
      or t.reminder_terkirim_untuk <> t.jatuh_tempo
    );

  get diagnostics v_jumlah = row_count;
  return v_jumlah;
end;
$$;

-- Fungsi internal: dijalankan penjadwal, bukan dipanggil dari aplikasi.
revoke execute on function public.tandai_reminder_jatuh_tempo()
  from public, anon, authenticated;
