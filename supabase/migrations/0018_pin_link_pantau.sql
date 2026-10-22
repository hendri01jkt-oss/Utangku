-- Link pantau dilindungi PIN 6 angka per pelanggan.
--
-- Sebelumnya siapa pun yang memegang link bisa membaca catatan utang. Link
-- gampang tersebar (grup WhatsApp, tangkapan layar), jadi sekarang link saja
-- tidak cukup: pembukanya harus menyebut PIN yang dibuat acak per pelanggan
-- dan TIDAK berkaitan dengan nomor HP atau data lain.
--
-- Pemeriksaan PIN dan pembatasan tebakan dilakukan di database, bukan di
-- halaman: filter di sisi pemanggil bisa dilewati siapa saja.

-- ── PIN per pelanggan ──────────────────────────────────────────────────────

alter table public.pelanggan
  add column pin_pantau text not null
    default lpad((floor(random() * 1000000))::int::text, 6, '0')
    check (pin_pantau ~ '^[0-9]{6}$');

comment on column public.pelanggan.pin_pantau is
  'PIN 6 angka untuk membuka link pantau. Bisa diganti pemilik warung. Tidak pernah dikembalikan ke halaman publik.';

-- Perangkat pemilik menarik data dengan kursor updated_at; baris lama harus
-- ikut "tersentuh" supaya PIN hasil isian di atas sampai ke HP mereka.
update public.pelanggan set updated_at = now();

-- Hak kolom: pemilik boleh menulis PIN (dibuat di perangkat, seperti token).
grant insert (pin_pantau) on public.pelanggan to authenticated;
grant update (pin_pantau) on public.pelanggan to authenticated;

-- ── Penghitung tebakan salah ───────────────────────────────────────────────

create table public.pantau_percobaan (
  token_pantau   uuid primary key,
  gagal          int not null default 0,
  gagal_terakhir timestamptz not null default now(),
  terkunci_sampai timestamptz
);

alter table public.pantau_percobaan enable row level security;
revoke all on public.pantau_percobaan from anon, authenticated;

-- ── Pintu publik baru: token + PIN ─────────────────────────────────────────

drop function public.pantau_utang(uuid);

create or replace function public.pantau_utang(p_token uuid, p_pin text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  c_maks constant int := 5;
  c_kunci constant interval := interval '15 minutes';
  v_pelanggan public.pelanggan;
  v_warung public.warung;
  v_kunci timestamptz;
  v_gagal int;
  v_hasil jsonb;
begin
  select * into v_pelanggan
  from public.pelanggan
  where token_pantau = p_token and deleted_at is null;

  -- Token tidak dikenal dan pelanggan terhapus dijawab sama: null.
  if not found then
    return null;
  end if;

  select * into v_warung from public.warung where id = v_pelanggan.warung_id;
  if not found then
    return null;
  end if;

  -- Sedang terkunci? Jawab sebelum PIN diperiksa, supaya terkunci benar-benar
  -- berarti tebakan tidak lagi diperiksa.
  select terkunci_sampai into v_kunci
  from public.pantau_percobaan where token_pantau = p_token;
  if v_kunci is not null and v_kunci > now() then
    return jsonb_build_object(
      'status', 'terkunci',
      'sisa_detik', ceil(extract(epoch from (v_kunci - now())))::int
    );
  end if;

  -- Belum memasukkan PIN: bukan tebakan, tidak dihitung. Hanya nama warung
  -- yang ditampilkan, supaya pelanggan yakin ini link yang benar.
  if p_pin is null or p_pin = '' then
    return jsonb_build_object(
      'status', 'butuh_pin',
      'nama_warung', v_warung.nama_warung
    );
  end if;

  if p_pin is distinct from v_pelanggan.pin_pantau then
    -- Penambahan atomik: tebakan paralel tidak bisa menyelinap di antara
    -- baca dan tulis.
    insert into public.pantau_percobaan as pc (token_pantau, gagal, gagal_terakhir)
    values (p_token, 1, now())
    on conflict (token_pantau) do update
      set gagal = case
                    when pc.gagal_terakhir > now() - c_kunci then pc.gagal + 1
                    else 1
                  end,
          gagal_terakhir = now(),
          terkunci_sampai = null
    returning gagal into v_gagal;

    if v_gagal >= c_maks then
      update public.pantau_percobaan
         set terkunci_sampai = now() + c_kunci, gagal = 0
       where token_pantau = p_token;
      return jsonb_build_object(
        'status', 'terkunci',
        'sisa_detik', extract(epoch from c_kunci)::int
      );
    end if;

    return jsonb_build_object(
      'status', 'pin_salah',
      'nama_warung', v_warung.nama_warung,
      'sisa_percobaan', c_maks - v_gagal
    );
  end if;

  -- PIN benar: hitungan gagal dibersihkan.
  delete from public.pantau_percobaan where token_pantau = p_token;

  v_hasil := jsonb_build_object(
    'status', 'ok',
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
        and t.jenis = 'utang'
    ), '[]'::jsonb),
    'pembayaran', coalesce((
      select jsonb_agg(jsonb_build_object(
               'tanggal', b.tanggal,
               'nominal', b.nominal,
               'metode', b.metode,
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

revoke execute on function public.pantau_utang(uuid, text) from public;
grant execute on function public.pantau_utang(uuid, text) to anon, authenticated;
