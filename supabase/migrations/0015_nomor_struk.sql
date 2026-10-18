-- Nomor struk otomatis, format UK-YYMMDD-NNN (urutan per hari per warung).
--
-- Dibuat di KLIEN saat mencatat, karena aplikasi ini jalan tanpa sinyal:
-- nomor berurutan dari server tidak bisa diberikan saat offline.
-- Sengaja TIDAK unik di database: bentrok langka antar-HP yang offline
-- bersamaan tidak boleh sampai menolak transaksinya dan menyumbat antrean
-- sinkronisasi. Kolom ini hanya boleh diisi saat INSERT (tidak ada hak UPDATE).

alter table public.transaksi_utang add column nomor_struk text;
grant insert (nomor_struk) on public.transaksi_utang to authenticated;

-- Isi nomor untuk catatan lama: urut menurut waktu catat, per warung per hari
-- (hari menurut Waktu Indonesia Barat). Baris yang sudah dihapus ikut
-- diberi nomor supaya nomor tidak pernah dipakai ulang.
update public.transaksi_utang t
   set nomor_struk = n.nomor
  from (
    select id,
           'UK-' || to_char(created_at at time zone 'Asia/Jakarta', 'YYMMDD') || '-' ||
           lpad((row_number() over (
             partition by warung_id, (created_at at time zone 'Asia/Jakarta')::date
             order by created_at, id
           ))::text, 3, '0') as nomor
      from public.transaksi_utang
  ) n
 where t.id = n.id and t.nomor_struk is null;

-- Halaman pantau: nomor struk ikut dikirim, supaya pelanggan bisa
-- mencocokkannya dengan struk yang dipegangnya.
create or replace function public.pantau_utang(p_token uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pelanggan public.pelanggan;
  v_warung public.warung;
  v_hasil jsonb;
begin
  select * into v_pelanggan
  from public.pelanggan
  where token_pantau = p_token and deleted_at is null;

  if not found then
    return null;
  end if;

  select * into v_warung from public.warung where id = v_pelanggan.warung_id;
  if not found then
    return null;
  end if;

  v_hasil := jsonb_build_object(
    'warung', jsonb_build_object(
      'nama_warung', v_warung.nama_warung,
      'no_wa_warung', v_warung.no_wa_warung
    ),
    'pelanggan', jsonb_build_object('nama', v_pelanggan.nama),
    'sisa_utang', coalesce((
      select sum(greatest(t.nominal - t.total_dibayar, 0))
      from public.transaksi_utang t
      where t.pelanggan_id = v_pelanggan.id and t.deleted_at is null
        and t.jenis = 'utang'
    ), 0),
    'transaksi', coalesce((
      select jsonb_agg(jsonb_build_object(
               'tanggal', t.tanggal,
               'keterangan', t.keterangan,
               'nominal', t.nominal,
               'total_dibayar', t.total_dibayar,
               'jatuh_tempo', t.jatuh_tempo,
               'status', t.status,
               'nomor_struk', t.nomor_struk,
               -- Rincian item ikut ditampilkan: seluruh gunanya halaman ini
               -- adalah supaya pelanggan bisa memeriksa sendiri, dan "nasi
               -- rames 2 x 15.000" jauh lebih bisa diperiksa daripada satu
               -- angka gabungan.
               'item', coalesce((
                 select jsonb_agg(jsonb_build_object(
                          'nama_item', i.nama_item,
                          'qty', i.qty,
                          'harga_satuan', i.harga_satuan,
                          'subtotal', i.subtotal
                        ) order by i.urutan, i.created_at)
                 from public.transaksi_item i
                 where i.transaksi_id = t.id and i.deleted_at is null
               ), '[]'::jsonb)
             ) order by t.tanggal desc, t.created_at desc)
      from public.transaksi_utang t
      where t.pelanggan_id = v_pelanggan.id and t.deleted_at is null
        -- Halaman ini bernama "catatan utang". Belanja tunai yang sudah
        -- lunas di tempat bukan urusannya, dan memunculkannya hanya
        -- membingungkan pembaca yang sedang memeriksa tagihannya.
        and t.jenis = 'utang'
    ), '[]'::jsonb),
    'pembayaran', coalesce((
      select jsonb_agg(jsonb_build_object(
               'tanggal', b.tanggal,
               'nominal', b.nominal,
               'metode', b.metode,
               -- Utang mana yang dibayar: pelanggan bisa mencocokkannya
               -- dengan catatan di atas.
               'untuk_keterangan', u.keterangan,
               'untuk_tanggal', u.tanggal
             ) order by b.tanggal desc, b.created_at desc)
      from public.pembayaran b
      join public.transaksi_utang u on u.id = b.transaksi_id
      where b.pelanggan_id = v_pelanggan.id and b.deleted_at is null
    ), '[]'::jsonb)
  );

  if v_pelanggan.terakhir_dilihat_pelanggan is null
     or v_pelanggan.terakhir_dilihat_pelanggan < now() - interval '5 minutes' then
    update public.pelanggan
       set terakhir_dilihat_pelanggan = now()
     where id = v_pelanggan.id;
  end if;

  return v_hasil;
end;
$$;
