-- Storage: dua bucket privat, isolasi berdasarkan segmen pertama path
-- ({warung_id}/...). Batas 2 MB sudah longgar karena foto di-resize di
-- client ke sisi terpanjang 512px sebelum diunggah.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('foto-pelanggan', 'foto-pelanggan', false, 2097152,
   array['image/jpeg', 'image/png', 'image/webp']),
  ('logo-warung', 'logo-warung', false, 2097152,
   array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy "foto pelanggan: akses warung sendiri" on storage.objects
  for all to authenticated
  using (
    bucket_id = 'foto-pelanggan'
    and exists (
      select 1 from public.warung_saya() as w(id)
      where w.id::text = (storage.foldername(name))[1]
    )
  )
  with check (
    bucket_id = 'foto-pelanggan'
    and exists (
      select 1 from public.warung_saya() as w(id)
      where w.id::text = (storage.foldername(name))[1]
    )
  );

create policy "logo warung: akses warung sendiri" on storage.objects
  for all to authenticated
  using (
    bucket_id = 'logo-warung'
    and exists (
      select 1 from public.warung_saya() as w(id)
      where w.id::text = (storage.foldername(name))[1]
    )
  )
  with check (
    bucket_id = 'logo-warung'
    and exists (
      select 1 from public.warung_saya() as w(id)
      where w.id::text = (storage.foldername(name))[1]
    )
  );
